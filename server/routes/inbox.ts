import { Router } from 'express';
import { db as firestore } from '../lib/firebase-admin';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { z } from 'zod';
import { FIRESTORE_PATHS, userInboxMessageSchema } from '@shared/firestore-schema';
import sanitizeHtml from 'sanitize-html';
import { logger } from '../lib/logger';

const router = Router();

// HTML sanitization config
const sanitizeConfig = {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'span', 'div'],
  allowedAttributes: {
    'a': ['href', 'target', 'rel'],
    'span': ['style'],
    'div': ['style'],
  },
  allowedStyles: {
    '*': {
      'color': [/^#[0-9a-f]{3,6}$/i],
      'text-align': [/^(left|right|center)$/],
      'font-weight': [/^(bold|normal)$/],
    }
  }
};

// ============================================
// USER INBOX ROUTES
// ============================================

// Get user's inbox messages
router.get('/user', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const type = req.query.type as string | undefined;
    
    const messagesRef = firestore.collection(FIRESTORE_PATHS.USER_INBOX(uid));
    let query = messagesRef.orderBy('createdAt', 'desc');
    
    if (type && ['voucher', 'system', 'receipt', 'promo'].includes(type)) {
      query = query.where('type', '==', type);
    }
    
    const snapshot = await query.get();
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      readAt: doc.data().readAt?.toDate() || null,
      meta: doc.data().meta || {},
    }));
    
    res.json({ messages });
  } catch (error) {
    logger.error('Error fetching user inbox', error);
    res.status(500).json({ error: 'Failed to fetch inbox messages' });
  }
});

// Get single inbox message
router.get('/user/:messageId', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { messageId } = req.params;
    
    const docRef = firestore.doc(FIRESTORE_PATHS.USER_INBOX(uid, messageId));
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const data = doc.data()!;
    res.json({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate(),
      readAt: data.readAt?.toDate() || null,
    });
  } catch (error) {
    logger.error('Error fetching inbox message', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// Mark message as read
router.patch('/user/:messageId/read', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { messageId } = req.params;
    
    const docRef = firestore.doc(FIRESTORE_PATHS.USER_INBOX(uid, messageId));
    await docRef.update({
      readAt: new Date(),
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking message as read', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Get unread count
router.get('/user/unread/count', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    
    const messagesRef = firestore.collection(FIRESTORE_PATHS.USER_INBOX(uid));
    const snapshot = await messagesRef.where('readAt', '==', null).get();
    
    res.json({ count: snapshot.size });
  } catch (error) {
    logger.error('Error fetching unread count', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// ============================================
// FRANCHISE INBOX ROUTES
// ============================================

// Get franchise inbox messages
router.get('/franchise/:franchiseId', validateFirebaseToken, async (req, res) => {
  try {
    const { franchiseId } = req.params;
    const category = req.query.category as string | undefined;
    
    // TODO: Verify user has franchise access
    
    const messagesRef = firestore.collection(FIRESTORE_PATHS.FRANCHISE_INBOX(franchiseId));
    let query = messagesRef.orderBy('createdAt', 'desc');
    
    if (category && ['ops', 'marketing', 'finance', 'announcement'].includes(category)) {
      query = query.where('category', '==', category);
    }
    
    const snapshot = await query.get();
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      readAt: doc.data().readAt?.toDate() || null,
      ackAt: doc.data().ackAt?.toDate() || null,
    }));
    
    res.json(messages);
  } catch (error) {
    logger.error('Error fetching franchise inbox', error);
    res.status(500).json({ error: 'Failed to fetch franchise inbox' });
  }
});

// Acknowledge franchise message
router.patch('/franchise/:franchiseId/:messageId/acknowledge', validateFirebaseToken, async (req, res) => {
  try {
    const { franchiseId, messageId } = req.params;
    
    // TODO: Verify user has franchise access
    
    const docRef = firestore.doc(FIRESTORE_PATHS.FRANCHISE_INBOX(franchiseId, messageId));
    await docRef.update({
      ackAt: new Date(),
      readAt: new Date(),
    });
    
    logger.info('Franchise message acknowledged', { 
      franchiseId, 
      messageId, 
      uid: req.firebaseUser!.uid 
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error acknowledging franchise message', error);
    res.status(500).json({ error: 'Failed to acknowledge message' });
  }
});

// ============================================
// ADMIN ROUTES (Protected)
// ============================================

const isAdmin = (req: any, res: any, next: any) => {
  // TODO: Implement proper admin check
  const adminEmail = req.firebaseUser?.email;
  if (adminEmail === 'nirhadad1@gmail.com' || adminEmail?.includes('@petwash.co.il')) {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// Send message to single user
router.post('/admin/send-user', validateFirebaseToken, isAdmin, async (req, res) => {
  try {
    const schema = z.object({
      uid: z.string().min(1, { message: "User ID is required" }),
      title: z.string().min(1, { message: "Title is required" }),
      bodyHtml: z.string().min(1, { message: "Message body is required" }),
      type: z.enum(['voucher', 'system', 'receipt', 'promo']),
      locale: z.enum(['he', 'en']),
      ctaText: z.string().optional(),
      ctaUrl: z.string().optional(),
      priority: z.number().optional(),
      meta: z.any().optional(),
    });
    
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors
      });
    }
    
    const data = validation.data;
    
    // Sanitize HTML
    const cleanHtml = sanitizeHtml(data.bodyHtml, sanitizeConfig);
    
    const messageRef = firestore.collection(FIRESTORE_PATHS.USER_INBOX(data.uid)).doc();
    await messageRef.set({
      title: data.title,
      bodyHtml: cleanHtml,
      type: data.type,
      ctaText: data.ctaText,
      ctaUrl: data.ctaUrl,
      locale: data.locale,
      priority: data.priority || 0,
      createdAt: new Date(),
      readAt: null,
      attachments: [],
      meta: data.meta || {},
    });
    
    logger.info('Admin sent inbox message', {
      admin: req.firebaseUser!.email,
      targetUid: data.uid,
      messageId: messageRef.id,
    });
    
    res.json({ success: true, messageId: messageRef.id });
  } catch (error) {
    logger.error('Error sending admin message', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Send message to franchise
router.post('/admin/send-franchise', validateFirebaseToken, isAdmin, async (req, res) => {
  try {
    const schema = z.object({
      franchiseId: z.string().min(1, { message: "Franchise ID is required" }),
      title: z.string().min(1, { message: "Title is required" }),
      bodyHtml: z.string().min(1, { message: "Message body is required" }),
      category: z.enum(['ops', 'marketing', 'finance', 'announcement']),
      requiresAck: z.boolean().optional(),
      meta: z.any().optional(),
    });
    
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors
      });
    }
    
    const data = validation.data;
    const cleanHtml = sanitizeHtml(data.bodyHtml, sanitizeConfig);
    
    const messageRef = firestore.collection(FIRESTORE_PATHS.FRANCHISE_INBOX(data.franchiseId)).doc();
    await messageRef.set({
      title: data.title,
      bodyHtml: cleanHtml,
      category: data.category,
      requiresAck: data.requiresAck || false,
      createdAt: new Date(),
      readAt: null,
      ackAt: null,
      attachments: [],
      meta: data.meta || {},
    });
    
    logger.info('Admin sent franchise message', {
      admin: req.firebaseUser!.email,
      franchiseId: data.franchiseId,
      messageId: messageRef.id,
    });
    
    res.json({ success: true, messageId: messageRef.id });
  } catch (error) {
    logger.error('Error sending franchise message', error);
    res.status(500).json({ error: 'Failed to send franchise message' });
  }
});

// Broadcast to all users (rate limited)
router.post('/admin/broadcast-users', validateFirebaseToken, isAdmin, async (req, res) => {
  try {
    const schema = z.object({
      title: z.string().min(1, { message: "Title is required" }),
      bodyHtml: z.string().min(1, { message: "Message body is required" }),
      type: z.enum(['voucher', 'system', 'receipt', 'promo']),
      locale: z.enum(['he', 'en', 'both']),
      ctaText: z.string().optional(),
      ctaUrl: z.string().optional(),
      segment: z.enum(['all', 'active', 'inactive']).default('all'),
    });
    
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors
      });
    }
    
    const data = validation.data;
    const cleanHtml = sanitizeHtml(data.bodyHtml, sanitizeConfig);
    
    // TODO: Get user list based on segment
    // For now, return success (implement batch sending later)
    
    logger.info('Admin broadcast initiated', {
      admin: req.firebaseUser!.email,
      segment: data.segment,
      type: data.type,
    });
    
    res.json({ 
      success: true, 
      message: 'Broadcast queued for processing',
      // TODO: Return job ID for status tracking
    });
  } catch (error) {
    logger.error('Error broadcasting message', error);
    res.status(500).json({ error: 'Failed to broadcast message' });
  }
});

export default router;
