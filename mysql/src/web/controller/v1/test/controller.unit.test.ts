import Joi from "joi";
import { Controller, type ResponseType } from "../../controller";
import {
    ApiResponseMessages,
    ERROR_CODES,
    errorMessages,
} from "../../../../constant/error";
import { BadRequestException } from "../../../exception/bad-request-exception";

class TestController extends Controller {}

function makeRes() {
    const res: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn((body: any) => body),
    };
    return res;
}

describe("Controller", () => {
    let ctrl: TestController;

    beforeEach(() => {
        ctrl = new TestController();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("sendResponse", () => {
        it("200 OK: defaults code/message, sets response and empty errors", () => {
            const res = makeRes();
            const payload: ResponseType = { response: { ok: true } };

            const out = ctrl.sendResponse(payload, 200, res as any);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledTimes(1);

            expect(out).toEqual({
                code: ApiResponseMessages.SUCCESS,
                message: "Success",
                response: { ok: true },
                errors: [],
            });
        });

        it("200 OK: respects custom message and explicit non-empty errors", () => {
            const res = makeRes();
            const payload: ResponseType = {
                message: "All good",
                response: { id: 1 },
                errors: ["minor warning"],
            };

            const out = ctrl.sendResponse(payload, 200, res as any);

            expect(out).toEqual({
                code: ApiResponseMessages.SUCCESS,
                message: "All good",
                response: { id: 1 },
                errors: ["minor warning"],
            });
        });

        it("500 ERR: uses internal error code, keeps custom message, and echoes message in errors", () => {
            const res = makeRes();
            const payload: ResponseType = {
                message: "Boom",
                response: undefined as any,
            };

            const out = ctrl.sendResponse(payload, 500, res as any);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(out).toEqual({
                code: ERROR_CODES.E_INTERNAL_SERVER_ERROR,
                message: "Boom",
                response: null,
                errors: ["Boom"],
            });
        });

        it("500 ERR: without custom message uses default server error text", () => {
            const res = makeRes();
            const payload: ResponseType = { response: undefined as any };

            const out = ctrl.sendResponse(payload, 500, res as any);

            expect(out.code).toBe(ERROR_CODES.E_INTERNAL_SERVER_ERROR);
            expect(out.message).toBe(
                errorMessages.E_INTERNAL_SERVER_ERROR.message
            );
            expect(out.response).toBeNull();
            expect(out.errors).toEqual(["undefined"]);
        });
    });

    describe("validateRequest", () => {
        it("returns { value } when schema passes (allowUnknown true)", async () => {
            const schema = Joi.object({
                name: Joi.string().min(1).required(),
            });

            const input = { name: "Alice", extra: "allowed" };
            const { value } = await ctrl.validateRequest(schema, input);

            expect(value).toMatchObject({ name: "Alice", extra: "allowed" });
        });

        it("throws BadRequestException with aggregated Joi messages when invalid", async () => {
            const schema = Joi.object({
                name: Joi.string().required(),
                age: Joi.number().min(18).required(),
            });

            const input = {};

            await expect(
                ctrl.validateRequest(schema, input)
            ).rejects.toBeInstanceOf(BadRequestException);

            try {
                await ctrl.validateRequest(schema, input);
            } catch (e) {
                const err = e as BadRequestException;
                expect((err as any).code).toBe(ERROR_CODES.E_INVALID_DATA);
                expect((err as any).statusCode).toBe(400);
                const msgs = (err as any).errors as string[];
                expect(Array.isArray(msgs)).toBe(true);
                expect(msgs.length).toBeGreaterThanOrEqual(2);
                expect(msgs.join(" ")).toMatch(/name/i);
                expect(msgs.join(" ")).toMatch(/age/i);
            }
        });
    });
});
