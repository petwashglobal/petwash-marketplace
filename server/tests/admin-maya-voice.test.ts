/**
 * Maya voice admin review routes — Stage 3A tests.
 *
 * /api/admin/maya/voice/calls + /api/admin/maya/voice/calls/:id
 * Gated by ff.maya.voice.enabled (independent of ff.maya.enabled — that's
 * intentional, voice review can be flipped on without enabling all of Maya).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const flagStore = new Map<string, boolean>();

vi.mock('../services/SystemConfig', () => ({
  getFeatureFlag: vi.fn(async (key: string) => flagStore.get(key) ?? false),
}));
vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const phoneConvs: any[] = [];
const allConvs = new Map<string, any>();

vi.mock('../services/MayaService', () => ({
  listConversations: vi.fn(async (opts: any = {}) => {
    let rows = phoneConvs;
    if (opts.channel) rows = rows.filter((c) => c.channel === opts.channel);
    if (opts.status) rows = rows.filter((c) => c.status === opts.status);
    return rows.slice(0, opts.limit ?? 50);
  }),
  getConversation: vi.fn(async (id: string) => allConvs.get(id) ?? null),
}));

import adminMayaVoiceRouter from '../routes/admin-maya-voice';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/maya/voice', adminMayaVoiceRouter);
  return app;
}

function seedPhoneConv(id: string, status = 'open') {
  const conv = { id, channel: 'phone', status, createdAt: new Date().toISOString() };
  phoneConvs.push(conv);
  allConvs.set(id, conv);
  return conv;
}

function seedWebConv(id: string) {
  const conv = { id, channel: 'web', status: 'open' };
  allConvs.set(id, conv);
  return conv;
}

describe('Maya voice admin (/api/admin/maya/voice)', () => {
  beforeEach(() => {
    flagStore.clear();
    phoneConvs.length = 0;
    allConvs.clear();
  });

  it('returns 503 voice_disabled when ff.maya.voice.enabled is OFF', async () => {
    const res = await request(makeApp()).get('/api/admin/maya/voice/calls');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('voice_disabled');
  });

  it('lists phone-channel conversations when voice flag ON', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    seedPhoneConv('00000000-0000-0000-0000-000000000001');
    seedPhoneConv('00000000-0000-0000-0000-000000000002');
    const res = await request(makeApp()).get('/api/admin/maya/voice/calls');
    expect(res.status).toBe(200);
    expect(res.body.calls).toHaveLength(2);
  });

  it('filters calls by status', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    seedPhoneConv('00000000-0000-0000-0000-000000000001', 'open');
    seedPhoneConv('00000000-0000-0000-0000-000000000002', 'closed');
    const res = await request(makeApp()).get('/api/admin/maya/voice/calls?status=closed');
    expect(res.status).toBe(200);
    expect(res.body.calls).toHaveLength(1);
    expect(res.body.calls[0].status).toBe('closed');
  });

  it('returns single call detail by id', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    const conv = seedPhoneConv('00000000-0000-0000-0000-000000000007');
    const res = await request(makeApp()).get(`/api/admin/maya/voice/calls/${conv.id}`);
    expect(res.status).toBe(200);
    expect(res.body.call.id).toBe(conv.id);
    expect(res.body.call.channel).toBe('phone');
  });

  it('rejects invalid uuid with 400', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    const res = await request(makeApp()).get('/api/admin/maya/voice/calls/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_id');
  });

  it('returns 404 when conversation is not a phone call (channel mismatch)', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    const conv = seedWebConv('00000000-0000-0000-0000-000000000099');
    const res = await request(makeApp()).get(`/api/admin/maya/voice/calls/${conv.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_a_phone_call');
  });

  it('returns 404 when conversation does not exist', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    const res = await request(makeApp()).get('/api/admin/maya/voice/calls/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
