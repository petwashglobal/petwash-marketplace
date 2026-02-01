/**
 * Production API Configuration - Industry Best Practice 2025
 * 
 * Architecture:
 * - Frontend: Firebase Hosting (petwash.co.il) - static files only
 * - Backend: Replit Autoscale Deployment (*.replit.app) - stable URL
 * 
 * How big brands do it:
 * 1. Use environment variables for API URLs (never hardcode)
 * 2. Use stable deployment URLs (not dev URLs)
 * 3. Configure CORS properly for cross-origin requests
 */

const getApiBaseUrl = (): string => {
  // Priority 1: Explicit VITE_API_URL (set in .env or build-time)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Priority 2: Check if running in production (Firebase Hosting)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production Firebase Hosting domains
    const isFirebaseHosting = 
      hostname === 'petwash.co.il' || 
      hostname === 'www.petwash.co.il' ||
      hostname.endsWith('.web.app') ||
      hostname.endsWith('.firebaseapp.com');
    
    if (isFirebaseHosting) {
      // Use the Replit deployment URL for production
      // Priority: VITE_PRODUCTION_API_URL env var > current dev domain
      const productionApiUrl = import.meta.env.VITE_PRODUCTION_API_URL || 
        'https://f46fb046-7dd0-4090-af9e-1be17d9de48e-00-15el1m8qkuf16.picard.replit.dev';
      return productionApiUrl;
    }
    
    // If on Replit preview (dev), use same origin
    if (hostname.endsWith('.replit.dev') || 
        hostname.endsWith('.repl.co') || 
        hostname.endsWith('.replit.app')) {
      return ''; // Same origin - relative URLs work
    }
  }
  
  // Priority 3: Development mode - use relative URLs (same origin)
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Get the full API URL for a given path
 * @param path - The API path (e.g., '/api/users')
 * @returns Full URL with base (e.g., 'https://api.example.com/api/users')
 */
export const getApiUrl = (path: string): string => {
  // Guard against undefined/null path
  if (!path || typeof path !== 'string') {
    console.warn('[API Config] getApiUrl called with invalid path:', path);
    return API_BASE_URL || '';
  }
  
  // If already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Combine base URL with path
  return `${API_BASE_URL}${path}`;
};

/**
 * Debug: Log current API configuration (only in dev)
 */
if (import.meta.env.DEV) {
  console.log('[API Config]', {
    baseUrl: API_BASE_URL || '(relative)',
    isProduction: import.meta.env.PROD,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
    envApiUrl: import.meta.env.VITE_API_URL || 'not set',
    envProdApiUrl: import.meta.env.VITE_PRODUCTION_API_URL || 'not set',
  });
}
