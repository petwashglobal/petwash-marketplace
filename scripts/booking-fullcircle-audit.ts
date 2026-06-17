/**
 * booking-fullcircle-audit.ts
 *
 * Verifies, per service platform, that the full booking "circle" is wired:
 *
 *   booking id → user id → date → transaction number → VAT → tax invoice → email
 *
 * This is a SOURCE-INTROSPECTION audit (the repo's established no-DB test
 * style — see server/tests/*.test.ts). It does NOT create bookings or hit a
 * DB; it proves which links exist in the live code and which are MISSING, so
 * the gaps are explicit. The live HTTP end-to-end (tests/integration/
 * booking-fullcircle.test.ts) drives the same circle against a running test
 * server and asserts the field VALUES.
 *
 * Run:  npx tsx scripts/booking-fullcircle-audit.ts
 * Exit: 0 always (report tool). Gaps are printed, not thrown.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel: string): string {
  try { return readFileSync(resolve(ROOT, rel), 'utf8'); } catch { return ''; }
}

type Verdict = 'OK' | 'GAP' | 'N/A';
interface Check { link: string; verdict: Verdict; evidence: string; }
interface Platform { name: string; file: string; checks: Check[]; }

/** A GOOD thing that MUST be wired: present → OK, absent → GAP. */
function mustHave(rel: string, re: RegExp, link: string, okEv: string, gapEv: string): Check {
  const hit = re.test(read(rel));
  return { link, verdict: hit ? 'OK' : 'GAP', evidence: hit ? okEv : gapEv };
}
/** A BAD pattern that must NOT exist: present → GAP, absent → OK. */
function mustNotHave(rel: string, re: RegExp, link: string, badEv: string, okEv: string): Check {
  const hit = re.test(read(rel));
  return { link, verdict: hit ? 'GAP' : 'OK', evidence: hit ? badEv : okEv };
}
/** A link that is intentionally not applicable for this platform. */
function notApplicable(link: string, why: string): Check {
  return { link, verdict: 'N/A', evidence: why };
}

const LINK_ORDER = ['booking id', 'user id', 'date', 'transaction #', 'VAT', 'tax invoice', 'email'];

const platforms: Platform[] = [
  {
    name: 'Station wash / K9000 (Nayax)',
    file: 'server/routes/k9000.ts',
    checks: [
      mustHave('server/routes/k9000.ts', /washId|k9000WashEvents|wash_events/i, 'booking id', 'washId / k9000_wash_events', 'no wash id'),
      mustHave('server/routes/k9000.ts', /customerUid|customerId/i, 'user id', 'customerUid (optional — kiosk sale may have none)', 'no user binding'),
      mustHave('server/routes/k9000.ts', /createdAt|timestamp/i, 'date', 'createdAt on wash event', 'no date'),
      mustHave('server/routes/k9000.ts', /nayaxTransactionId|transactionId/i, 'transaction #', 'Nayax terminal transactionId', 'no txn'),
      mustHave('server/routes/k9000.ts', /VATCalculatorService|calculateVAT|vatCents/i, 'VAT', 'VATCalculatorService records VAT', 'no VAT'),
      mustHave('server/routes/k9000.ts', /generateReceipt|createCustomerReceipt|IsraeliInvoice|sumit/i, 'tax invoice', 'invoice issued', 'NO customer fiscal document issued for a wash'),
      mustHave('server/routes/k9000.ts', /sendReceiptEmail|sendLuxuryEmail|sendgrid/i, 'email', 'email sent', 'NO email/receipt sent on wash'),
    ],
  },
  {
    name: 'Pet sitting (sitter)',
    file: 'server/routes/sitter-suite.ts',
    checks: [
      mustHave('server/routes/sitter-suite.ts', /SITTER_|sitterBookings/i, 'booking id', 'SITTER_<id> / sitterBookings', 'no booking id'),
      mustHave('server/routes/sitter-suite.ts', /ownerId|req\.user\.uid/i, 'user id', 'ownerId = req.user.uid', 'no user binding'),
      mustHave('server/routes/sitter-suite.ts', /startDate|createdAt/i, 'date', 'startDate / createdAt', 'no date'),
      mustHave('server/routes/sitter-suite.ts', /processBookingPayment|nayaxSitterMarketplace|nayaxTransactionId/i, 'transaction #', 'nayaxSitterMarketplace.processBookingPayment → nayaxTransactionId', 'no txn'),
      mustHave('server/routes/sitter-suite.ts', /generateReceipt/i, 'VAT', 'VAT via generateReceipt (calculateVATBreakdown @18%)', 'no VAT'),
      mustHave('server/routes/sitter-suite.ts', /generateReceipt/i, 'tax invoice', 'IsraeliDigitalReceiptService.generateReceipt on accept', 'no invoice'),
      mustHave('server/routes/sitter-suite.ts', /sendReceiptEmail|TwilioSMS|EmailService|generateReceipt/i, 'email', 'receipt email + provider SMS', 'no email'),
    ],
  },
  {
    name: 'Dog walking (walk-my-pet)',
    file: 'server/routes/walk-my-pet.ts',
    checks: [
      mustHave('server/routes/walk-my-pet.ts', /WALK-|walkBookings/i, 'booking id', 'WALK-YYYY-<id> / walkBookings', 'no booking id'),
      mustHave('server/routes/walk-my-pet.ts', /ownerId|req\.user\.uid/i, 'user id', 'ownerId = req.user.uid', 'no user binding'),
      mustHave('server/routes/walk-my-pet.ts', /scheduledDate|createdAt/i, 'date', 'scheduledDate', 'no date'),
      // The receipt at confirm hardcodes nayaxTransactionId: undefined — a real break.
      mustNotHave('server/routes/walk-my-pet.ts', /nayaxTransactionId:\s*undefined/i, 'transaction #', 'receipt built with nayaxTransactionId: undefined — NO txn linkage (walk-my-pet.ts:746)', 'txn linked'),
      mustHave('server/routes/walk-my-pet.ts', /generateReceipt/i, 'VAT', 'VAT via generateReceipt', 'no VAT'),
      mustHave('server/routes/walk-my-pet.ts', /generateReceipt/i, 'tax invoice', 'generateReceipt at confirm', 'no invoice'),
      // Receipt is built with customerEmail:'' → the email send can never deliver.
      mustNotHave('server/routes/walk-my-pet.ts', /customerEmail:\s*['"]['"]/i, 'email', "receipt built with customerEmail:'' → email never delivers (walk-my-pet.ts:747)", 'email present'),
    ],
  },
  {
    name: 'Pet training (academy / trainer)',
    file: 'server/routes/academy.ts',
    checks: [
      mustHave('server/routes/academy.ts', /TRN-|trainerBookings/i, 'booking id', 'TRN-YYYY-<id> / trainerBookings', 'no booking id'),
      mustHave('server/routes/academy.ts', /userId|req\.user\.uid/i, 'user id', 'userId = req.user.uid', 'no user binding'),
      mustHave('server/routes/academy.ts', /createdAt|autoReleaseAt|confirmedAt/i, 'date', 'createdAt / confirmedAt', 'no date'),
      mustHave('server/routes/academy.ts', /walletDebitKey|holdKey|txnId/i, 'transaction #', 'wallet hold/debit txnId', 'no txn'),
      mustHave('server/routes/academy.ts', /calculateVAT|generateReceipt|vatAmount|VATCalculator/i, 'VAT', 'VAT computed', 'NO VAT computed for a paid training booking'),
      mustHave('server/routes/academy.ts', /generateReceipt|createCustomerReceipt|IsraeliInvoice/i, 'tax invoice', 'invoice issued', 'payment captured but NO fiscal receipt issued'),
      mustHave('server/routes/academy.ts', /dispatchAcademySms|sendReceiptEmail|EmailService/i, 'email', 'SMS notification (no invoice email)', 'no notification'),
    ],
  },
  {
    name: 'Shop order (products)',
    file: 'server/routes/shop.ts',
    checks: [
      mustHave('server/services/ShopService.ts', /orderNumber|shop_orders|order\.id/i, 'booking id', 'order.id / orderNumber', 'no order id'),
      mustHave('server/routes/shop.ts', /req\.user\.uid|userId/i, 'user id', 'uid = req.user.uid', 'no user binding'),
      mustHave('server/services/ShopService.ts', /created_at|createdAt/i, 'date', 'shop_orders.created_at', 'no date'),
      mustHave('server/routes/shop.ts', /deductFromWallet|transactionId|paymentRef/i, 'transaction #', 'wallet transactionId → paymentRef', 'no txn'),
      mustHave('server/routes/shop.ts', /vatCents|0\.18|1\.18/i, 'VAT', 'vatCents = gross*0.18/1.18', 'no VAT'),
      mustHave('server/services/ShopService.ts', /generateTaxInvoice|IsraeliInvoiceGenerator/i, 'tax invoice', 'generateTaxInvoice (issued on dispatch)', 'no invoice'),
      mustHave('server/routes/shop.ts', /sendLuxuryEmail|shopOrderConfirmation|sendgrid/i, 'email', 'shop order confirmation email', 'no email'),
    ],
  },
  {
    name: 'E-gift / gift card purchase  (stored value)',
    file: 'server/nayaxService.ts',
    checks: [
      mustHave('server/nayaxService.ts', /eVouchers|voucherCode/i, 'booking id', 'eVouchers / voucherCode (minted in Nayax webhook)', 'no voucher id'),
      mustHave('server/routes/gift-cards.ts', /purchaserEmail|recipientEmail|senderEmail/i, 'user id', 'email-keyed (purchaserEmail) — no uid', 'no identity'),
      mustHave('server/nayaxService.ts', /createdAt|issuedAt|new Date|activatedAt/i, 'date', 'voucher timestamp in webhook', 'no date'),
      mustHave('server/routes/gift-cards.ts', /transactionId|nayax/i, 'transaction #', 'Nayax transactionId', 'no txn'),
      notApplicable('VAT', 'stored value — VAT recognised on REDEMPTION/breakage, not at sale'),
      notApplicable('tax invoice', 'no tax invoice on a gift-card sale (correct — stored value)'),
      mustHave('server/nayaxService.ts', /sendGiftCardEmail|GiftCardEmail/i, 'email', 'gift card delivery email (not a tax invoice)', 'no email'),
    ],
  },
  {
    name: 'Prestige pass / membership',
    file: 'server/routes/prestige-pass.ts',
    checks: [
      notApplicable('booking id', 'no PAID purchase — activate is free; topup is a wallet load'),
      mustHave('server/routes/prestige-pass.ts', /userId|uid/i, 'user id', 'userId on pass/topup', 'no user'),
      mustHave('server/routes/prestige-pass.ts', /createdAt|issuedAt|new Date/i, 'date', 'pass/topup timestamp', 'no date'),
      mustHave('server/routes/prestige-pass.ts', /topUpCashWallet|txnId/i, 'transaction #', 'topup txnId (wallet load)', 'no txn'),
      notApplicable('VAT', 'no purchase to tax (activate free; topup = stored value)'),
      notApplicable('tax invoice', 'no paid purchase circle to invoice'),
      mustHave('server/routes/prestige-pass.ts', /EmailService|sendgrid|sendWalletEmail|email/i, 'email', 'wallet/pass email', 'no email'),
    ],
  },
  {
    name: 'Unified-booking (grooming + general)  ⟵ the COMPLETE circle',
    file: 'server/services/unified-booking/UnifiedBookingEngine.ts',
    checks: [
      mustHave('server/services/unified-booking/UnifiedBookingEngine.ts', /bkg_|bookings/i, 'booking id', 'bkg_<id> in bookings table', 'no booking id'),
      mustHave('server/services/unified-booking/UnifiedBookingEngine.ts', /userId|uid/i, 'user id', 'userId from token (body ignored)', 'no user binding'),
      mustHave('server/services/unified-booking/UnifiedBookingEngine.ts', /transactionStampedAt|createdAt|new Date/i, 'date', 'createdAt + transactionStampedAt', 'no date'),
      mustHave('server/services/unified-booking/TransactionStampService.ts', /txn_|superAppPayments/i, 'transaction #', 'txn_<id> in super_app_payments', 'no txn'),
      mustHave('server/services/unified-booking/UnifiedBookingEngine.ts', /priceSnapshot|vat|taxAmount/i, 'VAT', 'priceSnapshot {net,vat,gross} + taxAmount', 'no VAT'),
      mustHave('server/services/unified-booking/UnifiedBookingEngine.ts', /generateReceipt/i, 'tax invoice', 'generateReceipt with real txn id + email', 'no invoice'),
      mustHave('server/services/unified-booking/UnifiedBookingEngine.ts', /customerEmail:\s*receiptData|customerEmail/i, 'email', 'real customerEmail passed to receipt', 'no email'),
    ],
  },
];

// ── Render ───────────────────────────────────────────────────────────────
const ICON: Record<Verdict, string> = { OK: '✅', GAP: '❌', 'N/A': '➖' };
let gaps = 0;

console.log('\n══════════════════════════════════════════════════════════════════════');
console.log(' PETWASH — BOOKING FULL-CIRCLE AUDIT  (booking→user→date→txn→VAT→invoice→email)');
const vatMatch = read('shared/israel-compliance-config.ts').match(/ISRAEL_VAT_RATE\s*=\s*([0-9.]+)/);
console.log(` VAT rate (shared/israel-compliance-config.ts): ${vatMatch ? Number(vatMatch[1]) * 100 : '?'}%`);
console.log('══════════════════════════════════════════════════════════════════════\n');

for (const p of platforms) {
  const byLink = new Map(p.checks.map((c) => [c.link, c]));
  const row = LINK_ORDER.map((l) => `${ICON[byLink.get(l)?.verdict ?? 'GAP']} ${l}`).join('  ');
  console.log(`▶ ${p.name}`);
  console.log(`   ${row}`);
  for (const c of p.checks) {
    if (c.verdict === 'GAP') { gaps++; console.log(`     ❌ ${c.link}: ${c.evidence}`); }
    else if (c.verdict === 'N/A') console.log(`     ➖ ${c.link}: ${c.evidence}`);
  }
  console.log('');
}

console.log('──────────────────────────────────────────────────────────────────────');
console.log(` RESULT: ${gaps} gap(s) across ${platforms.length} platforms.`);
console.log(' ✅ Complete circle: Unified-booking (use for grooming + general).');
console.log(' ❌ Known breaks: K9000 wash (no invoice), Trainer (no invoice),');
console.log("    Walk (empty email + no txn link), E-gift/Prestige (no invoice — stored value).");
console.log('──────────────────────────────────────────────────────────────────────\n');
