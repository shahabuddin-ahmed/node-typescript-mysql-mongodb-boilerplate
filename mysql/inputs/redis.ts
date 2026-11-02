import { createClient } from "redis";
import config from "../config/config";

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | undefined;
let connection: Promise<RedisClient> | undefined;

export const newRedisClient = (): Promise<RedisClient> => {
    if (connection) {
        return connection;
    }

    const newClient = createClient({
        socket: {
            host: config.REDIS_HOST,
            port: config.REDIS_PORT,
            connectTimeout: 5000,
            reconnectStrategy: (retries) => retries >= 3
                ? new Error("Redis connection retries exhausted")
                : Math.min(100 * (retries + 1), 1000),
        },
    });
    client = newClient;
    newClient.on("error", (err: Error) => console.error("Redis client error:", err.message));

    connection = newClient.connect().then(() => {
        console.log("Redis connected successfully");
        return newClient;
    }).catch(async (err: unknown) => {
        if (newClient.isOpen) {
            await newClient.disconnect();
        }
        client = undefined;
        connection = undefined;
        throw err;
    });

    return connection;
};

export const closeRedisClient = async (): Promise<void> => {
    if (connection) {
        await connection.catch(() => undefined);
    }

    const currentClient = client;
    client = undefined;
    connection = undefined;

    if (currentClient?.isOpen) {
        if (currentClient.isReady) {
            await currentClient.quit();
        } else {
            await currentClient.disconnect();
        }
    }
};
