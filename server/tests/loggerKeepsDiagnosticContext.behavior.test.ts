/**
 * CEO 2026-09-12 — found while QA-ing my OWN fix (#2409), which did not work.
 *
 * #2409 added `referenceId` to the object passed to
 *   logger.error('[Client Error]', { referenceId, errorKind, ... })
 * and the PR claimed the customer-quoted crash reference was now findable.
 * A live probe against production proved it was not. The log line read:
 *
 *   [ERROR] [Client Error] {"errorName":"Object","errorMessage":"Failed to fetch"}
 *
 * Root cause is in the logger, not the call site. `error(message, error?, context?)`
 * treats its SECOND argument as an Error, and the guard
 *
 *   error instanceof Error || error.message || error.stack
 *
 * accepts any plain diagnostic bag that happens to carry a `message` key. It
 * then reduced the whole object to errorName / errorMessage / errorCode /
 * errorStack and dropped every sibling field.
 *
 * 32 call sites were losing context this way, including Firebase token
 * validation failures (path, method, hasBearer, hasSessionCookie, code) and
 * two money-adjacent paths. Fixing the logger fixes all of them at once, which
 * is why this is not 32 call-site edits.
 *
 * These tests drive the REAL logger and read what it actually writes to
 * console.error — no source-shape pins.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from '../lib/logger';

let written: string[] = [];
let spy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  written = [];
  spy = vi.spyOn(console, 'error').mockImplementation((...args: any[]) => {
    written.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  });
});
afterEach(() => spy.mockRestore());

const emitted = () => written.join('\n');

describe('logger.error keeps the diagnostic bag it is handed', () => {
  it('the referenceId a customer is told to quote reaches the log', () => {
    logger.error('[Client Error]', {
      referenceId: '0350c6f9',
      errorKind: 'render',
      errorName: 'TypeError',
      message: 'Cannot read properties of undefined',
      componentStack: 'at PrestigeHome',
      userRole: 'member',
      language: 'he',
    });
    const out = emitted();
    expect(out, 'the crash reference is STILL unfindable').toContain('0350c6f9');
    // and the fields that tell a real crash from a stale-chunk reload
    expect(out).toContain('render');
    expect(out).toContain('componentStack');
  });

  it('every sibling field survives, not just the first one', () => {
    logger.error('[probe]', { message: 'boom', alpha: 'A1', beta: 'B2', gamma: 'C3' });
    const out = emitted();
    for (const v of ['A1', 'B2', 'C3']) expect(out).toContain(v);
  });

  it('the message itself is still extracted (no regression on the old behaviour)', () => {
    logger.error('[probe]', { message: 'boom', extra: 'kept' });
    const out = emitted();
    expect(out).toContain('errorMessage');
    expect(out).toContain('boom');
    expect(out).toContain('kept');
  });

  it('a REAL Error is unchanged — name, message, and no own-property spray', () => {
    const e = new Error('real failure');
    e.name = 'RealError';
    logger.error('[probe]', e);
    const out = emitted();
    expect(out).toContain('RealError');
    expect(out).toContain('real failure');
  });

  it('a real Error PLUS a context bag still merges both', () => {
    logger.error('[probe]', new Error('kaboom'), { traceId: 'T-9', route: '/api/x' });
    const out = emitted();
    expect(out).toContain('kaboom');
    expect(out).toContain('T-9');
    expect(out).toContain('/api/x');
  });

  it('a bag with NO message key still works (the else branch)', () => {
    logger.error('[probe]', { onlyField: 'Z9' });
    expect(emitted()).toContain('Z9');
  });

  it('the fields we now let through are still redacted in the emitted line', () => {
    // The privacy lane (AGENT-14) must not be widened by carrying more fields.
    // Note: formatLog redacts internally too, so this pins the EMITTED line
    // rather than isolating which of the two redaction passes did the work.
    logger.error('[probe]', { message: 'boom', password: 'hunter2-should-not-appear' });
    expect(emitted()).not.toContain('hunter2-should-not-appear');
  });

  it('a `stack` key in the bag does NOT leak a stack trace in production', () => {
    // errorStack is deliberately withheld when APP_ENV === 'production'.
    // If the carry-through loop stopped skipping `stack`, it would re-add the
    // raw value under a different key and defeat that. This is the property
    // that a naive "just copy everything" implementation breaks.
    const prev = process.env.APP_ENV;
    process.env.APP_ENV = 'production';
    try {
      logger.error('[probe]', { message: 'boom', stack: 'SECRET-STACK-FRAME-ZZZ' });
      expect(emitted()).not.toContain('SECRET-STACK-FRAME-ZZZ');
    } finally {
      if (prev === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = prev;
    }
  });

  it('`name` and `code` are not duplicated alongside errorName / errorCode', () => {
    logger.error('[probe]', { message: 'boom', name: 'NAMEDUP', code: 'CODEDUP' });
    const out = emitted();
    // They must appear via the canonical errorName / errorCode fields only.
    expect(out).toContain('NAMEDUP');
    expect(out).toContain('errorName');
    expect(out.match(/NAMEDUP/g)?.length, 'name was carried through twice').toBe(1);
    expect(out.match(/CODEDUP/g)?.length, 'code was carried through twice').toBe(1);
  });

  it('a REAL Error is left exactly as it was — no own-property spray', () => {
    // ~4000 existing call sites pass a real Error. The blast radius of this
    // change must be zero for them, so custom own-properties are NOT sprayed.
    const e: any = new Error('boom');
    e.internalDetail = 'SHOULD-NOT-APPEAR-ZZZ';
    logger.error('[probe]', e);
    expect(emitted()).not.toContain('SHOULD-NOT-APPEAR-ZZZ');
  });
});

describe('the call site that started this', () => {
  it('/api/errors/log still hands the logger the referenceId', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'server/routes.ts'), 'utf8');
    const at = src.indexOf("logger.error('[Client Error]', {");
    expect(at).toBeGreaterThan(-1);
    const block = src.slice(at, src.indexOf('});', at));
    for (const f of ['referenceId', 'errorKind', 'componentStack']) {
      expect(block, `[Client Error] no longer passes ${f}`).toContain(`${f}:`);
    }
  });
});
