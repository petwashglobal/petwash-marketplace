/**
 * PetWash™ Orchestrator API
 *
 * REST endpoints that trigger the PetWashOperationsOrchestrator.
 * Covers ALL business operations: job completion, bookings, KYC/KYB,
 * e-sign, onboarding approvals, contract generation, statements.
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
// Mark a booking as completed → חשבונית מס + קבלה + Drive + Sheets
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
// Generate monthly e-statement (חשבון עסקה)
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
// POST /api/orchestrator/kyc-submit
// KYC / Identity verification submitted → Sheets + Drive + compliance email
// Called fire-and-forget from kyc.ts and kyc2026.ts
// ─────────────────────────────────────────────
const kycSubmitSchema = z.object({
  userId: z.string().min(1),
  fullName: z.string().default('Unknown'),
  email: z.string().email().optional().default('noreply@petwash.co.il'),
  docType: z.string().default('national_id'),
  countryCode: z.string().optional(),
  idNumber: z.string().optional(),
  selfieUrl: z.string().optional(),
  idDocUrl: z.string().optional(),
  idBackUrl: z.string().optional(),
  status: z.enum(['submitted', 'auto_approved', 'manual_review', 'blocked']).default('submitted'),
  source: z.enum(['kyc_v1', 'kyc_v2_2026']).default('kyc_v1'),
  notes: z.string().optional(),
});

router.post('/kyc-submit', async (req, res) => {
  try {
    const data = kycSubmitSchema.parse(req.body);
    setImmediate(() => petWashOrchestrator.handleKYCSubmission(data).catch(err =>
      logger.warn('[Orchestrator API] KYC handler error', err)
    ));
    res.json({ success: true, queued: true });
  } catch (err: any) {
    logger.error('[Orchestrator API] KYC submit parse failed', err);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/orchestrator/kyb-submit
// KYB / Business verification submitted → Sheets + Drive + compliance
// ─────────────────────────────────────────────
const kybSubmitSchema = z.object({
  businessId: z.string().min(1),
  businessName: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  vatNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  documentsUploaded: z.array(z.string()).default([]),
  status: z.enum(['submitted', 'approved', 'manual_review', 'rejected']).default('submitted'),
  notes: z.string().optional(),
});

router.post('/kyb-submit', async (req, res) => {
  try {
    const data = kybSubmitSchema.parse(req.body);
    setImmediate(() => petWashOrchestrator.handleKYBSubmission(data).catch(err =>
      logger.warn('[Orchestrator API] KYB handler error', err)
    ));
    res.json({ success: true, queued: true });
  } catch (err: any) {
    logger.error('[Orchestrator API] KYB submit parse failed', err);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/orchestrator/booking-confirmed
// Provider confirmed a booking → Calendar + Sheets + customer email
// ─────────────────────────────────────────────
const bookingConfirmedSchema = z.object({
  bookingId: z.string(),
  bookingRef: z.string(),
  platform: z.string().default('PetWash'),
  serviceType: z.string().default('Pet Service'),
  customerName: z.string().default('Customer'),
  customerEmail: z.string().email(),
  customerPhone: z.string().default(''),
  providerName: z.string().default('Provider'),
  providerEmail: z.string().email().optional(),
  petName: z.string().optional(),
  scheduledDate: z.string(),
  scheduledTime: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  amountILS: z.number().optional(),
});

router.post('/booking-confirmed', async (req, res) => {
  try {
    const data = bookingConfirmedSchema.parse(req.body);
    setImmediate(() => petWashOrchestrator.handleBookingConfirmed(data).catch(err =>
      logger.warn('[Orchestrator API] Booking confirmed handler error', err)
    ));
    res.json({ success: true, queued: true });
  } catch (err: any) {
    logger.error('[Orchestrator API] Booking confirmed parse failed', err);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/orchestrator/esign-complete
// DocuSeal webhook completion → Drive backup + Sheets + email with doc link
// ─────────────────────────────────────────────
const esignCompleteSchema = z.object({
  submissionId: z.string(),
  documentType: z.string().default('Legal Document'),
  signerName: z.string(),
  signerEmail: z.string().email(),
  userId: z.string().optional(),
  templateSlug: z.string().optional(),
  signedDocumentUrl: z.string().optional(),
  completedAt: z.string().default(() => new Date().toISOString()),
});

router.post('/esign-complete', async (req, res) => {
  try {
    const data = esignCompleteSchema.parse(req.body);
    setImmediate(() => petWashOrchestrator.handleEsignComplete(data).catch(err =>
      logger.warn('[Orchestrator API] E-sign complete handler error', err)
    ));
    res.json({ success: true, queued: true });
  } catch (err: any) {
    logger.error('[Orchestrator API] E-sign complete parse failed', err);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/orchestrator/onboarding-approved
// Provider application approved → Drive contract + Sheets + Calendar + welcome email
// ─────────────────────────────────────────────
const onboardingApprovedSchema = z.object({
  applicationId: z.string(),
  platform: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().default(''),
  city: z.string().optional(),
  idNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  businessName: z.string().optional(),
  inviteCode: z.string().optional(),
  approvedBy: z.string().optional(),
  notes: z.string().optional(),
});

router.post('/onboarding-approved', async (req, res) => {
  try {
    const data = onboardingApprovedSchema.parse(req.body);
    setImmediate(() => petWashOrchestrator.handleOnboardingApproved(data).catch(err =>
      logger.warn('[Orchestrator API] Onboarding approved handler error', err)
    ));
    res.json({ success: true, queued: true });
  } catch (err: any) {
    logger.error('[Orchestrator API] Onboarding approved parse failed', err);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/orchestrator/contract-generated
// Contract generated → Drive backup + Sheets + email to party
// ─────────────────────────────────────────────
const contractGeneratedSchema = z.object({
  contractId: z.union([z.string(), z.number()]),
  contractNumber: z.string(),
  contractType: z.enum(['offer_letter', 'contractor_agreement', 'subcontractor', 'employment']),
  partyName: z.string(),
  partyEmail: z.string().email(),
  platform: z.string().optional(),
  city: z.string().optional(),
  salaryOrRate: z.number().optional(),
  currency: z.string().optional(),
  effectiveDate: z.string().optional(),
  content: z.string().optional(),
});

router.post('/contract-generated', async (req, res) => {
  try {
    const data = contractGeneratedSchema.parse(req.body);
    setImmediate(() => petWashOrchestrator.handleContractGenerated(data).catch(err =>
      logger.warn('[Orchestrator API] Contract generated handler error', err)
    ));
    res.json({ success: true, queued: true });
  } catch (err: any) {
    logger.error('[Orchestrator API] Contract generated parse failed', err);
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
    version: '2.0',
    handlers: [
      'POST /job-complete → חשבונית מס + קבלה + Drive + Sheets',
      'POST /calendar/booking → Google Calendar + Email + Drive',
      'POST /generate-statement → חשבון עסקה + Sheets',
      'POST /kyc-submit → KYC Sheets + Drive + Compliance alert',
      'POST /kyb-submit → KYB Sheets + Drive + Compliance alert',
      'POST /booking-confirmed → Calendar + Sheets + Customer email',
      'POST /esign-complete → Drive + E-Sig Sheets + Signer email',
      'POST /onboarding-approved → Drive + Sheets + Calendar + Welcome email',
      'POST /contract-generated → Drive + Sheets + Party email',
    ],
  });
});

export default router;
