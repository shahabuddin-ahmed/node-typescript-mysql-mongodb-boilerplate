import express from "express";
import bodyParser from "body-parser";
import morgan from "morgan";
import { newV1Router } from "./web/router/v1/index";
import { newPostRepo } from "./repo/post";
import { newPostService } from "./service/post";
import { newPostV1Controller } from "./web/controller/v1/post";
import { globalErrorHandler } from "./web/middleware/global-error-handler";
import { initializeDBConnection } from "./infra/db";
import { newRedisClient } from "./infra/redis";
import { newSearchV1Controller } from "./web/controller/v1/search";

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

export const appReady = (async () => {
    await initializeDBConnection();
    await newRedisClient();

    // Initialize Repo
    const postRepo = await newPostRepo();

    // Initialize Service
    const postService = await newPostService(postRepo);

    // Initialize Controller
    const postV1Controller = await newPostV1Controller(postService);
    const searchV1Controller = await newSearchV1Controller();

    // Initialize Router
    const v1Router = await newV1Router({
        postController: postV1Controller,
        searchController: searchV1Controller,
    });

    app.use(morgan("short"));
    app.use("/api/v1", v1Router);
    app.use(globalErrorHandler);
})();

export default app;
