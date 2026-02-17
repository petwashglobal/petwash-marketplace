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
import { db } from '../db';
import { bookings, payments, stations } from '@shared/super-app-schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

const router = Router();

// ============================================
// PUBLIC FRANCHISE INQUIRY (no auth required)
// ============================================
router.post('/inquiry', async (req, res) => {
  try {
    const { fullName, email, phone, country, city, message } = req.body;
    if (!fullName || !email || !phone) {
      return res.status(400).json({ error: 'Name, email, and phone are required' });
    }
    const inquiryData = {
      fullName,
      email,
      phone,
      country: country || '',
      city: city || '',
      message: message || '',
      submittedAt: new Date().toISOString(),
      status: 'new',
    };
    try {
      const inquiriesRef = firestore.collection('franchise_inquiries');
      await inquiriesRef.add(inquiryData);
    } catch (firestoreErr) {
      logger.warn('Could not save franchise inquiry to Firestore, saving to logs', { inquiryData });
    }
    logger.info('Franchise inquiry received', { fullName, email, phone, country, city });
    return res.json({ success: true, message: 'Inquiry submitted successfully' });
  } catch (error) {
    logger.error('Error processing franchise inquiry', error);
    return res.status(500).json({ error: 'Failed to process inquiry' });
  }
});

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

    // Query actual transaction data from PostgreSQL
    // Keep franchiseId as string (supports alphanumeric Firestore document IDs)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Get total washes from stations stats
    const franchiseStations = await db
      .select({ totalWashes: sql<number>`COALESCE(SUM(${stations.totalWashes}), 0)` })
      .from(stations)
      .where(eq(stations.franchiseId, franchiseId));
    
    // Get revenue for today
    const todayRevenue = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(${payments.amount} AS NUMERIC)), 0)` })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .innerJoin(stations, eq(bookings.stationId, stations.id))
      .where(and(
        eq(stations.franchiseId, franchiseId),
        eq(payments.status, 'succeeded'),
        gte(payments.createdAt, todayStart)
      ));

    // Get revenue for this month
    const thisMonthRevenue = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(${payments.amount} AS NUMERIC)), 0)` })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .innerJoin(stations, eq(bookings.stationId, stations.id))
      .where(and(
        eq(stations.franchiseId, franchiseId),
        eq(payments.status, 'succeeded'),
        gte(payments.createdAt, monthStart)
      ));

    // Get revenue for last month
    const lastMonthRevenue = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(${payments.amount} AS NUMERIC)), 0)` })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .innerJoin(stations, eq(bookings.stationId, stations.id))
      .where(and(
        eq(stations.franchiseId, franchiseId),
        eq(payments.status, 'succeeded'),
        gte(payments.createdAt, lastMonthStart),
        lte(payments.createdAt, lastMonthEnd)
      ));

    const stats = {
      locationName: profile?.locationName || 'Unknown Location',
      totalWashes: franchiseStations[0]?.totalWashes || 0,
      revenue: {
        today: todayRevenue[0]?.total || 0,
        thisMonth: thisMonthRevenue[0]?.total || 0,
        lastMonth: lastMonthRevenue[0]?.total || 0,
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

    // Query actual PostgreSQL transaction data
    // Keep franchiseId as string (supports alphanumeric Firestore document IDs)
    let startDate: Date;
    let endDate: Date;

    if (period === 'daily' && date) {
      startDate = new Date(date);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    } else if (period === 'monthly' && date) {
      const [year, month] = date.split('-').map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 1);
    } else {
      return res.status(400).json({ error: 'Invalid period or date format' });
    }

    // Get all transactions for the period
    const transactionRecords = await db
      .select({
        id: payments.id,
        bookingNumber: bookings.bookingNumber,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        paymentMethod: payments.paymentMethod,
        createdAt: payments.createdAt,
        bookingStatus: bookings.status,
      })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .innerJoin(stations, eq(bookings.stationId, stations.id))
      .where(and(
        eq(stations.franchiseId, franchiseId),
        eq(payments.status, 'succeeded'),
        gte(payments.createdAt, startDate),
        lte(payments.createdAt, endDate)
      ))
      .orderBy(desc(payments.createdAt));

    // Calculate totals (VAT rate 18% in Israel - updated Jan 2025)
    const VAT_RATE = parseFloat(process.env.VAT_RATE || '0.18');
    const totalRevenue = transactionRecords.reduce((sum, tx) => 
      sum + parseFloat(String(tx.amount)), 0
    );
    const vat = totalRevenue * VAT_RATE;
    const netRevenue = totalRevenue - vat;

    const reportData = {
      franchiseId,
      period,
      date,
      totalTransactions: transactionRecords.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      voucherDiscounts: 0,
      netRevenue: Number(netRevenue.toFixed(2)),
      vat: Number(vat.toFixed(2)),
      transactions: transactionRecords.map(tx => ({
        id: tx.id,
        bookingNumber: tx.bookingNumber,
        amount: Number(parseFloat(String(tx.amount)).toFixed(2)),
        paymentMethod: tx.paymentMethod,
        date: tx.createdAt,
      })),
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
      { header: 'Booking Number', key: 'bookingNumber', width: 20 },
      { header: 'Amount (₪)', key: 'amount', width: 12 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'VAT (₪)', key: 'vat', width: 12 },
      { header: 'Net (₪)', key: 'net', width: 12 },
    ];

    // Query transactions (same logic as financial report endpoint)
    // Keep franchiseId as string (supports alphanumeric Firestore document IDs)
    let startDate: Date;
    let endDate: Date;

    if (period === 'daily' && date) {
      startDate = new Date(date);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    } else if (period === 'monthly' && date) {
      const [year, month] = date.split('-').map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 1);
    } else {
      return res.status(400).json({ error: 'Invalid period or date format' });
    }

    const transactionRecords = await db
      .select({
        bookingNumber: bookings.bookingNumber,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .innerJoin(stations, eq(bookings.stationId, stations.id))
      .where(and(
        eq(stations.franchiseId, franchiseId),
        eq(payments.status, 'succeeded'),
        gte(payments.createdAt, startDate),
        lte(payments.createdAt, endDate)
      ))
      .orderBy(desc(payments.createdAt));

    // Add transaction rows with VAT calculations
    const VAT_RATE_EXCEL = parseFloat(process.env.VAT_RATE || '0.18');
    transactionRecords.forEach(tx => {
      const amount = parseFloat(String(tx.amount));
      const vat = amount * VAT_RATE_EXCEL;
      const net = amount - vat;
      
      worksheet.addRow({
        date: format(tx.createdAt, 'yyyy-MM-dd HH:mm'),
        bookingNumber: tx.bookingNumber,
        amount: amount.toFixed(2),
        paymentMethod: tx.paymentMethod || 'N/A',
        vat: vat.toFixed(2),
        net: net.toFixed(2),
      });
    });

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
    doc.fontSize(20).text('⁦Pet Wash™⁩ Financial Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Franchise ID: ${franchiseId}`);
    doc.text(`Period: ${period}`);
    doc.text(`Date: ${date}`);
    doc.moveDown();

    // Query transactions (same logic as other endpoints)
    // Keep franchiseId as string (supports alphanumeric Firestore document IDs)
    let startDate: Date;
    let endDate: Date;

    if (period === 'daily' && date) {
      startDate = new Date(date);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    } else if (period === 'monthly' && date) {
      const [year, month] = date.split('-').map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 1);
    } else {
      doc.text('Invalid period or date format');
      doc.end();
      return;
    }

    const transactionRecords = await db
      .select({
        bookingNumber: bookings.bookingNumber,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .innerJoin(stations, eq(bookings.stationId, stations.id))
      .where(and(
        eq(stations.franchiseId, franchiseId),
        eq(payments.status, 'succeeded'),
        gte(payments.createdAt, startDate),
        lte(payments.createdAt, endDate)
      ))
      .orderBy(desc(payments.createdAt));

    // Add transaction summary
    const VAT_RATE_PDF = parseFloat(process.env.VAT_RATE || '0.18');
    const totalRevenue = transactionRecords.reduce((sum, tx) => 
      sum + parseFloat(String(tx.amount)), 0
    );
    const totalVat = totalRevenue * VAT_RATE_PDF;
    const totalNet = totalRevenue - totalVat;

    doc.fontSize(14).text('Summary', { underline: true });
    doc.fontSize(10).text(`Total Transactions: ${transactionRecords.length}`);
    doc.text(`Total Revenue: ₪${totalRevenue.toFixed(2)}`);
    doc.text(`VAT (${VAT_RATE_PDF * 100}%): ₪${totalVat.toFixed(2)}`);
    doc.text(`Net Revenue: ₪${totalNet.toFixed(2)}`);
    doc.moveDown();

    // Add transaction details
    doc.fontSize(14).text('Transactions', { underline: true });
    doc.fontSize(8);
    transactionRecords.forEach((tx, index) => {
      const amount = parseFloat(String(tx.amount));
      doc.text(
        `${index + 1}. ${format(tx.createdAt, 'yyyy-MM-dd HH:mm')} | ${tx.bookingNumber} | ₪${amount.toFixed(2)} | ${tx.paymentMethod || 'N/A'}`
      );
    });

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
