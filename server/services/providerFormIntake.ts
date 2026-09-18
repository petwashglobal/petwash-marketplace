/**
 * Provider intake from a Google Form (2026-09-18).
 *
 * WHY: applying today means a 2,571-line three-step wizard, and the live search
 * shows zero walkers and zero sitters. The CEO wants the questions to live in a
 * Google Form the team can edit without a release, and to arrive here
 * automatically. A Form writes to a Sheet; this reads that Sheet.
 *
 * WHAT IT WILL NOT DO: identity stays out of Google. ID / passport numbers,
 * selfies and criminal-check consent belong in our encrypted flow
 * (provider_applications + piiFieldCrypto), so an identity-looking column is
 * IGNORED and counted, never copied into a lead. The Form is the first contact:
 * who you are, where, what you offer. Verification continues in the app.
 *
 * Idempotent: one lead per email (crm_leads.email is unique); a repeated row is
 * counted as a duplicate and skipped, so a re-run never doubles anything.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { crmLeads } from '@shared/schema';
import { logger } from '../lib/logger';

export type CanonicalField =
  | 'firstName' | 'lastName' | 'fullName' | 'email' | 'phone' | 'city'
  | 'serviceTypes' | 'experience' | 'availability' | 'hasInsurance' | 'notes' | 'timestamp';

/** Columns we refuse to copy — identity data must not travel through a Sheet. */
const IDENTITY_PATTERNS = [
  'תעודת זהות', 'תז', 'ת.ז', 'מספר זהות', 'דרכון', 'רישיון נהיגה',
  'id number', 'identity number', 'national id', 'passport', 'driver licence', 'driver license',
  'selfie', 'סלפי', 'תמונת זהות', 'criminal', 'פלילי', 'iban', 'חשבון בנק', 'bank account', 'credit card', 'כרטיס אשראי',
];

/** HE/EN header synonyms. Longest match wins, so "שם משפחה" beats "שם". */
const SYNONYMS: Array<[CanonicalField, string[]]> = [
  ['lastName',     ['שם משפחה', 'משפחה', 'last name', 'surname', 'family name']],
  ['firstName',    ['שם פרטי', 'first name', 'given name']],
  ['fullName',     ['שם מלא', 'full name', 'your name', 'שם']],
  ['email',        ['אימייל', 'דואר אלקטרוני', 'דוא"ל', 'email', 'e-mail', 'mail']],
  ['phone',        ['טלפון', 'נייד', 'מספר טלפון', 'phone', 'mobile', 'whatsapp', 'ווטסאפ']],
  ['city',         ['עיר', 'יישוב', 'ישוב', 'אזור', 'city', 'town', 'area', 'location']],
  ['serviceTypes', ['שירות', 'שירותים', 'תפקיד', 'סוג שירות', 'service', 'services', 'role', 'what do you offer']],
  ['experience',   ['ניסיון', 'ותק', 'experience', 'years']],
  ['availability', ['זמינות', 'שעות', 'availability', 'hours', 'when']],
  ['hasInsurance', ['ביטוח', 'insurance', 'insured']],
  ['notes',        ['הערות', 'ספרו', 'ספר לנו', 'notes', 'about', 'tell us', 'message', 'comments']],
  ['timestamp',    ['חותמת זמן', 'timestamp', 'submitted at', 'date']],
];

/**
 * Whole-phrase match. Substring matching was wrong in BOTH directions: 'ת.ז'
 * normalises to 'ת ז', which appears inside "חותמת זמן" (timestamp) — an
 * innocent column was treated as an identity column and dropped. Match on word
 * boundaries so a phrase only hits when it really is that phrase.
 */
function containsPhrase(haystack: string, phrase: string): boolean {
  const p = norm(phrase);
  if (!p) return false;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(haystack);
}

const norm = (s: string) =>
  String(s ?? '')
    .replace(/[‎‏]/g, '')
    .replace(/["'`.,:;?!()\[\]{}\/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Header row → { columnIndex: field }. Unknown columns are left out on purpose. */
export function smartMapHeaders(headers: string[]): {
  map: Record<number, CanonicalField>;
  ignoredIdentity: string[];
  /** Column indexes we refuse to read — never copied, not even into notes. */
  identityColumns: number[];
  unmapped: string[];
} {
  const map: Record<number, CanonicalField> = {};
  const ignoredIdentity: string[] = [];
  const identityColumns: number[] = [];
  const unmapped: string[] = [];
  const taken = new Set<CanonicalField>();

  headers.forEach((raw, i) => {
    const h = norm(raw);
    if (!h) return;
    if (IDENTITY_PATTERNS.some((p) => containsPhrase(h, p))) { ignoredIdentity.push(raw); identityColumns.push(i); return; }
    let best: { field: CanonicalField; len: number } | null = null;
    for (const [field, words] of SYNONYMS) {
      for (const w of words) {
        const n = norm(w);
        if ((containsPhrase(h, n) || h.includes(n)) && (!best || n.length > best.len)) best = { field, len: n.length };
      }
    }
    // A field may only claim one column — the first (leftmost) wins, the rest
    // fall into notes so nothing the applicant wrote is thrown away.
    if (best && !taken.has(best.field)) { map[i] = best.field; taken.add(best.field); return; }
    unmapped.push(raw);
  });

  return { map, ignoredIdentity, identityColumns, unmapped };
}

export type IntakeLead = {
  firstName: string; lastName: string; email: string; phone: string | null;
  city: string | null; serviceTypes: string[]; notes: string;
};

const SERVICE_WORDS: Array<[string, string[]]> = [
  ['dog_walking', ['הולכ', 'טיול', 'walk']],
  ['pet_sitting', ['פטסיטר', 'שמרטף', 'אירוח', 'sitter', 'sitting', 'boarding']],
  ['grooming',    ['טיפוח', 'מספר', 'groom']],
  ['training',    ['אילוף', 'מאמן', 'train']],
  ['transport',   ['הסעה', 'הסעות', 'transport', 'taxi']],
];

/** Free text → our service codes; unknown text is kept in notes, never dropped. */
export function parseServiceTypes(text: string): string[] {
  const t = norm(text);
  const out = SERVICE_WORDS.filter(([, words]) => words.some((w) => t.includes(norm(w)))).map(([code]) => code);
  return Array.from(new Set(out));
}

/** One sheet row → a lead, or null when it cannot be contacted (no email). */
export function rowToLead(
  headerMap: Record<number, CanonicalField>,
  row: string[],
  extraHeaders: string[] = [],
  identityColumns: number[] = [],
): IntakeLead | null {
  const get = (f: CanonicalField): string => {
    const idx = Object.keys(headerMap).find((k) => headerMap[Number(k)] === f);
    return idx === undefined ? '' : String(row[Number(idx)] ?? '').trim();
  };

  const email = get('email').toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;

  const full = get('fullName');
  let firstName = get('firstName');
  let lastName = get('lastName');
  if (!firstName && full) {
    const parts = full.split(/\s+/);
    firstName = parts[0] ?? '';
    lastName = lastName || parts.slice(1).join(' ');
  }
  if (!firstName) firstName = email.split('@')[0];

  const serviceText = [get('serviceTypes'), get('notes')].join(' ');
  const noteLines: string[] = [];
  const add = (label: string, v: string) => { if (v) noteLines.push(`${label}: ${v}`); };
  add('שירותים', get('serviceTypes'));
  add('ניסיון', get('experience'));
  add('זמינות', get('availability'));
  add('ביטוח', get('hasInsurance'));
  add('הערות', get('notes'));
  // Columns we could not name still reach a human.
  row.forEach((v, i) => {
    // An identity column is never copied — not into a field, not into notes.
    if (headerMap[i] || identityColumns.includes(i) || !String(v ?? '').trim()) return;
    const header = extraHeaders[i];
    if (header) noteLines.push(`${header}: ${String(v).trim()}`);
  });

  return {
    firstName: firstName.slice(0, 80),
    lastName: (lastName || '-').slice(0, 80),
    email,
    phone: get('phone') ? get('phone').slice(0, 32) : null,
    city: get('city') ? get('city').slice(0, 80) : null,
    serviceTypes: parseServiceTypes(serviceText),
    notes: noteLines.join('\n').slice(0, 4000),
  };
}

export type SyncResult = {
  ok: boolean;
  read: number;
  created: number;
  duplicates: number;
  skipped: number;
  ignoredIdentityColumns: string[];
  reason?: string;
};

/**
 * Read the Form's response sheet and create one CRM lead per new applicant.
 * Configured by GOOGLE_PROVIDER_FORM_SPREADSHEET_ID (+ optional
 * GOOGLE_PROVIDER_FORM_SHEET_TAB, default "Form Responses 1").
 */
export async function syncProviderFormResponses(opts?: { limit?: number }): Promise<SyncResult> {
  const spreadsheetId = process.env.GOOGLE_PROVIDER_FORM_SPREADSHEET_ID;
  const tab = process.env.GOOGLE_PROVIDER_FORM_SHEET_TAB || 'Form Responses 1';
  const empty: SyncResult = { ok: false, read: 0, created: 0, duplicates: 0, skipped: 0, ignoredIdentityColumns: [] };
  if (!spreadsheetId) return { ...empty, reason: 'GOOGLE_PROVIDER_FORM_SPREADSHEET_ID not set' };

  let rows: string[][] = [];
  try {
    const { readSheetValues } = await import('./googleSheetsIntegration');
    rows = await readSheetValues(spreadsheetId, `${tab}!A1:Z1000`);
  } catch (err: any) {
    logger.error('[ProviderIntake] could not read the form sheet', { error: err?.message });
    return { ...empty, reason: `sheet_read_failed: ${err?.message}` };
  }
  if (rows.length < 2) return { ...empty, ok: true, reason: 'no responses yet' };

  const headers = rows[0].map((h) => String(h ?? ''));
  const { map, ignoredIdentity, identityColumns } = smartMapHeaders(headers);
  const body = rows.slice(1, 1 + (opts?.limit ?? 500));

  let created = 0, duplicates = 0, skipped = 0;
  for (const row of body) {
    const lead = rowToLead(map, row, headers, identityColumns);
    if (!lead) { skipped += 1; continue; }
    try {
      const [existing] = await db.select({ id: crmLeads.id }).from(crmLeads).where(eq(crmLeads.email, lead.email)).limit(1);
      if (existing) { duplicates += 1; continue; }
      await db.insert(crmLeads).values({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        leadSource: 'provider_google_form',
        sourceDetails: lead.city ? `Google Form · ${lead.city}` : 'Google Form',
        leadStatus: 'new',
        interestedServices: lead.serviceTypes.length ? lead.serviceTypes : undefined,
        notes: lead.notes || null,
      });
      created += 1;
    } catch (err: any) {
      // A unique-violation race is just another duplicate.
      if (err?.code === '23505' || /duplicate key/i.test(String(err?.message))) { duplicates += 1; continue; }
      logger.error('[ProviderIntake] lead insert failed', { error: err?.message });
      skipped += 1;
    }
  }

  if (created > 0) {
    try {
      const { createOrUpdateAlert } = await import('./AlertEngine');
      await createOrUpdateAlert({
        dedupeKey: `provider_form_intake:${new Date().toISOString().slice(0, 10)}:`,
        category: 'provider',
        severity: 'info',
        title: 'New provider applications from the Google Form',
        message: `${created} new applicant(s) arrived from the form and are waiting in the leads screen.`,
        linkedEntityType: 'crm_lead',
        linkedEntityId: 'provider_form',
        source: 'auto_sweep',
        metadata: { created, duplicates, skipped },
      });
    } catch { /* an alert failure must never lose the leads */ }
  }

  logger.info('[ProviderIntake] sync done', { read: body.length, created, duplicates, skipped, ignoredIdentity });
  return { ok: true, read: body.length, created, duplicates, skipped, ignoredIdentityColumns: ignoredIdentity };
}
