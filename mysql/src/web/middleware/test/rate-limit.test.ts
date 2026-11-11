import express from "express";
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

describe("Rate-limit middleware", () => {
    const endpoint = "/api/v1/search/flight";
    let app: express.Express;
    let findAll: jest.Mock;

    function configuration(policy: unknown) {
        return {
            id: 1,
            targetType: "DEFAULT",
            targetValue: null,
            rateLimits: [{ [`GET:${endpoint}`]: policy }],
        };
    }

    beforeEach(async () => {
        jest.resetModules();
        jest.spyOn(console, "error").mockImplementation(() => {});
        findAll = (await import("../../../model/access-configuration")).default
            .findAll as jest.Mock;
        findAll.mockResolvedValue([]);
        const counts = new Map<string, number>();
        const redis = {
            multi: () => {
                let key: string;
                const transaction = {
                    incr: (value: string) => {
                        key = value;
                        return transaction;
                    },
                    expire: () => transaction,
                    ttl: () => transaction,
                    exec: async () => {
                        const count = (counts.get(key) || 0) + 1;
                        counts.set(key, count);
                        return [count, true, 5];
                    },
                };
                return transaction;
            },
        };
        (
            (await import("../../../infra/redis")).newRedisClient as jest.Mock
        ).mockResolvedValue(redis);
        const { newRateLimit } = await import("../rate-limit");
        app = express();
        app.get(endpoint, newRateLimit(), (_req, res) =>
            res.json({ ok: true }),
        );
        app.use(globalErrorHandler);
    });

    afterEach(() => jest.restoreAllMocks());

    it("uses a valid database policy instead of built-in limits", async () => {
        findAll.mockResolvedValue([
            configuration({ sort: { limit: 3, throttlingInSec: 5 } }),
        ]);
        const responses = [];
        for (let index = 0; index < 4; index++)
            responses.push(await request(app).get(endpoint));
        expect(responses.map((response) => response.status)).toEqual([
            200, 200, 200, 429,
        ]);
    });

    it.each([
        { rows: [] },
        { rows: [configuration({ sort: { limit: 2, throttlingInSec: 5 } })] },
    ])(
        "shares one database read between 20 concurrent requests and caches the result: %j",
        async ({ rows }) => {
            findAll.mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 20));
                return rows;
            });
            const responses = await Promise.all(
                Array.from({ length: 20 }, () => request(app).get(endpoint)),
            );
            expect(findAll).toHaveBeenCalledTimes(1);
            expect(
                responses.filter((response) => response.status === 200),
            ).toHaveLength(2);
            expect(
                responses.filter((response) => response.status === 429),
            ).toHaveLength(18);
            await request(app).get(endpoint);
            expect(findAll).toHaveBeenCalledTimes(1);
        },
    );

    it("shares one refresh after the cache expires, including an empty result", async () => {
        let now = Date.now();
        const ttl = (await import("../../../config/config")).default
            .ACCESS_CONFIGURATION_CACHE_TTL_SEC;
        jest.spyOn(Date, "now").mockImplementation(() => now);
        await request(app).get(endpoint);
        now += (ttl + 1) * 1000;
        findAll.mockImplementation(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return [];
        });
        await Promise.all(
            Array.from({ length: 20 }, () => request(app).get(endpoint)),
        );
        expect(findAll).toHaveBeenCalledTimes(2);
    });

    it("uses built-in limits when MySQL fails and caches the fallback", async () => {
        findAll.mockImplementationOnce(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            throw new Error("Table does not exist");
        });
        const responses = await Promise.all(
            Array.from({ length: 20 }, () => request(app).get(endpoint)),
        );
        expect(
            responses.filter((response) => response.status === 200),
        ).toHaveLength(2);
        expect(
            responses.filter((response) => response.status === 429),
        ).toHaveLength(18);
        expect((await request(app).get(endpoint)).status).toBe(429);
        expect(findAll).toHaveBeenCalledTimes(1);
    });
});
