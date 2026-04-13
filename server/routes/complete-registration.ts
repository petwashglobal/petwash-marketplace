import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { users, onboardingCases } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { generateMembershipId, assignCustomerMembership } from '../services/MembershipService';
import { WelcomeEmailService } from '../services/WelcomeEmailService';
import { peekEmailVerificationToken } from './onboarding-verification';
import { twilioSMSService } from '../services/TwilioSMSService';
import { syncUserToHubSpot, trackHubSpotEvent } from '../hubspot';
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
    if (emailToken) {
      const emailCheck = peekEmailVerificationToken(emailToken);
      if (!emailCheck.valid) {
        logger.warn('[CompleteRegistration] Invalid email verification token', { traceId });
        return res.status(400).json({ success: false, message: 'Email verification token is invalid or expired' });
      }
      if (emailCheck.email && emailCheck.email !== normalizedEmail) {
        logger.warn('[CompleteRegistration] Email mismatch with token', { traceId });
        return res.status(400).json({ success: false, message: 'Email does not match verified email' });
      }
    }
    if (smsToken) {
      const smsCheck = twilioSMSService.validateVerificationToken(smsToken);
      if (!smsCheck.valid) {
        logger.warn('[CompleteRegistration] Invalid SMS verification token', { traceId });
        return res.status(400).json({ success: false, message: 'Phone verification token is invalid or expired' });
      }
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

    // ── HubSpot CRM sync — server-side safety net (fires regardless of client-side success) ──
    syncUserToHubSpot({
      uid: membershipNumber,
      email: normalizedEmail,
      firstname: firstName?.trim() || undefined,
      lastname: lastName?.trim() || undefined,
      lang: language,
    }).catch(err => {
      logger.warn('[CompleteRegistration] HubSpot sync failed (non-blocking)', { error: err?.message, traceId });
    });

    // Track lifecycle event in HubSpot timeline
    trackHubSpotEvent(normalizedEmail, `petwash_${userType}_registered`, {
      membershipNumber,
      userType,
      language,
      registeredAt: new Date().toISOString(),
    }).catch(() => {});

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
      return res.json({
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
    const { audience, toEmail, membershipNumber, userId, language } = req.body;

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

    const result = await WelcomeEmailService.sendWelcomeEmail({
      audience,
      toEmail,
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
