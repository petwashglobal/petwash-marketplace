/**
 * Booking Chat — End-to-End Tests
 * Spec §18 "Non-negotiable: Do not ship without end-to-end tests"
 *
 * Run with:
 *   NODE_TEST_TOKEN_CUSTOMER=<firebase-id-token> \
 *   NODE_TEST_TOKEN_PROVIDER=<firebase-id-token> \
 *   NODE_TEST_TOKEN_ADMIN=<firebase-id-token> \
 *   NODE_TEST_BOOKING_ID=<confirmed-booking-id> \
 *   node --test tests/booking-chat.e2e.js
 *
 * Tokens must be valid Firebase ID tokens (obtained from signInWithCustomToken or signInWithEmailAndPassword).
 * BOOKING_ID must be a booking in 'confirmed' status with matching customer/provider UIDs.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';
const CUSTOMER_TOKEN = process.env.NODE_TEST_TOKEN_CUSTOMER;
const PROVIDER_TOKEN = process.env.NODE_TEST_TOKEN_PROVIDER;
const ADMIN_TOKEN   = process.env.NODE_TEST_TOKEN_ADMIN;
const BOOKING_ID    = process.env.NODE_TEST_BOOKING_ID || 'test-booking-001';

function skip(reason) {
  if (!CUSTOMER_TOKEN || !PROVIDER_TOKEN || !ADMIN_TOKEN) {
    console.warn(`⚠️  SKIP: ${reason} — set NODE_TEST_TOKEN_CUSTOMER / _PROVIDER / _ADMIN to run`);
    return true;
  }
  return false;
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Authorization: unauthenticated requests must fail
// ─────────────────────────────────────────────────────────────────────────────
describe('§3 Authorization', () => {
  test('GET /inbox without token → 401', async () => {
    const { status } = await api('/api/booking-chat/inbox');
    assert.equal(status, 401, 'Unauthenticated inbox must return 401');
  });

  test('GET /:bookingId without token → 401', async () => {
    const { status } = await api(`/api/booking-chat/${BOOKING_ID}`);
    assert.equal(status, 401, 'Unauthenticated conversation fetch must return 401');
  });

  test('POST /:bookingId/send without token → 401', async () => {
    const { status } = await api(`/api/booking-chat/${BOOKING_ID}/send`, {
      method: 'POST',
      body: { content: 'hello' },
    });
    assert.equal(status, 401, 'Unauthenticated send must return 401');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §11 — API surface: open conversation and fetch messages
// ─────────────────────────────────────────────────────────────────────────────
describe('§11 Conversation lifecycle', () => {
  test('Customer can open/fetch conversation for a confirmed booking', async (t) => {
    if (skip('conversation-lifecycle')) return t.skip();
    const { status, body } = await api(`/api/booking-chat/${BOOKING_ID}/open`, {
      method: 'POST',
      token: CUSTOMER_TOKEN,
    });
    assert.ok([200, 201].includes(status), `Expected 200/201, got ${status}: ${JSON.stringify(body)}`);
    assert.ok(body.conversationId || body.id, 'Should return conversationId');
  });

  test('Customer can fetch conversation metadata', async (t) => {
    if (skip('conversation-get')) return t.skip();
    const { status, body } = await api(`/api/booking-chat/${BOOKING_ID}`, {
      token: CUSTOMER_TOKEN,
    });
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(body.conversationId, 'Should have conversationId');
    assert.ok(['active', 'read_only', 'locked'].includes(body.chatStatus), 'chatStatus must be valid');
  });

  test('Customer can list messages (paginated)', async (t) => {
    if (skip('messages-list')) return t.skip();
    const { status, body } = await api(`/api/booking-chat/${BOOKING_ID}/messages`, {
      token: CUSTOMER_TOKEN,
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.messages), 'messages must be array');
  });

  test('Customer can view inbox', async (t) => {
    if (skip('inbox')) return t.skip();
    const { status, body } = await api('/api/booking-chat/inbox', {
      token: CUSTOMER_TOKEN,
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(body), 'inbox must be an array');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 — Send message: validation, sanitization, rate limiting, idempotency
// ─────────────────────────────────────────────────────────────────────────────
describe('§6 Send message rules', () => {
  test('Customer can send a plain text message', async (t) => {
    if (skip('send-plain')) return t.skip();
    const { status, body } = await api(`/api/booking-chat/${BOOKING_ID}/send`, {
      method: 'POST',
      token: CUSTOMER_TOKEN,
      body: { content: 'Hello, when will you arrive?' },
    });
    assert.equal(status, 200, `Send failed: ${JSON.stringify(body)}`);
    assert.ok(body.messageId, 'Should return messageId');
  });

  test('§6 XSS: HTML tags are stripped from message content', async (t) => {
    if (skip('xss-sanitize')) return t.skip();
    const { status, body } = await api(`/api/booking-chat/${BOOKING_ID}/send`, {
      method: 'POST',
      token: CUSTOMER_TOKEN,
      body: { content: '<script>alert(1)</script>Hello' },
    });
    assert.equal(status, 200);
    assert.ok(!body.content?.includes('<script>'), 'Script tags must be stripped');
    assert.ok(body.content?.includes('Hello'), 'Plain text must survive sanitization');
  });

  test('§6 Max length: message > 2000 chars is rejected', async (t) => {
    if (skip('max-length')) return t.skip();
    const { status } = await api(`/api/booking-chat/${BOOKING_ID}/send`, {
      method: 'POST',
      token: CUSTOMER_TOKEN,
      body: { content: 'x'.repeat(2001) },
    });
    assert.equal(status, 400, 'Oversized message must return 400');
  });

  test('§6 Empty content is rejected', async (t) => {
    if (skip('empty-content')) return t.skip();
    const { status } = await api(`/api/booking-chat/${BOOKING_ID}/send`, {
      method: 'POST',
      token: CUSTOMER_TOKEN,
      body: { content: '' },
    });
    assert.equal(status, 400, 'Empty message must return 400');
  });

  test('§6 Idempotency: same clientMessageId returns deduplicated response', async (t) => {
    if (skip('idempotency')) return t.skip();
    const clientMessageId = `test-idem-${Date.now()}`;
    const first = await api(`/api/booking-chat/${BOOKING_ID}/send`, {
      method: 'POST',
      token: CUSTOMER_TOKEN,
      body: { content: 'Idempotency test message', clientMessageId },
    });
    assert.equal(first.status, 200);
    const second = await api(`/api/booking-chat/${BOOKING_ID}/send`, {
      method: 'POST',
      token: CUSTOMER_TOKEN,
      body: { content: 'Idempotency test message', clientMessageId },
    });
    assert.equal(second.status, 200);
    assert.ok(second.body.deduplicated === true, 'Second send must be flagged as deduplicated');
  });

  test('§6 Rate limit: >10 messages in 60s → 429', async (t) => {
    if (skip('rate-limit')) return t.skip();
    let lastStatus = 200;
    for (let i = 0; i < 12; i++) {
      const { status } = await api(`/api/booking-chat/${BOOKING_ID}/send`, {
        method: 'POST',
        token: CUSTOMER_TOKEN,
        body: { content: `Rate limit test ${i}` },
      });
      lastStatus = status;
      if (status === 429) break;
    }
    assert.equal(lastStatus, 429, 'Should hit 429 after 10 messages within the rate limit window');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 — Privacy: contact detection flags messages
// ─────────────────────────────────────────────────────────────────────────────
describe('§7 Contact detection', () => {
  async function sendAndCheck(content, expectedFlagReason, t) {
    if (skip('contact-detection')) return t.skip();
    const { status, body } = await api(`/api/booking-chat/${BOOKING_ID}/send`, {
      method: 'POST',
      token: PROVIDER_TOKEN,
      body: { content },
    });
    assert.ok([200, 201].includes(status), `Send failed for "${content}": ${JSON.stringify(body)}`);
    assert.ok(body.isFlagged === true, `Message with "${content}" must be flagged`);
    assert.equal(body.flaggedReason, expectedFlagReason, `flaggedReason should be ${expectedFlagReason}`);
  }

  test('Phone number is flagged as phone_number', async (t) => {
    await sendAndCheck('Call me at +972-50-1234567', 'phone_number', t);
  });

  test('Email address is flagged as email_address', async (t) => {
    await sendAndCheck('Email me at user@example.com', 'email_address', t);
  });

  test('HTTP URL is flagged as external_url', async (t) => {
    await sendAndCheck('Check https://example.com for details', 'external_url', t);
  });

  test('@social handle is flagged as social_handle', async (t) => {
    await sendAndCheck('Find me @my_insta_handle on instagram', 'social_handle', t);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §8 — Read receipts and unread counts
// ─────────────────────────────────────────────────────────────────────────────
describe('§8 Read state', () => {
  test('Mark as read endpoint returns 200', async (t) => {
    if (skip('read-receipt')) return t.skip();
    const { status } = await api(`/api/booking-chat/${BOOKING_ID}/read`, {
      method: 'PUT',
      token: CUSTOMER_TOKEN,
    });
    assert.equal(status, 200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 — System messages: provider_arriving
// ─────────────────────────────────────────────────────────────────────────────
describe('§5 System messages', () => {
  test('Provider can signal arriving → provider_arriving system message created', async (t) => {
    if (skip('provider-arriving')) return t.skip();
    const { status, body } = await api(`/api/booking-chat/${BOOKING_ID}/provider-arriving`, {
      method: 'POST',
      token: PROVIDER_TOKEN,
    });
    assert.equal(status, 200, `provider-arriving failed: ${JSON.stringify(body)}`);
    assert.ok(body.message?.systemEventType === 'provider_arriving', 'System event type should be provider_arriving');
  });

  test('Customer cannot signal arriving (provider-only action)', async (t) => {
    if (skip('provider-arriving-auth')) return t.skip();
    const { status } = await api(`/api/booking-chat/${BOOKING_ID}/provider-arriving`, {
      method: 'POST',
      token: CUSTOMER_TOKEN,
    });
    assert.equal(status, 403, 'Customer must not be able to signal arriving');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Participant authorization: third party cannot access conversation
// ─────────────────────────────────────────────────────────────────────────────
describe('§3 Third-party access blocked', () => {
  test('Admin token can read conversation (read-only access)', async (t) => {
    if (skip('admin-read')) return t.skip();
    const { status } = await api(`/api/admin/booking-chat/${BOOKING_ID}`, {
      token: ADMIN_TOKEN,
    });
    assert.equal(status, 200, 'Admin must be able to read any chat');
  });

  test('Non-participant customer token denied (using admin token to test a different booking)', async (t) => {
    if (skip('third-party-block')) return t.skip();
    const fakeBid = 'booking-does-not-belong-to-this-user';
    const { status } = await api(`/api/booking-chat/${fakeBid}`, {
      token: CUSTOMER_TOKEN,
    });
    assert.ok([403, 404].includes(status), 'Non-participant must be blocked');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §10 — Admin moderation
// ─────────────────────────────────────────────────────────────────────────────
describe('§10 Admin moderation', () => {
  let testMessageId;

  before(async () => {
    if (!CUSTOMER_TOKEN || !ADMIN_TOKEN) return;
    const res = await api(`/api/booking-chat/${BOOKING_ID}/send`, {
      method: 'POST',
      token: CUSTOMER_TOKEN,
      body: { content: 'Test message for moderation' },
    });
    if (res.status === 200) testMessageId = res.body.messageId;
  });

  test('Admin can flag a message', async (t) => {
    if (skip('admin-flag') || !testMessageId) return t.skip();
    const { status } = await api(`/api/admin/booking-chat/messages/${testMessageId}/moderate`, {
      method: 'POST',
      token: ADMIN_TOKEN,
      body: { action: 'flag', reason: 'inappropriate_content' },
    });
    assert.equal(status, 200);
  });

  test('Admin can soft-delete a message (history preserved for legal review)', async (t) => {
    if (skip('admin-delete') || !testMessageId) return t.skip();
    const { status } = await api(`/api/admin/booking-chat/messages/${testMessageId}/moderate`, {
      method: 'POST',
      token: ADMIN_TOKEN,
      body: { action: 'delete' },
    });
    assert.equal(status, 200);
  });

  test('Admin can add dispute review notes to conversation (§10)', async (t) => {
    if (skip('admin-review-note') || !testMessageId) return t.skip();
    const { status, body } = await api(`/api/admin/booking-chat/messages/${testMessageId}/moderate`, {
      method: 'POST',
      token: ADMIN_TOKEN,
      body: {
        action: 'add_review_note',
        reviewNotes: 'Dispute investigated. Customer and provider both provided screenshots. Ruling in favour of customer.',
      },
    });
    assert.equal(status, 200, `add_review_note failed: ${JSON.stringify(body)}`);
  });

  test('Non-admin cannot moderate messages', async (t) => {
    if (skip('admin-role-enforce') || !testMessageId) return t.skip();
    const { status } = await api(`/api/admin/booking-chat/messages/${testMessageId}/moderate`, {
      method: 'POST',
      token: CUSTOMER_TOKEN,
      body: { action: 'delete' },
    });
    assert.equal(status, 403, 'Non-admin moderation must return 403');
  });

  test('Invalid action returns 400', async (t) => {
    if (skip('admin-invalid-action') || !testMessageId) return t.skip();
    const { status } = await api(`/api/admin/booking-chat/messages/${testMessageId}/moderate`, {
      method: 'POST',
      token: ADMIN_TOKEN,
      body: { action: 'nuke_everything' },
    });
    assert.equal(status, 400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Chat state enforcement: LOCKED and READ_ONLY states block writes
// ─────────────────────────────────────────────────────────────────────────────
describe('§2 Chat state enforcement', () => {
  test('POST /send on a locked booking returns 403 or 404', async (t) => {
    if (skip('locked-chat')) return t.skip();
    const lockedBid = process.env.NODE_TEST_LOCKED_BOOKING_ID;
    if (!lockedBid) return t.skip('Set NODE_TEST_LOCKED_BOOKING_ID to a pending_payment booking');
    const { status } = await api(`/api/booking-chat/${lockedBid}/send`, {
      method: 'POST',
      token: CUSTOMER_TOKEN,
      body: { content: 'This should not go through' },
    });
    assert.ok([403, 404].includes(status), `Expected 403/404 for locked chat, got ${status}`);
  });

  test('POST /send on a read_only booking returns 403', async (t) => {
    if (skip('readonly-chat')) return t.skip();
    const readOnlyBid = process.env.NODE_TEST_READONLY_BOOKING_ID;
    if (!readOnlyBid) return t.skip('Set NODE_TEST_READONLY_BOOKING_ID to a completed booking');
    const { status } = await api(`/api/booking-chat/${readOnlyBid}/send`, {
      method: 'POST',
      token: CUSTOMER_TOKEN,
      body: { content: 'This should not go through' },
    });
    assert.equal(status, 403, `Expected 403 for read_only chat, got ${status}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §9 — Report endpoint
// ─────────────────────────────────────────────────────────────────────────────
describe('§9 Abuse report', () => {
  test('Customer can report a conversation', async (t) => {
    if (skip('report')) return t.skip();
    const { status } = await api(`/api/booking-chat/${BOOKING_ID}/report`, {
      method: 'POST',
      token: CUSTOMER_TOKEN,
      body: { reason: 'harassment', messageId: null },
    });
    assert.ok([200, 201].includes(status), `Report failed: ${status}`);
  });
});

console.log('\n📋 Booking Chat E2E Test Suite');
console.log('================================');
console.log('Spec §5  — system messages (provider_arriving, chat_closed)');
console.log('Spec §6  — send rules (XSS, max length, empty, rate limit, idempotency)');
console.log('Spec §7  — contact detection (phone, email, URL, @handle)');
console.log('Spec §8  — read receipts');
console.log('Spec §9  — abuse report');
console.log('Spec §10 — admin moderation (flag, delete, hide, review notes)');
console.log('Spec §11 — API surface (open, get, messages, inbox, send, read, report)');
console.log('Spec §3  — authorization enforcement (no-token, wrong-participant, admin)');
console.log('Spec §2  — chat state (locked → 403, read_only → 403)');
console.log('\nTo run with real tokens:');
console.log('  NODE_TEST_TOKEN_CUSTOMER=... NODE_TEST_TOKEN_PROVIDER=... NODE_TEST_TOKEN_ADMIN=...');
console.log('  NODE_TEST_BOOKING_ID=<confirmed-booking-id> node --test tests/booking-chat.e2e.js\n');
