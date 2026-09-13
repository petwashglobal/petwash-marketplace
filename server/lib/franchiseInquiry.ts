/**
 * Public franchise inquiry — pure handler logic (2026-09-13 menu dead-end audit).
 *
 * The inline handler in server/routes.ts used to swallow a Firestore write
 * failure and still answer { success: true } — the prospect was told the
 * inquiry was submitted while it was stored nowhere, and nobody at PetWash was
 * told it existed. Now:
 *   1. store fails  → 503 with an honest error (nothing claimed)
 *   2. store works  → notify support by email (fail-soft: the row is the record)
 *   3. every user-supplied field is HTML-escaped before it enters the email
 *
 * Dependencies are injected so the behaviour is testable without Firestore or
 * an email provider (server/tests/menuDeadEnds.regression.test.ts).
 */

export const FRANCHISE_INQUIRY_SUPPORT_EMAIL = 'Support@PetWash.co.il';

export function escapeHtmlForEmail(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface FranchiseInquiryRecord {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  message: string;
  submittedAt: string;
  status: 'new';
}

export interface FranchiseInquiryDeps {
  store: (record: FranchiseInquiryRecord) => Promise<string | void>;
  sendEmail: (params: { to: string; subject: string; html: string }) => Promise<boolean>;
  log: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
  now?: () => Date;
}

export interface FranchiseInquiryResult {
  status: number;
  body: Record<string, unknown>;
}

const MAX = { fullName: 200, email: 254, phone: 32, country: 100, city: 100, message: 10000 } as const;

export async function handleFranchiseInquiry(
  rawBody: unknown,
  deps: FranchiseInquiryDeps,
): Promise<FranchiseInquiryResult> {
  const b = (rawBody ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
  const record: FranchiseInquiryRecord = {
    fullName: str(b.fullName),
    email: str(b.email),
    phone: str(b.phone),
    country: str(b.country),
    city: str(b.city),
    message: str(b.message),
    submittedAt: (deps.now ? deps.now() : new Date()).toISOString(),
    status: 'new',
  };

  if (!record.fullName || !record.email || !record.phone) {
    return { status: 400, body: { error: 'Name, email, and phone are required' } };
  }
  for (const [k, max] of Object.entries(MAX)) {
    if ((record as unknown as Record<string, string>)[k].length > max) {
      return { status: 400, body: { error: 'One or more fields exceed the allowed length' } };
    }
  }

  let storedId: string | void;
  try {
    storedId = await deps.store(record);
  } catch (err) {
    deps.log.error('[Franchise/inquiry] store failed — inquiry NOT saved, answering 503', {
      error: (err as Error)?.message,
    });
    return {
      status: 503,
      body: {
        success: false,
        error: 'We could not save your inquiry right now. Please try again shortly or contact us on WhatsApp.',
      },
    };
  }

  const e = escapeHtmlForEmail;
  const html = `
    <h2>פניית זכיינות חדשה · New franchise inquiry</h2>
    <p><strong>שם · Name:</strong> ${e(record.fullName)}</p>
    <p><strong>אימייל · Email:</strong> ${e(record.email)}</p>
    <p><strong>טלפון · Phone:</strong> ${e(record.phone)}</p>
    <p><strong>מדינה · Country:</strong> ${e(record.country)}</p>
    <p><strong>עיר · City:</strong> ${e(record.city)}</p>
    <p><strong>הודעה · Message:</strong></p>
    <p style="white-space:pre-wrap">${e(record.message)}</p>
    <hr>
    <p><small>ID: ${e(storedId ?? '')} · ${e(record.submittedAt)}</small></p>
  `;
  try {
    const sent = await deps.sendEmail({
      to: FRANCHISE_INQUIRY_SUPPORT_EMAIL,
      subject: `פניית זכיינות חדשה · New franchise inquiry — ${record.fullName.slice(0, 80).replace(/[\r\n]+/g, ' ')}`,
      html,
    });
    if (!sent) {
      deps.log.warn('[Franchise/inquiry] support notification not sent (inquiry IS stored)', { storedId });
    }
  } catch (err) {
    deps.log.warn('[Franchise/inquiry] support notification threw (inquiry IS stored)', {
      storedId,
      error: (err as Error)?.message,
    });
  }

  return { status: 200, body: { success: true, message: 'Inquiry submitted successfully' } };
}
