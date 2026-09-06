/**
 * Regression pin for the three client↔server contract defects the
 * route-contract scanner v2 (#2255) surfaced and this change fixes.
 *
 * Each one is a call the browser makes that could never reach its handler.
 * None was caught by the existing octopusRouteContracts harness, because
 * that asks "is this path prefix mounted?" — and for all three the answer
 * was yes while the actual request still failed.
 *
 * Pure source scan: starts no server, touches no data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('route-contract client defects (#2255 findings) stay fixed', () => {
  describe('1 · GET /api/account/export carried a request body', () => {
    /**
     * `apiRequest('GET', url, {})` — the wrapper treats any truthy `data` as
     * a body and sets Content-Type, and `{}` is truthy. fetch() then throws
     * "Request with GET/HEAD method cannot have body" synchronously, so the
     * customer's "export my data" button failed before a request was sent.
     * This is a privacy-rights function, not a cosmetic one.
     */
    const src = read('client/src/pages/MyAccount.tsx');

    it('calls apiRequest with no third argument', () => {
      expect(src).toMatch(/apiRequest\('GET', '\/api\/account\/export'\)/);
    });

    it('never passes a body to that GET again', () => {
      expect(src).not.toMatch(/apiRequest\('GET', '\/api\/account\/export',/);
    });
  });

  describe('2 · AdminTransactionExplorer pointed at an unmounted URL', () => {
    /**
     * fiscal-passport.ts is mounted at /api/fiscal, so nothing under
     * /api/admin/fiscal-transactions has ever existed — the file's own
     * header comment documented a URL that was never wired.
     *
     * The scanner's suggested target was ALSO wrong: it emitted the
     * customer route (/transactions/by-source, participant scope) because
     * its relocation heuristic matches on the last three path segments,
     * which are identical between the two. The admin handler is a separate
     * declaration behind isSuperAdminVerified. Pinning the admin URL keeps
     * a future "fix" from quietly downgrading this surface to customer
     * scope.
     */
    const client = read('client/src/pages/admin/AdminTransactionExplorer.tsx');
    const server = read('server/routes/fiscal-passport.ts');

    it('the client calls the ADMIN route', () => {
      expect(client).toContain('/api/fiscal/admin/by-source/');
    });

    it('the client no longer calls the never-mounted URL', () => {
      expect(client).not.toContain('/api/admin/fiscal-transactions/by-source/');
    });

    it('the client does NOT call the customer-scoped route', () => {
      expect(client).not.toContain('/api/fiscal/transactions/by-source/');
    });

    it('the admin handler it targets really exists, and is gated', () => {
      expect(server).toMatch(/router\.get\(\s*'\/admin\/by-source\/:source\/:sourceId'/);
      expect(server).toContain('isSuperAdminVerified');
    });
  });

  describe('3 · ManagementKycDashboard passed a 4th arg to a 3-param apiRequest', () => {
    /**
     * The extra headers object was silently discarded, so the hand-rolled
     * Authorization bearer never applied. The call still authenticated —
     * apiRequest attaches a Firebase bearer whenever the caller supplied
     * none — so this was misleading dead code rather than a live 401. It
     * still had to go: it read like the auth path while opting out of
     * apiRequest's single-shot 401 refresh retry.
     */
    const src = read('client/src/pages/admin/ManagementKycDashboard.tsx');

    it('calls apiRequest with exactly two arguments', () => {
      expect(src).toMatch(
        /apiRequest\('GET', '\/api\/provider-onboarding\/mgmt\/analytics'\)/,
      );
    });

    it('no longer hand-rolls an Authorization header for that call', () => {
      expect(src).not.toMatch(/mgmt\/analytics',\s*undefined,/);
    });

    it('apiRequest still takes only three parameters — the premise of this pin', () => {
      const qc = read('client/src/lib/queryClient.ts');
      const sig = qc.slice(qc.indexOf('export async function apiRequest'));
      const params = sig.slice(sig.indexOf('(') + 1, sig.indexOf('): Promise<Response>'));
      // Count parameter NAMES at the start of a line — types carry commas
      // and unions, so splitting on ',' does not give one entry per param.
      const names = params
        .split('\n')
        .map((l) => l.match(/^\s*(\w+)\??:/)?.[1])
        .filter(Boolean);
      // A fourth named parameter would make the dropped-argument class
      // disappear — and would make this whole pin obsolete rather than wrong.
      expect(names).toEqual(['methodOrUrl', 'urlOrOptions', 'data']);
    });
  });
});
