/**
 * classifyHandlerError — CEO DEEP-LOGIC §32, §43, §46, §47.
 *
 * The classifier is the taxonomy the Action Brain uses to decide
 * whether an error is:
 *   – final (validation / permission) → surface FAILED to the user.
 *   – state drift (conflict / stale) → refresh the preview and let
 *     the user re-decide.
 *   – transient (dependency) → the executor may retry on the SAME
 *     idempotency claim.
 *   – uncertain (unknown outcome) → the mutation may or may not
 *     have happened; RECONCILIATION with the domain is required
 *     before we tell the user anything definitive.
 *
 * These behavior pins keep the mapping stable across future edits.
 */
import { describe, it, expect } from 'vitest';
import { classifyHandlerError } from '@shared/marketplace/actionErrorClassifier';

describe('explicit reasonCode wins', () => {
  it.each([
    ['VALIDATION_FINAL',    false, false],
    ['PERMISSION_FINAL',    false, false],
    ['CONFLICT_STALE',      false, true],
    ['DEPENDENCY_RETRYABLE', true, false],
    ['UNKNOWN_OUTCOME',     false, true],
  ] as const)('%s → class + retryable + reconciliationRequired', (code, retryable, recon) => {
    const c = classifyHandlerError({ reasonCode: code });
    expect(c.errorClass).toBe(code);
    expect(c.retryable).toBe(retryable);
    expect(c.reconciliationRequired).toBe(recon);
  });
});

describe('CEO §43 — external money uncertainty is UNKNOWN_OUTCOME, never FAILED', () => {
  it.each([
    'SUMIT gateway timeout after 30s',
    'Nayax callback did not reply',
    'external transaction status unknown',
    'payment gateway 502',
  ])('%s → UNKNOWN_OUTCOME + reconciliationRequired', (msg) => {
    const c = classifyHandlerError(new Error(msg));
    expect(c.errorClass).toBe('UNKNOWN_OUTCOME');
    expect(c.retryable).toBe(false);
    expect(c.reconciliationRequired).toBe(true);
  });
});

describe('transient network / DB → DEPENDENCY_RETRYABLE', () => {
  it.each([
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'timeout while querying',
    'rate limited by upstream',
    'connection terminated unexpectedly',
    'too many connections',
  ])('%s → DEPENDENCY_RETRYABLE + retryable', (msg) => {
    const c = classifyHandlerError(new Error(msg));
    expect(c.errorClass).toBe('DEPENDENCY_RETRYABLE');
    expect(c.retryable).toBe(true);
  });
});

describe('state drift → CONFLICT_STALE (client should refresh)', () => {
  it.each([
    'stale preview',
    'booking already cancelled',
    'quote version mismatch',
    'entity conflict',
    'record is outdated',
  ])('%s → CONFLICT_STALE + reconciliationRequired', (msg) => {
    const c = classifyHandlerError(new Error(msg));
    expect(c.errorClass).toBe('CONFLICT_STALE');
    expect(c.retryable).toBe(false);
    expect(c.reconciliationRequired).toBe(true);
  });
});

describe('permission → PERMISSION_FINAL (no retry)', () => {
  it.each([
    'forbidden: actor is not the assigned provider',
    'permission denied',
    'not authorized',
    'IDENTITY conflict on this account',
  ])('%s → PERMISSION_FINAL + NOT retryable', (msg) => {
    const c = classifyHandlerError(new Error(msg));
    expect(c.errorClass).toBe('PERMISSION_FINAL');
    expect(c.retryable).toBe(false);
  });
});

describe('validation → VALIDATION_FINAL (no retry, no reconciliation)', () => {
  it.each([
    'invalid input: missing entityId',
    'missing required field email',
    'must be a number',
    'schema validation failed',
    'malformed request',
  ])('%s → VALIDATION_FINAL', (msg) => {
    const c = classifyHandlerError(new Error(msg));
    expect(c.errorClass).toBe('VALIDATION_FINAL');
    expect(c.retryable).toBe(false);
    expect(c.reconciliationRequired).toBe(false);
  });
});

describe('CEO §47 default — unknown errors are UNKNOWN_OUTCOME, never final failed', () => {
  it('a generic Error → UNKNOWN_OUTCOME + reconciliationRequired', () => {
    const c = classifyHandlerError(new Error('something unexpected happened'));
    expect(c.errorClass).toBe('UNKNOWN_OUTCOME');
    expect(c.retryable).toBe(false);
    expect(c.reconciliationRequired).toBe(true);
  });

  it('a non-Error thrown value → UNKNOWN_OUTCOME (never crashes classifier)', () => {
    expect(classifyHandlerError(42).errorClass).toBe('UNKNOWN_OUTCOME');
    expect(classifyHandlerError(undefined).errorClass).toBe('UNKNOWN_OUTCOME');
    expect(classifyHandlerError(null).errorClass).toBe('UNKNOWN_OUTCOME');
    expect(classifyHandlerError('generic string').errorClass).toBe('UNKNOWN_OUTCOME');
  });
});
