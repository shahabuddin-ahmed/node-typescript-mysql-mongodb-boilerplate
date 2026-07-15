import { BadRequestException } from "./bad-request-exception";
import { NotFoundException } from "./not-found-exception";
import { ERROR_CODES } from "../../constant/error";

jest.mock("../../utils/utility", () => ({
    retrieveErrorMessage: jest.fn((code: any) => `message for ${String(code)}`),
}));
import { retrieveErrorMessage } from "../../utils/utility";

afterEach(() => {
    jest.clearAllMocks();
});

describe("BadRequestException", () => {
    it("uses retrieveErrorMessage when customMessage is not provided", () => {
        const err = new BadRequestException(ERROR_CODES.E_INVALID_DATA);

        expect(retrieveErrorMessage).toHaveBeenCalledTimes(1);
        expect(retrieveErrorMessage).toHaveBeenCalledWith(
            ERROR_CODES.E_INVALID_DATA
        );

        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(BadRequestException);

        expect(err.message).toBe(
            `message for ${String(ERROR_CODES.E_INVALID_DATA)}`
        );
        expect((err as any).statusCode).toBe(400);

        expect((err as any).code).toBe(ERROR_CODES.E_INVALID_DATA);
        expect((err as any).customMessage).toBeUndefined();
        expect((err as any).errors).toBeUndefined();
    });

    it("prefers customMessage and sets errors array", () => {
        const custom = "Custom error text";
        const details = ["field1 is required", "field2 must be number"];

        const err = new BadRequestException(
            ERROR_CODES.E_PAGE_NOT_FOUND,
            custom,
            details
        );

        expect(retrieveErrorMessage).not.toHaveBeenCalled();

        expect(err.message).toBe(custom);
        expect((err as any).statusCode).toBe(400);
        expect((err as any).code).toBe(ERROR_CODES.E_PAGE_NOT_FOUND);
        expect((err as any).customMessage).toBe(custom);
        expect((err as any).errors).toEqual(details);
    });
});

describe("NotFoundException", () => {
    it("uses retrieveErrorMessage when customMessage is not provided", () => {
        const err = new NotFoundException(ERROR_CODES.E_PAGE_NOT_FOUND);

        expect(retrieveErrorMessage).toHaveBeenCalledTimes(1);
        expect(retrieveErrorMessage).toHaveBeenCalledWith(
            ERROR_CODES.E_PAGE_NOT_FOUND
        );

        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(NotFoundException);

        expect(err.message).toBe(
            `message for ${String(ERROR_CODES.E_PAGE_NOT_FOUND)}`
        );
        expect((err as any).statusCode).toBe(404);

        expect((err as any).code).toBe(ERROR_CODES.E_PAGE_NOT_FOUND);
        expect((err as any).customMessage).toBeUndefined();
        expect((err as any).errors).toBeUndefined();
    });

    it("prefers customMessage and sets errors array", () => {
        const custom = "Resource not found";
        const details = ["id=12345"];

        const err = new NotFoundException(
            ERROR_CODES.E_PAGE_NOT_FOUND,
            custom,
            details
        );

        expect(retrieveErrorMessage).not.toHaveBeenCalled();

        expect(err.message).toBe(custom);
        expect((err as any).statusCode).toBe(404);
        expect((err as any).code).toBe(ERROR_CODES.E_PAGE_NOT_FOUND);
        expect((err as any).customMessage).toBe(custom);
        expect((err as any).errors).toEqual(details);
    });
});
