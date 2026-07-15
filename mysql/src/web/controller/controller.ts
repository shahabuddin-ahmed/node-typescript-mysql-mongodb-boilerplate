import { ObjectSchema } from "joi";
import { Response } from "express";
import { errorMessages, ERROR_CODES, ApiResponseMessages } from "../../constant/error";
import { BadRequestException } from "../exception/bad-request-exception";

export type ResponseType = {
    code?: string;
    message?: string;
    response: Record<string, any> | Record<string, any>[] | null;
    errors?: string[]
}

export abstract class Controller {
    sendResponse(requestedData: ResponseType, statusCode: number, res: Response): any {

        return res.status(statusCode).send({
            code: statusCode >= 500 ? ERROR_CODES.E_INTERNAL_SERVER_ERROR : ApiResponseMessages.SUCCESS,
            message: requestedData.message ? requestedData.message : statusCode >= 500 ? errorMessages.E_INTERNAL_SERVER_ERROR.message : "Success",
            response: requestedData.response ? requestedData.response : null,
            errors: requestedData.errors && requestedData.errors.length ? requestedData.errors : statusCode >= 500 ? [`${requestedData.message}`] : []
        } as ResponseType)
    }

    async validateRequest(schema: ObjectSchema, data: any): Promise<{ value?: any; }> {
        const { value, error } = schema.validate(data, { abortEarly: false, allowUnknown: true });
    
        if (error) {
            const errorMessages = error.details.map((detail) => detail.message);

            throw new BadRequestException(ERROR_CODES.E_INVALID_DATA, "",  errorMessages)
        }
    
        return { value };
    }
}
