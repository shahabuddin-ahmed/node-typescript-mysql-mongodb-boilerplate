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
    const reqHeaders = req.headers;
    let clientIp: string = "";
    let serverIps: string[] = [];

    if (reqHeaders["x-original-forwarded-for"]) {
        serverIps = (reqHeaders["x-original-forwarded-for"] as string).split(",").map(ip => ip.trim());
        clientIp = serverIps[0];
    } else if (reqHeaders["x-forwarded-for"]) {
        serverIps = (reqHeaders["x-forwarded-for"] as string).split(",").map(ip => ip.trim());
        clientIp = serverIps[0];
    }

    return { clientIp, serverIps };
}
