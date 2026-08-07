/**
 * "Hiding outside logs" fixes (CEO 2026-08-06). The codebase had ~4,000 logger.error
 * calls that only wrote stdout (no Sentry, no page), and 6 critical pollers started
 * with a silent catch(){}. These pins keep errors VISIBLE.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const logger = R('lib/logger.ts');
const index = R('index.ts');

describe('F1 — logger.error forwards to Sentry', () => {
  it('imports Sentry and captures every error-level log', () => {
    expect(logger).toMatch(/import \* as Sentry from '@sentry\/node'/);
    expect(logger).toMatch(/Sentry\.captureException\(/);
  });
  it('the capture is wrapped so telemetry can never break logging', () => {
    // captureException sits inside a try/catch in error()
    const err = logger.slice(logger.indexOf('error(message'));
    expect(err).toMatch(/try \{[\s\S]*Sentry\.captureException[\s\S]*\} catch/);
  });
});

describe('F3 — critical pollers log on startup failure (not silent)', () => {
  it('no silent catch(()=>{}) remains on ANY escrow/dispatch/expiry poller start', () => {
    for (const name of ['startDispatchPoller', 'startBookingExpiryPoller', 'startAcceptTimeoutPoller']) {
      const lines = index.split('\n').filter(l => l.includes(name) && l.includes('import('));
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).not.toMatch(/\.catch\(\(\) => \{\}\)/);
        expect(line).toMatch(/logger\.error/);
      }
    }
  });
});
