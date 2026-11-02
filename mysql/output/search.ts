import { Router } from "express";
import { asyncHandler } from "../../middleware/async-hander";
import { SearchControllerInterface } from "../../controller/v1/search";
import { newRateLimit } from "../../middleware/rate-limit";

export const newSearchRouter = async (
    searchController: SearchControllerInterface
): Promise<Router> => {
    const router = Router();

    const rateLimit = newRateLimit();

    router.get("/flight", rateLimit, asyncHandler(searchController.flightSearch));
    router.get("/hotel", rateLimit, asyncHandler(searchController.hotelSearch));

    return router;
};

export default newSearchRouter;
