/**
 * Human-readable case IDs: CATEGORY-YYYYMMDD-###### (e.g. CARE-20260701-000044).
 *
 * Replaces the incident engine's opaque `inc_${nanoid(16)}` IDs. The CEO's
 * payment-confirmation spec (§9, AI monitoring) asked for exactly this
 * format under 3 prefixes (BOOK-/PAY-/CARE-) for its own booking-monitoring
 * cases. The incident engine (shared/incident-engine.ts) is a broader,
 * already-wired, general-purpose system spanning 30 types across pet safety,
 * property, home access, care, station faults, and trust/conduct — so the
 * category map below generalizes the spec's intent (readable, date-visible,
 * category-visible, sequential) across that full taxonomy rather than
 * force-fitting only 3 prefixes onto a system that covers much more.
 *
 * Sequencing is per (date, category), atomically incremented via a single
 * INSERT ... ON CONFLICT DO UPDATE ... RETURNING statement against
 * case_id_sequences (migration 0087) — no read-then-write race window.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import type { IncidentTypeX } from '@shared/incident-engine';

export const CASE_CATEGORIES = ['PET', 'INJ', 'PROP', 'HOME', 'CARE', 'STATION', 'PAY', 'TRUST', 'CASE'] as const;
export type CaseCategory = (typeof CASE_CATEGORIES)[number];

/** Maps every incident_engine type to a case-ID category prefix. */
const INCIDENT_TYPE_TO_CATEGORY: Record<IncidentTypeX, CaseCategory> = {
  pet_injury: 'PET', pet_illness: 'PET', pet_escape: 'PET', lost_pet: 'PET',
  bite: 'PET', aggression: 'PET', grooming_injury: 'PET', skin_reaction: 'PET',
  human_injury: 'INJ',
  property_damage: 'PROP', missing_item: 'PROP', theft_allegation: 'PROP',
  key_lost: 'HOME', access_code_shared: 'HOME', alarm_triggered: 'HOME',
  camera_disclosure_issue: 'HOME', neighbour_complaint: 'HOME', building_security_issue: 'HOME',
  home_left_unlocked: 'HOME', unauthorised_guest: 'HOME', unauthorised_access_claim: 'HOME',
  medication_error: 'CARE', feeding_error: 'CARE', provider_no_show: 'CARE',
  missed_visit: 'CARE', owner_unreachable: 'CARE', emergency_vet: 'CARE',
  care_details_incomplete: 'CARE',
  station_malfunction: 'STATION',
  payment_failure: 'PAY',
  privacy_breach: 'TRUST', document_fraud: 'TRUST', customer_abuse: 'TRUST',
  provider_misconduct: 'TRUST', customer_complaint: 'TRUST', off_platform_circumvention: 'TRUST',
  other: 'CASE',
};

export function categoryForIncidentType(type: string): CaseCategory {
  return INCIDENT_TYPE_TO_CATEGORY[type as IncidentTypeX] ?? 'CASE';
}

function todayYYYYMMDD(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Atomically reserve the next sequence number for today + this category, and
 * return the full case ID. Safe under concurrency: the upsert's row-level
 * lock means two simultaneous calls for the same (date, category) can never
 * receive the same sequence number.
 */
export async function generateCaseId(category: CaseCategory, date: string = todayYYYYMMDD()): Promise<string> {
  const result = await db.execute<{ next_seq: number }>(sql`
    INSERT INTO case_id_sequences (case_date, category, next_seq)
    VALUES (${date}, ${category}, 1)
    ON CONFLICT (case_date, category)
    DO UPDATE SET next_seq = case_id_sequences.next_seq + 1, updated_at = now()
    RETURNING next_seq
  `);
  const seq = Number(result.rows[0].next_seq);
  return `${category}-${date}-${String(seq).padStart(6, '0')}`;
}
