/**
 * 2026-07-24: (1) the two long-deferred money UNIQUE guards shipped after a
 * live prod dup-check found zero duplicates; (2) the client error reporter
 * must be CSRF-exempt — live proof: a visitor's signup crashed and the report
 * itself was 403'd, leaving us blind; (3) PrestigeHome no longer polls the
 * never-existing summary endpoint.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('money unique guards', () => {
  it('migration 0101 creates both partial unique indexes', () => {
    const m = R('migrations/0101_money_earn_unique_guards.sql');
    expect(m).toMatch(/points_txn_source_uq[\s\S]*?\(user_id, source, source_id\)[\s\S]*?WHERE source_id IS NOT NULL/);
    expect(m).toMatch(/credit_txn_source_uq[\s\S]*?\(wallet_id, source_type, source_id\)[\s\S]*?WHERE source_id IS NOT NULL/);
  });
});

describe('error reporter never blind', () => {
  it('/api/errors/log is CSRF-exempt', () => {
    expect(R('server/index.ts')).toContain("'/api/errors/log',");
  });
});

describe('prestige home dead poll removed', () => {
  it('no query to the never-existing summary endpoint', () => {
    const p = R('client/src/pages/PrestigeHome.tsx');
    expect(p).not.toMatch(/queryKey: \['\/api\/prestige-pass\/summary'\]/);
    expect(p).toContain('const sum = null;');
  });
});
