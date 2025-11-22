import { ERROR_CODES, errorMessages } from "../constant/error";

export function retrieveErrorMessage(errorCode: ERROR_CODES): string {
    return errorMessages[`${errorCode}`].message;
}