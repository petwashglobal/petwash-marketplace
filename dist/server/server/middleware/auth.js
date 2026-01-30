/**
 * PET WASH™ - Global Authentication Middleware
 * JWT Bearer Token Verification for Mobile App + Control Panel
 */
import jwt from "jsonwebtoken";
if (!process.env.JWT_SECRET) {
    throw new Error("FATAL: JWT_SECRET environment variable is not set. Cannot start server without secure JWT signing key.");
}
const JWT_SECRET = process.env.JWT_SECRET;
export async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "UNAUTHORIZED",
                message: "Missing authorization header"
            });
        }
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        req.authUserId = decoded.sub;
        req.authRoles = decoded.roles || [];
        next();
    }
    catch (err) {
        return res.status(401).json({
            error: "INVALID_TOKEN",
            message: "Invalid or expired token"
        });
    }
}
export function generateTestToken(userId, roles = ["contractor"]) {
    const TEST_SECRET = process.env.NODE_ENV === "production"
        ? JWT_SECRET
        : (process.env.JWT_SECRET_TEST || JWT_SECRET);
    return jwt.sign({ sub: userId, roles }, TEST_SECRET, { expiresIn: "24h" });
}
export function requireRoles(...allowedRoles) {
    return (req, res, next) => {
        const userRoles = req.authRoles || [];
        const hasPermission = allowedRoles.some(role => userRoles.includes(role));
        if (!hasPermission) {
            return res.status(403).json({
                error: "FORBIDDEN",
                message: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
            });
        }
        next();
    };
}
