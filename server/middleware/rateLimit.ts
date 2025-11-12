import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  limit: 200, // per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000, // 15 minutes
  limit: 20, // 20 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many authentication attempts, please try again later.",
});
