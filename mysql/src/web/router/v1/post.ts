import { Router } from "express";
import { asyncHandler } from "../../middleware/async-hander";
import { PostControllerInterface } from "../../controller/v1/post";
import { verifyAdmin } from "../../middleware/verify-admin";
import { newRateLimit } from "../../middleware/rate-limit";

export const newPostRouter = async (
    postController: PostControllerInterface
): Promise<Router> => {
    const router = Router();

    const rateLimit = newRateLimit();

    router.post("/", verifyAdmin, rateLimit, asyncHandler(postController.create));
    router.get("/", rateLimit, asyncHandler(postController.list));
    router.get("/:id", rateLimit, asyncHandler(postController.getById));
    router.put("/:id", verifyAdmin, rateLimit, asyncHandler(postController.update));
    router.delete("/:id", verifyAdmin, rateLimit, asyncHandler(postController.remove));

    return router;
};

export default newPostRouter;
