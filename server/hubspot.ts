import { Client } from '@hubspot/api-client';
import { logger, generateCorrelationId } from './lib/logger';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  try {
    const response = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=hubspot',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HubSpot connection API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    connectionSettings = data.items?.[0];

    const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

    if (!connectionSettings || !accessToken) {
      throw new Error('HubSpot not connected or access token missing');
    }
    return accessToken;
  } catch (error) {
    logger.error('Failed to get HubSpot access token', error, { hostname });
    throw error;
  }
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getUncachableHubSpotClient() {
  const accessToken = await getAccessToken();
  return new Client({ accessToken });
}

// Simple in-memory retry queue
interface RetryTask {
  id: string;
  fn: () => Promise<any>;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
}

const retryQueue: Map<string, RetryTask> = new Map();

async function enqueueRetry(taskId: string, fn: () => Promise<any>, attempts = 0) {
  const maxAttempts = 3;
  const backoffMs = Math.min(1000 * Math.pow(2, attempts), 30000); // Exponential backoff, max 30s
  
  retryQueue.set(taskId, {
    id: taskId,
    fn,
    attempts,
    maxAttempts,
    nextRetryAt: Date.now() + backoffMs
  });
  
  logger.info(`HubSpot task ${taskId} queued for retry`, { backoffMs, attempt: attempts + 1, maxAttempts });
}

// Process retry queue periodically
setInterval(async () => {
  const now = Date.now();
  for (const [taskId, task] of Array.from(retryQueue.entries())) {
    if (task.nextRetryAt <= now) {
      retryQueue.delete(taskId);
      try {
        await task.fn();
        logger.info(`HubSpot task ${taskId} completed on retry`);
      } catch (error: any) {
        if ((error.statusCode === 429 || error.statusCode >= 500) && task.attempts < task.maxAttempts - 1) {
          await enqueueRetry(taskId, task.fn, task.attempts + 1);
        } else {
          logger.error(`HubSpot task ${taskId} failed permanently`, error, { taskId });
        }
      }
    }
  }
}, 5000); // Check every 5 seconds

// Helper function to sync Firebase user to HubSpot contact with retry
export async function syncUserToHubSpot(data: {
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
}) {
  const correlationId = `sync-${data.uid}-${Date.now()}`;
  
  const syncTask = async () => {
    try {
      const hubspotClient = await getUncachableHubSpotClient();
      
      // Use standard HubSpot properties
      const contactProperties: any = {
        email: data.email,
        lifecyclestage: 'subscriber'
      };
      
      if (data.firstname) contactProperties.firstname = data.firstname;
      if (data.lastname) contactProperties.lastname = data.lastname;
      if (data.phone) contactProperties.phone = data.phone;
      
      // Standard fields
      if (data.uid) contactProperties.company = `Pet Wash User ${data.uid}`;
      if (data.lang) contactProperties.hs_language = data.lang === 'he' ? 'he' : 'en';
      if (data.dob) contactProperties.date_of_birth = data.dob;
      if (data.country) contactProperties.country = data.country;
      
      // Custom properties (these need to be created in HubSpot first)
      if (data.uid) contactProperties.petwash_uid = data.uid;
      if (data.loyaltyProgram !== undefined) contactProperties.petwash_loyalty = data.loyaltyProgram;
      if (data.reminders !== undefined) contactProperties.petwash_reminders = data.reminders;
      if (data.marketing !== undefined) contactProperties.petwash_marketing = data.marketing;
      if (data.consent !== undefined) contactProperties.petwash_consent = data.consent;
      if (data.consentTimestamp) contactProperties.consent_timestamp = data.consentTimestamp;
      
      // Pet information custom properties
      if (data.petName) contactProperties.petwash_pet_name = data.petName;
      if (data.petBreed) contactProperties.petwash_pet_breed = data.petBreed;
      if (data.petAge) contactProperties.petwash_pet_age = data.petAge;
      if (data.petWeight) contactProperties.petwash_pet_weight = data.petWeight;

      // Try to create contact
      try {
        const response = await hubspotClient.crm.contacts.basicApi.create({
          properties: contactProperties,
          associations: []
        });

        logger.info('HubSpot contact created', { correlationId, contactId: response.id });
        return response;
      } catch (createError: any) {
        // If contact already exists (409), update it
        if (createError.code === 409 || createError.body?.category === 'CONFLICT') {
          logger.info('Contact exists, updating', { correlationId });
          
          // Extract existing contact ID from error message
          const errorBody = createError.body;
          const existingIdMatch = errorBody?.message?.match(/Existing ID: (\d+)/);
          
          if (existingIdMatch) {
            const existingId = existingIdMatch[1];
            const response = await hubspotClient.crm.contacts.basicApi.update(
              existingId,
              { properties: contactProperties }
            );
            logger.info('HubSpot contact updated via error ID', { correlationId, contactId: response.id });
            return response;
          }
          
          // Fallback: search by email and update
          const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch({
            filterGroups: [{
              filters: [{
                propertyName: 'email',
                operator: 'EQ' as any,
                value: data.email
              }]
            }],
            properties: ['email'],
            limit: 1
          });

          if (searchResponse.results.length > 0) {
            const response = await hubspotClient.crm.contacts.basicApi.update(
              searchResponse.results[0].id,
              { properties: contactProperties }
            );
            logger.info('HubSpot contact updated via search', { correlationId, contactId: response.id });
            return response;
          }
        }
        throw createError;
      }
    } catch (error: any) {
      logger.error('HubSpot sync failed', error, { correlationId });
      
      // Retry on rate limit or server errors
      if (error.statusCode === 429 || error.statusCode >= 500) {
        throw error; // Let retry queue handle it
      }
      
      // Don't retry on other errors
      throw error;
    }
  };

  try {
    return await syncTask();
  } catch (error: any) {
    if (error.statusCode === 429 || error.statusCode >= 500) {
      await enqueueRetry(correlationId, syncTask, 0);
      return { queued: true, correlationId };
    }
    throw error;
  }
}

// Helper function to track custom events in HubSpot
export async function trackHubSpotEvent(
  email: string, 
  eventName: string, 
  properties?: Record<string, any>
) {
  const correlationId = `event-${email}-${eventName}-${Date.now()}`;
  
  const trackTask = async () => {
    try {
      const hubspotClient = await getUncachableHubSpotClient();
      
      // Find contact by email
      const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ' as any,
            value: email
          }]
        }],
        properties: ['email'],
        limit: 1
      });

      if (searchResponse.results.length === 0) {
        logger.warn('HubSpot contact not found for email', { correlationId, email });
        return null;
      }

      const contactId = searchResponse.results[0].id;

      // Create engagement/note for the event
      await hubspotClient.crm.objects.notes.basicApi.create({
        properties: {
          hs_note_body: `Event: ${eventName}\n${properties ? JSON.stringify(properties, null, 2) : ''}`,
          hs_timestamp: new Date().toISOString()
        },
        associations: [{
          to: { id: contactId },
          types: [{
            associationCategory: 'HUBSPOT_DEFINED' as any,
            associationTypeId: 202 // Note to Contact association
          }]
        }]
      });

      logger.info('HubSpot event tracked', { correlationId, eventName, contactId });
      return contactId;
    } catch (error: any) {
      logger.error('HubSpot event tracking failed', error, { correlationId });
      
      // Retry on rate limit or server errors
      if (error.statusCode === 429 || error.statusCode >= 500) {
        throw error;
      }
      
      throw error;
    }
  };

  try {
    return await trackTask();
  } catch (error: any) {
    if (error.statusCode === 429 || error.statusCode >= 500) {
      await enqueueRetry(correlationId, trackTask, 0);
      return { queued: true, correlationId };
    }
    throw error;
  }
}
