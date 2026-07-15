export enum ERROR_CODES {
    E_PAGE_NOT_FOUND = "E_PAGE_NOT_FOUND",
    E_INVALID_DATA = "E_INVALID_DATA",
    E_INTERNAL_SERVER_ERROR = "E_INTERNAL_SERVER_ERROR",
}

export const errorMessages: Record<ERROR_CODES, { message: string }> = {
    E_PAGE_NOT_FOUND: {
        message: "please be sane and hit correct endpoints",
    },
    E_INVALID_DATA: {
        message: "Please provide valid data",
    },

    E_INTERNAL_SERVER_ERROR: {
        message: "Internal Server Error",
    },
};

export enum ApiResponseMessages {
    SUCCESS = "SUCCESS",
    INTERNAL_SERVER_ERROR = "Internal Server Error",
}
