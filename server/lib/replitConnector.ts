/**
 * Replit Connector Auth Utility
 *
 * Provides Google API credentials via:
 *   1. Replit connector proxy (REPLIT_CONNECTORS_HOSTNAME + REPL_IDENTITY) — works in Replit
 *   2. Returns null gracefully when outside Replit — callers must handle this case
 *
 * In Cloud Run / Docker, replace Replit connector usage with a Google service-account
 * key (GOOGLE_SERVICE_ACCOUNT_JSON) or standard OAuth credentials.
 */

import { logger } from './logger';

export interface ConnectorAuthHeaders {
  Authorization: string;
  X_REPLIT_TOKEN: string;
}

export interface ConnectorConfig {
  baseUrl: string;
  headers: ConnectorAuthHeaders;
}

/**
 * Returns connector config if running inside Replit, otherwise null.
 * All callers should check for null and return a graceful "service unavailable" response.
 */
export function getReplitConnectorConfig(serviceName: string): ConnectorConfig | null {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? Buffer.from(process.env.REPL_IDENTITY, 'base64').toString('utf-8').trim()
    : process.env.X_REPLIT_TOKEN;

  if (!hostname || !xReplitToken) {
    logger.warn(`[ReplitConnector] ${serviceName} — Replit connector not available in this environment. ` +
      'Configure standard Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) for Cloud Run.');
    return null;
  }

  return {
    baseUrl: `https://${hostname}`,
    headers: {
      Authorization: `Bearer ${xReplitToken}`,
      X_REPLIT_TOKEN: xReplitToken,
    },
  };
}

/**
 * Standard "connector not available" JSON response payload.
 * Use this when a route relies on connector auth and none is available.
 */
export const CONNECTOR_UNAVAILABLE_RESPONSE = {
  success: false,
  error: 'Google integration not configured for this environment.',
  hint: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for non-Replit deployments.',
} as const;
