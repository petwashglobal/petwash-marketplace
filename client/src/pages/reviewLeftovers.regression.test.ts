/**
 * Three leftovers from the 2026-09-10 end-to-end review.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
const read = (f: string) => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');

describe('review leftovers', () => {
  it('provider surfaces send a non-provider to /choose-path, not silently home', () => {
    const app = read('App.tsx');
    expect(app).toMatch(/path="\/provider-os">[\s\S]{0,400}?<RoleProtectedRoute minRole="provider" fallbackPath="\/choose-path">/);
    expect(app).toMatch(/path="\/provider\/home">[\s\S]{0,200}?<RoleProtectedRoute minRole="provider" fallbackPath="\/choose-path">/);
  });
  it('the birthday promo query declares 400 as an answer', () => {
    const s = read('pages/MyAccount.tsx');
    expect(s).toContain("apiRequest('GET', '/api/promo/birthday', undefined, { expectedStatuses: [400] })");
  });
  it('the inbox privacy footer speaks Hebrew', () => {
    expect(read('pages/PetWashInbox.tsx')).toContain('הצ׳אט נשאר בתוך PetWash');
  });
});
