import { Router } from "express";

export const newHealthRouter = async (): Promise<Router> => {
    const healthRouter = Router();

    healthRouter.get("/", (_req, res) => {
        return res.status(200).send({
            code: "SUCCESS",
            message: "Welcome to MySQL Service API",
            response: null,
            errors: []
        });
    });

    return healthRouter;
};