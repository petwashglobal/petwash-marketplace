/**
 * PR-DANGER-7 regression pin — HRDashboard.tsx auth transport.
 *
 * The pre-fix shape at lines 31/40/50:
 *   fetch(getApiUrl("/api/enterprise/hr/..."), { credentials: "include" });
 * sent only the pw_session cookie. The server-side requireAdmin middleware
 * (server/adminAuth.ts) accepts either Bearer or session cookie, but on
 * hosts where the pw_session cookie is missing (fresh browser, cross-
 * origin dev, cookie cleared) every one of the three panels silently 401'd
 * while the page shell still rendered "logged in" — the HR list / payroll
 * / time-tracking panels were permanently broken for those users.
 *
 * Fix: swap to apiRequest, which:
 *   * attaches a Firebase Bearer id token from the current user
 *   * still includes credentials: 'include' (both transports covered)
 *   * throws on !ok so the useQuery error boundary fires with a real
 *     message instead of an empty panel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const src = fs.readFileSync(path.join(root, 'client/src/pages/HRDashboard.tsx'), 'utf8');

describe('PR-DANGER-7 — HRDashboard uses apiRequest, never bare fetch', () => {
  it('no raw fetch(getApiUrl(...)) shape remains', () => {
    // Regression: any surviving `fetch(getApiUrl(...))` would fall back
    // to cookie-only auth. Pin the shape's absence at the source level.
    expect(src).not.toMatch(/fetch\(getApiUrl\(/);
  });

  it('does not import getApiUrl (proves no leftover raw-fetch caller)', () => {
    // If getApiUrl is imported anywhere on this page, it hints that a
    // raw fetch is still using it — the apiRequest wrapper builds its
    // URL internally, so the import should not survive.
    expect(src).not.toMatch(/from ['"]@\/lib\/apiConfig['"]/);
    expect(src).not.toMatch(/\bgetApiUrl\b/);
  });

  it('three data queries go through apiRequest', () => {
    // Named-endpoint pins for the three panels that previously 401'd:
    expect(src).toMatch(
      /apiRequest\("GET", "\/api\/enterprise\/hr\/employees\?filter=active"\)/,
    );
    expect(src).toMatch(
      /apiRequest\("GET", "\/api\/enterprise\/hr\/payroll"\)/,
    );
    expect(src).toMatch(
      /apiRequest\("GET", `\/api\/enterprise\/hr\/employees\/\$\{selectedEmployee\.id\}\/time-tracking`\)/,
    );
  });

  it('mutations (already correct) still route through apiRequest', () => {
    // The createEmployeeMutation was already correct before this PR.
    // Pinned so a future refactor that "harmonises everything to raw
    // fetch" cannot undo the mutation-side correctness either.
    expect(src).toMatch(
      /apiRequest\(`\/api\/enterprise\/hr\/employees`, \{ method: "POST", body: data \}\)/,
    );
  });
});
