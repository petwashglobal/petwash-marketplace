import { logger } from "./middleware/requestIdAndLogs";
export const graceful = (server) => {
    const shutdown = (signal) => async () => {
        logger.warn({ signal }, "graceful shutdown start");
        // Stop accepting new connections
        server.close(() => {
            logger.warn("http server closed");
            process.exit(0);
        });
        // Force shutdown after 10 seconds
        setTimeout(() => {
            logger.error("forced shutdown after timeout");
            process.exit(1);
        }, 10_000).unref();
    };
    // Handle shutdown signals
    ["SIGINT", "SIGTERM"].forEach(s => process.on(s, shutdown(s)));
    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
        logger.error({ error }, "uncaught exception");
        shutdown("uncaughtException")();
    });
    process.on("unhandledRejection", (reason) => {
        logger.error({ reason }, "unhandled rejection");
        shutdown("unhandledRejection")();
    });
};
