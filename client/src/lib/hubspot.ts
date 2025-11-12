// Client-side HubSpot integration helpers
import { logger } from "./logger";
// Never includes any API keys or tokens - all server-side

export async function trackEvent(
  email: string, 
  eventName: string, 
  properties?: Record<string, any>
): Promise<void> {
  try {
    const response = await fetch('/api/hubspot/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, eventName, properties })
    });
    
    if (!response.ok) {
      const error = await response.json();
      logger.warn('HubSpot event tracking failed', { message: error.message });
    }
  } catch (error) {
    logger.error('Failed to track HubSpot event', error);
  }
}

export async function syncUser(userData: {
  uid: string;
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  lang?: string;
  dob?: string;
  country?: string;
  loyaltyProgram?: boolean;
  reminders?: boolean;
  marketing?: boolean;
  consent?: boolean;
  consentTimestamp?: string;
  petName?: string;
  petBreed?: string;
  petAge?: string;
  petWeight?: string;
}): Promise<void> {
  try {
    const response = await fetch('/api/hubspot/sync-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      logger.warn('HubSpot user sync failed', { message: error.message });
    }
  } catch (error) {
    logger.error('Failed to sync user to HubSpot', error);
  }
}
