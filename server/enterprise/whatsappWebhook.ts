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
const META_WEBHOOK_SECRET = process.env.META_WEBHOOK_SECRET;

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
 * Verify Meta's webhook signature for security
 */
function verifyMetaSignature(req: Request): boolean {
  if (!META_WEBHOOK_SECRET) {
    logger.warn('[WhatsApp] META_WEBHOOK_SECRET not configured - signature verification disabled');
    return true; // Allow in development
  }
  
  const signature = req.headers['x-hub-signature-256'] as string;
  
  if (!signature) {
    return false;
  }
  
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', META_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
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
      type: message.type
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
        phoneNumber: customerPhone
      }, { merge: true });
    
    logger.info('[WhatsApp] Assigned customer to staff', {
      customer: customerPhone,
      staff: assignedStaffUid
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
        body: message.substring(0, 100) + (message.length > 100 ? '...' : '')
      },
      data: {
        type: 'whatsapp_message',
        customerPhone,
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'OPEN_INBOX'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
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
        res.status(200).send(challenge);
        return;
      } else {
        res.status(403).send('Forbidden');
        return;
      }
    }
    
    // Message webhook (POST request)
    // 1. Verify signature
    if (!verifyMetaSignature(req)) {
      logger.warn('[WhatsApp] Invalid webhook signature');
      res.status(403).send('Unauthorized webhook source');
      return;
    }
    
    // 2. Parse message
    const messageData = parseWhatsAppMessage(req.body);
    
    if (!messageData || !messageData.text) {
      // Not a text message, or no message
      res.status(200).send('OK');
      return;
    }
    
    const { from: fromPhoneNumber, text, id: messageId } = messageData;
    
    logger.info('[WhatsApp] Received message', {
      from: fromPhoneNumber,
      messageId,
      text: text.body.substring(0, 50)
    });
    
    // 3. Find available staff member
    const assignedStaffUid = await findAvailableStaff(fromPhoneNumber);
    
    // 4. Write message to staff's inbox
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
          messageType: messageData.type
        }
      });
    
    // 5. Increment staff message counter
    await firestoreDb
      .collection('users')
      .doc(assignedStaffUid)
      .update({
        messageCount: admin.firestore.FieldValue.increment(1)
      });
    
    // 6. Send push notification
    await sendFCMNotification(assignedStaffUid, text.body, fromPhoneNumber);
    
    logger.info('[WhatsApp] Message routed successfully', {
      from: fromPhoneNumber,
      to: assignedStaffUid
    });
    
    res.status(200).send('OK');
    
  } catch (error: any) {
    logger.error('[WhatsApp] Webhook handling failed:', error);
    res.status(500).send('Internal Server Error');
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
        direction: 'outbound'
      });
    
    logger.info('[WhatsApp] Outbound message sent', {
      to,
      from: fromStaffUid
    });
    
    return true;
    
  } catch (error: any) {
    logger.error('[WhatsApp] Send message failed:', error);
    return false;
  }
}
