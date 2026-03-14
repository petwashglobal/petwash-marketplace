import { Router, Request, Response } from 'express';
import { db } from '../db';
import { googleFormsConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { isSuperAdmin } from '../middleware/rbac';
import { createAllForms, FORMS_DEFINITIONS } from '../services/GoogleFormsCreatorService';

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

router.get('/api/google-forms/list', async (_req: Request, res: Response) => {
  try {
    const configs = await db.select().from(googleFormsConfig).where(eq(googleFormsConfig.enabled, true));
    const definitions = FORMS_DEFINITIONS.map(d => ({
      type: d.type,
      title: d.title,
      titleHe: d.titleHe,
      description: d.description,
      sheetTab: d.sheetTab,
      questionCount: d.items.length,
    }));

    res.json({
      configured: configs,
      available: definitions,
      total: definitions.length,
      created: configs.length,
    });
  } catch (error) {
    logger.error('[GoogleForms] Error listing forms', error);
    res.status(500).json({ error: 'Failed to list forms' });
  }
});

router.post('/api/google-forms/create-all', requireAdmin, async (_req: Request, res: Response) => {
  try {
    logger.info('[GoogleForms] Starting bulk form creation...');
    const results = await createAllForms();
    const succeeded = results.filter(r => r.formId);
    const failed = FORMS_DEFINITIONS.length - succeeded.length;

    res.json({
      success: true,
      created: succeeded.length,
      failed,
      forms: succeeded.map(r => ({
        formType: r.formType,
        title: r.title,
        url: r.responderUri,
        sheetTab: r.sheetTab,
      })),
    });
  } catch (error: any) {
    logger.error('[GoogleForms] Bulk creation error', error);
    res.status(500).json({ error: error.message || 'Form creation failed' });
  }
});

router.post('/api/google-forms/create/:formType', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { formType } = req.params;
    const def = FORMS_DEFINITIONS.find(d => d.type === formType);
    if (!def) {
      return res.status(404).json({ error: `Unknown form type: ${formType}` });
    }
    const { createAllForms: createSingle } = await import('../services/GoogleFormsCreatorService');
    const results = await createSingle();
    const result = results.find(r => r.formType === formType);
    if (!result) {
      return res.status(500).json({ error: 'Form creation failed' });
    }
    res.json({ success: true, form: result });
  } catch (error: any) {
    logger.error('[GoogleForms] Single form creation error', error);
    res.status(500).json({ error: error.message || 'Form creation failed' });
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

router.patch('/api/google-forms/config/:formType/toggle', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { formType } = req.params;
    const [current] = await db.select().from(googleFormsConfig).where(eq(googleFormsConfig.formType, formType)).limit(1);
    if (!current) return res.status(404).json({ error: 'Form not found' });

    const [updated] = await db.update(googleFormsConfig)
      .set({ enabled: !current.enabled, updatedAt: new Date() })
      .where(eq(googleFormsConfig.formType, formType))
      .returning();

    res.json(updated);
  } catch (error) {
    logger.error('[GoogleForms] Toggle error', error);
    res.status(500).json({ error: 'Failed to toggle form' });
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
