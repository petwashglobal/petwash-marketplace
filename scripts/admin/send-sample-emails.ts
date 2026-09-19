/**
 * Sample customer emails — "what does a customer actually receive?"
 *
 * Renders the PRODUCTION email templates with clearly fake data and sends
 * each one to the address you name, through the same sender the live service
 * uses (server/email/luxury-email-service.ts → SendGrid, from
 * noreply@petwash.co.il). No booking, order, voucher, charge or database row
 * is created. Every subject starts with [SAMPLE].
 *
 * Run from the Actions tab: ".github/workflows/diagnose-email-samples.yml".
 *
 * Env:
 *   TARGET_EMAIL  — required unless DRY_RUN
 *   LOCALE        — he | en (default he)
 *   DRY_RUN       — "1": render only, write each HTML to DRY_RUN_DIR, send nothing
 *   DRY_RUN_DIR   — directory for the rendered files (default ./.email-samples)
 *   SENDGRID_API_KEY — as in production (the sender reads it)
 *
 * Exit 0 only when every sample was sent (or rendered, in DRY_RUN). Exit 1
 * otherwise, naming the sample and the error.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

type Locale = 'he' | 'en';
type Sample = { key: string; label: string; subject: string; html: string };

const PREFIX = '[SAMPLE] ';
const BASE = process.env.BASE_URL || 'https://petwash.co.il';

function mask(s: string | undefined): string {
  if (!s || !s.includes('@')) return '(none)';
  const [u, d] = s.split('@');
  return `${u.slice(0, 2)}***@${d}`;
}

/** Sample people and pets. Names are invented; nothing here is a real customer. */
function people(locale: Locale) {
  const he = locale === 'he';
  return {
    customerFirst: he ? 'נועה' : 'Noa',
    customerLast: he ? 'לוי' : 'Levi',
    customerName: he ? 'נועה לוי' : 'Noa Levi',
    sitter: he ? 'דנה כהן' : 'Dana Cohen',
    walker: he ? 'יובל שמש' : 'Yuval Shemesh',
    trainer: he ? 'רון אברהמי' : 'Ron Avrahami',
    pet: he ? 'לונה' : 'Luna',
    breed: he ? 'גולדן רטריבר' : 'Golden Retriever',
    giftRecipient: he ? 'תמר' : 'Tamar',
  };
}

export async function buildSamples(locale: Locale, targetEmail: string): Promise<Sample[]> {
  const he = locale === 'he';
  const p = people(locale);
  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * 86_400_000);
  const dateFormatted = inThreeDays.toLocaleDateString(he ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const deadline = new Date(inThreeDays.getTime() - 48 * 3600_000).toLocaleDateString(he ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const { buildBookingConfirmationEmail } = await import('../../server/email/templates/booking-confirmation-2026');
  const { buildProviderTxReceipt } = await import('../../server/email/templates/transaction-receipt-2026');
  const { buildPaymentConfirmationEmail } = await import('../../server/email/templates/payment-confirmation-2026');
  const { shopOrderConfirmation } = await import('../../server/email/templates/shop-order-confirmation-2026');
  const { generateEGiftPurchaseConfirmation } = await import('../../server/email/templates/egift-purchase-confirmation-2026');
  const { generateEGiftActivationEmail } = await import('../../server/email/templates/egift-activation-2026');
  const { generateMembershipConfirmationEmail } = await import('../../server/email/templates/membership-confirmation-2026');
  const { generateCustomerWelcomeEmail } = await import('../../server/email/templates/welcome-customer-signup-2026');

  const samples: Sample[] = [];

  // 1. The Sitter Suite — booking confirmed (customer copy)
  {
    const ref = 'PW-SAMPLE-SIT-0001';
    samples.push({
      key: 'sitter-booking-confirmed',
      label: he ? 'Sitter Suite — אישור הזמנה' : 'Sitter Suite — booking confirmed',
      subject: PREFIX + (he ? `אישור הזמנה ⁦PetWash™⁩ — ${ref}` : `Booking Confirmed — ${ref}`),
      html: buildBookingConfirmationEmail({
        recipientType: 'customer', language: locale, bookingRef: ref,
        customerName: p.customerFirst, providerName: p.sitter,
        serviceName: 'pet_sitting', serviceLabel: he ? 'שמירה בבית הסיטר · 3 לילות' : 'Overnight sitting · 3 nights',
        petName: p.pet, petBreed: p.breed,
        dateFormatted, timeFormatted: '10:00',
        locationName: he ? 'בית הסיטר, רמת גן' : "Sitter's home, Ramat Gan",
        // No durationMinutes: the template prints it as "(N min)", which for a
        // three-night stay reads "(4320 min)". The service label carries the length.
        priceFormatted: '₪540.00', vatFormatted: he ? 'כולל מע״מ' : 'VAT incl.',
        loyaltyPointsEarned: 54, cancellationDeadline: deadline,
        dashboardUrl: `${BASE}/pet-parent/home`,
      }),
    });
  }

  // 2. Walk My Pet — booking confirmed (customer copy)
  {
    const ref = 'PW-SAMPLE-WALK-0002';
    samples.push({
      key: 'walk-booking-confirmed',
      label: he ? 'Walk My Pet — אישור הזמנה' : 'Walk My Pet — booking confirmed',
      subject: PREFIX + (he ? `אישור הזמנה ⁦PetWash™⁩ — ${ref}` : `Booking Confirmed — ${ref}`),
      html: buildBookingConfirmationEmail({
        recipientType: 'customer', language: locale, bookingRef: ref,
        customerName: p.customerFirst, providerName: p.walker,
        serviceName: 'dog_walking', serviceLabel: he ? 'טיול פרימיום · 60 דקות' : 'Premium walk · 60 minutes',
        petName: p.pet, petBreed: p.breed,
        dateFormatted, timeFormatted: '17:30',
        locationName: he ? 'איסוף מהבית' : 'Pick-up from home',
        locationAddress: he ? 'רחוב הרצל 12, תל אביב' : '12 Herzl St, Tel Aviv',
        durationMinutes: 60,
        priceFormatted: '₪90.00', vatFormatted: he ? 'כולל מע״מ' : 'VAT incl.',
        loyaltyPointsEarned: 9, cancellationDeadline: deadline,
        dashboardUrl: `${BASE}/pet-parent/home`,
      }),
    });
  }

  // 3. Academy — the receipt after a paid lesson (customer copy)
  samples.push({
    key: 'academy-receipt',
    label: he ? 'Academy — קבלה על שיעור' : 'Academy — lesson receipt',
    subject: PREFIX + (he ? 'קבלה · שיעור אילוף PetWash™ Academy' : 'Receipt · PetWash™ Academy lesson'),
    html: buildProviderTxReceipt({
      invoiceNo: 'SAMPLE-20001', txId: 'SAMPLE-TXN-ACAD-0003', date: now, serviceDate: inThreeDays,
      serviceType: 'academy',
      serviceDescHe: 'שיעור אילוף פרטי · 60 דקות', serviceDescEn: 'Private training lesson · 60 minutes',
      providerName: p.trainer, petName: p.pet, petBreed: p.breed,
      customerName: p.customerName, customerEmail: targetEmail,
      grossChargedIls: 220, platformFeeRate: 0.15,
      paymentLast4: '4242', paymentBrand: 'Visa',
      bookingRef: 'PW-SAMPLE-ACAD-0003', durationLabel: he ? '60 דקות' : '60 minutes',
      language: locale,
    }),
  });

  // 4. Payment letter — what every SUMIT card payment sends
  {
    const letter = buildPaymentConfirmationEmail({
      language: locale, customerName: p.customerFirst, amountIls: 90, cardLast4: '4242',
      itemDescription: he ? 'טיול עם הכלב · Walk My Pet' : 'Dog walk · Walk My Pet',
      paidAt: now, reference: 'PW-SAMPLE-WALK-0002',
      documentUrl: `${BASE}/account/transactions`,
      buttonText: he ? 'התשלומים והמסמכים שלי' : 'Your payments & documents',
    });
    samples.push({ key: 'payment-letter', label: he ? 'מכתב תשלום (אחרי כל תשלום בכרטיס)' : 'Payment letter (after every card payment)', subject: PREFIX + letter.subject, html: letter.html });
  }

  // 5. Shop — order confirmation
  {
    const orderNo = 'SAMPLE-10042';
    samples.push({
      key: 'shop-order',
      label: he ? 'Shop — אישור הזמנה' : 'Shop — order confirmation',
      subject: PREFIX + (he ? `אישור הזמנה #${orderNo} — PetWash™ Shop` : `Order Confirmation #${orderNo} — PetWash™ Shop`),
      html: shopOrderConfirmation({
        orderId: orderNo, customerName: p.customerName, customerEmail: targetEmail,
        items: [
          { name_he: 'קולר עור עם חריטה', name_en: 'Engraved leather collar', sku: 'SAMPLE-COLLAR', quantity: 1, unit_price_cents: 18900, line_total_cents: 18900, variant_name_he: 'M · חום' },
          { name_he: 'חטיפי עוף טבעיים', name_en: 'Natural chicken treats', sku: 'SAMPLE-TREAT', quantity: 2, unit_price_cents: 3900, line_total_cents: 7800 },
        ],
        subtotalCents: 26700, discountCents: 0, deliveryCents: 0, giftWrapCents: 990,
        netCents: 23496, vatCents: 4194, totalCents: 27690,
        paymentMethod: he ? 'כרטיס אשראי' : 'Credit card', paymentRef: 'SAMPLE-TXN-SHOP-0005',
        deliveryMethod: he ? 'דואר ישראל · משלוח חינם מעל ₪150' : 'Israel Post · free over ₪150',
        estimatedDelivery: inThreeDays.toISOString(),
        deliveryAddress: { fullName: p.customerName, street: he ? 'הרצל' : 'Herzl', streetNumber: '12', apartment: '4', city: he ? 'תל אביב' : 'Tel Aviv', zipCode: '6688312', phone: '05x-xxxxxxx', notes: he ? 'להשאיר אצל השכן אם אין מענה' : 'Leave with neighbour if no answer' },
        language: locale, orderDate: now.toISOString(),
      }),
    });
  }

  // 6. eGift — the buyer's purchase confirmation
  {
    const e = generateEGiftPurchaseConfirmation({
      buyerName: p.customerName, buyerEmail: targetEmail, recipientName: p.giftRecipient,
      giftValue: 250, currency: 'ILS', voucherId: 'SAMPLE-VCH-0006', transactionHash: 'SAMPLE-TXN-EGIFT-0006',
      personalMessage: he ? 'מזל טוב על הגור החדש! 🐾' : 'Congratulations on the new puppy! 🐾',
      deliveryMethod: 'email', language: locale,
    });
    samples.push({ key: 'egift-purchase', label: he ? 'eGift — אישור רכישה (לקונה)' : 'eGift — purchase confirmation (buyer)', subject: PREFIX + e.subject, html: e.html });
  }

  // 7. eGift — the recipient's gift / credit email
  {
    const e = generateEGiftActivationEmail({
      recipientName: p.giftRecipient, recipientEmail: targetEmail, senderName: p.customerName,
      giftValue: 250, currency: 'ILS', giftCode: 'SAMPLE-GIFT-CODE', serialNumber: 'SAMPLE-SERIAL-0007',
      personalMessage: he ? 'מזל טוב על הגור החדש! 🐾' : 'Congratulations on the new puppy! 🐾',
      expiresAt: new Date(now.getTime() + 5 * 365 * 86_400_000).toISOString(), language: locale,
    });
    samples.push({ key: 'egift-recipient', label: he ? 'eGift — המתנה שמגיעה למקבל' : 'eGift — what the recipient receives', subject: PREFIX + e.subject, html: e.html });
  }

  // 8. Free path — welcome after signup
  {
    const e = generateCustomerWelcomeEmail({ firstName: p.customerFirst, lastName: p.customerLast, email: targetEmail, language: locale, petType: 'dog' });
    samples.push({ key: 'welcome', label: he ? 'ברוכים הבאים (הרשמה חינם)' : 'Welcome (free signup)', subject: PREFIX + e.subject, html: e.html });
  }

  // 9. Free path — Prestige membership confirmed with welcome points
  {
    const e = generateMembershipConfirmationEmail({ firstName: p.customerFirst, email: targetEmail, membershipId: 'SAMPLE-MBR-0009', tier: 'bronze', points: 100, language: locale });
    samples.push({ key: 'membership', label: he ? 'חברות Prestige (הצטרפות חינם, 100 נקודות)' : 'Prestige membership (free join, 100 points)', subject: PREFIX + e.subject, html: e.html });
  }

  return samples;
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1';
  const locale: Locale = process.env.LOCALE === 'en' ? 'en' : 'he';
  const targetEmail = (process.env.TARGET_EMAIL || (dryRun ? 'sample@example.invalid' : '')).trim();
  if (!targetEmail) throw new Error('TARGET_EMAIL is required');

  const samples = await buildSamples(locale, targetEmail);
  const rows: Array<[string, boolean, string]> = [];

  if (dryRun) {
    const dir = process.env.DRY_RUN_DIR || join(process.cwd(), '.email-samples');
    mkdirSync(dir, { recursive: true });
    for (const s of samples) {
      const file = join(dir, `${s.key}.${locale}.html`);
      writeFileSync(file, s.html);
      rows.push([s.label, s.html.length > 500, `${s.html.length} chars → ${file} · subject: ${s.subject}`]);
    }
  } else {
    const { describeSenderAddress } = await import('../../server/lib/sendgrid');
    console.log(`SENDGRID_FROM_EMAIL shape: ${JSON.stringify(describeSenderAddress(process.env.SENDGRID_FROM_EMAIL))}`);
    const { sendLuxuryEmail } = await import('../../server/email/luxury-email-service');
    for (const s of samples) {
      try {
        const ok = await sendLuxuryEmail({ to: targetEmail, subject: s.subject, html: s.html });
        rows.push([s.label, ok, ok ? `sent to ${mask(targetEmail)}` : 'sendLuxuryEmail returned false (see log: SendGrid error or spend guard)']);
      } catch (err: any) {
        rows.push([s.label, false, `threw: ${err?.message || err}`]);
      }
    }
  }

  const failed = rows.filter(([, ok]) => !ok).length;
  const lines = [
    `## 📧 Sample customer emails (${locale})`, '',
    dryRun ? 'DRY RUN — rendered only, nothing sent.' : `Sent ${new Date().toISOString()} to ${mask(targetEmail)} · every subject starts with ${PREFIX.trim()}`, '',
    '| # | Email | Result | Detail |', '|---|---|---|---|',
    ...rows.map(([label, ok, detail], i) => `| ${i + 1} | ${label} | ${ok ? '✅' : '❌'} | ${detail} |`),
    '',
    failed ? `❌ ${failed} of ${rows.length} samples failed.` : `✅ All ${rows.length} samples ${dryRun ? 'rendered' : 'delivered to SendGrid'}. Check the inbox (and Promotions/Spam once).`,
  ];
  const text = lines.join('\n');
  console.log('\n' + text);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n', { flag: 'a' });
  process.exit(failed ? 1 : 0);
}

// Run only when invoked directly (npx tsx scripts/admin/send-sample-emails.ts);
// the test suite imports buildSamples without sending anything.
const invokedDirectly = (() => {
  try { return process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false; } catch { return false; }
})();
if (invokedDirectly) {
  main().catch((err) => {
    console.error(`::error::${err?.message || err}`);
    if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## 📧 Sample customer emails\n\n❌ ${err?.message || err}\n`, { flag: 'a' });
    process.exit(1);
  });
}
