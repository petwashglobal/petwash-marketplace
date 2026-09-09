/**
 * NullSessionStore — the session middleware must persist NOTHING.
 *
 * Firebase Hosting forwards only `__session`, so the `pw.sid` cookie never
 * returns; the default MemoryStore kept a 7-day object per authenticated
 * request that nothing would read. These tests pin: (1) a value written in
 * one request is not visible in the next even when the cookie IS sent back,
 * (2) req.session still works as a same-request scratchpad, (3) logout's
 * session.destroy() still completes, (4) index.ts mounts this store.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { NullSessionStore } from '../lib/nullSessionStore';

function appWith(store: session.Store) {
  const app = express();
  app.use(session({ name: 'pw.sid', secret: 'test', store, resave: false, saveUninitialized: false, cookie: { secure: false } }));
  app.get('/write', (req, res) => { (req.session as any).customerId = 42; res.json({ same: (req.session as any).customerId }); });
  app.get('/read', (req, res) => { res.json({ customerId: (req.session as any).customerId ?? null }); });
  app.post('/logout', (req, res) => { req.session.destroy(() => res.json({ ok: true })); });
  return app;
}

describe('NullSessionStore', () => {
  it('a value written in one request is gone in the next — even with the cookie sent back', async () => {
    const store = new NullSessionStore();
    const agent = request.agent(appWith(store));
    const w = await agent.get('/write');
    expect(w.body.same).toBe(42);                       // same-request scratchpad works
    const r = await agent.get('/read');                 // agent replays pw.sid
    expect(r.body.customerId).toBeNull();               // nothing persisted
  });

  it('accepts writes and holds nothing', async () => {
    const store = new NullSessionStore();
    const set = vi.spyOn(store, 'set');
    const get = vi.spyOn(store, 'get');
    const agent = request.agent(appWith(store));
    for (let i = 0; i < 25; i++) await agent.get('/write');
    expect(set).toHaveBeenCalled();
    await agent.get('/read');
    expect(get).toHaveBeenCalled();
    // A MemoryStore would answer with the stored session here; this store never does.
    const got = await new Promise<any>((res) => store.get('any-sid', (_e, s) => res(s)));
    expect(got).toBeNull();
  });

  it('logout still completes (destroy calls back)', async () => {
    const agent = request.agent(appWith(new NullSessionStore()));
    await agent.get('/write');
    const out = await agent.post('/logout');
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ ok: true });
  });

  it('index.ts mounts the pw.sid session on this store, not on MemoryStore', () => {
    const src = readFileSync(resolve(process.cwd(), 'server/index.ts'), 'utf8');
    const start = src.indexOf("name: 'pw.sid'");
    expect(start).toBeGreaterThan(0);
    const block = src.slice(start, src.indexOf('})', start));
    expect(block).toContain('store: new NullSessionStore()');
  });
});
