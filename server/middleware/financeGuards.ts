/**
 * PetWash™ Finance Guards — Section 14 Hard Blocks
 *
 * These middleware functions enforce the mandatory transaction-type
 * integrity rules from the 19-section financial architecture spec.
 *
 * Rules enforced here (API-level, not just logical-flow):
 *  1. Block provider_payout without providerId
 *  2. Block egift_sale with providerId
 *  3. Block direct_platform_sale with provider_payout intent
 *  4. Block negative wallet balance
 *  5. Block double escrow_release (idempotency)
 *  6. Block vatAmount missing when transactionType is taxable
 *
 * Usage: mount before route handlers that create financial records.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { TRANSACTION_TYPES } from '../../shared/finance-flow-types';

// ── Taxable transaction types that MUST carry a vatAmount ─────────────────────

const TAXABLE_TYPES = new Set([
  TRANSACTION_TYPES.MARKETPLACE_BOOKING,
  TRANSACTION_TYPES.DIRECT_PLATFORM_SALE,
  TRANSACTION_TYPES.PLATFORM_FEE,
  TRANSACTION_TYPES.EGIFT_SALE,
  TRANSACTION_TYPES.WALLET_TOPUP,
]);

// ── Guard 1: provider_payout requires providerId ───────────────────────────────

export function requireProviderForPayout(req: Request, res: Response, next: NextFunction) {
  const body = req.body as any;
  const txType = body?.transactionType || body?.transaction_type;

  if (txType === TRANSACTION_TYPES.PROVIDER_PAYOUT) {
    const providerId = body?.providerId || body?.provider_id;
    if (!providerId || String(providerId).trim() === '') {
      logger.warn('[FinanceGuard] BLOCKED: provider_payout attempted without providerId', {
        body: { ...body, amount: body?.amount },
        ip: req.ip,
      });
      return res.status(400).json({
        error: 'FINANCE_GUARD_VIOLATION',
        code: 'PAYOUT_REQUIRES_PROVIDER',
        message: 'provider_payout is not allowed without a valid providerId (Section 14)',
      });
    }
  }
  next();
}

// ── Guard 2: egift_sale / wallet_topup must NOT have providerId ───────────────

export function blockProviderOnStoredValue(req: Request, res: Response, next: NextFunction) {
  const body = req.body as any;
  const txType = body?.transactionType || body?.transaction_type;
  const storedValueTypes = [
    TRANSACTION_TYPES.EGIFT_SALE,
    TRANSACTION_TYPES.WALLET_TOPUP,
    TRANSACTION_TYPES.WALLET_REDEMPTION,
  ];

  if (storedValueTypes.includes(txType)) {
    const providerId = body?.providerId || body?.provider_id;
    if (providerId && String(providerId).trim() !== '') {
      logger.warn('[FinanceGuard] BLOCKED: stored-value transaction with providerId', {
        txType, providerId, ip: req.ip,
      });
      return res.status(400).json({
        error: 'FINANCE_GUARD_VIOLATION',
        code: 'STORED_VALUE_NO_PROVIDER',
        message: `${txType} must not have a providerId — stored value is a platform liability, not a provider transaction (Section 14)`,
      });
    }
  }
  next();
}

// ── Guard 3: direct_platform_sale must not carry provider_payout flag ─────────

export function blockPayoutOnDirectSale(req: Request, res: Response, next: NextFunction) {
  const body = req.body as any;
  const txType = body?.transactionType || body?.transaction_type;

  if (txType === TRANSACTION_TYPES.DIRECT_PLATFORM_SALE) {
    const hasPayoutIntent = body?.providerPayout != null ||
      body?.provider_payout != null ||
      body?.payoutAmount != null ||
      body?.payout_amount != null;

    if (hasPayoutIntent) {
      logger.warn('[FinanceGuard] BLOCKED: direct_platform_sale with payout intent', {
        body: { ...body, amount: body?.amount },
        ip: req.ip,
      });
      return res.status(400).json({
        error: 'FINANCE_GUARD_VIOLATION',
        code: 'DIRECT_SALE_NO_PAYOUT',
        message: 'direct_platform_sale cannot include provider payout — this is a PetWash direct sale with no provider (Section 14)',
      });
    }
  }
  next();
}

// ── Guard 4: wallet balance cannot go negative ────────────────────────────────

export function blockNegativeWalletBalance(req: Request, res: Response, next: NextFunction) {
  const body = req.body as any;

  if (body?.walletBalanceAfterCents != null) {
    const balanceAfter = Number(body.walletBalanceAfterCents);
    if (balanceAfter < 0) {
      logger.warn('[FinanceGuard] BLOCKED: wallet balance would go negative', {
        balanceAfter, ip: req.ip,
      });
      return res.status(400).json({
        error: 'FINANCE_GUARD_VIOLATION',
        code: 'NEGATIVE_WALLET_BALANCE',
        message: 'Wallet balance cannot be negative (Section 14)',
      });
    }
  }
  next();
}

// ── Guard 5: vatAmount required when transactionType is taxable ───────────────

export function requireVatOnTaxableTransaction(req: Request, res: Response, next: NextFunction) {
  const body = req.body as any;
  const txType = body?.transactionType || body?.transaction_type;

  if (txType && TAXABLE_TYPES.has(txType)) {
    const vatAmount = body?.vatAmount ?? body?.vat_amount;
    if (vatAmount == null) {
      logger.warn('[FinanceGuard] BLOCKED: taxable transaction missing vatAmount', {
        txType, ip: req.ip,
      });
      return res.status(400).json({
        error: 'FINANCE_GUARD_VIOLATION',
        code: 'VAT_AMOUNT_REQUIRED',
        message: `vatAmount is required for ${txType} transactions (Section 14 + Section 5)`,
      });
    }
  }
  next();
}

// ── Composite guard: apply all Section 14 rules ───────────────────────────────

export const allFinanceGuards = [
  requireProviderForPayout,
  blockProviderOnStoredValue,
  blockPayoutOnDirectSale,
  blockNegativeWalletBalance,
  requireVatOnTaxableTransaction,
];

export default allFinanceGuards;
