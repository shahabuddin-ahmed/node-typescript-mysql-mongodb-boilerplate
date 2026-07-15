import { ERROR_CODES } from "../../constant/error";
import { retrieveErrorMessage } from "../../utils/utility";

export class BadRequestException extends Error {

    private statusCode;

    constructor(private code: ERROR_CODES, private customMessage?: string, private errors?: string[]) {
        const message = customMessage || retrieveErrorMessage(code);
        super(message);
        this.code = code;
        this.customMessage = customMessage;
        this.errors = errors;
        this.statusCode = 400;
    }
}