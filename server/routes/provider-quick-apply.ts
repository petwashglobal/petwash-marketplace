/**
 * The 60-second provider application (2026-09-18).
 *
 * Production numbers today: 0 providers, 0 applications ever, 0 bookings.
 * Every "join" link led into the three-step onboarding wizard, which asks for
 * a signup, an ID and a selfie before we know the person's name — so nobody
 * finished. This is the short front door: name, phone, city, what you offer.
 * It creates a CRM lead, alerts the team, and invites the applicant to finish
 * verification in the app afterwards.
 *
 * PUBLIC on purpose (a walker is not a user yet) and therefore treated as
 * hostile input: rate limited, Turnstile-checked when configured, validated,
 * and it can never write anything but a lead. NO identity data is accepted —
 * ID, passport, bank and selfie belong to the verified flow.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { crmLeads } from '@shared/schema';
import { logger } from '../lib/logger';
import { paymentLimiter } from '../middleware/rateLimiter';
import { verifyTurnstileToken } from '../lib/verifyTurnstile';

const router = Router();

const SERVICES = ['dog_walking', 'pet_sitting', 'grooming', 'training', 'transport'] as const;

const applicationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(32),
  email: z.string().trim().email().max(160),
  city: z.string().trim().min(1).max(80),
  services: z.array(z.enum(SERVICES)).min(1).max(SERVICES.length),
  about: z.string().trim().max(1000).optional(),
  turnstileToken: z.string().max(4096).optional(),
});

export type ProviderApplicationInput = z.infer<typeof applicationSchema>;

/** Pure: the lead a submission becomes. Exported for the behaviour test. */
export function applicationToLead(input: ProviderApplicationInput) {
  const parts = input.fullName.split(/\s+/);
  const notes = [
    `שירותים: ${input.services.join(', ')}`,
    `עיר: ${input.city}`,
    input.about ? `על עצמי: ${input.about}` : '',
  ].filter(Boolean).join('\n');
  return {
    firstName: parts[0].slice(0, 80),
    lastName: (parts.slice(1).join(' ') || '-').slice(0, 80),
    email: input.email.toLowerCase(),
    phone: input.phone,
    leadSource: 'provider_quick_apply',
    sourceDetails: `60-second form · ${input.city}`,
    leadStatus: 'new' as const,
    interestedServices: input.services,
    notes,
  };
}

router.post('/apply', paymentLimiter, async (req: Request, res: Response) => {
  const parsed = applicationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Please check the form', details: parsed.error.flatten().fieldErrors });
  }
  const input = parsed.data;

  // BOT CHECK (2026-09-19, corrected twice — both mistakes were mine).
  //
  // 1. verifyTurnstileToken returns { valid, reason }, NOT { success }. Reading
  //    the wrong field made `!verdict.success` true for every caller, so the
  //    live form answered 403 to every real applicant. The unit test mocked my
  //    wrong shape and passed — a test that encodes the bug proves nothing.
  // 2. A token can be IMPOSSIBLE to obtain through no fault of the applicant:
  //    on petwash.co.il the widget currently returns Cloudflare error 600010
  //    (site key does not allow this domain). Refusing then means the form
  //    takes nobody at all. This endpoint moves no money and creates only a
  //    lead, so a missing token lets the application through, tagged for
  //    review; a token that is PRESENT and fails verification is a real bot
  //    signal and is refused. The rate limiter guards volume either way.
  let botCheck: 'passed' | 'unavailable' = 'passed';
  if (process.env.TURNSTILE_SECRET_KEY) {
    const token = (input.turnstileToken ?? '').trim();
    if (!token) {
      botCheck = 'unavailable';
      logger.warn('[ProviderApply] no bot-check token — accepting and flagging', { ip: req.ip });
    } else {
      const verdict = await verifyTurnstileToken(token, req.ip);
      if (!verdict.valid) {
        logger.warn('[ProviderApply] turnstile refused', { ip: req.ip, reason: verdict.reason });
        return res.status(403).json({ ok: false, error: 'Could not verify you are human. Please try again.' });
      }
    }
  }

  const lead = applicationToLead(input);
  if (botCheck === 'unavailable') {
    lead.sourceDetails = `${lead.sourceDetails} · bot-check unavailable`;
  }
  try {
    const [existing] = await db.select({ id: crmLeads.id }).from(crmLeads).where(eq(crmLeads.email, lead.email)).limit(1);
    if (existing) {
      // Saying "you already applied" is honest and stops duplicates; it leaks
      // nothing a person does not already know about their own address.
      return res.json({ ok: true, alreadyApplied: true, message: 'You have already applied — we will be in touch.' });
    }
    await db.insert(crmLeads).values(lead);
  } catch (err: any) {
    if (err?.code === '23505' || /duplicate key/i.test(String(err?.message))) {
      return res.json({ ok: true, alreadyApplied: true, message: 'You have already applied — we will be in touch.' });
    }
    logger.error('[ProviderApply] could not save the application', { error: err?.message });
    return res.status(500).json({ ok: false, error: 'We could not save your details. Please try again.' });
  }

  // Tell a human, and thank the applicant. Neither may fail the application.
  try {
    const { createOrUpdateAlert } = await import('../services/AlertEngine');
    await createOrUpdateAlert({
      dedupeKey: `provider_quick_apply:${lead.email}:`,
      category: 'provider',
      severity: 'info',
      title: 'New provider application',
      message: `${input.fullName} · ${input.city} · ${input.services.join(', ')} · ${input.phone}`,
      linkedEntityType: 'crm_lead',
      linkedEntityId: lead.email,
      source: 'auto_sweep',
      metadata: { city: input.city, services: input.services },
    });
  } catch { /* the lead is saved; an alert failure must not lose it */ }

  logger.info('[ProviderApply] new applicant', { city: input.city, services: input.services });
  res.json({ ok: true, message: 'Thank you — we will call you.' });
});

export default router;
