import type { Request, Response, NextFunction } from "express";
import { logger } from "./requestIdAndLogs";

let failures = 0;
let openUntil = 0;

export function circuit(threshold = 20, resetTimeMs = 15_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if circuit is open
    if (Date.now() < openUntil) {
      logger.warn({ failures, openUntil }, "circuit breaker: rejecting request");
      return res.status(503).json({
        error: "Service temporarily unavailable. Please try again in a moment.",
        retryAfter: Math.ceil((openUntil - Date.now()) / 1000),
      });
    }

    // Monitor response
    res.on("finish", () => {
      const fail = res.statusCode >= 500;
      
      if (fail) {
        failures++;
        logger.warn({ failures, statusCode: res.statusCode }, "circuit breaker: failure recorded");
        
        // Open circuit if threshold reached
        if (failures >= threshold) {
          openUntil = Date.now() + resetTimeMs;
          logger.error({ failures, openUntil, threshold }, "circuit breaker: OPEN");
          failures = 0; // Reset counter
        }
      } else {
        // Gradually recover on success
        failures = Math.max(0, failures - 1);
      }
    });

    next();
  };
}
