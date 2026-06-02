/**
 * Maya WhatsApp — inbound lead-bot webhook.
 *
 *   POST /api/maya/whatsapp/inbound   — Twilio WhatsApp inbound message webhook
 *
 * Public (Twilio calls it). Auth = Twilio HMAC signature (TWILIO_AUTH_TOKEN),
 * verified against the canonical petwash.co.il hosts (shared with voice).
 *
 * Behaviour: classify the message → reply honestly (opening soon in Kfar Saba,
 * never invents prices/hours) → thread into a maya_conversation → capture the
 * sender as a maya_lead on first contact. Reply is returned as TwiML <Message>
 * so Twilio delivers it — no separate send-API call / credentials needed here.
 *
 * Gated by ff.maya.whatsapp.enabled (default ON). The REAL activation gate is
 * connecting the number as a Twilio WhatsApp sender (Meta business verification);
 * until then no inbound traffic reaches this route.
 */
import { Router, type Request, type Response } from 'express';
import express from 'express';
import { logger } from '../lib/logger';
import { getFeatureFlag } from '../services/SystemConfig';
import { verifyTwilioSignature, buildCandidatePublicUrls } from '../services/voice/twilioHmac';
import * as Maya from '../services/MayaService';
import { composeReply } from '../services/maya/whatsappResponder';

const router = Router();
const ACTOR: Maya.MayaActor = { type: 'system', id: 'whatsapp' };

// Twilio posts application/x-www-form-urlencoded.
router.use(express.urlencoded({ extended: false }));

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string),
  );
}
function messageTwiml(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Message>${escapeXml(text)}</Message>\n</Response>`;
}
function emptyTwiml(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>';
}

function verifySignature(req: Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  if (!authToken) return false;
  const sig = req.headers['x-twilio-signature'];
  if (typeof sig !== 'string' || sig.length === 0) return false;
  return buildCandidatePublicUrls(req).some((publicUrl) =>
    verifyTwilioSignature(req, { authToken, publicUrl }),
  );
}

router.post('/inbound', async (req: Request, res: Response) => {
  // Flag OFF → Maya stays silent so a human can handle the chat.
  let enabled = true;
  try {
    enabled = await getFeatureFlag('ff.maya.whatsapp.enabled');
  } catch {
    enabled = true; // fail-open to the CEO default; real gate is the Twilio connection
  }
  if (!enabled) return res.type('application/xml').status(200).send(emptyTwiml());

  if (!verifySignature(req)) {
    logger.warn({}, 'maya whatsapp: signature verification failed');
    return res.status(403).json({ ok: false, error: 'invalid_signature' });
  }

  const body = (req.body ?? {}) as Record<string, string>;
  const phone = (body.From || '').replace(/^whatsapp:/i, '').trim(); // 'whatsapp:+9725...' → '+9725...'
  const text = (body.Body || '').trim();
  const profileName = (body.ProfileName || '').trim() || null;
  if (!phone || !text) return res.type('application/xml').status(200).send(emptyTwiml());

  try {
    const { reply, intent, locale } = composeReply(text, profileName ?? undefined);

    // Thread into an existing open conversation, or open one + capture the lead.
    let conv = await Maya.findOpenConversationByPhone(phone, 'whatsapp');
    let isNewContact = false;
    if (!conv) {
      conv = await Maya.createConversation(
        { channel: 'whatsapp', locale, contactPhone: phone, contactName: profileName },
        ACTOR,
      );
      isNewContact = true;
    }
    await Maya.appendMessage(conv.id, { role: 'user', content: text, locale }, ACTOR);
    await Maya.appendMessage(conv.id, { role: 'maya', content: reply, locale }, ACTOR);

    if (isNewContact) {
      await Maya.createLead(
        {
          conversationId: conv.id,
          name: profileName,
          phone,
          email: null,
          city: null,
          intent: `whatsapp:${intent} — "${text.slice(0, 140)}"`,
          source: 'whatsapp',
          notes: null,
        },
        ACTOR,
      );
    }

    return res.type('application/xml').status(200).send(messageTwiml(reply));
  } catch (err) {
    logger.error({ err }, 'maya whatsapp /inbound failed');
    // Fail soft: 200 empty so WhatsApp/Twilio doesn't retry-storm.
    return res.type('application/xml').status(200).send(emptyTwiml());
  }
});

export default router;
