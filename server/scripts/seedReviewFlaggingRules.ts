/**
 * Seed Default Review Flagging Rules
 * Auto-detects problematic reviews based on keywords
 * Run with: npx tsx server/scripts/seedReviewFlaggingRules.ts
 */

import { db } from '../db';
import { reviewFlaggingRules } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Default flagging rules (multilingual)
const defaultRules = [
  // English - Safety Concerns
  { keyword: 'damaged', flagReason: 'safety_concern', severity: 'high', language: 'en', autoHideReview: false, requireModeration: true, notifyManagement: true },
  { keyword: 'late', flagReason: 'dispute', severity: 'medium', language: 'en', autoHideReview: false, requireModeration: true, notifyManagement: false },
  { keyword: 'aggressive', flagReason: 'safety_concern', severity: 'critical', language: 'en', autoHideReview: true, requireModeration: true, notifyManagement: true },
  { keyword: 'unsafe', flagReason: 'safety_concern', severity: 'critical', language: 'en', autoHideReview: true, requireModeration: true, notifyManagement: true },
  { keyword: 'stolen', flagReason: 'safety_concern', severity: 'critical', language: 'en', autoHideReview: true, requireModeration: true, notifyManagement: true },
  { keyword: 'rude', flagReason: 'profanity', severity: 'low', language: 'en', autoHideReview: false, requireModeration: true, notifyManagement: false },
  { keyword: 'scam', flagReason: 'dispute', severity: 'critical', language: 'en', autoHideReview: true, requireModeration: true, notifyManagement: true },
  { keyword: 'abuse', flagReason: 'safety_concern', severity: 'critical', language: 'en', autoHideReview: true, requireModeration: true, notifyManagement: true },
  { keyword: 'never again', flagReason: 'dispute', severity: 'medium', language: 'en', autoHideReview: false, requireModeration: true, notifyManagement: false },
  
  // Hebrew - Safety Concerns
  { keyword: 'מסוכן', flagReason: 'safety_concern', severity: 'critical', language: 'he', autoHideReview: true, requireModeration: true, notifyManagement: true }, // dangerous
  { keyword: 'נזק', flagReason: 'safety_concern', severity: 'high', language: 'he', autoHideReview: false, requireModeration: true, notifyManagement: true }, // damage
  { keyword: 'גנב', flagReason: 'safety_concern', severity: 'critical', language: 'he', autoHideReview: true, requireModeration: true, notifyManagement: true }, // stole
  { keyword: 'אגרסיבי', flagReason: 'safety_concern', severity: 'critical', language: 'he', autoHideReview: true, requireModeration: true, notifyManagement: true }, // aggressive
  { keyword: 'איחר', flagReason: 'dispute', severity: 'medium', language: 'he', autoHideReview: false, requireModeration: true, notifyManagement: false }, // late
  { keyword: 'גס רוח', flagReason: 'profanity', severity: 'low', language: 'he', autoHideReview: false, requireModeration: true, notifyManagement: false }, // rude
  { keyword: 'הונאה', flagReason: 'dispute', severity: 'critical', language: 'he', autoHideReview: true, requireModeration: true, notifyManagement: true }, // scam
  { keyword: 'התעללות', flagReason: 'safety_concern', severity: 'critical', language: 'he', autoHideReview: true, requireModeration: true, notifyManagement: true }, // abuse
];

async function seedFlaggingRules() {
  console.log('🚨 Seeding review flagging rules...\n');

  try {
    let created = 0;
    let skipped = 0;

    for (const rule of defaultRules) {
      // Check if rule already exists
      const existing = await db
        .select()
        .from(reviewFlaggingRules)
        .where(eq(reviewFlaggingRules.keyword, rule.keyword))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  ⚠️  Rule "${rule.keyword}" already exists, skipping...`);
        skipped++;
        continue;
      }

      // Create flagging rule
      await db.insert(reviewFlaggingRules).values({
        keyword: rule.keyword,
        flagReason: rule.flagReason,
        severity: rule.severity,
        language: rule.language,
        autoHideReview: rule.autoHideReview,
        requireModeration: rule.requireModeration,
        notifyManagement: rule.notifyManagement,
        isActive: true,
      });

      const severityEmoji = {
        low: '🟢',
        medium: '🟡',
        high: '🟠',
        critical: '🔴'
      }[rule.severity as string] || '⚪';

      console.log(`  ✅ Created ${severityEmoji} "${rule.keyword}" (${rule.language}) - ${rule.flagReason}`);
      created++;
    }

    console.log(`\n✨ Flagging rules seeded successfully!`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`\n🔍 Auto-flagging active for ${created + skipped} keywords`);

  } catch (error) {
    console.error('❌ Error seeding flagging rules:', error);
    throw error;
  }
}

// Run the script
seedFlaggingRules()
  .then(() => {
    console.log('✅ Script completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
