import { NextFunction, Request, Response } from "express";
import { newRedisClient } from "../../infra/redis";
import { newRateLimit } from "./rate-limit";
import { TooManyRequestException } from "../exception/too-many-request-exception";

jest.mock("../../infra/redis", () => ({ newRedisClient: jest.fn() }));

describe("Per-client rate limits", () => {
    let middleware: ReturnType<typeof newRateLimit>;

    beforeEach(() => {
        const counters = new Map<string, number>();
        const redis = {
            set: jest.fn(async (key: string) => {
                if (!counters.has(key)) counters.set(key, 0);
            }),
            incr: jest.fn(async (key: string) => {
                const count = (counters.get(key) || 0) + 1;
                counters.set(key, count);
                return count;
            }),
            ttl: jest.fn(async () => 5),
        };
        (newRedisClient as jest.Mock).mockResolvedValue(redis);
        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
        middleware = newRateLimit();
    });

    afterEach(() => jest.restoreAllMocks());

    async function call(userId: string) {
        const req = {
            method: "GET",
            baseUrl: "/api/v1/posts",
            route: { path: "/:id" },
            headers: {},
            user: { id: userId, role: "admin" },
        } as Request;
        const res = { set: jest.fn() } as unknown as Response;
        const next = jest.fn() as jest.MockedFunction<NextFunction>;
        await middleware(req, res, next);
        return { res, next };
    }

    it("allows independent clients beyond the former shared global limit", async () => {
        for (let i = 0; i < 5; i++) {
            const { next } = await call(`client-${i}`);
            expect(next).toHaveBeenCalledWith();
        }
    });

    it("still rejects a client exceeding its own limit and sets retry headers", async () => {
        const first = await call("repeat-client");
        expect(first.next).toHaveBeenCalledWith();

        const second = await call("repeat-client");
        expect(second.next).toHaveBeenCalledWith(expect.any(TooManyRequestException));
        expect(second.res.set).toHaveBeenCalledWith("RateLimit-Window", "short");
        expect(second.res.set).toHaveBeenCalledWith("retry-After", "5");

        const other = await call("other-client");
        expect(other.next).toHaveBeenCalledWith();
    });
});
