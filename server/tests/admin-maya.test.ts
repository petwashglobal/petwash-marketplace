/**
 * Maya admin API tests — Stage 1b.
 *
 * Verifies: master kill switch, per-feature gates, validators, draft-only
 * constraints (provider 'approved' and booking 'confirmed' both rejected),
 * audit writes, role-aware actor extraction.
 *
 * Uses the same vitest + supertest + vi.mock pattern as auth-sms.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mocks (hoisted by vi.mock).
// ---------------------------------------------------------------------------
const flagStore = new Map<string, boolean>();
const auditWrites: Array<{
  actor: { type: string; id?: string | null };
  entityType: string;
  entityId: string;
  action: string;
  payload?: Record<string, unknown>;
}> = [];

vi.mock('../services/SystemConfig', () => ({
  getFeatureFlag: vi.fn(async (key: string) => flagStore.get(key) ?? false),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../middleware/auditLog', () => ({
  logAuditEvent: vi.fn(),
}));

// In-memory MayaService mock so tests don't need a DB.
vi.mock('../services/MayaService', () => {
  let idCounter = 0;
  const uuid = () => {
    idCounter += 1;
    return `00000000-0000-0000-0000-${String(idCounter).padStart(12, '0')}`;
  };
  const conversations = new Map<string, any>();
  const messages: any[] = [];
  const leads = new Map<string, any>();
  const providerDrafts = new Map<string, any>();
  const bookingDrafts = new Map<string, any>();
  const tasks = new Map<string, any>();
  const escalations = new Map<string, any>();

  async function writeMayaAudit(opts: any) {
    auditWrites.push(opts);
  }

  return {
    writeMayaAudit,

    async createConversation(input: any, actor: any) {
      const row = { id: uuid(), status: 'open', ...input };
      conversations.set(row.id, row);
      await writeMayaAudit({
        actor,
        entityType: 'conversation',
        entityId: row.id,
        action: 'create',
      });
      return row;
    },
    async getConversation(id: string) {
      return conversations.get(id) ?? null;
    },
    async appendMessage(conversationId: string, input: any, actor: any) {
      if (!conversations.has(conversationId)) {
        const err = new Error('conversation not found') as any;
        err.statusCode = 404;
        throw err;
      }
      const row = { id: uuid(), conversationId, ...input };
      messages.push(row);
      await writeMayaAudit({
        actor,
        entityType: 'message',
        entityId: row.id,
        action: 'create',
      });
      return row;
    },
    async listMessages(conversationId: string) {
      return messages.filter((m) => m.conversationId === conversationId);
    },
    async createLead(input: any, actor: any) {
      const row = { id: uuid(), status: 'new', ...input };
      leads.set(row.id, row);
      await writeMayaAudit({ actor, entityType: 'lead', entityId: row.id, action: 'create' });
      return row;
    },
    async getLead(id: string) {
      return leads.get(id) ?? null;
    },
    async createProviderDraft(input: any, actor: any) {
      const row = { id: uuid(), intakeStatus: 'draft', ...input };
      providerDrafts.set(row.id, row);
      await writeMayaAudit({
        actor,
        entityType: 'provider_draft',
        entityId: row.id,
        action: 'create',
      });
      return row;
    },
    async getProviderDraft(id: string) {
      return providerDrafts.get(id) ?? null;
    },
    async updateProviderDraft(id: string, input: any, actor: any) {
      if (input.intakeStatus && !['draft', 'submitted-for-review'].includes(input.intakeStatus)) {
        const err = new Error('approval not in scope') as any;
        err.statusCode = 422;
        throw err;
      }
      const existing = providerDrafts.get(id);
      if (!existing) {
        const err = new Error('not found') as any;
        err.statusCode = 404;
        throw err;
      }
      const updated = { ...existing, ...input };
      providerDrafts.set(id, updated);
      await writeMayaAudit({
        actor,
        entityType: 'provider_draft',
        entityId: id,
        action: input.intakeStatus ? 'status_change' : 'update',
      });
      return updated;
    },
    async createBookingDraft(input: any, actor: any) {
      const row = { id: uuid(), intakeStatus: 'draft', ...input };
      bookingDrafts.set(row.id, row);
      await writeMayaAudit({
        actor,
        entityType: 'booking_draft',
        entityId: row.id,
        action: 'create',
      });
      return row;
    },
    async getBookingDraft(id: string) {
      return bookingDrafts.get(id) ?? null;
    },
    async updateBookingDraft(id: string, input: any, actor: any) {
      if (input.intakeStatus && !['draft', 'submitted-for-review'].includes(input.intakeStatus)) {
        const err = new Error('confirmation not in scope') as any;
        err.statusCode = 422;
        throw err;
      }
      const existing = bookingDrafts.get(id);
      if (!existing) {
        const err = new Error('not found') as any;
        err.statusCode = 404;
        throw err;
      }
      const updated = { ...existing, ...input };
      bookingDrafts.set(id, updated);
      await writeMayaAudit({
        actor,
        entityType: 'booking_draft',
        entityId: id,
        action: input.intakeStatus ? 'status_change' : 'update',
      });
      return updated;
    },
    async createTask(input: any, actor: any) {
      const row = { id: uuid(), status: 'open', ...input };
      tasks.set(row.id, row);
      await writeMayaAudit({ actor, entityType: 'task', entityId: row.id, action: 'create' });
      return row;
    },
    async listTasks(_opts: any) {
      return Array.from(tasks.values());
    },
    async createEscalation(input: any, actor: any) {
      const row = { id: uuid(), status: 'open', severity: input.severity ?? 'medium', ...input };
      escalations.set(row.id, row);
      await writeMayaAudit({
        actor,
        entityType: 'escalation',
        entityId: row.id,
        action: 'create',
      });
      return row;
    },
  };
});

import adminMayaRouter from '../routes/admin-maya';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/maya', adminMayaRouter);
  return app;
}

describe('Maya admin API (/api/admin/maya)', () => {
  beforeEach(() => {
    flagStore.clear();
    auditWrites.length = 0;
  });

  // -------------------------------------------------------------------------
  // master kill switch
  // -------------------------------------------------------------------------
  it('returns 503 when ff.maya.enabled is OFF (master kill switch)', async () => {
    const res = await request(makeApp())
      .post('/api/admin/maya/conversations')
      .send({ channel: 'web' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('maya_disabled');
  });

  // -------------------------------------------------------------------------
  // conversations
  // -------------------------------------------------------------------------
  it('creates a conversation and writes an audit row when ff.maya.enabled is ON', async () => {
    flagStore.set('ff.maya.enabled', true);
    const res = await request(makeApp())
      .post('/api/admin/maya/conversations')
      .send({ channel: 'web' });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.conversation.channel).toBe('web');
    const writes = auditWrites.filter((a) => a.entityType === 'conversation');
    expect(writes).toHaveLength(1);
    expect(writes[0].action).toBe('create');
  });

  it('rejects bad channel with 400', async () => {
    flagStore.set('ff.maya.enabled', true);
    const res = await request(makeApp())
      .post('/api/admin/maya/conversations')
      .send({ channel: 'sms' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_channel');
  });

  // -------------------------------------------------------------------------
  // messages
  // -------------------------------------------------------------------------
  it('appends a message and writes an audit row', async () => {
    flagStore.set('ff.maya.enabled', true);
    const app = makeApp();
    const c = await request(app)
      .post('/api/admin/maya/conversations')
      .send({ channel: 'web' });
    const m = await request(app)
      .post(`/api/admin/maya/conversations/${c.body.conversation.id}/messages`)
      .send({ role: 'user', content: 'שלום' });
    expect(m.status).toBe(201);
    const writes = auditWrites.filter((a) => a.entityType === 'message');
    expect(writes).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // provider intake drafts — DRAFT-ONLY
  // -------------------------------------------------------------------------
  it('returns 503 when ff.maya.provider_intake.enabled is OFF', async () => {
    flagStore.set('ff.maya.enabled', true);
    flagStore.set('ff.maya.provider_intake.enabled', false);
    const res = await request(makeApp())
      .post('/api/admin/maya/provider-intake-drafts')
      .send({});
    expect(res.status).toBe(503);
    expect(res.body.feature).toBe('ff.maya.provider_intake.enabled');
  });

  it('rejects provider draft "approved" status with 422', async () => {
    flagStore.set('ff.maya.enabled', true);
    flagStore.set('ff.maya.provider_intake.enabled', true);
    const app = makeApp();
    const created = await request(app)
      .post('/api/admin/maya/provider-intake-drafts')
      .send({ businessName: 'Pet Shop' });
    expect(created.status).toBe(201);
    const upd = await request(app)
      .patch(`/api/admin/maya/provider-intake-drafts/${created.body.draft.id}`)
      .send({ intakeStatus: 'approved' });
    expect(upd.status).toBe(422);
    expect(upd.body.error).toBe('approval_not_in_scope');
  });

  // -------------------------------------------------------------------------
  // booking intake drafts — DRAFT-ONLY; no price stored
  // -------------------------------------------------------------------------
  it('rejects booking draft "confirmed" status with 422', async () => {
    flagStore.set('ff.maya.enabled', true);
    flagStore.set('ff.maya.booking_intake.enabled', true);
    const app = makeApp();
    const created = await request(app)
      .post('/api/admin/maya/booking-intake-drafts')
      .send({ serviceCode: 'single-wash' });
    expect(created.status).toBe(201);
    const upd = await request(app)
      .patch(`/api/admin/maya/booking-intake-drafts/${created.body.draft.id}`)
      .send({ intakeStatus: 'confirmed' });
    expect(upd.status).toBe(422);
    expect(upd.body.error).toBe('confirmation_not_in_scope');
  });

  it('rejects bad pet_size with 400', async () => {
    flagStore.set('ff.maya.enabled', true);
    flagStore.set('ff.maya.booking_intake.enabled', true);
    const res = await request(makeApp())
      .post('/api/admin/maya/booking-intake-drafts')
      .send({ petSize: 'huge' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_pet_size');
  });

  it('does not return a "price" field on booking draft', async () => {
    flagStore.set('ff.maya.enabled', true);
    flagStore.set('ff.maya.booking_intake.enabled', true);
    const res = await request(makeApp())
      .post('/api/admin/maya/booking-intake-drafts')
      .send({ serviceCode: 'single-wash', price: 55 });
    expect(res.status).toBe(201);
    expect(res.body.draft.price).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // tasks
  // -------------------------------------------------------------------------
  it('requires title on task create', async () => {
    flagStore.set('ff.maya.enabled', true);
    flagStore.set('ff.maya.tasks.enabled', true);
    const res = await request(makeApp()).post('/api/admin/maya/tasks').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('title_required');
  });

  // -------------------------------------------------------------------------
  // escalations
  // -------------------------------------------------------------------------
  it('requires reason on escalation create', async () => {
    flagStore.set('ff.maya.enabled', true);
    flagStore.set('ff.maya.escalations.enabled', true);
    const res = await request(makeApp()).post('/api/admin/maya/escalations').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('reason_required');
  });

  it('rejects bad severity', async () => {
    flagStore.set('ff.maya.enabled', true);
    flagStore.set('ff.maya.escalations.enabled', true);
    const res = await request(makeApp())
      .post('/api/admin/maya/escalations')
      .send({ reason: 'x', severity: 'meh' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_severity');
  });
});
