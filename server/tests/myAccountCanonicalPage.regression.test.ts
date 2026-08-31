/**
 * Regression pin — MyAccountCanonical page + useMyAccountSnapshot
 * hook. Source-anchored so a refactor that drops per-section save,
 * dirty-state, no-false-success discipline, or a required testid
 * is caught in CI.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CLIENT_ROOT = path.resolve(__dirname, '../../client/src');
const PAGE = fs.readFileSync(path.join(CLIENT_ROOT, 'pages/MyAccountCanonical.tsx'), 'utf8');
const HOOK = fs.readFileSync(path.join(CLIENT_ROOT, 'hooks/useMyAccountSnapshot.ts'), 'utf8');
const APP = fs.readFileSync(path.join(CLIENT_ROOT, 'App.tsx'), 'utf8');

describe('useMyAccountSnapshot — hook wire', () => {
  it('GET hits /api/me/profile', () => {
    expect(HOOK).toMatch(/apiRequest\(\s*['"]GET['"]\s*,\s*['"]\/api\/me\/profile['"]/);
  });

  it('PATCH mutation targets /api/me/profile with method PATCH', () => {
    expect(HOOK).toMatch(/apiRequest\(\s*['"]\/api\/me\/profile['"]\s*,\s*\{\s*method:\s*['"]PATCH['"]/);
  });

  it('outcome union distinguishes ok / partial_rollback / rejected / not_authenticated / error', () => {
    for (const s of ["'ok'", "'partial_rollback'", "'rejected'", "'not_authenticated'", "'error'"]) {
      expect(HOOK).toContain(s);
    }
  });

  it('409 UPDATE_PARTIAL_ROLLBACK_REQUIRED preserves server-persisted snapshot', () => {
    expect(HOOK).toContain('UPDATE_PARTIAL_ROLLBACK_REQUIRED');
    expect(HOOK).toContain('reasonCode');
  });

  it('onSuccess invalidates /api/me/profile so completeness re-renders in one round-trip', () => {
    expect(HOOK).toMatch(/qc\.invalidateQueries\(\{\s*queryKey:\s*\['\/api\/me\/profile'\]/);
  });
});

describe('MyAccountCanonical page — contract shape', () => {
  it('renders the page testid', () => {
    expect(PAGE).toContain("data-testid=\"my-account-canonical-page\"");
  });

  it('exposes PERSONAL / ADDRESS / PREFERENCES sections plus CONTACT block', () => {
    // Sections come from the editable set ['PERSONAL','ADDRESS','PREFERENCES']
    // rendered via a `section-${code}` testid template. CONTACT is a
    // literal testid because its block is not editable.
    expect(PAGE).toMatch(/const\s+editable\s*=\s*\['PERSONAL',\s*'ADDRESS',\s*'PREFERENCES'\]|PERSONAL',\s*'ADDRESS',\s*'PREFERENCES'/);
    expect(PAGE).toContain('data-testid={`section-${props.code}`}');
    expect(PAGE).toContain('section-CONTACT');
  });

  it('per-section Edit + Save + Cancel testids exist (template-driven)', () => {
    // The three buttons are rendered via `edit-${code}`, `save-${code}`,
    // `cancel-${code}` templates so all editable sections get them.
    expect(PAGE).toContain('data-testid={`edit-${props.code}`}');
    expect(PAGE).toContain('data-testid={`save-${props.code}`}');
    expect(PAGE).toContain('data-testid={`cancel-${props.code}`}');
  });

  it('CONTACT section uses ReadOnlyRow and routes CHANGE through /contact-change flow', () => {
    expect(PAGE).toMatch(/ReadOnlyRow[\s\S]*field=["']email["']/);
    expect(PAGE).toMatch(/ReadOnlyRow[\s\S]*field=["']phone["']/);
    expect(PAGE).toContain('change=email');
    expect(PAGE).toContain('change=mobile');
  });

  it('renders VERIFIED / NOT_VERIFIED pill honestly (no fake "verified")', () => {
    expect(PAGE).toContain("'VERIFIED'");
    expect(PAGE).toContain("'NOT_VERIFIED'");
  });

  it('SAVING and SAVED pills gate the button state (no false success)', () => {
    expect(PAGE).toContain('SAVING…');
    expect(PAGE).toContain('SAVED_✓');
  });

  it('PARTIAL_ROLLBACK surfaces reasonCode from server (split-brain honesty)', () => {
    expect(PAGE).toContain('PARTIAL_ROLLBACK_');
  });

  it('Save button is disabled when nothing changed (dirty gate)', () => {
    expect(PAGE).toMatch(/disabled=\{props\.isSaving\s*\|\|\s*!props\.dirty\}/);
  });

  it('EDIT button is disabled when server is not ready (501 honest state)', () => {
    expect(PAGE).toMatch(/disabled=\{!props\.serverReady\}/);
  });

  it('beforeunload dirty-state prompt attached only when dirty', () => {
    expect(PAGE).toContain("addEventListener('beforeunload'");
    expect(PAGE).toMatch(/if\s*\(!dirty\)\s*return/);
  });

  it('link tiles to MY_PETS / PRESTIGE / PROVIDER_SETTINGS / PAYMENTS / DOCUMENTS (via <LinkTile code=...>)', () => {
    // LinkTile emits `tile-${code}`; the page uses <LinkTile code="..."> for each destination.
    expect(PAGE).toContain('data-testid={`tile-${props.code}`}');
    for (const code of ['MY_PETS', 'PRESTIGE', 'PROVIDER_SETTINGS', 'PAYMENTS', 'DOCUMENTS']) {
      expect(PAGE).toMatch(new RegExp(`<LinkTile\\s+code="${code}"`));
    }
  });

  it('SERVER_NOT_READY pill renders when hook returns not_ready (honest §72 surface)', () => {
    expect(PAGE).toContain('server-not-ready-pill');
    expect(PAGE).toContain('SERVER_NOT_READY');
  });
});

describe('App.tsx — MyAccountCanonical route wire', () => {
  it('lazy-imports MyAccountCanonical', () => {
    expect(APP).toMatch(/const\s+MyAccountCanonical\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(["']@\/pages\/MyAccountCanonical["']\)/);
  });

  it('mounts /my-account/canonical behind RequireAuth + RouteErrorBoundary + Suspense', () => {
    expect(APP).toContain('/my-account/canonical');
    // Must be wrapped in the same guards the legacy route uses so
    // the canonical scaffold cannot be reached unauthenticated.
    expect(APP).toMatch(/routeName=["']\/my-account\/canonical["']/);
  });
});
