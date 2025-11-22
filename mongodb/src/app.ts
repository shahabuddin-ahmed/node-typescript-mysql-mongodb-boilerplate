import express from "express";
import bodyParser from "body-parser";
import morgan from "morgan";
import cors from "cors";
import config from "./config/config";
import { newV1Router } from "./web/router/v1/index";
import { newPostRepo } from "./repo/post";
import { newPostService } from "./service/post";
import { newPostV1Controller } from "./web/controller/v1/post";
import { initializeDBConnection } from "./infra/mongo";
import { globalErrorHandler } from "./web/middleware/global-error-handler";

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

(async () => {
    // initializing db connection
    const db = await initializeDBConnection(
        config.MONGO.MONGO_HOST,
        config.MONGO.MONGO_DB
    );

    // Initialize Repo
    const postRepo = await newPostRepo(db, "posts");

    // Initialize Service
    const postService = await newPostService(postRepo);

    // Initialize Controller
    const postV1Controller = await newPostV1Controller(postService);

    // Initialize Router
    const v1Router = await newV1Router({
        postController: postV1Controller,
    });

    app.use(morgan("short"));
    app.use("/api/v1", v1Router);
    app.use(globalErrorHandler);
})();

export default app;
