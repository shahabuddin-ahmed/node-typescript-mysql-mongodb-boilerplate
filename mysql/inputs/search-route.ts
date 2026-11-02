import { Router } from "express";
import { asyncHandler } from "../../middleware/async-hander";
import { SearchControllerInterface } from "../../controller/v1/search";

export const newSearchRouter = async (
    searchController: SearchControllerInterface
): Promise<Router> => {
    const router = Router();

    router.get("/flight", asyncHandler(searchController.flightSearch));
    router.get("/hotel", asyncHandler(searchController.hotelSearch));

    return router;
};

export default newSearchRouter;
