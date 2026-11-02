export enum ERROR_CODES {
    E_RATE_LIMIT_EXCEEDED = "E_RATE_LIMIT_EXCEEDED",
    E_UNAUTHORIZED = "E_UNAUTHORIZED",
    E_PAGE_NOT_FOUND = "E_PAGE_NOT_FOUND",
    E_INVALID_DATA = "E_INVALID_DATA",
    E_INTERNAL_SERVER_ERROR = "E_INTERNAL_SERVER_ERROR",
    E_TOO_MANY_REQUEST = "E_TOO_MANY_REQUEST",

}

export const errorMessages: Record<ERROR_CODES, { message: string }> = {
    E_RATE_LIMIT_EXCEEDED: { message: "Too many requests" },
    E_UNAUTHORIZED: {
        message: "Unauthorized",
    },
    E_PAGE_NOT_FOUND: {
        message: "please be sane and hit correct endpoints",
    },
    E_INVALID_DATA: {
        message: "Please provide valid data",
    },
    E_INTERNAL_SERVER_ERROR: {
        message: "Internal Server Error",
    },
    E_TOO_MANY_REQUEST: {
        message: "You are exceeded the rate limit. Please try after a moment.",
    },
};

export enum ApiResponseMessages {
    SUCCESS = "SUCCESS",
    INTERNAL_SERVER_ERROR = "Internal Server Error",
}
