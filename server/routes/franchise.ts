import { Router } from 'express';
import { db as firestore } from '../lib/firebase-admin';
import { requireFranchiseAuth } from '../franchiseAuth';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { getVertexAIConfig } from '../lib/gemini-client';
import { 
  FIRESTORE_PATHS, 
  insertServiceTicketSchema,
  franchiseInboxMessageSchema,
} from '@shared/firestore-schema';
import { logger } from '../lib/logger';
import { sendAlert } from '../monitoring';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { db } from '../db';
import { pool } from '../db';

/*
 * 2026-09-13: every revenue figure and transaction list in this file came from
 * three tables imported from @shared/super-app-schema, a SECOND TypeScript
 * definition with columns the database does not have (a payment method column,
 * a string franchise id on stations). Nothing writes the real payments table
 * either, so revenue was always 0 and the transaction list threw 42703.
 * CEO rule: only real, verified data.
 *
 * The real record of what a station earned is `station_settlements` (one row
 * per completed booking: gross total, platform share, franchise share, owner).
 * The franchise is linked through verified identity: franchise_owners
 * .owner_user_id is the signed-in owner's own account id. A franchise user with
 * no franchise_owners row (e.g. staff, or an owner not yet onboarded in
 * Postgres) sees 0 and `dataSource: 'no_linked_franchise_owner'` — never a
 * number that is not backed by a settlement row.
 */
async function franchiseOwnerIdFor(uid: string | undefined): Promise<number | null> {
  if (!uid) return null;
  const r = await pool.query(
    `SELECT id FROM franchise_owners WHERE owner_user_id = $1 AND status = 'active' ORDER BY id LIMIT 1`,
    [uid],
  );
  return r.rows?.[0]?.id ?? null;
}

type SettlementTx = {
  id: number;
  bookingNumber: string | null;
  amount: string;          // gross, shekels, 2dp
  franchiseAmount: string; // franchise share, shekels, 2dp
  paymentMethod: null;     // settlements do not record a tender
  createdAt: Date;
  bookingStatus: string | null;
};

async function settlementTransactions(ownerId: number | null, start: Date, end: Date): Promise<SettlementTx[]> {
  if (ownerId == null) return [];
  const r = await pool.query(
    `SELECT ss.id, b.booking_number, ss.total_amount_cents, ss.franchise_amount_cents,
            ss.created_at, b.status AS booking_status
       FROM station_settlements ss
       LEFT JOIN bookings b ON b.id = ss.booking_id
      WHERE ss.franchise_owner_id = $1
        AND ss.status IN ('pending', 'settled')
        AND ss.created_at >= $2 AND ss.created_at <= $3
      ORDER BY ss.created_at DESC`,
    [ownerId, start, end],
  );
  return (r.rows || []).map((x: any) => ({
    id: Number(x.id),
    bookingNumber: x.booking_number ?? null,
    amount: (Number(x.total_amount_cents || 0) / 100).toFixed(2),
    franchiseAmount: (Number(x.franchise_amount_cents || 0) / 100).toFixed(2),
    paymentMethod: null,
    createdAt: x.created_at,
    bookingStatus: x.booking_status ?? null,
  }));
}

async function settlementGrossShekels(ownerId: number | null, start: Date, end: Date): Promise<number> {
  const rows = await settlementTransactions(ownerId, start, end);
  return Number(rows.reduce((sum, t) => sum + Number(t.amount), 0).toFixed(2));
}
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { ISRAEL_VAT_RATE } from "@shared/israel-compliance-config";
import { createHash } from 'crypto';

const router = Router();

const hashShort = (v: unknown): string =>
  createHash('sha256').update(String(v ?? '')).digest('hex').slice(0, 12);

const maskEmail = (email: string): string => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '(invalid)';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
};

const maskPhone = (phone: string): string => {
  if (!phone || typeof phone !== 'string' || phone.length < 4) return '****';
  return `***${phone.slice(-4)}`;
};

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
    // False-success fix (2026-09-05): this used to swallow a Firestore
    // write failure in a local try/catch and still answer {success:true} —
    // a partner lead would vanish silently while the submitter was told it
    // went through. Let a write failure propagate to the outer catch so we
    // answer honestly (500) instead of acknowledging a lost lead.
    const inquiriesRef = firestore.collection('franchise_inquiries');
    await inquiriesRef.add(inquiryData);
    logger.info('Franchise inquiry received', {
      emailMasked: maskEmail(email),
      phoneMasked: maskPhone(phone),
      country,
      city,
      fullNameHash: hashShort(fullName),
    });
    return res.json({ success: true, message: 'Inquiry submitted successfully' });
  } catch (error) {
    logger.error('Error processing franchise inquiry', error);
    // Reviewed 2026-09-06. Answering 500 instead of a false success is the
    // right call, but on its own it still loses the lead: the submitter sees
    // an error and a log line is the only record that a partner tried to
    // reach us. Fire the same ops alert the codebase already uses for lost
    // business data (see sitter-suite.ts settlement failure) so someone can
    // follow up rather than discovering it in a log search.
    // Contact details stay MASKED here — the alert says a lead was lost and
    // where to look; it is not a channel for raw PII.
    try {
      await sendAlert({
        type: 'data_integrity',
        severity: 'high',
        message: 'Franchise inquiry FAILED to persist — partner lead lost',
        details:
          `emailMasked=${maskEmail(req.body?.email ?? '')} ` +
          `phoneMasked=${maskPhone(req.body?.phone ?? '')} ` +
          `country=${req.body?.country ?? '?'} city=${req.body?.city ?? '?'} ` +
          `error=${(error as any)?.message ?? 'unknown'} — submitter was told it failed; follow up manually`,
      });
    } catch { /* alert must never mask the original failure */ }
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

    const ownerId = await franchiseOwnerIdFor((req as any).franchiseUser?.uid);
    const washesRow = ownerId == null ? null : (await pool.query(
      `SELECT COALESCE(SUM(total_washes), 0)::int AS total FROM stations WHERE franchise_id = $1`,
      [ownerId],
    )).rows?.[0];
    const farFuture = new Date(8640000000000000);
    const franchiseStations = [{ totalWashes: Number(washesRow?.total ?? 0) }];
    const todayRevenue = [{ total: await settlementGrossShekels(ownerId, todayStart, farFuture) }];
    const thisMonthRevenue = [{ total: await settlementGrossShekels(ownerId, monthStart, farFuture) }];
    const lastMonthRevenue = [{ total: await settlementGrossShekels(ownerId, lastMonthStart, lastMonthEnd) }];

    const stats = {
      locationName: profile?.locationName || 'Unknown Location',
      totalWashes: franchiseStations[0]?.totalWashes || 0,
      revenue: {
        today: todayRevenue[0]?.total || 0,
        thisMonth: thisMonthRevenue[0]?.total || 0,
        lastMonth: lastMonthRevenue[0]?.total || 0,
      },
      loyaltyRedemptionRate: 0,
      dataSource: ownerId == null ? 'no_linked_franchise_owner' : 'station_settlements',
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
    const transactionRecords = await settlementTransactions(await franchiseOwnerIdFor((req as any).franchiseUser?.uid), startDate, endDate);

    // Calculate totals (VAT rate 18% in Israel - updated Jan 2025)
    const VAT_RATE = parseFloat(process.env.VAT_RATE || String(ISRAEL_VAT_RATE));
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

    const transactionRecords = await settlementTransactions(await franchiseOwnerIdFor((req as any).franchiseUser?.uid), startDate, endDate);

    // Add transaction rows with VAT calculations
    // Admin-audit CRIT #6 fix (2026-08-25): payments.amount is stored VAT-INCLUSIVE
    // gross. The old formula `amount * VAT_RATE` produced wrong VAT (over-reports)
    // and wrong net (under-reports). Correct Israeli-VAT extraction from a
    // gross amount is `gross * rate / (1 + rate)`. Every franchise owner's
    // report has been showing wrong numbers.
    //   ₪100 gross → VAT = 100 × 0.18/1.18 = ₪15.25, net = ₪84.75
    //   (old buggy: VAT=₪18.00, net=₪82.00)
    const VAT_RATE_EXCEL = parseFloat(process.env.VAT_RATE || String(ISRAEL_VAT_RATE));
    transactionRecords.forEach(tx => {
      const amount = parseFloat(String(tx.amount));
      const vat = amount * VAT_RATE_EXCEL / (1 + VAT_RATE_EXCEL);
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
    doc.fontSize(20).text('⁦PetWash™⁩ Financial Report', { align: 'center' });
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

    const transactionRecords = await settlementTransactions(await franchiseOwnerIdFor((req as any).franchiseUser?.uid), startDate, endDate);

    // Add transaction summary
    // Admin-audit CRIT #6 fix (2026-08-25): payments.amount is VAT-inclusive
    // gross — use backward-add extraction `gross * rate / (1 + rate)`.
    const VAT_RATE_PDF = parseFloat(process.env.VAT_RATE || String(ISRAEL_VAT_RATE));
    const totalRevenue = transactionRecords.reduce((sum, tx) =>
      sum + parseFloat(String(tx.amount)), 0
    );
    const totalVat = totalRevenue * VAT_RATE_PDF / (1 + VAT_RATE_PDF);
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

    // False-mass-assign fix (2026-08-22): previously spread `req.body`
    // directly into the Firestore update. Callers could inject
    // arbitrary fields (`franchiseId`, `ticketId`, `internalNote`,
    // etc.) into the doc — bypassing the state machine, spoofing
    // franchise ownership, or planting hidden admin flags. Run the
    // patch through the shared insert schema (as .partial()) so only
    // known ticket fields are accepted.
    let parsed: Record<string, unknown>;
    try {
      parsed = insertServiceTicketSchema.partial().parse(req.body ?? {}) as Record<string, unknown>;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid ticket data', details: err.errors });
      }
      throw err;
    }
    // Never let a body-supplied franchiseId cross owner boundaries —
    // the doc's path already pins the franchise; strip defence-in-depth.
    delete (parsed as any).franchiseId;

    const updates: any = {
      ...parsed,
      updatedAt: new Date(),
    };

    // If status is being set to resolved or closed, set resolvedAt.
    // Read the parsed value (not raw req.body) so an unrelated field
    // named `status` can't sneak past the allowlist.
    if ((parsed.status === 'resolved' || parsed.status === 'closed') && !doc.data()?.resolvedAt) {
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

/**
 * POST /api/franchise/:franchiseId/ai-narrative-report
 * Gemini generates a weekly narrative business intelligence report for the franchise.
 */
router.post('/:franchiseId/ai-narrative-report', requireFranchiseAuth, async (req, res) => {
  try {
    const { franchiseId } = req.params;

    // Pull recent stats from Firestore
    let statsContext = '';
    try {
      const statsDoc = await firestore.collection('franchise_stats').doc(franchiseId).get();
      const stats = statsDoc.data() || {};
      statsContext = `Total washes this month: ${stats.monthlyWashes || 'N/A'}, Revenue: ₪${stats.monthlyRevenue || 'N/A'}, Active customers: ${stats.activeCustomers || 'N/A'}, Avg rating: ${stats.avgRating || 'N/A'}, Provider count: ${stats.providerCount || 'N/A'}`;
    } catch {
      statsContext = 'Stats unavailable — generate a motivating general overview';
    }

    const genAI = new GoogleGenAI(getVertexAIConfig());
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: `You are a business intelligence analyst for PetWash™, a premium pet grooming franchise network in Israel. Generate a concise, motivating weekly narrative report for franchise partner "${franchiseId}". Data: ${statsContext}. The report should cover: 1) Performance highlights (2-3 sentences), 2) Key opportunities to grow (2-3 actionable bullets), 3) A motivating closing statement. Use a warm, professional tone. Keep it under 200 words. Write in English.` }]
      }],
    });

    res.json({ success: true, report: result.text?.trim() || 'Unable to generate report at this time.' });
  } catch (error) {
    logger.error('Error generating AI narrative report', error);
    res.status(500).json({ error: 'Failed to generate AI report' });
  }
});

export default router;
