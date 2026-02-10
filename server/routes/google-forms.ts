import { Router, Request, Response } from 'express';
import { db } from '../db';
import { googleFormsConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { isSuperAdmin } from '../middleware/rbac';

const router = Router();

function requireAdmin(req: Request, res: Response, next: Function) {
  const email = req.firebaseUser?.email;
  if (!email || !isSuperAdmin(email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.get('/api/google-forms/config/:formType', async (req: Request, res: Response) => {
  try {
    const { formType } = req.params;
    const [config] = await db.select().from(googleFormsConfig).where(eq(googleFormsConfig.formType, formType)).limit(1);

    if (!config || !config.enabled) {
      return res.status(404).json({ error: 'Form not configured or disabled' });
    }

    res.json(config);
  } catch (error) {
    logger.error('[GoogleForms] Error fetching form config', error);
    res.status(500).json({ error: 'Failed to fetch form configuration' });
  }
});

router.get('/api/google-forms/config', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const configs = await db.select().from(googleFormsConfig);
    res.json(configs);
  } catch (error) {
    logger.error('[GoogleForms] Error fetching all form configs', error);
    res.status(500).json({ error: 'Failed to fetch form configurations' });
  }
});

router.post('/api/google-forms/config', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { formType, formUrl, formTitle, formTitleHe, enabled, height } = req.body;

    if (!formType || !formUrl) {
      return res.status(400).json({ error: 'formType and formUrl are required' });
    }

    if (!formUrl.includes('docs.google.com/forms')) {
      return res.status(400).json({ error: 'Invalid Google Forms URL' });
    }

    const existing = await db.select().from(googleFormsConfig).where(eq(googleFormsConfig.formType, formType)).limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(googleFormsConfig)
        .set({
          formUrl,
          formTitle: formTitle || null,
          formTitleHe: formTitleHe || null,
          enabled: enabled !== undefined ? enabled : true,
          height: height || 800,
          updatedAt: new Date(),
        })
        .where(eq(googleFormsConfig.formType, formType))
        .returning();
      
      logger.info('[GoogleForms] Updated form config', { formType });
      return res.json(updated);
    }

    const [created] = await db.insert(googleFormsConfig).values({
      formType,
      formUrl,
      formTitle: formTitle || null,
      formTitleHe: formTitleHe || null,
      enabled: enabled !== undefined ? enabled : true,
      height: height || 800,
    }).returning();

    logger.info('[GoogleForms] Created form config', { formType });
    res.status(201).json(created);
  } catch (error) {
    logger.error('[GoogleForms] Error saving form config', error);
    res.status(500).json({ error: 'Failed to save form configuration' });
  }
});

router.delete('/api/google-forms/config/:formType', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { formType } = req.params;
    await db.delete(googleFormsConfig).where(eq(googleFormsConfig.formType, formType));
    logger.info('[GoogleForms] Deleted form config', { formType });
    res.json({ success: true });
  } catch (error) {
    logger.error('[GoogleForms] Error deleting form config', error);
    res.status(500).json({ error: 'Failed to delete form configuration' });
  }
});

export default router;
