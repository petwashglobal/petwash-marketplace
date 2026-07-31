/**
 * PaymentTokenVault — card-on-file token store (CTO P0-2, 2026-07-31).
 *
 * Persists ONLY the payment processor's saved-card token + customer reference so
 * Sitter/Academy/Walk/Shop can charge a returning customer at provider-accept with no
 * re-entry. Backed by the `payment_tokens` table (shared/schema.ts + migration 0111).
 *
 * HARD RULE (PCI): this vault NEVER stores a full card number (PAN) or CVV. It stores a
 * surrogate token from the processor only. `assertNoRawCardData()` is a defense-in-depth
 * guard that THROWS if a caller ever tries to pass raw card fields — so a future mistake
 * fails loudly instead of silently writing cardholder data and dragging us into PCI scope.
 */

import { db } from '../db';
import { paymentTokens } from '@shared/schema';
import { and, eq, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';

export type PaymentTokenStatus = 'active' | 'expired' | 'revoked' | 'failed';

/** The ONLY fields the vault accepts. Note: NO cardNumber/pan/cvv/cvc — by design. */
export interface SaveTokenInput {
  userId: string;
  provider?: string;               // default 'sumit'
  processorCustomerId?: string;    // e.g. SUMIT CustomerID
  processorTokenId: string;        // the saved-card token — required
  cardBrand?: string;              // display only
  cardLast4?: string;              // display only (max 4 chars) — NOT the PAN
  expMonth?: number;
  expYear?: number;
  billingName?: string;
  consentVersion?: string;
}

// Any of these keys in an input object means someone is trying to hand us raw card data.
const FORBIDDEN_CARD_KEYS = [
  'cardnumber', 'card_number', 'pan', 'cvv', 'cvc', 'cvv2', 'securitycode',
  'security_code', 'fullcard', 'full_card', 'track1', 'track2',
];

/** THROWS if the input carries any raw-card field. PCI: we must never receive/store these. */
export function assertNoRawCardData(input: Record<string, unknown>): void {
  for (const key of Object.keys(input || {})) {
    if (FORBIDDEN_CARD_KEYS.includes(key.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
      throw new Error(`PaymentTokenVault: refusing raw card field "${key}" — store the processor TOKEN only, never PAN/CVV.`);
    }
  }
  // last4 must be exactly a 4-digit tail, never a full number smuggled through.
  const last4 = (input as any).cardLast4;
  if (last4 != null && !/^\d{1,4}$/.test(String(last4))) {
    throw new Error('PaymentTokenVault: cardLast4 must be ≤4 digits (display only), not a full card number.');
  }
}

/** True if the stored expiry is in the past (end of the exp month). */
export function isTokenExpired(expMonth?: number | null, expYear?: number | null, now: Date = new Date()): boolean {
  if (!expMonth || !expYear) return false; // unknown expiry → let the processor decline instead of guessing
  // Expires at the END of the exp month: first day of the following month.
  const expEnd = new Date(Date.UTC(expYear, expMonth, 1)); // month is 1-based here → Date month index = expMonth (next month)
  return now.getTime() >= expEnd.getTime();
}

export class PaymentTokenVault {
  /** Save a saved-card token after a successful first payment. Returns the new row id. */
  static async saveToken(input: SaveTokenInput): Promise<{ id: number }> {
    assertNoRawCardData(input as Record<string, unknown>);
    if (!input.userId || !input.processorTokenId) {
      throw new Error('PaymentTokenVault.saveToken: userId and processorTokenId are required.');
    }
    const [row] = await db.insert(paymentTokens).values({
      userId: input.userId,
      provider: input.provider || 'sumit',
      processorCustomerId: input.processorCustomerId ?? null,
      processorTokenId: input.processorTokenId,
      cardBrand: input.cardBrand ?? null,
      cardLast4: input.cardLast4 ? String(input.cardLast4).slice(-4) : null,
      expMonth: input.expMonth ?? null,
      expYear: input.expYear ?? null,
      billingName: input.billingName ?? null,
      status: 'active',
      consentVersion: input.consentVersion ?? null,
    }).returning({ id: paymentTokens.id });
    logger.info('[PaymentTokenVault] saved card token', {
      userId: input.userId, provider: input.provider || 'sumit', last4: input.cardLast4 || null, id: row.id,
    });
    return { id: row.id };
  }

  /** Get the user's most recent ACTIVE, non-expired token (or null). */
  static async getActiveToken(userId: string, provider = 'sumit') {
    const rows = await db.select().from(paymentTokens)
      .where(and(
        eq(paymentTokens.userId, userId),
        eq(paymentTokens.provider, provider),
        eq(paymentTokens.status, 'active'),
      ))
      .orderBy(desc(paymentTokens.createdAt))
      .limit(5);
    for (const t of rows) {
      if (isTokenExpired(t.expMonth, t.expYear)) {
        // Lazily flag an expired card so we stop offering it.
        await PaymentTokenVault.setStatus(t.id, userId, 'expired').catch(() => {});
        continue;
      }
      return t;
    }
    return null;
  }

  /** Explicit user/admin revoke (e.g. "remove card"). */
  static async revokeToken(id: number, userId: string): Promise<void> {
    await PaymentTokenVault.setStatus(id, userId, 'revoked');
  }

  /** Mark a token failed after a declined capture, so it isn't reused blindly. */
  static async markFailed(id: number, userId: string): Promise<void> {
    await PaymentTokenVault.setStatus(id, userId, 'failed');
  }

  private static async setStatus(id: number, userId: string, status: PaymentTokenStatus): Promise<void> {
    await db.update(paymentTokens)
      .set({ status, ...(status === 'revoked' ? { revokedAt: new Date() } : {}) })
      .where(and(eq(paymentTokens.id, id), eq(paymentTokens.userId, userId))); // userId scope = no cross-user token edits (IDOR-safe)
    logger.info('[PaymentTokenVault] token status changed', { id, userId, status });
  }
}

export const paymentTokenVault = PaymentTokenVault;
