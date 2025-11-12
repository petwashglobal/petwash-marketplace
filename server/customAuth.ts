import { Express, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db';
import { storage } from './storage';
import { insertCustomerSchema } from '@shared/schema';
import { z } from 'zod';
import { logger } from './lib/logger';

const PostgresStore = connectPgSimple(session);

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      firstName: string;
      lastName: string;
    }
  }
}

export function setupCustomAuth(app: Express) {
  // Get session secret with proper fallback handling
  function getSessionSecret(): string {
    if (process.env.SESSION_SECRET) {
      return process.env.SESSION_SECRET;
    }
    
    // Development-only fallback
    if (process.env.NODE_ENV === 'development') {
      logger.warn('[CustomAuth] Using development session secret - set SESSION_SECRET for production');
      const crypto = require('crypto');
      return 'petwash-dev-custom-auth-' + crypto.createHash('sha256').update('petwash-custom-auth').digest('hex');
    }
    
    // Production: throw error if secret is missing
    throw new Error(
      'SESSION_SECRET environment variable is required in production.\n' +
      'Please set SESSION_SECRET in Replit Secrets or your environment configuration.'
    );
  }

  // Session configuration
  const sessionConfig = {
    store: new PostgresStore({
      pool,
      createTableIfMissing: true,
    }),
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  };

  app.use(session(sessionConfig));

  // Register endpoint
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const registerSchema = insertCustomerSchema.omit({ 
        id: true, 
        createdAt: true, 
        updatedAt: true,
        lastLogin: true,
        authProvider: true,
        authProviderId: true,
        resetPasswordToken: true,
        resetPasswordExpires: true,
      }).extend({
        password: z.string().min(8, 'Password must be at least 8 characters'),
        confirmPassword: z.string(),
      }).refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
      });

      const validatedData = registerSchema.parse(req.body);
      const { confirmPassword, ...customerData } = validatedData;

      // Check if email already exists
      const existingCustomer = await storage.getCustomerByEmail(customerData.email);
      if (existingCustomer) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(customerData.password, saltRounds);

      // Create customer
      const newCustomer = await storage.createCustomer({
        ...customerData,
        password: hashedPassword,
        authProvider: 'email',
      });

      // Set session
      (req.session as any).customerId = newCustomer.id;

      // Return customer data (without password)
      const { password, ...customerResponse } = newCustomer;
      res.status(201).json(customerResponse);
    } catch (error) {
      logger.error('Registration error', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: 'Registration failed' });
    }
  });

  // Login endpoint
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Get customer by email
      const customer = await storage.getCustomerByEmail(email);
      if (!customer) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, customer.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Update last login
      await storage.updateCustomer(customer.id, { lastLogin: new Date() });

      // Set session
      (req.session as any).customerId = customer.id;

      // Return customer data (without password)
      const { password: _, ...customerResponse } = customer;
      res.json(customerResponse);
    } catch (error) {
      logger.error('Login error', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // Get current user endpoint
  app.get('/api/auth/user', async (req: Request, res: Response) => {
    try {
      const customerId = (req.session as any)?.customerId;
      
      if (!customerId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Return customer data (without password)
      const { password, ...customerResponse } = customer;
      res.json(customerResponse);
    } catch (error) {
      logger.error('Get user error', error);
      res.status(500).json({ message: 'Failed to get user' });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        logger.error('Logout error', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Update profile endpoint
  app.patch('/api/auth/profile', async (req: Request, res: Response) => {
    try {
      const customerId = (req.session as any)?.customerId;
      
      if (!customerId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const updateSchema = insertCustomerSchema.partial().omit({
        id: true,
        password: true,
        createdAt: true,
        updatedAt: true,
        authProvider: true,
        authProviderId: true,
        resetPasswordToken: true,
        resetPasswordExpires: true,
      });

      const validatedData = updateSchema.parse(req.body);
      const updatedCustomer = await storage.updateCustomer(customerId, validatedData);

      if (!updatedCustomer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      // Return customer data (without password)
      const { password, ...customerResponse } = updatedCustomer;
      res.json(customerResponse);
    } catch (error) {
      logger.error('Profile update error', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: 'Profile update failed' });
    }
  });

  logger.info('CUSTOM AUTHENTICATION SYSTEM INITIALIZED');
  logger.info('Auth endpoints: /api/auth/register, /api/auth/login, /api/auth/logout, /api/auth/user');
}

// Middleware to check authentication (Firebase-based)
export async function requireAuth(req: Request, res: Response, next: any) {
  try {
    // Firebase session cookie authentication
    const { verifySessionCookie, SESSION_COOKIE_NAME } = await import('./lib/sessionCookies');
    const sessionCookie = req.cookies?.[SESSION_COOKIE_NAME];
    
    if (!sessionCookie) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify Firebase session cookie
    let decodedClaims;
    try {
      decodedClaims = await verifySessionCookie(sessionCookie, false);
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    // Attach Firebase user info to request
    (req as any).user = {
      uid: decodedClaims.uid,
      email: decodedClaims.email,
    };
    (req as any).userId = decodedClaims.uid;
    (req as any).firebaseUser = decodedClaims;

    // PERFORMANCE: Check session cache first - avoid querying DB on every request
    if ((req.session as any).customerId) {
      // Customer ID already cached in session - skip bridge
      logger.debug(`Using cached customerId from session: ${(req.session as any).customerId}`);
    } else {
      // CRITICAL: Bridge Firebase session to PostgreSQL customer (first time only)
      try {
        const { db: firestoreDb } = await import('./lib/firebase-admin');
        const userDoc = await firestoreDb.collection('users').doc(decodedClaims.uid).get();
        const userData = userDoc.data();

        // Get email from decoded claims, Firestore, or create synthetic email
        let userEmail = decodedClaims.email || userData?.email;
        
        if (!userEmail) {
          // No email available - use synthetic email based on UID for phone-only users
          userEmail = `${decodedClaims.uid}@firebase.user`;
          logger.info(`User ${decodedClaims.uid} has no email - using synthetic: ${userEmail}`);
        }

        // Try to find existing customer by email
        let customer = await storage.getCustomerByEmail(userEmail);
        
        if (!customer) {
          // Create customer record if doesn't exist
          // Handle race condition: catch unique constraint violations
          try {
            // Hash a deterministic password based on UID for Firebase users
            // This ensures bcrypt.compare() won't crash but password is unusable for login
            const hashedPassword = await bcrypt.hash(decodedClaims.uid, 12);
            
            customer = await storage.createCustomer({
              email: userEmail,
              password: hashedPassword, // Bcrypt hash for schema compliance
              firstName: userData?.firstName || userData?.displayName?.split(' ')[0] || 'User',
              lastName: userData?.lastName || userData?.displayName?.split(' ').slice(1).join(' ') || '',
              country: userData?.country || null,
            });
            logger.info(`Created new customer record for Firebase user: ${decodedClaims.uid}`);
          } catch (createError: any) {
            // If duplicate email error, retry lookup (another request created it)
            if (createError?.code === '23505' || createError?.message?.includes('unique')) {
              customer = await storage.getCustomerByEmail(userEmail);
            } else {
              // Log validation/schema errors and use a fallback
              logger.error('Failed to create customer:', createError);
              throw createError;
            }
          }
        }

        // GUARANTEE: Always set customerId for backwards compatibility + caching
        if (customer) {
          (req.session as any).customerId = customer.id;
          logger.debug(`Cached customerId in session: ${customer.id}`);
        } else {
          // This should never happen, but if it does, fail the request
          logger.error(`CRITICAL: Could not bridge user ${decodedClaims.uid} to customer record`);
          return res.status(500).json({ message: 'Authentication bridging failed' });
        }
      } catch (bridgeError) {
        // Bridging is critical - if it fails, we must fail the request
        logger.error('CRITICAL: Failed to bridge Firebase to customer:', bridgeError);
        return res.status(500).json({ message: 'Authentication setup failed' });
      }
    }

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
}