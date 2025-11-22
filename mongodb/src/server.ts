import app from "./app";
import http from "http";
import config from "./config/config";
import { initializeSocket } from "./infra/socket";

const logger = console;

const gracefulShutdown = (server: http.Server, forcedTimeout: number) => {
    return function () {
        logger.info("Received SIGINT or SIGTERM. Shutting down gracefully...");
        server.close(async () => {
            logger.info("Closed out remaining connections.");
        });
        
        setTimeout(() => {
            logger.error("Could not close connections in time, forcefully shutting down");
            process.exit();
        }, forcedTimeout);
    };
};

const server = http.createServer(app);
initializeSocket(server);

process.on("SIGTERM", gracefulShutdown(server, config.APP_FORCE_SHUTDOWN_SECOND));
process.on("SIGINT", gracefulShutdown(server, config.APP_FORCE_SHUTDOWN_SECOND));


server.listen(config.APPLICATION_SERVER_PORT, () => {
    logger.log("API is running on port: " + config.APPLICATION_SERVER_PORT);
});
