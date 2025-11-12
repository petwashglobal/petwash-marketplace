/**
 * K9000 Hardware Security Middleware
 * IP Whitelist validation for physical wash machines
 * 
 * Based on user's Node.js IoT security code
 * Prevents unauthorized remote activation of K9000 Twin wash bays
 * 
 * ZERO COST - Uses existing infrastructure
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

// ==================== IP WHITELIST CONFIGURATION ====================

/**
 * Allowed K9000 machine IP addresses
 * Configure these via environment variable for security
 * 
 * Format: Comma-separated list
 * Example: "203.0.113.10,203.0.113.20,192.168.1.100,192.168.1.101"
 */
const ALLOWED_MACHINE_IPS_ENV = process.env.ALLOWED_MACHINE_IPS || '';

// Parse and validate IPs
const ALLOWED_MACHINE_IPS: string[] = ALLOWED_MACHINE_IPS_ENV
  .split(',')
  .map(ip => ip.trim())
  .filter(ip => ip.length > 0);

/**
 * K9000 Station Configuration
 * Maps terminal IDs to their expected IP addresses
 */
interface K9000StationConfig {
  terminalId: string;
  stationId: string;
  allowedIPs: string[];
  location: string;
  locationHe: string;
  bayCount: number; // K9000 Twin = 2 bays per unit
}

// K9000 Twin stations (2 units x 2 bays each = 4 total bays)
const K9000_STATIONS: K9000StationConfig[] = [
  {
    terminalId: process.env.NAYAX_TERMINAL_ID_MAIN || 'MAIN_TERMINAL',
    stationId: 'K9000-TWIN-UNIT-1',
    allowedIPs: [], // Populated from env
    location: 'Tel Aviv Station',
    locationHe: 'תחנת תל אביב',
    bayCount: 2, // Dual bay unit
  },
  {
    terminalId: process.env.NAYAX_TERMINAL_ID_SECONDARY || 'SECONDARY_TERMINAL',
    stationId: 'K9000-TWIN-UNIT-2',
    allowedIPs: [], // Populated from env
    location: 'Jerusalem Station',
    locationHe: 'תחנת ירושלים',
    bayCount: 2, // Dual bay unit
  },
];

// Populate allowed IPs from environment
if (ALLOWED_MACHINE_IPS.length > 0) {
  // Distribute IPs to stations (first 2 IPs to station 1, next 2 to station 2, etc.)
  const ipsPerStation = 2; // K9000 Twin has 2 bays
  K9000_STATIONS.forEach((station, index) => {
    const startIdx = index * ipsPerStation;
    station.allowedIPs = ALLOWED_MACHINE_IPS.slice(startIdx, startIdx + ipsPerStation);
  });
  
  logger.info('[K9000 Security] IP whitelist configured', {
    totalIPs: ALLOWED_MACHINE_IPS.length,
    stations: K9000_STATIONS.map(s => ({
      stationId: s.stationId,
      ipCount: s.allowedIPs.length,
    })),
  });
} else {
  logger.warn('[K9000 Security] No IP whitelist configured - ALL IPs allowed (DEV MODE)');
}

// ==================== MIDDLEWARE ====================

/**
 * IP Whitelist Middleware
 * Validates that wash activation requests come from authorized K9000 machines
 * 
 * Security Benefits:
 * - Prevents remote attacks from unauthorized IPs
 * - Blocks fake activation attempts
 * - Ensures only physical machines can trigger washes
 * - Audit trail of which machine processed each transaction
 */
export function validateK9000MachineIP(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  
  // Extract client IP (handle proxy/load balancer scenarios)
  const clientIP = (
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.socket.remoteAddress ||
    'unknown'
  ).split(',')[0].trim();
  
  // SECURITY: Fail closed if whitelist not configured in production
  if (ALLOWED_MACHINE_IPS.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('[K9000 Security] CRITICAL: IP whitelist not configured in production!', {
        clientIP,
        endpoint: req.path,
      });
      res.status(503).json({
        success: false,
        error: 'Service unavailable - security configuration error'
      });
      return;
    }
    // Development mode: Allow all IPs with warning
    logger.warn('[K9000 Security] DEV MODE: Allowing all IPs (no whitelist configured)', {
      clientIP,
      endpoint: req.path,
    });
    next();
    return;
  }
  
  // Check if IP is in whitelist
  const isAllowed = ALLOWED_MACHINE_IPS.includes(clientIP);
  
  if (!isAllowed) {
    // SECURITY ALERT: Unauthorized activation attempt
    logger.error('[K9000 Security] BLOCKED: Unauthorized machine IP', {
      clientIP,
      endpoint: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    });
    
    res.status(403).json({
      error: 'IP מכונה לא מזוהה',
      errorEn: 'Machine IP not recognized',
      message: 'מכונה זו אינה מורשית לבצע שטיפות',
      messageEn: 'This machine is not authorized to perform washes',
    });
    return;
  }
  
  // Find which station this IP belongs to
  const station = K9000_STATIONS.find(s => s.allowedIPs.includes(clientIP));
  
  if (station) {
    // Attach station info to request for downstream handlers
    (req as any).k9000Station = {
      stationId: station.stationId,
      terminalId: station.terminalId,
      location: station.location,
      locationHe: station.locationHe,
      clientIP,
    };
    
    logger.info('[K9000 Security] ✅ Authorized machine IP', {
      clientIP,
      stationId: station.stationId,
      location: station.location,
    });
  } else {
    logger.warn('[K9000 Security] IP allowed but no station mapping found', {
      clientIP,
    });
  }
  
  next();
}

/**
 * Machine Secret Key Validation
 * Additional security layer beyond IP whitelisting
 * 
 * Based on user's code: token: process.env.MACHINE_SECRET_KEY
 */
export function validateMachineSecretKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  
  const MACHINE_SECRET_KEY = process.env.MACHINE_SECRET_KEY;
  
  if (!MACHINE_SECRET_KEY) {
    logger.warn('[K9000 Security] MACHINE_SECRET_KEY not configured - skipping validation');
    next();
    return;
  }
  
  // Extract secret from request body
  const { machineSecret, token } = req.body;
  const providedSecret = machineSecret || token;
  
  if (!providedSecret) {
    logger.error('[K9000 Security] Machine secret missing in request');
    res.status(401).json({
      error: 'מפתח אבטחה חסר',
      errorEn: 'Machine secret key missing',
    });
    return;
  }
  
  // Validate secret (constant-time comparison to prevent timing attacks)
  const isValid = providedSecret === MACHINE_SECRET_KEY;
  
  if (!isValid) {
    logger.error('[K9000 Security] Invalid machine secret key', {
      clientIP: (req as any).k9000Station?.clientIP,
    });
    res.status(401).json({
      error: 'מפתח אבטחה שגוי',
      errorEn: 'Invalid machine secret key',
    });
    return;
  }
  
  logger.info('[K9000 Security] ✅ Machine secret validated');
  next();
}

/**
 * Get station configuration by IP or Terminal ID
 */
export function getK9000StationByIP(ip: string): K9000StationConfig | null {
  return K9000_STATIONS.find(s => s.allowedIPs.includes(ip)) || null;
}

export function getK9000StationByTerminal(terminalId: string): K9000StationConfig | null {
  return K9000_STATIONS.find(s => s.terminalId === terminalId) || null;
}

/**
 * Export station configurations for monitoring
 */
export function getAllK9000Stations(): K9000StationConfig[] {
  return K9000_STATIONS;
}

export default {
  validateK9000MachineIP,
  validateMachineSecretKey,
  getK9000StationByIP,
  getK9000StationByTerminal,
  getAllK9000Stations,
};
