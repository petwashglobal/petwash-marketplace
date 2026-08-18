/**
 * P0-143 CEO fix — Secure Inbox identity + privacy regression pin.
 *
 * Source-pin assertions (not full-app boot). Locks in the new
 * contract so a future refactor cannot silently re-open the
 * pre-fix holes:
 *
 *   - /lookup-user is retired (410) — no more UID leakage.
 *   - New /lookup-check returns only { exists: boolean } — no uid/email/name.
 *   - /send derives sender uid/email/name from the token; body only
 *     accepts recipientEmail + message content.
 *   - Zod sendSchema rejects senderId/senderName/senderEmail/recipientId
 *     (unknown fields are dropped since .safeParse defaults to strip).
 *   - Every 5xx response returns a generic mapped string plus an
 *     INBOX_*_500 code — no raw error.message.
 *   - DTOs never contain gcsBackupPath / backupStatus /
 *     permanentlyDeleted / deletedBySender / deletedByRecipient.
 *   - Per-instance rate limits on /send and /lookup-check.
 *   - Client PersonalInbox.tsx sends only { recipientEmail, subject,
 *     body, messageType, priority } — no more senderId/senderName/
 *     senderEmail/recipientId/recipientName body fields.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SERVER = readFileSync(resolve(__dirname, '..', 'routes', 'messages.ts'), 'utf8');
const CLIENT = readFileSync(
  resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'PersonalInbox.tsx'),
  'utf8',
);

describe('server — /lookup-user is retired', () => {
  it('returns 410 ENDPOINT_RETIRED', () => {
    expect(SERVER).toContain("router.get('/lookup-user'");
    expect(SERVER).toContain('res.status(410)');
    expect(SERVER).toContain("'ENDPOINT_RETIRED'");
    expect(SERVER).toContain('lookup-user was retired');
  });
  it('does NOT return uid / displayName / email for arbitrary emails', () => {
    // The whole file must not return userRecord.uid to the client on any
    // NON-send route.
    const retired = SERVER.slice(SERVER.indexOf("router.get('/lookup-user'"), SERVER.indexOf("router.get('/inbox'"));
    expect(retired).not.toMatch(/userRecord\.uid/);
    expect(retired).not.toMatch(/userRecord\.displayName/);
  });
});

describe('server — /lookup-check returns exists-only, rate-limited', () => {
  it('is registered and reads req.query.email', () => {
    expect(SERVER).toContain("router.get('/lookup-check'");
    expect(SERVER).toContain("req.query.email");
  });
  it('returns only { exists: boolean } — never uid/email/name', () => {
    const idx = SERVER.indexOf("router.get('/lookup-check'");
    const region = SERVER.slice(idx, idx + 2500);
    expect(region).toContain('return res.json({ exists: !!userRecord })');
    expect(region).not.toContain('userRecord.uid');
    expect(region).not.toContain('userRecord.displayName');
  });
  it('is rate-limited via lookupHits', () => {
    const idx = SERVER.indexOf("router.get('/lookup-check'");
    const region = SERVER.slice(idx, idx + 1500);
    expect(region).toContain('hitAndCheck(lookupHits');
    expect(region).toContain("'RATE_LIMITED'");
  });
});

describe('server — /send derives sender from token, resolves recipient server-side', () => {
  it('calls resolveAuthoritativeSender(req)', () => {
    const idx = SERVER.indexOf("router.post('/send'");
    const region = SERVER.slice(idx, idx + 4000);
    expect(region).toContain('resolveAuthoritativeSender(req)');
  });
  it('rate-limited via sendHits per-uid', () => {
    const idx = SERVER.indexOf("router.post('/send'");
    const region = SERVER.slice(idx, idx + 4000);
    expect(region).toContain('hitAndCheck(sendHits, sender.uid');
    expect(region).toContain("'RATE_LIMITED'");
  });
  it('sendSchema accepts only recipientEmail + content fields (no sender/recipient identity)', () => {
    const start = SERVER.indexOf('const sendSchema = z.object({');
    const end = SERVER.indexOf('});', start);
    const schema = SERVER.slice(start, end);
    expect(schema).toContain('recipientEmail: z.string().email()');
    expect(schema).toContain('subject: z.string()');
    expect(schema).toContain('body: z.string()');
    expect(schema).not.toMatch(/\bsenderId\b/);
    expect(schema).not.toMatch(/\bsenderName\b/);
    expect(schema).not.toMatch(/\bsenderEmail\b/);
    expect(schema).not.toMatch(/\brecipientId\b/);
    expect(schema).not.toMatch(/\brecipientName\b/);
  });
  it('canonical write set uses sender.uid / sender.email / sender.displayName from token', () => {
    const idx = SERVER.indexOf("router.post('/send'");
    const region = SERVER.slice(idx, idx + 5000);
    expect(region).toContain('senderId: sender.uid');
    expect(region).toContain('senderEmail: sender.email');
    expect(region).toContain('senderName: sender.displayName');
  });
  it('recipient uid + name are resolved server-side via fbAuth.getUserByEmail', () => {
    const idx = SERVER.indexOf("router.post('/send'");
    const region = SERVER.slice(idx, idx + 5000);
    expect(region).toMatch(/fbAuth\.getUserByEmail\(recipientEmail\)/);
    expect(region).toContain('recipientRecord.uid');
    expect(region).toContain("'RECIPIENT_NOT_FOUND'");
  });
  it('audit metadata hashes the recipient email instead of storing it raw', () => {
    const idx = SERVER.indexOf("router.post('/send'");
    const region = SERVER.slice(idx, idx + 6000);
    expect(region).toContain('recipientEmailHashed:');
    expect(region).not.toMatch(/recipientEmail:\s*recipientEmail,/); // no raw echo into audit
  });
});

describe('server — every 5xx has a generic mapped body + code discriminator', () => {
  it('no res.status(500).json({ error: error.message })', () => {
    // Whole file walk.
    const RX = /res\.status\(5\d\d\)\s*\.json\(/g;
    let m: RegExpExecArray | null;
    while ((m = RX.exec(SERVER)) !== null) {
      const start = m.index + m[0].length;
      let depth = 1;
      let i = start;
      while (i < SERVER.length && depth > 0) {
        const c = SERVER[i];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        i++;
      }
      const body = SERVER.slice(start, i);
      expect(body).not.toMatch(/\berror\.message\b/);
      expect(body).not.toMatch(/\berr\.message\b/);
    }
  });
  it('declares INBOX_*_500 discriminator codes', () => {
    for (const c of [
      "'INBOX_LIST_500'",
      "'INBOX_GET_500'",
      "'INBOX_SEND_500'",
      "'INBOX_STAR_500'",
      "'INBOX_READ_500'",
      "'INBOX_DELETE_500'",
      "'INBOX_UNREAD_500'",
      "'INBOX_LOOKUP_500'",
    ]) {
      expect(SERVER).toContain(c);
    }
  });
});

describe('server — customer DTO drops internal / backup fields', () => {
  it('toInboxMessageDto shape has no gcsBackupPath / backupStatus / permanentlyDeleted / deleted*By*', () => {
    const start = SERVER.indexOf('function toInboxMessageDto');
    const end = SERVER.indexOf('function toAttachmentDto', start);
    const region = SERVER.slice(start, end);
    for (const bad of [
      'gcsBackupPath',
      'backupStatus',
      'permanentlyDeleted',
      'deletedBySender',
      'deletedByRecipient',
    ]) {
      expect(region).not.toContain(bad);
    }
  });
});

describe('client — PersonalInbox.tsx sends only content fields (no identity spoof surface)', () => {
  it('no more /lookup-user call (retired)', () => {
    expect(CLIENT).not.toMatch(/\/api\/messages\/lookup-user/);
  });
  it('sendMessageMutation body carries only { recipientEmail, subject, body, messageType, priority }', () => {
    // Locate handleSendMessage → sendMessageMutation.mutate({...}) block.
    const idx = CLIENT.indexOf('const handleSendMessage');
    const region = CLIENT.slice(idx, idx + 2500);
    expect(region).toMatch(/sendMessageMutation\.mutate\(\{[\s\S]{0,600}?recipientEmail,/);
    // These identity fields must NOT be part of the send payload anymore.
    for (const bad of [
      'senderId: firebaseUser.uid',
      'senderName: firebaseUser',
      'senderEmail: firebaseUser',
      'recipientId: recipientData.uid',
    ]) {
      expect(region).not.toContain(bad);
    }
  });
});
