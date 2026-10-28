import { Request, Response } from "express";
import { Controller } from "../controller";

export interface SearchControllerInterface {
    flightSearch(req: Request, res: Response): any;
    hotelSearch(req: Request, res: Response): any;
}

export class SearchController extends Controller implements SearchControllerInterface {
    constructor() {
        super();
        this.flightSearch = this.flightSearch.bind(this);
        this.hotelSearch = this.hotelSearch.bind(this);
    }

    async flightSearch(req: Request, res: Response): Promise<any> {
        const data = {
            searchId: "345325325235",
            origin: "DAC",
            destination: "JFK"
        };
        return this.sendResponse({ response: data }, 201, res);
    }

    async hotelSearch(req: Request, res: Response): Promise<any> {
        const data = {
            searchId: "345325325235",
            checkIn: "2026-12-25",
            checkOut: "2026-12-28"
        };
        return this.sendResponse({ response: data }, 201, res);
    }
}

export const newSearchV1Controller = async (): Promise<SearchController> => {
    return new SearchController();
};
