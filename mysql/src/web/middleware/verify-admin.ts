import { NextFunction, Request, Response } from "express";
import config from "../../config/config";
import { UnauthorizedException } from "../exception/unauthorized-exception";
import { ERROR_CODES } from "../../constant/error";

export interface RequestUser {
    id: string;
    role: "admin";
}

declare global {
    namespace Express {
        interface Request {
            user?: RequestUser;
        }
    }
}

export const verifyAdmin = (req: Request, _res: Response, next: NextFunction): void => {
    const apiKey = req.query.API_KEY || req.headers.accesstoken;

    if (!config.ADMIN_API_KEY || typeof apiKey !== "string" || apiKey !== config.ADMIN_API_KEY) {
        next(new UnauthorizedException(ERROR_CODES.E_UNAUTHORIZED));
        return;
    }

    // Replace with the authenticated user's identity when user authentication is added.
    req.user = { id: "dummy-admin", role: "admin" };
    next();
};
