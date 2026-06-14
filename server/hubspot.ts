/**
 * HubSpot CRM integration — DISABLED 2026-06 (Replit wire cut).
 *
 * The previous implementation fetched a HubSpot access token through Replit's
 * connector proxy (REPLIT_CONNECTORS_HOSTNAME + X_REPLIT_TOKEN). That put Replit
 * in the path of our CRM data, and it was already non-functional in production
 * (Cloud Run has no Replit env → the connector call failed). Per CEO directive
 * to remove any Replit ability over our systems, these are now no-ops: they
 * touch nothing external and never contact Replit.
 *
 * Callers (privilege-loyalty, complete-registration, routes.ts signup) invoke
 * these best-effort (try/catch, non-blocking), so no-ops are safe — CRM sync
 * simply does nothing until a REAL, direct HubSpot integration (private-app
 * token via HUBSPOT_ACCESS_TOKEN, no Replit) is built and wired here.
 */
import { logger } from './lib/logger';

let warnedOnce = false;
function noteDisabled() {
  if (!warnedOnce) {
    logger.info('[HubSpot] CRM sync disabled (Replit connector removed). No-op until a direct HubSpot token integration is added.');
    warnedOnce = true;
  }
}

/** No-op: never returns a live client (Replit connector path removed). */
export async function getUncachableHubSpotClient(): Promise<null> {
  noteDisabled();
  return null;
}

/** No-op CRM contact sync. Safe to call; does nothing. */
export async function syncUserToHubSpot(_data: {
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  [key: string]: unknown;
}): Promise<void> {
  noteDisabled();
}

/** No-op CRM event tracking. Safe to call; does nothing. */
export async function trackHubSpotEvent(
  _email: string,
  _eventName: string,
  _properties?: Record<string, unknown>,
): Promise<void> {
  noteDisabled();
}
