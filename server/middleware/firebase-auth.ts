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
        claims?: Record<string, any>;
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

// Dev-only test auth bypass. Disabled entirely in production.
// Activated by sending headers: X-Dev-Test-Uid + X-Dev-Test-Secret matching DEV_TEST_SECRET env var.
function extractDevTestUser(req: Request): { uid: string; email?: string; email_verified?: boolean; claims?: Record<string, any> } | null {
  if (process.env.NODE_ENV === 'production') return null;
  const testUid = req.headers['x-dev-test-uid'] as string | undefined;
  const testSecret = req.headers['x-dev-test-secret'] as string | undefined;
  const expectedSecret = process.env.DEV_TEST_SECRET;
  if (!testUid || !testSecret || !expectedSecret) return null;
  if (testSecret !== expectedSecret) return null;
  const role = (req.headers['x-dev-test-role'] as string) || 'customer';
  return { uid: testUid, email: `${testUid}@test.local`, email_verified: true, claims: { role } };
}

async function extractFirebaseUser(req: Request): Promise<{ uid: string; email?: string; email_verified?: boolean; claims?: Record<string, any> } | null> {
  // Dev test bypass — only valid outside production
  const devUser = extractDevTestUser(req);
  if (devUser) return devUser;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await firebaseAdmin.verifyIdToken(token, true);
    const { uid, email, email_verified, role, ...rest } = decoded as any;
    return { uid, email, email_verified, claims: { role, ...rest } };
  }

  const sessionCookie = req.cookies?.pw_session;
  if (sessionCookie) {
    const decoded = await firebaseAdmin.verifySessionCookie(sessionCookie, true);
    const { uid, email, email_verified, role, ...rest } = decoded as any;
    return { uid, email, email_verified, claims: { role, ...rest } };
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
