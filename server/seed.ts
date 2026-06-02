import { db } from './db';
import { washPackages } from '@shared/schema';
import { createWashPackageData } from './utils';
import { logger } from './lib/logger';

async function seedDatabase() {
  try {
    logger.info('Seeding database...');
    
    // Check if packages already exist
    const existingPackages = await db.select().from(washPackages);
    
    if (existingPackages.length === 0) {
      const packageData = createWashPackageData();
      
      for (const pkg of packageData) {
        await db.insert(washPackages).values(pkg);
        logger.info(`Created package: ${pkg.name}`);
      }
      
      logger.info('Database seeded successfully!');
    } else {
      logger.info('Packages already exist, skipping seed');
    }
  } catch (error) {
    logger.error('Error seeding database', error);
  }
}

seedDatabase();