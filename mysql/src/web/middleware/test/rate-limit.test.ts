import express, { Request, Response } from "express";
import request from "supertest";
import { globalErrorHandler } from "../global-error-handler";

jest.mock("../../../model/access-configuration", () => ({
    __esModule: true,
    default: { findAll: jest.fn() },
    AccessConfigurationTargetType: {
        USER: "USER",
        IP: "IP",
        DEFAULT: "DEFAULT",
    },
}));
jest.mock("../../../infra/redis", () => ({ newRedisClient: jest.fn() }));
jest.mock("../../../config/config", () => ({
    __esModule: true,
    default: { ACCESS_CONFIGURATION_CACHE_TTL_SEC: 30 },
}));

const flightPath = "/api/v1/search/flight";

function savedLimit(limit: number) {
    return {
        targetType: "DEFAULT",
        targetValue: null,
        isActive: true,
        rateLimits: [
            {
                [`GET:${flightPath}`]: { sort: { limit, throttlingInSec: 5 } },
            },
        ],
    };
}

describe("Rate-limit middleware", () => {
    let app: express.Express;
    let findAll: jest.Mock;
    let connectRedis: jest.Mock;
    let handler: jest.Mock;
    let now: number;
    let onRequest: (() => void) | undefined;

    function search() {
        return request(app).get(flightPath).set("User-Agent", "Test browser");
    }

    beforeEach(async () => {
        jest.resetModules();
        now = Date.now();
        onRequest = undefined;
        jest.spyOn(Date, "now").mockImplementation(() => now);
        jest.spyOn(console, "error").mockImplementation(() => {});

        findAll = (await import("../../../model/access-configuration")).default
            .findAll as jest.Mock;
        findAll.mockResolvedValue([]);

        const counters = new Map<string, { used: number; expiresAt: number }>();
        const redis = {
            multi: () => {
                let key: string;
                let duration: number;
                const transaction = {
                    incr(value: string) {
                        key = value;
                        return transaction;
                    },
                    expire(_key: string, seconds: number) {
                        duration = seconds;
                        return transaction;
                    },
                    ttl: () => transaction,
                    exec: async () => {
                        let counter = counters.get(key);
                        if (!counter || counter.expiresAt <= now) {
                            counter = {
                                used: 0,
                                expiresAt: now + duration * 1000,
                            };
                            counters.set(key, counter);
                        }
                        counter.used++;
                        return [
                            counter.used,
                            true,
                            Math.floor((counter.expiresAt - now) / 1000),
                        ];
                    },
                };
                return transaction;
            },
        };
        connectRedis = (await import("../../../infra/redis"))
            .newRedisClient as jest.Mock;
        connectRedis.mockResolvedValue(redis);

        const { newRateLimit } = await import("../rate-limit");
        handler = jest.fn((_req: Request, res: Response) =>
            res.json({ ok: true }),
        );
        app = express();
        app.use((_req, _res, next) => {
            onRequest?.();
            next();
        });
        app.get(flightPath, newRateLimit(), handler);
        app.use(globalErrorHandler);
    });

    afterEach(() => jest.restoreAllMocks());

    it("uses the DB limit and blocks the next request when the quota is used", async () => {
        findAll.mockResolvedValue([savedLimit(1)]);

        const allowed = await search();
        const blocked = await search();

        expect(allowed.status).toBe(200);
        expect(blocked.status).toBe(429);
        expect(blocked.body.code).toBe("E_TOO_MANY_REQUEST");
        expect(blocked.headers["rate-limit-remaining"]).toBe("0");
        expect(blocked.headers["rate-limit-window"]).toBe("sort");
        expect(blocked.headers["retry-after"]).toBe("5");
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("shares one DB lookup when 20 requests arrive together", async () => {
        let release!: () => void;
        const waiting = new Promise<void>((resolve) => {
            release = resolve;
        });
        findAll.mockImplementation(async () => {
            await waiting;
            return [];
        });
        let arrived = 0;
        onRequest = () => {
            if (++arrived === 20) release();
        };

        const responses = await Promise.all(
            Array.from({ length: 20 }, () => search()),
        );

        expect(findAll).toHaveBeenCalledTimes(1);
        expect(
            responses.filter((response) => response.status === 200),
        ).toHaveLength(2);
        expect(
            responses.filter((response) => response.status === 429),
        ).toHaveLength(18);
    });

    it("caches an empty result and reads new settings after the cache expires", async () => {
        const first = await search();
        const second = await search();
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(findAll).toHaveBeenCalledTimes(1);

        findAll.mockResolvedValue([savedLimit(1)]);
        now += 31_000;
        const refreshed = await search();
        const blocked = await search();

        expect(refreshed.status).toBe(200);
        expect(refreshed.headers["rate-limit-remaining"]).toBe("0");
        expect(blocked.status).toBe(429);
        expect(findAll).toHaveBeenCalledTimes(2);
    });

    it("falls back to built in limits when MySQL fails", async () => {
        findAll.mockRejectedValue(new Error("MySQL is unavailable"));

        const responses = [await search(), await search(), await search()];

        expect(responses.map((response) => response.status)).toEqual([
            200, 200, 429,
        ]);
        expect(responses[2].headers["rate-limit-remaining"]).toBe("0");
        expect(findAll).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(
            "Failed to load rate limit access configurations from database",
            expect.any(Error),
        );
    });

    it("returns a server error when Redis is unavailable", async () => {
        connectRedis.mockRejectedValue(new Error("Redis is unavailable"));

        const response = await search();

        expect(response.status).toBe(500);
        expect(response.body.code).toBe("E_INTERNAL_SERVER_ERROR");
        expect(handler).not.toHaveBeenCalled();
    });
});
