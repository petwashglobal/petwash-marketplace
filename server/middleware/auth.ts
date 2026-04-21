/**
 * PET WASH™ - Global Authentication Middleware
 * JWT Bearer Token Verification for Mobile App + Control Panel
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// JWT_SECRET is loaded lazily — if unset the middleware returns 503 rather than
// crashing the module on import.  A module-scope throw prevents all route registration.
const JWT_SECRET = process.env.JWT_SECRET || '';

if (!JWT_SECRET) {
  console.error('[Auth Middleware] FATAL: JWT_SECRET environment variable is not set. JWT Bearer verification will return 503.');
}

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
      authRoles?: string[];
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (!JWT_SECRET) {
      return res.status(503).json({ error: 'JWT authentication is temporarily unavailable. Use Firebase authentication instead.' });
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        error: "UNAUTHORIZED", 
        message: "Missing authorization header" 
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    req.authUserId = decoded.sub;
    req.authRoles = decoded.roles || [];
    
    next();
  } catch (err) {
    return res.status(401).json({ 
      error: "INVALID_TOKEN", 
      message: "Invalid or expired token" 
    });
  }
}

export function generateTestToken(userId: string, roles: string[] = ["contractor"]): string {
  const TEST_SECRET = process.env.NODE_ENV === "production" 
    ? JWT_SECRET 
    : (process.env.JWT_SECRET_TEST || JWT_SECRET);
  
  return jwt.sign(
    { sub: userId, roles },
    TEST_SECRET,
    { expiresIn: "24h" }
  );
}

export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
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
