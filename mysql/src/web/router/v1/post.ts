import { Router } from "express";
import { asyncHandler } from "../../middleware/async-hander";
import { PostControllerInterface } from "../../controller/v1/post";

export const newPostRouter = async (
    postController: PostControllerInterface
): Promise<Router> => {
    const router = Router();

    router.post("/", asyncHandler(postController.create));
    router.get("/", asyncHandler(postController.list));
    router.get("/:id", asyncHandler(postController.getById));
    router.put("/:id", asyncHandler(postController.update));
    router.delete("/:id", asyncHandler(postController.remove));

    return router;
};

export default newPostRouter;
