/**
 * legacy-gift-card-redeem-handler.ts
 *
 * CRITICAL FINANCIAL SAFETY — disables the legacy `/api/gift-cards/redeem`
 * route at `server/routes.ts:3597`. That route used to write to
 * `customers.giftCardBalance` (decimal shekels), which is a different
 * ledger from `wallet_accounts.egift_balance_cents` (the modern wallet
 * source of truth). Continuing to use the legacy route ORPHANS customer
 * balances — money credited there cannot be spent at K9000 redemption,
 * marketplace booking deduction, or any modern wallet UI.
 *
 * This module returns 410 GONE for every request and never touches the
 * database. The legacy code is preserved as a comment block in routes.ts
 * for forensic reference — DO NOT DELETE per CEO directive.
 *
 * Modern flow:
 *   POST /api/gift-cards/purchase
 *     → creates an `e_vouchers` row after Nayax payment confirmation
 *   POST /api/gift-cards/:voucherId/activate-wallet
 *     → credits `walletAccounts.egiftBalanceCents`
 */
import type { Request, Response } from 'express';

export function legacyGiftCardRedeemHandler(_req: Request, res: Response) {
  return res.status(410).json({
    error: 'GONE',
    code: 'LEGACY_GIFT_CARD_REDEEM_DISABLED',
    message:
      'This legacy gift-card redemption endpoint has been disabled to prevent ' +
      'orphan customer balances. Use the modern flow: ' +
      'POST /api/gift-cards/purchase → POST /api/gift-cards/:voucherId/activate-wallet.',
    messageHe:
      'נקודת קצה זו של מימוש כרטיס מתנה הוסרה כדי למנוע יתרות מבודדות. ' +
      'אנא השתמש במסלול החדש של ארנק דיגיטלי.',
    docs: 'See /api/gift-cards/purchase and /api/gift-cards/:voucherId/activate-wallet',
  });
}
