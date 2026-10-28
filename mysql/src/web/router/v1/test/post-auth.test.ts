import express, { Request, Response } from "express";
import request from "supertest";
import config from "../../../../config/config";
import { newPostRouter } from "../post";
import { globalErrorHandler } from "../../../middleware/global-error-handler";

describe("Post route authentication", () => {
    const originalKey = config.ADMIN_API_KEY;
    const handler = jest.fn(async (req: Request, res: Response) => {
        res.json({ user: req.user || null });
    });
    let app: express.Express;

    beforeEach(async () => {
        config.ADMIN_API_KEY = "test-admin-key";
        handler.mockClear();
        app = express();
        app.use("/posts", await newPostRouter({
            create: handler,
            update: handler,
            remove: handler,
            list: handler,
            getById: handler,
        }));
        app.use(globalErrorHandler);
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        config.ADMIN_API_KEY = originalKey;
        jest.restoreAllMocks();
    });

    it.each(["post", "put", "delete"] as const)("protects %s with either supported key source", async (method) => {
        const path = method === "post" ? "/posts" : "/posts/1";
        for (const key of [undefined, "wrong-key"]) {
            const pending = request(app)[method](path);
            if (key) pending.set("accesstoken", key);
            const response = await pending;
            expect(response.status).toBe(401);
            expect(response.body.code).toBe("E_UNAUTHORIZED");
        }
        expect(handler).not.toHaveBeenCalled();

        const headerResponse = await request(app)[method](path).set("accesstoken", "test-admin-key");
        const queryResponse = await request(app)[method](path).query({ API_KEY: "test-admin-key" });
        for (const response of [headerResponse, queryResponse]) {
            expect(response.status).toBe(200);
            expect(response.body.user).toEqual({ id: "dummy-admin", role: "admin" });
        }
    });

    it.each(["/posts", "/posts/1"])("keeps GET %s public", async (path) => {
        const response = await request(app).get(path);
        expect(response.status).toBe(200);
        expect(response.body.user).toBeNull();
    });

    it("denies access when the server key is unset, even with an empty supplied key", async () => {
        config.ADMIN_API_KEY = "";
        const response = await request(app).post("/posts").set("accesstoken", "");
        expect(response.status).toBe(401);
        expect(handler).not.toHaveBeenCalled();
    });

    it("rejects repeated query keys", async () => {
        const response = await request(app).post("/posts?API_KEY=test-admin-key&API_KEY=test-admin-key");
        expect(response.status).toBe(401);
        expect(handler).not.toHaveBeenCalled();
    });
});
