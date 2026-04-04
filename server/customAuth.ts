import { Express, Request, Response } from 'express';
import crypto from 'crypto';
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

  app.post('/api/auth/register', (_req: Request, res: Response) => {
    logger.warn('[DEPRECATED] /api/auth/register called - endpoint removed. Use Firebase Auth + /api/users/create-profile');
    return res.status(410).json({
      message: 'This endpoint is deprecated. Use Firebase Auth for registration.',
      redirect: '/signup',
      errorCode: 'ENDPOINT_DEPRECATED'
    });
  });

  app.post('/api/auth/login', (_req: Request, res: Response) => {
    logger.warn('[DEPRECATED] /api/auth/login called - endpoint removed. Use Firebase Auth + /api/auth/session');
    return res.status(410).json({
      message: 'This endpoint is deprecated. Use Firebase Auth for sign-in.',
      redirect: '/signin',
      errorCode: 'ENDPOINT_DEPRECATED'
    });
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

  logger.info('AUTH SYSTEM INITIALIZED (Firebase Auth is source of truth)');
  logger.info('Active endpoints: /api/auth/user, /api/auth/logout, /api/auth/profile');
  logger.info('Deprecated endpoints: /api/auth/register (410), /api/auth/login (410)');
}

// Middleware to check authentication (Firebase-based)
export async function requireAuth(req: Request, res: Response, next: any) {
  try {
    // DEVELOPMENT TESTING BYPASS: Allow Playwright tests with special header.
    // P0-FIX: Must use TEST_BYPASS_TOKEN env var — never the hardcoded 'playwright-test' string.
    // This mirrors the fix already applied in firebase-auth.ts. If TEST_BYPASS_TOKEN is not set,
    // bypass is completely disabled (fail closed). Set it only in test environments.
    const bypassHeader = req.headers['x-test-user-bypass'] as string | undefined;
    const bypassToken = process.env.TEST_BYPASS_TOKEN; // NO default — must be explicitly set
    if (bypassToken && bypassHeader === bypassToken) {
      const testUserId = req.headers['x-test-user-id'] as string || 'test-user-default';
      const testEmail = req.headers['x-test-user-email'] as string || `${testUserId}@test.petwash.local`;
      
      // Attach test user info to request
      (req as any).user = {
        uid: testUserId,
        email: testEmail,
      };
      (req as any).userId = testUserId;
      (req as any).firebaseUser = {
        uid: testUserId,
        email: testEmail,
        email_verified: true
      };
      
      logger.debug(`[Auth Bypass] Test user authenticated: ${testEmail}`);
      return next();
    }
    
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