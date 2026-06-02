/**
 * PR-WALLET-HOME-CTA-A — homepage Prestige Wallet CTA gating pin.
 *
 * The pass is a membership artifact, so the homepage CTA must:
 *   • route logged-OUT visitors to the 18+ interest gate (never hand them a pass)
 *   • route logged-IN members into the existing /prestige-pass flow
 *   • NOT generate passes or call wallet/cert endpoints itself
 * and Landing.tsx must actually render it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const cta = fs.readFileSync(path.resolve(__dirname, 'PrestigeWalletCTA.tsx'), 'utf8');
const landing = fs.readFileSync(path.resolve(__dirname, '../pages/Landing.tsx'), 'utf8');

describe('PrestigeWalletCTA — membership-gated homepage CTA', () => {
  it('gates on auth via useFirebaseAuth', () => {
    expect(cta).toMatch(/useFirebaseAuth/);
    expect(cta).toMatch(/user\s*\?/);
  });

  it('routes logged-out visitors to the Prestige interest gate', () => {
    expect(cta).toMatch(/href="\/prestige\/waitlist"/);
    expect(cta).toMatch(/cta-join-prestige/);
  });

  it('routes logged-in members into the existing /prestige-pass flow', () => {
    expect(cta).toMatch(/href="\/prestige-pass"/);
    expect(cta).toMatch(/cta-apple-wallet/);
    expect(cta).toMatch(/cta-google-wallet/);
  });

  it('does NOT generate passes or call wallet/cert endpoints directly', () => {
    const codeOnly = cta.replace(/\/\/[^\n]*\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/\/api\/wallet/);
    expect(codeOnly).not.toMatch(/\/api\/google-wallet/);
    expect(codeOnly).not.toMatch(/\.pkpass/);
    expect(codeOnly).not.toMatch(/fetch\(/);
  });

  it('is rendered on the homepage (Landing.tsx)', () => {
    expect(landing).toMatch(/import PrestigeWalletCTA from '@\/components\/PrestigeWalletCTA'/);
    expect(landing).toMatch(/<PrestigeWalletCTA language=\{language\} \/>/);
  });
});
