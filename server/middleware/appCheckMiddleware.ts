import { Request, Response, NextFunction } from 'express';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';

export interface AppCheckRequest extends Request {
  appCheckToken?: admin.appCheck.VerifyAppCheckTokenResponse;
}

export const verifyAppCheckToken = async (
  req: AppCheckRequest,
  res: Response,
  next: NextFunction
) => {
  const appCheckToken = req.header('X-Firebase-AppCheck');

  if (!appCheckToken) {
    logger.warn('App Check ENFORCED: Missing token', { path: req.path });
    return res.status(401).json({ 
      error: 'Missing App Check token',
      code: 'APP_CHECK_TOKEN_REQUIRED'
    });
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(appCheckToken);
    
    req.appCheckToken = appCheckClaims;
    logger.info('App Check ENFORCED: Token verified', { path: req.path, appId: appCheckClaims.app_id });
    next();
  } catch (error) {
    logger.error('App Check ENFORCED: Verification failed', { path: req.path, error });
    return res.status(401).json({ 
      error: 'Invalid App Check token',
      code: 'APP_CHECK_TOKEN_INVALID'
    });
  }
};

export const verifyAppCheckTokenOptional = async (
  req: AppCheckRequest,
  res: Response,
  next: NextFunction
) => {
  const appCheckToken = req.header('X-Firebase-AppCheck');

  if (!appCheckToken) {
    logger.info('App Check MONITOR: No token present', { path: req.path });
    return next();
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(appCheckToken);
    req.appCheckToken = appCheckClaims;
    logger.info('App Check MONITOR: Token verified', { path: req.path, appId: appCheckClaims.app_id });
  } catch (error) {
    logger.warn('App Check MONITOR: Verification failed (continuing)', { path: req.path, error });
  }

  next();
};
