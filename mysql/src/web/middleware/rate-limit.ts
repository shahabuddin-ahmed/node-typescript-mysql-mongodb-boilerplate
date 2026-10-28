import { NextFunction, Request, Response } from "express";
import config from "../../config/config";
import { ERROR_CODES } from "../../constant/error";
import { getIpAddress } from "../../utils/utility";
import { createHash } from "crypto";
import { newRedisClient } from "../../infra/redis";
import { TooManyRequestException } from "../exception/too-many-request-exception";

type RedisClientType = Awaited<ReturnType<typeof newRedisClient>>;

interface RateLimitConfig {
    limit: number;
    throttlingInSec: number;
}

interface RateLimit {
    sort: RateLimitConfig;
    daily?: RateLimitConfig;
    weekly?: RateLimitConfig;
}

interface VerifyRateLimit {
    windowName: string;
    remainingLimit: number;
    resetInSec: number;
}

const defaultRateLimit: Record<string, RateLimit> = {
    "GET:/api/v1/search/flight": {
        sort: { limit: 2, throttlingInSec: 30 },
        daily: { limit: 10, throttlingInSec: 86400 },
        weekly: { limit: 100, throttlingInSec: 604800 },
    },
    "GET:/api/v1/search/hotel": {
        sort: { limit: 2, throttlingInSec: 30 },
        daily: { limit: 10, throttlingInSec: 86400 },
        weekly: { limit: 100, throttlingInSec: 604800 },
    },
    "POST:/api/v1/posts": {
        sort: { limit: 2, throttlingInSec: 30 },
        daily: { limit: 10, throttlingInSec: 86400 },
        weekly: { limit: 100, throttlingInSec: 604800 },
    },
    "GET:/api/v1/posts": {
        sort: { limit: 2, throttlingInSec: 30 },
        daily: { limit: 10, throttlingInSec: 86400 },
        weekly: { limit: 100, throttlingInSec: 604800 },
    },
    default: {
        sort: { limit: 3, throttlingInSec: 30 },
        daily: { limit: 20, throttlingInSec: 86400 },
        weekly: { limit: 200, throttlingInSec: 604800 },
    }
}

function getUserAgent(req: Request): { userAgentHash: string } {
    const userAgent = req.headers["user-agent"] || "unknown";
    const userAgentHash = createHash("sha256").update(userAgent).digest("hex");
    return { userAgentHash };
}

function getEndpoint(req: Request): string {
    return `${req.method}:${req.baseUrl}${req.path}`;
}

function getRateLimitKey(userId: string | null, ipAddress: string, userAgentHash: string): string {
    return userId ? `user:${userId}` : `ip:${ipAddress}:${userAgentHash}`;
}

async function verifyRatelimit(rateLimit: RateLimit, redisClient: RedisClientType, endpoint: string, rateLimitKey: string): Promise<{exceededRateLimits: VerifyRateLimit[], remainingRateLimits: VerifyRateLimit[]}> {

    const exceededRateLimits: VerifyRateLimit[] = [], remainingRateLimits: VerifyRateLimit[] = [];
    await Promise.all(
        Object.keys(rateLimit).map(async (rateLimitName: string) => {
        const key = `${rateLimitKey}:${endpoint}:${rateLimitName}`;

        const { limit, throttlingInSec } = rateLimit[rateLimitName as keyof RateLimit] || { limit: 0, throttlingInSec: 0 } as RateLimitConfig;

        await redisClient.set(key, "0", {
            NX: true,
            EX: throttlingInSec
        });

        const usedCount = await redisClient.incr(key);
        const ttl = await redisClient.ttl(key);

        const resetInSec = ttl ? ttl : throttlingInSec;
        const remainingLimit = Math.max(limit - usedCount, 0);

        const data = {
            windowName: rateLimitName,
            remainingLimit,
            resetInSec,
        }

        if (usedCount > limit) {
            exceededRateLimits.push(data);
        } else {
            remainingRateLimits.push(data);
        }

        return 

    }));

    return { exceededRateLimits, remainingRateLimits };
}

export const newRateLimit = () => async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {

        const { id: userId } = req.user || { id: null };
        const { clientIp: ipAddress } = getIpAddress(req);
        const { userAgentHash } = getUserAgent(req);
        const endpoint = getEndpoint(req);
        const rateLimitKey = getRateLimitKey(userId, ipAddress, userAgentHash);

        const redisClient = await newRedisClient();

        const rateLimit = defaultRateLimit[endpoint] || defaultRateLimit.default;
        
        const { exceededRateLimits, remainingRateLimits } = await verifyRatelimit(rateLimit, redisClient, endpoint, rateLimitKey);

        if (exceededRateLimits.length) {
            res.set("Rate-Limit-Remaining", String(exceededRateLimits[0].remainingLimit));
            res.set("Rate-Limit-Reset", String(exceededRateLimits[0].resetInSec));
            res.set("Rate-Limit-Window", String(exceededRateLimits[0].windowName));
            throw new TooManyRequestException(ERROR_CODES.E_TOO_MANY_REQUEST);
        }

        if (remainingRateLimits.length) {
            res.set("Rate-Limit-Remaining", String(remainingRateLimits[0].remainingLimit));
            res.set("Rate-Limit-Reset", String(remainingRateLimits[0].resetInSec));
            res.set("Rate-Limit-Window", String(remainingRateLimits[0].windowName));
        }

        next();

    } catch (err) {
        console.error(err);
        return next(err);
    }
};
