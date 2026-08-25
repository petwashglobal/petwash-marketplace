import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { users, onboardingCases } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { generateMembershipId, assignCustomerMembership } from '../services/MembershipService';
import { WelcomeEmailService } from '../services/WelcomeEmailService';
import { peekEmailVerificationToken } from './onboarding-verification';
import { twilioSMSService } from '../services/TwilioSMSService';
// HubSpot removed 2026-08-21 (CEO): hubspot.ts has been a no-op since the
// Replit connector was cut in June. Every syncUserToHubSpot / trackHubSpotEvent
// call did nothing — kept only a "disabled" log line. Google stack (Sheets /
// Docs / Forms / Drive / Maps) is the source of truth for signup capture.
import crypto from 'crypto';

const router = Router();

type UserTypeIntent = 'customer' | 'loyalty' | 'provider' | 'staff_request';
type OnboardingStatus = 'started' | 'profile_required' | 'kyc_required' | 'pending_review' | 'approved' | 'rejected';

interface CompleteRegistrationRequest {
  emailToken: string;
  smsToken: string;
  userType: UserTypeIntent;
  email: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  language?: string;
}

const ROUTE_MAP: Record<UserTypeIntent, string> = {
  customer: '/complete-profile',
  loyalty: '/loyalty/complete-profile',
  provider: '/provider/onboarding',
  staff_request: '/staff/request-access',
};

const INITIAL_STATUS: Record<UserTypeIntent, OnboardingStatus> = {
  customer: 'profile_required',
  loyalty: 'profile_required',
  provider: 'started',
  staff_request: 'started',
};

const MEMBERSHIP_CLASS: Record<UserTypeIntent, 'PWM' | 'PWP' | 'PWS'> = {
  customer: 'PWM',
  loyalty: 'PWM',
  provider: 'PWP',
  staff_request: 'PWS',
};

const AUDIENCE_MAP: Record<UserTypeIntent, 'public_customer' | 'provider_applicant' | 'staff_request'> = {
  customer: 'public_customer',
  loyalty: 'public_customer',
  provider: 'provider_applicant',
  staff_request: 'staff_request',
};

router.post('/complete-registration', async (req: Request, res: Response) => {
  const traceId = crypto.randomUUID().slice(0, 8);

  try {
    const { userType, email, phone, firstName, lastName, language = 'he' } = req.body as CompleteRegistrationRequest;

    if (!userType || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userType, email, phone',
      });
    }

    if (!['customer', 'loyalty', 'provider', 'staff_request'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userType. Must be one of: customer, loyalty, provider, staff_request',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { emailToken, smsToken } = req.body as CompleteRegistrationRequest;
    // Audit F5 fix (2026-08-24): both token checks were `if (token)` guards, so a
    // caller who omitted BOTH tokens passed validation. That let anyone spawn
    // onboarding_cases rows and fire welcome emails to arbitrary addresses.
    // Both tokens are now mandatory — a request without proven contact-owner
    // possession never touches the database or the mailer.
    if (!emailToken || !smsToken) {
      logger.warn('[CompleteRegistration] Missing verification tokens — refusing to spawn onboarding row', {
        traceId,
        hasEmailToken: !!emailToken,
        hasSmsToken: !!smsToken,
      });
      return res.status(400).json({
        success: false,
        message: 'Email and phone verification tokens are both required to complete registration.',
        code: 'MISSING_VERIFICATION_TOKENS',
      });
    }
    const emailCheck = peekEmailVerificationToken(emailToken);
    if (!emailCheck.valid) {
      logger.warn('[CompleteRegistration] Invalid email verification token', { traceId });
      return res.status(400).json({ success: false, message: 'Email verification token is invalid or expired' });
    }
    if (emailCheck.email && emailCheck.email !== normalizedEmail) {
      logger.warn('[CompleteRegistration] Email mismatch with token', { traceId });
      return res.status(400).json({ success: false, message: 'Email does not match verified email' });
    }
    const smsCheck = twilioSMSService.validateVerificationToken(smsToken);
    if (!smsCheck.valid) {
      logger.warn('[CompleteRegistration] Invalid SMS verification token', { traceId });
      return res.status(400).json({ success: false, message: 'Phone verification token is invalid or expired' });
    }

    const membershipNumber = await generateMembershipId(MEMBERSHIP_CLASS[userType]);
    const onboardingStatus = INITIAL_STATUS[userType];
    const redirectTo = ROUTE_MAP[userType];

    const [newCase] = await db.insert(onboardingCases).values({
      userId: normalizedEmail,
      context: userType,
      status: onboardingStatus,
      currentStep: 'registration_complete',
    }).onConflictDoNothing().returning({ id: onboardingCases.id });

    const isNewCase = !!newCase;

    logger.info('[CompleteRegistration] Registration completed', {
      userType,
      onboardingStatus,
      membershipNumber,
      redirectTo,
      isNewCase,
      email: normalizedEmail.slice(0, 3) + '***',
      traceId,
    });

    if (isNewCase) {
      WelcomeEmailService.sendWelcomeEmail({
        audience: AUDIENCE_MAP[userType],
        toEmail: normalizedEmail,
        membershipNumber,
        language,
        traceId,
      }).catch(err => {
        logger.warn('[CompleteRegistration] Welcome email send failed (non-blocking)', { error: err.message, traceId });
      });
    }

    // HubSpot sync removed 2026-08-21 (see import comment above).

    return res.json({
      success: true,
      userType,
      onboardingStatus,
      membershipNumber,
      redirectTo,
      traceId,
    });
  } catch (error: any) {
    if (error?.code === '23505' || error?.constraint === 'users_phone_unique') {
      return res.status(409).json({ success: false, message: 'Phone number already in use' });
    }
    logger.error('[CompleteRegistration] Error', { error: error.message, traceId });
    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

router.get('/onboarding-status', async (req: Request, res: Response) => {
  try {
    const { email, membershipNumber } = req.query;

    if (!email && !membershipNumber) {
      return res.status(400).json({ success: false, message: 'Provide email or membershipNumber' });
    }

    const identifier = email ? String(email).toLowerCase().trim() : String(membershipNumber);

    const [onboardingCase] = await db
      .select()
      .from(onboardingCases)
      .where(eq(onboardingCases.userId, identifier))
      .limit(1);

    if (!onboardingCase) {
      // False-success round 1 (2026-08-22): previously HTTP 200 with
      // `{ success:false, found:false }` — clients that branched on
      // `res.ok` and read `redirectTo` (undefined) would follow an
      // empty redirect. Peer branches in this file already use 500 on
      // failure; treat "not found" as a proper 404 so clients that
      // check status short-circuit correctly.
      return res.status(404).json({
        success: false,
        found: false,
        message: 'No onboarding record found',
      });
    }

    const userType = onboardingCase.context as UserTypeIntent;
    const redirectTo = ROUTE_MAP[userType] || '/';

    return res.json({
      success: true,
      found: true,
      userType,
      onboardingStatus: onboardingCase.status,
      currentStep: onboardingCase.currentStep,
      redirectTo,
    });
  } catch (error: any) {
    logger.error('[OnboardingStatus] Error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to check status' });
  }
});

router.post('/send-welcome-email', async (req: Request, res: Response) => {
  const traceId = crypto.randomUUID().slice(0, 8);

  try {
    // Audit F5 sibling fix (2026-08-24): this route was completely open — any
    // caller could POST toEmail=<victim>+membershipNumber and cause a welcome
    // email to be dispatched to arbitrary addresses (email-bomb + phishing
    // hazard using PetWash-branded copy). Same tokens as /complete-registration
    // above are now required so only a caller who proved possession of BOTH
    // contacts can trigger a send.
    const { audience, toEmail, membershipNumber, userId, language, emailToken, smsToken } = req.body as {
      audience?: string;
      toEmail?: string;
      membershipNumber?: string;
      userId?: string;
      language?: string;
      emailToken?: string;
      smsToken?: string;
    };

    if (!audience || !toEmail || !membershipNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: audience, toEmail, membershipNumber',
      });
    }

    if (!['public_customer', 'provider_applicant', 'staff_request'].includes(audience)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid audience. Must be: public_customer, provider_applicant, staff_request',
      });
    }

    if (!emailToken || !smsToken) {
      logger.warn('[SendWelcomeEmail] Missing verification tokens — refusing send', {
        traceId, hasEmailToken: !!emailToken, hasSmsToken: !!smsToken,
      });
      return res.status(400).json({
        success: false,
        message: 'Email and phone verification tokens are both required to dispatch a welcome email.',
        code: 'MISSING_VERIFICATION_TOKENS',
      });
    }
    const normalizedTo = String(toEmail).toLowerCase().trim();
    const emailCheck = peekEmailVerificationToken(emailToken);
    if (!emailCheck.valid) {
      return res.status(400).json({ success: false, message: 'Email verification token is invalid or expired' });
    }
    if (emailCheck.email && emailCheck.email !== normalizedTo) {
      logger.warn('[SendWelcomeEmail] toEmail did not match email-token subject', { traceId });
      return res.status(400).json({ success: false, message: 'toEmail does not match the verified email' });
    }
    const smsCheck = twilioSMSService.validateVerificationToken(smsToken);
    if (!smsCheck.valid) {
      return res.status(400).json({ success: false, message: 'Phone verification token is invalid or expired' });
    }

    const result = await WelcomeEmailService.sendWelcomeEmail({
      audience: audience as 'public_customer' | 'provider_applicant' | 'staff_request',
      toEmail: normalizedTo,
      membershipNumber,
      userId,
      language: language || 'he',
      traceId,
    });

    return res.json({
      success: result.success,
      traceId,
      message: result.success ? 'Welcome email sent' : 'Failed to send welcome email',
    });
  } catch (error: any) {
    logger.error('[SendWelcomeEmail] Error', { error: error.message, traceId });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
