/**
 * Extend Express Session types to include custom session data
 */

import 'express-session';

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
    userId?: string;
    professionalId?: string;
    isSuperAdmin?: boolean;
    franchiseId?: string;
  }
}
