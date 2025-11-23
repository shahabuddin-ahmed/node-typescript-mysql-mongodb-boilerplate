import { Request, Response, NextFunction } from "express";

// This will wrap any async controller to catch errors and pass to next
export const asyncHandler = (fn: any) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next); // catch any thrown error and pass to next
};
