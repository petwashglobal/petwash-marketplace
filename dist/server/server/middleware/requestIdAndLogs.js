import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
export const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
});
export const requestIdAndLogs = pinoHttp({
    logger,
    genReqId: (req) => req.headers["x-request-id"] || randomUUID(),
    customProps: (req, _res) => ({ user: req.user?.uid ?? null }),
});
