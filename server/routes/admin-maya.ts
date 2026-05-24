/**
 * Maya reception/intake admin API.
 *
 * Stage 1b: master kill switch + per-feature flags + by-id reads + writes.
 * Stage 2  (this version): adds list endpoints needed by the admin UI.
 *
 * Mounted at /api/admin/maya — inherits the existing admin security stack
 * (rate limit, IP risk scoring, session age guard, requireRole(ADMIN_ROLES),
 * requireStaffApproved, requireMfaEnrolled).
 *
 * All routes gated by ff.maya.enabled (master kill switch, default OFF).
 * Sub-features gated by their own ff.maya.<area>.enabled flags.
 *
 * Hard scope:
 *   - DRAFT-ONLY. Provider drafts cannot be set to 'approved'. Booking
 *     drafts cannot be set to 'confirmed'.
 *   - NO wallet writes, NO K9000 release, NO payments, NO provider
 *     approval, NO final booking confirmation, NO voice/WhatsApp/email.
 *   - Audit log is append-only at the DB level.
 *
 * Crash-safe: all handlers fail-closed. If SystemConfig hasn't loaded the
 * flags yet, the master gate treats it as disabled (503).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { logger } from '../lib/logger';
import { logAuditEvent } from '../middleware/auditLog';
import { getFeatureFlag } from '../services/SystemConfig';
import * as Maya from '../services/MayaService';

const router = Router();

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function actorFromReq(req: Request): Maya.MayaActor {
  const user = (req as any).user;
  if (user?.role === 'admin' || user?.roles?.includes?.('admin')) {
    return { type: 'admin', id: user.id ?? user.email ?? null };
  }
  if (user?.id) return { type: 'user', id: user.id };
  return { type: 'system', id: null };
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isUuid(v: unknown): v is string {
  return (
    isString(v) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

function parseLimit(q: unknown, fallback = 50): number {
  const n = Number(q);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 200);
}

// ---------------------------------------------------------------------------
// gates
// ---------------------------------------------------------------------------
async function requireMaster(_req: Request, res: Response, next: NextFunction) {
  try {
    const enabled = await getFeatureFlag('ff.maya.enabled');
    if (!enabled) {
      return res.status(503).json({ ok: false, error: 'maya_disabled' });
    }
    next();
  } catch (err) {
    logger.warn({ err }, 'ff.maya.enabled flag read failed; treating as disabled');
    return res.status(503).json({ ok: false, error: 'maya_disabled' });
  }
}

function requireFlag(flag: 'ff.maya.provider_intake.enabled' | 'ff.maya.booking_intake.enabled' | 'ff.maya.tasks.enabled' | 'ff.maya.escalations.enabled') {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const enabled = await getFeatureFlag(flag);
      if (!enabled) {
        return res.status(503).json({ ok: false, error: 'feature_disabled', feature: flag });
      }
      next();
    } catch (err) {
      logger.warn({ err, flag }, 'flag read failed; treating as disabled');
      return res.status(503).json({ ok: false, error: 'feature_disabled', feature: flag });
    }
  };
}

router.use(requireMaster);

// ---------------------------------------------------------------------------
// conversations
// ---------------------------------------------------------------------------
router.get('/conversations', async (req: Request, res: Response) => {
  const status = isString(req.query.status) ? (req.query.status as string) : undefined;
  const limit = parseLimit(req.query.limit);
  try {
    const rows = await Maya.listConversations({ status, limit });
    res.json({ ok: true, conversations: rows });
  } catch (err) {
    logger.error({ err }, 'maya listConversations failed');
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/conversations', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (!isString(body.channel) || !['web', 'admin', 'test'].includes(body.channel)) {
    return res.status(400).json({ ok: false, error: 'invalid_channel' });
  }
  if (body.locale !== undefined && (!isString(body.locale) || !['he', 'en'].includes(body.locale))) {
    return res.status(400).json({ ok: false, error: 'invalid_locale' });
  }
  try {
    const row = await Maya.createConversation(
      {
        channel: body.channel,
        locale: body.locale as string | undefined,
        contactPhone: isString(body.contactPhone) ? body.contactPhone : undefined,
        contactEmail: isString(body.contactEmail) ? body.contactEmail : undefined,
        contactName: isString(body.contactName) ? body.contactName : undefined,
      },
      actorFromReq(req),
    );
    void logAuditEvent({
      actionType: 'MAYA_CONVERSATION_CREATED',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { conversationId: row.id, channel: row.channel },
      severity: 'info',
    });
    return res.status(201).json({ ok: true, conversation: row });
  } catch (err: any) {
    logger.error({ err }, 'maya createConversation failed');
    return res.status(err.statusCode ?? 500).json({ ok: false, error: 'internal_error' });
  }
});

router.get('/conversations/:id', async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) {
    return res.status(400).json({ ok: false, error: 'invalid_id' });
  }
  const row = await Maya.getConversation(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.json({ ok: true, conversation: row });
});

// ---------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------
router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) {
    return res.status(400).json({ ok: false, error: 'invalid_id' });
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (!isString(body.role) || !['user', 'maya', 'system', 'admin'].includes(body.role)) {
    return res.status(400).json({ ok: false, error: 'invalid_role' });
  }
  if (!isString(body.content) || body.content.trim().length === 0) {
    return res.status(400).json({ ok: false, error: 'content_required' });
  }
  try {
    const row = await Maya.appendMessage(
      req.params.id,
      {
        role: body.role,
        content: body.content,
        locale: isString(body.locale) ? body.locale : undefined,
      },
      actorFromReq(req),
    );
    return res.status(201).json({ ok: true, message: row });
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ ok: false, error: 'not_found' });
    logger.error({ err }, 'maya appendMessage failed');
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.get('/conversations/:id/messages', async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) {
    return res.status(400).json({ ok: false, error: 'invalid_id' });
  }
  const rows = await Maya.listMessages(req.params.id);
  return res.json({ ok: true, messages: rows });
});

// ---------------------------------------------------------------------------
// leads
// ---------------------------------------------------------------------------
router.get('/leads', async (req: Request, res: Response) => {
  const status = isString(req.query.status) ? (req.query.status as string) : undefined;
  const limit = parseLimit(req.query.limit);
  try {
    const rows = await Maya.listLeads({ status, limit });
    res.json({ ok: true, leads: rows });
  } catch (err) {
    logger.error({ err }, 'maya listLeads failed');
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/leads', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  try {
    const row = await Maya.createLead(
      {
        conversationId: isUuid(body.conversationId) ? (body.conversationId as string) : null,
        name: isString(body.name) ? body.name : null,
        phone: isString(body.phone) ? body.phone : null,
        email: isString(body.email) ? body.email : null,
        city: isString(body.city) ? body.city : null,
        intent: isString(body.intent) ? body.intent : null,
        source: isString(body.source) ? body.source : null,
        notes: isString(body.notes) ? body.notes : null,
      },
      actorFromReq(req),
    );
    return res.status(201).json({ ok: true, lead: row });
  } catch (err: any) {
    logger.error({ err }, 'maya createLead failed');
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.get('/leads/:id', async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) {
    return res.status(400).json({ ok: false, error: 'invalid_id' });
  }
  const row = await Maya.getLead(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.json({ ok: true, lead: row });
});

// ---------------------------------------------------------------------------
// provider intake drafts (DRAFT-ONLY)
// ---------------------------------------------------------------------------
router.get(
  '/provider-intake-drafts',
  requireFlag('ff.maya.provider_intake.enabled'),
  async (req: Request, res: Response) => {
    const status = isString(req.query.status) ? (req.query.status as string) : undefined;
    const limit = parseLimit(req.query.limit);
    try {
      const rows = await Maya.listProviderDrafts({ intakeStatus: status, limit });
      res.json({ ok: true, drafts: rows });
    } catch (err) {
      logger.error({ err }, 'maya listProviderDrafts failed');
      res.status(500).json({ ok: false, error: 'internal_error' });
    }
  },
);

router.post(
  '/provider-intake-drafts',
  requireFlag('ff.maya.provider_intake.enabled'),
  async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (
      body.servicesOffered !== undefined &&
      (!Array.isArray(body.servicesOffered) || !body.servicesOffered.every(isString))
    ) {
      return res.status(400).json({ ok: false, error: 'invalid_services_offered' });
    }
    try {
      const row = await Maya.createProviderDraft(
        {
          conversationId: isUuid(body.conversationId) ? (body.conversationId as string) : null,
          businessName: isString(body.businessName) ? body.businessName : null,
          contactName: isString(body.contactName) ? body.contactName : null,
          phone: isString(body.phone) ? body.phone : null,
          email: isString(body.email) ? body.email : null,
          city: isString(body.city) ? body.city : null,
          region: isString(body.region) ? body.region : null,
          servicesOffered: Array.isArray(body.servicesOffered)
            ? (body.servicesOffered as string[])
            : null,
          notes: isString(body.notes) ? body.notes : null,
        },
        actorFromReq(req),
      );
      return res.status(201).json({ ok: true, draft: row });
    } catch (err: any) {
      logger.error({ err }, 'maya createProviderDraft failed');
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  },
);

router.get(
  '/provider-intake-drafts/:id',
  requireFlag('ff.maya.provider_intake.enabled'),
  async (req: Request, res: Response) => {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }
    const row = await Maya.getProviderDraft(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, draft: row });
  },
);

router.patch(
  '/provider-intake-drafts/:id',
  requireFlag('ff.maya.provider_intake.enabled'),
  async (req: Request, res: Response) => {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const row = await Maya.updateProviderDraft(req.params.id, body as any, actorFromReq(req));
      return res.json({ ok: true, draft: row });
    } catch (err: any) {
      if (err.statusCode === 404) return res.status(404).json({ ok: false, error: 'not_found' });
      if (err.statusCode === 422) {
        return res.status(422).json({ ok: false, error: 'approval_not_in_scope' });
      }
      logger.error({ err }, 'maya updateProviderDraft failed');
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  },
);

// ---------------------------------------------------------------------------
// booking intake drafts (DRAFT-ONLY; price never stored here)
// ---------------------------------------------------------------------------
router.get(
  '/booking-intake-drafts',
  requireFlag('ff.maya.booking_intake.enabled'),
  async (req: Request, res: Response) => {
    const status = isString(req.query.status) ? (req.query.status as string) : undefined;
    const limit = parseLimit(req.query.limit);
    try {
      const rows = await Maya.listBookingDrafts({ intakeStatus: status, limit });
      res.json({ ok: true, drafts: rows });
    } catch (err) {
      logger.error({ err }, 'maya listBookingDrafts failed');
      res.status(500).json({ ok: false, error: 'internal_error' });
    }
  },
);

router.post(
  '/booking-intake-drafts',
  requireFlag('ff.maya.booking_intake.enabled'),
  async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (
      body.petSize !== undefined &&
      body.petSize !== null &&
      (!isString(body.petSize) || !['small', 'medium', 'large', 'xl'].includes(body.petSize))
    ) {
      return res.status(400).json({ ok: false, error: 'invalid_pet_size' });
    }
    try {
      const row = await Maya.createBookingDraft(
        {
          conversationId: isUuid(body.conversationId) ? (body.conversationId as string) : null,
          leadId: isUuid(body.leadId) ? (body.leadId as string) : null,
          serviceCode: isString(body.serviceCode) ? body.serviceCode : null,
          petName: isString(body.petName) ? body.petName : null,
          petBreed: isString(body.petBreed) ? body.petBreed : null,
          petSize: isString(body.petSize) ? body.petSize : null,
          preferredDates: Array.isArray(body.preferredDates)
            ? (body.preferredDates as string[])
            : null,
          preferredLocation: isString(body.preferredLocation) ? body.preferredLocation : null,
          notes: isString(body.notes) ? body.notes : null,
        },
        actorFromReq(req),
      );
      return res.status(201).json({ ok: true, draft: row });
    } catch (err: any) {
      logger.error({ err }, 'maya createBookingDraft failed');
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  },
);

router.get(
  '/booking-intake-drafts/:id',
  requireFlag('ff.maya.booking_intake.enabled'),
  async (req: Request, res: Response) => {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }
    const row = await Maya.getBookingDraft(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, draft: row });
  },
);

router.patch(
  '/booking-intake-drafts/:id',
  requireFlag('ff.maya.booking_intake.enabled'),
  async (req: Request, res: Response) => {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const row = await Maya.updateBookingDraft(req.params.id, body as any, actorFromReq(req));
      return res.json({ ok: true, draft: row });
    } catch (err: any) {
      if (err.statusCode === 404) return res.status(404).json({ ok: false, error: 'not_found' });
      if (err.statusCode === 422) {
        return res.status(422).json({ ok: false, error: 'confirmation_not_in_scope' });
      }
      logger.error({ err }, 'maya updateBookingDraft failed');
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  },
);

// ---------------------------------------------------------------------------
// tasks
// ---------------------------------------------------------------------------
router.post(
  '/tasks',
  requireFlag('ff.maya.tasks.enabled'),
  async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!isString(body.title) || body.title.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'title_required' });
    }
    try {
      const row = await Maya.createTask(
        {
          conversationId: isUuid(body.conversationId) ? (body.conversationId as string) : null,
          title: body.title,
          description: isString(body.description) ? body.description : null,
          assignee: isString(body.assignee) ? body.assignee : null,
          dueAt: isString(body.dueAt) ? body.dueAt : null,
        },
        actorFromReq(req),
      );
      return res.status(201).json({ ok: true, task: row });
    } catch (err: any) {
      logger.error({ err }, 'maya createTask failed');
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  },
);

router.get(
  '/tasks',
  requireFlag('ff.maya.tasks.enabled'),
  async (req: Request, res: Response) => {
    const status = isString(req.query.status) ? (req.query.status as string) : undefined;
    const limit = parseLimit(req.query.limit);
    const rows = await Maya.listTasks({ status, limit });
    return res.json({ ok: true, tasks: rows });
  },
);

router.get(
  '/tasks/:id',
  requireFlag('ff.maya.tasks.enabled'),
  async (req: Request, res: Response) => {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }
    const row = await Maya.getTask(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, task: row });
  },
);

// ---------------------------------------------------------------------------
// escalations
// ---------------------------------------------------------------------------
router.get(
  '/escalations',
  requireFlag('ff.maya.escalations.enabled'),
  async (req: Request, res: Response) => {
    const status = isString(req.query.status) ? (req.query.status as string) : undefined;
    const severity = isString(req.query.severity) ? (req.query.severity as string) : undefined;
    const limit = parseLimit(req.query.limit);
    try {
      const rows = await Maya.listEscalations({ status, severity, limit });
      res.json({ ok: true, escalations: rows });
    } catch (err) {
      logger.error({ err }, 'maya listEscalations failed');
      res.status(500).json({ ok: false, error: 'internal_error' });
    }
  },
);

router.post(
  '/escalations',
  requireFlag('ff.maya.escalations.enabled'),
  async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!isString(body.reason) || body.reason.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'reason_required' });
    }
    if (
      body.severity !== undefined &&
      (!isString(body.severity) ||
        !['low', 'medium', 'high', 'critical'].includes(body.severity))
    ) {
      return res.status(400).json({ ok: false, error: 'invalid_severity' });
    }
    try {
      const row = await Maya.createEscalation(
        {
          conversationId: isUuid(body.conversationId) ? (body.conversationId as string) : null,
          reason: body.reason,
          severity: isString(body.severity) ? body.severity : undefined,
          assignee: isString(body.assignee) ? body.assignee : null,
        },
        actorFromReq(req),
      );
      return res.status(201).json({ ok: true, escalation: row });
    } catch (err: any) {
      logger.error({ err }, 'maya createEscalation failed');
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  },
);

router.get(
  '/escalations/:id',
  requireFlag('ff.maya.escalations.enabled'),
  async (req: Request, res: Response) => {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }
    const row = await Maya.getEscalation(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, escalation: row });
  },
);

// ---------------------------------------------------------------------------
// audit log (read-only — DB trigger blocks UPDATE/DELETE on the underlying table)
// ---------------------------------------------------------------------------
router.get('/audit', async (req: Request, res: Response) => {
  const entityType = isString(req.query.entityType) ? (req.query.entityType as string) : undefined;
  const entityId = isString(req.query.entityId) ? (req.query.entityId as string) : undefined;
  const limit = parseLimit(req.query.limit);
  try {
    const rows = await Maya.listAuditLog({ entityType, entityId, limit });
    // BigInt-safe serialization: maya_audit_log.id is bigserial (BigInt at
    // the JS layer). JSON.stringify cannot encode BigInt, so we stringify
    // the id here before the response goes through res.json().
    const safe = rows.map((r) => ({ ...r, id: String((r as any).id) }));
    res.json({ ok: true, entries: safe });
  } catch (err) {
    logger.error({ err }, 'maya listAuditLog failed');
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
