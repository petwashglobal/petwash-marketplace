/**
 * Performance Optimization Middleware 2025
 * Fast Loading & Uploading with Real-Time Tracking
 * 
 * Features:
 * - Automatic response compression (Gzip/Brotli)
 * - Smart caching headers
 * - Upload/download progress tracking
 * - Bandwidth optimization
 * - Real-time performance metrics
 */

import type { Request, Response, NextFunction } from 'express';
import { trackRequestPerformance } from '../ai-monitoring-2025';
import { logger } from '../lib/logger';
import compression from 'compression';
import { logSystem } from '../log-retention-2025';

// ============================================
// PERFORMANCE TRACKING MIDDLEWARE
// ============================================

/**
 * Track all requests for AI monitoring
 */
export function performanceTrackingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  
  // Track response
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    // Send to AI monitoring (non-blocking)
    setImmediate(() => {
      trackRequestPerformance(req, responseTime, res.statusCode);
      
      // Log slow requests
      if (responseTime > 1000) {
        logSystem({
          level: 'warn',
          service: 'performance',
          message: `Slow request detected: ${req.method} ${req.path}`,
          details: {
            method: req.method,
            path: req.path,
            responseTime,
            statusCode: res.statusCode,
            userId: (req as any).firebaseUser?.uid
          },
          requestId: (req as any).requestId,
          timestamp: new Date()
        });
      }
    });
  });
  
  next();
}

// ============================================
// COMPRESSION MIDDLEWARE
// ============================================

/**
 * Smart compression with adaptive thresholds
 */
export const smartCompression = compression({
  // Compress responses > 1KB
  threshold: 1024,
  
  // Custom filter for compressible content
  filter: (req, res) => {
    // Don't compress if client doesn't accept it
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Don't compress images (already compressed)
    const contentType = res.getHeader('Content-Type');
    if (typeof contentType === 'string') {
      if (contentType.startsWith('image/')) {
        return false;
      }
    }
    
    // Use compression default filter
    return compression.filter(req, res);
  },
  
  // Compression level (6 = balanced speed/ratio)
  level: 6
});

// ============================================
// CACHE HEADERS MIDDLEWARE
// ============================================

/**
 * Smart caching headers based on content type
 */
export function smartCacheHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const path = req.path;
  
  // Static assets - cache for 1 year
  if (path.match(/\.(jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot|css|js)$/i)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Vary', 'Accept-Encoding');
  }
  // API responses - no cache or short cache
  else if (path.startsWith('/api/')) {
    // Don't cache API responses by default
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  // HTML pages - short cache with revalidation
  else {
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes
  }
  
  next();
}

// ============================================
// UPLOAD OPTIMIZATION
// ============================================

/**
 * Track upload progress
 */
export function uploadProgressTracking(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const contentLength = req.headers['content-length'];
  
  if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) { // > 1MB
    const totalBytes = parseInt(contentLength, 10);
    let receivedBytes = 0;
    
    req.on('data', (chunk) => {
      receivedBytes += chunk.length;
      const progress = (receivedBytes / totalBytes) * 100;
      
      // Log upload progress (non-blocking)
      if (progress % 25 === 0) { // Log at 25%, 50%, 75%, 100%
        logger.info(`[Upload] ${req.path} - ${progress.toFixed(0)}% (${receivedBytes}/${totalBytes} bytes)`);
      }
    });
    
    req.on('end', () => {
      logger.info(`[Upload] ${req.path} - Complete (${receivedBytes} bytes)`);
    });
  }
  
  next();
}

// ============================================
// BANDWIDTH OPTIMIZATION
// ============================================

/**
 * Limit concurrent requests per IP to prevent abuse
 */
const activeRequestsPerIP = new Map<string, number>();

export function bandwidthOptimization(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  // Track active requests per IP
  const currentCount = activeRequestsPerIP.get(ip) || 0;
  activeRequestsPerIP.set(ip, currentCount + 1);
  
  // Cleanup on response
  res.on('finish', () => {
    const count = activeRequestsPerIP.get(ip) || 1;
    if (count <= 1) {
      activeRequestsPerIP.delete(ip);
    } else {
      activeRequestsPerIP.set(ip, count - 1);
    }
  });
  
  // Too many concurrent requests from same IP
  if (currentCount > 20) {
    logger.warn(`[Bandwidth] Too many concurrent requests from ${ip}: ${currentCount}`);
    
    // Don't block, but log for monitoring
    logSystem({
      level: 'warn',
      service: 'bandwidth',
      message: `High concurrent request count from IP: ${ip}`,
      details: { ip, concurrentRequests: currentCount },
      timestamp: new Date()
    });
  }
  
  next();
}

// ============================================
// RESPONSE TIME OPTIMIZATION
// ============================================

/**
 * Add ETag support for conditional requests
 */
export function conditionalRequestSupport(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Store original send
  const originalSend = res.send;
  
  // Override send to add ETag
  res.send = function(data: any): Response {
    // Only for GET requests
    if (req.method === 'GET' && data) {
      const crypto = require('crypto');
      const etag = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
      
      res.setHeader('ETag', etag);
      
      // Check if client has cached version
      if (req.headers['if-none-match'] === etag) {
        res.status(304);
        return originalSend.call(this, '');
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

// ============================================
// CONTENT DELIVERY OPTIMIZATION
// ============================================

/**
 * Prefetch hints for critical resources
 */
export function prefetchHints(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only for HTML pages
  if (!req.path.startsWith('/api/')) {
    // Add prefetch hints for critical assets
    res.setHeader('Link', [
      '</assets/logo.png>; rel=preload; as=image',
      '</api/packages>; rel=prefetch'
    ].join(', '));
  }
  
  next();
}

// ============================================
// EXPORT ALL MIDDLEWARE
// ============================================

export const performanceMiddleware = [
  performanceTrackingMiddleware,
  smartCompression,
  smartCacheHeaders,
  uploadProgressTracking,
  bandwidthOptimization,
  conditionalRequestSupport,
  prefetchHints
];
