import { Router } from 'express';
import { db } from '../db';
import { onboardingMilestones } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { logger } from '../lib/logger';

const router = Router();
router.use(validateFirebaseToken);

const CUSTOMER_MILESTONES = [
  { key: 'pet_profile',       label: 'Complete pet profile',      labelHe: 'השלם פרופיל חיית מחמד' },
  { key: 'pet_photo',         label: 'Add pet photo',             labelHe: 'הוסף תמונת חיית מחמד' },
  { key: 'address_added',     label: 'Add your address',          labelHe: 'הוסף כתובת' },
  { key: 'first_booking',     label: 'Complete first booking',    labelHe: 'בצע הזמנה ראשונה' },
  { key: 'first_review_given',label: 'Leave your first review',   labelHe: 'השאר ביקורת ראשונה' },
  { key: 'loyalty_joined',    label: 'Join the loyalty program',  labelHe: 'הצטרף לתוכנית נאמנות' },
];

const PROVIDER_MILESTONES = [
  { key: 'profile_photo',            label: 'Add profile photo',         labelHe: 'הוסף תמונת פרופיל' },
  { key: 'service_area',             label: 'Set service area',          labelHe: 'הגדר אזור שירות' },
  { key: 'id_verified',              label: 'Complete ID verification',   labelHe: 'אמת תעודת זהות' },
  { key: 'first_booking_accepted',   label: 'Accept first booking',       labelHe: 'קבל הזמנה ראשונה' },
  { key: 'first_session_complete',   label: 'Complete first session',     labelHe: 'השלם סשן ראשון' },
  { key: 'first_review_received',    label: 'Receive first review',       labelHe: 'קבל ביקורת ראשונה' },
];

router.get('/checklist', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const role = (req as any).firebaseUser?.claims?.role || 'customer';

    const milestoneList = role === 'provider' ? PROVIDER_MILESTONES : CUSTOMER_MILESTONES;

    const completed = await db
      .select()
      .from(onboardingMilestones)
      .where(eq(onboardingMilestones.userId, uid));

    const completedSet = new Set(completed.map(m => m.milestone));

    const checklist = milestoneList.map(m => ({
      key: m.key,
      label: m.label,
      labelHe: m.labelHe,
      completed: completedSet.has(m.key),
      completedAt: completed.find(c => c.milestone === m.key)?.completedAt ?? null,
    }));

    const totalCompleted = checklist.filter(m => m.completed).length;
    const percentComplete = Math.round((totalCompleted / checklist.length) * 100);

    res.json({ checklist, totalCompleted, total: checklist.length, percentComplete, role });
  } catch (error) {
    logger.error('Error fetching onboarding checklist', error);
    res.status(500).json({ error: 'Failed to fetch checklist' });
  }
});

router.post('/milestone/:milestoneKey', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { milestoneKey } = req.params;
    const role = (req as any).firebaseUser?.claims?.role || 'customer';

    const allKeys = [...CUSTOMER_MILESTONES, ...PROVIDER_MILESTONES].map(m => m.key);
    if (!allKeys.includes(milestoneKey)) {
      return res.status(400).json({ error: 'Invalid milestone key' });
    }

    await db.insert(onboardingMilestones)
      .values({ userId: uid, role, milestone: milestoneKey })
      .onConflictDoNothing();

    res.json({ success: true, milestone: milestoneKey });
  } catch (error) {
    logger.error('Error completing milestone', error);
    res.status(500).json({ error: 'Failed to complete milestone' });
  }
});

export default router;
