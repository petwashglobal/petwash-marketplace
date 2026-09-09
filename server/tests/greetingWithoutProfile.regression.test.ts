/**
 * GET /api/greeting/personalized — a signed-in member without a Firestore
 * users/{uid} document is greeted, not 404'd.
 *
 * Live QA 2026-09-09: the email-signup account has no users doc yet, so every
 * home load logged "[API Error] 404 /api/greeting/personalized". The handler
 * now greets from the token (email local-part) with the default language.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, '../routes.ts'), 'utf8');
const start = SRC.indexOf("app.get('/api/greeting/personalized'");
const handler = SRC.slice(start, SRC.indexOf('// ==================== ADMIN BACKEND PANEL API', start));

describe('greeting/personalized without a profile document', () => {
  it('the handler exists and still requires auth', () => {
    expect(start).toBeGreaterThan(0);
    expect(handler).toContain("app.get('/api/greeting/personalized', requireAuth,");
  });
  it('no longer answers 404 when the users doc is missing', () => {
    expect(handler).not.toContain("res.status(404).json({ error: 'User profile not found' })");
    expect(handler).toContain('const userData = userDoc.data() ?? {};');
  });
  it('falls back to the token email for the name', () => {
    expect(handler).toContain("(userData.email || tokenEmail)?.split('@')[0] || 'Friend'");
  });
});
