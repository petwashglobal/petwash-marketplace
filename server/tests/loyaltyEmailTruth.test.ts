/**
 * Loyalty email truth lock (A5-audit class).
 *
 * The club/tier emails have repeatedly grown claims the platform doesn't
 * wire: per-tier "extra discount", points multipliers, free-wash quotas,
 * concierge, referral bonuses, first-wash double points. Policy
 * (discount-policy 2026-06-22): the tier ladder is RECOGNITION — 5% is flat
 * for every member, earning is a flat 1 point per ₪1.
 *
 * This suite renders every kind × language × tier and bans the vocabulary
 * of unwired promises, so the claims can't drift back in.
 */
import { describe, it, expect } from 'vitest';
import { generateLuxuryClubEmail, type ClubEmailEventKind } from '../email/templates/luxury-club-2026';
import type { LoyaltyTier } from '../../client/src/lib/loyalty';

const KINDS: ClubEmailEventKind[] = ['welcome', 'tier_upgrade', 'purchase_reward', 'club_event'];
const LANGS = ['he', 'en'] as const;
const TIERS: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'emerald', 'royal'];

const BANNED = [
  // unwired mechanics
  'extra discount', 'הנחה נוספת',
  'multiplier', 'מכפיל',
  'free washes', 'שטיפות חינם',
  'concierge', 'קונסיירז',
  'double points', 'כפל נקודות',
  'both earn 250', '250 נקודות',
  // discount ladder marketing (tier % on top of base)
  '% off all', 'on all bookings', 'על כל ההזמנות',
  // dead program name
  'privilege',
];

function renderAll(): Array<{ id: string; text: string }> {
  const out: Array<{ id: string; text: string }> = [];
  for (const kind of KINDS) {
    for (const language of LANGS) {
      for (const tier of TIERS) {
        const { subject, html } = generateLuxuryClubEmail({
          kind,
          recipientEmail: 'member@example.com',
          recipientName: 'Dana',
          language,
          tier,
          newTier: tier,
          tierLabel: tier,
          pointsEarned: 55,
          newPoints: 1234,
        });
        out.push({ id: `${kind}/${language}/${tier}`, text: `${subject}\n${html}`.toLowerCase() });
      }
    }
  }
  return out;
}

describe('loyalty club emails — no unwired claims', () => {
  const rendered = renderAll();

  it('renders every kind × language × tier', () => {
    expect(rendered).toHaveLength(KINDS.length * LANGS.length * TIERS.length);
    for (const r of rendered) expect(r.text.length).toBeGreaterThan(200);
  });

  for (const phrase of BANNED) {
    it(`never contains "${phrase}"`, () => {
      for (const r of rendered) {
        expect(r.text, `${r.id} contains banned phrase "${phrase}"`).not.toContain(phrase.toLowerCase());
      }
    });
  }

  it('states the flat, wired benefits (5% + point per shekel) in tier-upgrade emails', () => {
    const upgrade = rendered.filter((r) => r.id.startsWith('tier_upgrade/en'));
    for (const r of upgrade) {
      expect(r.text).toContain('5% off every k9000 wash');
      expect(r.text).toContain('a point on every shekel');
    }
  });
});
