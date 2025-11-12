/**
 * IP Allowlist Middleware
 * 
 * Enterprise-grade IP filtering for payment webhooks and sensitive endpoints.
 * 
 * Features:
 * - CIDR notation support (e.g., "185.60.216.0/24")
 * - IPv4 and IPv6 support
 * - IPv6-mapped IPv4 normalization (::ffff:192.168.1.1 -> 192.168.1.1)
 * - X-Forwarded-For proxy support
 * - Comprehensive security logging
 * 
 * Usage:
 * ```typescript
 * import { createIPAllowlist } from './middleware/ipAllowlist';
 * 
 * // Single provider (Nayax)
 * const nayaxIPGuard = createIPAllowlist('NAYAX_ALLOWED_IPS', 'Nayax');
 * app.post('/webhooks/nayax', nayaxIPGuard, nayaxHandler);
 * 
 * // Multiple providers
 * const stripeIPGuard = createIPAllowlist('STRIPE_ALLOWED_IPS', 'Stripe');
 * app.post('/webhooks/stripe', stripeIPGuard, stripeHandler);
 * ```
 * 
 * Environment Variable Format:
 * NAYAX_ALLOWED_IPS=185.60.216.0/24,203.0.113.5,2001:db8::/32
 */

import { Request, Response, NextFunction } from 'express';
import ipaddr from 'ipaddr.js';
import { logger } from '../lib/logger';

/**
 * Parse and validate CIDR ranges from environment variable
 */
function parseAllowedCIDRs(envVar: string): string[] {
  const value = process.env[envVar] || '';
  
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Extract client IP address from request
 * 
 * Respects Express trust proxy configuration:
 * - If trust proxy enabled: Uses X-Forwarded-For (parsed by Express into req.ip)
 * - If trust proxy disabled: Uses direct socket IP only
 */
function extractClientIP(req: Request): string {
  const trustProxy = req.app.get('trust proxy');
  
  if (trustProxy && trustProxy !== false) {
    // Express trust proxy enabled - req.ip contains correct client IP
    // (Express already parsed X-Forwarded-For respecting proxy config)
    return req.ip || req.socket.remoteAddress || 'unknown';
  } else {
    // Trust proxy disabled - NEVER trust X-Forwarded-For header
    // Use direct socket connection IP only
    const directIP = req.socket.remoteAddress || 'unknown';
    
    // Log warning if someone tries to spoof with X-Forwarded-For
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      logger.warn('[IPAllowlist] Ignoring X-Forwarded-For header (trust proxy disabled)', {
        socketIP: directIP,
        spoofedHeader: xForwardedFor,
      });
    }
    
    return directIP;
  }
}

/**
 * Check if IP address matches any allowed CIDR range
 */
function isIPAllowed(rawIP: string, allowedCIDRs: string[]): boolean {
  try {
    // Handle IPv6-mapped IPv4 addresses
    // Extract IPv4 if format is "::ffff:192.168.1.1"
    let cleanIP = rawIP;
    if (rawIP.includes(':') && rawIP.includes('.')) {
      const parts = rawIP.split(':');
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.includes('.')) {
        cleanIP = lastPart;
      }
    }
    
    // Parse client IP address
    const clientAddr = ipaddr.process(cleanIP);
    
    // Check against each allowed CIDR range
    return allowedCIDRs.some((cidr) => {
      try {
        if (cidr.includes('/')) {
          // CIDR range (e.g., "185.60.216.0/24")
          const [network, prefixLength] = cidr.split('/');
          const networkAddr = ipaddr.process(network);
          const prefix = parseInt(prefixLength, 10);
          
          // Check if client IP is in CIDR range
          if (clientAddr.kind() === networkAddr.kind()) {
            return clientAddr.match(networkAddr, prefix);
          }
          return false;
        } else {
          // Single IP address
          const allowedAddr = ipaddr.process(cidr);
          return clientAddr.toString() === allowedAddr.toString();
        }
      } catch (error) {
        logger.error('[IPAllowlist] Invalid CIDR entry', {
          cidr,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    });
  } catch (error) {
    logger.error('[IPAllowlist] Failed to parse client IP', {
      rawIP,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Create IP allowlist middleware for a specific provider
 * 
 * @param envVarName - Name of environment variable containing allowed IPs/CIDRs
 * @param providerName - Name of provider for logging (e.g., 'Nayax', 'Stripe')
 * @returns Express middleware function
 * 
 * @example
 * const nayaxIPGuard = createIPAllowlist('NAYAX_ALLOWED_IPS', 'Nayax');
 * app.post('/webhooks/nayax', nayaxIPGuard, nayaxHandler);
 */
export function createIPAllowlist(
  envVarName: string,
  providerName: string = 'Payment'
) {
  const allowedCIDRs = parseAllowedCIDRs(envVarName);
  
  return function ipAllowlistMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      // Extract client IP (handles proxy scenarios)
      const rawIP = extractClientIP(req);
      
      // Development mode bypass
      if (process.env.NODE_ENV === 'development' || allowedCIDRs.length === 0) {
        logger.warn(`[IPAllowlist:${providerName}] IP allowlist not configured - allowing all IPs (DEV MODE)`, {
          ip: rawIP,
          envVar: envVarName,
        });
        return next();
      }
      
      // Check if IP is allowed
      const allowed = isIPAllowed(rawIP, allowedCIDRs);
      
      if (!allowed) {
        logger.error(`[IPAllowlist:${providerName}] Unauthorized IP blocked`, {
          ip: rawIP,
          allowedRanges: allowedCIDRs,
          path: req.path,
          method: req.method,
        });
        
        return res.status(403).json({
          error: 'Forbidden',
          message: 'IP address not allowed',
        });
      }
      
      // IP is allowed - log and continue
      logger.info(`[IPAllowlist:${providerName}] IP validated`, {
        ip: rawIP,
        path: req.path,
      });
      
      next();
    } catch (error) {
      logger.error(`[IPAllowlist:${providerName}] Validation error`, {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
      });
      
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'IP validation failed',
      });
    }
  };
}

/**
 * Legacy middleware for backward compatibility
 * Uses NAYAX_ALLOWED_IPS by default
 */
export const ipAllowlist = createIPAllowlist('NAYAX_ALLOWED_IPS', 'Nayax');
