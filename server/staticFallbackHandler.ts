// Static Fallback Handler for Custom Domain 404 Issues
import { Express } from 'express';
import path from 'path';
import fs from 'fs';
import { logger } from './lib/logger';

export function setupStaticFallbackHandler(app: Express) {
  // Serve static files with custom domain support
  app.use('/fallback.html', (req, res) => {
    const host = req.get('host');
    logger.info(`FALLBACK REQUEST: ${host}`);
    
    const fallbackPath = path.join(process.cwd(), 'dist', 'public', 'fallback.html');
    
    if (fs.existsSync(fallbackPath)) {
      const fallbackHtml = fs.readFileSync(fallbackPath, 'utf8');
      
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'no-cache');
      res.set('X-Fallback-Handler', 'active');
      
      logger.info(`FALLBACK SERVED for ${host}`);
      return res.send(fallbackHtml);
    }
    
    res.status(404).send('Fallback not found');
  });
  
  // Create 404 override for custom domains
  app.use((req, res, next) => {
    const host = req.get('host');
    
    if (host && host.includes('petwash.co.il')) {
      // For custom domains showing 404, redirect to fallback
      const fallbackPath = path.join(process.cwd(), 'dist', 'public', 'fallback.html');
      
      if (fs.existsSync(fallbackPath)) {
        const fallbackHtml = fs.readFileSync(fallbackPath, 'utf8');
        
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('X-404-Override', 'Pet-Wash-Fallback');
        
        logger.info(`404 OVERRIDE: Serving fallback for ${host}`);
        return res.status(200).send(fallbackHtml);
      }
    }
    
    next();
  });
}