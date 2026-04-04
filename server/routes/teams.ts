/**
 * server/routes/teams.ts
 * Phase 12.11 — Team Management
 *
 * Mounted at /api/teams
 *
 * GET  /              — list all teams with member counts
 * POST /              — create team
 * GET  /mine          — teams the caller belongs to (with role)
 * GET  /:id/members   — list members of a team
 * POST /:id/members   — add member to a team
 * DELETE /:id/members/:uid — remove member from a team
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';
import { timingSafeAdminSecretMatch } from '../middleware/adminAuth';

const router = Router();
const ADMIN_SEC = process.env.ADMIN_SECRET || process.env.PETWASH_ADMIN_SECRET;

type CallerRole = 'admin' | 'franchise_owner' | 'station_operator';

interface CallerCtx {
  role: CallerRole;
  uid:  string | null;
}

const toNum = (v: unknown): number => Number(v ?? 0);
const toStr = (v: unknown): string => v != null ? String(v) : '';

// ─── Auth middleware ──────────────────────────────────────────────────────────

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (timingSafeAdminSecretMatch(req)) {
      (req as any).ctx = { role: 'admin', uid: null } as CallerCtx;
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    const decoded = await auth.verifyIdToken(authHeader.slice(7), true);
    const uid = decoded.uid;

    if (decoded.admin) {
      (req as any).ctx = { role: 'admin', uid } as CallerCtx;
      return next();
    }

    const foRows = await db.execute(sql`
      SELECT id FROM franchise_owners WHERE owner_user_id = ${uid} AND status = 'active'
    `);
    if (foRows.rows.length) {
      (req as any).ctx = { role: 'franchise_owner', uid } as CallerCtx;
      return next();
    }

    const opRows = await db.execute(sql`
      SELECT station_id FROM station_operators WHERE user_id = ${uid} AND is_active = true
    `);
    if (opRows.rows.length) {
      (req as any).ctx = { role: 'station_operator', uid } as CallerCtx;
      return next();
    }

    return res.status(403).json({ error: 'access_denied' });
  } catch (err: any) {
    logger.error('[Teams] auth error', { error: err.message });
    return res.status(401).json({ error: 'authentication_failed' });
  }
}

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        t.id,
        t.name,
        t.type,
        t.created_at,
        COUNT(tm.id)::int AS member_count,
        COUNT(CASE WHEN tm.role = 'manager' THEN 1 END)::int AS manager_count
      FROM teams t
      LEFT JOIN team_members tm ON tm.team_id = t.id
      GROUP BY t.id
      ORDER BY t.name
    `);

    const teams = (rows.rows as any[]).map(r => ({
      id:           toNum(r.id),
      name:         toStr(r.name),
      type:         toStr(r.type),
      memberCount:  toNum(r.member_count),
      managerCount: toNum(r.manager_count),
      createdAt:    r.created_at ? (r.created_at as Date).toISOString() : null,
    }));

    res.json({ teams, total: teams.length });
  } catch (err: any) {
    logger.error('[Teams] list error', { error: err.message });
    res.status(500).json({ error: 'teams_list_error' });
  }
});

// ─── POST / ───────────────────────────────────────────────────────────────────

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx = (req as any).ctx as CallerCtx;
    if (ctx.role !== 'admin' && ctx.role !== 'franchise_owner') {
      return res.status(403).json({ error: 'admin_or_franchise_owner_required' });
    }

    const { name, type } = req.body ?? {};
    if (!name?.trim() || !type?.trim()) {
      return res.status(400).json({ error: 'name and type required' });
    }
    if (!['support', 'franchise', 'ops'].includes(String(type))) {
      return res.status(400).json({ error: 'type must be support | franchise | ops' });
    }

    const result = await db.execute(sql`
      INSERT INTO teams (name, type) VALUES (${String(name)}, ${String(type)})
      RETURNING id, name, type, created_at
    `);
    const row = result.rows[0] as any;

    res.status(201).json({
      id:        toNum(row.id),
      name:      toStr(row.name),
      type:      toStr(row.type),
      createdAt: row.created_at ? (row.created_at as Date).toISOString() : null,
    });
  } catch (err: any) {
    logger.error('[Teams] create error', { error: err.message });
    res.status(500).json({ error: 'team_create_error' });
  }
});

// ─── GET /mine ────────────────────────────────────────────────────────────────

router.get('/mine', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx = (req as any).ctx as CallerCtx;
    if (!ctx.uid) {
      return res.json({ teams: [] });
    }

    const rows = await db.execute(sql`
      SELECT
        t.id, t.name, t.type,
        tm.role AS my_role,
        COUNT(all_members.id)::int AS member_count
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      LEFT JOIN team_members all_members ON all_members.team_id = t.id
      WHERE tm.user_uid = ${ctx.uid}
      GROUP BY t.id, t.name, t.type, tm.role
      ORDER BY t.name
    `);

    const teams = (rows.rows as any[]).map(r => ({
      id:          toNum(r.id),
      name:        toStr(r.name),
      type:        toStr(r.type),
      myRole:      toStr(r.my_role),
      memberCount: toNum(r.member_count),
    }));

    res.json({ teams });
  } catch (err: any) {
    logger.error('[Teams] mine error', { error: err.message });
    res.status(500).json({ error: 'teams_mine_error' });
  }
});

// ─── GET /:id/members ─────────────────────────────────────────────────────────

router.get('/:id/members', requireAuth, async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    if (isNaN(teamId)) return res.status(400).json({ error: 'invalid team id' });

    const rows = await db.execute(sql`
      SELECT
        tm.id,
        tm.user_uid,
        tm.role,
        tm.created_at,
        COUNT(ca.id)::int AS active_cases
      FROM team_members tm
      LEFT JOIN case_assignments ca
        ON ca.assigned_to_uid = tm.user_uid AND ca.is_active = true
      WHERE tm.team_id = ${teamId}
      GROUP BY tm.id, tm.user_uid, tm.role, tm.created_at
      ORDER BY tm.role DESC, tm.created_at ASC
    `);

    const members = (rows.rows as any[]).map(r => ({
      id:          toNum(r.id),
      userUid:     toStr(r.user_uid),
      role:        toStr(r.role),
      activeCases: toNum(r.active_cases),
      addedAt:     r.created_at ? (r.created_at as Date).toISOString() : null,
    }));

    res.json({ members, total: members.length });
  } catch (err: any) {
    logger.error('[Teams] members error', { error: err.message });
    res.status(500).json({ error: 'team_members_error' });
  }
});

// ─── POST /:id/members ────────────────────────────────────────────────────────

router.post('/:id/members', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx = (req as any).ctx as CallerCtx;
    if (ctx.role !== 'admin' && ctx.role !== 'franchise_owner') {
      return res.status(403).json({ error: 'admin_or_franchise_owner_required' });
    }

    const teamId = parseInt(req.params.id, 10);
    if (isNaN(teamId)) return res.status(400).json({ error: 'invalid team id' });

    const { userUid, role } = req.body ?? {};
    if (!userUid?.trim()) return res.status(400).json({ error: 'userUid required' });
    if (!['agent', 'manager'].includes(String(role))) {
      return res.status(400).json({ error: 'role must be agent | manager' });
    }

    const result = await db.execute(sql`
      INSERT INTO team_members (team_id, user_uid, role)
      VALUES (${teamId}, ${String(userUid)}, ${String(role)})
      ON CONFLICT (user_uid, team_id) DO UPDATE SET role = EXCLUDED.role
      RETURNING id, user_uid, role, created_at
    `);
    const row = result.rows[0] as any;

    res.status(201).json({
      id:      toNum(row.id),
      userUid: toStr(row.user_uid),
      role:    toStr(row.role),
      addedAt: row.created_at ? (row.created_at as Date).toISOString() : null,
    });
  } catch (err: any) {
    logger.error('[Teams] add member error', { error: err.message });
    res.status(500).json({ error: 'team_add_member_error' });
  }
});

// ─── DELETE /:id/members/:uid ─────────────────────────────────────────────────

router.delete('/:id/members/:uid', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx = (req as any).ctx as CallerCtx;
    if (ctx.role !== 'admin' && ctx.role !== 'franchise_owner') {
      return res.status(403).json({ error: 'admin_or_franchise_owner_required' });
    }

    const teamId = parseInt(req.params.id, 10);
    if (isNaN(teamId)) return res.status(400).json({ error: 'invalid team id' });

    const uid = req.params.uid;

    await db.execute(sql`
      DELETE FROM team_members
      WHERE team_id = ${teamId} AND user_uid = ${uid}
    `);

    res.json({ success: true, teamId, userUid: uid });
  } catch (err: any) {
    logger.error('[Teams] remove member error', { error: err.message });
    res.status(500).json({ error: 'team_remove_member_error' });
  }
});

export default router;
