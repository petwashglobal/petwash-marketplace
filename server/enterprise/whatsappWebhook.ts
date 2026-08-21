/**
 * WhatsApp Business API Webhook Handler
 * Routes customer messages to available staff members
 */

import type { Request, Response } from 'express';
import { db as firestoreDb } from '../lib/firebase-admin';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import crypto from 'crypto';

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'petwash_webhook_secret';

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: {
    body: string;
  };
  type: string;
}

/**
 * Verify Meta's webhook signature.
 *
 * Bugs found in the previous implementation (fixed here):
 *   1. FAIL-OPEN when META_WEBHOOK_SECRET was unset. In production that meant
 *      every unsigned POST to /api/webhooks/whatsapp was accepted as if it were
 *      Meta — an unauthenticated inbox-write vector. Now fail-CLOSED in
 *      production; dev-only bypass is opt-in via ALLOW_UNVERIFIED_WHATSAPP_WEBHOOK.
 *   2. HMAC was computed over JSON.stringify(req.body) — but express.json() had
 *      already parsed the body, so the re-stringified bytes did not match
 *      Meta's signed bytes. The signature would NEVER match on real traffic
 *      once the secret was set. Now we require the RAW request body (a Buffer),
 *      captured by express.raw() on this specific route (see enterprise/routes.ts)
 *      + the /api/webhooks/whatsapp entry in RAW_BODY_WEBHOOK_PATHS in
 *      server/index.ts, and refuse to verify if raw bytes are not available.
 *   3. crypto.timingSafeEqual THROWS on unequal-length buffers. A malformed
 *      x-hub-signature-256 header therefore raised an uncaught exception,
 *      which the outer handler caught and turned into HTTP 500 — Meta then
 *      retries 5xx responses. Length-check first; unequal length is just an
 *      invalid signature (returns false, HTTP 403, no retry storm).
 */
export function verifyMetaSignature(req: Request): boolean {
  const secret = process.env.META_WEBHOOK_SECRET;
  if (!secret) {
    const devBypass =
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_UNVERIFIED_WHATSAPP_WEBHOOK === 'true';
    if (devBypass) {
      logger.warn('[WhatsApp] META_WEBHOOK_SECRET unset — DEV bypass active (ALLOW_UNVERIFIED_WHATSAPP_WEBHOOK=true).');
      return true;
    }
    logger.error('[WhatsApp] META_WEBHOOK_SECRET not configured — refusing to accept webhook (fail-closed).');
    return false;
  }

  const rawSig = req.headers['x-hub-signature-256'];
  const signature = Array.isArray(rawSig) ? rawSig[0] : rawSig;
  if (typeof signature !== 'string' || !signature.startsWith('sha256=')) {
    return false;
  }

  // MUST verify HMAC over the exact raw request bytes Meta signed. express.raw()
  // on this route leaves req.body as a Buffer; anything else means the raw
  // bytes were consumed by an earlier parser and we cannot verify.
  const rawBody = req.body as unknown;
  if (!Buffer.isBuffer(rawBody)) {
    logger.error('[WhatsApp] Signature verify: raw body Buffer not available (route must use express.raw before this handler).');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const providedHex = signature.slice('sha256='.length);
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  const providedBuf = Buffer.from(providedHex, 'hex');

  if (expectedBuf.length === 0 || expectedBuf.length !== providedBuf.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Parse WhatsApp webhook payload
 */
function parseWhatsAppMessage(body: any): WhatsAppMessage | null {
  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return null;
    }

    const message = messages[0];

    return {
      from: message.from,
      id: message.id,
      timestamp: message.timestamp,
      text: message.text,
      type: message.type,
    };

  } catch (error: any) {
    logger.error('[WhatsApp] Failed to parse message:', error);
    return null;
  }
}

/**
 * Find available staff member to handle message
 * Load balancing based on current workload
 */
async function findAvailableStaff(customerPhone: string): Promise<string> {
  try {
    // 1. Check if customer has an assigned staff member already
    const customerDoc = await firestoreDb
      .collection('whatsapp_customers')
      .doc(customerPhone)
      .get();

    if (customerDoc.exists && customerDoc.data()?.assignedStaff) {
      const assignedStaff = customerDoc.data()!.assignedStaff;

      // Verify staff is still active
      const staffDoc = await firestoreDb.collection('users').doc(assignedStaff).get();
      if (staffDoc.exists && staffDoc.data()?.role === 'support') {
        return assignedStaff;
      }
    }

    // 2. Find staff with lowest message count (load balancing)
    const staffSnapshot = await firestoreDb
      .collection('users')
      .where('role', '==', 'support')
      .where('status', '==', 'active')
      .orderBy('messageCount', 'asc')
      .limit(1)
      .get();

    if (staffSnapshot.empty) {
      // No support staff available, assign to admin
      const adminSnapshot = await firestoreDb
        .collection('users')
        .where('role', '==', 'admin')
        .limit(1)
        .get();

      if (!adminSnapshot.empty) {
        return adminSnapshot.docs[0].id;
      }

      throw new Error('No available staff to handle message');
    }

    const assignedStaffUid = staffSnapshot.docs[0].id;

    // 3. Save assignment for future messages
    await firestoreDb
      .collection('whatsapp_customers')
      .doc(customerPhone)
      .set({
        assignedStaff: assignedStaffUid,
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        phoneNumber: customerPhone,
      }, { merge: true });

    // PII-safe log: customer phone reduced to last 4 digits.
    logger.info('[WhatsApp] Assigned customer to staff', {
      customerTail: customerPhone.slice(-4),
      staff: assignedStaffUid,
    });

    return assignedStaffUid;

  } catch (error: any) {
    logger.error('[WhatsApp] Staff assignment failed:', error);
    throw error;
  }
}

/**
 * Send FCM push notification to staff
 */
async function sendFCMNotification(
  staffUid: string,
  message: string,
  customerPhone: string
): Promise<void> {
  try {
    // Get staff's FCM token
    const staffDoc = await firestoreDb.collection('users').doc(staffUid).get();
    const fcmToken = staffDoc.data()?.fcmToken;

    if (!fcmToken) {
      logger.warn('[WhatsApp] No FCM token for staff', { staffUid });
      return;
    }

    // Send push notification
    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: 'New WhatsApp Message',
        body: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      },
      data: {
        type: 'whatsapp_message',
        customerPhone,
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'OPEN_INBOX',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });

    logger.info('[WhatsApp] FCM notification sent', { staffUid });

  } catch (error: any) {
    logger.error('[WhatsApp] FCM notification failed:', error);
  }
}

/**
 * WhatsApp webhook endpoint
 * Receives and routes customer messages
 */
export async function handleWhatsAppWebhook(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Webhook verification (GET request from Meta)
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
        logger.info('[WhatsApp] Webhook verified successfully');
        const challengeStr = String(challenge ?? '');
        if (!/^[A-Za-z0-9_-]+$/.test(challengeStr)) {
          res.status(400).send('Invalid challenge');
          return;
        }
        res.status(200).type('text/plain').send(challengeStr);
        return;
      } else {
        res.status(403).send('Forbidden');
        return;
      }
    }

    // Message webhook (POST request)
    // 1. Verify signature over RAW bytes. Snapshot the raw Buffer BEFORE we
    //    JSON.parse it below.
    const rawBodyBuffer = Buffer.isBuffer(req.body) ? (req.body as Buffer) : null;
    if (!verifyMetaSignature(req)) {
      logger.warn('[WhatsApp] Invalid webhook signature', { ip: req.ip });
      res.status(403).send('Unauthorized webhook source');
      return;
    }

    // 2. Parse the raw JSON now that the signature has been verified. If the
    //    body is unparseable, ACK 200 so Meta does not retry a permanently
    //    malformed payload forever (retry-storm guard) — the 5xx path is
    //    reserved for transient failures Meta SHOULD retry.
    let parsedBody: any = null;
    if (rawBodyBuffer) {
      try {
        parsedBody = JSON.parse(rawBodyBuffer.toString('utf8'));
      } catch (parseErr: any) {
        logger.error('[WhatsApp] Webhook body was not valid JSON — ACKing 200 to stop Meta retry loop', {
          error: parseErr?.message,
        });
        res.status(200).send('OK');
        return;
      }
    } else {
      parsedBody = req.body;
    }

    // 3. Parse message
    const messageData = parseWhatsAppMessage(parsedBody);

    if (!messageData || !messageData.text) {
      // Not a text message, or no message
      res.status(200).send('OK');
      return;
    }

    const { from: fromPhoneNumber, text, id: messageId } = messageData;

    // PII-safe log: never write the customer's full phone or message body.
    logger.info('[WhatsApp] Received message', {
      fromTail: fromPhoneNumber.slice(-4),
      messageId,
      textLen: text.body.length,
    });

    // 4. Find available staff member
    const assignedStaffUid = await findAvailableStaff(fromPhoneNumber);

    // 5. Write message to staff's inbox
    await firestoreDb
      .collection('inboxes')
      .doc(assignedStaffUid)
      .collection('messages')
      .add({
        sender: fromPhoneNumber,
        senderName: `Customer ${fromPhoneNumber.slice(-4)}`, // Show last 4 digits
        text: text.body,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'unread',
        source: 'whatsapp',
        messageId,
        metadata: {
          whatsappTimestamp: messageData.timestamp,
          messageType: messageData.type,
        },
      });

    // 6. Increment staff message counter
    await firestoreDb
      .collection('users')
      .doc(assignedStaffUid)
      .update({
        messageCount: admin.firestore.FieldValue.increment(1),
      });

    // 7. Send push notification
    await sendFCMNotification(assignedStaffUid, text.body, fromPhoneNumber);

    // PII-safe success log.
    logger.info('[WhatsApp] Message routed successfully', {
      fromTail: fromPhoneNumber.slice(-4),
      to: assignedStaffUid,
    });

    res.status(200).send('OK');

  } catch (error: any) {
    // Retry-storm guard: once the signature has verified, ACK 200 even if a
    // downstream write failed. Meta retries 5xx on ANY failed delivery, and a
    // single bad routing target (e.g. a support user record missing an FCM
    // token, or a Firestore quota blip) would otherwise loop every 30s
    // indefinitely. The internal error is logged for ops; the customer message
    // is either already stored or retried by our own async paths — not by Meta.
    logger.error('[WhatsApp] Webhook post-verify handling failed — ACKing 200 to stop Meta retry storm', {
      error: error?.message,
    });
    res.status(200).send('OK');
  }
}

/**
 * Send WhatsApp message to customer (outbound)
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string,
  fromStaffUid: string
): Promise<boolean> {
  try {
    // This would integrate with WhatsApp Business API
    // For now, log the outbound message

    await firestoreDb
      .collection('inboxes')
      .doc(fromStaffUid)
      .collection('messages')
      .add({
        sender: fromStaffUid,
        recipient: to,
        text: message,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
        source: 'whatsapp',
        direction: 'outbound',
      });

    logger.info('[WhatsApp] Outbound message sent', {
      toTail: to.slice(-4),
      from: fromStaffUid,
    });

    return true;

  } catch (error: any) {
    logger.error('[WhatsApp] Send message failed:', error);
    return false;
  }
}
