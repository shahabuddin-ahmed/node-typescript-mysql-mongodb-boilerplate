import type http from "http";
import { Server } from "socket.io";
import config from "../config/config";

let io: Server | null = null;

export function initializeSocket(server: http.Server) {
    io = new Server(server, {
        cors: {
            origin: config.SOCKET.SOCKET_CORS,
            credentials: true,
        },
        transports: ["websocket", "polling"],
        serveClient: false,
    });

    return io;
}

export function getIO(): Server {
    if (!io) throw new Error("Socket.IO not initialized");
    return io;
}
