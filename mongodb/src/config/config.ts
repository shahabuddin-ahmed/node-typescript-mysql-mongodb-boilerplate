interface MongConfig {
    MONGO_HOST: string;
    MONGO_DB: string;
}

interface SocketConfig {
    SOCKET_CORS: string[];
}

interface Config {
    MONGO: MongConfig;
    SOCKET: SocketConfig;
    APPLICATION_SERVER_PORT: number;
    APP_FORCE_SHUTDOWN_SECOND: number;
}

const config: Config = {
    MONGO: {
        MONGO_HOST: process.env.MONGO_HOST || "mongodb://127.0.0.1:27017",
        MONGO_DB: process.env.MONGO_DB || "sample-app",
    },
    SOCKET: {
        SOCKET_CORS: process.env.SOCKET_CORS
            ? process.env.SOCKET_CORS.split(",")
            : ["http://localhost:3001"],
    },
    APPLICATION_SERVER_PORT:
        Number(process.env.APPLICATION_SERVER_PORT) || 3000,
    APP_FORCE_SHUTDOWN_SECOND:
        Number(process.env.APP_FORCE_SHUTDOWN_SECOND) || 30,
};

export default config;
