/**
 * Provider intake from a Google Form (2026-09-18).
 *
 * The questions live in a Form the team edits without a release; the answers
 * must arrive here whatever order the columns are in and whichever language
 * they are written in. Identity columns must NEVER be copied — ID, passport,
 * selfie and bank details stay in the encrypted flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ rows: [] as string[][], existingEmails: [] as string[], inserted: [] as any[], alerts: [] as any[] }));

vi.mock('../db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => {
      const last = h.lastEmail; return h.existingEmails.includes(last) ? [{ id: 1 }] : [];
    } }) }) }),
    insert: () => ({ values: async (v: any) => { h.inserted.push(v); } }),
  },
}));
vi.mock('../services/googleSheetsIntegration', () => ({ readSheetValues: async () => h.rows }));
vi.mock('../services/AlertEngine', () => ({ createOrUpdateAlert: async (a: any) => { h.alerts.push(a); } }));
vi.mock('@shared/schema', () => ({ crmLeads: { email: 'email', id: 'id' } }));
vi.mock('drizzle-orm', () => ({ eq: (_c: any, v: any) => { (h as any).lastEmail = v; return {}; }, and: () => ({}) }));

import { smartMapHeaders, rowToLead, parseServiceTypes, syncProviderFormResponses } from '../services/providerFormIntake';

describe('smart column matching', () => {
  it('understands a Hebrew form in any column order', () => {
    const { map } = smartMapHeaders(['חותמת זמן', 'טלפון נייד', 'כתובת דוא"ל', 'שם מלא', 'עיר מגורים', 'איזה שירות תרצו לתת?']);
    expect(map[0]).toBe('timestamp');
    expect(map[1]).toBe('phone');
    expect(map[2]).toBe('email');
    expect(map[3]).toBe('fullName');
    expect(map[4]).toBe('city');
    expect(map[5]).toBe('serviceTypes');
  });

  it('understands an English form too, and prefers the longer match', () => {
    const { map } = smartMapHeaders(['Email address', 'First name', 'Last name', 'Phone number', 'City']);
    expect(Object.values(map)).toEqual(['email', 'firstName', 'lastName', 'phone', 'city']);
  });

  it('IGNORES identity columns instead of copying them', () => {
    const { map, ignoredIdentity } = smartMapHeaders(['אימייל', 'תעודת זהות', 'Passport number', 'העלאת סלפי', 'מספר חשבון בנק']);
    expect(Object.values(map)).toEqual(['email']);
    expect(ignoredIdentity).toHaveLength(4);
  });

  it('an innocent header is not mistaken for an identity column', () => {
    // 'ת.ז' normalises to 'ת ז', which is a substring of "חותמת זמן".
    const { map, ignoredIdentity } = smartMapHeaders(['חותמת זמן', 'אימייל']);
    expect(map[0]).toBe('timestamp');
    expect(ignoredIdentity).toEqual([]);
  });

  it('keeps unknown columns visible rather than silently dropping them', () => {
    const { unmapped } = smartMapHeaders(['אימייל', 'כמה כלבים גידלת?']);
    expect(unmapped).toEqual(['כמה כלבים גידלת?']);
  });
});

describe('a row becomes a lead', () => {
  const headers = ['חותמת זמן', 'שם מלא', 'אימייל', 'טלפון', 'עיר', 'שירות', 'ניסיון', 'כמה כלבים גידלת?'];
  const { map } = smartMapHeaders(headers);

  it('splits a full name, normalises the email and keeps every answer', () => {
    const lead = rowToLead(map, ['2026-09-18', 'דנה כהן לוי', 'DANA@Example.com ', '050-1234567', 'חיפה', 'הולכת כלבים', '3 שנים', 'שלושה'], headers);
    expect(lead).toMatchObject({ firstName: 'דנה', lastName: 'כהן לוי', email: 'dana@example.com', phone: '050-1234567', city: 'חיפה' });
    expect(lead!.serviceTypes).toEqual(['dog_walking']);
    expect(lead!.notes).toContain('3 שנים');
    expect(lead!.notes).toContain('כמה כלבים גידלת?: שלושה'); // unknown column kept
  });

  it('a row with no usable email is skipped (we could not answer them)', () => {
    expect(rowToLead(map, ['2026-09-18', 'מישהו', 'not-an-email', '', '', '', '', ''], headers)).toBeNull();
  });

  it('reads several services out of free text, in both languages', () => {
    expect(parseServiceTypes('הולכת כלבים + אירוח')).toEqual(['dog_walking', 'pet_sitting']);
    expect(parseServiceTypes('Grooming and training')).toEqual(['grooming', 'training']);
    expect(parseServiceTypes('לא יודע')).toEqual([]);
  });
});

describe('sync', () => {
  beforeEach(() => { h.rows = []; h.existingEmails = []; h.inserted = []; h.alerts = []; process.env.GOOGLE_PROVIDER_FORM_SPREADSHEET_ID = 'sheet-1'; });

  it('creates one lead per new applicant and alerts once', async () => {
    h.rows = [
      ['חותמת זמן', 'שם מלא', 'אימייל', 'טלפון', 'עיר', 'שירות'],
      ['2026-09-18', 'דנה כהן', 'dana@example.com', '0501234567', 'חיפה', 'הולכת כלבים'],
      ['2026-09-18', 'יוסי לוי', 'yossi@example.com', '0507654321', 'באר שבע', 'אירוח'],
    ];
    const r = await syncProviderFormResponses();
    expect(r).toMatchObject({ ok: true, read: 2, created: 2, duplicates: 0, skipped: 0 });
    expect(h.inserted.map((i) => i.email)).toEqual(['dana@example.com', 'yossi@example.com']);
    expect(h.inserted[0]).toMatchObject({ leadSource: 'provider_google_form', leadStatus: 'new' });
    expect(h.inserted[1].sourceDetails).toContain('באר שבע');
    expect(h.alerts).toHaveLength(1);
  });

  it('a second run of the same sheet creates nothing', async () => {
    h.rows = [
      ['אימייל', 'שם מלא'],
      ['dana@example.com', 'דנה כהן'],
    ];
    h.existingEmails = ['dana@example.com'];
    const r = await syncProviderFormResponses();
    expect(r).toMatchObject({ created: 0, duplicates: 1 });
    expect(h.inserted).toHaveLength(0);
    expect(h.alerts).toHaveLength(0);
  });

  it('does nothing at all until the sheet is configured', async () => {
    delete process.env.GOOGLE_PROVIDER_FORM_SPREADSHEET_ID;
    const r = await syncProviderFormResponses();
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/GOOGLE_PROVIDER_FORM_SPREADSHEET_ID/);
    expect(h.inserted).toHaveLength(0);
  });

  it('an identity column in the sheet never reaches a lead', async () => {
    h.rows = [
      ['אימייל', 'שם מלא', 'תעודת זהות'],
      ['dana@example.com', 'דנה כהן', '123456789'],
    ];
    const r = await syncProviderFormResponses();
    expect(r.ignoredIdentityColumns).toEqual(['תעודת זהות']);
    expect(JSON.stringify(h.inserted)).not.toContain('123456789');
  });
});
