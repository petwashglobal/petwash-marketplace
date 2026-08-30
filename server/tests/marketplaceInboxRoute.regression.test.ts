/**
 * /api/marketplace/inbox — mount + contract regression pin.
 *
 * CEO NEXT-AUTO §21 + Doctrine §22, §29, §37.
 *
 * Locks:
 *   • Real HubSource is bound at mount time (not the stub).
 *   • UID derived server-side from firebaseUser — never req.body.
 *   • Workspace is validated against a closed set (PET_PARENT /
 *     PROVIDER); anything else → 400.
 *   • Auth is enforced via validateFirebaseToken + apiLimiter, same
 *     as the Action Brain surface.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTE = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'marketplace-inbox.ts'),
  'utf8',
);

const MOUNT = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

describe('mount — /api/marketplace guarded by validateFirebaseToken + apiLimiter', () => {
  it('imports the route module', () => {
    expect(MOUNT).toMatch(
      /import marketplaceInboxRoutes from ["']\.\/routes\/marketplace-inbox["']/,
    );
  });

  it('mounts under /api/marketplace with the standard auth chain', () => {
    expect(MOUNT).toMatch(
      /app\.use\(['"]\/api\/marketplace['"], validateFirebaseToken, apiLimiter, marketplaceInboxRoutes\)/,
    );
  });

  it('boot log announces the mount', () => {
    expect(MOUNT).toMatch(/Marketplace Inbox registered at \/api\/marketplace\/inbox/);
  });
});

describe('route — uses real HubSource, never the stub', () => {
  it('imports createProductionHubSource from CommunicationHubService', () => {
    expect(ROUTE).toMatch(
      /import \{[\s\S]{0,120}createProductionHubSource,\s*\} from '\.\.\/services\/marketplace\/CommunicationHubService'/,
    );
  });

  it('does NOT bind the stub source', () => {
    expect(ROUTE).not.toMatch(/createStubHubSource/);
  });
});

describe('CEO §29 + §37 — server-derived UID, closed workspace enum', () => {
  it('uid is read from req.firebaseUser, never from req.body', () => {
    expect(ROUTE).toMatch(/const uid = \(req as any\)\.firebaseUser\?\.uid/);
    // req.body must never contribute to identity or workspace.
    const getIdx = ROUTE.indexOf("router.get('/inbox'");
    const end = ROUTE.indexOf('});', getIdx);
    const handler = ROUTE.slice(getIdx, end);
    expect(handler).not.toMatch(/req\.body/);
  });

  it('workspace enum is closed — invalid → 400 invalid_workspace', () => {
    expect(ROUTE).toMatch(
      /const VALID_WORKSPACES: readonly InboxWorkspace\[\] = \['PET_PARENT', 'PROVIDER'\]/,
    );
    expect(ROUTE).toMatch(
      /if \(!VALID_WORKSPACES\.includes\(workspaceRaw as InboxWorkspace\)\)/,
    );
    expect(ROUTE).toMatch(/status\(400\)[\s\S]{0,80}invalid_workspace/);
  });

  it('missing uid → 401 auth_required', () => {
    expect(ROUTE).toMatch(/status\(401\)[\s\S]{0,80}auth_required/);
  });

  it('limit is clamped to [1, 100] — never trusts client value blindly', () => {
    expect(ROUTE).toMatch(/Math\.min\(Math\.max\(1, Math\.floor\(limitRaw\)\), 100\)/);
  });

  it('CEO DEEP-LOGIC §7 — locale is validated to a closed set (he | en)', () => {
    expect(ROUTE).toMatch(/const locale = \(localeRaw === 'en' \? 'en' : 'he'\)/);
    expect(ROUTE).toMatch(/locale/);
    // The listForUser call must forward the validated locale.
    expect(ROUTE).toMatch(/listForUser\(uid, getSource\(\), \{ workspace, category, limit, locale \}\)/);
  });
});

describe('error discipline — fail-CLOSED, no internals in body', () => {
  it("unhandled error returns 500 with a stable code, never req internals", () => {
    const catchIdx = ROUTE.indexOf('} catch (err: any) {');
    expect(catchIdx).toBeGreaterThan(0);
    const catchEnd = ROUTE.indexOf('\n  }\n});', catchIdx);
    const body = ROUTE.slice(catchIdx, catchEnd > 0 ? catchEnd : ROUTE.length);
    expect(body).toMatch(/status\(500\)[\s\S]{0,400}inbox_unavailable/);
    // The error body must not include the raw exception message in
    // the response — the logger call above may reference err, but the
    // res.status(500).json({...}) call must not.
    const jsonIdx = body.indexOf('res.status(500).json(');
    expect(jsonIdx).toBeGreaterThan(0);
    const jsonEnd = body.indexOf(');', jsonIdx);
    const jsonPayload = body.slice(jsonIdx, jsonEnd);
    expect(jsonPayload).not.toMatch(/\berr\b/);
  });
});
