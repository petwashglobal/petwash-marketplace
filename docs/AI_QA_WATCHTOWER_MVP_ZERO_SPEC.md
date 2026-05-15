# AI QA Watchtower — MVP-Zero Specification (Read-Only Public Surface)

**Status:** Specification only. No code, no production change, no Firebase
change, no Tranzila change, no GitHub Secrets, no workflow, no AI traffic.
Spec approval gates the first code PR.
**Parent docs:**
- `docs/AI_QA_WATCHTOWER_PROPOSAL.md` (architecture)
- `docs/AI_QA_WATCHTOWER_MVP_SEQUENCING.md` (sequencing + decisions A–G)
- `docs/AI_QA_WATCHTOWER_PREFLIGHT_DISCOVERY.md` (pre-flight discovery)
**Purpose:** Deliver ~50% of Watchtower coverage in 1–2 days against the
public marketing surface only, with zero authentication, zero mutation,
zero PII risk. Runs in parallel to the staging-creation track. When
staging is ready, Watchtower expands to MVP-Full.
**Date stamped:** 2026-05-15.

---

## §0 TL;DR

MVP-Zero is a read-only, public-route-only QA layer. It opens a fresh
incognito browser, walks a fixed allowlist of public marketing routes,
captures evidence (screenshots, console logs, Lighthouse scores), runs
deterministic checks, and writes a daily report. **No auth. No mutation.
No PII. No AI calls in Phase 0.**

It is delivered as a single isolated folder `qa-watchtower/` at repo root
with its own `package.json` and its own `node_modules/`. Root
`package.json` is never touched. Production builds are never affected.

Phase 0 ships value in 1–2 days at $0 infrastructure cost. AI enablement
(Phase 1) is a separate, later, gated decision.

The five filters from CEO operating rule applied to this spec:
- **Better:** deterministic-first beats AI-first for false-positive control.
- **Cheaper:** $0 infra, no API costs in Phase 0.
- **Faster:** 1–2 days vs ~10 days for full MVP-with-staging.
- **Easier:** no Firebase, no staging, no secrets to authorize.
- **More luxurious:** the daily report becomes a CEO morning ritual that
  signals operational care.

---

## §1 Scope — what's in, what's out

### §1.1 IN scope

Read-only HTTP GET requests against public PetWash marketing routes:
- Crawl the route, render in a real browser (Playwright + WebKit for
  iPhone Safari fidelity).
- Capture screenshot at each of 3 viewports.
- Capture console logs + network responses + JS errors.
- Run Lighthouse (Chromium) for perf + accessibility scores.
- Apply deterministic checks (HTTP status, console errors, missing
  `lang` attributes, missing translation keys in rendered DOM, hardcoded
  English strings on Hebrew pages, hardcoded Hebrew strings on English
  pages).
- Diff screenshots against the prior night's baseline for visual
  regression flags.
- Scan rendered DOM text for trademark misuse + obviously risky words.
- Write a daily Markdown report.

### §1.2 OUT of scope

Locked by CEO:
- No authenticated journeys.
- No customer accounts.
- No provider accounts.
- No checkout.
- No booking creation.
- No eGift purchase.
- No admin routes.
- No Tranzila calls (sandbox or production).
- No Firebase sign-in.
- No production writes.
- No bot accounts.
- No real customer data.
- No AI traffic until spec is approved + Phase 1 separately authorized.

Additional MVP-Zero exclusions (clarified by this spec):
- No POST / PATCH / DELETE / PUT requests anywhere. GET only.
- No form submission. Forms can be rendered to check layout; submit
  buttons are never clicked.
- No localStorage / sessionStorage / cookie persistence between runs
  (every run starts in fresh incognito context).
- No Service Worker registration during the run.
- No following redirects that leave the petwash.co.il domain (e.g. no
  hopping to Tranzila checkout URLs even by accident).
- No download of any non-HTML/CSS/JS/IMG resource (no PDFs, no exports).

---

## §2 Exact public route allowlist

This is the **authoritative list**. The Watchtower allowlist is a JSON
file (`qa-watchtower/config/routes-allowlist.json`) — adding a route
requires a PR review, not a code edit at runtime. The list:

```
Marketing
  /
  /about
  /story
  /media
  /gallery
  /careers
  /contact
  /service-status

Platforms (public marketing pages, NOT logged-in dashboards)
  /hub
  /stations
  /sitter-suite
  /walk-my-pet
  /paw-finder
  /paw-finder/lost           (index listing, public)
  /egift                     (marketing hero only, NOT /egift/checkout)
  /shop                      (placeholder marketing page)
  /pettrek                   (placeholder marketing page)
  /academy                   (placeholder marketing page)

Auth landing pages (public — visit only, never submit)
  /welcome                   (rendering check only; no button clicks)
  /signin                    (rendering check only; no form submit)
  /signup                    (rendering check only; no form submit)

Legal
  /legal/privacy
  /legal/terms
  /legal/cookies
  /legal/accessibility
  /legal/marketplace-terms
  /legal/disclaimer
  /legal/egift-policy
  /legal/loyalty-terms
  /privacy                   (canonical alias)
  /terms                     (canonical alias)
  /accessibility             (canonical)

Partners / B2B marketing (public)
  /franchise                 (marketing only, NOT /franchise/dashboard)
  /partners/locations
  /partners/suppliers
  /partners/municipal

Loyalty marketing (public information pages)
  /loyalty                   (marketing only, NOT /loyalty/dashboard)
  /loyalty/tiers
  /loyalty/benefits
  /loyalty/birthday
  /loyalty/refer

Locale variants
  Every route above is also tested with ?lang=he and ?lang=en (or
  whatever locale-switching mechanism the app uses). Hebrew is the
  default fallback; English is the secondary check.

Total: ~36 distinct routes × 2 locales = ~72 page renders per nightly
run. Below the 2,000 min/month GitHub Actions free-tier ceiling.
```

**Route discovery process:** the allowlist was derived by inspecting
`client/src/App.tsx` and filtering to routes that:
1. Render without a `RequireAuth` / `RoleProtectedRoute` wrapper.
2. Do not begin with `/api/`, `/admin/`, `/p/`, `/staff/`, `/internal/`,
   `/pet-wash-ltd/executive/`.
3. Do not require URL parameters that bind to real user data (e.g.
   `/bookings/:id` is excluded because `:id` would need to be a real
   booking ID).
4. Are linked from at least one navigation surface (header, footer,
   hamburger, mobile-bottom-nav).

If a public route is missing from this list, that is a Phase 0 finding,
not a spec gap.

---

## §3 Exact forbidden routes

The Watchtower **must refuse** to make a request to any of these
patterns. Enforcement is a positive-allowlist (anything not in the
allowlist is forbidden), but the explicit forbidden list below
documents intent and serves as a fail-safe.

```
Authenticated customer surface
  /home                       (requires auth)
  /dashboard
  /bookings, /bookings/*
  /my/timeline, /my-account
  /account, /settings*
  /wallet, /my-wallet, /wallet/*
  /favourites
  /my-coupons
  /loyalty/join, /loyalty/dashboard, /loyalty/credits
  /referral, /refer
  /booking, /booking/*
  /egift/checkout, /egift/redeem/*, /gift/activate/*
  /buy-gift-card
  /receipt/*
  /complete-profile
  /onboarding/*
  /choose-role

Authenticated provider surface
  /provider/*, /p, /p/*
  /provider-os, /provider-onboarding
  /become-provider, /apply-provider, /join-team
  /sitter-suite/dashboard, /walk-my-pet/dashboard
  /pettrek/*
  /academy/dashboard

Authenticated staff / admin / executive surface
  /admin/*                    (60+ admin routes)
  /pet-wash-ltd/executive/*
  /staff/*
  /internal/*
  /franchise/dashboard, /franchise/inbox, /franchise/reports
  /company/dashboard
  /ops, /ops/*, /mobile-ops, /mobile/ops, /m, /s/*
  /case-queue
  /manager
  /governance
  /finance/*
  /audit-trail
  /control-panel
  /accounting
  /weather-planner (if it touches account data)
  /octopus-brain, /kenzo-ai, /live-chat
  /admin-paw-finder
  /admin/k9000-documents

Auth machinery (handles tokens — never touch)
  /auth/action
  /__/auth/action
  /verify-email
  /activate-account
  /__/firebase/*
  /__/auth/*

API / mutating endpoints
  /api/*
  /webauthn/*
  /uploads/*

External domains
  Any URL not on *.petwash.co.il / petwash.co.il
  Tranzila domains (even if linked from the page)
  Firebase project URLs
  GCP Console URLs
  Apple, Google, Facebook auth domains

Any URL containing query string keys: ?token=, ?code=, ?session=,
?key=, ?secret=, ?id=, ?bookingId=, ?userId=  (could leak through a
shared link if a real customer ever pastes one in our docs by mistake)
```

**Enforcement at three layers:**
1. Allowlist check before request dispatch.
2. URL pattern check inside Playwright `route()` interceptor.
3. Post-run audit: any captured artifact whose URL is not on the
   allowlist halts the run and alerts.

Three layers because one is not enough when the cost of a mistake is a
real customer's data appearing in an AI prompt.

---

## §4 Rate limits

Production-friendly traffic only. No hammering. Watchtower should be
indistinguishable from a single curious power user browsing the public
site once per day.

| Limit                                                  | Value                            | Rationale                                                                |
|--------------------------------------------------------|----------------------------------|--------------------------------------------------------------------------|
| Requests per route per run                              | 1                                | We're checking, not load-testing                                          |
| Total routes per run                                    | ≤ 80 (allowlist × 2 locales)    | Below 2,000 GHA min/mo budget                                            |
| Delay between requests                                  | 2 seconds                        | Polite. Mimics a real user's tab-switching cadence.                       |
| Runs per day                                            | 1 (nightly at 03:00 IDT)         | Sufficient for trend detection                                            |
| Max concurrent browsers                                 | 1                                | Sequential, never parallel against production                             |
| Total wall-clock per run                                | ≤ 15 minutes                     | Well below GHA timeout                                                    |
| User-Agent string                                       | `PetWash-Watchtower/0.1 (+QA)`   | Identifies bot; ops can filter from analytics                             |
| Custom request header                                   | `X-Watchtower-Signature: <hash>` | HMAC of date+route, lets server-side identify and rate-limit if needed   |
| Production failure response                              | Watchtower halts immediately      | If any request returns 429/503, abort the run                            |

**Origin transparency:** the Watchtower's User-Agent + signed header
means production analytics can filter Watchtower traffic out of real
user metrics. Eng lead can add a Cloud Run analytics rule on Phase 0
day 1 — separate, ~5 line change.

---

## §5 Evidence captured per route

For each route × viewport combination:

| Artifact                        | Format                  | Where stored                                | Retention |
|---------------------------------|-------------------------|---------------------------------------------|-----------|
| Full-page screenshot             | PNG                     | `qa-watchtower/artifacts/<run-id>/screenshots/` | 90 days   |
| Viewport screenshot               | PNG                     | same                                        | 90 days   |
| Page DOM HTML (rendered)         | HTML                    | same                                        | 14 days   |
| Page DOM text (extracted)        | plain text              | same                                        | 14 days   |
| Console messages                 | JSON array              | same                                        | 90 days   |
| Network responses                | JSON array (URL+status) | same                                        | 90 days   |
| JS exceptions                    | JSON array              | same                                        | 90 days   |
| Playwright trace                 | `.zip` (HAR + DOM + screenshots) | same                                  | 14 days   |
| Lighthouse JSON                  | JSON                    | `qa-watchtower/artifacts/<run-id>/lighthouse/` | 90 days   |

**No cookies stored.** Each route loads in a fresh incognito context.
**No localStorage / sessionStorage retained** between runs.

**No real customer data should appear in any of these artifacts** because:
- No authentication = no user-specific data rendered.
- Public routes = same content any anonymous visitor sees.
- No form submission = no echoes of typed input.

The post-run scan (§7) verifies this assumption holds.

---

## §6 Privacy boundary

The privacy boundary is **the line between PetWash's production and
anything outside it**.

**Inside the boundary (allowed):**
- Public marketing copy rendered to anonymous browsers.
- Static asset URLs (images, CSS, JS bundles).
- Public station listings, public lost-pet listings, public eGift hero
  copy.

**Outside the boundary (forbidden):**
- Any authenticated content.
- Any URL containing a user ID, booking ID, session token.
- Any redirect that leaves `*.petwash.co.il`.
- Any third-party widget that renders user-specific content (none on
  public pages today, but Watchtower checks for it).

**The boundary is enforced by three independent mechanisms:**

1. **Allowlist (§2)** — only listed routes can be requested.
2. **Forbidden list (§3)** — explicit deny patterns block accidents.
3. **Domain pin** — Playwright `route()` interceptor blocks any
   non-`petwash.co.il` navigation. If the browser tries to redirect off
   domain, the run aborts.

**A fourth mechanism is added in Phase 1 when AI is enabled:** every
artifact passes through `qa-watchtower/lib/redact.ts` before being read
by AI. In Phase 0 (no AI), the redactor still runs as a verification
pass — any match triggers a P0 incident even though no AI ingests the
data.

---

## §7 No-PII proof

**Pre-flight assertion** (runs before any screenshot capture):

```
For each route in allowlist:
  Issue a HEAD request.
  If response status >= 400: skip route, log finding.
  If response Set-Cookie header contains any cookie name matching
     /(session|auth|firebase|token|csrf)/i:
       HALT THE RUN. This means we accidentally hit an authenticated
       route or the route is unexpectedly setting auth cookies.
```

**Post-flight verification** (runs after all artifacts captured, before
report writes):

```
For each captured artifact (screenshots, DOM, console, network):
  Pass through redact.ts pattern matchers:
    - Israeli phone (+972 prefix or 05X-XXXXXXX format)
    - Email pattern
    - Israeli ID number (9 digits, Luhn-valid)
    - IBAN
    - JWT signature shape (three base64 segments)
    - Firebase ID token shape
    - Stripe / Tranzila token shape
  If any match:
    HALT THE REPORT.
    Tag run as "PII-LEAK-SUSPECTED".
    Alert eng lead.
    Do not commit a daily report.
    Manual triage required.
```

**Day 1 / Day 7 / Day 14 manual audits:**
- Eng lead spot-checks 10 random screenshots + 5 random DOM dumps.
- Confirms no real customer data appears.
- Signs off in `docs/qa-reports/PRIVACY_AUDIT_LOG.md`.

**Hard rule:** if a PII pattern ever matches in a Watchtower artifact,
the run halts. No exceptions. The Watchtower restarts only after eng
lead identifies the cause + the cause is fixed at source (i.e. the
production page that leaked PII).

---

## §8 GitHub Actions plan

### Phase 0a — local-only (first 3 runs)

Before any CI runs, eng lead executes the Watchtower locally:

```
cd qa-watchtower
npm install
npm run preflight       # tests redact.ts + allowlist + forbidden checks
npm run watchtower:run  # one full pass against production public surface
```

Inspect output in `qa-watchtower/artifacts/<run-id>/`. Manual privacy
audit. Iterate on triage rules. **No CI yet.**

### Phase 0b — `workflow_dispatch` only (next 3 runs)

Workflow file: `.github/workflows/qa-watchtower-mvp-zero-nightly.yml`

```yaml
name: AI QA Watchtower MVP-Zero (manual)

on:
  workflow_dispatch:      # MANUAL only - no cron yet

permissions:
  contents: read          # Daily report committed via separate PAT
  issues: write           # File P0/P1 findings
  pull-requests: write    # Comment only, NEVER merge

concurrency:
  group: watchtower-mvp-zero-${{ github.ref }}
  cancel-in-progress: false

jobs:
  preflight:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm --prefix qa-watchtower ci
      - run: npm --prefix qa-watchtower run preflight
      # If preflight fails (allowlist drift, forbidden hit, redactor
      # broken), this job fails and watchtower job never runs.

  watchtower:
    needs: preflight
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm --prefix qa-watchtower ci
      - run: npx --prefix qa-watchtower playwright install --with-deps webkit chromium
      - run: npm --prefix qa-watchtower run watchtower:run
        env:
          WATCHTOWER_TARGET_BASE_URL: https://petwash.co.il
          WATCHTOWER_AI_ENABLED: 'false'
      - uses: actions/upload-artifact@v4
        with:
          name: watchtower-artifacts-${{ github.run_id }}
          path: qa-watchtower/artifacts/
          retention-days: 14

  report:
    needs: watchtower
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: watchtower-artifacts-${{ github.run_id }}, path: qa-watchtower/artifacts/ }
      - run: npm --prefix qa-watchtower run render-report
      - run: node qa-watchtower/scripts/commit-daily-report.js
        env:
          GH_PAT: ${{ secrets.QA_REPORT_PAT }}
      - run: node qa-watchtower/scripts/file-issues.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Secrets used in Phase 0:**
- `QA_REPORT_PAT` — restricted PAT, can only modify
  `docs/qa-reports/*.md` on a protected branch.
- `GITHUB_TOKEN` — built-in, scoped to issues + PR comments only.

**No Firebase secrets. No Tranzila secrets. No Anthropic / Gemini
secrets in Phase 0.**

### Phase 0c — cron enabled (after 3 green manual runs)

A separate one-line PR adds:

```yaml
on:
  schedule:
    - cron: '0 1 * * *'   # 03:00 IDT
  workflow_dispatch:
```

Eng lead approves this PR. CEO is notified. Cron then runs nightly.

---

## §9 Playwright without touching root package

Confirmed by `docs/AI_QA_WATCHTOWER_PREFLIGHT_DISCOVERY.md` §1.4:

- Root `tsconfig.json` uses explicit include (`client/src/**/*`,
  `shared/**/*`, `server/**/*`). `qa-watchtower/` at repo root is
  auto-excluded.
- Vite `root: path.resolve(import.meta.dirname, "client")` — Vite never
  sees `qa-watchtower/`.
- No monorepo tooling (no npm/pnpm workspaces, no Nx, no Lerna).

**Implementation pattern:**

```
qa-watchtower/
  package.json              # own deps: @playwright/test, sharp, etc.
  package-lock.json         # own lock file
  node_modules/             # gitignored
  tsconfig.json             # extends nothing; standalone
  ...
```

Install: `npm --prefix qa-watchtower install`

Root `package.json` and `package-lock.json` are **never modified**.
Production builds (Vite + Cloud Run) are **unaffected**.

**Defensive belt-and-suspenders** (one-line additions per tsconfig):

```jsonc
// client/tsconfig.json
"exclude": [..., "qa-watchtower/**/*"]

// tsconfig.server.json
"exclude": [..., "qa-watchtower/**/*"]
```

These are not strictly needed today (the include lists already exclude
anything outside their explicit paths) but document intent and prevent
accidental future widening.

---

## §10 AI usage in MVP-Zero

**Phase 0: AI disabled. Deterministic only.**

```
WATCHTOWER_AI_ENABLED='false'   # default
```

What deterministic-only delivers:
- HTTP status check (200 / non-200)
- Console error / warning capture
- Network resource failure capture
- Missing translation keys (compare `client/src/i18n/he.json` against
  rendered DOM string literals)
- Hardcoded English strings on Hebrew pages (regex for ASCII-only
  substrings on `?lang=he` pages)
- Trademark misuse (regex for "Petwash", "PETWASH", "petwash" not
  followed by ™ in customer-facing copy)
- Obviously risky words (case-insensitive search for: `guaranteed`,
  `100%`, `ROI`, `passive income`, `risk-free`, `free forever`,
  `lifetime`, `instantly` — wordlist in
  `qa-watchtower/config/risky-words.json`)
- Lighthouse perf < target (LCP > 2.5s = finding)
- Lighthouse a11y < target (score < 90 = finding)
- Visual regression: pixel diff > 0.5% against prior baseline (no AI
  judgement on whether the diff is intentional — just flagged for human
  review)

What deterministic-only **misses** (and what AI would add in Phase 1):
- "This page looks cluttered / cheap / off-brand"
- "The hero image got smaller and worse on mobile"
- "This text in Hebrew sounds awkward / machine-translated"
- "The accessibility statement date is from 2024 — likely outdated"

**Phase 1 (Optional, separate authorization required):** add Claude
Sonnet 4.6 review of the daily report — read the deterministic findings,
add context, write a more readable summary. **Even Phase 1 does not
ingest screenshots** — text-only review of the deterministic JSON.

**Phase 2 (Visual luxury agent):** AI vision review of screenshots.
**Requires explicit CEO re-authorization.** Triggers full Agent 2
governance from the original proposal.

---

## §11 Rollout plan

| Step  | Title                                                      | Days | Authorization                | Reversible by                       |
|-------|------------------------------------------------------------|------|------------------------------|-------------------------------------|
| 0     | This spec merged                                            | 0    | Already proposed              | Revert merge commit                  |
| 1     | PR-Z1: scaffolding (`qa-watchtower/` folder, redact.ts, allowlist + forbidden config, tests for both) | 1 | CEO ok-after-spec-approved | Revert single PR |
| 2     | PR-Z2: 5 Playwright journeys (deterministic only, no AI), local run only | 1 | CEO ok-after-Z1-green     | Revert single PR                     |
| 3     | Manual local runs (3×) by eng lead, manual PII audit       | 0.5  | Internal eng                  | Stop running                         |
| 4     | PR-Z3: GitHub Actions workflow (`workflow_dispatch` only)   | 0.5  | CEO ok-after-local-stable     | Revert single PR                     |
| 5     | Manual GHA runs (3×), verify report committed to repo correctly | 0.5 | Internal eng              | Stop dispatching                     |
| 6     | PR-Z4: enable cron (one-line PR)                            | 0.1  | CEO ok                        | Revert single PR                     |
| 7     | Stabilization window (7 days, no PRs)                       | 7    | None — observation only       | Pause cron via env var               |
| 8     | Phase 1 decision: add AI text review layer?                 | 0.5  | CEO re-authorization needed   | Stay on deterministic-only forever   |
| 9     | Phase 2 decision: enable visual luxury agent (vision)?      | —    | CEO re-authorization needed   | Stay on Phase 1                       |

**Sequential time: ~4 working days from spec approval to nightly cron
enabled.** Plus 7-day stabilization. Total ~12 calendar days to a
stable Phase 0.

---

## §12 Rollback plan

Each PR is independently revertible. None depends on the previous to
be deployed. None modifies production code.

| Revert action                              | Effect                                                          |
|--------------------------------------------|------------------------------------------------------------------|
| Revert PR-Z1                                | `qa-watchtower/` folder removed. Production unaffected (it was never linked). |
| Revert PR-Z2                                | Playwright journeys removed. Folder remains empty. Production unaffected. |
| Revert PR-Z3                                | Workflow file deleted. Cron not enabled. No artifacts produced. |
| Revert PR-Z4                                | Cron disabled. `workflow_dispatch` still works for manual runs. |
| Set `WATCHTOWER_ENABLED=false` env var      | Workflow short-circuits before any external call. Single env var flip. |
| Delete `.github/workflows/qa-watchtower-mvp-zero-nightly.yml` | All scheduled runs cease immediately. |
| Halt cron, halt manual dispatch              | One UI click in GitHub Actions settings.                        |

**The Watchtower has zero production state.** All artifacts live in
GitHub Actions artifact storage + `docs/qa-reports/*.md` files. Reverting
removes the artifact production machinery; the historical reports
remain as docs (or can be deleted manually).

**There is no way for MVP-Zero to break production.** It is a separate
folder, separate package, separate workflow, read-only HTTP GET only,
allowlisted domains only, no auth, no mutation. If it disappears, the
PetWash production app is unchanged.

---

## §13 What remains blocked until staging exists

These are intentionally deferred to MVP-Full and stay blocked until
G1 + G2 confirm staging:

- Authenticated journeys (signin completion, /home, account, dashboard)
- Synthetic bot account creation + management
- Booking creation, cancellation, modification flow tests
- eGift purchase + redemption flow tests
- Onboarding step-by-step verification (steps require auth)
- Provider dashboard flow tests (auth + role)
- Admin access anomaly detection (requires auth attempt + role probing)
- Apple / Google OAuth flow tests
- Any test that writes to a database
- Anything touching Tranzila (even sandbox)
- Anything requiring Firebase Auth sign-in
- RBAC / admin role behavior checks
- Push notification delivery checks
- Wallet pass generation tests

**These are the highest-value coverage categories.** MVP-Zero covers
~50% of the originally-scoped Watchtower surface. The other 50% lights
up when staging is built (separate parallel track — see §14).

---

## §14 Parallel staging-creation track (separate spec)

The CEO will manually confirm G1 + G2 (per discovery doc §3 +
executive-answer Q3 GATE checks). Three outcomes:

- **G1 = YES, G2 = YES** → MVP-Full unblocks. PR-W2 from the original
  sequencing plan starts. MVP-Zero continues running in parallel
  (different scope, no overlap, no conflict).
- **G1 = NO, G2 = NO** → staging-creation mini-spec drafted (separate
  PR, separate doc — `docs/STAGING_CREATION_SPEC.md` or similar). The
  CEO reviews + approves. Eng lead executes. Meanwhile MVP-Zero is
  delivering value.
- **Mixed** → targeted patch list for only the missing pieces.

**The two tracks (MVP-Zero + staging creation) do not block each
other.** MVP-Zero ships first because it is cheaper, faster, and
unblocks immediate value. Staging creation runs as its own infra
project on its own timeline.

---

## §15 The 5-filter check (CEO operating rule applied)

| Filter                  | MVP-Zero answer                                                                                              |
|-------------------------|--------------------------------------------------------------------------------------------------------------|
| Better?                 | Yes — deterministic-first beats AI-first for false-positive control. Each finding has a reproducible cause.   |
| Cheaper?                | Yes — $0 infrastructure, $0 API costs in Phase 0. Free tier GHA only.                                       |
| Faster?                 | Yes — 1–2 days vs ~10 days for full MVP-with-staging.                                                       |
| Easier?                 | Yes — no Firebase, no staging, no secrets to authorize, no bot account creation, no DNS work.               |
| More luxurious?         | Indirect — the daily report becomes a CEO morning ritual; gives the company "we obsess about quality" signal that customers notice without being told. The grandmother in §the-mission-anchor sees a website that just works on her iPad. |

**The honest miss:** MVP-Zero doesn't catch auth loops, doesn't catch
checkout double-charge bugs, doesn't catch onboarding stuck states.
Those are real risks. Staging plus MVP-Full closes them. The smart play
is parallel tracks — not "wait 10 days for nothing."

---

## §16 What this PR does NOT do

- No code changes.
- No new dependencies (not even to `qa-watchtower/` yet).
- No schema migrations.
- No CI workflow files committed.
- No GitHub Secrets added.
- No production changes.
- No Firebase / GCP / DNS / Tranzila changes.
- No bot accounts created.
- No external API calls.
- No AI traffic.
- No file outside `docs/`.

Implementation gated on CEO approval of this spec.

---

## §17 References

- `docs/AI_QA_WATCHTOWER_PROPOSAL.md` — architecture.
- `docs/AI_QA_WATCHTOWER_MVP_SEQUENCING.md` — sequencing + decisions A–G.
- `docs/AI_QA_WATCHTOWER_PREFLIGHT_DISCOVERY.md` — pre-flight discovery.
- `.claude/skills/petwash-platform/SKILL.md` — platform conventions
  inherited by Watchtower (§3 AI governance, §2 protected systems).
- `client/src/App.tsx` — source of truth for route allowlist derivation
  (manual inspection at draft time).

---

**End of MVP-Zero specification.** No code ships from this PR.
Implementation gated on CEO spec approval. Eng lead's first action is
PR-Z1 (scaffolding only) once approval lands.
