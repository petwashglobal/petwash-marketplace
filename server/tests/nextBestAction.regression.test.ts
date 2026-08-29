/**
 * CEO MASTER DIRECTIVE 2026-08-28 §36 §37 §65 — NextBestAction
 * service invariants.
 *
 * Structured code decides WHAT ACTION exists.
 * LLM decides HOW to explain / render it.
 *
 * This suite pins the discipline that keeps that boundary crisp:
 *   * the DTO type carries reasonCode + priority + requiresConfirmation
 *   * the composer NEVER invokes an LLM
 *   * every actionable AttentionItem forwards through a REASON CODE
 *     (no free-text)
 *   * the confirmation gate is centralised and defaults to safe
 *   * routes are Firebase-authed READ-ONLY, mounted under
 *     /api/next-best-action
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const TYPE = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'shared', 'lib', 'nextBestAction.ts'),
  'utf8',
);
const SVC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'nextBestAction.ts'),
  'utf8',
);
const ROUTE = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'nextBestAction.ts'),
  'utf8',
);
const REG = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

describe('NextBestAction DTO contract (CEO §36 §37)', () => {
  it('carries reasonCode + priority + requiresConfirmation on every action', () => {
    expect(TYPE).toMatch(/reasonCode: NextBestActionReasonCode;/);
    expect(TYPE).toMatch(/priority: NextBestActionPriority;/);
    expect(TYPE).toMatch(/requiresConfirmation: boolean;/);
  });

  it('reasonCode is a CLOSED enum — client fallbacks resolve unknowns to a generic', () => {
    // Every new reason must be added HERE — a stringly-typed reason
    // reopens the AI-copy-authority-leak the CEO §65 rule prevents.
    expect(TYPE).toMatch(/export type NextBestActionReasonCode =/);
    for (const code of [
      'BOOKING_PAYMENT_DUE',
      'JOURNEY_RESUME_SAVED',
      'SAVED_SEARCH_CONTINUE',
      'FAVOURITE_REBOOK',
      'REFUND_IN_PROGRESS',
      'EGIFT_BALANCE_AVAILABLE',
      'EGIFT_EXPIRING_SOON',
      'WALLET_BALANCE_AVAILABLE',
      'PRESTIGE_BENEFIT_AVAILABLE',
      'KYA_STALE_REVIEW',
      'PROVIDER_INSURANCE_EXPIRING',
      'PROVIDER_KYC_DOC_EXPIRING',
      'PROVIDER_PAYOUT_AVAILABLE',
      'PROVIDER_REQUEST_WAITING',
    ]) {
      expect(TYPE).toContain(code);
    }
  });

  it('priority is its own enum (critical / high / normal / low) — NOT a copy of AttentionPriority', () => {
    expect(TYPE).toMatch(/export type NextBestActionPriority = 'critical' \| 'high' \| 'normal' \| 'low';/);
  });
});

describe('NextBestAction composer (CEO §65)', () => {
  it('NEVER imports or invokes an LLM SDK', () => {
    // The composer is a pure server projection. A refactor that
    // reached for anthropic / openai / gemini here breaks the CEO
    // §65 boundary "structured code decides WHAT ACTION exists".
    expect(SVC).not.toMatch(/from ['"]@anthropic-ai/);
    expect(SVC).not.toMatch(/from ['"]openai/);
    expect(SVC).not.toMatch(/from ['"]@google\/genai/);
    expect(SVC).not.toMatch(/generative/i);
    // But it DOES import canonical projections.
    expect(SVC).toMatch(/import \{ composeAttentionFeed \} from '\.\/attentionFeed';/);
  });

  it('confirmation gate is centralised — L2/L3 defaults safe', () => {
    // Money paths (BOOKING_PAYMENT_DUE, PROVIDER_REQUEST_WAITING,
    // FAVOURITE_REBOOK) require an explicit confirm modal.
    expect(SVC).toMatch(/function requiresConfirmation\(reason: NextBestActionReasonCode\): boolean/);
    // Explicit true for the risky reasons.
    expect(SVC).toMatch(/case 'BOOKING_PAYMENT_DUE':\s*\n\s*case 'BOOKING_PROVIDER_ACCEPTED':\s*\n\s*case 'BOOKING_REQUEST_WAITING':\s*\n\s*case 'PROVIDER_REQUEST_WAITING':\s*\n\s*case 'FAVOURITE_REBOOK':\s*\n\s*return true;/);
  });

  it('maps AttentionItem id prefix → REASON CODE (no free-text)', () => {
    // Reason codes are the ONLY authority for client-side copy.
    expect(SVC).toMatch(/function attentionIdToReasonCode\(/);
    expect(SVC).toMatch(/case 'resume':\s*return 'JOURNEY_RESUME_SAVED';/);
    expect(SVC).toMatch(/case 'saved-search':\s*return 'SAVED_SEARCH_CONTINUE';/);
    expect(SVC).toMatch(/case 'refund':\s*return 'REFUND_IN_PROGRESS';/);
    // Unknown prefix → null → item does NOT graduate (deliberately
    // narrower than the attention feed).
    expect(SVC).toMatch(/default:\s*return null;/);
  });

  it('AttentionItem priority mapping is deterministic', () => {
    // urgent → critical, due_soon → high, informational → normal.
    // A refactor that flipped these silently would demote urgent
    // signals below informational ones.
    expect(SVC).toMatch(/case 'urgent':\s*return 'critical';/);
    expect(SVC).toMatch(/case 'due_soon':\s*return 'high';/);
    expect(SVC).toMatch(/case 'informational': return 'normal';/);
  });

  it('sorter uses critical → high → normal → low', () => {
    expect(SVC).toMatch(/PRIORITY_ORDER: Record<NextBestActionPriority, number> = \{\s*\n\s*critical: 0,\s*\n\s*high: 1,\s*\n\s*normal: 2,\s*\n\s*low: 3,\s*\n\s*\}/);
  });
});

describe('forward-looking picks (CEO §10 §67)', () => {
  it('composes FAVOURITE_REBOOK from favourite_providers + last-completed booking', () => {
    // Ownership: favourite_providers WHERE user_uid = userId, then
    // MOST-RECENT completed walk / captured-sitter booking with same
    // provider. entityRef is the booking id (used for the "why this?"
    // debug panel), destination is the wizard prefill URL.
    expect(SVC).toMatch(/async function favouriteRebookItems\(userId: string, he: boolean\): Promise<NextBestAction\[\]>/);
    expect(SVC).toMatch(/eq\(favouriteProviders\.userUid, userId\)/);
    expect(SVC).toMatch(/eq\(walkBookings\.walkerId, star\.providerId\),\s*\n\s*eq\(walkBookings\.status, 'completed'\),/);
    expect(SVC).toMatch(/eq\(sitterBookings\.sitterId, sitterIdNum\),\s*\n\s*eq\(sitterBookings\.paymentStatus, 'captured'\),/);
    // Score rungs: <60d → 0.8, <180d → 0.5, else 0.25
    expect(SVC).toMatch(/const score = daysSince < 60 \? 0\.8 : daysSince < 180 \? 0\.5 : 0\.25;/);
    // Money path → requiresConfirmation true (§37).
    expect(SVC).toMatch(/reasonCode: 'FAVOURITE_REBOOK',\s*\n\s*priority,\s*\n\s*actionType: 'rebook',\s*\n\s*destination,\s*\n\s*recommendationScore: score,\s*\n\s*requiresConfirmation: true,/);
  });

  it('dismissal-demote demotes but never DROPS a reason (CEO §67 nudge, not hide)', () => {
    // 3+ dismisses in 30 days → priority drops one level. Never
    // removes the item — a payment-due card must stay visible even
    // if the user has waved it away.
    expect(SVC).toMatch(/if \(n >= 3\) a\.priority = demotePriority\(a\.priority\);/);
    expect(SVC).toMatch(/function demotePriority\(p: NextBestActionPriority\): NextBestActionPriority/);
    expect(SVC).toMatch(/case 'critical': return 'high';\s*\n\s*case 'high':     return 'normal';\s*\n\s*case 'normal':   return 'low';\s*\n\s*case 'low':      return 'low';/);
  });

  it('favourite-rebook probe is pet-parent-only (never spams providers)', () => {
    // The composer path gates the call on actor === 'pet_parent'.
    expect(SVC).toMatch(/if \(actor === 'pet_parent'\) \{\s*\n\s*const rebooks = await favouriteRebookItems\(userId, he\);/);
  });

  it('favourite-rebook fails-CLOSED on DB error', () => {
    expect(SVC).toMatch(/\[NextBestAction\] favourite-rebook probe failed/);
    expect(SVC).toMatch(/logger\.warn\('\[NextBestAction\] favourite-rebook probe failed'[\s\S]*?return \[\];\s*\n\s*\}/);
  });
});

describe('NextBestAction route (CEO §36)', () => {
  it('exposes /pet-parent + /provider — READ-ONLY, Firebase-authed', () => {
    expect(ROUTE).toMatch(/router\.get\('\/pet-parent'/);
    expect(ROUTE).toMatch(/router\.get\('\/provider'/);
    // 401 when no auth on either endpoint.
    expect(ROUTE).toMatch(/if \(!uid\) return res\.status\(401\)\.json\(\{ ok: false, error: 'auth_required' \}\);/);
    // No mutation verbs.
    expect(ROUTE).not.toMatch(/router\.(post|put|patch|delete)\(/);
  });

  it('is mounted under /api/next-best-action with validateFirebaseToken + apiLimiter', () => {
    expect(REG).toContain("import nextBestActionRoutes from \"./routes/nextBestAction\";");
    expect(REG).toMatch(/app\.use\('\/api\/next-best-action', validateFirebaseToken, apiLimiter, nextBestActionRoutes\);/);
  });
});
