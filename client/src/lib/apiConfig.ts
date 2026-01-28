/**
 * Production API Configuration
 * 
 * In production (Firebase Hosting), the frontend calls the Replit backend directly.
 * The backend has CORS configured to allow requests from petwash.co.il
 */

// Replit deployment URL - this is where the backend API runs
const REPLIT_API_URL = 'https://petwash-marketplace.replit.app';

const getApiBaseUrl = (): string => {
  // Use explicit VITE_API_URL if provided
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In production (Firebase Hosting), use Replit backend
  if (import.meta.env.PROD) {
    // Check if we're on Firebase Hosting (petwash.co.il)
    const isFirebaseHosting = typeof window !== 'undefined' && 
      (window.location.hostname === 'petwash.co.il' || 
       window.location.hostname === 'www.petwash.co.il' ||
       window.location.hostname.endsWith('.web.app') ||
       window.location.hostname.endsWith('.firebaseapp.com'));
    
    if (isFirebaseHosting) {
      return REPLIT_API_URL;
    }
  }
  
  // Development or same-origin deployment - use relative URLs
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

export const getApiUrl = (path: string): string => {
  if (path.startsWith('http')) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
};
