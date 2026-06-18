/**
 * Commerce OS feature flags — ALL default OFF. Inert: nothing reads these yet.
 * The unified checkout/router/activation roll out one surface at a time behind these,
 * per the 2026-05-26 unified-purchase-lifecycle SDD (one program with the Commerce OS).
 *
 * These are flag KEYS + a default-OFF resolver only. No behaviour is gated yet.
 */

export const COMMERCE_FLAGS = {
  /** Umbrella — nothing in the Commerce OS activates unless this is on. */
  enabled: 'ff.commerce.unified_purchase_lifecycle.enabled',
  routerEnabled: 'ff.payments.router.enabled',
  routerUpayDirect: 'ff.payments.router.upay_direct',
  lifecycleShop: 'ff.purchase.lifecycle.shop',
  lifecycleWalletTopup: 'ff.purchase.lifecycle.wallet_topup',
  lifecycleGiftCards: 'ff.purchase.lifecycle.gift_cards',
  lifecycleBookings: 'ff.purchase.lifecycle.bookings',
  lifecycleFranchise: 'ff.purchase.lifecycle.franchise',
  lifecycleKiosk: 'ff.purchase.lifecycle.kiosk',
  auditUnified: 'ff.purchase.audit_unified',
  notificationsBuyerReceiverSplit: 'ff.notifications.buyer_receiver_split',
} as const;

export type CommerceFlagKey = (typeof COMMERCE_FLAGS)[keyof typeof COMMERCE_FLAGS];

/**
 * Resolve a Commerce OS flag from env. Default OFF — a flag is ON only when its
 * env var (FF_<UPPER_SNAKE> of the key after `ff.`) is exactly 'true'.
 * e.g. ff.commerce.unified_purchase_lifecycle.enabled → FF_COMMERCE_UNIFIED_PURCHASE_LIFECYCLE_ENABLED
 */
export function isCommerceFlagEnabled(flag: CommerceFlagKey, env: NodeJS.ProcessEnv = process.env): boolean {
  const envKey = 'FF_' + flag.replace(/^ff\./, '').replace(/[.\-]/g, '_').toUpperCase();
  return env[envKey] === 'true';
}
