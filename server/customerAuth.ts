import { Express, RequestHandler } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { customers, type Customer, type InsertCustomer } from "@shared/schema";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { logger } from './lib/logger';

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

  // Customer registration endpoint
  app.post("/api/customer/register", async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        password,
        dateOfBirth,
        country,
        gender,
        petType,
        loyaltyProgram,
        reminders,
        marketing,
        termsAccepted
      } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !email || !phone || !password || !termsAccepted) {
        return res.status(400).json({
          message: "Missing required fields"
        });
      }

      // Check if customer already exists
      const existingCustomer = await storage.getCustomerByEmail(email);
      if (existingCustomer) {
        return res.status(400).json({
          message: "Customer with this email already exists"
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create customer
      const customerData: InsertCustomer = {
        firstName,
        lastName,
        email,
        phone,
        password: hashedPassword,
        dateOfBirth: dateOfBirth || null, // Store as YYYY-MM-DD string (no timezone conversion)
        country: country || 'Israel',
        gender,
        petType,
        loyaltyProgram: loyaltyProgram || false,
        reminders: reminders || false,
        marketing: marketing || false,
        termsAccepted: termsAccepted || false,
        isVerified: false,
        loyaltyTier: 'new',
        totalSpent: '0',
        washBalance: 0
      };

      const customer = await storage.createCustomer(customerData);
      
      // Auto-login the customer after registration
      req.login(customer, (err) => {
        if (err) {
          logger.error('Auto-login error', err);
          return res.status(201).json({
            message: "Registration successful",
            customer: {
              id: customer.id,
              firstName: customer.firstName,
              lastName: customer.lastName,
              email: customer.email,
              loyaltyTier: customer.loyaltyTier
            }
          });
        }
        
        res.status(201).json({
          message: "Registration and login successful",
          customer: {
            id: customer.id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            loyaltyTier: customer.loyaltyTier
          }
        });
      });

    } catch (error) {
      logger.error('Customer registration error', error);
      res.status(500).json({
        message: "Registration failed"
      });
    }
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