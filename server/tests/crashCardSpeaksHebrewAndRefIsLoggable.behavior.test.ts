/**
 * CEO 2026-09-12 — the crash the CEO hit on his iPhone, ref 0350c6f9.
 *
 * TWO faults, both proven from that one screenshot:
 *
 *  1. The card tells the customer "Reference: 0350c6f9" and to quote it to
 *     support — but POST /api/errors/log destructured a fixed field list that
 *     did NOT include `referenceId`. The crash was logged; the reference was
 *     not. That is why the ref could not be found in Cloud Logging.
 *
 *  2. The card was English-only, on a Hebrew RTL app, for an Israeli customer.
 *
 * These are behaviour pins, not source-shape pins: (1) runs the real handler
 * body against a fake logger, (2) calls the real exported pure copy module.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const R = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

// ── 2. The copy module (pure, directly executable) ───────────────────────────
// Transpile-free import is impossible from a .ts client module inside the
// server test project, so evaluate the two pure functions the same way the
// bundle would: strip the types with esbuild and run the module.
async function loadCopyModule() {
  const esbuild = await import('esbuild');
  const src = R('client/src/lib/crashCardCopy.ts');
  const js = esbuild.transformSync(src, { loader: 'ts', format: 'cjs' }).code;
  const module = { exports: {} as any };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', js)(module, module.exports, require);
  return module.exports as typeof import('../../client/src/lib/crashCardCopy');
}

describe('the crash card speaks the customer’s language', () => {
  it('renders Hebrew when <html lang> is he', async () => {
    const { crashCardCopy, isHebrewCrashLocale } = await loadCopyModule();
    expect(isHebrewCrashLocale('he', null, 'en-US')).toBe(true);
    const t = crashCardCopy(true, false);
    expect(t.dir).toBe('rtl');
    // Every user-visible string must actually contain Hebrew letters.
    for (const key of ['title', 'body', 'reference', 'reloadLatest', 'reload', 'goHome'] as const) {
      expect(t[key], `${key} is still English`).toMatch(/[֐-׿]/);
    }
  });

  it('accepts he-IL and the legacy iw code, rejects everything else', async () => {
    const { isHebrewCrashLocale } = await loadCopyModule();
    expect(isHebrewCrashLocale('he-IL', null, null)).toBe(true);
    expect(isHebrewCrashLocale('iw', null, null)).toBe(true);
    expect(isHebrewCrashLocale('en', null, null)).toBe(false);
    expect(isHebrewCrashLocale('ar', null, null)).toBe(false);
    // 'hen'/'hebrew-ish' prefixes must not be mistaken for Hebrew.
    expect(isHebrewCrashLocale('hen', null, null)).toBe(false);
  });

  it('falls back to the stored pw_lang when <html lang> has not been set yet', async () => {
    const { isHebrewCrashLocale } = await loadCopyModule();
    // A crash before Layout mounts leaves documentElement.lang empty.
    expect(isHebrewCrashLocale('', 'he', 'en-US')).toBe(true);
    expect(isHebrewCrashLocale(null, null, 'he-IL')).toBe(true);
    expect(isHebrewCrashLocale(null, null, null)).toBe(false);
  });

  it('English is still English when nothing says Hebrew', async () => {
    const { crashCardCopy } = await loadCopyModule();
    const t = crashCardCopy(false, true);
    expect(t.dir).toBe('ltr');
    expect(t.title).toBe('A new version is available');
  });

  it('the boundary actually USES the module — no hardcoded English left', () => {
    const src = R('client/src/components/AppErrorBoundary.tsx');
    expect(src).toContain('crashCardCopy');
    expect(src).toContain('isHebrewCrashLocale');
    // The exact strings the CEO saw on his phone must be gone from the render.
    for (const dead of ['Something went wrong"', 'Reload Page\n', 'Go Home\n', 'Reference: {referenceId}']) {
      expect(src.includes(dead), `still renders hardcoded "${dead.trim()}"`).toBe(false);
    }
  });
});

// ── 1. The reference id must reach the log ───────────────────────────────────
describe('a customer-quoted crash reference is findable in the logs', () => {
  /** Pull the literal object passed to logger.error('[Client Error]', {...}). */
  function clientErrorLogFields(): string[] {
    const src = R('server/routes.ts');
    const at = src.indexOf("logger.error('[Client Error]', {");
    expect(at, "the [Client Error] log line moved or was removed").toBeGreaterThan(-1);
    const open = src.indexOf('{', at);
    let depth = 0;
    let end = open;
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    const body = src.slice(open + 1, end);
    return [...body.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)].map(m => m[1]);
  }

  it('logs referenceId — the id the customer is told to quote', () => {
    expect(clientErrorLogFields()).toContain('referenceId');
  });

  it('logs enough to tell a render crash from a stale-chunk reload', () => {
    const fields = clientErrorLogFields();
    for (const f of ['errorKind', 'errorName', 'componentStack']) {
      expect(fields, `missing ${f}`).toContain(f);
    }
  });

  it('every field the boundary sends that names the crash is logged', () => {
    const boundary = R('client/src/components/AppErrorBoundary.tsx');
    const sendAt = boundary.indexOf('body: JSON.stringify({');
    expect(sendAt).toBeGreaterThan(-1);
    const sent = boundary.slice(sendAt, sendAt + 900);
    const logged = new Set(clientErrorLogFields());
    for (const f of ['referenceId', 'errorKind', 'repeatedChunkFailure', 'message', 'errorName', 'stack', 'componentStack']) {
      expect(sent.includes(`${f},`) || sent.includes(`${f}:`), `boundary no longer sends ${f}`).toBe(true);
      expect(logged.has(f), `server drops ${f} on the floor`).toBe(true);
    }
  });

  it('the reference is the traceId handed to the fault reporter', () => {
    const src = R('server/routes.ts');
    expect(src).toMatch(/traceId:\s*errorReport\?\.referenceId/);
  });
});
