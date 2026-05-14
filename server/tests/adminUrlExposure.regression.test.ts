/**
 * PR-FIX-FOOTER-ADMIN-LEAK — regression guard.
 *
 * Locks the fix for the public-footer admin-URL leak.
 * The site footer is rendered to every visitor (anonymous,
 * customer, and provider) and MUST NOT advertise admin or
 * maintenance-portal URLs. Advertising those URLs to anonymous
 * visitors is a reconnaissance win for attackers and a
 * credibility hazard (clicking lands a customer on a 403/denied
 * page that looks broken).
 *
 * If a future contributor (or an automated agent) re-adds an
 * `/admin/...` href anywhere inside Footer.tsx, these tests
 * fail loudly so the leak cannot drift back in.
 *
 * Sister suite to:
 *   - server/tests/providerSurfaceWording.regression.test.ts
 *   - server/tests/insuranceConsistency.regression.test.ts
 *
 * Test-only suite. No schema, no UI, no API, no auth, no
 * routing changes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path, { resolve } from "path";

const ROOT = resolve(__dirname, "..", "..");
const FOOTER_PATH = path.join(ROOT, "client/src/components/Footer.tsx");
const FOOTER = readFileSync(FOOTER_PATH, "utf8");

describe("PR-FIX-FOOTER-ADMIN-LEAK — Footer.tsx must not advertise admin URLs", () => {
  it("Footer.tsx exists and is non-empty", () => {
    expect(FOOTER.length).toBeGreaterThan(0);
  });

  it("Footer.tsx does not contain an `/admin/login-v2` link", () => {
    expect(FOOTER).not.toMatch(/\/admin\/login-v2/);
  });

  it("Footer.tsx does not contain an `/admin/guide` link", () => {
    expect(FOOTER).not.toMatch(/\/admin\/guide/);
  });

  it("Footer.tsx does not contain an `/admin/help` link", () => {
    expect(FOOTER).not.toMatch(/\/admin\/help/);
  });

  it("Footer.tsx does not contain any href that begins with `/admin/`", () => {
    // Catches future re-additions in any shape:
    //   <Link href="/admin/..." />
    //   <a href="/admin/...">
    //   href={"/admin/..."}
    expect(FOOTER).not.toMatch(/href=["']\/admin\//);
    expect(FOOTER).not.toMatch(/href=\{['"`]\/admin\//);
  });

  it("Footer.tsx does not contain a literal 'Admin Portal' label as a public link", () => {
    // The label "Admin Portal" was the user-visible artefact of
    // the leak. Future similar leaks may use the same wording —
    // block it.
    expect(FOOTER).not.toContain("Admin Portal");
  });

  it("Footer.tsx does not surface `footer.adminGuide` or `footer.maintenanceGuide` i18n keys", () => {
    expect(FOOTER).not.toMatch(/footer\.adminGuide/);
    expect(FOOTER).not.toMatch(/footer\.maintenanceGuide/);
  });
});
