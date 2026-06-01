# Dependabot triage — 2026-05-23

**Status as of push:** 72 open Dependabot alerts on `main` —
**1 critical, 21 high, 47 moderate, 3 low**.

**Status of this doc:** read-only triage methodology + dep-by-dep
risk bucketing. **No package.json change in this PR.** Every actual
upgrade is a separate, individually-approved PR per
`petwash-platform §2` ("no new dependencies / no package.json change
without explicit approval").

## 1. How to pull the real alert list

Anyone with `security_events` access can list the alerts:

```bash
# Via gh CLI (run from any machine with gh authenticated)
gh api repos/petwashglobal/petwash-marketplace/dependabot/alerts \
   --paginate -q '.[] | {number, severity, state, pkg: .security_advisory.package.name, ghsa: .security_advisory.ghsa_id, summary: .security_advisory.summary, fix: .security_vulnerability.first_patched_version.identifier}'

# Or in the GitHub UI
# https://github.com/petwashglobal/petwash-marketplace/security/dependabot
```

Filter for `state=open` and sort by severity. Group by package name —
many of the 72 alerts collapse to a smaller number of root causes
(a single vulnerable transitive dep can produce 5+ alerts).

## 2. Priority model for PetWash

The base CVSS severity from Dependabot is a starting point, not the
final ranking. Re-prioritize against PetWash's blast-radius rules:

| Tier | Definition | Examples |
|---|---|---|
| **P0** | Touches auth, money, or admin control plane | `@simplewebauthn/*`, `jsonwebtoken`, `bcrypt`, anything in the Tranzila/Nayax/Stripe path |
| **P1** | Touches inbound HTTP, file upload, or XSS-prevention layers | `express`, `body-parser`, `multer`, `cors`, `dompurify`, `sanitize-html`, `helmet` |
| **P2** | Touches data layer, session store, or observability | `@neondatabase/serverless`, `drizzle-*`, `@sentry/*`, `ioredis`, `cookie-parser` |
| **P3** | Touches AI / 3rd-party SDKs called from server | `@google/genai`, `@google-cloud/*`, `@hubspot/api-client`, `@docuseal/api`, `@octokit/rest` |
| **P4** | Touches UI primitives or client-only rendering | `@radix-ui/*`, `react-*`, `framer-motion`, charting libs |
| **P5** | Type-only packages (don't ship runtime) | every `@types/*` |
| **P6** | Build / dev tools | `vite`, `tsx`, `typescript`, `drizzle-kit`, test runners |

**Rule:** A *moderate* Dependabot alert in a P0 package outranks a
*high* alert in a P5 package. Always re-rank by the blast-radius
column before scheduling fixes.

## 3. Triage of currently-installed runtime deps

Below: every production dep I can see in `package.json`, bucketed by
the priority model above. Use this table as the de-duping key when
the real Dependabot list lands — if the table says P0 and an alert
hits that row, schedule it first.

### P0 — auth / money / admin control plane (fix first)

| Package | Why P0 | Notes |
|---|---|---|
| `@simplewebauthn/browser` | Passkey / WebAuthn flow | Verify it's still in use; if WebAuthn is parked, candidate for removal |
| `@simplewebauthn/server` | Same | Same |
| `bcrypt` (via `@types/bcrypt`) | Password hashing | Audit: is bcrypt actually invoked, or are passwords delegated to Firebase Auth? If delegated → unused → remove |
| `jsonwebtoken` (via `@types/jsonwebtoken`) | JWT signing for biometric mobile app + admin | Confirm rotation policy is current |
| `firebase-admin` (search package.json) | Admin SDK — manages auth claims | Critical to keep current |

### P1 — inbound HTTP / file upload / XSS sanitizers

| Package | Why P1 | Notes |
|---|---|---|
| `express` / `@hono/node-server` | Every request goes through here | Express CVEs are common; check first |
| `multer` (`@types/multer`) | File upload — direct attack surface | Historical CVEs around path traversal |
| `cors` (`@types/cors`) | Origin policy | Misconfigured CORS = credential leakage |
| `compression` (`@types/compression`) | Response compression | CRIME/BREACH-class issues if mis-tuned |
| `cookie-parser` (`@types/cookie-parser`) | Session cookies | Auth-adjacent |
| `dompurify` (`@types/dompurify`) | XSS prevention | Sanitizer bugs = stored XSS |
| `sanitize-html` (`@types/sanitize-html`) | XSS prevention | Same |
| `helmet` (verify) | Security headers | Lower-risk but P1 if outdated |

### P2 — data layer / session / observability

| Package | Why P2 | Notes |
|---|---|---|
| `@neondatabase/serverless` | Postgres driver | Connection-handling bugs can leak data |
| `drizzle-orm` (verify) | Query builder | SQL-injection-class risks if buggy |
| `ioredis` (`@types/ioredis`) | Redis client | Session store |
| `@sentry/node`, `@sentry/browser` | Error reporting | Lower attack surface but P2 if it ships secrets |

### P3 — AI and external SDKs

| Package | Why P3 | Notes |
|---|---|---|
| `@google/genai` | Gemini calls | Per platform skill, AI is advisory only — no money path |
| `@google-cloud/vision` | OCR for invoices | Touched by supplier-invoice screening |
| `@google-cloud/storage` | File storage | File-handling adjacent |
| `@google-cloud/translate`, `@google-cloud/dialogflow-cx`, `@google-cloud/recaptcha-enterprise` | Various Google SDKs | Generally well-maintained, P3 |
| `@hubspot/api-client` | CRM integration | External SDK |
| `@docuseal/api` | Document signing | Finance-adjacent — bump to P2 if it lives in the contract flow |
| `@octokit/rest` | GitHub API | Only used in dev/ops scripts — check before upgrading |
| `@sendgrid/mail` | Outbound email | Bug = mail-delivery issue, not auth bypass |
| `@spotify/web-api-ts-sdk` | Unknown PetWash usage | Investigate before upgrading |
| `@googlemaps/google-maps-services-js` | Geocoding | Low risk |

### P4 — UI primitives (client-only)

All `@radix-ui/*` (27 packages observed), `@hookform/resolvers`,
`@tanstack/react-query`, `@simplewebauthn/browser` (also P0 above —
P0 wins on rank).

These run in the browser. A bug in a Radix dialog is a UX bug, not
an auth bypass. Schedule after P0–P3.

### P5 — type-only (`@types/*`)

15+ `@types/*` packages. These do not ship runtime code. Dependabot
alerts on `@types/*` are almost always false-positive for security
purposes (the alert is on the runtime package the types describe).
**Resolve by upgrading the runtime package, not the types.**

### P6 — build / dev

Determined from `devDependencies` — not in scope for runtime security
triage. Update opportunistically with each Expo / Vite release.

## 4. Recommended action plan

Each step below is a separate, individually-approved PR. None can
proceed without an explicit "approve PR-DEPSEC-N push" from CEO.

### Step 1 (this PR — done)
Write this triage doc. **No code change.**

### Step 2 — PR-DEPSEC-1: pull-and-categorize
Pull the real list of 72 alerts with the command in §1. Produce a
single table grouped by root-cause package, severity, and PetWash
priority tier. Commit the table as a static snapshot at
`docs/security/dependabot-alerts-snapshot-YYYY-MM-DD.md`.

**No package.json change in PR-DEPSEC-1.** Just the visibility doc.

### Step 3 — PR-DEPSEC-2: P0 fixes only
Fix every P0 alert in one focused PR. Likely 1–3 packages
(`bcrypt`, `jsonwebtoken`, `@simplewebauthn/*`). Each upgrade:
- Bump the patch / minor version (no major-version jumps in this PR).
- Run `tsc --noEmit` and the full test suite locally before push.
- Verify auth login + biometric refresh paths on a real device.
- Risk: HIGH. Auth-chain change. Requires extra review.

### Step 4 — PR-DEPSEC-3: P1 fixes
Fix every P1 alert. Same discipline. Test file-upload flow, CORS
behavior, XSS sanitizer behavior with the existing test corpus.

### Step 5 — PR-DEPSEC-4: P2 + P3 fixes
DB driver, Redis client, Google SDKs, Sentry. Risk: MEDIUM.

### Step 6 — PR-DEPSEC-5: P4 fixes (UI)
Radix and friends. Risk: LOW per dep. Largest PR by number of
packages but smallest by blast radius.

### Step 7 — PR-DEPSEC-6: P5/P6 sweep
Types and dev tools. Mostly a hygiene PR.

## 5. Do NOT do

- Do not bulk-run `npm audit fix` against `main`. It will upgrade
  things across multiple priority tiers in a single PR, violating
  the "one purpose per PR" rule and making rollback impossible.
- Do not jump major versions in a security-fix PR. If a security
  patch is only available in a major upgrade, that's a separate PR
  with its own approval.
- Do not commit `node_modules`. The lockfile is enough.
- Do not skip auth + payment regression tests after P0/P1 upgrades.

## 6. Open questions

- Some of the `@types/*` packages may have outlived their runtime
  packages (e.g., `@types/leaflet` listed but is Leaflet still used?).
  Sweep for unused deps in a separate PR before security fixes — every
  removed dep is one fewer vulnerability to triage.
- Confirm whether `firebase-admin` is in `package.json` (not visible
  in the first 80 lines I read); if so it's P0.
- Confirm whether `@docuseal/api` is in the supplier-agreement flow;
  if so, promote to P2.
- Verify whether the `Spotify` SDK is reachable from a production code
  path; if no, remove rather than upgrade.

## 7. Reference

- Platform rule: `petwash-platform §2` — "No new dependencies unless
  the user explicitly approves the package by name."
- Guardian rule: every dep change is a protected-system change that
  needs explicit approval per gate.
- Dependabot link:
  https://github.com/petwashglobal/petwash-marketplace/security/dependabot
