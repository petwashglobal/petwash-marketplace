import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Regression pin for CEO 2026-08-19 SUMIT Phase 2 Item 10 — Saved payment
// methods UI (Add / Remove). Locks in:
//   (a) "Add a card" opens a SUMIT hosted portal URL fetched from
//       GET /api/me/sumit/add-card-url — the card never touches our server.
//   (b) Per-card "Remove" fires DELETE /api/me/sumit/methods/:token AFTER
//       a confirmation dialog (never a silent one-tap deletion).
//   (c) SumitClient exposes removeSavedMethod hitting the CONFIRMED
//       /billing/paymentmethods/remove/ endpoint.
//   (d) Server route DELETE /api/me/sumit/methods/:token is mounted,
//       Firebase-derived (uid from cookie/Bearer), and never accepts a
//       userId from the client input. 503 when SUMIT dormant.

const PAGE_SRC = readFileSync(
  join(__dirname, '..', '..', 'client', 'src', 'pages', 'AccountFinancials.tsx'),
  'utf8',
);
const CLIENT_SRC = readFileSync(
  join(__dirname, '..', '..', 'server', 'services', 'SumitClient.ts'),
  'utf8',
);
const ROUTES_SRC = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes.ts'),
  'utf8',
);

describe('SUMIT Phase 2 Item 10 — Saved payment methods CRUD', () => {
  it('UI has an "Add a card" button', () => {
    expect(PAGE_SRC).toMatch(/data-testid="button-add-card"/);
  });

  it('Add-card flow fetches the hosted portal URL — no PAN through our server', () => {
    expect(PAGE_SRC).toMatch(/['"]\/api\/me\/sumit\/add-card-url['"]/);
    // The redirect must open in a new tab or same-window navigation of the
    // SUMIT hosted portal URL — never a local card form.
    expect(PAGE_SRC).toMatch(/window\.open\s*\(\s*body\.url/);
    // Sanity: no local card capture inputs on this page.
    expect(PAGE_SRC).not.toMatch(/name="cardNumber"/);
    expect(PAGE_SRC).not.toMatch(/type="password".*card/i);
  });

  it('Remove is gated by a confirmation dialog before firing the DELETE', () => {
    expect(PAGE_SRC).toMatch(/AlertDialog/);
    expect(PAGE_SRC).toMatch(/data-testid="confirm-remove-dialog"/);
    expect(PAGE_SRC).toMatch(/data-testid="button-confirm-remove"/);
    expect(PAGE_SRC).toMatch(/data-testid="button-cancel-remove"/);
    // The Remove button on a row sets pendingRemove (opens the dialog); the
    // actual mutation only fires from onClick of the AlertDialogAction, not
    // from the row button.
    expect(PAGE_SRC).toMatch(/setPendingRemove\(\{\s*id:\s*c\.id/);
    expect(PAGE_SRC).toMatch(/removeMutation\.mutate\(pendingRemove\.id\)/);
  });

  it('DELETE /api/me/sumit/methods/:token is called with encoded token', () => {
    expect(PAGE_SRC).toMatch(/DELETE.*\/api\/me\/sumit\/methods\/\$\{encodeURIComponent/);
  });

  it('SumitClient.removeSavedMethod hits /billing/paymentmethods/remove/', () => {
    expect(CLIENT_SRC).toMatch(/async\s+removeSavedMethod\s*\(/);
    expect(CLIENT_SRC).toMatch(/\/billing\/paymentmethods\/remove\//);
    // Fail-quiet: not-wired short-circuit + never-throws promise wrapper.
    const block = CLIENT_SRC.slice(
      CLIENT_SRC.indexOf('async removeSavedMethod'),
      CLIENT_SRC.indexOf('POST /billing/paymentmethods/setforcustomer'),
    );
    expect(block).toMatch(/if\s*\(!isWired\(\)\)/);
    expect(block).toMatch(/removed:\s*false/);
  });

  it('server DELETE route is mounted at /api/me/sumit/methods/:token', () => {
    expect(ROUTES_SRC).toMatch(/app\.delete\(['"]\/api\/me\/sumit\/methods\/:token['"]/);
  });

  it('DELETE route derives uid via Firebase — never from client input', () => {
    const routeStart = ROUTES_SRC.indexOf("app.delete('/api/me/sumit/methods/:token'");
    expect(routeStart).toBeGreaterThan(0);
    const routeBlock = ROUTES_SRC.slice(routeStart, routeStart + 1500);
    expect(routeBlock).toMatch(/resolveAuthenticatedUid\s*\(\s*req\s*\)/);
    // The uid feeds getSumitCustomerId — the browser NEVER supplies the
    // SUMIT customer id.
    expect(routeBlock).toMatch(/getSumitCustomerId\s*\(\s*uid\s*\)/);
    expect(routeBlock).not.toMatch(/req\.body\.userId|req\.query\.userId|req\.body\.sumitCustomerId/);
  });

  it('DELETE route returns 503 when SUMIT is dormant (not wired)', () => {
    const routeStart = ROUTES_SRC.indexOf("app.delete('/api/me/sumit/methods/:token'");
    const routeBlock = ROUTES_SRC.slice(routeStart, routeStart + 1500);
    expect(routeBlock).toMatch(/isWired\(\)/);
    expect(routeBlock).toMatch(/status\(503\)/);
  });
});
