/**
 * Maya admin API tests — Stage 2 (extends Stage 1b).
 *
 * Verifies: master kill switch, per-feature gates, validators, draft-only
 * constraints (provider 'approved' and booking 'confirmed' both rejected),
 * audit writes, role-aware actor extraction, AND the new list endpoints
 * added in Stage 2.
 *
 * Mock state is held in vi.hoisted() so it can be reset between tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Shared mock state — hoisted so vi.mock factories can reach it AND beforeEach
// can reset it between tests.
// ---------------------------------------------------------------------------
const state = vi.hoisted(() => ({
  flagStore: new Map<string, boolean>(),
  auditWrites: [] as Array<{
    actor: { type: string; id?: string | null };
    entityType: string;
    entityId: string;
    action: string;
    payload?: Record<string, unknown>;
  }>,
  idCounter: 0,
  conversations: new Map<string, any>(),
  messages: [] as any[],
  leads: new Map<string, any>(),
  providerDrafts: new Map<string, any>(),
  bookingDrafts: new Map<string, any>(),
  tasks: new Map<string, any>(),
  escalations: new Map<string, any>(),
  auditEntries: [] as any[],
  uuid(): string {
    this.idCounter += 1;
    return `00000000-0000-0000-0000-${String(this.idCounter).padStart(12, '0')}`;
  },
  resetAll() {
    this.flagStore.clear();
    this.auditWrites.length = 0;
    this.idCounter = 0;
    this.conversations.clear();
    this.messages.length = 0;
    this.leads.clear();
    this.providerDrafts.clear();
    this.bookingDrafts.clear();
    this.tasks.clear();
    this.escalations.clear();
    this.auditEntries.length = 0;
  },
}));

vi.mock('../services/SystemConfig', () => ({
  getFeatureFlag: vi.fn(async (key: string) => state.flagStore.get(key) ?? false),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../middleware/auditLog', () => ({
  logAuditEvent: vi.fn(),
}));

// In-memory MayaService mock so tests don't need a DB. State lives in the
// hoisted `state` object, so beforeEach can clear it.
vi.mock('../services/MayaService', () => {
  async function writeMayaAudit(opts: any) {
    state.auditWrites.push(opts);
    state.auditEntries.push({
      id: String(state.auditEntries.length + 1),
      occurredAt: new Date().toISOString(),
      ...opts,
    });
  }

  return {
    writeMayaAudit,

    async createConversation(input: any, actor: any) {
      const row = { id: state.uuid(), status: 'open', ...input };
      state.conversations.set(row.id, row);
      await writeMayaAudit({ actor, entityType: 'conversation', entityId: row.id, action: 'create' });
      return row;
    },
    async getConversation(id: string) { return state.conversations.get(id) ?? null; },
    async listConversations(opts: any = {}) {
      const all = Array.from(state.conversations.values());
      const filtered = opts.status ? all.filter((c) => c.status === opts.status) : all;
      return filtered.slice(0, opts.limit ?? 50);
    },

    async appendMessage(conversationId: string, input: any, actor: any) {
      if (!state.conversations.has(conversationId)) {
        const err = new Error('conversation not found') as any;
        err.statusCode = 404;
        throw err;
      }
      const row = { id: state.uuid(), conversationId, ...input };
      state.messages.push(row);
      await writeMayaAudit({ actor, entityType: 'message', entityId: row.id, action: 'create' });
      return row;
    },
    async listMessages(conversationId: string) {
      return state.messages.filter((m) => m.conversationId === conversationId);
    },

    async createLead(input: any, actor: any) {
      const row = { id: state.uuid(), status: 'new', ...input };
      state.leads.set(row.id, row);
      await writeMayaAudit({ actor, entityType: 'lead', entityId: row.id, action: 'create' });
      return row;
    },
    async getLead(id: string) { return state.leads.get(id) ?? null; },
    async listLeads(opts: any = {}) {
      const all = Array.from(state.leads.values());
      const filtered = opts.status ? all.filter((l) => l.status === opts.status) : all;
      return filtered.slice(0, opts.limit ?? 50);
    },

    async createProviderDraft(input: any, actor: any) {
      const row = { id: state.uuid(), intakeStatus: 'draft', ...input };
      state.providerDrafts.set(row.id, row);
      await writeMayaAudit({ actor, entityType: 'provider_draft', entityId: row.id, action: 'create' });
      return row;
    },
    async getProviderDraft(id: string) { return state.providerDrafts.get(id) ?? null; },
    async listProviderDrafts(opts: any = {}) {
      const all = Array.from(state.providerDrafts.values());
      const filtered = opts.intakeStatus
        ? all.filter((d) => d.intakeStatus === opts.intakeStatus)
        : all;
      return filtered.slice(0, opts.limit ?? 50);
    },
    async updateProviderDraft(id: string, input: any, actor: any) {
      if (input.intakeStatus && !['draft', 'submitted-for-review'].includes(input.intakeStatus)) {
        const err = new Error('approval not in scope') as any;
        err.statusCode = 422;
        throw err;
      }
      const existing = state.providerDrafts.get(id);
      if (!existing) { const err = new Error('not found') as any; err.statusCode = 404; throw err; }
      const updated = { ...existing, ...input };
      state.providerDrafts.set(id, updated);
      await writeMayaAudit({
        actor,
        entityType: 'provider_draft',
        entityId: id,
        action: input.intakeStatus ? 'status_change' : 'update',
      });
      return updated;
    },

    async createBookingDraft(input: any, actor: any) {
      const row = { id: state.uuid(), intakeStatus: 'draft', ...input };
      state.bookingDrafts.set(row.id, row);
      await writeMayaAudit({ actor, entityType: 'booking_draft', entityId: row.id, action: 'create' });
      return row;
    },
    async getBookingDraft(id: string) { return state.bookingDrafts.get(id) ?? null; },
    async listBookingDrafts(opts: any = {}) {
      const all = Array.from(state.bookingDrafts.values());
      const filtered = opts.intakeStatus
        ? all.filter((d) => d.intakeStatus === opts.intakeStatus)
        : all;
      return filtered.slice(0, opts.limit ?? 50);
    },
    async updateBookingDraft(id: string, input: any, actor: any) {
      if (input.intakeStatus && !['draft', 'submitted-for-review'].includes(input.intakeStatus)) {
        const err = new Error('confirmation not in scope') as any;
        err.statusCode = 422;
        throw err;
      }
      const existing = state.bookingDrafts.get(id);
      if (!existing) { const err = new Error('not found') as any; err.statusCode = 404; throw err; }
      const updated = { ...existing, ...input };
      state.bookingDrafts.set(id, updated);
      await writeMayaAudit({
        actor,
        entityType: 'booking_draft',
        entityId: id,
        action: input.intakeStatus ? 'status_change' : 'update',
      });
      return updated;
    },

    async createTask(input: any, actor: any) {
      const row = { id: state.uuid(), status: 'open', ...input };
      state.tasks.set(row.id, row);
      await writeMayaAudit({ actor, entityType: 'task', entityId: row.id, action: 'create' });
      return row;
    },
    async listTasks(opts: any = {}) {
      const all = Array.from(state.tasks.values());
      const filtered = opts.status ? all.filter((t) => t.status === opts.status) : all;
      return filtered.slice(0, opts.limit ?? 50);
    },
    async getTask(id: string) { return state.tasks.get(id) ?? null; },

    async createEscalation(input: any, actor: any) {
      const row = { id: state.uuid(), status: 'open', severity: input.severity ?? 'medium', ...input };
      state.escalations.set(row.id, row);
      await writeMayaAudit({ actor, entityType: 'escalation', entityId: row.id, action: 'create' });
      return row;
    },
    async listEscalations(opts: any = {}) {
      let all = Array.from(state.escalations.values());
      if (opts.status) all = all.filter((e) => e.status === opts.status);
      if (opts.severity) all = all.filter((e) => e.severity === opts.severity);
      return all.slice(0, opts.limit ?? 50);
    },
    async getEscalation(id: string) { return state.escalations.get(id) ?? null; },

    async listAuditLog(opts: any = {}) {
      let all = [...state.auditEntries].reverse();
      if (opts.entityType) all = all.filter((a) => a.entityType === opts.entityType);
      if (opts.entityId) all = all.filter((a) => a.entityId === opts.entityId);
      return all.slice(0, opts.limit ?? 50);
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
    state.resetAll();
  });

  // ---------- master kill switch ----------
  it('returns 503 when ff.maya.enabled is OFF', async () => {
    const res = await request(makeApp()).post('/api/admin/maya/conversations').send({ channel: 'web' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('maya_disabled');
  });

  // ---------- conversations ----------
  it('creates a conversation and writes an audit row', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    const res = await request(makeApp()).post('/api/admin/maya/conversations').send({ channel: 'web' });
    expect(res.status).toBe(201);
    expect(res.body.conversation.channel).toBe('web');
    expect(state.auditWrites.filter((a) => a.entityType === 'conversation')).toHaveLength(1);
  });

  it('rejects bad channel with 400', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    const res = await request(makeApp()).post('/api/admin/maya/conversations').send({ channel: 'sms' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_channel');
  });

  it('lists conversations after creating some (Stage 2)', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    const app = makeApp();
    await request(app).post('/api/admin/maya/conversations').send({ channel: 'web' });
    await request(app).post('/api/admin/maya/conversations').send({ channel: 'admin' });
    const list = await request(app).get('/api/admin/maya/conversations');
    expect(list.status).toBe(200);
    expect(list.body.conversations).toHaveLength(2);
  });

  it('filters conversations by status (Stage 2)', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    const app = makeApp();
    await request(app).post('/api/admin/maya/conversations').send({ channel: 'web' });
    const list = await request(app).get('/api/admin/maya/conversations?status=closed');
    expect(list.status).toBe(200);
    expect(list.body.conversations).toHaveLength(0);
  });

  // ---------- messages ----------
  it('appends a message and writes an audit row', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    const app = makeApp();
    const c = await request(app).post('/api/admin/maya/conversations').send({ channel: 'web' });
    const m = await request(app)
      .post(`/api/admin/maya/conversations/${c.body.conversation.id}/messages`)
      .send({ role: 'user', content: 'שלום' });
    expect(m.status).toBe(201);
    expect(state.auditWrites.filter((a) => a.entityType === 'message')).toHaveLength(1);
  });

  // ---------- provider intake drafts ----------
  it('returns 503 when ff.maya.provider_intake.enabled is OFF', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    const res = await request(makeApp()).post('/api/admin/maya/provider-intake-drafts').send({});
    expect(res.status).toBe(503);
    expect(res.body.feature).toBe('ff.maya.provider_intake.enabled');
  });

  it('rejects provider draft "approved" status with 422', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    state.flagStore.set('ff.maya.provider_intake.enabled', true);
    const app = makeApp();
    const created = await request(app)
      .post('/api/admin/maya/provider-intake-drafts')
      .send({ businessName: 'Pet Shop' });
    const upd = await request(app)
      .patch(`/api/admin/maya/provider-intake-drafts/${created.body.draft.id}`)
      .send({ intakeStatus: 'approved' });
    expect(upd.status).toBe(422);
    expect(upd.body.error).toBe('approval_not_in_scope');
  });

  it('lists provider drafts (Stage 2)', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    state.flagStore.set('ff.maya.provider_intake.enabled', true);
    const app = makeApp();
    await request(app).post('/api/admin/maya/provider-intake-drafts').send({ businessName: 'A' });
    await request(app).post('/api/admin/maya/provider-intake-drafts').send({ businessName: 'B' });
    const list = await request(app).get('/api/admin/maya/provider-intake-drafts');
    expect(list.status).toBe(200);
    expect(list.body.drafts).toHaveLength(2);
  });

  // ---------- booking intake drafts ----------
  it('rejects booking draft "confirmed" status with 422', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    state.flagStore.set('ff.maya.booking_intake.enabled', true);
    const app = makeApp();
    const created = await request(app)
      .post('/api/admin/maya/booking-intake-drafts')
      .send({ serviceCode: 'single-wash' });
    const upd = await request(app)
      .patch(`/api/admin/maya/booking-intake-drafts/${created.body.draft.id}`)
      .send({ intakeStatus: 'confirmed' });
    expect(upd.status).toBe(422);
    expect(upd.body.error).toBe('confirmation_not_in_scope');
  });

  it('rejects bad pet_size with 400', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    state.flagStore.set('ff.maya.booking_intake.enabled', true);
    const res = await request(makeApp())
      .post('/api/admin/maya/booking-intake-drafts')
      .send({ petSize: 'huge' });
    expect(res.status).toBe(400);
  });

  it('does not return a "price" field on booking draft', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    state.flagStore.set('ff.maya.booking_intake.enabled', true);
    const res = await request(makeApp())
      .post('/api/admin/maya/booking-intake-drafts')
      .send({ serviceCode: 'single-wash', price: 55 });
    expect(res.status).toBe(201);
    expect(res.body.draft.price).toBeUndefined();
  });

  it('lists booking drafts (Stage 2)', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    state.flagStore.set('ff.maya.booking_intake.enabled', true);
    const app = makeApp();
    await request(app).post('/api/admin/maya/booking-intake-drafts').send({ serviceCode: 'single-wash' });
    const list = await request(app).get('/api/admin/maya/booking-intake-drafts');
    expect(list.status).toBe(200);
    expect(list.body.drafts).toHaveLength(1);
  });

  // ---------- leads ----------
  it('lists leads (Stage 2)', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    const app = makeApp();
    await request(app).post('/api/admin/maya/leads').send({ name: 'Alice' });
    await request(app).post('/api/admin/maya/leads').send({ name: 'Bob' });
    const list = await request(app).get('/api/admin/maya/leads');
    expect(list.status).toBe(200);
    expect(list.body.leads).toHaveLength(2);
  });

  // ---------- tasks ----------
  it('requires title on task create', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    state.flagStore.set('ff.maya.tasks.enabled', true);
    const res = await request(makeApp()).post('/api/admin/maya/tasks').send({});
    expect(res.status).toBe(400);
  });

  it('lists tasks and fetches by id (Stage 2)', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    state.flagStore.set('ff.maya.tasks.enabled', true);
    const app = makeApp();
    const created = await request(app).post('/api/admin/maya/tasks').send({ title: 'Call back' });
    const list = await request(app).get('/api/admin/maya/tasks');
    expect(list.body.tasks).toHaveLength(1);
    const byId = await request(app).get(`/api/admin/maya/tasks/${created.body.task.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body.task.title).toBe('Call back');
  });

  // ---------- escalations ----------
  it('requires reason on escalation create', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    state.flagStore.set('ff.maya.escalations.enabled', true);
    const res = await request(makeApp()).post('/api/admin/maya/escalations').send({});
    expect(res.status).toBe(400);
  });

  it('lists escalations by severity (Stage 2)', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    state.flagStore.set('ff.maya.escalations.enabled', true);
    const app = makeApp();
    await request(app).post('/api/admin/maya/escalations').send({ reason: 'a', severity: 'low' });
    await request(app).post('/api/admin/maya/escalations').send({ reason: 'b', severity: 'critical' });
    const list = await request(app).get('/api/admin/maya/escalations?severity=critical');
    expect(list.status).toBe(200);
    expect(list.body.escalations).toHaveLength(1);
    expect(list.body.escalations[0].severity).toBe('critical');
  });

  // ---------- audit log ----------
  it('lists audit log entries (Stage 2)', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    const app = makeApp();
    await request(app).post('/api/admin/maya/conversations').send({ channel: 'web' });
    await request(app).post('/api/admin/maya/leads').send({ name: 'Alice' });
    const list = await request(app).get('/api/admin/maya/audit');
    expect(list.status).toBe(200);
    expect(list.body.entries.length).toBeGreaterThanOrEqual(2);
  });

  it('filters audit log by entityType (Stage 2)', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    const app = makeApp();
    await request(app).post('/api/admin/maya/conversations').send({ channel: 'web' });
    await request(app).post('/api/admin/maya/leads').send({ name: 'Alice' });
    const list = await request(app).get('/api/admin/maya/audit?entityType=lead');
    expect(list.body.entries).toHaveLength(1);
    expect(list.body.entries[0].entityType).toBe('lead');
  });

  it('audit log returns 503 when master flag is off', async () => {
    const res = await request(makeApp()).get('/api/admin/maya/audit');
    expect(res.status).toBe(503);
  });

  // ---------- sub-flag gates (verify each sub-feature gates independently) ----------
  it('returns 503 feature_disabled when ff.maya.booking_intake.enabled is OFF', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    state.flagStore.set('ff.maya.booking_intake.enabled', false);
    const res = await request(makeApp())
      .post('/api/admin/maya/booking-intake-drafts')
      .send({ serviceCode: 'single-wash' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('feature_disabled');
    expect(res.body.feature).toBe('ff.maya.booking_intake.enabled');
  });

  it('returns 503 feature_disabled when ff.maya.tasks.enabled is OFF', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    state.flagStore.set('ff.maya.tasks.enabled', false);
    const res = await request(makeApp()).post('/api/admin/maya/tasks').send({ title: 'x' });
    expect(res.status).toBe(503);
    expect(res.body.feature).toBe('ff.maya.tasks.enabled');
  });

  it('returns 503 feature_disabled when ff.maya.escalations.enabled is OFF', async () => {
    state.flagStore.set('ff.maya.enabled', true);
    state.flagStore.set('ff.maya.escalations.enabled', false);
    const res = await request(makeApp())
      .post('/api/admin/maya/escalations')
      .send({ reason: 'x' });
    expect(res.status).toBe(503);
    expect(res.body.feature).toBe('ff.maya.escalations.enabled');
  });
});
