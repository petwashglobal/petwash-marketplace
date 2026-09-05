/**
 * WebSocket origin allowlist — production must not trust dev origins.
 *
 * Review addition (2026-09-06) to the realtime lane. `WS_ALLOWED_ORIGINS`
 * listed `http://localhost:5000` and `http://127.0.0.1:5000` unconditionally,
 * so production accepted a socket upgrade from a page served on the victim's
 * OWN machine — a real Origin a browser will send.
 *
 * Not a large hole on its own: as wsOrigins.ts itself says, the origin check
 * is not authentication (verifyWsToken gates every message). But a production
 * allowlist should not name a host an attacker may control, and this codebase
 * already gates its other dev affordances exactly this way — the x-test-user-*
 * bypasses in customAuth.ts, firebase-auth.ts and gates.ts all hard-check
 * NODE_ENV === 'production'.
 *
 * The module reads NODE_ENV at import time, so each case re-imports with a
 * reset module registry.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

const ORIGINAL = process.env.NODE_ENV;

async function loadWith(nodeEnv: string) {
  process.env.NODE_ENV = nodeEnv;
  vi.resetModules();
  return import('../lib/wsOrigins');
}

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL;
  vi.resetModules();
});

describe('WS origin allowlist — production', () => {
  it('THE PIN: rejects localhost and 127.0.0.1 in production', async () => {
    const { isWsOriginAllowed } = await loadWith('production');
    expect(isWsOriginAllowed('http://localhost:5000')).toBe(false);
    expect(isWsOriginAllowed('http://127.0.0.1:5000')).toBe(false);
  });

  it('still accepts the real production origins', async () => {
    const { isWsOriginAllowed } = await loadWith('production');
    for (const o of [
      'https://petwash.co.il',
      'https://www.petwash.co.il',
      'https://hub.petwash.co.il',
      'https://signinpetwash.web.app',
    ]) {
      expect(isWsOriginAllowed(o), o).toBe(true);
    }
  });

  it('still rejects look-alike and prefix-extended hosts', async () => {
    const { isWsOriginAllowed } = await loadWith('production');
    for (const o of [
      'https://petwash.co.il.evil.com',
      'https://evil.com',
      'http://petwash.co.il',           // wrong protocol
      'https://petwash.co.il:8443',     // wrong port
      'not a url',
      '',
    ]) {
      expect(isWsOriginAllowed(o), o).toBe(false);
    }
  });

  it('rejects a missing Origin header', async () => {
    const { isWsOriginAllowed } = await loadWith('production');
    expect(isWsOriginAllowed(undefined)).toBe(false);
  });
});

describe('WS origin allowlist — development', () => {
  it('still accepts localhost so local dev keeps working', async () => {
    const { isWsOriginAllowed } = await loadWith('development');
    expect(isWsOriginAllowed('http://localhost:5000')).toBe(true);
    expect(isWsOriginAllowed('http://127.0.0.1:5000')).toBe(true);
    expect(isWsOriginAllowed('https://petwash.co.il')).toBe(true);
  });
});
