/**
 * ONE tier ladder (2026-09-12).
 *
 * Three ladders disagreed about what a tier is called: the CEO-locked public
 * labels in shared/schema-loyalty.ts (Member, Silver, Gold, Platinum, Diamond,
 * Emerald, Black Reserve — 2026-06-29), server/lib/memberTier.ts (MEMBER …
 * BLACK RESERVE, no Emerald) and the pass page (Prestige Pearl / Prestige
 * Black, no Diamond, no Emerald). The same member could be "Diamond" on the
 * dashboard, "DIAMOND" on the Apple pass and "Prestige Black" on the pass page.
 *
 * This module derives every label from TIER_CONFIGS and resolves the legacy
 * ids still stored in data (new/member → bronze, vip/elite/black → royal).
 * "Black Reserve" is a product name and stays English in every language.
 */

import { TIER_CONFIGS } from '../schema-loyalty';

const TIER_ALIASES: Readonly<Record<string, string>> = {
  new: 'bronze',
  member: 'bronze',
  standard: 'bronze',
  pearl: 'bronze',
  vip: 'royal',
  elite: 'royal',
  black: 'royal',
  black_reserve: 'royal',
  'black reserve': 'royal',
};

/** Lower-cased, alias-resolved TIER_CONFIGS id. Unknown → 'bronze'. */
export function canonicalTierId(tier: string | null | undefined): string {
  const raw = String(tier ?? '').trim().toLowerCase();
  const id = TIER_ALIASES[raw] ?? raw;
  return TIER_CONFIGS.some((t) => t.id === id) ? id : 'bronze';
}

/** Public display name for a tier. Hebrew where the locked ladder has one; product names stay English. */
export function tierDisplayName(tier: string | null | undefined, language: 'en' | 'he' = 'en'): string {
  const cfg = TIER_CONFIGS.find((t) => t.id === canonicalTierId(tier)) ?? TIER_CONFIGS[0];
  return language === 'he' ? (cfg.nameHe || cfg.name) : cfg.name;
}

export function tierDisplay(tier: string | null | undefined): { en: string; he: string } {
  return { en: tierDisplayName(tier, 'en'), he: tierDisplayName(tier, 'he') };
}

/** Upper-case pass/card label, e.g. "BLACK RESERVE" — what Apple/Google passes print as TIER. */
export function tierPassLabel(tier: string | null | undefined): string {
  return tierDisplayName(tier, 'en').toUpperCase();
}
