/**
 * PetWash Prestige Pass — Shared Wallet Engine
 *
 * Single source of truth for all wallet deductions across:
 *   - K9000 kiosk redemption
 *   - Petsitter checkout
 *   - Dog walker checkout
 *   - Academy checkout
 *   - PetTrek (future)
 *
 * ARCHITECTURE RULES:
 *   - All balance reads/writes go through PostgreSQL ONLY (no Firestore for balances)
 *   - Deduction is atomic via DB UPDATE + INSERT in one function
 *   - computeDeductionOrder is a pure function — no side effects
 *   - Every deduction produces a credit_transactions ledger row
 *
 * DEDUCTION ORDER (spec-compliant):
 *   1. Promo credits (expires soonest — cheapest to the business)
 *   2. eGift / Gift balance
 *   3. Package washes (kiosk free-wash path: 1 unit = 1 wash)
 *   4. Cash wallet balance
 *   5. Card fallback (shortfall returned to caller — NOT handled here)
 */

import { db } from '../db';
import { walletAccounts, creditTransactions } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { randomBytes } from 'crypto';
import { deductFromWallet, topUpWithLedger } from './WalletLedger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletBalances {
  cashWalletBalanceCents:        number;
  egiftBalanceCents:             number;
  washPackageCredits:            number;
  packageServiceUnitsRemaining:  number;
  promoBalanceCents:             number;
  referralBalanceCents:          number;
  loyaltyPointsBalance:          number;
  loyaltyTier:                   string;
  walletId:                      string;
}

export interface DeductionBreakdown {
  promo:           number;   // promo credits consumed (cents)
  gift:            number;   // egift/gift balance consumed (cents)
  package:         number;   // wash package units consumed (count)
  wallet:          number;   // cash wallet consumed (cents)
  cardFallback:    number;   // remaining shortfall requiring card (cents)
  totalCovered:    number;   // total cents covered by wallet
  ok:              boolean;  // true = fully covered without card
  shortfall:       number;   // cents remaining after all wallet sources
  washDeducted:    boolean;  // true = one wash unit was consumed (kiosk free-wash)
  serviceDeducted: boolean;  // true = one service unit was consumed
}

export interface DeductionContext {
  userId:           string;
  amountCents:      number;        // 0 for kiosk free-wash
  isKioskWash:      boolean;       // true enables wash-unit path
  serviceType?:     string;        // 'sitter' | 'walker' | 'academy' | 'k9000'
  bookingId?:       string;
  machineId?:       string;
  bayId?:           string;
  description?:     string;
  // Anti-fraud fields (pass these from every endpoint that calls applyDeduction)
  idempotencyKey?:  string;        // X-Idempotency-Key header or jti-derived key
  jti?:             string;        // JWT ID from QR token
  ipAddress?:       string | null;
  userAgent?:       string | null;
  staffId?:         string;        // if action initiated by staff POS
  endpoint?:        string;
  // Division tracking — required for cross-platform financial reporting
  divisionCode?:    string;        // station_k9000 | petsitter | walkers | academy | gift_card | admin
  sourceType?:      string;        // k9000_wash | booking | academy | reward | topup | manual
}

export interface DeductionResult {
  txnId:              string;
  walletId:           string;
  breakdown:          DeductionBreakdown;
  balanceAfter:       WalletBalances;
  // Convenience shorthand fields used by prestige-pass.ts routes
  newCashWalletCents: number;
  deductedCents:      number;
  source:             string;
  idempotent:         boolean;
}

// ─── Pure computation — no side effects ──────────────────────────────────────

export function computeDeductionOrder(
  balances: Pick<WalletBalances,
    'promoBalanceCents' | 'egiftBalanceCents' | 'washPackageCredits' |
    'cashWalletBalanceCents' | 'packageServiceUnitsRemaining'
  >,
  amountCents: number,
  isKioskWash: boolean,
): DeductionBreakdown {
  // Kiosk free-wash: consume 1 package wash unit, no monetary deduction
  if (isKioskWash && amountCents === 0 && balances.washPackageCredits > 0) {
    return {
      promo: 0, gift: 0, package: 1, wallet: 0,
      cardFallback: 0, totalCovered: 0,
      ok: true, shortfall: 0,
      washDeducted: true, serviceDeducted: false,
    };
  }

  let remaining = amountCents;

  // 1. Promo credits (expires first)
  const promoUse = Math.min(balances.promoBalanceCents, remaining);
  remaining -= promoUse;

  // 2. eGift / Gift balance
  const giftUse = Math.min(balances.egiftBalanceCents, remaining);
  remaining -= giftUse;

  // 3. Package wash (discrete units, only converted to value on kiosk path with amountCents>0)
  //    For non-kiosk services: package units stay reserved, only used via explicit kiosk path
  const packageUse = 0;

  // 4. Cash wallet
  const walletUse = Math.min(balances.cashWalletBalanceCents, remaining);
  remaining -= walletUse;

  const cardFallback = Math.max(0, remaining);
  const totalCovered = promoUse + giftUse + walletUse;

  return {
    promo:           promoUse,
    gift:            giftUse,
    package:         packageUse,
    wallet:          walletUse,
    cardFallback,
    totalCovered,
    ok:              cardFallback === 0,
    shortfall:       cardFallback,
    washDeducted:    false,
    serviceDeducted: false,
  };
}

// ─── Balance reader ───────────────────────────────────────────────────────────

export async function getWalletBalances(userId: string): Promise<WalletBalances | null> {
  const [row] = await db
    .select()
    .from(walletAccounts)
    .where(eq(walletAccounts.userId, userId))
    .limit(1);

  if (!row) return null;

  return {
    cashWalletBalanceCents:       row.cashWalletBalanceCents       ?? 0,
    egiftBalanceCents:            row.egiftBalanceCents             ?? 0,
    washPackageCredits:           row.washPackageCredits            ?? 0,
    packageServiceUnitsRemaining: row.packageServiceUnitsRemaining  ?? 0,
    promoBalanceCents:            row.promoBalanceCents             ?? 0,
    referralBalanceCents:         row.referralBalanceCents          ?? 0,
    loyaltyPointsBalance:         row.loyaltyPointsBalance          ?? 0,
    loyaltyTier:                  row.loyaltyTier                   ?? 'bronze',
    walletId:                     row.walletId,
  };
}

export async function getOrCreateWallet(userId: string): Promise<WalletBalances> {
  const existing = await getWalletBalances(userId);
  if (existing) return existing;

  const walletId = `WALLET-${userId.slice(0, 8).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  await db.insert(walletAccounts).values({
    walletId,
    userId,
    cashWalletBalanceCents:       0,
    egiftBalanceCents:            0,
    washPackageCredits:           0,
    packageServiceUnitsRemaining: 0,
    promoBalanceCents:            0,
    referralBalanceCents:         0,
    loyaltyPointsBalance:         0,
    loyaltyTier:                  'bronze',
    isActive:                     true,
  });

  return (await getWalletBalances(userId))!;
}

// ─── Atomic deduction ────────────────────────────────────────────────────────

/**
 * Atomically deduct from wallet balances and write ledger entry.
 * Throws if insufficient balance and no card fallback permitted.
 * Returns full breakdown + updated balances.
 */
export async function applyDeduction(ctx: DeductionContext): Promise<DeductionResult> {
  // ── Delegate to WalletLedger for full anti-fraud protection ─────────────────
  // This provides: DB transaction + FOR UPDATE lock + idempotency + hash chain +
  // JTI registry + velocity limiting + fraud logging + double-entry ledger.
  const ledgerResult = await deductFromWallet({
    userId:          ctx.userId,
    amountCents:     ctx.amountCents,
    isKioskWash:     ctx.isKioskWash,
    serviceType:     ctx.serviceType,
    bookingId:       ctx.bookingId,
    machineId:       ctx.machineId,
    bayId:           ctx.bayId,
    description:     ctx.description,
    idempotencyKey:  ctx.idempotencyKey,
    jti:             ctx.jti,
    ipAddress:       ctx.ipAddress,
    userAgent:       ctx.userAgent,
    staffId:         ctx.staffId,
    endpoint:        ctx.endpoint,
    divisionCode:    ctx.divisionCode,
    sourceType:      ctx.sourceType,
  });

  // Keep creditTransactions as a compatibility / reporting layer
  // (WalletLedger is the truth; creditTransactions is the legacy reporting view)
  try {
    const serviceLabel = ctx.isKioskWash ? 'kiosk_wash' : (ctx.serviceType || 'online');
    const txnId        = `TXN-${ctx.isKioskWash ? 'KSK' : 'ONL'}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    await db.insert(creditTransactions).values({
      transactionId:     txnId,
      walletId:          ledgerResult.walletId,
      creditType:        ledgerResult.breakdown.washDeducted ? 'wash_package' : 'mixed_redeem',
      transactionType:   'redeem',
      amountCents:       ledgerResult.breakdown.washDeducted ? null : -(ledgerResult.breakdown.totalCovered),
      amountUnits:       ledgerResult.breakdown.washDeducted ? -1 : null,
      balanceAfterCents: ledgerResult.balanceAfterCents.cashWallet + ledgerResult.balanceAfterCents.egift + ledgerResult.balanceAfterCents.promo,
      sourceType:        'redemption',
      platform:          serviceLabel,
      serviceType:       ctx.serviceType,
      bookingId:         ctx.bookingId,
      initiatedBy:       ctx.staffId ? 'staff' : 'user',
      initiatedByUserId: ctx.userId,
      description:       ctx.description || `Prestige Pass redemption — ${serviceLabel}`,
      metadata:          { machineId: ctx.machineId, bayId: ctx.bayId, ledgerEntryId: ledgerResult.txnId, breakdown: ledgerResult.breakdown } as any,
    });
  } catch (err) {
    // Non-fatal: WalletLedger is truth, creditTransactions is reporting
    logger.warn('[WalletEngine] creditTransactions compatibility write failed (non-fatal)', err);
  }

  // Build backward-compatible balanceAfter shape
  const balanceAfter: WalletBalances = {
    cashWalletBalanceCents:       ledgerResult.balanceAfterCents.cashWallet,
    egiftBalanceCents:            ledgerResult.balanceAfterCents.egift,
    promoBalanceCents:            ledgerResult.balanceAfterCents.promo,
    washPackageCredits:           ledgerResult.balanceAfterCents.washPackages,
    packageServiceUnitsRemaining: 0,
    referralBalanceCents:         0,
    loyaltyPointsBalance:         0,
    loyaltyTier:                  'bronze',
    walletId:                     ledgerResult.walletId,
  };

  // Determine source label for routes
  const bd = ledgerResult.breakdown;
  const source = bd.washDeducted ? 'package_wash'
    : bd.totalCovered < ctx.amountCents ? 'partial_mixed'
    : bd.promo > 0 && bd.gift === 0 && bd.wallet === 0 ? 'promo_credit'
    : bd.gift > 0 && bd.promo === 0 && bd.wallet === 0 ? 'egift'
    : bd.wallet > 0 && bd.promo === 0 && bd.gift === 0 ? 'cash_wallet'
    : 'mixed';

  return {
    txnId:              ledgerResult.txnId,
    walletId:           ledgerResult.walletId,
    breakdown:          ledgerResult.breakdown,
    balanceAfter,
    newCashWalletCents: ledgerResult.balanceAfterCents.cashWallet,
    deductedCents:      ledgerResult.breakdown.totalCovered,
    source,
    idempotent:         ledgerResult.idempotent,
  };
}

/**
 * Credit cash to wallet (top-up from payment).
 */
export async function topUpCashWallet(
  userId: string,
  amountCents: number,
  sourceType: string,
  sourceId?: string,
  opts?: { idempotencyKey?: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<{ txnId: string; newBalanceCents: number }> {
  await getOrCreateWallet(userId);

  // ── Use WalletLedger for atomic top-up with double-entry + idempotency ──────
  const ledgerResult = await topUpWithLedger({
    userId,
    amountCents,
    sourceType,
    sourceId,
    idempotencyKey: opts?.idempotencyKey,
    ipAddress:      opts?.ipAddress ?? null,
    userAgent:      opts?.userAgent ?? null,
  });

  // Compatibility write to creditTransactions (reporting layer)
  try {
    const txnId = `TXN-TOP-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const [current] = await db.select({ walletId: walletAccounts.walletId })
      .from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);
    await db.insert(creditTransactions).values({
      transactionId:     txnId,
      walletId:          current?.walletId ?? ledgerResult.txnId,
      creditType:        'cash_wallet',
      transactionType:   'issue',
      amountCents,
      balanceAfterCents: ledgerResult.newBalanceCents,
      sourceType,
      sourceId,
      initiatedBy:       'user',
      initiatedByUserId: userId,
      description:       `Cash wallet top-up — ₪${(amountCents / 100).toFixed(2)}`,
    });
  } catch (err) {
    logger.warn('[WalletEngine] creditTransactions topUp compat write failed (non-fatal)', err);
  }

  return { txnId: ledgerResult.txnId, newBalanceCents: ledgerResult.newBalanceCents };
}

/**
 * Credit wash packages (from purchase).
 */
export async function creditWashPackage(
  userId: string,
  units: number,
  sourceId?: string,
): Promise<{ txnId: string; newUnits: number }> {
  const wallet = await getOrCreateWallet(userId);

  await db
    .update(walletAccounts)
    .set({
      washPackageCredits: sql`${walletAccounts.washPackageCredits} + ${units}`,
      updatedAt: new Date(),
    })
    .where(eq(walletAccounts.userId, userId));

  const txnId = `TXN-PKG-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

  await db.insert(creditTransactions).values({
    transactionId:    txnId,
    walletId:         wallet.walletId,
    creditType:       'wash_package',
    transactionType:  'issue',
    amountCents:      null,
    amountUnits:      units,
    balanceAfterUnits: wallet.washPackageCredits + units,
    sourceType:       'purchase',
    sourceId,
    initiatedBy: 'user',
    initiatedByUserId: userId,
    description: `Wash package credited — ${units} wash(es)`,
  });

  return { txnId, newUnits: wallet.washPackageCredits + units };
}

/**
 * Manual admin credit (promo, egift, cash, or package).
 */
export async function adminManualCredit(params: {
  userId:       string;
  creditType:   'promo' | 'egift' | 'cash' | 'wash_package';
  amountCents?: number;
  units?:       number;
  reason:       string;
  adminUserId:  string;
}): Promise<{ txnId: string }> {
  const wallet = await getOrCreateWallet(params.userId);
  const updates: Partial<typeof walletAccounts.$inferSelect> = { updatedAt: new Date() };

  if (params.creditType === 'promo' && params.amountCents) {
    updates.promoBalanceCents = sql`${walletAccounts.promoBalanceCents} + ${params.amountCents}` as any;
  } else if (params.creditType === 'egift' && params.amountCents) {
    updates.egiftBalanceCents = sql`${walletAccounts.egiftBalanceCents} + ${params.amountCents}` as any;
  } else if (params.creditType === 'cash' && params.amountCents) {
    updates.cashWalletBalanceCents = sql`${walletAccounts.cashWalletBalanceCents} + ${params.amountCents}` as any;
  } else if (params.creditType === 'wash_package' && params.units) {
    updates.washPackageCredits = sql`${walletAccounts.washPackageCredits} + ${params.units}` as any;
  }

  await db.update(walletAccounts).set(updates).where(eq(walletAccounts.userId, params.userId));

  const txnId = `TXN-ADM-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

  await db.insert(creditTransactions).values({
    transactionId:   txnId,
    walletId:        wallet.walletId,
    creditType:      params.creditType === 'wash_package' ? 'wash_package' : params.creditType,
    transactionType: 'adjust',
    amountCents:     params.amountCents ?? null,
    amountUnits:     params.units ?? null,
    sourceType:      'admin',
    initiatedBy:     'admin',
    initiatedByUserId: params.adminUserId,
    description:     `Admin credit — ${params.reason}`,
  });

  return { txnId };
}
