/**
 * Action + Confirmation Brain — CEO Doctrine 2026-08-30.
 *
 * Every mutating user action moves through this pipeline:
 *   ACTION INTENT → ELIGIBILITY → PREVIEW → CONFIRMATION → EXECUTION →
 *   RESULT → NEXT ACTIONS → AUDIT / NOTIFICATION / DOCUMENT effects.
 *
 * See docs/architecture/petwash-action-confirmation-catalog-2026.md.
 *
 * This module holds the SHARED TYPES the deterministic business brain +
 * the AI experience brain both consume. AI-driven suggestions surface
 * these types; only a user's authenticated + explicit action can drive
 * an L2+ execution.
 */

// ── Domains + risk ladder ──────────────────────────────────────────────

export type ActionDomain =
  | 'AUTH'
  | 'PROFILE'
  | 'PET'
  | 'PRESTIGE'
  | 'BOOKING'
  | 'MEET_AND_GREET'
  | 'COMMUNICATION'
  | 'PROVIDER'
  | 'MONEY'
  | 'SHOP'
  | 'SUPPORT'
  | 'ADMIN';

export type RiskLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

// ── Confirmation policy ────────────────────────────────────────────────

export type ConfirmationLevel =
  | 'NONE'
  | 'TOAST_UNDO'
  | 'LIGHT_CONFIRM'
  | 'REVIEW_SCREEN'
  | 'EXPLICIT_CONFIRM'
  | 'REAUTH_AND_CONFIRM';

/** Impact axes that raise a confirmation level. */
export interface ImpactSignals {
  moneyCents?: number;                 // absolute value of financial delta
  legalEffect?: boolean;               // creates / mutates a contractual obligation
  affectsOtherParty?: boolean;         // another human's plans / expectations change
  privacyEffect?: boolean;             // shares or reveals another party's data
  safetyEffect?: boolean;              // pet or human safety implication
  irreversible?: boolean;              // cannot be reversed once committed
  destructive?: boolean;               // deletes / removes data that carries history
}

// ── Action status + reason codes ──────────────────────────────────────

export type ActionStatus =
  | 'SUCCEEDED'
  | 'PROCESSING'
  | 'REQUIRES_ACTION'
  | 'FAILED'
  | 'STALE';

/**
 * Stable reason-code slugs. Translations are display-only (§93). Add new
 * codes only through this file so drift is impossible.
 */
export type ReasonCode =
  | 'OK'
  | 'PROVIDER_NO_LONGER_AVAILABLE'
  | 'PROVIDER_NOT_APPROVED'
  | 'PROVIDER_SERVICE_NOT_APPROVED'
  | 'PAYMENT_STILL_PROCESSING'
  | 'PAYMENT_UNCERTAIN'
  | 'PAYMENT_DECLINED'
  | 'PET_SPECIES_UNSUPPORTED'
  | 'PET_NOT_ELIGIBLE'
  | 'PET_MAX_EXCEEDED'
  | 'QUOTE_CHANGED'
  | 'BOOKING_ALREADY_CANCELLED'
  | 'BOOKING_ALREADY_ACCEPTED'
  | 'BOOKING_WINDOW_CLOSED'
  | 'REFUND_IN_PROGRESS'
  | 'PRESTIGE_ALREADY_ACTIVE'
  | 'RATE_UNIT_MISMATCH'
  | 'RATE_NOT_PUBLISHED'
  | 'CONSENT_REQUIRED'
  | 'AGREEMENT_REACCEPTANCE_REQUIRED'
  | 'MASKED_CONTACT_NOT_ALLOWED_YET'
  | 'MODERATION_BLOCK'
  | 'IDEMPOTENCY_REPLAY'
  | 'STALE_PREVIEW'
  | 'SELF_BOOKING_BLOCKED'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'REAUTH_REQUIRED'
  | 'OFFLINE_ACTION_UNAVAILABLE'
  | 'UNKNOWN';

// ── Effect shapes ─────────────────────────────────────────────────────

export interface MoneyEffect {
  netCents: number;                    // + = customer paid, - = customer refunded
  currency: 'ILS';
  breakdown?: Array<{ label: string; cents: number }>;
}

export interface DocumentEffect {
  kind: 'RECEIPT' | 'CREDIT_NOTE' | 'INVOICE' | 'AGREEMENT' | 'ACKNOWLEDGEMENT';
  status: 'PENDING' | 'ISSUED';
  externalRef?: string;
}

export interface NotificationEffect {
  recipients: string[];                // uids notified
  channels: Array<'PUSH' | 'EMAIL' | 'SMS' | 'INBOX'>;
}

// ── Preview + result ──────────────────────────────────────────────────

export interface ActionPreview {
  actionType: string;
  title: string;
  summary: string;
  affectedEntities: Array<{ kind: string; id: string; label: string }>;
  financial?: MoneyEffect;
  scheduleImpact?: string;
  providerImpact?: string;
  petImpact?: string;
  documentImpact?: string;
  warnings: string[];
  expiresAt: string;                   // ISO — after this, preview is STALE
  previewVersion: string;              // opaque; server rejects execute on drift
}

export interface ActionResult {
  actionId: string;                    // server-issued
  actionType: string;
  status: ActionStatus;
  entityRef?: { kind: string; id: string };
  newState?: string;
  userMessage: { code: ReasonCode; params?: Record<string, unknown> };
  financialEffect?: MoneyEffect;
  documentEffect?: DocumentEffect;
  notificationEffect?: NotificationEffect;
  nextActions: string[];               // ActionType slugs
  auditRef?: string;
  correlationId: string;
}

// ── Idempotency ───────────────────────────────────────────────────────

export interface IdempotencyKey {
  key: string;                         // opaque uuid-ish, generated per user intent
  scope: 'per-intent';                 // never per-network-request
}

/**
 * Doctrine §8 — one intent = one key. Two taps of Confirm on a slow phone
 * carry the SAME key so the server dedupes to a single execution.
 */
export function generateIdempotencyKey(now: Date = new Date()): IdempotencyKey {
  // Time + entropy — the exact shape is a server contract. This helper
  // exists so client + server agree on the field name + scope.
  const stamp = now.getTime().toString(36);
  const rnd = Math.floor(Math.random() * 1e9).toString(36);
  return { key: `${stamp}-${rnd}`, scope: 'per-intent' };
}

// ── ConfirmationPolicyResolver (§4, §43, §44) ─────────────────────────

/**
 * Pure, deterministic mapping from (risk + impact signals) to a
 * ConfirmationLevel. Callers pass the ActionDefinition's declared
 * `riskLevel` alongside the runtime `ImpactSignals` the server computed.
 *
 * Rules:
 *   • L4 always REAUTH_AND_CONFIRM.
 *   • Irreversible + destructive dominates over lower risk.
 *   • Money > 0 promotes L2 → L3 review.
 *   • affectsOtherParty on L2 forces at least REVIEW_SCREEN.
 *   • L0 is always NONE (a read never gates on a modal).
 *   • L1 uses TOAST_UNDO when destructive, NONE otherwise.
 */
export function resolveConfirmation(
  risk: RiskLevel,
  impact: ImpactSignals = {},
): ConfirmationLevel {
  if (risk === 'L0') return 'NONE';
  if (risk === 'L4' || impact.irreversible) return 'REAUTH_AND_CONFIRM';

  if (risk === 'L1') {
    return impact.destructive ? 'TOAST_UNDO' : 'NONE';
  }

  // L2 / L3 baseline picks by risk, then impact promotes.
  let level: ConfirmationLevel = risk === 'L3' ? 'EXPLICIT_CONFIRM' : 'LIGHT_CONFIRM';

  if (risk === 'L2' && (impact.affectsOtherParty || impact.legalEffect)) {
    level = 'REVIEW_SCREEN';
  }
  if (risk === 'L2' && impact.moneyCents !== undefined && impact.moneyCents > 0) {
    level = 'REVIEW_SCREEN';
  }
  if (risk === 'L3' && (impact.legalEffect || impact.safetyEffect || impact.privacyEffect)) {
    // Explicit already covers money; add REVIEW_SCREEN precedent when the
    // change is contractual / safety / privacy heavy — keep EXPLICIT_CONFIRM
    // (highest of the two by severity ranking).
    level = 'EXPLICIT_CONFIRM';
  }

  return level;
}

// ── STALE-state contract (§10) ────────────────────────────────────────

export interface StaleStateResult {
  status: 'STALE';
  reason: ReasonCode;                  // e.g. QUOTE_CHANGED
  freshPreview: ActionPreview;
}

// ── Availability list (§40, §41) ──────────────────────────────────────

export interface AvailableAction {
  type: string;                        // ActionType slug
  enabled: boolean;
  requiresPreview?: boolean;
  reasonCode?: ReasonCode;             // when disabled — never a raw string
  riskLevel: RiskLevel;
  confirmationLevel: ConfirmationLevel;
}

/**
 * Sort an available-actions list by risk ascending, so the UI naturally
 * puts the safest primary action first and destructive last. Same-risk
 * ordering is preserved (stable).
 */
export function sortAvailableActionsSafeFirst(
  actions: AvailableAction[],
): AvailableAction[] {
  const rank: Record<RiskLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
  return [...actions].sort((a, b) => rank[a.riskLevel] - rank[b.riskLevel]);
}
