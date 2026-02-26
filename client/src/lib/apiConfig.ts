/**
 * Production API Configuration - Industry Best Practice 2025
 *
 * Architecture:
 * - Frontend: Firebase Hosting (petwash.co.il) - static files only
 * - Backend: Cloud Run (petwash-api, me-west1) via Firebase Hosting rewrites
 *
 * Firebase Hosting rewrites /api/** → Cloud Run automatically.
 * Therefore on petwash.co.il, ALL /api/** calls use RELATIVE URLs.
 * No VITE_PRODUCTION_API_URL needed — Firebase handles the routing.
 */

const getApiBaseUrl = (): string => {
  // Priority 1: Explicit VITE_API_URL override (rarely needed)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Production: Firebase Hosting domains — use relative URLs.
    // firebase.json rewrites /api/** → Cloud Run service (petwash-api, me-west1).
    // No base URL needed; relative paths like /api/... get routed automatically.
    const isFirebaseHosting =
      hostname === 'petwash.co.il' ||
      hostname === 'www.petwash.co.il' ||
      hostname.endsWith('.web.app') ||
      hostname.endsWith('.firebaseapp.com');

    if (isFirebaseHosting) {
      return ''; // Relative URLs → Firebase rewrites → Cloud Run
    }

    // Replit preview or deployed Replit URL — same origin, relative URLs work
    if (
      hostname.endsWith('.replit.dev') ||
      hostname.endsWith('.repl.co') ||
      hostname.endsWith('.replit.app')
    ) {
      return '';
    }
  }

  // Development / localhost — same origin
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Get the full API URL for a given path
 * @param path - The API path (e.g., '/api/users')
 * @returns Full URL or relative path
 */
export const getApiUrl = (path: string): string => {
  if (!path || typeof path !== 'string') {
    console.warn('[API Config] getApiUrl called with invalid path:', path);
    return API_BASE_URL || '';
  }

  // Already a full URL — return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
};

if (import.meta.env.DEV) {
  console.log('[API Config]', {
    baseUrl: API_BASE_URL || '(relative — Firebase rewrite active)',
    isProduction: import.meta.env.PROD,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
  });
}
