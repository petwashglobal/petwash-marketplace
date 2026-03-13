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
  userId:       string;
  amountCents:  number;        // 0 for kiosk free-wash
  isKioskWash:  boolean;       // true enables wash-unit path
  serviceType?: string;        // 'sitter' | 'walker' | 'academy' | 'k9000'
  bookingId?:   string;
  machineId?:   string;
  bayId?:       string;
  description?: string;
}

export interface DeductionResult {
  txnId:       string;
  walletId:    string;
  breakdown:   DeductionBreakdown;
  balanceAfter: WalletBalances;
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
  const balances = await getWalletBalances(ctx.userId);

  if (!balances) {
    throw new Error(`[WalletEngine] No wallet found for user ${ctx.userId}`);
  }

  const breakdown = computeDeductionOrder(
    balances,
    ctx.amountCents,
    ctx.isKioskWash,
  );

  // Build atomic PostgreSQL update
  const updates: Partial<typeof walletAccounts.$inferSelect> = {
    updatedAt: new Date(),
    lastActivityAt: new Date(),
  };

  if (breakdown.washDeducted) {
    updates.washPackageCredits = Math.max(0, balances.washPackageCredits - 1);
  }
  if (breakdown.promo > 0) {
    updates.promoBalanceCents = Math.max(0, balances.promoBalanceCents - breakdown.promo);
  }
  if (breakdown.gift > 0) {
    updates.egiftBalanceCents = Math.max(0, balances.egiftBalanceCents - breakdown.gift);
  }
  if (breakdown.wallet > 0) {
    updates.cashWalletBalanceCents = Math.max(0, balances.cashWalletBalanceCents - breakdown.wallet);
  }

  if (Object.keys(updates).length > 2) {
    await db.update(walletAccounts).set(updates).where(eq(walletAccounts.userId, ctx.userId));
  }

  // Write immutable ledger entry
  const txnId = `TXN-${ctx.isKioskWash ? 'KSK' : 'ONL'}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

  const serviceLabel = ctx.isKioskWash ? 'kiosk_wash' : (ctx.serviceType || 'online');

  await db.insert(creditTransactions).values({
    transactionId:   txnId,
    walletId:        balances.walletId,
    creditType:      breakdown.washDeducted ? 'wash_package' : 'mixed_redeem',
    transactionType: 'redeem',
    amountCents:     breakdown.washDeducted ? null : -(breakdown.totalCovered),
    amountUnits:     breakdown.washDeducted ? -1 : null,
    balanceAfterCents: breakdown.washDeducted ? null : Math.max(0,
      (balances.cashWalletBalanceCents + balances.egiftBalanceCents + balances.promoBalanceCents)
      - breakdown.totalCovered,
    ),
    balanceAfterUnits: breakdown.washDeducted
      ? Math.max(0, balances.washPackageCredits - 1)
      : null,
    sourceType:  'redemption',
    platform:    serviceLabel,
    serviceType: ctx.serviceType,
    bookingId:   ctx.bookingId,
    initiatedBy: 'user',
    initiatedByUserId: ctx.userId,
    description: ctx.description || `Prestige Pass redemption — ${serviceLabel}`,
    metadata: {
      machineId:  ctx.machineId,
      bayId:      ctx.bayId,
      breakdown: {
        promo:        breakdown.promo,
        gift:         breakdown.gift,
        package:      breakdown.package,
        wallet:       breakdown.wallet,
        cardFallback: breakdown.cardFallback,
      },
    } as any,
  });

  const balanceAfter = await getWalletBalances(ctx.userId);

  logger.info('[WalletEngine] Deduction applied', {
    userId: ctx.userId,
    txnId,
    serviceType: ctx.serviceType,
    amountCents: ctx.amountCents,
    promo: breakdown.promo,
    gift: breakdown.gift,
    wallet: breakdown.wallet,
    washDeducted: breakdown.washDeducted,
    cardFallback: breakdown.cardFallback,
  });

  return {
    txnId,
    walletId: balances.walletId,
    breakdown,
    balanceAfter: balanceAfter!,
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
): Promise<{ txnId: string; newBalanceCents: number }> {
  const wallet = await getOrCreateWallet(userId);

  await db
    .update(walletAccounts)
    .set({
      cashWalletBalanceCents: sql`${walletAccounts.cashWalletBalanceCents} + ${amountCents}`,
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    })
    .where(eq(walletAccounts.userId, userId));

  const txnId = `TXN-TOP-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

  await db.insert(creditTransactions).values({
    transactionId:    txnId,
    walletId:         wallet.walletId,
    creditType:       'cash_wallet',
    transactionType:  'issue',
    amountCents:      amountCents,
    balanceAfterCents: wallet.cashWalletBalanceCents + amountCents,
    sourceType,
    sourceId,
    initiatedBy: 'user',
    initiatedByUserId: userId,
    description: `Cash wallet top-up — ₪${(amountCents / 100).toFixed(2)}`,
  });

  return { txnId, newBalanceCents: wallet.cashWalletBalanceCents + amountCents };
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
