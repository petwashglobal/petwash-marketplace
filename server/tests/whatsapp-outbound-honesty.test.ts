/**
 * WhatsApp outbound honesty + inbound auth (audit B-2 & B-5).
 *
 * B-2: outbound customer WhatsApp must never fake success.
 *   - GoogleMessagingService.sendWhatsAppMessage (called by gift-card delivery,
 *     campaigns, meeting reminders) previously did NOT exist on the class — the
 *     await threw a swallowed TypeError, so nothing was sent and the failure was
 *     invisible. It must now delegate to the real Meta sender.
 *   - whatsappWebhook.sendWhatsAppMessage previously wrote a Firestore row and
 *     returned true unconditionally. It must actually send and return the real
 *     delivery outcome.
 *
 * B-5: the inbound webhook signature check must fail CLOSED in production when
 *   META_WEBHOOK_SECRET is unset (otherwise anyone can forge inbound messages).
 *
 * Source-introspection so the guarantees can't silently regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SERVER = path.resolve(__dirname, '..');
const gmsSrc = fs.readFileSync(path.join(SERVER, 'services', 'GoogleMessagingService.ts'), 'utf8');
const webhookSrc = fs.readFileSync(path.join(SERVER, 'enterprise', 'whatsappWebhook.ts'), 'utf8');

describe('GoogleMessagingService.sendWhatsAppMessage — real send, no fake success', () => {
  it('defines the method its callers invoke (gift-cards / campaigns / meetings)', () => {
    expect(gmsSrc).toMatch(/static async sendWhatsAppMessage\s*\(/);
  });

  it('delegates to the real Meta sender WhatsAppService.sendMessage', () => {
    expect(gmsSrc).toMatch(/import\s*\{[^}]*WhatsAppService[^}]*\}\s*from\s*'\.\/WhatsAppService'/);
    const start = gmsSrc.indexOf('static async sendWhatsAppMessage');
    const slice = gmsSrc.slice(start, start + 600);
    expect(slice).toContain('WhatsAppService.sendMessage');
    // Must return the real result / false — never a hardcoded true.
    expect(slice).not.toMatch(/return true;/);
  });
});

describe('whatsappWebhook.sendWhatsAppMessage — delivers, returns real outcome', () => {
  const start = webhookSrc.indexOf('export async function sendWhatsAppMessage');
  const slice = webhookSrc.slice(start, start + 2400);

  it('actually calls the Meta sender', () => {
    expect(slice).toContain('WhatsAppService.sendMessage');
  });

  it('returns the real delivery boolean, not an unconditional true', () => {
    expect(slice).toContain('return delivered;');
    expect(slice).not.toMatch(/return true;/);
  });

  it('stamps the inbox record with the real outcome (sent vs failed)', () => {
    expect(slice).toMatch(/status:\s*delivered \? 'sent' : 'failed'/);
  });
});

describe('verifyMetaSignature — fail closed in production (B-5)', () => {
  const start = webhookSrc.indexOf('function verifyMetaSignature');
  const slice = webhookSrc.slice(start, start + 900);

  it('rejects inbound webhooks in production when the secret is unset', () => {
    const branchStart = slice.indexOf('if (!META_WEBHOOK_SECRET)');
    const branch = slice.slice(branchStart, branchStart + 900);
    expect(branch).toMatch(/process\.env\.NODE_ENV === 'production'/);
    expect(branch).toMatch(/return false;/);
    // Dev convenience (return true) still exists, but only outside production.
    expect(branch).toMatch(/return true;/);
  });
});
