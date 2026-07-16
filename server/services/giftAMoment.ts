/**
 * Gift a Moment (Prestige task #16, final slice).
 *
 * The thinnest truthful version of "gift a moment": a member redeems a reward
 * with their OWN points exactly as before — same transaction, same guards,
 * same voucher — and the REWARD-* voucher is delivered to a recipient they
 * choose instead of (only) themselves.
 *
 * DELIBERATELY NOT: a points transfer, a new balance mechanic, or a schema
 * change. No value moves that didn't move before; the voucher stays
 * single-use, expiring, and human-fulfilled (#1431 rails). The gift is
 * recorded on the redemption's `notes` so the fulfillment queue shows who
 * the moment belongs to.
 *
 * Email delivery is FAIL-OPEN: if the send fails the redemption stands and
 * the member still holds the voucher code to share manually — a mail outage
 * must never eat someone's points.
 */

export interface GiftRequest {
  recipientName: string;
  recipientEmail: string;
  message?: string;
}

export type GiftValidation =
  | { ok: true; gift: GiftRequest }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Validate the optional gift block of a redeem request. Never throws. */
export function validateGift(raw: unknown): GiftValidation {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Invalid gift payload' };
  const g = raw as Record<string, unknown>;

  const recipientName = typeof g.recipientName === 'string' ? g.recipientName.trim() : '';
  if (!recipientName || recipientName.length > 80) {
    return { ok: false, error: 'Recipient name is required (max 80 chars)' };
  }

  const recipientEmail = typeof g.recipientEmail === 'string' ? g.recipientEmail.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(recipientEmail) || recipientEmail.length > 254) {
    return { ok: false, error: 'A valid recipient email is required' };
  }

  let message: string | undefined;
  if (g.message !== undefined && g.message !== null) {
    if (typeof g.message !== 'string') return { ok: false, error: 'Invalid gift message' };
    message = g.message.trim().slice(0, 280) || undefined;
  }

  return { ok: true, gift: { recipientName, recipientEmail, message } };
}

/** The line stored on user_redemptions.notes so admins see it's a gift. */
export function giftNoteLine(gift: GiftRequest): string {
  const base = `GIFT → ${gift.recipientName} <${gift.recipientEmail}>`;
  return gift.message ? `${base} — "${gift.message}"` : base;
}

export interface GiftEmailParams {
  gift: GiftRequest;
  senderName: string;      // display name of the gifting member
  rewardName: string;
  voucherCode: string;
  expiresAt: Date | null;
}

/**
 * Restrained white/black/gold gift email, Hebrew-first with English below.
 * Truth rules: states only what is real — the reward name, the code, the
 * expiry, and that fulfillment happens with our team. No discount claims.
 */
export function buildGiftEmail(p: GiftEmailParams): { subject: string; html: string } {
  const gold = '#D4AF37';
  const expiryHe = p.expiresAt ? p.expiresAt.toLocaleDateString('he-IL') : null;
  const expiryEn = p.expiresAt ? p.expiresAt.toLocaleDateString('en-GB') : null;
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const subject = `🎁 ${esc(p.senderName)} sent you a PetWash Prestige moment`;

  const html = `
  <div style="background:#ffffff;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#0a0a0a;">
    <div style="max-width:560px;margin:0 auto;border:1px solid #eee;">
      <div style="background:#0a0a0a;padding:28px;text-align:center;">
        <div style="color:${gold};font-size:12px;letter-spacing:4px;text-transform:uppercase;">PetWash&trade; Prestige</div>
        <div style="color:#ffffff;font-size:22px;margin-top:10px;font-family:Georgia,serif;">🎁 קיבלת רגע במתנה</div>
      </div>
      <div style="padding:28px;" dir="rtl">
        <p style="font-size:15px;line-height:1.7;margin:0 0 6px;">שלום ${esc(p.gift.recipientName)},</p>
        <p style="font-size:15px;line-height:1.7;margin:0;">
          <strong>${esc(p.senderName)}</strong> העניק/ה לך במתנה: <strong>${esc(p.rewardName)}</strong>.
        </p>
        ${p.gift.message ? `<p style="font-size:14px;line-height:1.7;color:#555;margin:14px 0 0;border-right:2px solid ${gold};padding-right:12px;">"${esc(p.gift.message)}"</p>` : ''}
        <div style="text-align:center;margin:26px 0;">
          <div style="display:inline-block;border:1px solid ${gold};padding:14px 26px;">
            <div style="font-size:10px;letter-spacing:3px;color:#888;text-transform:uppercase;">קוד שובר · Voucher</div>
            <div style="font-size:18px;font-weight:bold;letter-spacing:1px;margin-top:6px;" dir="ltr">${esc(p.voucherCode)}</div>
          </div>
        </div>
        <p style="font-size:13px;line-height:1.7;color:#555;margin:0;">
          מציגים את הקוד לצוות PetWash למימוש.${expiryHe ? ` בתוקף עד ${expiryHe}.` : ''}
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:22px 0;">
        <p style="font-size:12px;line-height:1.6;color:#888;margin:0;" dir="ltr">
          ${esc(p.senderName)} gifted you <strong>${esc(p.rewardName)}</strong> at PetWash&trade;.
          Present the voucher code above to the PetWash team to redeem.${expiryEn ? ` Valid until ${expiryEn}.` : ''}
        </p>
      </div>
    </div>
  </div>`;

  return { subject, html };
}
