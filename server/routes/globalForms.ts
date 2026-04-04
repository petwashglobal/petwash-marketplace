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
import { validateFirebaseToken } from '../franchiseAuth';
import { requireAdminRole } from '../lib/adminCheck';
import { EmailService } from '../emailService';
import { sendFranchiseApplicationConfirmation } from '../email/luxury-email-service';
import { petWashOrchestrator } from '../services/PetWashOperationsOrchestrator';

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

    // Send email notification to Support team
    await EmailService.send({
      to: 'Support@PetWash.co.il',
      subject: `New Contact Form: ${data.subject} (${data.platform})`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Platform:</strong> ${data.platform}</p>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
        <p><strong>Message:</strong></p>
        <p>${data.message}</p>
      `,
    }).catch(err => logger.error('[GlobalForms] Failed to send contact email notification', err));
    
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
      message: 'Welcome to ⁦Pet Wash™⁩ Newsletter!',
      messageHe: 'ברוכים הבאים לניוזלטר של ⁦Pet Wash™⁩!',
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

    // Send email notification to franchise team
    await EmailService.send({
      to: 'franchise@petwash.co.il',
      subject: `🌟 New Franchise Inquiry: ${data.name} - ${data.country}`,
      html: `
        <h2>New Franchise Inquiry Received</h2>
        <h3>Contact Information</h3>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Company:</strong> ${data.company || 'Individual investor'}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        
        <h3>Location & Investment</h3>
        <p><strong>Country:</strong> ${data.country}</p>
        <p><strong>City:</strong> ${data.city}</p>
        <p><strong>Investment Budget:</strong> ${data.investmentBudget}</p>
        <p><strong>Timeline:</strong> ${data.timeline}</p>
        
        <h3>Experience</h3>
        <p>${data.experience}</p>
        
        <h3>Additional Message</h3>
        <p>${data.message}</p>
        
        <hr>
        <p><small>Follow up within 48 hours to maintain lead quality.</small></p>
      `,
    }).catch(err => logger.error('[GlobalForms] Failed to send franchise inquiry email', err));

    const nameParts = data.name.trim().split(' ');
    const firstName = nameParts[0] || data.name;
    const lastName = nameParts.slice(1).join(' ') || '';
    sendFranchiseApplicationConfirmation(
      data.email,
      firstName,
      lastName,
      {
        companyName: data.company,
        country: data.country,
        investmentRange: data.investmentBudget,
        language: 'en',
      }
    ).catch(err => logger.error('[GlobalForms] Failed to send franchise confirmation to applicant', err));

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
// HR JOB APPLICATION
// =========================
const hrJobApplicationSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  address: z.string().optional(),
  city: z.string().min(2),
  country: z.string().min(2),
  dateOfBirth: z.string().optional(),
  position: z.string().min(2),
  department: z.string().min(2),
  yearsExperience: z.string(),
  educationLevel: z.string(),
  taxId: z.string().optional(),
  linkedinUrl: z.string().optional(),
  expectedSalary: z.string().optional(),
  startDate: z.string().optional(),
  coverLetter: z.string().min(50, 'Cover letter must be at least 50 characters'),
  referencesAvailable: z.string().optional(),
  referralSource: z.string().optional(),
});

router.post('/hr-application', async (req, res) => {
  try {
    const data = hrJobApplicationSchema.parse(req.body);
    const appId = `HR-${Date.now()}`;
    await GoogleSheetsService.appendToSheet('HR Job Applications', {
      Timestamp: new Date().toISOString(),
      'Application ID': appId,
      'First Name': data.firstName,
      'Last Name': data.lastName,
      'Email': data.email,
      'Phone': data.phone,
      'Position': data.position,
      'Department': data.department,
      'Experience (Years)': data.yearsExperience,
      'City': data.city,
      'Country': data.country,
      'Address': data.address || '',
      'Education': data.educationLevel,
      'Tax ID': data.taxId || '',
      'LinkedIn': data.linkedinUrl || '',
      'Expected Salary': data.expectedSalary || '',
      'Cover Letter': data.coverLetter,
      'References Available': data.referencesAvailable || '',
      'Referral Source': data.referralSource || '',
      'Start Date': data.startDate || '',
      'Status': 'New',
    });
    await EmailService.send({
      to: 'hr@petwash.co.il',
      subject: `New Job Application: ${data.firstName} ${data.lastName} — ${data.position}`,
      html: `<h2>New Job Application</h2><p><strong>${data.firstName} ${data.lastName}</strong> applied for <strong>${data.position}</strong> (${data.department})</p><p>Email: ${data.email} | Phone: ${data.phone}</p><p>City: ${data.city}, ${data.country}</p><p>Experience: ${data.yearsExperience}</p><p><strong>Cover Letter:</strong><br>${data.coverLetter.replace(/\n/g, '<br>')}</p>`,
    }).catch(() => {});
    res.json({ success: true, applicationId: appId, message: 'Application received! We will review it within 5 business days.', messageHe: 'הבקשה התקבלה! נבחן אותה תוך 5 ימי עסקים.' });
  } catch (error) {
    logger.error('[GlobalForms] HR application error:', error);
    res.status(400).json({ error: 'Invalid application data' });
  }
});

// =========================
// SALES LEAD
// =========================
const salesLeadSchema = z.object({
  contactName: z.string().min(2),
  company: z.string().optional(),
  email: z.string().email(),
  phone: z.string().min(8),
  address: z.string().optional(),
  city: z.string().min(2),
  country: z.string().min(2),
  inquiryType: z.string(),
  serviceInterest: z.string(),
  estimatedVolume: z.string().optional(),
  numberOfPets: z.string().optional(),
  description: z.string().min(20),
  bestContactTime: z.string().optional(),
  referralSource: z.string().optional(),
});

router.post('/sales-lead', async (req, res) => {
  try {
    const data = salesLeadSchema.parse(req.body);
    const leadId = `LEAD-${Date.now()}`;
    await GoogleSheetsService.appendToSheet('Sales Leads', {
      Timestamp: new Date().toISOString(),
      'Lead ID': leadId,
      'Lead Type': data.inquiryType,
      'Company / Name': data.company || data.contactName,
      'Email': data.email,
      'Phone': data.phone,
      'Source': data.referralSource || 'Web Form',
      'Service Interest': data.serviceInterest,
      'City': data.city,
      'Country': data.country,
      'Address': data.address || '',
      'Description': data.description,
      'Estimated Monthly Value (₪)': data.estimatedVolume || '',
      'Number of Pets': data.numberOfPets || '',
      'Stage': 'New Lead',
      'Status': 'Open',
    });
    await EmailService.send({
      to: 'sales@petwash.co.il',
      subject: `New Sales Lead: ${data.contactName} — ${data.serviceInterest}`,
      html: `<h2>New Sales Lead</h2><p><strong>${data.contactName}</strong>${data.company ? ` (${data.company})` : ''}</p><p>Email: ${data.email} | Phone: ${data.phone}</p><p>Interest: ${data.serviceInterest} | Type: ${data.inquiryType}</p><p>Volume: ${data.estimatedVolume || 'Not specified'}</p><p>${data.description}</p>`,
    }).catch(() => {});
    res.json({ success: true, leadId, message: 'Thank you! Our sales team will contact you within 24 hours.', messageHe: 'תודה! צוות המכירות שלנו יצור קשר תוך 24 שעות.' });
  } catch (error) {
    logger.error('[GlobalForms] Sales lead error:', error);
    res.status(400).json({ error: 'Invalid lead data' });
  }
});

// =========================
// REFUND REQUEST
// =========================
const refundRequestSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  address: z.string().optional(),
  city: z.string().optional(),
  bookingId: z.string().min(2, 'Booking ID is required'),
  serviceType: z.string(),
  bookingDate: z.string().optional(),
  amountPaid: z.string().min(1, 'Amount is required'),
  refundAmount: z.string().min(1, 'Refund amount is required'),
  reason: z.string(),
  description: z.string().min(20),
  refundMethod: z.string(),
});

router.post('/refund-request', async (req, res) => {
  try {
    const data = refundRequestSchema.parse(req.body);
    const requestId = `REF-${Date.now()}`;
    await GoogleSheetsService.appendToSheet('Refund Requests', {
      Timestamp: new Date().toISOString(),
      'Request ID': requestId,
      'Booking ID': data.bookingId,
      'Customer Name': data.fullName,
      'Email': data.email,
      'Phone': data.phone,
      'Address': data.address || '',
      'Service Type': data.serviceType,
      'Booking Date': data.bookingDate || '',
      'Original Amount (₪)': data.amountPaid,
      'Refund Amount (₪)': data.refundAmount,
      'Reason': data.reason,
      'Description': data.description,
      'Refund Method': data.refundMethod,
      'Status': 'Pending Review',
    });
    await EmailService.send({
      to: 'finance@petwash.co.il',
      subject: `Refund Request ${requestId}: ${data.fullName} — ₪${data.refundAmount}`,
      html: `<h2>Refund Request</h2><p>ID: <strong>${requestId}</strong></p><p>Customer: ${data.fullName} | ${data.email} | ${data.phone}</p><p>Booking: ${data.bookingId} | Service: ${data.serviceType}</p><p>Amount Paid: ₪${data.amountPaid} | Refund Requested: ₪${data.refundAmount}</p><p>Reason: ${data.reason}</p><p>${data.description}</p>`,
    }).catch(() => {});
    res.json({ success: true, requestId, message: `Refund request ${requestId} submitted. We'll review within 2-5 business days.`, messageHe: `בקשת ההחזר ${requestId} נשלחה. נבחן תוך 2-5 ימי עסקים.` });
  } catch (error) {
    logger.error('[GlobalForms] Refund request error:', error);
    res.status(400).json({ error: 'Invalid refund request data' });
  }
});

// =========================
// CUSTOMER ONBOARDING & PET PROFILE
// =========================
const customerOnboardingSchema = z.object({
  ownerFirstName: z.string().min(2),
  ownerLastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  address: z.string().min(5),
  city: z.string().min(2),
  country: z.string().min(2),
  language: z.string().optional(),
  petName: z.string().min(2),
  species: z.string(),
  breed: z.string().optional(),
  age: z.string(),
  weight: z.string().optional(),
  gender: z.string().optional(),
  microchipNumber: z.string().optional(),
  vetName: z.string().optional(),
  vetPhone: z.string().optional(),
  allergies: z.string().optional(),
  medicalNotes: z.string().optional(),
  vaccinationsUpToDate: z.string(),
  referralSource: z.string().optional(),
});

router.post('/customer-onboarding', async (req, res) => {
  try {
    const data = customerOnboardingSchema.parse(req.body);
    const petId = `PET-${Date.now()}`;
    await GoogleSheetsService.appendToSheet('Pet Profiles', {
      Timestamp: new Date().toISOString(),
      'Pet ID': petId,
      'Owner ID': '',
      'Owner Name': `${data.ownerFirstName} ${data.ownerLastName}`,
      'Email': data.email,
      'Phone': data.phone,
      'Address': data.address,
      'Pet Name': data.petName,
      'Species': data.species,
      'Breed': data.breed || '',
      'Age': data.age,
      'Weight (kg)': data.weight || '',
      'Gender': data.gender || '',
      'Microchip Number': data.microchipNumber || '',
      'Vet Name': data.vetName || '',
      'Vet Phone': data.vetPhone || '',
      'Allergies': data.allergies || '',
      'Medical Notes': data.medicalNotes || '',
      'Vaccinations': data.vaccinationsUpToDate,
      'Status': 'Active',
    });
    await EmailService.send({
      to: data.email,
      subject: `Welcome to PetWash™ — ${data.petName} is registered!`,
      html: `<h2>Welcome to PetWash™! 🐾</h2><p>Hi ${data.ownerFirstName},</p><p>We've registered <strong>${data.petName}</strong> and your profile is now active.</p><p>You can now book services for ${data.petName} across all PetWash™ platforms.</p><p>Pet ID: <strong>${petId}</strong></p>`,
    }).catch(() => {});
    res.json({ success: true, petId, message: `Welcome to PetWash™! ${data.petName} is now registered.`, messageHe: `ברוכים הבאים ל-PetWash™! ${data.petName} נרשם בהצלחה.` });
  } catch (error) {
    logger.error('[GlobalForms] Customer onboarding error:', error);
    res.status(400).json({ error: 'Invalid onboarding data' });
  }
});

// =========================
// GET GOOGLE SHEETS URL (Admin only)
// =========================
router.get('/admin/sheets-url', validateFirebaseToken, requireAdminRole, async (req: any, res) => {
  // ✅ SECURITY: Admin authentication enforced by requireAdminRole middleware
  const url = GoogleSheetsService.getSpreadsheetUrl();
  
  if (!url) {
    return res.status(503).json({ error: 'Google Sheets not configured' });
  }

  res.json({ url });
});

// =========================
// CLUB REGISTRATION
// =========================
const clubRegistrationSchema = z.object({
  firstName: z.string().min(2), lastName: z.string().min(2),
  email: z.string().email(), phone: z.string().min(5),
  plan: z.enum(['gold', 'platinum', 'diamond']),
  dateOfBirth: z.string().optional(), idNumber: z.string().optional(),
  address: z.string().optional(), city: z.string().optional(), postalCode: z.string().optional(),
  petName: z.string().optional(), petType: z.string().optional(),
  petBreed: z.string().optional(), petAge: z.string().optional(), petWeight: z.string().optional(),
  vetName: z.string().optional(), vetPhone: z.string().optional(),
  emergencyContact: z.string().optional(), emergencyPhone: z.string().optional(),
  how: z.string().optional(), photoUrl: z.string().optional(),
  acceptTerms: z.boolean(), acceptMarketing: z.boolean().optional(),
});

router.post('/club-registration', async (req, res) => {
  try {
    const data = clubRegistrationSchema.parse(req.body);
    const memberId = `CLUB-${Date.now().toString(36).toUpperCase()}`;
    await GoogleSheetsService.appendToSheet('Club Members', [
      new Date().toISOString(), memberId, data.plan.toUpperCase(),
      data.firstName, data.lastName, data.email, data.phone,
      data.city || '', data.petName || '', data.petType || '', data.how || '',
    ]);
    res.json({ success: true, memberId });
    setImmediate(() => {
      petWashOrchestrator.handleClubRegistration({
        memberId, plan: data.plan,
        firstName: data.firstName, lastName: data.lastName,
        email: data.email, phone: data.phone,
        city: data.city, petName: data.petName, petType: data.petType,
      }).catch(err => logger.warn('[GlobalForms] Club orchestrator failed', err));
    });
  } catch (err) {
    logger.error('Club registration failed', err);
    res.status(400).json({ error: 'Registration failed' });
  }
});

// =========================
// PROVIDER REGISTRATION
// =========================
const providerRegistrationSchema = z.object({
  firstName: z.string().min(2), lastName: z.string().min(2),
  email: z.string().email(), phone: z.string().min(5),
  platform: z.string().min(2), experienceYears: z.string().optional(),
  idNumber: z.string().optional(), dateOfBirth: z.string().optional(),
  address: z.string().optional(), city: z.string().optional(), postalCode: z.string().optional(),
  businessName: z.string().optional(), vatNumber: z.string().optional(),
  certificationName: z.string().optional(), certificationBody: z.string().optional(),
  selfieUrl: z.string().optional(), idDocUrl: z.string().optional(),
  certDocUrl: z.string().optional(), portfolioUrl: z.string().optional(),
  bankAccount: z.string().optional(), bankName: z.string().optional(),
  availability: z.string().optional(), bio: z.string().optional(),
  acceptTerms: z.boolean(), acceptBackground: z.boolean(),
});

router.post('/provider-registration', async (req, res) => {
  try {
    const data = providerRegistrationSchema.parse(req.body);
    const applicationId = `PRV-${Date.now().toString(36).toUpperCase()}`;
    await GoogleSheetsService.appendToSheet('Provider Applications', [
      new Date().toISOString(), applicationId, data.platform,
      data.firstName, data.lastName, data.email, data.phone,
      data.city || '', data.businessName || '', data.vatNumber || '',
      data.experienceYears || '', data.availability || '',
      data.selfieUrl ? 'YES' : 'NO', data.idDocUrl ? 'YES' : 'NO',
      data.certDocUrl ? 'YES' : 'NO', 'PENDING',
    ]);
    res.json({ success: true, applicationId });
    setImmediate(() => {
      petWashOrchestrator.handleProviderRegistration({
        applicationId, platform: data.platform,
        firstName: data.firstName, lastName: data.lastName,
        email: data.email, phone: data.phone,
        idNumber: data.idNumber, city: data.city,
        businessName: data.businessName, vatNumber: data.vatNumber,
        experienceYears: data.experienceYears, selfieUrl: data.selfieUrl,
        idDocUrl: data.idDocUrl, certDocUrl: data.certDocUrl,
        bankName: data.bankName, bankAccount: data.bankAccount, availability: data.availability, bio: data.bio,
      }).catch(err => logger.warn('[GlobalForms] Provider orchestrator failed', err));
    });
  } catch (err) {
    logger.error('Provider registration failed', err);
    res.status(400).json({ error: 'Registration failed' });
  }
});

// =========================
// QUICK BOOKING
// =========================
const quickBookingSchema = z.object({
  platform: z.string().min(2), serviceType: z.string().min(2),
  date: z.string().min(8), time: z.string().min(4),
  firstName: z.string().min(2), lastName: z.string().optional(),
  email: z.string().email(), phone: z.string().min(5),
  address: z.string().optional(), city: z.string().optional(),
  // Israeli postal code (7 digits) + apartment/unit captured from Google Places autocomplete
  postalCode: z.string().optional(),
  apartment:  z.string().optional(),
  lat: z.number().optional(), lng: z.number().optional(),
  petName: z.string().optional(), petType: z.string().optional(),
  petSize: z.string().optional(), petBreed: z.string().optional(),
  petNotes: z.string().optional(), specialRequests: z.string().optional(),
  coupon: z.string().optional(),
});

router.post('/quick-booking', async (req, res) => {
  try {
    const data = quickBookingSchema.parse(req.body);
    const bookingRef = `BK-${Date.now().toString(36).toUpperCase()}`;
    // All address sub-fields stored in Sheets for full audit trail (§17b compliance)
    // NOTE: appendFormSubmissionDirect auto-prepends a timestamp — do not include one here.
    await GoogleSheetsService.appendToSheet('Quick Bookings', [
      bookingRef, data.platform, data.serviceType,
      data.date, data.time, data.firstName, data.email, data.phone,
      data.address || '',
      data.apartment || '',
      data.city || '',
      data.postalCode || '',
      String(data.lat ?? ''), String(data.lng ?? ''),
      data.petName || '', data.petSize || '', 'PENDING',
    ]);
    res.json({ success: true, bookingRef });
    setImmediate(() => {
      petWashOrchestrator.handleBookingSubmission({
        bookingRef, platform: data.platform, serviceType: data.serviceType,
        date: data.date, time: data.time,
        firstName: data.firstName, lastName: data.lastName,
        email: data.email, phone: data.phone,
        address: data.address, city: data.city,
        postalCode: data.postalCode,
        apartment: data.apartment,
        petName: data.petName, petSize: data.petSize,
        specialRequests: data.specialRequests,
      }).catch(err => logger.warn('[GlobalForms] Booking orchestrator failed', err));
    });
  } catch (err) {
    logger.error('Quick booking failed', err);
    res.status(400).json({ error: 'Booking failed' });
  }
});

// =========================
// LEGAL AGREEMENT / E-SIGN
// =========================
const legalAgreementSchema = z.object({
  fullName: z.string().min(2), idNumber: z.string().min(5), email: z.string().email(),
  department: z.string().optional(), representingCompany: z.string().optional(),
  companyRegNumber: z.string().optional(),
  agreementId: z.string().min(2), agreementTitle: z.string().optional(),
  agreementVersion: z.string().optional(), signedAt: z.string(),
  accepted: z.boolean(),
});

router.post('/legal-agreement', async (req, res) => {
  try {
    const data = legalAgreementSchema.parse(req.body);
    if (!data.accepted) return res.status(400).json({ error: 'Agreement not accepted' });
    const signatureId = `SIG-${Date.now().toString(36).toUpperCase()}`;
    await GoogleSheetsService.appendToSheet('Legal Agreements', [
      data.signedAt, signatureId, data.agreementId, data.agreementVersion || '',
      data.fullName, data.idNumber, data.email,
      data.department || '', data.representingCompany || '', data.companyRegNumber || '',
      'SIGNED', req.ip || '',
    ]);
    res.json({ success: true, signatureId });
    setImmediate(() => {
      petWashOrchestrator.handleLegalAgreementSigning({
        signatureId, agreementId: data.agreementId,
        agreementTitle: data.agreementTitle || data.agreementId,
        agreementVersion: data.agreementVersion || '1.0',
        fullName: data.fullName, idNumber: data.idNumber, email: data.email,
        department: data.department, company: data.representingCompany,
        signedAt: data.signedAt,
        agreementContent: `Agreement: ${data.agreementTitle || data.agreementId} | Version: ${data.agreementVersion || '1.0'} | Signed by: ${data.fullName} | Date: ${data.signedAt}`,
      }).catch(err => logger.warn('[GlobalForms] Legal agreement orchestrator failed', err));
    });
  } catch (err) {
    logger.error('Legal agreement signing failed', err);
    res.status(400).json({ error: 'Signing failed' });
  }
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
