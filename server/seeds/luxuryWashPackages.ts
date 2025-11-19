/**
 * Luxury Wash Packages Seed Data
 * Idempotent seeding for flagship wash packages
 */

import { db } from '../db';
import { washPackages } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

interface LuxuryPackage {
  name: string;
  nameHe: string;
  description: string;
  descriptionHe: string;
  washCount: number;
  price: string;
  isActive: boolean;
  badge?: string;
}

const LUXURY_PACKAGES: LuxuryPackage[] = [
  {
    name: "Premium Single Wash",
    nameHe: "שטיפה פרימיום יחידה",
    description: "One premium organic wash session with luxury organic shampoo",
    descriptionHe: "שטיפה פרימיום אחת עם שמפו אורגני יוקרתי",
    washCount: 1,
    price: "39.00",
    isActive: true,
    badge: "PREMIUM"
  },
  {
    name: "Royal Triple Pack",
    nameHe: "חבילת שלוש שטיפות מלכותית",
    description: "Three premium washes - save 10% with our most popular package!",
    descriptionHe: "שלוש שטיפות פרימיום - חסכו 10% עם החבילה הפופולרית ביותר!",
    washCount: 3,
    price: "105.30",
    isActive: true,
    badge: "POPULAR"
  },
  {
    name: "Elite Five Pack",
    nameHe: "חבילת חמש שטיפות אליט",
    description: "Five premium washes - best value with 20% savings!",
    descriptionHe: "חמש שטיפות פרימיום - הערך הטוב ביותר עם 20% חיסכון!",
    washCount: 5,
    price: "156.00",
    isActive: true,
    badge: "BEST VALUE"
  }
];

/**
 * Idempotent seed - UPSERTS packages (updates existing or inserts new)
 */
export async function seedLuxuryWashPackages(): Promise<void> {
  try {
    logger.info('[Seed] Starting luxury wash packages seed');
    
    // UPSERT each package - update if exists, insert if new
    for (const pkg of LUXURY_PACKAGES) {
      // Find existing package by washCount (unique identifier)
      const existing = await db.select()
        .from(washPackages)
        .where(eq(washPackages.washCount, pkg.washCount))
        .limit(1);
      
      if (existing.length > 0) {
        // UPDATE existing package
        await db.update(washPackages)
          .set({
            name: pkg.name,
            nameHe: pkg.nameHe,
            description: pkg.description,
            descriptionHe: pkg.descriptionHe,
            price: pkg.price,
            isActive: pkg.isActive
          })
          .where(eq(washPackages.id, existing[0].id));
        logger.info('[Seed] Updated wash package', { name: pkg.name, washCount: pkg.washCount });
      } else {
        // INSERT new package
        await db.insert(washPackages).values(pkg);
        logger.info('[Seed] Inserted wash package', { name: pkg.name, washCount: pkg.washCount });
      }
    }
    
    logger.info('[Seed] ✅ Luxury wash packages seeded successfully', { count: LUXURY_PACKAGES.length });
  } catch (error) {
    logger.error('[Seed] Failed to seed wash packages', error);
    throw error;
  }
}

// Auto-execute seed
seedLuxuryWashPackages()
  .then(() => {
    logger.info('[Seed] Seed completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('[Seed] Seed failed', error);
    process.exit(1);
  });
