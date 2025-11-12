import session from 'express-session';
import { pool } from './db';
import connectPg from 'connect-pg-simple';
import crypto from 'crypto';

const PostgresSessionStore = connectPg(session);

const isProd = process.env.NODE_ENV === 'production' || 
               process.env.REPLIT_DEPLOYMENT === '1' || 
               process.env.REPLIT_DEPLOYMENT === 'true';
const isDev = process.env.NODE_ENV === 'development';

// Get session secret with proper fallback handling
function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  
  // Development-only fallback: deterministic secret (survives restarts)
  if (isDev) {
    console.warn('[Session] Using development session secret - set SESSION_SECRET for production');
    return 'petwash-dev-session-' + crypto.createHash('sha256').update('petwash-session').digest('hex');
  }
  
  // Production: throw error if secret is missing
  throw new Error(
    'SESSION_SECRET environment variable is required in production.\n' +
    'Please set SESSION_SECRET in Replit Secrets or your environment configuration.'
  );
}

export const sessionConfig: session.SessionOptions = {
  store: new PostgresSessionStore({
    pool: pool,
    createTableIfMissing: true,
    tableName: 'session',
  }),
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: isProd, // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // 'lax' = Safari/iOS compatible first-party cookies (ITP fix)
    domain: undefined, // Host-only cookie (no subdomain sharing) for better Safari compatibility
  },
  name: 'petwash.session',
  proxy: true, // Trust proxy headers for secure cookies behind reverse proxy
};

export default sessionConfig;