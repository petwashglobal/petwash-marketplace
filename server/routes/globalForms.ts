/**
 * Global Forms API Routes
 * 
 * Unified form submission endpoints for all 8 Pet Wash platforms
 * All submissions are logged to Google Sheets for centralized tracking
 */

import { Router } from 'express';
import { z } from 'zod';
import { GoogleSheetsService } from '../services/googleSheetsIntegration';
import { logger } from '../lib/logger';

const router = Router();

// =========================
// CONTACT FORM (All Platforms)
// =========================
const contactFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  platform: z.enum(['K9000', 'SITTER', 'WALKER', 'PETTREK', 'ACADEMY', 'PLUSH', 'WASH', 'CLUB']),
});

router.post('/contact', async (req, res) => {
  try {
    const data = contactFormSchema.parse(req.body);
    
    // Log to Google Sheets
    await GoogleSheetsService.logContactForm({
      name: data.name,
      email: data.email,
      phone: data.phone || '',
      subject: data.subject,
      message: data.message,
      platform: data.platform,
    });

    // TODO: Send email notification to Support@PetWash.co.il
    
    res.json({
      success: true,
      message: 'Thank you! We\'ll get back to you within 24 hours.',
      messageHe: 'תודה! ניצור איתך קשר תוך 24 שעות.',
    });
  } catch (error) {
    logger.error('[GlobalForms] Contact form error:', error);
    res.status(400).json({ error: 'Invalid form data' });
  }
});

// =========================
// FEEDBACK & REVIEW FORM
// =========================
const feedbackSchema = z.object({
  customerName: z.string().min(2),
  email: z.string().email(),
  platform: z.enum(['K9000', 'SITTER', 'WALKER', 'PETTREK', 'ACADEMY', 'PLUSH', 'WASH', 'CLUB']),
  serviceType: z.string(),
  rating: z.number().min(1).max(5),
  reviewTitle: z.string().min(5),
  reviewText: z.string().min(20),
  wouldRecommend: z.boolean(),
});

router.post('/feedback', async (req, res) => {
  try {
    const data = feedbackSchema.parse(req.body);
    
    await GoogleSheetsService.logFeedbackReview(data);

    res.json({
      success: true,
      message: 'Thank you for your feedback!',
      messageHe: 'תודה על המשוב שלך!',
    });
  } catch (error) {
    logger.error('[GlobalForms] Feedback form error:', error);
    res.status(400).json({ error: 'Invalid form data' });
  }
});

// =========================
// NEWSLETTER SIGNUP
// =========================
const newsletterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  languagePreference: z.enum(['en', 'he', 'ar', 'ru', 'fr', 'es']),
  sourcePlatform: z.string(),
});

router.post('/newsletter', async (req, res) => {
  try {
    const data = newsletterSchema.parse(req.body);
    const ipAddress = req.ip || req.socket.remoteAddress || 'Unknown';
    
    await GoogleSheetsService.logNewsletterSignup({
      ...data,
      ipAddress,
    });

    res.json({
      success: true,
      message: 'Welcome to Pet Wash™ Newsletter!',
      messageHe: 'ברוכים הבאים לניוזלטר של Pet Wash™!',
    });
  } catch (error) {
    logger.error('[GlobalForms] Newsletter signup error:', error);
    res.status(400).json({ error: 'Invalid form data' });
  }
});

// =========================
// FRANCHISE INQUIRY FORM
// =========================
const franchiseInquirySchema = z.object({
  name: z.string().min(2),
  company: z.string().optional(),
  email: z.string().email(),
  phone: z.string().min(10),
  country: z.string().min(2),
  city: z.string().min(2),
  investmentBudget: z.enum(['50k-100k', '100k-250k', '250k-500k', '500k+']),
  timeline: z.enum(['immediate', '3-months', '6-months', '1-year']),
  experience: z.string().min(20),
  message: z.string().min(20),
});

router.post('/franchise-inquiry', async (req, res) => {
  try {
    const data = franchiseInquirySchema.parse(req.body);
    
    await GoogleSheetsService.logFranchiseInquiry(data);

    // TODO: Send email to franchise team + HubSpot integration

    res.json({
      success: true,
      message: 'Thank you for your interest! Our franchise team will contact you within 48 hours.',
      messageHe: 'תודה על ההתעניינות! צוות הזיכיון שלנו יצור קשר תוך 48 שעות.',
    });
  } catch (error) {
    logger.error('[GlobalForms] Franchise inquiry error:', error);
    res.status(400).json({ error: 'Invalid form data' });
  }
});

// =========================
// K9000 QUICK BOOKING (No account required)
// =========================
const k9000QuickBookingSchema = z.object({
  customerName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  petName: z.string().min(2),
  stationLocation: z.string(),
  washType: z.enum(['BASIC', 'PREMIUM', 'DELUXE']),
  preferredDateTime: z.string(),
  notes: z.string().optional(),
});

router.post('/k9000/quick-booking', async (req, res) => {
  try {
    const data = k9000QuickBookingSchema.parse(req.body);
    
    // Generate booking ID
    const bookingId = `K9000-${Date.now()}`;
    
    await GoogleSheetsService.logK9000Booking({
      bookingId,
      customerName: data.customerName,
      email: data.email,
      phone: data.phone,
      petName: data.petName,
      stationLocation: data.stationLocation,
      washType: data.washType,
      dateTime: data.preferredDateTime,
      amount: data.washType === 'BASIC' ? 49 : data.washType === 'PREMIUM' ? 79 : 119,
      paymentStatus: 'Pending',
      notes: data.notes || '',
    });

    res.json({
      success: true,
      bookingId,
      message: 'Booking request submitted! We\'ll send payment link via email.',
      messageHe: 'בקשת ההזמנה נשלחה! נשלח קישור לתשלום במייל.',
    });
  } catch (error) {
    logger.error('[GlobalForms] K9000 quick booking error:', error);
    res.status(400).json({ error: 'Invalid booking data' });
  }
});

// =========================
// GET GOOGLE SHEETS URL (Admin only)
// =========================
router.get('/admin/sheets-url', async (req, res) => {
  // TODO: Add admin authentication middleware
  const url = GoogleSheetsService.getSpreadsheetUrl();
  
  if (!url) {
    return res.status(503).json({ error: 'Google Sheets not configured' });
  }

  res.json({ url });
});

// =========================
// HEALTH CHECK
// =========================
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Global Forms API',
    platforms: ['K9000', 'Sitter Suite', 'Walk My Pet', 'PetTrek', 'Academy', 'Plush Lab', 'Main Wash', 'Club'],
    googleSheetsEnabled: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  });
});

export default router;
