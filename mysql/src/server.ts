import app, { appReady } from "./app";
import http from "http";
import config from "./config/config";
import newSequelize from "./infra/sequelize";
import { closeRedisClient } from "./infra/redis";

const logger = console;

const closeConnections = async (): Promise<boolean> => {
    // Attempt both closes even when one fails.
    const results = await Promise.allSettled([
        newSequelize().close(),
        closeRedisClient(),
    ]);
    let success = true;
    for (const result of results) {
        if (result.status === "rejected") {
            logger.error("Failed to close a connection:", result.reason);
            success = false;
        }
    }
    return success;
};

const gracefulShutdown = (server: http.Server, forcedTimeout: number) => {
    let shuttingDown = false;
    return function () {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info("Received SIGINT or SIGTERM. Shutting down gracefully...");
        const timer = setTimeout(() => {
            logger.error("Could not close connections in time, forcefully shutting down");
            process.exit(1);
        }, forcedTimeout * 1000);

        server.close(async () => {
            logger.info("Closed out remaining connections.");
            const success = await closeConnections();
            clearTimeout(timer);
            logger.info("Database and Redis connections closed.");
            process.exit(success ? 0 : 1);
        });
    };
};

const server = http.createServer(app);

const shutdown = gracefulShutdown(server, config.APP_FORCE_SHUTDOWN_SECOND);
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);


appReady.then(() => {
    server.listen(config.APPLICATION_SERVER_PORT, () => {
        logger.log("API is running on port: " + config.APPLICATION_SERVER_PORT);
    });
}).catch(async (err: unknown) => {
    logger.error("Application startup failed:", err);
    await closeConnections();
    process.exit(1);
});
