import { Express, RequestHandler } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { customers, type Customer, type InsertCustomer } from "@shared/schema";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { logger } from './lib/logger';
import { sendLuxuryEmail } from './email/luxury-email-service';
import { generateCustomerWelcomeEmail } from './email/templates/welcome-customer-signup-2026';
import { verifyCaptchaToken } from './lib/verifyCaptcha';

async function verifyRecaptchaToken(token: string, action: string, _ip?: string): Promise<{ success: boolean; score?: number }> {
  const result = await verifyCaptchaToken(token, action);
  return { success: result.valid, score: result.score };
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

declare global {
  namespace Express {
    interface User extends Customer {}
  }
}

export function setupCustomerAuth(app: Express) {
  // Setup passport local strategy for customers
  passport.use('customer-local', new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const customer = await storage.getCustomerByEmail(email);
        if (!customer || !(await comparePasswords(password, customer.password))) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        return done(null, customer);
      } catch (error) {
        return done(error);
      }
    }
  ));

  // HARD-DEPRECATED: /api/customer/register
  // setupCustomerAuth() is never called in production — this handler is unreachable.
  // Kept here only to preserve git history. Returns 410 GONE if somehow mounted.
  app.post("/api/customer/register", (_req, res) => {
    res.status(410).json({
      error: 'ENDPOINT_REMOVED',
      message: 'Legacy registration endpoint permanently removed. Use Firebase Auth → /api/auth/session → /api/users/create-profile.',
    });
  });

  // Customer login endpoint
  app.post("/api/customer/login", (req, res, next) => {
    passport.authenticate('customer-local', (err: any, customer: Customer | false, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Login error" });
      }
      if (!customer) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      req.login(customer, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Login session error" });
        }
        
        res.json({
          message: "Login successful",
          customer: {
            id: customer.id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            loyaltyTier: customer.loyaltyTier
          }
        });
      });
    })(req, res, next);
  });

  // Customer logout endpoint
  app.post("/api/customer/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout error" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  // Get current customer
  app.get("/api/customer/me", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const customer = req.user as Customer;
    res.json({
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      loyaltyTier: customer.loyaltyTier,
      totalSpent: customer.totalSpent,
      washBalance: customer.washBalance
    });
  });
}

// Middleware to check if customer is authenticated
export const isCustomerAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Customer authentication required" });
  }
  next();
};