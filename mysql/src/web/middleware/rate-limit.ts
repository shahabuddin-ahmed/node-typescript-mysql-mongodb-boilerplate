import { NextFunction, Request, Response } from "express";
import NodeCache from "node-cache";
import { ERROR_CODES } from "../../constant/error";
import { getIpAddress } from "../../utils/utility";
import { createHash } from "crypto";
import { newRedisClient } from "../../infra/redis";
import { TooManyRequestException } from "../exception/too-many-request-exception";
import config from "../../config/config";
import AccessConfiguration, {
    RateLimitPolicyConfig,
    AccessConfigurationRateLimitMap,
    AccessConfigurationTargetType,
} from "../../model/access-configuration";

type RedisClientType = Awaited<ReturnType<typeof newRedisClient>>;

interface VerifyRateLimit {
    windowName: string;
    remainingLimit: number;
    resetInSec: number;
}

const defaultRateLimit: AccessConfigurationRateLimitMap = {
    "GET:/api/v1/search/flight": {
        sort: { limit: 2, throttlingInSec: 5 },
        daily: { limit: 200, throttlingInSec: 86400 },
        weekly: { limit: 1000, throttlingInSec: 604800 },
    },
    "GET:/api/v1/search/hotel": {
        sort: { limit: 2, throttlingInSec: 5 },
        daily: { limit: 200, throttlingInSec: 86400 },
        weekly: { limit: 1000, throttlingInSec: 604800 },
    },
    default: {
        sort: { limit: 120, throttlingInSec: 60 },
    },
};

const accessConfigurationCache = new NodeCache({
    stdTTL: config.ACCESS_CONFIGURATION_CACHE_TTL_SEC,
    checkperiod: 0,
    useClones: false,
});

const ACCESS_CONFIGURATION_CACHE_KEY = "all_access_configurations";
let accessConfigurationsLoad: Promise<AccessConfiguration[]> | null = null;

async function getAccessConfigurations(): Promise<AccessConfiguration[]> {
    const cachedAccessConfiguration = accessConfigurationCache.get<
        AccessConfiguration[]
    >(ACCESS_CONFIGURATION_CACHE_KEY);

    if (cachedAccessConfiguration) {
        return cachedAccessConfiguration;
    }

    if (!accessConfigurationsLoad) {
        accessConfigurationsLoad = AccessConfiguration.findAll();
    }

    const configurationLoad = accessConfigurationsLoad;
    let configurations: AccessConfiguration[] = [];

    try {
        configurations = await configurationLoad;
    } catch (error) {
        console.error(
            "Failed to load rate limit access configurations from database",
            error,
        );
    }

    if (accessConfigurationsLoad === configurationLoad) {
        accessConfigurationCache.set(
            ACCESS_CONFIGURATION_CACHE_KEY,
            configurations,
        );
        accessConfigurationsLoad = null;
    }
    return configurations;
}

function getUserAgent(req: Request): { userAgentHash: string } {
    const userAgent = req.headers["user-agent"] || "unknown";
    const userAgentHash = createHash("sha256").update(userAgent).digest("hex");
    return { userAgentHash };
}

function getEndpoint(req: Request): string {
    const routePath =
        typeof req.route?.path === "string" ? req.route.path : req.path;
    const path =
        `${req.baseUrl}${routePath}`.toLowerCase().replace(/\/+$/, "") || "/";

    const method =
        req.method === "HEAD" &&
        req.route?.methods?.get &&
        !req.route.methods.head
            ? "GET"
            : req.method.toUpperCase();
    return `${method}:${path}`;
}

function getRateLimitKey(
    userId: string | null,
    ipAddress: string,
    userAgentHash: string,
): string {
    return userId ? `user:${userId}` : `ip:${ipAddress}:${userAgentHash}`;
}

async function getConfiguredRateLimit(
    userId: string | null,
    ipAddress: string,
    endpoint: string,
): Promise<RateLimitPolicyConfig | null> {
    const targetValues = [
        userId
            ? {
                  targetType: AccessConfigurationTargetType.USER,
                  targetValue: userId,
              }
            : {
                  targetType: AccessConfigurationTargetType.IP,
                  targetValue: ipAddress,
              },
        {
            targetType: AccessConfigurationTargetType.DEFAULT,
            targetValue: null,
        },
    ];

    const accessConfigurations = await getAccessConfigurations();

    for (const targetValue of targetValues) {
        const accessConfiguration = accessConfigurations.find(
            (configuration) =>
                configuration.targetType === targetValue.targetType &&
                configuration.targetValue === targetValue.targetValue,
        );

        if (accessConfiguration) {
            const rateLimit =
                accessConfiguration.rateLimits.find((map) => map[endpoint])?.[
                    endpoint
                ] ||
                accessConfiguration.rateLimits.find((map) => map.default)
                    ?.default;

            if (rateLimit) {
                return rateLimit;
            }
        }
    }

    return null;
}

async function verifyRateLimit(
    rateLimitPolicy: RateLimitPolicyConfig,
    redisClient: RedisClientType,
    endpoint: string,
    rateLimitKey: string,
): Promise<{
    rateLimitExceeded: boolean;
    rateLimitWindow: VerifyRateLimit;
}> {
    let exceededWindow: VerifyRateLimit | null = null;
    let remainingWindow: VerifyRateLimit | null = null;

    await Promise.all(
        Object.keys(rateLimitPolicy).map(async (rateLimitName: string) => {
            const key = `${rateLimitKey}:${endpoint}:${rateLimitName}`;

            const { limit, throttlingInSec } =
                rateLimitPolicy[rateLimitName as keyof RateLimitPolicyConfig]!;

            const [usedCount, , resetInSec] = (await redisClient
                .multi()
                .incr(key)
                .expire(key, throttlingInSec, "NX")
                .ttl(key)
                .exec()) as [number, boolean, number];

            const remainingLimit = Math.max(limit - usedCount, 0);

            const data = {
                windowName: rateLimitName,
                remainingLimit,
                resetInSec,
            };

            if (usedCount > limit) {
                exceededWindow =
                    !exceededWindow || resetInSec > exceededWindow.resetInSec
                        ? data
                        : exceededWindow;
            } else {
                remainingWindow =
                    !remainingWindow ||
                    remainingLimit < remainingWindow.remainingLimit
                        ? data
                        : remainingWindow;
            }
        }),
    );

    const rateLimitWindow = exceededWindow ?? remainingWindow;
    if (!rateLimitWindow) {
        throw new Error("No rate limit windows configured");
    }

    return { rateLimitExceeded: !!exceededWindow, rateLimitWindow };
}

function setRateLimitHeaders(
    res: Response,
    rateLimitWindow: VerifyRateLimit,
    rateLimitExceeded: boolean,
): void {
    res.set("Rate-Limit-Remaining", rateLimitWindow.remainingLimit.toString());
    res.set("Rate-Limit-Reset", rateLimitWindow.resetInSec.toString());
    res.set("Rate-Limit-Window", rateLimitWindow.windowName);

    if (rateLimitExceeded) {
        res.set(
            "Retry-After",
            Math.max(1, rateLimitWindow.resetInSec).toString(),
        );
    }
}

export const newRateLimit =
    () =>
    async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        try {
            const { id: userId } = req.user || { id: null };
            const { clientIp: ipAddress } = getIpAddress(req);
            const { userAgentHash } = getUserAgent(req);
            const endpoint = getEndpoint(req);
            const rateLimitKey = getRateLimitKey(
                userId,
                ipAddress,
                userAgentHash,
            );

            const redisClient = await newRedisClient();

            const configuredRateLimit = await getConfiguredRateLimit(
                userId,
                ipAddress,
                endpoint,
            );

            const rateLimit =
                configuredRateLimit ||
                defaultRateLimit[endpoint] ||
                defaultRateLimit.default;

            const { rateLimitExceeded, rateLimitWindow } =
                await verifyRateLimit(
                    rateLimit,
                    redisClient,
                    endpoint,
                    rateLimitKey,
                );
            setRateLimitHeaders(res, rateLimitWindow, rateLimitExceeded);

            if (rateLimitExceeded) {
                throw new TooManyRequestException(
                    ERROR_CODES.E_TOO_MANY_REQUEST,
                );
            }

            next();
        } catch (err) {
            console.error(err);
            return next(err);
        }
    };
