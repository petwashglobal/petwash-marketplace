import { Router } from 'express';
import { db as firestore } from '../lib/firebase-admin';
import { requireFranchiseAuth } from '../franchiseAuth';
import { z } from 'zod';
import { 
  FIRESTORE_PATHS, 
  insertServiceTicketSchema,
  franchiseInboxMessageSchema,
} from '@shared/firestore-schema';
import { logger } from '../lib/logger';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';

const router = Router();

// ============================================
// FRANCHISE DASHBOARD ROUTES
// ============================================

// Get franchise dashboard stats
router.get('/dashboard/stats', requireFranchiseAuth, async (req, res) => {
  try {
    const franchiseId = req.query.franchiseId as string;
    
    if (!franchiseId) {
      return res.status(400).json({ error: 'franchiseId is required' });
    }

    // Get franchise profile
    const profileRef = firestore.doc(FIRESTORE_PATHS.FRANCHISE_PROFILES(franchiseId));
    const profileDoc = await profileRef.get();
    
    if (!profileDoc.exists) {
      return res.status(404).json({ error: 'Franchise not found' });
    }

    const profile = profileDoc.data();

    // TODO: Query actual transaction data from PostgreSQL
    // For now, return mock stats structure
    const stats = {
      locationName: profile?.locationName || 'Unknown Location',
      totalWashes: 0,
      revenue: {
        today: 0,
        thisMonth: 0,
        lastMonth: 0,
      },
      loyaltyRedemptionRate: 0,
      machineStatus: profile?.machineIds?.map((id: string) => ({
        machineId: id,
        status: 'online',
        lastWash: new Date().toISOString(),
      })) || [],
    };

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching franchise dashboard stats', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get franchise announcements (recent inbox messages)
router.get('/dashboard/announcements', requireFranchiseAuth, async (req, res) => {
  try {
    const franchiseId = req.query.franchiseId as string;
    
    if (!franchiseId) {
      return res.status(400).json({ error: 'franchiseId is required' });
    }

    const messagesRef = firestore.collection(FIRESTORE_PATHS.FRANCHISE_INBOX(franchiseId));
    const snapshot = await messagesRef
      .where('category', '==', 'announcement')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const announcements = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      readAt: doc.data().readAt?.toDate() || null,
    }));

    res.json({ announcements });
  } catch (error) {
    logger.error('Error fetching franchise announcements', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// ============================================
// FRANCHISE INBOX ROUTES
// ============================================

// Get all franchise inbox messages
router.get('/inbox', requireFranchiseAuth, async (req, res) => {
  try {
    const franchiseId = req.query.franchiseId as string;
    const category = req.query.category as string | undefined;
    
    if (!franchiseId) {
      return res.status(400).json({ error: 'franchiseId is required' });
    }

    let query = firestore.collection(FIRESTORE_PATHS.FRANCHISE_INBOX(franchiseId))
      .orderBy('createdAt', 'desc');

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

    res.json({ messages });
  } catch (error) {
    logger.error('Error fetching franchise inbox', error);
    res.status(500).json({ error: 'Failed to fetch inbox messages' });
  }
});

// Mark message as read
router.patch('/inbox/:messageId/read', requireFranchiseAuth, async (req, res) => {
  try {
    const franchiseId = req.query.franchiseId as string;
    const { messageId } = req.params;

    if (!franchiseId) {
      return res.status(400).json({ error: 'franchiseId is required' });
    }

    const messageRef = firestore.doc(FIRESTORE_PATHS.FRANCHISE_INBOX(franchiseId, messageId));
    await messageRef.update({
      readAt: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking message as read', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Acknowledge message
router.patch('/inbox/:messageId/acknowledge', requireFranchiseAuth, async (req, res) => {
  try {
    const franchiseId = req.query.franchiseId as string;
    const { messageId } = req.params;

    if (!franchiseId) {
      return res.status(400).json({ error: 'franchiseId is required' });
    }

    const messageRef = firestore.doc(FIRESTORE_PATHS.FRANCHISE_INBOX(franchiseId, messageId));
    const doc = await messageRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (!doc.data()?.requiresAck) {
      return res.status(400).json({ error: 'Message does not require acknowledgment' });
    }

    await messageRef.update({
      ackAt: new Date(),
      readAt: doc.data()?.readAt || new Date(),
    });

    logger.info('Franchise message acknowledged', { franchiseId, messageId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error acknowledging message', error);
    res.status(500).json({ error: 'Failed to acknowledge message' });
  }
});

// ============================================
// FRANCHISE REPORTS ROUTES
// ============================================

// Get financial report data
router.get('/reports/financial', requireFranchiseAuth, async (req, res) => {
  try {
    const franchiseId = req.query.franchiseId as string;
    const period = req.query.period as string; // 'daily' or 'monthly'
    const date = req.query.date as string; // YYYY-MM-DD or YYYY-MM

    if (!franchiseId) {
      return res.status(400).json({ error: 'franchiseId is required' });
    }

    // TODO: Query actual PostgreSQL transaction data
    // For now, return mock structure
    const reportData = {
      franchiseId,
      period,
      date,
      totalTransactions: 0,
      totalRevenue: 0,
      voucherDiscounts: 0,
      netRevenue: 0,
      vat: 0,
      transactions: [],
    };

    res.json(reportData);
  } catch (error) {
    logger.error('Error fetching financial report', error);
    res.status(500).json({ error: 'Failed to fetch financial report' });
  }
});

// Export report as Excel
router.get('/reports/export/excel', requireFranchiseAuth, async (req, res) => {
  try {
    const franchiseId = req.query.franchiseId as string;
    const period = req.query.period as string;
    const date = req.query.date as string;

    if (!franchiseId) {
      return res.status(400).json({ error: 'franchiseId is required' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Financial Report');

    // Header
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Transaction ID', key: 'txId', width: 20 },
      { header: 'Amount (₪)', key: 'amount', width: 12 },
      { header: 'Discount (₪)', key: 'discount', width: 12 },
      { header: 'VAT (₪)', key: 'vat', width: 12 },
      { header: 'Total (₪)', key: 'total', width: 12 },
    ];

    // TODO: Add actual transaction rows

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=franchise_report_${franchiseId}_${date}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Error exporting Excel report', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

// Export report as PDF
router.get('/reports/export/pdf', requireFranchiseAuth, async (req, res) => {
  try {
    const franchiseId = req.query.franchiseId as string;
    const period = req.query.period as string;
    const date = req.query.date as string;

    if (!franchiseId) {
      return res.status(400).json({ error: 'franchiseId is required' });
    }

    const doc = new PDFDocument();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=franchise_report_${franchiseId}_${date}.pdf`
    );

    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Pet Wash™ Financial Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Franchise ID: ${franchiseId}`);
    doc.text(`Period: ${period}`);
    doc.text(`Date: ${date}`);
    doc.moveDown();

    // TODO: Add actual transaction data

    doc.end();
  } catch (error) {
    logger.error('Error exporting PDF report', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

// ============================================
// FRANCHISE SUPPORT TICKETS ROUTES
// ============================================

// Get all support tickets for franchise
router.get('/support/tickets', requireFranchiseAuth, async (req, res) => {
  try {
    const franchiseId = req.query.franchiseId as string;
    const status = req.query.status as string | undefined;

    if (!franchiseId) {
      return res.status(400).json({ error: 'franchiseId is required' });
    }

    let query = firestore.collection(FIRESTORE_PATHS.SERVICE_TICKETS(franchiseId))
      .orderBy('createdAt', 'desc');

    if (status && ['open', 'assigned', 'in_progress', 'resolved', 'closed'].includes(status)) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const tickets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      resolvedAt: doc.data().resolvedAt?.toDate() || null,
    }));

    res.json({ tickets });
  } catch (error) {
    logger.error('Error fetching support tickets', error);
    res.status(500).json({ error: 'Failed to fetch support tickets' });
  }
});

// Create new support ticket
router.post('/support/tickets', requireFranchiseAuth, async (req, res) => {
  try {
    const franchiseId = req.query.franchiseId as string;

    if (!franchiseId) {
      return res.status(400).json({ error: 'franchiseId is required' });
    }

    const ticketData = insertServiceTicketSchema.parse({
      ...req.body,
      franchiseId,
      status: 'open',
      resolvedAt: null,
    });

    const ticketRef = firestore.collection(FIRESTORE_PATHS.SERVICE_TICKETS(franchiseId)).doc();
    await ticketRef.set({
      ...ticketData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info('Support ticket created', { franchiseId, ticketId: ticketRef.id });

    res.status(201).json({
      success: true,
      ticketId: ticketRef.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid ticket data', 
        details: error.errors 
      });
    }
    logger.error('Error creating support ticket', error);
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
});

// Update support ticket
router.patch('/support/tickets/:ticketId', requireFranchiseAuth, async (req, res) => {
  try {
    const franchiseId = req.query.franchiseId as string;
    const { ticketId } = req.params;

    if (!franchiseId) {
      return res.status(400).json({ error: 'franchiseId is required' });
    }

    const ticketRef = firestore.doc(FIRESTORE_PATHS.SERVICE_TICKETS(franchiseId, ticketId));
    const doc = await ticketRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const updates: any = {
      ...req.body,
      updatedAt: new Date(),
    };

    // If status is being set to resolved or closed, set resolvedAt
    if ((req.body.status === 'resolved' || req.body.status === 'closed') && !doc.data()?.resolvedAt) {
      updates.resolvedAt = new Date();
    }

    await ticketRef.update(updates);

    logger.info('Support ticket updated', { franchiseId, ticketId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating support ticket', error);
    res.status(500).json({ error: 'Failed to update support ticket' });
  }
});

export default router;
