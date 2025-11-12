/**
 * HubSpot Custom Properties Setup Script
 * 
 * This script creates the custom properties needed for Pet Wash CRM integration.
 * Run this once to set up your HubSpot account with the required custom properties.
 * 
 * Usage: tsx server/create-hubspot-properties.ts
 */

import { getUncachableHubSpotClient } from './hubspot';
import { logger } from './lib/logger';

const CUSTOM_PROPERTIES = [
  {
    name: 'petwash_uid',
    label: 'Pet Wash User ID',
    type: 'string',
    fieldType: 'text',
    groupName: 'petwashinfo',
    description: 'Firebase User ID from Pet Wash authentication system'
  },
  {
    name: 'petwash_loyalty',
    label: 'Loyalty Program Member',
    type: 'bool',
    fieldType: 'booleancheckbox',
    groupName: 'petwashinfo',
    description: 'User opted into the Pet Wash loyalty program'
  },
  {
    name: 'petwash_reminders',
    label: 'Wash Reminders',
    type: 'bool',
    fieldType: 'booleancheckbox',
    groupName: 'petwashinfo',
    description: 'User wants to receive wash reminder notifications'
  },
  {
    name: 'petwash_marketing',
    label: 'Marketing Consent',
    type: 'bool',
    fieldType: 'booleancheckbox',
    groupName: 'petwashinfo',
    description: 'User consented to receive marketing emails and SMS'
  },
  {
    name: 'petwash_consent',
    label: 'Terms Accepted',
    type: 'bool',
    fieldType: 'booleancheckbox',
    groupName: 'petwashinfo',
    description: 'User accepted terms and conditions'
  },
  {
    name: 'consent_timestamp',
    label: 'Consent Date',
    type: 'datetime',
    fieldType: 'date',
    groupName: 'petwashinfo',
    description: 'Timestamp when user accepted terms and conditions'
  }
];

async function createCustomProperties() {
  logger.info('Starting HubSpot custom properties creation...\n');
  
  try {
    const hubspotClient = await getUncachableHubSpotClient();
    
    // First, try to create the property group
    try {
      await hubspotClient.crm.properties.groupsApi.create('contacts', {
        name: 'petwashinfo',
        label: 'Pet Wash Information',
        displayOrder: 5
      });
      logger.info('Created property group: Pet Wash Information');
    } catch (error: any) {
      if (error.code === 409) {
        logger.info('Property group already exists: Pet Wash Information');
      } else {
        throw error;
      }
    }
    
    // Create each custom property
    for (const prop of CUSTOM_PROPERTIES) {
      try {
        await hubspotClient.crm.properties.coreApi.create('contacts', prop as any);
        logger.info(`Created property: ${prop.name} (${prop.label})`);
      } catch (error: any) {
        if (error.code === 409) {
          logger.info(`Property already exists: ${prop.name}`);
        } else {
          logger.error(`Failed to create ${prop.name}:`, error.message);
        }
      }
    }
    
    logger.info('\nHubSpot custom properties setup complete!');
    logger.info('\nCreated properties:');
    CUSTOM_PROPERTIES.forEach(prop => {
      logger.info(`  - ${prop.name}: ${prop.label}`);
    });
    
  } catch (error: any) {
    logger.error('Error setting up HubSpot properties', error.message);
    process.exit(1);
  }
}

// Run the script
createCustomProperties();
