import { NextFunction, Request, Response } from "express";
import NodeCache from "node-cache";
import { ERROR_CODES } from "../../constant/error";
import { getIpAddress } from "../../utils/utility";
import { createHash } from "crypto";
import { newRedisClient } from "../../infra/redis";
import { TooManyRequestException } from "../exception/too-many-request-exception";
import AccessConfiguration, {
    RateLimitWindowConfig,
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
    stdTTL: 1800,
    checkperiod: 90,
}); // Cache access configurations for 30 minutes

const ACCESS_CONFIGURATION_CACHE_KEY = "all_access_configurations";

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

    return `${req.method.toUpperCase()}:${path}`;
}

function getRateLimitKey(
    userId: string | null,
    ipAddress: string,
    userAgentHash: string,
): string {
    return userId ? `user:${userId}` : `ip:${ipAddress}:${userAgentHash}`;
}

async function getAccessConfiguration(
    userId: string | null,
    ipAddress: string,
): Promise<AccessConfiguration | null> {
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

    let accessConfigurations = accessConfigurationCache.get<
        AccessConfiguration[]
    >(ACCESS_CONFIGURATION_CACHE_KEY);

    if (!accessConfigurations) {
        accessConfigurations = await AccessConfiguration.findAll();
        if (!accessConfigurations.length) {
            return null;
        }

        accessConfigurationCache.set(
            ACCESS_CONFIGURATION_CACHE_KEY,
            accessConfigurations,
        );
    }

    for (const targetValue of targetValues) {
        const accessConfiguration = accessConfigurations.find(
            (configuration) =>
                configuration.targetType === targetValue.targetType &&
                configuration.targetValue === targetValue.targetValue,
        );

        if (accessConfiguration) {
            return accessConfiguration;
        }
    }

    return null;
}

async function verifyRatelimit(
    rateLimit: RateLimitPolicyConfig,
    redisClient: RedisClientType,
    endpoint: string,
    rateLimitKey: string,
): Promise<{
    exceededRateLimits: VerifyRateLimit[];
    remainingRateLimits: VerifyRateLimit[];
}> {
    const exceededRateLimits: VerifyRateLimit[] = [];
    const remainingRateLimits: VerifyRateLimit[] = [];

    await Promise.all(
        Object.keys(rateLimit).map(async (rateLimitName: string) => {
            const key = `${rateLimitKey}:${endpoint}:${rateLimitName}`;

            const { limit, throttlingInSec } =
                rateLimit[rateLimitName as keyof RateLimitPolicyConfig] ||
                ({ limit: 0, throttlingInSec: 0 } as RateLimitWindowConfig);

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
                exceededRateLimits.push(data);
            } else {
                remainingRateLimits.push(data);
            }

            return;
        }),
    );

    return { exceededRateLimits, remainingRateLimits };
}

function setRateLimitHeaders(
    res: Response,
    exceededRateLimit: VerifyRateLimit | null,
    remainingRateLimit: VerifyRateLimit,
): void {
    if (exceededRateLimit) {
        res.set(
            "Rate-Limit-Remaining",
            remainingRateLimit.remainingLimit.toString(),
        );
        res.set("Rate-Limit-Reset", exceededRateLimit.resetInSec.toString());
        res.set("Rate-Limit-Window", exceededRateLimit.windowName);
    } else {
        res.set(
            "Rate-Limit-Remaining",
            remainingRateLimit.remainingLimit.toString(),
        );
        res.set("Rate-Limit-Reset", remainingRateLimit.resetInSec.toString());
        res.set("Rate-Limit-Window", remainingRateLimit.windowName);
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

            const accessConfiguration = await getAccessConfiguration(
                userId,
                ipAddress,
            );

            const rateLimit =
                accessConfiguration?.rateLimits.find(
                    (rateLimit) => rateLimit[endpoint],
                )?.[endpoint] ||
                defaultRateLimit[endpoint] ||
                defaultRateLimit.default;

            const { exceededRateLimits, remainingRateLimits } =
                await verifyRatelimit(
                    rateLimit,
                    redisClient,
                    endpoint,
                    rateLimitKey,
                );

            setRateLimitHeaders(
                res,
                exceededRateLimits[0],
                remainingRateLimits[0],
            );

            if (exceededRateLimits.length) {
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
