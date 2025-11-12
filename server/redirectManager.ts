// Redirect Manager for Pet Wash Platform - SEO & User Experience
import { Request, Response, NextFunction, Express } from 'express';
import path from 'path';
import { logger } from './lib/logger';

interface RedirectRule {
  from: string;
  to: string;
  permanent: boolean; // true for 301, false for 302
  reason?: string;
}

// Redirect configuration for Pet Wash platform
const redirectRules: RedirectRule[] = [
  // Legacy URLs to new structure
  { from: '/home', to: '/', permanent: true, reason: 'Homepage redirect' },
  { from: '/index.html', to: '/', permanent: true, reason: 'Remove .html extension' },
  { from: '/index.php', to: '/', permanent: true, reason: 'Legacy PHP redirect' },
  
  // Service redirects
  { from: '/services', to: '/our-service', permanent: true, reason: 'Service page consolidation' },
  { from: '/wash-services', to: '/our-service', permanent: true, reason: 'Service page consolidation' },
  { from: '/packages', to: '/', permanent: false, reason: 'Packages shown on homepage' },
  
  // About page variations
  { from: '/about-us', to: '/about', permanent: true, reason: 'Standardize about URL' },
  { from: '/company', to: '/about', permanent: true, reason: 'Company info redirect' },
  { from: '/who-we-are', to: '/about', permanent: true, reason: 'About page consolidation' },
  
  // Contact variations
  { from: '/contact-us', to: '/contact', permanent: true, reason: 'Standardize contact URL' },
  { from: '/get-in-touch', to: '/contact', permanent: true, reason: 'Contact page consolidation' },
  { from: '/support', to: '/contact', permanent: true, reason: 'Support through contact' },
  
  // Franchise variations
  { from: '/franchising', to: '/franchise', permanent: true, reason: 'Standardize franchise URL' },
  { from: '/business-opportunity', to: '/franchise', permanent: true, reason: 'Franchise opportunity redirect' },
  
  // Gift card variations
  { from: '/gift-cards', to: '/', permanent: false, reason: 'Gift cards on homepage' },
  { from: '/vouchers', to: '/', permanent: false, reason: 'Vouchers on homepage' },
  { from: '/e-gifts', to: '/', permanent: false, reason: 'E-gifts on homepage' },
  
  // Legacy language redirects
  { from: '/he', to: '/?lang=he', permanent: true, reason: 'Hebrew language parameter' },
  { from: '/hebrew', to: '/?lang=he', permanent: true, reason: 'Hebrew language parameter' },
  { from: '/en', to: '/?lang=en', permanent: true, reason: 'English language parameter' },
  { from: '/english', to: '/?lang=en', permanent: true, reason: 'English language parameter' },
  
  // Common typos and variations
  { from: '/petwash', to: '/', permanent: true, reason: 'Brand name redirect' },
  { from: '/pet-wash', to: '/', permanent: true, reason: 'Brand name redirect' },
  { from: '/wash', to: '/', permanent: true, reason: 'Service redirect' },
  
  // Mobile app redirects (if applicable in future)
  { from: '/app', to: '/', permanent: false, reason: 'Mobile app info on homepage' },
  { from: '/download', to: '/', permanent: false, reason: 'Download info on homepage' },
  
  // Legal pages standardization
  { from: '/privacy-policy', to: '/privacy', permanent: true, reason: 'Standardize privacy URL' },
  { from: '/terms-of-service', to: '/terms', permanent: true, reason: 'Standardize terms URL' },
  { from: '/terms-and-conditions', to: '/terms', permanent: true, reason: 'Standardize terms URL' },
  
  // Accessibility variations
  { from: '/accessibility-statement', to: '/accessibility', permanent: true, reason: 'Accessibility page redirect' },
  { from: '/ada-compliance', to: '/accessibility', permanent: true, reason: 'ADA compliance redirect' },
  
  // Authentication redirects
  { from: '/login', to: '/signin', permanent: true, reason: 'Standardize login URL' }
];

export function setupRedirectManager(app: Express) {
  logger.info('REDIRECT MANAGER INITIALIZED');
  logger.info(`CONFIGURED ${redirectRules.length} REDIRECT RULES`);
  
  // Apply redirect middleware before other routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    const userAgent = req.headers['user-agent'] || '';
    const isBot = /bot|crawler|spider|crawling/i.test(userAgent);
    const requestPath = req.path.toLowerCase();
    
    // Find matching redirect rule
    const rule = redirectRules.find(r => r.from.toLowerCase() === requestPath);
    
    if (rule) {
      const statusCode = rule.permanent ? 301 : 302;
      const redirectType = rule.permanent ? 'PERMANENT' : 'TEMPORARY';
      
      logger.info(`REDIRECT ${redirectType}: ${rule.from} → ${rule.to} (${rule.reason})`);
      
      // SEO-friendly headers
      res.setHeader('Location', rule.to);
      res.setHeader('Cache-Control', rule.permanent ? 'public, max-age=31536000' : 'no-cache');
      
      // Bot-specific headers for better crawling
      if (isBot) {
        res.setHeader('X-Robots-Tag', 'noindex');
        res.setHeader('X-Redirect-Reason', rule.reason || 'Page moved');
      }
      
      return res.status(statusCode).end();
    }
    
    next();
  });
}

// Broken link checker and fixer
export function setupBrokenLinkChecker(app: Express) {
  logger.info('BROKEN LINK CHECKER INITIALIZED');
  
  // Track 404s for broken link analysis
  const brokenLinks = new Map<string, { count: number, lastSeen: Date, referrer?: string }>();
  
  app.use('/api/link-check', (req: Request, res: Response) => {
    const links = Array.from(brokenLinks.entries()).map(([url, data]) => ({
      url,
      hitCount: data.count,
      lastSeen: data.lastSeen,
      referrer: data.referrer
    }));
    
    res.json({
      brokenLinks: links,
      totalBrokenLinks: links.length,
      generatedAt: new Date().toISOString()
    });
  });
  
  // 404 tracking middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Override res.status to catch 404s
    const originalStatus = res.status;
    res.status = function(code: number) {
      if (code === 404) {
        const url = req.originalUrl;
        const referrer = req.get('Referer');
        
        if (brokenLinks.has(url)) {
          const existing = brokenLinks.get(url)!;
          existing.count++;
          existing.lastSeen = new Date();
          if (referrer) existing.referrer = referrer;
        } else {
          brokenLinks.set(url, {
            count: 1,
            lastSeen: new Date(),
            referrer
          });
        }
        
        logger.info(`BROKEN LINK DETECTED: ${url} (Referrer: ${referrer || 'none'})`);
      }
      
      return originalStatus.call(this, code);
    };
    
    next();
  });
}

// Custom 404 page handler
export function setupCustom404Handler(app: Express) {
  logger.info('CUSTOM 404 HANDLER INITIALIZED');
  
  // Custom 404 middleware (place at the end of all routes)
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip if response already sent
    if (res.headersSent) {
      return next();
    }
    
    const userAgent = req.headers['user-agent'] || '';
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const isBot = /bot|crawler|spider|crawling/i.test(userAgent);
    const requestPath = req.path;
    const host = req.get('host') || '';
    
    logger.info(`404 HANDLER: ${requestPath} - User Agent: ${isIOS ? 'iOS' : 'Other'}`);
    
    // For API routes, return JSON 404
    if (requestPath.startsWith('/api/')) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'The requested API endpoint was not found',
        path: requestPath,
        suggestions: [
          '/api/packages - Get wash packages',
          '/api/auth/user - Get user info',
          '/api/gift-cards - Gift card operations'
        ],
        timestamp: new Date().toISOString()
      });
    }
    
    // For iOS devices and client-side routes, serve the main app
    if (isIOS || (!requestPath.includes('.') && !isBot)) {
      const indexPath = path.join(process.cwd(), 'dist', 'public', 'index.html');
      return res.sendFile(indexPath, (err) => {
        if (err) {
          logger.error(`404 FALLBACK ERROR: ${err.message}`);
          return res.status(404).send(generateCustom404HTML(requestPath, host));
        }
      });
    }
    
    // For bots and specific file requests, send custom 404 HTML
    res.status(404).send(generateCustom404HTML(requestPath, host));
  });
}

// Generate custom 404 HTML page
function generateCustom404HTML(requestPath: string, host: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Not Found - Pet Wash™️</title>
    <meta name="description" content="The page you're looking for couldn't be found. Explore our premium organic pet care services instead.">
    <meta name="robots" content="noindex, nofollow">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 3rem;
            text-align: center;
            max-width: 600px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .logo {
            font-size: 2.5rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 1rem;
        }
        .error-code {
            font-size: 8rem;
            font-weight: bold;
            color: #f1f1f1;
            line-height: 1;
            margin: 1rem 0;
        }
        h1 {
            font-size: 2rem;
            margin-bottom: 1rem;
            color: #333;
        }
        p {
            font-size: 1.1rem;
            color: #666;
            margin-bottom: 2rem;
            line-height: 1.6;
        }
        .suggestions {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 1.5rem;
            margin: 2rem 0;
            text-align: left;
        }
        .suggestions h3 {
            margin-bottom: 1rem;
            color: #333;
        }
        .suggestions ul {
            list-style: none;
        }
        .suggestions li {
            margin: 0.5rem 0;
        }
        .suggestions a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        .suggestions a:hover {
            text-decoration: underline;
        }
        .btn {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 1rem 2rem;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            margin: 0.5rem;
            transition: transform 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
            background: #5a67d8;
        }
        .btn-secondary {
            background: #48bb78;
        }
        .btn-secondary:hover {
            background: #38a169;
        }
        .search-box {
            margin: 2rem 0;
        }
        .search-box input {
            padding: 1rem;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            width: 100%;
            font-size: 1rem;
        }
        .search-box input:focus {
            outline: none;
            border-color: #667eea;
        }
        @media (max-width: 768px) {
            .container { padding: 2rem 1rem; }
            .error-code { font-size: 6rem; }
            h1 { font-size: 1.5rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">Pet Wash™️</div>
        <div class="error-code">404</div>
        <h1>Oops! Page Not Found</h1>
        <p>The page you're looking for seems to have wandered off like a curious pet. But don't worry - we'll help you find what you need!</p>
        
        <div class="suggestions">
            <h3>🐾 Popular Destinations:</h3>
            <ul>
                <li><a href="/">🏠 Homepage - Explore our premium pet care services</a></li>
                <li><a href="/our-service">🛁 Our Services - K9000 Technology & organic treatments</a></li>
                <li><a href="/about">ℹ️ About Us - Learn about our premium organic approach</a></li>
                <li><a href="/franchise">💼 Franchise Opportunities - Join our success story</a></li>
                <li><a href="/contact">📞 Contact Us - Get support and information</a></li>
            </ul>
        </div>
        
        <div class="search-box">
            <input type="text" placeholder="🔍 Search for services, packages, or information..." 
                   onkeypress="if(event.key==='Enter'){window.location.href='/?search='+encodeURIComponent(this.value)}">
        </div>
        
        <a href="/" class="btn">🏠 Return Home</a>
        <a href="/contact" class="btn btn-secondary">📞 Get Help</a>
        
        <p style="margin-top: 2rem; color: #999; font-size: 0.9rem;">
            Requested: <code>${requestPath}</code><br>
            If you believe this is an error, please <a href="/contact" style="color: #667eea;">contact our support team</a>.
        </p>
    </div>
    
    <script>
        // Track 404 for analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'page_not_found', {
                'page_path': '${requestPath}',
                'page_referrer': document.referrer
            });
        }
        
        // Auto-redirect for common typos
        const autoRedirects = {
            '/serrvice': '/our-service',
            '/servic': '/our-service',
            '/servicee': '/our-service',
            '/contct': '/contact',
            '/contat': '/contact',
            '/abot': '/about',
            '/abou': '/about'
        };
        
        const currentPath = '${requestPath}';
        if (autoRedirects[currentPath]) {
            setTimeout(() => {
                window.location.href = autoRedirects[currentPath];
            }, 3000);
        }
    </script>
</body>
</html>
  `.trim();
}