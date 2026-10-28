import { Router } from "express";
import { PostController } from "./../../controller/v1/post";
import { newPostRouter } from "./post";
import { newSearchRouter } from "./search";
import { NotFoundException } from "../../exception/not-found-exception";
import { ERROR_CODES } from "../../../constant/error";
import { newHealthRouter } from "./health";
import { SearchController } from "../../controller/v1/search";

export const newV1Router = async ({
    postController,
    searchController,
}: {
    postController: PostController;
    searchController: SearchController;
}): Promise<Router> => {
    const v1 = Router();
    v1.use("/health", await newHealthRouter());
    v1.use("/posts", await newPostRouter(postController));
    v1.use("/search", await newSearchRouter(searchController));

    v1.use("*", (_req, res) => {
        console.log(`not_found_for_v1`, _req.method, _req.baseUrl);
        throw new NotFoundException(ERROR_CODES.E_PAGE_NOT_FOUND, "", [
            `Cannot ${_req.method} ${_req.baseUrl}`,
        ]);
    });

    return v1;
};
