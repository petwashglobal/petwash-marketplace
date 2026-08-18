/**
 * Task 9 — CEO fire order 101-140.
 *
 * BANK / TAX / KYC / PII LOGGING sweep. Raw IBAN / bank account /
 * tax ID / national ID / passport / SSN / full email / full phone /
 * full name / whole-request-body values must never reach logger.* /
 * console.* args. KYC / tax business rules unchanged.
 *
 * Fixes in this PR:
 *   - routes/franchise.ts: /inquiry endpoint no longer logs fullName /
 *     email / phone in the clear; uses maskEmail / maskPhone / hashShort
 *     helpers.
 *   - routes.ts (inline franchise inquiry): mirrored the same masking.
 *   - routes/messaging.ts: /conversations and message-send now log
 *     `byEmployeeUid` (opaque) instead of `employeeProfile.fullName`.
 *   - routes.ts TikTok OAuth invalid-user-data path: now logs booleans
 *     of shape instead of the full external userData.
 *   - routes/social-oauth.ts TikTok get-user-info: same fix.
 *   - iot/ledController.ts LED manual endpoint: no longer dumps
 *     `req.body` (which contains manual-override secrets like actor
 *     email) into an error log.
 *
 * KYC / tax / passport surface already correct — passportOCRService
 * calls masked helpers (this.maskTaxId, maskAccount) and the
 * passport.ts route explicitly comments SECURITY: Never log PII.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const FILES = [
  'routes/franchise.ts',
  'routes/messaging.ts',
  'routes/passport.ts',
  'routes/social-oauth.ts',
  'iot/ledController.ts',
  'services/ReceiptOCRService.ts',
];

function walkLoggerCalls(src: string): string[] {
  const out: string[] = [];
  const rx = /(logger|console)\.(log|info|debug|warn|error)\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    out.push(src.slice(start, i));
  }
  return out;
}

describe('Bank/tax/KYC PII never reaches logger args', () => {
  for (const rel of FILES) {
    it(`${rel}: logger calls never emit raw PII values`, () => {
      const src = R(rel);
      const calls = walkLoggerCalls(src);
      for (const call of calls) {
        // Full request body / full user data dumps.
        expect(call).not.toMatch(/\breq\.body\s*[,}]/);
        expect(call).not.toMatch(/\{\s*req\.body\s*\}/);
        expect(call).not.toMatch(/\{\s*userData\s*\}/);
        expect(call).not.toMatch(/\{\s*inquiryData\s*\}/);
        expect(call).not.toMatch(/\{\s*profile\s*\}/);
        // Full-name + email + phone triples (the classic PII fingerprint).
        expect(call).not.toMatch(/\bfullName\s*,\s*email\s*,\s*phone\b/);
        expect(call).not.toMatch(/\bfullName\s*,\s*email\s*,\s*country/);
        // Bare identity fields as values (allow boolean `!!*.field` checks).
        expect(call).not.toMatch(/(?<![!.])\biban\s*[,:}]/i);
        expect(call).not.toMatch(/(?<![!.])\bnationalId\s*[,:}]/i);
        expect(call).not.toMatch(/(?<![!.])\bpassportNumber\s*[,:}]/i);
        expect(call).not.toMatch(/(?<![!.])\bssn\s*[,:}]/i);
        expect(call).not.toMatch(/(?<![!.])\btaxId\s*[,:}]/i);
        expect(call).not.toMatch(/(?<![!.])\bbankAccount\s*[,:}]/i);
      }
    });
  }
});

describe('routes/franchise.ts masks contact fields', () => {
  it('helper functions are exported and used', () => {
    const src = R('routes/franchise.ts');
    expect(src).toContain('const hashShort');
    expect(src).toContain('const maskEmail');
    expect(src).toContain('const maskPhone');
    // The two log sites use masked forms.
    expect(src).toContain('emailMasked: maskEmail(email)');
    expect(src).toContain('phoneMasked: maskPhone(phone)');
    expect(src).toContain('fullNameHash: hashShort(fullName)');
  });

  it('the inquiry route no longer emits raw fullName/email/phone', () => {
    const src = R('routes/franchise.ts');
    const inquiryLog = src.match(/logger\.info\('Franchise inquiry received'[^}]*\}[^)]*\)/);
    expect(inquiryLog).not.toBeNull();
    if (!inquiryLog) return;
    const call = inquiryLog[0];
    expect(call).not.toMatch(/\bfullName\s*,/);
    expect(call).not.toMatch(/\bemail\s*,/);
    expect(call).not.toMatch(/\bphone\s*,/);
    expect(call).toContain('emailMasked');
    expect(call).toContain('phoneMasked');
    expect(call).toContain('fullNameHash');
  });
});

describe('routes/messaging.ts logs employee UID, not fullName', () => {
  it('conversation-created log uses uid', () => {
    const src = R('routes/messaging.ts');
    expect(src).toContain("[Messaging] Conversation created', { conversationId, byEmployeeUid");
    expect(src).not.toMatch(/Conversation created:.{0,20}employeeProfile\.fullName/);
  });
  it('message-sent log uses uid', () => {
    const src = R('routes/messaging.ts');
    expect(src).toContain("[Messaging] Message sent', { conversationId, byEmployeeUid");
    expect(src).not.toMatch(/Message sent in conversation.{0,50}employeeProfile\.fullName/);
  });
});

describe('TikTok OAuth invalid-user-data logs no longer dump external body', () => {
  it('server/routes.ts sanitised', () => {
    const src = R('routes.ts');
    // The specific TikTok invalid-user-data log now uses `hasData: !!userData`
    const idx = src.indexOf("[TikTok OAuth] Invalid user data");
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 400);
    expect(window).toContain('hasData: !!userData');
    expect(window).not.toMatch(/,\s*userData\s*\)/);
  });
  it('server/routes/social-oauth.ts sanitised', () => {
    const src = R('routes/social-oauth.ts');
    const idx = src.indexOf("[TikTok OAuth] Failed to get user info");
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 400);
    expect(window).toContain('hasData: !!userData');
    expect(window).not.toMatch(/\{\s*userData\s*\}/);
  });
});

describe('LED controller no longer dumps req.body', () => {
  it('POST /stations/:stationId/led/manual error log is sanitised', () => {
    const src = R('iot/ledController.ts');
    const idx = src.indexOf("POST /stations/:stationId/led/manual error");
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 300);
    expect(window).not.toMatch(/,\s*body:\s*req\.body/);
    expect(window).toContain('stationId: req.params?.stationId');
  });
});
