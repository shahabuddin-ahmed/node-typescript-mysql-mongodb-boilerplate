
import { createHash } from "crypto";
import { NextFunction, Request, Response } from "express";
import { ERROR_CODES } from "../../constant/error";
import { newRedisClient } from "../../infra/redis";
import type { RequestUser as UserInterface } from "./verify-admin";
import { getIpAddress } from "../../utils/utility";
import { TooManyRequestException } from "../exception/too-many-request-exception";

type RedisClientType = Awaited<ReturnType<typeof newRedisClient>>;

type RateLimitWindowName = "short" | "daily" | "weekly";

interface RateLimitWindowConfig {
    limit: number;
    intervalInSec: number;
}

interface RateLimitPolicyConfig {
    short?: RateLimitWindowConfig;
    daily?: RateLimitWindowConfig;
    weekly?: RateLimitWindowConfig;
}

interface RateLimitEvaluation {
    name: RateLimitWindowName;
    window: RateLimitWindowConfig;
    remaining: number;
    resetInSec: number;
    exceeded: boolean;
}

const defaultRateLimits: Record<string, RateLimitPolicyConfig> = {
    "POST:/api/v1/posts/": {
        short: { limit: 2, intervalInSec: 30 },
        daily: { limit: 12, intervalInSec: 86400 },
        weekly: { limit: 100, intervalInSec: 604800 },
    },
    "GET:/api/v1/posts/": {
        short: { limit: 2, intervalInSec: 20 },
        daily: { limit: 12, intervalInSec: 86400 },
        weekly: { limit: 100, intervalInSec: 604800 },
    },
    "GET:/api/v1/posts/:id": {
        short: { limit: 1, intervalInSec: 20 },
        daily: { limit: 12, intervalInSec: 86400 },
        weekly: { limit: 100, intervalInSec: 604800 },
    },
    default: {
        short: { limit: 3, intervalInSec: 60 },
    },
};

function getRateLimitEndpoint(req: Request): string {
    console.log(`${req.method}:` + req.baseUrl + (req.route?.path || req.path));
    return `${req.method}:` + req.baseUrl + (req.route?.path || req.path);
}

function getRateLimit(
    endpoint: string
): RateLimitPolicyConfig {
    const configuredPolicy =
        defaultRateLimits[endpoint] ||
        defaultRateLimits.default;

    return normalizePolicy(configuredPolicy);
}

function normalizePolicy(
    policy: RateLimitPolicyConfig
): RateLimitPolicyConfig {
    const normalizedPolicy: RateLimitPolicyConfig = {};

    if (policy.short) {
        normalizedPolicy.short = normalizeWindow(policy.short);
    }

    if (policy.daily) {
        normalizedPolicy.daily = normalizeWindow(policy.daily);
    }

    if (policy.weekly) {
        normalizedPolicy.weekly = normalizeWindow(policy.weekly);
    }

    return normalizedPolicy;
}

function normalizeWindow(
    window?: RateLimitWindowConfig
): RateLimitWindowConfig {
    return {
        limit: Number(window?.limit || 0),
        intervalInSec: Number(window?.intervalInSec || 0),
    };
}

async function evaluateRateLimits(
    redisClient: RedisClientType,
    identifier: string,
    endpoint: string,
    policy: RateLimitPolicyConfig
): Promise<RateLimitEvaluation[]> {
    const evaluations: RateLimitEvaluation[] = [];
    const windows = getPolicyWindows(policy);

    for (const [name, window] of windows) {
        const key = `odin_rate_limit:${identifier}:${endpoint}:${name}`;

        // Initialize the counter with expiration if absent.
        await redisClient.set(key, "0", {
            NX: true,
            EX: window.intervalInSec,
        });

        const currentCount = await redisClient.incr(key);

        const ttl = await redisClient.ttl(key);

        const resetInSec =
            ttl > 0 ? ttl : window.intervalInSec;

        evaluations.push({
            name,
            window,
            remaining: Math.max(window.limit - currentCount, 0),
            resetInSec,
            exceeded: currentCount > window.limit,
        });
    }

    return evaluations;
}

function getPolicyWindows(
    policy: RateLimitPolicyConfig
): Array<[RateLimitWindowName, RateLimitWindowConfig]> {
    const windows: Array<
        [RateLimitWindowName, RateLimitWindowConfig]
    > = [];

    if (policy.short?.limit && policy.short.intervalInSec) {
        windows.push(["short", policy.short]);
    }

    if (policy.daily?.limit && policy.daily.intervalInSec) {
        windows.push(["daily", policy.daily]);
    }

    if (policy.weekly?.limit && policy.weekly.intervalInSec) {
        windows.push(["weekly", policy.weekly]);
    }

    return windows;
}

function getRateLimitIdentifier(user: UserInterface | undefined, ipAddress: string, userAgent: string | undefined) {
    if (user?.id) {
        return `user:${user.id}`;
    }

    const userAgentHash = createHash("sha256").update(userAgent || "unknown" ).digest("hex");

    return `ip:${ipAddress || "unknown" }:${userAgentHash}`;
}

function setRateLimitHeaders(res: Response, evaluations: RateLimitEvaluation[]): void {
    if (!evaluations.length) {
        return;
    }

    const activeWindow = evaluations.reduce(
        (current, nextWindow) => {
            if (nextWindow.exceeded) {
                return nextWindow;
            }

            if (current.exceeded) {
                return current;
            }

            return nextWindow.remaining < current.remaining ? nextWindow : current;
        }
    );

    res.set("RateLimit-Limit", activeWindow.window.limit.toString());
    res.set("RateLimit-Remaining", activeWindow.remaining.toString());
    res.set("RateLimit-Reset", activeWindow.resetInSec.toString());
    res.set("RateLimit-Window", activeWindow.name);
}


export const newRateLimit = () => async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { user } = req;
        const userId = user?.id || null;
        const endpoint = getRateLimitEndpoint(req);

        const { clientIp: ipAddress } = getIpAddress(req);
        const redisClient = await newRedisClient();
        const identifier = getRateLimitIdentifier(user, ipAddress, req.headers["user-agent"]);

        const policy = getRateLimit(endpoint);

        const evaluations = await evaluateRateLimits(redisClient, identifier, endpoint, policy);

        const exceededLimits = evaluations.filter(evaluation => evaluation.exceeded);

        const exceededLimit = exceededLimits.length ? exceededLimits.reduce(
            (current, nextWindow) => nextWindow.resetInSec > current.resetInSec ? nextWindow : current
        ) : null;


        setRateLimitHeaders(res, exceededLimit ? [exceededLimit] : evaluations);

        if (exceededLimit) {
            const resetInSec = exceededLimit.resetInSec;

            res.set("Retry-After", resetInSec.toString());

            console.log("Rate Limit is exceeded");

            throw new TooManyRequestException(ERROR_CODES.E_TOO_MANY_REQUEST);
        }

        return next();

    } catch (err) {
        console.error(err);
        return next(err);
    }
}