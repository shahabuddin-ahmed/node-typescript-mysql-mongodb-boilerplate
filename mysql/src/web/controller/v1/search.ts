import { Request, Response } from "express";
import { Controller } from "../controller";
import { flightSearchSchema, hotelSearchSchema } from "../../validation/search";

export interface SearchControllerInterface {
    flightSearch(req: Request, res: Response): any;
    hotelSearch(req: Request, res: Response): any;
}

export class SearchController
    extends Controller
    implements SearchControllerInterface
{
    constructor() {
        super();
        this.flightSearch = this.flightSearch.bind(this);
        this.hotelSearch = this.hotelSearch.bind(this);
    }

    async flightSearch(req: Request, res: Response): Promise<any> {
        const { value } = await this.validateRequest(
            flightSearchSchema,
            req.query,
        );
        return this.sendResponse({ response: value }, 200, res);
    }

    async hotelSearch(req: Request, res: Response): Promise<any> {
        const { value } = await this.validateRequest(
            hotelSearchSchema,
            req.query,
        );
        return this.sendResponse({ response: value }, 200, res);
    }
}

export const newSearchV1Controller = async (): Promise<SearchController> => {
    return new SearchController();
};
