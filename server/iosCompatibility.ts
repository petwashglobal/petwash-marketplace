// iOS Compatibility Handler for Pet Wash Platform
import { Request, Response, NextFunction } from 'express';
import { logger } from './lib/logger';

interface IOSRequest extends Request {
  headers: {
    'user-agent'?: string;
    'x-forwarded-proto'?: string;
    [key: string]: string | undefined;
  };
}

export function iosCompatibilityMiddleware(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.headers['user-agent'] || '';
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isSafari = /Safari/i.test(userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(userAgent);
  const origin = req.headers.origin;
  const host = req.get('host') || '';
  
  if (isIOS) {
    logger.info(`iOS DEVICE DETECTED: ${userAgent}`);
    
    // iOS CORS Fix - Critical for preventing 404s
    const allowedOrigins = [
      'https://f46fb046-7dd0-4090-af9e-1be17d9de48e-00-15el1m8qkuf16.picard.replit.dev',
      'https://petwash.co.il',
      'https://www.petwash.co.il',
      'http://petwash.co.il',
      'http://www.petwash.co.il'
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (host.includes('petwash.co.il') || host.includes('picard.replit.dev')) {
      res.setHeader('Access-Control-Allow-Origin', `https://${host}`);
    }
    
    // Essential iOS Safari CORS headers to prevent 404s
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Accept, Accept-Language, Content-Type, Authorization, X-Requested-With, Origin, Cache-Control, Pragma, X-iOS-Request');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin'); // Critical for Safari caching
    
    // iOS-specific security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // iOS Safari cache control to prevent 404 caching
    if (isSafari) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-WebKit-CSP', "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https:;");
    }
    
    // iOS PWA headers
    res.setHeader('X-UA-Compatible', 'IE=edge');
    res.setHeader('X-iOS-PWA-Capable', 'yes');
    res.setHeader('X-iOS-Status-Bar', 'default');
    res.setHeader('X-iOS-App-Title', 'PetWash');
    
    logger.info(`iOS HEADERS APPLIED for ${req.url}`);
  }
  
  next();
}

export function iosSSLBypass(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.headers['user-agent'] || '';
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const host = req.get('host') || '';
  
  // Check if this is an iOS device accessing custom domains with SSL issues
  if (isIOS && (host.includes('petwash.co.il'))) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    
    logger.info(`iOS SSL CHECK: ${proto}://${host}${req.url}`);
    
    // For iOS devices, provide SSL certificate information
    res.setHeader('X-iOS-SSL-Info', 'Custom domain SSL provisioning in progress');
    res.setHeader('X-SSL-Status', 'Replit platform managing certificates');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    // iOS-specific SSL bypass headers
    if (proto === 'http') {
      logger.info(`iOS HTTP ACCESS: Allowing HTTP access for ${host}`);
      res.setHeader('X-iOS-HTTP-Allowed', 'true');
    }
  }
  
  next();
}

export function iosErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const userAgent = req.headers['user-agent'] || '';
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  
  if (isIOS && err.code === 'CERT_UNTRUSTED') {
    logger.info(`iOS SSL CERTIFICATE ERROR: ${err.message}`);
    
    // Provide iOS-friendly error response
    res.status(200).json({
      status: 'ssl_provisioning',
      message: 'SSL certificates are being provisioned by Replit platform',
      ios_instructions: 'SSL certificates will be automatically available within 24 hours',
      alternative_access: `http://${req.get('host')}${req.url}`,
      support: 'Contact Pet Wash support if issues persist'
    });
    return;
  }
  
  if (isIOS) {
    logger.info(`iOS ERROR: ${err.message || err}`);
  }
  
  next(err);
}

// iOS device detection utility
export function detectIOSDevice(userAgent: string) {
  const ios = /iPhone|iPad|iPod/i.test(userAgent);
  const safari = /Safari/i.test(userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(userAgent);
  const chrome = /CriOS/i.test(userAgent);
  const firefox = /FxiOS/i.test(userAgent);
  const edge = /EdgiOS/i.test(userAgent);
  
  let device = 'unknown';
  if (/iPhone/i.test(userAgent)) device = 'iPhone';
  else if (/iPad/i.test(userAgent)) device = 'iPad';
  else if (/iPod/i.test(userAgent)) device = 'iPod';
  
  return {
    isIOS: ios,
    device,
    browser: safari ? 'Safari' : chrome ? 'Chrome' : firefox ? 'Firefox' : edge ? 'Edge' : 'unknown',
    isSafari: safari,
    isChrome: chrome,
    isFirefox: firefox,
    isEdge: edge
  };
}