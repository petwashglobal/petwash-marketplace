/**
 * Application Risk Engine (Smart Admin Panel §8).
 *
 * Computes automatic risk flags + a LOW/MEDIUM/HIGH/CRITICAL score for an
 * application (provider onboarding OR senior/disability discount). ADVISORY only
 * — it populates the admin review queue and warnings; a human admin still makes
 * every decision (no auto-approve, no money moves here). CRITICAL flags mark an
 * application as "do not auto-approve".
 *
 * Split into a PURE scorer (computeRiskFlags / scoreFromFlags — unit-testable,
 * no DB) and DB-backed assessors that gather the inputs.
 */
import { db } from '../db';
import { and, eq, ne, sql } from 'drizzle-orm';
import { users, providerApplications } from '@shared/schema';
import { memberDiscountApplications } from '@shared/schema';
import { isReconfirmationOverdue } from './reconfirmationService';
import { logger } from '../lib/logger';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskFlag {
  code: string;
  severity: RiskLevel;
  message: string;
}

/** Whole years between a DOB and now; null if no/invalid DOB. */
export function ageFromDob(dob: Date | string | null | undefined): number | null {
  if (!dob) return null;
  const d = dob instanceof Date ? dob : new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/** Inputs the pure scorer needs — already fetched by the DB assessors. */
export interface RiskInput {
  kind: 'provider' | 'discount';
  status?: string | null;
  age?: number | null;
  /** discount only: 'senior' | 'disability' */
  discountType?: string | null;
  /** provider only: captured tax/business status */
  taxStatus?: string | null;
  /** provider only: wants to earn (payout) */
  wantsPayout?: boolean;
  submittedAt?: Date | null;
  /** other accounts sharing this email (excluding the applicant). */
  duplicateEmailCount?: number;
  /** other accounts sharing this phone (excluding the applicant). */
  duplicatePhoneCount?: number;
  /** other accounts sharing this ID/passport (via blind index, excl. applicant). */
  duplicateIdCount?: number;
  /** provider reconfirmation overdue. */
  reconfirmationOverdue?: boolean;
  /** provider previously suspended. */
  previouslySuspended?: boolean;
}

const PENDING_STATUSES = new Set(['submitted', 'pending_review', 'under_review', 'needs_more_info']);
const PROVIDER_OVERDUE_DAYS = 5; // §7 queue
const DISCOUNT_OVERDUE_DAYS = 3; // §7 queue

/** PURE: derive the risk flags from already-gathered inputs. No DB, no I/O. */
export function computeRiskFlags(input: RiskInput): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const isPending = input.status ? PENDING_STATUSES.has(String(input.status)) : false;

  // ── Identity / age ───────────────────────────────────────────────────────
  if (input.age !== null && input.age !== undefined) {
    if (input.age < 18) {
      // Under-18 can never be a provider, and Prestige is 18+. CRITICAL block.
      flags.push({ code: 'UNDER_18', severity: 'critical', message: 'Applicant is under 18 — cannot be approved.' });
    }
    if (input.kind === 'discount' && input.discountType === 'senior' && input.age < 65) {
      flags.push({ code: 'SENIOR_AGE_MISMATCH', severity: 'high', message: `Senior discount but age is ${input.age} (< 65).` });
    }
  } else if (input.kind === 'provider') {
    flags.push({ code: 'AGE_UNVERIFIED', severity: 'medium', message: 'No date of birth on file — age (18+) cannot be verified.' });
  }

  // ── Duplicate contact across accounts ────────────────────────────────────
  if ((input.duplicateEmailCount ?? 0) > 0) {
    flags.push({ code: 'DUPLICATE_EMAIL', severity: 'high', message: 'This email is used by another account.' });
  }
  if ((input.duplicatePhoneCount ?? 0) > 0) {
    flags.push({ code: 'DUPLICATE_PHONE', severity: 'high', message: 'This mobile number is used by another account.' });
  }
  if ((input.duplicateIdCount ?? 0) > 0) {
    flags.push({ code: 'DUPLICATE_ID', severity: 'high', message: 'This ID/passport number is used on another account.' });
  }

  // ── Provider-specific ────────────────────────────────────────────────────
  if (input.kind === 'provider') {
    if (input.wantsPayout && !input.taxStatus) {
      flags.push({ code: 'PAYOUT_NO_TAX', severity: 'medium', message: 'Wants payouts but no tax/business status captured.' });
    }
    if (input.previouslySuspended) {
      flags.push({ code: 'PREVIOUSLY_SUSPENDED', severity: 'high', message: 'This provider was previously suspended.' });
    }
    if (input.reconfirmationOverdue) {
      flags.push({ code: 'RECONFIRMATION_OVERDUE', severity: 'medium', message: '6-month re-confirmation is overdue.' });
    }
  }

  // ── SLA / overdue (only while pending) ───────────────────────────────────
  if (isPending && input.submittedAt) {
    const days = Math.floor((Date.now() - new Date(input.submittedAt).getTime()) / 86_400_000);
    const limit = input.kind === 'provider' ? PROVIDER_OVERDUE_DAYS : DISCOUNT_OVERDUE_DAYS;
    if (days > limit) {
      flags.push({ code: 'PENDING_TOO_LONG', severity: 'high', message: `Pending ${days} days (> ${limit}-day SLA).` });
    }
  }

  return flags;
}

/** PURE: roll flags up to a single score. Critical dominates, then high, etc. */
export function scoreFromFlags(flags: RiskFlag[]): RiskLevel {
  if (flags.some((f) => f.severity === 'critical')) return 'critical';
  if (flags.some((f) => f.severity === 'high')) return 'high';
  if (flags.some((f) => f.severity === 'medium')) return 'medium';
  return 'low';
}

/** Count OTHER user accounts sharing this email / phone (excludes applicant). */
async function duplicateContactCounts(userId: string, email?: string | null, phone?: string | null) {
  let duplicateEmailCount = 0;
  let duplicatePhoneCount = 0;
  try {
    if (email) {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.email, email), ne(users.id, userId)));
      duplicateEmailCount = row?.n ?? 0;
    }
    if (phone) {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.phone, phone), ne(users.id, userId)));
      duplicatePhoneCount = row?.n ?? 0;
    }
  } catch (err: any) {
    logger.warn('[RiskEngine] duplicate-contact lookup failed', { err: err?.message });
  }
  return { duplicateEmailCount, duplicatePhoneCount };
}

export interface RiskAssessment {
  score: RiskLevel;
  flags: RiskFlag[];
}

/** Assess a provider application row (already selected) → flags + score. */
export async function assessProviderApplication(app: {
  userId: string;
  email?: string | null;
  phoneNumber?: string | null;
  status?: string | null;
  taxStatus?: string | null;
  dateOfBirth?: Date | string | null;
  submittedAt?: Date | null;
}): Promise<RiskAssessment> {
  const { duplicateEmailCount, duplicatePhoneCount } = await duplicateContactCounts(
    app.userId, app.email, app.phoneNumber,
  );
  let reconfirmationOverdue = false;
  try { reconfirmationOverdue = await isReconfirmationOverdue(app.userId); } catch { /* fail-safe */ }

  const flags = computeRiskFlags({
    kind: 'provider',
    status: app.status,
    age: ageFromDob(app.dateOfBirth),
    taxStatus: app.taxStatus,
    wantsPayout: true, // a provider application is always intent-to-earn
    submittedAt: app.submittedAt ?? null,
    duplicateEmailCount,
    duplicatePhoneCount,
    reconfirmationOverdue,
  });
  return { score: scoreFromFlags(flags), flags };
}

/** Count OTHER accounts (distinct userId) that share this ID blind-index. */
export async function duplicateIdCount(idHash: string | null | undefined, userId: string): Promise<number> {
  if (!idHash) return 0;
  try {
    const [row] = await db
      .select({ n: sql<number>`count(distinct ${memberDiscountApplications.userId})::int` })
      .from(memberDiscountApplications)
      .where(and(eq(memberDiscountApplications.idHash, idHash), ne(memberDiscountApplications.userId, userId)));
    return row?.n ?? 0;
  } catch (err: any) {
    logger.warn('[RiskEngine] duplicate-ID lookup failed', { err: err?.message });
    return 0;
  }
}

/** Assess a senior/disability discount application row → flags + score. */
export async function assessDiscountApplication(app: {
  userId: string;
  discountType?: string | null;
  status?: string | null;
  dateOfBirth?: Date | string | null;
  submittedAt?: Date | null;
  idHash?: string | null;
}): Promise<RiskAssessment> {
  // Discount applicant's contact comes from their user record.
  let email: string | null = null;
  let phone: string | null = null;
  try {
    const [u] = await db.select({ email: users.email, phone: users.phone }).from(users).where(eq(users.id, app.userId)).limit(1);
    email = u?.email ?? null;
    phone = u?.phone ?? null;
  } catch { /* best-effort */ }
  const { duplicateEmailCount, duplicatePhoneCount } = await duplicateContactCounts(app.userId, email, phone);
  const dupId = await duplicateIdCount(app.idHash, app.userId);

  const flags = computeRiskFlags({
    kind: 'discount',
    status: app.status,
    discountType: app.discountType,
    age: ageFromDob(app.dateOfBirth),
    submittedAt: app.submittedAt ?? null,
    duplicateEmailCount,
    duplicatePhoneCount,
    duplicateIdCount: dupId,
  });
  return { score: scoreFromFlags(flags), flags };
}

export { providerApplications, memberDiscountApplications };
