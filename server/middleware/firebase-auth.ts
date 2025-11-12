import { Request, Response, NextFunction } from 'express';
import { auth as firebaseAdmin } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

// Extend Express Request to include firebaseUser
declare global {
  namespace Express {
    interface Request {
      firebaseUser?: {
        uid: string;
        email?: string;
        email_verified?: boolean;
      };
    }
  }
}

export async function validateFirebaseToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    // Verify Firebase ID token with revocation check (security requirement)
    const decodedToken = await firebaseAdmin.verifyIdToken(token, true);
    
    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
    };
    
    next();
  } catch (error) {
    logger.error('Firebase token validation failed', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function optionalFirebaseToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await firebaseAdmin.verifyIdToken(token, true);
      
      req.firebaseUser = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified,
      };
    }
    
    next();
  } catch (error: any) {
    // Continue without auth if token is invalid
    logger.debug('Optional Firebase token validation failed', { error: error?.message });
    next();
  }
}
