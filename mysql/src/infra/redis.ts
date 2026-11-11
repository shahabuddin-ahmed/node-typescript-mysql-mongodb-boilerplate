import { createClient } from "redis";
import config from "../config/config";

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | undefined;
let connection: Promise<RedisClient> | undefined;
let closing: Promise<void> | undefined;

export const newRedisClient = (): Promise<RedisClient> => {
    if (closing) {
        return closing.then(() => newRedisClient());
    }
    if (connection) {
        return connection;
    }
    if (client?.isOpen) {
        return Promise.resolve(client);
    }

    const newClient = createClient({
        // Fail closed during reconnection instead of accumulating an offline request queue.
        disableOfflineQueue: true,
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

    const attempt = newClient.connect().then(() => {
        console.log("Redis connected successfully");
        return newClient;
    }).catch(async (err: unknown) => {
        try {
            if (newClient.isOpen) await newClient.disconnect();
        } finally {
            if (client === newClient) client = undefined;
        }
        throw err;
    }).finally(() => {
        // Only cache an in-flight attempt. A later terminal disconnect needs a new client.
        if (connection === attempt) connection = undefined;
    });
    connection = attempt;
    return attempt;
};

export const closeRedisClient = (): Promise<void> => {
    if (closing) return closing;
    const pending = connection;
    const currentClient = client;
    client = undefined;
    connection = undefined;
    closing = (async () => {
        await pending?.catch(() => undefined);
        if (currentClient?.isOpen) {
            if (currentClient.isReady) {
                await currentClient.quit();
            } else {
                await currentClient.disconnect();
            }
        }
    })().finally(() => { closing = undefined; });
    return closing;
};
