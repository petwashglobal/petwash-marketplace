// Seed Sample Stations for Testing
// Run with: tsx scripts/seed-sample-stations.ts

import { db } from '../server/lib/firebase-admin';
import { logger } from '../server/lib/logger';

const sampleStations = [
  {
    serialNumber: 'PW-TLV-001',
    status: 'active',
    address: {
      street: 'Dizengoff 50',
      city: 'Tel Aviv',
      postalCode: '6433109',
      country: 'Israel',
      coordinates: { lat: 32.0853, lng: 34.7818 },
    },
    installation: {
      date: new Date('2024-01-15'),
      technician: 'Yossi Cohen',
      notes: 'Main downtown location, high traffic',
    },
    equipment: {
      model: 'K9000 Pro',
      manufacturer: 'Pet Wash Industries',
      warranty: { expiresAt: new Date('2027-01-15') },
      lastMaintenance: new Date('2025-09-15'),
      nextMaintenance: new Date('2026-01-15'),
    },
    utilities: {
      electricity: {
        provider: 'Israel Electric Corp',
        accountNumber: 'IEC-12345678',
        renewalDate: new Date('2025-11-01'),
      },
      water: {
        provider: 'Mei Avivim',
        accountNumber: 'MA-87654321',
        renewalDate: new Date('2025-12-31'),
      },
      internet: {
        provider: 'Bezeq',
        accountNumber: 'BZQ-11223344',
        renewalDate: new Date('2026-02-28'),
      },
    },
    contact: {
      name: 'Sarah Levi',
      phone: '+972-50-1234567',
      email: 'tlv001@petwash.co.il',
    },
    thresholds: {
      minStock: {
        shampoo: 20,
        conditioner: 15,
        disinfectant: 10,
        fragrance: 5,
      },
      maintenanceHours: 500,
    },
    metadata: {
      createdAt: new Date(),
      createdBy: 'seed-script',
      updatedAt: new Date(),
      updatedBy: 'seed-script',
    },
  },
  {
    serialNumber: 'PW-JLM-002',
    status: 'active',
    address: {
      street: 'Jaffa 23',
      city: 'Jerusalem',
      postalCode: '9438302',
      country: 'Israel',
      coordinates: { lat: 31.7833, lng: 35.2167 },
    },
    installation: {
      date: new Date('2024-02-20'),
      technician: 'David Ben-David',
      notes: 'Shopping center location',
    },
    equipment: {
      model: 'K9000 Standard',
      manufacturer: 'Pet Wash Industries',
      warranty: { expiresAt: new Date('2027-02-20') },
      lastMaintenance: new Date('2025-08-20'),
      nextMaintenance: new Date('2025-12-20'),
    },
    utilities: {
      electricity: {
        provider: 'Israel Electric Corp',
        accountNumber: 'IEC-22334455',
        renewalDate: new Date('2025-10-15'),
      },
      water: {
        provider: 'Hagihon',
        accountNumber: 'HGH-55443322',
        renewalDate: new Date('2025-11-30'),
      },
      internet: {
        provider: 'Partner',
        accountNumber: 'PTR-99887766',
        renewalDate: new Date('2026-01-15'),
      },
    },
    contact: {
      name: 'Rachel Cohen',
      phone: '+972-54-9876543',
      email: 'jlm002@petwash.co.il',
    },
    thresholds: {
      minStock: {
        shampoo: 25,
        conditioner: 20,
        disinfectant: 15,
        fragrance: 10,
      },
      maintenanceHours: 500,
    },
    metadata: {
      createdAt: new Date(),
      createdBy: 'seed-script',
      updatedAt: new Date(),
      updatedBy: 'seed-script',
    },
  },
  {
    serialNumber: 'PW-HFA-003',
    status: 'installing',
    address: {
      street: 'HaNassi 15',
      city: 'Haifa',
      postalCode: '3303304',
      country: 'Israel',
      coordinates: { lat: 32.7940, lng: 34.9896 },
    },
    installation: {
      date: new Date('2025-10-25'),
      technician: 'TBD',
      notes: 'New location - installation in progress',
    },
    equipment: {
      model: 'K9000 Pro',
      manufacturer: 'Pet Wash Industries',
      warranty: { expiresAt: new Date('2028-10-25') },
    },
    utilities: {
      electricity: {
        provider: 'Israel Electric Corp',
        accountNumber: 'IEC-33445566',
        renewalDate: new Date('2026-10-01'),
      },
    },
    contact: {
      name: 'Michael Shapiro',
      phone: '+972-52-1122334',
      email: 'hfa003@petwash.co.il',
    },
    thresholds: {
      minStock: {
        shampoo: 20,
        conditioner: 15,
        disinfectant: 10,
        fragrance: 5,
      },
      maintenanceHours: 500,
    },
    metadata: {
      createdAt: new Date(),
      createdBy: 'seed-script',
      updatedAt: new Date(),
      updatedBy: 'seed-script',
    },
  },
];

const sampleInventory = [
  {
    stationId: '', // Will be filled after station creation
    items: {
      shampoo: { onHand: 45, unit: 'L', lastRestocked: new Date('2025-10-01') },
      conditioner: { onHand: 30, unit: 'L', lastRestocked: new Date('2025-10-01') },
      disinfectant: { onHand: 25, unit: 'L', lastRestocked: new Date('2025-10-01') },
      fragrance: { onHand: 12, unit: 'L', lastRestocked: new Date('2025-10-01') },
    },
    usage: {
      dailyAverage: {
        shampoo: 2.5,
        conditioner: 1.8,
        disinfectant: 1.2,
        fragrance: 0.5,
      },
    },
    updatedAt: new Date(),
  },
  {
    stationId: '', // Will be filled after station creation
    items: {
      shampoo: { onHand: 18, unit: 'L', lastRestocked: new Date('2025-09-20') }, // LOW STOCK
      conditioner: { onHand: 12, unit: 'L', lastRestocked: new Date('2025-09-20') },
      disinfectant: { onHand: 8, unit: 'L', lastRestocked: new Date('2025-09-20') },
      fragrance: { onHand: 4, unit: 'L', lastRestocked: new Date('2025-09-20') }, // LOW STOCK
    },
    usage: {
      dailyAverage: {
        shampoo: 3.0,
        conditioner: 2.2,
        disinfectant: 1.5,
        fragrance: 0.6,
      },
    },
    updatedAt: new Date(),
  },
  {
    stationId: '', // Will be filled after station creation
    items: {
      shampoo: { onHand: 0, unit: 'L', lastRestocked: new Date('2025-10-15') }, // New station
      conditioner: { onHand: 0, unit: 'L', lastRestocked: new Date('2025-10-15') },
      disinfectant: { onHand: 0, unit: 'L', lastRestocked: new Date('2025-10-15') },
      fragrance: { onHand: 0, unit: 'L', lastRestocked: new Date('2025-10-15') },
    },
    usage: {
      dailyAverage: {
        shampoo: 0,
        conditioner: 0,
        disinfectant: 0,
        fragrance: 0,
      },
    },
    updatedAt: new Date(),
  },
];

async function seedStations() {
  try {
    logger.info('[Seed] Starting to seed sample stations...');

    // Check if stations already exist
    const existingStations = await db.collection('stations').get();
    if (!existingStations.empty) {
      logger.warn('[Seed] Stations already exist. Skipping seed.');
      logger.info(`[Seed] Found ${existingStations.size} existing stations.`);
      return;
    }

    // Create stations
    const stationIds: string[] = [];
    for (const station of sampleStations) {
      const docRef = await db.collection('stations').add(station);
      stationIds.push(docRef.id);
      logger.info(`[Seed] Created station: ${station.serialNumber} (ID: ${docRef.id})`);
    }

    // Create inventory for each station
    for (let i = 0; i < stationIds.length; i++) {
      const inventory = { ...sampleInventory[i], stationId: stationIds[i] };
      await db.collection('station_inventory').doc(stationIds[i]).set(inventory);
      logger.info(`[Seed] Created inventory for station ${stationIds[i]}`);
    }

    // Create some sample events
    const now = new Date();
    const events = [
      {
        stationId: stationIds[0],
        type: 'maintenance',
        at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        by: 'Yossi Cohen',
        data: { description: 'Regular maintenance check', duration: 120 },
      },
      {
        stationId: stationIds[1],
        type: 'restock',
        at: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        by: 'warehouse-team',
        data: {
          items: { shampoo: 50, conditioner: 40, disinfectant: 30, fragrance: 20 },
        },
      },
      {
        stationId: stationIds[0],
        type: 'incident',
        at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        by: 'Sarah Levi',
        data: { description: 'Water leak detected and repaired', severity: 'medium' },
      },
    ];

    for (const event of events) {
      await db.collection('station_events').add(event);
      logger.info(`[Seed] Created event: ${event.type} for station ${event.stationId}`);
    }

    logger.info('[Seed] ✅ Sample stations seeded successfully!');
    logger.info('[Seed] Summary:');
    logger.info(`  - ${sampleStations.length} stations created`);
    logger.info(`  - ${stationIds.length} inventory records created`);
    logger.info(`  - ${events.length} events created`);
    logger.info('[Seed] Station details:');
    logger.info('  - PW-TLV-001: Tel Aviv (Active, good stock)');
    logger.info('  - PW-JLM-002: Jerusalem (Active, LOW STOCK - will trigger alerts)');
    logger.info('  - PW-HFA-003: Haifa (Installing, empty inventory)');
    
    process.exit(0);
  } catch (error) {
    logger.error('[Seed] Error seeding stations:', error);
    process.exit(1);
  }
}

// Run the seed function
seedStations();
