/**
 * PetWash™ Orchestrator API
 *
 * REST endpoints that trigger the PetWashOperationsOrchestrator.
 * Covers job completion (invoice + calendar), document generation,
 * and provider job board data.
 *
 * Mounted at: /api/orchestrator
 */

import { Router } from 'express';
import { z } from 'zod';
import { petWashOrchestrator } from '../services/PetWashOperationsOrchestrator';
import { GoogleSheetsService } from '../services/googleSheetsIntegration';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { logger } from '../lib/logger';

const router = Router();

// ─────────────────────────────────────────────
// POST /api/orchestrator/job-complete
// Mark a booking as completed → tax invoice (חשבונית מס) + receipt + Drive + Sheets
// ─────────────────────────────────────────────
const jobCompleteSchema = z.object({
  bookingRef: z.string().min(2),
  platform: z.string().min(2),
  serviceType: z.string().min(2),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  providerName: z.string().min(2),
  providerEmail: z.string().email().optional(),
  petName: z.string().optional(),
  amountILS: z.number().positive(),
  paymentMethod: z.string().optional(),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
});

router.post('/job-complete', async (req, res) => {
  try {
    const data = jobCompleteSchema.parse(req.body);
    const result = await petWashOrchestrator.handleJobCompletion(data);
    logger.info('[Orchestrator API] Job completed', { ref: data.bookingRef, invoice: result.invoiceNumber });
    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error('[Orchestrator API] Job completion failed', err);
    res.status(400).json({ error: err.message || 'Job completion failed' });
  }
});

// ─────────────────────────────────────────────
// POST /api/orchestrator/calendar/booking
// Add booking to Google Calendar + send confirmation email
// ─────────────────────────────────────────────
const calendarBookingSchema = z.object({
  bookingRef: z.string(),
  platform: z.string(),
  serviceType: z.string(),
  date: z.string(),
  time: z.string(),
  firstName: z.string(),
  lastName: z.string().optional(),
  email: z.string().email(),
  phone: z.string(),
  address: z.string().optional(),
  city: z.string().optional(),
  petName: z.string().optional(),
  petSize: z.string().optional(),
  specialRequests: z.string().optional(),
  estimatedPriceILS: z.number().optional(),
});

router.post('/calendar/booking', async (req, res) => {
  try {
    const data = calendarBookingSchema.parse(req.body);
    const result = await petWashOrchestrator.handleBookingSubmission(data);
    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error('[Orchestrator API] Calendar booking failed', err);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/orchestrator/generate-statement
// Generate monthly e-statement (חשבון עסקה) for a customer or provider
// ─────────────────────────────────────────────
const statementSchema = z.object({
  recipientName: z.string().min(2),
  recipientEmail: z.string().email(),
  period: z.string().min(3),
  transactions: z.array(z.object({
    date: z.string(),
    description: z.string(),
    amountILS: z.number(),
  })),
  type: z.enum(['customer', 'provider']),
});

router.post('/generate-statement', validateFirebaseToken, async (req: any, res) => {
  try {
    const data = statementSchema.parse(req.body);
    const statementId = `STMT-${Date.now().toString(36).toUpperCase()}`;
    const total = data.transactions.reduce((s, t) => s + t.amountILS, 0);
    const vatTotal = total * 0.18 / 1.18;

    await GoogleSheetsService.appendToSheet('E-Statements', [
      new Date().toISOString(), statementId, data.period,
      data.type.toUpperCase(), data.recipientName, data.recipientEmail,
      total.toFixed(2), vatTotal.toFixed(2), data.transactions.length.toString(),
    ]);

    logger.info('[Orchestrator API] Statement generated', { statementId });
    res.json({ success: true, statementId, total, vatTotal });
  } catch (err: any) {
    logger.error('[Orchestrator API] Statement generation failed', err);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/orchestrator/health
// ─────────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'PetWash™ Operations Orchestrator API',
    endpoints: [
      'POST /api/orchestrator/job-complete → חשבונית מס + קבלה + Drive + Sheets',
      'POST /api/orchestrator/calendar/booking → Google Calendar + Email + Drive',
      'POST /api/orchestrator/generate-statement → חשבון עסקה + Sheets',
    ],
  });
});

export default router;
