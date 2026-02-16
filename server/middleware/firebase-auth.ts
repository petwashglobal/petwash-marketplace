import { Request, Response, NextFunction } from 'express';
import { auth as firebaseAdmin } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

declare global {
  namespace Express {
    interface Request {
      firebaseUser?: {
        uid: string;
        email?: string;
        email_verified?: boolean;
      };
      user?: {
        uid?: string;
        id?: string;
        email?: string;
        role?: string;
      };
    }
  }
}

async function extractFirebaseUser(req: Request): Promise<{ uid: string; email?: string; email_verified?: boolean } | null> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await firebaseAdmin.verifyIdToken(token, true);
    return { uid: decoded.uid, email: decoded.email, email_verified: decoded.email_verified };
  }

  const sessionCookie = req.cookies?.pw_session;
  if (sessionCookie) {
    const decoded = await firebaseAdmin.verifySessionCookie(sessionCookie, true);
    return { uid: decoded.uid, email: decoded.email, email_verified: decoded.email_verified };
  }

  return null;
}

function bridgeFirebaseUser(req: Request) {
  if (req.firebaseUser && !req.user) {
    req.user = {
      uid: req.firebaseUser.uid,
      id: req.firebaseUser.uid,
      email: req.firebaseUser.email,
    };
  }
}

export async function validateFirebaseToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await extractFirebaseUser(req);
    if (!user) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    req.firebaseUser = user;
    bridgeFirebaseUser(req);
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
    const user = await extractFirebaseUser(req);
    if (user) {
      req.firebaseUser = user;
      bridgeFirebaseUser(req);
    }
    next();
  } catch (error: any) {
    logger.debug('Optional Firebase token validation failed', { error: error?.message });
    next();
  }
}
