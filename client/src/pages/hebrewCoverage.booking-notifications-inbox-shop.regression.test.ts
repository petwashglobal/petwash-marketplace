/**
 * Live QA 2026-09-10 (Hebrew mode): /booking, /notifications, /inbox tabs and
 * /shop rendered English-only. Pins: every visible string on those surfaces
 * has a Hebrew branch, and the two untruthful booking claims are gone —
 * bookings are provider-accepted requests (four gates), and the card rail is
 * SUMIT, not "72-hour escrow with Nayax Israel".
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const read = (f: string) => fs.readFileSync(path.resolve(__dirname, f), 'utf8');

describe('Hebrew coverage — booking / notifications / inbox / shop', () => {
  it('BookingUnified speaks Hebrew and drops the false claims', () => {
    const s = read('BookingUnified.tsx');
    expect(s).toContain('const he = language === "he";');
    for (const he of ['הזמנה חכמה', 'הזמינו עכשיו', 'בקרוב', 'סטטוס ברור בכל שלב', 'תשלום מאובטח', 'תיאום גמיש']) expect(s).toContain(he);
    expect(s).not.toMatch(/instant booking confirmation|Instant Confirmation/);
    expect(s).not.toMatch(/72-hour escrow|Nayax Israel/);
    expect(s).not.toContain('react-i18next');
  });
  it('NotificationsPage speaks Hebrew (header, groups, relative time, empty state)', () => {
    const s = read('NotificationsPage.tsx');
    for (const he of ['התראות', 'היום', 'אתמול', 'מוקדם יותר', 'הרגע', 'סמן הכל כנקרא', 'הכול מעודכן', 'אין התראות עדיין']) expect(s).toContain(he);
    expect(s).toMatch(/dateStr: string, he = false/);
  });
  it('PetWashInbox tabs and title speak Hebrew', () => {
    const s = read('PetWashInbox.tsx');
    for (const he of ['הודעות', 'קונסיירז׳', 'התראות', 'תיבת הודעות']) expect(s).toContain(he);
  });
  it('Shop hero, notify and waitlist speak Hebrew', () => {
    const s = read('Shop.tsx');
    for (const he of ['חנות הלייף-סטייל לחיות מחמד', 'בפיתוח — הצטרפו לרשימת ההמתנה', 'עדכנו אותי', 'הצטרפו לרשימת ההמתנה', 'הצטרפות']) expect(s).toContain(he);
  });
});
