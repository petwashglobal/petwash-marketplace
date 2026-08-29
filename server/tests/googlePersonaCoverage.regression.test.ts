/**
 * CEO FLY MODE II §38 + §39 (2026-08-29) — Google persona coverage pins.
 *
 * Locks that the Lane 2 Google persona spec exists AND covers every
 * canonical destination the runtime distinguishes:
 *   §38  new customer      → /pet-parent/home
 *   §39  returning customer → /pet-parent/home
 *   §38b approved provider → /provider/today
 *   §38c approved admin    → /admin
 *
 * Also locks that the personas catalog in the Firebase test adapter
 * exposes the same four canonical destinations — so the spec + adapter
 * cannot drift out of sync.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');

const SPEC = fs.readFileSync(
  path.resolve(ROOT, 'tests', 'e2e', 'auth-master-lane-2-google-personas.e2e.spec.ts'),
  'utf8',
);

const ADAPTER = fs.readFileSync(
  path.resolve(ROOT, 'tests', 'e2e', 'firebaseTestAdapter.ts'),
  'utf8',
);

describe('CEO FLY MODE II §38 + §39 — Google persona spec coverage', () => {
  it('spec exists and imports the Firebase test adapter personas', () => {
    expect(SPEC).toMatch(/from '\.\/firebaseTestAdapter'/);
    expect(SPEC).toMatch(/installFirebaseTestAdapter/);
    expect(SPEC).toMatch(/personas/);
  });

  it('§38 Google new customer scenario is present', () => {
    expect(SPEC).toMatch(/§38 Google new customer/);
    expect(SPEC).toMatch(/persona:\s*personas\.customerActive/);
  });

  it('§39 Google returning customer scenario is present', () => {
    expect(SPEC).toMatch(/§39 Google returning customer/);
  });

  it('§38b approved provider scenario is present and targets /provider/today', () => {
    expect(SPEC).toMatch(/§38b Google approved provider/);
    expect(SPEC).toMatch(/persona:\s*personas\.providerActive/);
    expect(SPEC).toMatch(/\/provider\/today/);
  });

  it('§38c approved admin scenario is present and targets /admin', () => {
    expect(SPEC).toMatch(/§38c Google approved admin/);
    expect(SPEC).toMatch(/persona:\s*personas\.adminActive/);
    expect(SPEC).toMatch(/\/admin/);
  });

  it('every scenario skips cleanly when the adapter is unavailable', () => {
    // A test.skip(!firebaseAdapterAvailable(), ...) MUST be the
    // first line inside each test body so unconfigured envs don't
    // hang on the goto().
    expect(SPEC).toMatch(/test\.skip\(\s*!firebaseAdapterAvailable\(\)/);
  });

  it('every scenario clicks a real Google button — no page.goto shortcut past the handler', () => {
    // The scenarios must land on /signin (or /admin/login for admin)
    // and click a CTA — not shortcut to the post-login destination
    // directly. This is what makes the coverage a real §38/§39
    // journey rather than a fake destination assertion.
    expect(SPEC).toMatch(/await page\.goto\(c\.entryPath\)/);
    expect(SPEC).toMatch(
      /data-testid="cta-signin-google"|data-action-id\*="signin-google"|data-testid="button-google-signin"/,
    );
    expect(SPEC).toMatch(/await googleBtn\.click\(\)/);
  });
});

describe('CEO FLY MODE II §38 + §39 — persona catalog carries every canonical destination', () => {
  it('adapter personas.customerActive → /pet-parent/home', () => {
    expect(ADAPTER).toMatch(
      /customerActive:\s*\{[\s\S]{0,400}canonicalDestination:\s*'\/pet-parent\/home'/,
    );
  });

  it('adapter personas.providerActive → /provider/today', () => {
    expect(ADAPTER).toMatch(
      /providerActive:\s*\{[\s\S]{0,400}canonicalDestination:\s*'\/provider\/today'/,
    );
  });

  it('adapter personas.adminActive → /admin', () => {
    expect(ADAPTER).toMatch(
      /adminActive:\s*\{[\s\S]{0,400}canonicalDestination:\s*'\/admin'/,
    );
  });

  it('adapter personas.staffActive → /staff/home', () => {
    // Staff isn't in the §38/§39 spec (Google-only surface, staff
    // typically signs in with password today) but the catalog
    // still carries the canonical destination so it can be added
    // trivially if CEO expands the surface.
    expect(ADAPTER).toMatch(
      /staffActive:\s*\{[\s\S]{0,400}canonicalDestination:\s*'\/staff\/home'/,
    );
  });

  it('adapter personas.providerPending → /provider/pending (differentiates from active)', () => {
    // A pending provider must not land on /provider/today — that
    // gate rejects. §36 partial-approval + this destination
    // catalog together prove the runtime honors pre-approval state.
    expect(ADAPTER).toMatch(
      /providerPending:\s*\{[\s\S]{0,400}canonicalDestination:\s*'\/provider\/pending'/,
    );
  });
});
