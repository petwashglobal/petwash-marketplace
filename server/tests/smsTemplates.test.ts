import { describe, it, expect } from 'vitest';
import { SMS_TEMPLATES, renderSms } from '../services/smsTemplates';

describe('SMS template registry', () => {
  it('interpolates {{vars}} and trims', () => {
    const r = renderSms('otp_login', { code: '123456' });
    expect(r?.body).toBe('קוד האימות שלך ל-PetWash הוא: 123456. הקוד תקף ל-5 דקות.');
    expect(r?.category).toBe('transactional');
  });

  it('returns null for an unknown key', () => {
    expect(renderSms('no_such_event')).toBeNull();
  });

  it('leaves no unfilled placeholders for a fully-supplied var set', () => {
    const r = renderSms('booking_confirmed', { service: 'רחיצה', date: '2026-07-01', time: '10:00' });
    expect(r?.body).not.toMatch(/\{\{/);
  });

  it('drops a missing var to empty string (never prints the raw token)', () => {
    const r = renderSms('wash_credit_added', { credits: 3 }); // balance omitted
    expect(r?.body).not.toMatch(/\{\{/);
    expect(r?.body).toContain('3');
  });

  it('every template has non-empty Hebrew copy (Hebrew-first rule)', () => {
    for (const [key, t] of Object.entries(SMS_TEMPLATES)) {
      expect(t.he, `${key} must have Hebrew copy`).toBeTruthy();
      expect(t.he.length, `${key} Hebrew copy non-empty`).toBeGreaterThan(0);
    }
  });

  it('provider_application_submitted (wired live) keeps the name + membership data', () => {
    // Guards against the live call site in provider-applications.ts losing data.
    const r = renderSms('provider_application_submitted', { name: 'דנה', membership: 'PW-PRO-2026-000123' }, 'he');
    expect(r?.body).toContain('דנה');
    expect(r?.body).toContain('PW-PRO-2026-000123');
    expect(r?.body).not.toMatch(/\{\{/);
    const en = renderSms('provider_application_submitted', { name: 'Dana', membership: 'PW-PRO-2026-000123' }, 'en');
    expect(en?.body).toContain('Dana');
    expect(en?.body).toContain('PW-PRO-2026-000123');
  });

  it('covers all three audiences (user + provider + admin)', () => {
    const keys = Object.keys(SMS_TEMPLATES);
    expect(keys.filter((k) => k.startsWith('provider_')).length).toBe(30);
    expect(keys.filter((k) => k.startsWith('admin_')).length).toBe(10);
    // 70 original (#948) + care_notes_reminder_24h (#1228, pin was not bumped)
    // + booking_reminder_today (booking-reminder engine, day-of T-2h copy).
    expect(keys.length).toBe(72);
  });

  it('every MARKETING template carries an {{unsubscribe}} opt-out; transactional must NOT', () => {
    for (const [key, t] of Object.entries(SMS_TEMPLATES)) {
      if (t.category === 'marketing') {
        expect(t.he, `${key} marketing must offer opt-out`).toContain('{{unsubscribe}}');
      } else {
        expect(t.he, `${key} transactional must not gate on opt-out`).not.toContain('{{unsubscribe}}');
      }
    }
  });
});
