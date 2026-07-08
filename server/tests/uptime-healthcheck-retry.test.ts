/**
 * Uptime health-check retry-before-alarm — regression pin (2026-07-09).
 *
 * The every-15-min uptime monitor probed the live site ONCE. A single transient
 * 503 during a normal Cloud Run instance recycle (~20s cold start, /health
 * returns 503 until phase=ready) failed the whole run → GitHub emailed "health
 * check failed" for a self-healing blip. It now probes up to N attempts and only
 * fails when EVERY attempt fails, so a cold-start recovers quietly while a
 * genuine sustained outage still alarms.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'scripts', 'monitoring', 'homepage-healthcheck.mjs'),
  'utf8',
);

describe('uptime health-check retries before alarming (2026-07-09)', () => {
  it('probes multiple attempts (configurable, default 3)', () => {
    expect(SRC).toMatch(/HEALTHCHECK_ATTEMPTS\s*\|\|\s*3/);
    expect(SRC).toMatch(/for \(let attempt = 1; attempt <= ATTEMPTS; attempt\+\+\)/);
  });

  it('breaks early on success and waits between failed attempts', () => {
    expect(SRC).toMatch(/if \(passed\) break;/);
    expect(SRC).toMatch(/setTimeout\(r, RETRY_DELAY_MS\)/);
  });

  it('only fails (exit 1) AFTER the retry loop, not on the first blip', () => {
    // the sole process.exitCode = 1 sits after the loop, guarded by !passed
    expect(SRC).toMatch(/if \(passed\) \{[\s\S]*?\} else \{\s*\n\s*process\.exitCode = 1;/);
    const exitAssignments = SRC.match(/process\.exitCode\s*=\s*1/g) ?? [];
    expect(exitAssignments.length).toBe(1);
  });
});
