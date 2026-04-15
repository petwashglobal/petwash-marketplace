/**
 * PetWash™ — Tranzila Webhook Hardening Tests
 *
 * Tests:
 *   §A — valid HMAC signature accepted
 *   §B — invalid HMAC signature rejected
 *   §C — missing signature header rejected
 *   §D — duplicate event dedup key construction
 *   §E — bypass flag works ONLY when explicitly set to "true"
 *   §F — startup guard throws when bypass=true in production
 *   §G — startup guard throws when bypass=true in staging
 *   §H — no PayPal references in Tranzila source files
 *
 * Run: node --test tests/tranzila-webhook-hardening.test.js
 *
 * These tests exercise the signature algorithm, dedup key logic, and startup
 * guard directly without starting a real server or requiring Redis.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SECRET = 'test-secret-value-32chars-minimum!!';

/** Build an HMAC-SHA256 signature in the format Tranzila sends. */
function buildSignature(body, secret) {
  const digest = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${digest}`;
}

/**
 * Pure re-implementation of TranzilaWebhookService.verifySignature logic.
 * Kept in sync with the source to test the exact same algorithm.
 * Uses process.env directly, so callers must set/unset env vars around calls.
 */
function tranzilaVerifySignature(rawBody, signatureHeader) {
  const secret = process.env.TRANZILA_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, rejectReason: 'missing_secret' };
  }
  if (!signatureHeader) {
    return { ok: false, rejectReason: 'missing_signature' };
  }
  if (process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE === 'true') {
    return { ok: true };
  }
  try {
    const expectedDigest = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const expected = `sha256=${expectedDigest}`;

    // Pad to equal length before timingSafeEqual to avoid throwing on length mismatch
    const sig = Buffer.alloc(expected.length, 0);
    Buffer.from(signatureHeader).copy(sig);
    const exp = Buffer.from(expected);

    const match = sig.length === exp.length && crypto.timingSafeEqual(sig, exp);
    if (!match) return { ok: false, rejectReason: 'invalid_signature' };
    return { ok: true };
  } catch {
    return { ok: false, rejectReason: 'signature_error' };
  }
}

/**
 * Re-implementation of the startup guard logic from server/index.ts.
 * Throws with the same message as the real guard when bypass=true in prod/staging.
 */
function runStartupBypassGuard(env, bypassValue) {
  const origEnv    = process.env.NODE_ENV;
  const origBypass = process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;

  process.env.NODE_ENV = env;
  process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE = bypassValue;

  try {
    const currentEnv = (process.env.NODE_ENV || '').toLowerCase();
    const bypassSet  = process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE === 'true';
    if (bypassSet && (currentEnv === 'production' || currentEnv === 'staging')) {
      throw new Error(
        'Startup aborted: TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true is forbidden in ' + currentEnv,
      );
    }
  } finally {
    if (origEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origEnv;
    if (origBypass === undefined) delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    else process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE = origBypass;
  }
}

/** Build a dedup key (mirrors logic in tranzila-webhooks.ts). */
function buildDedupKey(event, payload) {
  const parts = ['trz-wh', event];
  if (payload.tran_num)                   parts.push(payload.tran_num);
  if (payload.payment_request_id)         parts.push(payload.payment_request_id);
  if (payload.chargeback_case_id)         parts.push(payload.chargeback_case_id);
  if (payload.settlement_batch_reference) parts.push(payload.settlement_batch_reference);
  if (payload.doc_number)                 parts.push(payload.doc_number);
  if (payload.event_at)                   parts.push(payload.event_at);
  return parts.join(':');
}

// ─────────────────────────────────────────────────────────────────────────────
// §A — valid signature accepted
// ─────────────────────────────────────────────────────────────────────────────

describe('§A — valid HMAC signature accepted', () => {
  test('Buffer body: returns { ok: true }', () => {
    const body = Buffer.from(JSON.stringify({ event: 'payment_success', tran_num: 'TRZ001' }));
    const sig  = buildSignature(body, SECRET);

    process.env.TRANZILA_WEBHOOK_SECRET = SECRET;
    delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    const result = tranzilaVerifySignature(body, sig);
    delete process.env.TRANZILA_WEBHOOK_SECRET;

    assert.deepEqual(result, { ok: true });
  });

  test('String body: returns { ok: true }', () => {
    const bodyStr = '{"event":"refund_success","tran_num":"TRZ002"}';
    const sig     = buildSignature(bodyStr, SECRET);

    process.env.TRANZILA_WEBHOOK_SECRET = SECRET;
    delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    const result = tranzilaVerifySignature(bodyStr, sig);
    delete process.env.TRANZILA_WEBHOOK_SECRET;

    assert.deepEqual(result, { ok: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §B — invalid signature rejected
// ─────────────────────────────────────────────────────────────────────────────

describe('§B — invalid signature rejected', () => {
  test('Wrong key: rejectReason is invalid_signature', () => {
    const body   = Buffer.from('{"event":"payment_success","tran_num":"T1"}');
    const badSig = buildSignature(body, 'wrong-secret');

    process.env.TRANZILA_WEBHOOK_SECRET = SECRET;
    delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    const result = tranzilaVerifySignature(body, badSig);
    delete process.env.TRANZILA_WEBHOOK_SECRET;

    assert.equal(result.ok, false);
    assert.equal(result.rejectReason, 'invalid_signature');
  });

  test('Tampered body: rejectReason is invalid_signature', () => {
    const body         = Buffer.from('{"event":"payment_success","tran_num":"T2"}');
    const tamperedBody = Buffer.from('{"event":"payment_success","tran_num":"T2_TAMPERED"}');
    const sig          = buildSignature(body, SECRET);

    process.env.TRANZILA_WEBHOOK_SECRET = SECRET;
    delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    const result = tranzilaVerifySignature(tamperedBody, sig);
    delete process.env.TRANZILA_WEBHOOK_SECRET;

    assert.equal(result.ok, false);
    assert.equal(result.rejectReason, 'invalid_signature');
  });

  test('Malformed header (no sha256= prefix): rejected', () => {
    const body = Buffer.from('{"event":"payment_success"}');
    const sig  = 'notavalidhmac1234';

    process.env.TRANZILA_WEBHOOK_SECRET = SECRET;
    delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    const result = tranzilaVerifySignature(body, sig);
    delete process.env.TRANZILA_WEBHOOK_SECRET;

    assert.equal(result.ok, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §C — missing signature header rejected
// ─────────────────────────────────────────────────────────────────────────────

describe('§C — missing signature header rejected', () => {
  test('undefined header: rejectReason is missing_signature', () => {
    const body = Buffer.from('{"event":"payment_success"}');

    process.env.TRANZILA_WEBHOOK_SECRET = SECRET;
    delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    const result = tranzilaVerifySignature(body, undefined);
    delete process.env.TRANZILA_WEBHOOK_SECRET;

    assert.equal(result.ok, false);
    assert.equal(result.rejectReason, 'missing_signature');
  });

  test('empty string header: treated as missing', () => {
    const body = Buffer.from('{"event":"payment_success"}');

    process.env.TRANZILA_WEBHOOK_SECRET = SECRET;
    delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    const result = tranzilaVerifySignature(body, '');
    delete process.env.TRANZILA_WEBHOOK_SECRET;

    assert.equal(result.ok, false);
    assert.equal(result.rejectReason, 'missing_signature');
  });

  test('secret not configured: rejectReason is missing_secret', () => {
    const body = Buffer.from('{"event":"payment_success"}');
    const sig  = buildSignature(body, SECRET);

    delete process.env.TRANZILA_WEBHOOK_SECRET;
    delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    const result = tranzilaVerifySignature(body, sig);

    assert.equal(result.ok, false);
    assert.equal(result.rejectReason, 'missing_secret');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §D — duplicate event dedup key construction
// ─────────────────────────────────────────────────────────────────────────────

describe('§D — duplicate event dedup key construction', () => {
  test('Same payload produces same key (idempotency)', () => {
    const payload = { event: 'payment_success', tran_num: 'TRZ001', event_at: '2026-04-15T10:00:00Z' };
    assert.equal(buildDedupKey(payload.event, payload), buildDedupKey(payload.event, payload));
  });

  test('Different tran_num produces different key', () => {
    const p1 = { event: 'payment_success', tran_num: 'TRZ001' };
    const p2 = { event: 'payment_success', tran_num: 'TRZ002' };
    assert.notEqual(buildDedupKey(p1.event, p1), buildDedupKey(p2.event, p2));
  });

  test('Different event_at produces different key (legitimate re-events are distinct)', () => {
    const p1 = { event: 'payment_success', tran_num: 'TRZ001', event_at: '2026-04-15T10:00:00Z' };
    const p2 = { event: 'payment_success', tran_num: 'TRZ001', event_at: '2026-04-15T11:00:00Z' };
    assert.notEqual(buildDedupKey(p1.event, p1), buildDedupKey(p2.event, p2));
  });

  test('Chargeback key includes chargeback_case_id', () => {
    const p   = { event: 'chargeback_opened', tran_num: 'TRZ001', chargeback_case_id: 'CB-99' };
    const key = buildDedupKey(p.event, p);
    assert.ok(key.includes('CB-99'), 'Key must include chargeback case ID');
  });

  test('Payment request key includes payment_request_id', () => {
    const p   = { event: 'payment_request_paid', payment_request_id: 'PR-42' };
    const key = buildDedupKey(p.event, p);
    assert.ok(key.includes('PR-42'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §E — bypass flag works ONLY when explicitly set to "true"
// ─────────────────────────────────────────────────────────────────────────────

describe('§E — bypass flag behaviour', () => {
  test('bypass="true" with a header (any value) returns { ok: true }', () => {
    const body = Buffer.from('{"event":"payment_success"}');
    process.env.TRANZILA_WEBHOOK_SECRET           = SECRET;
    process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE = 'true';
    // Bypass skips HMAC match but header must still be present
    const result = tranzilaVerifySignature(body, 'sha256=invalid-but-present');
    delete process.env.TRANZILA_WEBHOOK_SECRET;
    delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    assert.deepEqual(result, { ok: true });
  });

  test('bypass="true" with no header still rejects (bypass does not waive header presence)', () => {
    const body = Buffer.from('{"event":"payment_success"}');
    process.env.TRANZILA_WEBHOOK_SECRET           = SECRET;
    process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE = 'true';
    const result = tranzilaVerifySignature(body, undefined);
    delete process.env.TRANZILA_WEBHOOK_SECRET;
    delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    // Missing header is rejected before bypass is checked — fail-safe behaviour
    assert.equal(result.ok, false);
    assert.equal(result.rejectReason, 'missing_signature');
  });

  test('bypass="1" (not "true"): NOT bypassed — missing signature still rejected', () => {
    const body = Buffer.from('{"event":"payment_success"}');
    process.env.TRANZILA_WEBHOOK_SECRET           = SECRET;
    process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE = '1';
    const result = tranzilaVerifySignature(body, undefined);
    delete process.env.TRANZILA_WEBHOOK_SECRET;
    delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    assert.equal(result.ok, false);
  });

  test('bypass="false": NOT bypassed', () => {
    const body = Buffer.from('{"event":"payment_success"}');
    process.env.TRANZILA_WEBHOOK_SECRET           = SECRET;
    process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE = 'false';
    const result = tranzilaVerifySignature(body, undefined);
    delete process.env.TRANZILA_WEBHOOK_SECRET;
    delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    assert.equal(result.ok, false);
  });

  test('bypass unset: normal signature check applies (valid sig accepted)', () => {
    const body = Buffer.from('{"event":"payment_success","tran_num":"T1"}');
    const sig  = buildSignature(body, SECRET);
    process.env.TRANZILA_WEBHOOK_SECRET = SECRET;
    delete process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE;
    const result = tranzilaVerifySignature(body, sig);
    delete process.env.TRANZILA_WEBHOOK_SECRET;
    assert.deepEqual(result, { ok: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §F — startup guard: production
// ─────────────────────────────────────────────────────────────────────────────

describe('§F — startup guard: production', () => {
  test('throws when bypass=true in production', () => {
    assert.throws(
      () => runStartupBypassGuard('production', 'true'),
      (err) => {
        assert.ok(
          err.message.includes('TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true is forbidden'),
          `Expected guard message, got: ${err.message}`,
        );
        assert.ok(err.message.includes('production'));
        return true;
      },
    );
  });

  test('does NOT throw when bypass=false in production', () => {
    assert.doesNotThrow(() => runStartupBypassGuard('production', 'false'));
  });

  test('does NOT throw when bypass is unset (empty string) in production', () => {
    assert.doesNotThrow(() => runStartupBypassGuard('production', ''));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §G — startup guard: staging
// ─────────────────────────────────────────────────────────────────────────────

describe('§G — startup guard: staging', () => {
  test('throws when bypass=true in staging', () => {
    assert.throws(
      () => runStartupBypassGuard('staging', 'true'),
      (err) => {
        assert.ok(err.message.includes('TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true is forbidden'));
        assert.ok(err.message.includes('staging'));
        return true;
      },
    );
  });

  test('does NOT throw when bypass=true in development', () => {
    assert.doesNotThrow(() => runStartupBypassGuard('development', 'true'));
  });

  test('does NOT throw when bypass=true in test', () => {
    assert.doesNotThrow(() => runStartupBypassGuard('test', 'true'));
  });

  test('does NOT throw when bypass=false in staging', () => {
    assert.doesNotThrow(() => runStartupBypassGuard('staging', 'false'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §H — no PayPal contamination in Tranzila source files
// ─────────────────────────────────────────────────────────────────────────────

describe('§H — no PayPal references in Tranzila source files', () => {
  const TRANZILA_FILES = [
    'server/services/TranzilaWebhookService.ts',
    'server/routes/tranzila-webhooks.ts',
    'server/routes/tranzila-event-webhooks.ts',
    'server/routes/finance/tranzila-admin.ts',
  ];

  const ROOT = path.resolve(__dirname, '..');

  for (const file of TRANZILA_FILES) {
    test(`${file} contains no PayPal references`, () => {
      const fullPath = path.join(ROOT, file);
      assert.ok(fs.existsSync(fullPath), `File not found: ${file}`);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.equal(
        /paypal/i.test(content),
        false,
        `PayPal reference found in ${file}`,
      );
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// §I — deployment gate: payment flags blocked when webhook not secured
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-implementation of the _isTranzilaWebhookSecured gate logic from
 * server/lib/payment-flags.ts.  Must be kept in sync.
 */
function computeWebhookSecured({ secret, bypass, allowedIPs, env }) {
  const hasSecret     = !!secret;
  const bypassActive  = bypass === 'true';
  const hasAllowedIPs = !!(allowedIPs || '').trim();
  const isRestricted  = env === 'production' || env === 'staging';

  if (!hasSecret)   return false;
  if (bypassActive) return false;
  if (isRestricted && !hasAllowedIPs) return false;
  return true;
}

describe('§I — deployment gate blocks live flags when webhook not secured', () => {
  test('secret missing → gate = false', () => {
    assert.equal(computeWebhookSecured({ secret: '', bypass: 'false', allowedIPs: '1.2.3.4', env: 'development' }), false);
  });

  test('bypass active → gate = false (any env)', () => {
    assert.equal(computeWebhookSecured({ secret: 'real-secret', bypass: 'true', allowedIPs: '1.2.3.4', env: 'development' }), false);
    assert.equal(computeWebhookSecured({ secret: 'real-secret', bypass: 'true', allowedIPs: '1.2.3.4', env: 'production' }), false);
  });

  test('production: no allowed IPs → gate = false', () => {
    assert.equal(computeWebhookSecured({ secret: 'real-secret', bypass: 'false', allowedIPs: '', env: 'production' }), false);
  });

  test('staging: no allowed IPs → gate = false', () => {
    assert.equal(computeWebhookSecured({ secret: 'real-secret', bypass: 'false', allowedIPs: '', env: 'staging' }), false);
  });

  test('development: no allowed IPs is OK (local dev loop) → gate = true', () => {
    assert.equal(computeWebhookSecured({ secret: 'real-secret', bypass: 'false', allowedIPs: '', env: 'development' }), true);
  });

  test('all conditions met in production → gate = true', () => {
    assert.equal(computeWebhookSecured({ secret: 'real-secret', bypass: 'false', allowedIPs: '1.2.3.4', env: 'production' }), true);
  });

  test('all conditions met in development (no IPs needed) → gate = true', () => {
    assert.equal(computeWebhookSecured({ secret: 'real-secret', bypass: 'false', allowedIPs: '', env: 'development' }), true);
  });

  test('gate false means TRANZILA_EGIFT_ENABLED resolves to false even if env var is "true"', () => {
    // If gate is false, the flag is blocked regardless of env-var value
    const gateResult = computeWebhookSecured({ secret: '', bypass: 'false', allowedIPs: '', env: 'development' });
    const egiftEnabled = gateResult && true; // mirrors: _isTranzilaWebhookSecured && process.env.TRANZILA_EGIFT_ENABLED === 'true'
    assert.equal(egiftEnabled, false, 'Flag must be false when gate is false');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §J — DB-level refund idempotency guard (WHERE logic)
// ─────────────────────────────────────────────────────────────────────────────

describe('§J — DB-level refund idempotency guard logic', () => {
  /**
   * Simulates the WHERE condition used in _handleRefundSuccess.
   * Returns true if the update should proceed (row is eligible for refund),
   * false if it should be skipped (already refunded).
   */
  function isEligibleForRefund({ status, processorRefundStatus }) {
    // Mirrors: ne(status, 'refunded') AND ne(processorRefundStatus, 'confirmed')
    return status !== 'refunded' && processorRefundStatus !== 'confirmed';
  }

  test('confirmed row (status=pending): eligible for refund', () => {
    assert.equal(isEligibleForRefund({ status: 'confirmed', processorRefundStatus: null }), true);
  });

  test('already refunded (status=refunded): NOT eligible — guard fires', () => {
    assert.equal(isEligibleForRefund({ status: 'refunded', processorRefundStatus: 'confirmed' }), false);
  });

  test('already confirmed refund status only: NOT eligible — belt-and-suspenders guard fires', () => {
    // Edge case: status not yet 'refunded' but processorRefundStatus already 'confirmed'
    // (partial update race). Guard still blocks.
    assert.equal(isEligibleForRefund({ status: 'confirmed', processorRefundStatus: 'confirmed' }), false);
  });

  test('status=declined: eligible (refund of a manually settled decline edge case)', () => {
    // declined rows should not have refunds in practice, but guard allows it
    assert.equal(isEligibleForRefund({ status: 'declined', processorRefundStatus: null }), true);
  });

  test('second delivery of same event: guard returns false — zero DB rows updated', () => {
    // Simulates two deliveries of refund_success for the same transaction.
    // First delivery: row is confirmed → eligible → update runs → row becomes refunded.
    // Second delivery: row is now refunded → guard fires → no update.
    let rowState = { status: 'confirmed', processorRefundStatus: null };

    // First delivery
    if (isEligibleForRefund(rowState)) {
      rowState = { status: 'refunded', processorRefundStatus: 'confirmed' };
    }
    assert.equal(rowState.status, 'refunded');

    // Second delivery
    const secondEligible = isEligibleForRefund(rowState);
    assert.equal(secondEligible, false, 'Guard must block second refund application');
  });
});
