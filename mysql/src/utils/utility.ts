import type { Request } from "express";
import { ERROR_CODES, errorMessages } from "../constant/error";

export function retrieveErrorMessage(errorCode: ERROR_CODES): string {
    return errorMessages[`${errorCode}`].message;
}

export interface IpAddressInfo {
    clientIp: string;
    serverIps: string[];
}

export const getIpAddress = (req: Request): IpAddressInfo => {
    const clientIp = req.ip || req.socket.remoteAddress;
    const serverIps = req.ips;

    if (!clientIp) {
        throw new Error("Unable to determine client IP address");
    }

    return { clientIp, serverIps };
};
