# AI QA Watchtower — Architecture Proposal

**Status:** Pure planning. No code, no dependencies, no schema, no CI changes
ship from this PR.
**Mission:** Add an AI-assisted, second-layer QA workstream to the PetWash
rebuild plan. Continuous synthetic monitoring of production quality, bugs,
broken flows, mobile UX, and stuck states. AI is the **reviewer**, never the
**actor**.
**Audience:** CEO + engineering. Decisions in §13 gate the MVP.
**Date stamped:** 2026-05-15.

---

## §0 TL;DR

PetWash already has the right AI governance posture for this: per platform
skill §3, Gemini and Coworker agents are **analysts, never executives**.
Output is advisory, every consequential change requires a human click that
writes the audit log, output objects carry `wired/fallback/generatedAt/
ttlSeconds`. The AI QA Watchtower extends that same pattern outward — from
"summarize what's happening on the platform" to "watch the customer-facing
product and report what's broken before the customer does."

**Three principles** drive the design:

1. **AI does not run the browser. Playwright does.** Playwright is
   deterministic, cheap, and produces evidence (screenshots, console logs,
   network traces, perf scores). AI only **reviews** that evidence. This
   keeps cost predictable and prevents AI hallucinations from masquerading
   as test failures.
2. **AI never sees real customer data.** Watchtower journeys run as
   dedicated synthetic accounts (`qa-bot-1@petwash.co.il` …
   `qa-bot-5@petwash.co.il`) against a staging mirror. Production read-only
   probes scrape only public marketing routes. No PII ever leaves the
   PetWash perimeter.
3. **AI proposes, humans dispose.** Every finding lands as a GitHub issue
   or a draft PR comment. No auto-merge. No production write. No payment /
   VAT / legal / wallet / K9000 / Nayax / Tranzila changes by AI under any
   circumstances. Same sacred boundaries as platform skill §2.

**Recommended stack** — best mix by cost-effectiveness, no vendor lock-in:

| Layer                        | Tool                                  | Why                                                  |
|------------------------------|---------------------------------------|------------------------------------------------------|
| Browser automation           | **Playwright**                        | OSS, multi-browser (Chromium, WebKit, Firefox), iPhone Safari emulation via WebKit |
| Performance / a11y baseline  | **Lighthouse CI**                     | Google-maintained, free, Core Web Vitals + WCAG     |
| Runtime error capture (prod) | **Sentry** (free tier first)          | Already a credible default; 5K events/mo free       |
| Pixel-diff visual regression | **Argos CI** or **Playwright snapshots** | OSS-friendly; commits a baseline, diffs new screenshots |
| AI reasoning + report writing| **Claude Sonnet 4.6** (vision)        | Best at nuance, "luxury feel," and Hebrew + RTL     |
| High-volume cheap screening  | **Gemini 2.5 Flash** (optional)       | ~40× cheaper than Claude — first pass triage         |
| Orchestration                | **GitHub Actions**                    | Already in the repo's CI plane; 2,000 min/mo free   |
| Issue / PR creation          | **GitHub MCP**                        | Already wired to this agent surface                 |

**Estimated cost** for the MVP scope (1 nightly run, 6 customer routes,
3 viewports): **$0–$30/month**. Full ambition (5 agents, 30+ flows, hourly
canary runs, full pixel-diff): **$80–$150/month**. Both well inside the
"add a CTO-level QA function" benchmark.

**MVP ship time** if Decisions A–G in §13 land this week: **5 working days**
to a first daily report in the CEO inbox.

---

## §1 Context — what already exists at PetWash

This is not greenfield. The platform already has:

| Component                                | Where                                                            | What it does                                                 |
|------------------------------------------|------------------------------------------------------------------|--------------------------------------------------------------|
| Gemini client                            | `server/lib/gemini-client.ts`                                    | Server-side Gemini API wrapper with rate limit + cache       |
| Coworker Agent Service                   | `server/services/coworker/CoworkerAgentService.ts`               | 6-family advisory AI scaffold, parked in PR-20               |
| Octopus Brain                            | `server/routes/admin-brain.ts`, `OctopusBrainService`            | CEO read-only operations brain                               |
| Brain access gate                        | `requireBrainAccess` middleware                                  | Restricts brain dashboard to CEO + super_admin               |
| Gemini Watchdog page                     | `/admin/gemini-watchdog`                                         | Anomaly surfacing UI                                         |
| AI guardrails (platform skill §3)        | `.claude/skills/petwash-platform/SKILL.md`                       | Hard rules: AI advises, humans decide                        |
| AI output envelope                       | `{ wired, fallback, generatedAt, ttlSeconds, ... }`              | Standard shape for every AI surface                          |
| Snapshot cache (60s default)             | Pattern enforced across AI surfaces                              | Bounds cost + rate-limit pressure                            |
| Deterministic fallback                   | SQL-driven summary with `fallback: true`                         | Never block admin paths on Gemini availability               |

**The Watchtower must inherit every one of these properties.** It is not
a new AI system — it is a new **consumer** of the existing governance.

PR-20 (`claude/pr-20-coworker-scaffold`, commit `971c98b78`, awaiting push
approval per SKILL.md §7) introduces 6 advisory AI families. Watchtower
becomes the **7th** family — `quality-assurance` — and lives under the
same `requireBrainAccess` gate.

---

## §2 What the AI QA Watchtower monitors

User's 14 categories, mapped to detection mechanism and example finding:

| #  | Category                          | Detection mechanism                                      | Example finding                                                  |
|----|-----------------------------------|----------------------------------------------------------|------------------------------------------------------------------|
| 1  | Broken links                      | Playwright crawl + HTTP HEAD on every `<a href>`         | "/legacy-station-list returns 404 from hamburger LEGAL section"  |
| 2  | Auth loops                        | Playwright journey: signin → expected /home, count redirects | "Email signin redirects 3× before settling — average 2.4s delay" |
| 3  | Onboarding stuck states           | Playwright run through /onboarding/* with synthetic account | "Step 3 (pets) submit button disabled for 800ms after typing"  |
| 4  | iPhone/iPad layout issues         | WebKit viewport `iPhone 15 Pro` + `iPad Pro 11"`         | "Hamburger close button overlaps Dynamic Island at top:0"        |
| 5  | RTL/Hebrew issues                 | Run every journey twice: `?lang=he` and `?lang=en`       | "Drawer slides from right in Hebrew — should slide from left"    |
| 6  | Checkout / eGift flow issues      | Playwright synthetic eGift purchase with Tranzila sandbox | "eGift checkout 'Pay' button has no loading state — double-click sends 2 charges" |
| 7  | Booking flow issues               | Playwright booking → completed, against sandbox provider | "Provider selection page renders empty if user has no city set"  |
| 8  | Admin access anomalies            | Probe `/admin/*` URLs as non-admin synthetic account     | "/admin/brain loads JS chunk before role check — 240KB shipped"  |
| 9  | Missing translations              | Diff `client/src/i18n/he.json` vs `en.json` for missing keys + scan rendered DOM for `t('untranslated.key')` literals | "12 keys missing in he.json under `onboarding.provider.*`"       |
| 10 | Visual regressions                | Argos / Playwright snapshot diff vs `main` baseline      | "Welcome page Apple button moved 8px right — likely unintended"  |
| 11 | Dead buttons                      | Playwright: click every `<button>` and verify a network call, navigation, or DOM change | "Wallet 'Manage' button has no onClick handler"                  |
| 12 | 404 / 500 / 503 errors            | Capture all responses during journey, flag non-2xx       | "POST /api/account/upsert returns 500 when DOB is empty string"  |
| 13 | Slow pages                        | Lighthouse CI — TTI > 2.5s, LCP > 2.5s flagged           | "/booking has LCP of 4.1s on Slow 4G — 2.5s budget breached"     |
| 14 | Mobile overflow / cropping        | Playwright + AI vision: screenshot, check `scrollWidth > clientWidth` and render review | "PawFinder lost-pet card overflows 12px right on iPhone SE"      |

**Detection split:** rows 1, 2, 8, 9, 11, 12, 13 are **deterministic** —
Playwright + Lighthouse alone catch them, no AI needed. Rows 3, 4, 5, 6, 7,
10, 14 benefit from AI vision review on top of deterministic data. AI is
the **interpretation layer**, not the eyes.

---

## §3 How it works — operational architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  GitHub Actions scheduled workflow (nightly 03:00 IDT)             │
│  .github/workflows/ai-qa-watchtower-nightly.yml                    │
│  - checks out main                                                 │
│  - installs Playwright + Lighthouse                                │
│  - reads secrets: QA_BOT_EMAIL, QA_BOT_PASSWORD,                   │
│                   CLAUDE_API_KEY, GEMINI_API_KEY (optional),       │
│                   STAGING_BASE_URL                                 │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  Playwright runner                                                 │
│  - 5 synthetic accounts (qa-bot-1..5@petwash.co.il)                │
│  - 3 viewports: iPhone 15 Pro (390×844), iPad (820×1180), Desktop  │
│    (1440×900)                                                      │
│  - 2 locales: he, en                                               │
│  - executes ~30 journeys (see §4 by agent)                         │
│  - captures: screenshots, console logs, network responses, perf    │
│  - writes to artifacts/ directory                                  │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  Lighthouse CI on the same 30 routes                               │
│  - emits Core Web Vitals + a11y + best-practice scores             │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  Deterministic triage (no AI yet)                                  │
│  - non-2xx response → P1                                           │
│  - console error → P1                                              │
│  - LCP > 2.5s → P2                                                 │
│  - missing i18n key → P3                                           │
│  - pixel diff > 0.5% → P2 (flagged for AI vision review)           │
│  Output: triaged-findings.json                                     │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  AI review layer (per agent — see §4)                              │
│  - reads triaged-findings.json + relevant screenshots              │
│  - generates daily report Markdown + per-finding analysis          │
│  - DOES NOT modify code, DOES NOT auto-create PRs                  │
│  - DOES create GitHub issues with severity + screenshots attached  │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  Output                                                            │
│  - GitHub issue per P0/P1 finding (deduped against open issues)    │
│  - Daily Markdown report committed to docs/qa-reports/YYYY-MM-DD.md│
│  - Email to CEO + eng lead at 09:00 IDT with one-page summary      │
│  - Posted to Brain Dashboard `/admin/brain` under "QA Watchtower"  │
└────────────────────────────────────────────────────────────────────┘
```

**What never happens in this pipeline:**
- AI writes code into the repo.
- AI auto-merges a PR.
- AI calls a production API.
- AI sees real customer PII.
- Production state changes.

---

## §4 Five-agent structure

Each agent owns a slice. They run as independent Claude API calls with
distinct system prompts, distinct evidence packages, and distinct output
schemas. Costs in §6 are per agent.

### Agent 1 — Primary Engineering Agent
**Role:** triage all deterministic findings (HTTP errors, console errors,
broken links, Lighthouse score breaches, missing i18n keys). Decides
severity. Writes the day's top-line report.

**Evidence:** `triaged-findings.json` + a list of pages-affected counts.

**Output:**
- `docs/qa-reports/YYYY-MM-DD.md` daily report (template in §10).
- GitHub issues for every P0 + P1 finding, deduped against existing
  `qa-watchtower` labeled issues.

**Model:** Claude Sonnet 4.6 — strong reasoning, structured output.

**Cost driver:** ~5K input tokens per finding (logs + 1 screenshot), ~1K
output tokens. At 30 findings/day → ~180K tokens → **~$0.80/day**.

### Agent 2 — Visual Luxury QA Agent
**Role:** review screenshots of the 6 highest-revenue customer routes
(`/`, `/welcome`, `/signin`, `/signup`, `/home`, `/booking`) against the
PetWash design language: pure white backgrounds, generous whitespace, no
clutter, premium feel. Flags visual regressions and "this looks cheap"
states.

**Evidence:** 6 routes × 3 viewports × 2 locales = 36 screenshots per run.
Plus the previous run's baseline for diff context.

**Output:** GitHub issues for any screenshot scoring below the luxury
threshold (defined as a 4-point rubric: whitespace / typography hierarchy /
color discipline / no clutter). Each issue includes side-by-side baseline
+ current.

**Model:** Claude Sonnet 4.6 with vision. Gemini 2.5 Flash for cheap
pre-screening (skip Claude if Flash says "no change since baseline").

**Cost driver:** 36 images per day × ~2K image tokens each ≈ 72K tokens
input + 30K output → **~$0.55/day**.

### Agent 3 — Mobile Safari QA Agent
**Role:** review iPhone Safari journeys specifically for 100dvh handling,
safe-area-inset compliance, touch-target sizing, scroll behavior, drawer
slide direction (RTL safety), and Dynamic Island occlusion.

**Evidence:** Playwright WebKit traces from iPhone 15 Pro viewport, with
video recordings of every journey + DOM snapshots at each step.

**Output:** GitHub issues for layout breaks specific to mobile Safari.
Tagged `mobile-safari`, `ios`.

**Model:** Claude Sonnet 4.6 with vision (Gemini cannot review video).

**Cost driver:** 10 journeys × 5 frames each = 50 images/day → **~$0.45/day**.

### Agent 4 — Legal / Compliance Copy Risk Agent
**Role:** scan rendered DOM text against four risk categories:
- Misleading claims (e.g. "guaranteed," "100%," "free forever" outside
  legitimate use)
- Israeli consumer protection law triggers (price advertising rules, VAT
  display, refund language)
- Accessibility statement currency (date, scope)
- Trademark / brand misuse (always "PetWash™", never "Petwash" or
  "PETWASH")

**Evidence:** Plain-text DOM dumps from 30 routes, both locales.

**Output:** Weekly summary (not daily — copy doesn't change daily). Posts
to a `qa-watchtower-copy` GitHub issue thread.

**Model:** Claude Sonnet 4.6 — text only, no vision needed.

**Cost driver:** ~50K input tokens weekly → **~$0.15/week → $0.02/day amortized**.

### Agent 5 — Booking / Onboarding Flow Agent
**Role:** run end-to-end synthetic booking + onboarding journeys against
staging. Verify state transitions: onboarding/name → intent → done; eGift
purchase → wallet credit; booking → confirmed → in-progress → completed.

**Evidence:** Playwright trace + assertion log + server-side audit log
inspection (read-only via existing `/api/admin/audit/recent` endpoint).

**Output:** P0 GitHub issue if any state transition fails. Trends report
weekly showing time-per-step distribution.

**Model:** Claude Sonnet 4.6 — for the flow narrative + trend analysis.

**Cost driver:** ~80K tokens/day across 5 flows → **~$0.60/day**.

**Total daily AI cost across 5 agents:** ~**$2.40/day = ~$72/month** at
Claude Sonnet 4.6 list pricing, or **~$36/month** if Gemini Flash handles
the pre-screen on Agent 2 (visual regressions where pixel-diff is small).

---

## §5 Tool mix — comparison and recommendation

### Browser automation: Playwright (no debate)

| Tool                | Pro                                       | Con                                      | Verdict        |
|---------------------|-------------------------------------------|------------------------------------------|----------------|
| **Playwright**      | OSS, three engines (Chromium/WebKit/FF), iPhone Safari via WebKit, video record, network trace, parallel | Steeper learning curve than Cypress      | **Recommended**|
| Cypress             | Best DX, easy assertions                  | Chromium-only (no Safari engine), slower | No             |
| Puppeteer           | Lightweight                               | Chromium-only, less feature-rich          | No             |
| Selenium            | Multi-language                            | Slower, flakier, older API               | No             |

**Why Playwright wins:** the **only** OSS tool that runs real WebKit
(iPhone Safari engine). PetWash UX is iPhone-Safari-first per platform
skill §2 — we cannot QA in Chromium alone.

### Performance / a11y baseline: Lighthouse CI

| Tool             | Pro                                  | Con                                | Verdict     |
|------------------|--------------------------------------|-------------------------------------|-------------|
| **Lighthouse CI**| Google-maintained, Core Web Vitals, free | Chromium only — not iPhone Safari | **Recommended** for perf+a11y only |
| WebPageTest      | Real device labs, more accurate      | Paid for private projects           | Phase 2     |
| SpeedCurve       | Continuous monitoring + RUM          | $149/mo minimum                     | Phase 3     |

**Why Lighthouse:** good-enough baseline at zero cost. Real-device perf
testing on actual iPhones via WebPageTest can be added in Phase 2.

### AI vision + reasoning: Claude (primary) + Gemini Flash (optional)

| Tool                  | Pro                                                | Con                                | Cost / 1M tokens      |
|-----------------------|----------------------------------------------------|-------------------------------------|------------------------|
| **Claude Sonnet 4.6** | Best at nuance, "luxury feel," Hebrew + RTL, structured output | $$$                                | $3 in / $15 out / ~$4 vision |
| **Claude Opus 4.7**   | Best reasoning, expensive                          | $$$$$                              | $15 in / $75 out      |
| **Gemini 2.5 Flash**  | Cheap, fast, vision, 1M context                    | Less nuanced; sometimes too brief  | $0.075 in / $0.30 out |
| Gemini 2.5 Pro        | Better than Flash, still cheaper than Sonnet       | Less precise on visual nuance      | $1.25 in / $5 out     |
| GPT-4o vision         | Decent vision, popular                             | No advantage over Claude here, more drift | Not recommended |

**Why Claude as primary:**
- Already governed under platform skill §3 (the AI rules apply identically).
- Vision quality on screenshots is the best of the three.
- Strong Hebrew + RTL nuance — Israeli market matters.
- Structured output (JSON schema enforcement) is rock-solid.

**Why Gemini Flash as optional secondary:**
- At 40× cheaper than Sonnet, makes high-volume pre-screening practical
  for Agent 2 (visual regressions): "did anything visible change since
  yesterday's baseline?" — if no, skip the expensive Claude review.
- Useful for cost discipline at scale (1,000+ screenshots/day).

**No vendor lock-in:** Watchtower uses a thin wrapper
`ai-qa-watchtower/lib/ai-client.ts` (Phase 1 of MVP) that takes a
`model: 'claude-sonnet' | 'gemini-flash' | 'gemini-pro' | 'claude-opus'`
parameter. Swap providers in one file if pricing or quality shifts.

### Visual regression: Argos CI or Playwright snapshots

| Tool                       | Pro                                            | Con                                   | Cost       |
|----------------------------|------------------------------------------------|----------------------------------------|------------|
| **Playwright snapshots**   | Built-in, OSS, committed to repo               | Diff UI is plain text only            | Free       |
| **Argos CI**               | Beautiful diff UI, GitHub PR comments, OSS-friendly | Hosted SaaS                       | $0 OSS / $19 Team / $79 Pro |
| Percy                      | Industry standard                              | Costly, enterprise-focused             | $149+/mo   |
| Chromatic                  | Storybook integration                           | Storybook-centric, we don't use it    | n/a        |

**Recommendation:** start with **Playwright snapshots** in MVP (free), move
to **Argos** in Phase 2 if the diff UX becomes a bottleneck.

### Runtime error capture (production)

| Tool                  | Pro                                  | Con                                | Cost                 |
|-----------------------|--------------------------------------|-------------------------------------|----------------------|
| **Sentry**            | Industry standard, JS + server SDK   | Free tier capped at 5K events/mo    | Free → $26/mo Team   |
| Datadog               | Best monitoring overall              | Overkill at this stage              | $$$                  |
| New Relic             | Strong APM                           | Java-leaning, less JS-focused        | $$                   |
| Honeycomb             | Distributed tracing                  | Specialist tool                      | $$                   |

**Recommendation:** **Sentry free tier** is enough until traffic justifies
the upgrade. Sentry feeds the Watchtower with **real user errors** as a
complement to **synthetic** Playwright runs — both perspectives matter.

### Orchestration: GitHub Actions (no debate)

Already where the repo lives. 2,000 minutes/month free on private repos.
The Watchtower nightly run is ~25 minutes — fits comfortably.

---

## §6 Cost estimate

### MVP (Phase 1 — see §11)

| Line item                                         | Monthly cost    |
|---------------------------------------------------|------------------|
| GitHub Actions (1 nightly run × ~25 min)          | $0 (free tier)   |
| Playwright                                        | $0 (OSS)         |
| Lighthouse CI                                     | $0 (OSS)         |
| Sentry free tier                                  | $0               |
| Claude Sonnet 4.6 (Agent 1 + Agent 5 only, MVP)   | ~$25             |
| Gemini 2.5 Flash (pre-screen, optional)           | ~$3              |
| Argos CI free tier (visual diff)                  | $0               |
| **MVP total**                                     | **~$28/month**   |

### Full ambition (Phase 4 — all 5 agents, hourly canary, full pixel-diff)

| Line item                                         | Monthly cost    |
|---------------------------------------------------|------------------|
| GitHub Actions (extra runner minutes)             | ~$10             |
| Claude Sonnet 4.6 (all 5 agents, hourly)          | ~$95             |
| Gemini 2.5 Flash (pre-screen, full deployment)    | ~$15             |
| Sentry Team plan                                  | $26              |
| Argos CI Team                                     | $19              |
| **Full ambition total**                           | **~$165/month**  |

For comparison, a single junior QA engineer is **₪15,000–22,000/month**
(~$4,000–6,000) in Tel Aviv. The Watchtower at peak ambition costs **less
than 5% of one human QA salary** and runs every night, in two languages,
on every device, without complaint. It does not replace a senior QA
engineer — it gives one leverage.

---

## §7 Privacy risks + mitigations

| Risk                                                          | Mitigation                                                                 |
|---------------------------------------------------------------|----------------------------------------------------------------------------|
| Real customer PII in Watchtower screenshots                   | Synthetic accounts only (`qa-bot-1@petwash.co.il` …). No bot ever logs in as a real user. |
| Production database mutations from synthetic accounts         | All journeys run against **staging mirror**, not production. Mutating routes (`/api/bookings`, `/api/checkout`) are blocked at the firewall for the bot user agent. |
| Customer data in console logs sent to AI                      | Console log capture **redacts** values matching the patterns: `+972*`, `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+`, Israeli ID (9 digits), IBAN, JWT tokens, Firebase ID tokens. Performed in `lib/redact.ts` before AI ever sees a line. |
| Production read-only probes capturing private routes          | Probes restricted to a hard-coded allowlist of **public** routes. Authenticated routes only run on staging. |
| AI provider sees Hebrew customer-facing copy                  | Acceptable — public copy is already public. Watchtower never sees private content. |
| AI provider retains screenshots for model training            | Claude API: data not used for training when accessed via API (per Anthropic policy). Gemini API: same policy. **Both confirmed before MVP ships.** Document the link to each provider's policy in the GitHub Actions workflow comment. |
| Israeli Privacy Protection Law (Section 23B) re: data export  | Synthetic data is not personal data. Real PII never leaves PetWash perimeter. Counsel sign-off documented in `docs/qa-reports/PRIVACY_REVIEW.md` (created in Phase 1). |
| Watchtower bot accounts compromised                           | Bot account credentials stored in GitHub Secrets, rotated quarterly, restricted to `staging.petwash.co.il` domain. Cannot authenticate against production. |

**Hard rule (matches platform skill §2 security section):** no Watchtower
artifact (screenshot, log, trace, AI report) ever contains real customer
data. If a leak ever happens, that's a P0 incident and the Watchtower
shuts off until reviewed.

---

## §8 Safety rules — hardcoded

Inherits platform skill §2 + §3 wholesale. Codified here for the
Watchtower specifically:

1. **AI agents AUDIT and REPORT.** Output is markdown or JSON-described
   findings.
2. **AI agents CANNOT auto-merge.** No agent has a GitHub token with
   `pull_requests: write` for the merge action. Comment + label only.
3. **AI agents CANNOT change production state.** No production API key
   in any Watchtower secret. Mutating production endpoints are blocked at
   the staging proxy.
4. **AI agents CANNOT touch payment / VAT / legal / wallet / K9000 /
   Nayax / Tranzila logic.** A finding in any of these domains is
   automatically downgraded to **information only** — issue is created
   with label `requires-human-investigation`, never with a PR proposal.
5. **Every finding becomes a GitHub issue or a draft PR comment.** Never
   a direct commit. Never a direct merge.
6. **AI agent failures (timeouts, schema violations, vision errors) fall
   back to the deterministic finding.** Matches platform skill §3:
   "Never block a critical admin path on Gemini availability." A Sentry
   alert is enough — the AI summary is the cherry, not the cake.
7. **Synthetic test data only.** No real customer is ever the subject of
   a Watchtower test. No real provider. No real booking. No real eGift.
8. **Output objects carry `wired/fallback/generatedAt/ttlSeconds`** —
   same envelope as every other AI surface at PetWash. The Brain
   Dashboard QA panel respects these flags and shows clearly when a
   finding is a deterministic fallback vs an AI summary.

---

## §9 GitHub Actions integration

Proposed workflow file (drafted here, NOT committed in this PR):

```yaml
# .github/workflows/ai-qa-watchtower-nightly.yml
name: AI QA Watchtower (nightly)

on:
  schedule:
    - cron: '0 1 * * *'   # 03:00 IDT
  workflow_dispatch:       # manual trigger for testing

permissions:
  contents: read           # commit daily reports via separate PAT step
  issues: write            # create QA findings
  pull-requests: write     # comment on PRs only
  # NO contents: write    --- workflow cannot push to main directly

concurrency:
  group: watchtower-${{ github.ref }}
  cancel-in-progress: false

jobs:
  playwright:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install --with-deps webkit chromium
      - run: npx playwright test --config=qa-watchtower/playwright.config.ts
        env:
          STAGING_BASE_URL: ${{ secrets.STAGING_BASE_URL }}
          QA_BOT_EMAIL: ${{ secrets.QA_BOT_EMAIL }}
          QA_BOT_PASSWORD: ${{ secrets.QA_BOT_PASSWORD }}
      - uses: actions/upload-artifact@v4
        with:
          name: playwright-artifacts
          path: qa-watchtower/artifacts/
          retention-days: 7

  lighthouse:
    runs-on: ubuntu-latest
    needs: playwright
    steps:
      - uses: actions/checkout@v4
      - run: npx @lhci/cli autorun --config=qa-watchtower/lighthouserc.json
      - uses: actions/upload-artifact@v4
        with: { name: lighthouse-reports, path: .lighthouseci/ }

  ai-review:
    runs-on: ubuntu-latest
    needs: [playwright, lighthouse]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { path: qa-watchtower/artifacts/ }
      - run: node qa-watchtower/scripts/triage.js
      - run: node qa-watchtower/scripts/ai-review.js
        env:
          CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
      - run: node qa-watchtower/scripts/file-issues.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: node qa-watchtower/scripts/commit-daily-report.js
        env:
          GH_PAT: ${{ secrets.QA_REPORT_PAT }}

  summary:
    runs-on: ubuntu-latest
    needs: ai-review
    if: always()
    steps:
      - run: node qa-watchtower/scripts/send-summary-email.js
        env:
          SENDGRID_API_KEY: ${{ secrets.SENDGRID_API_KEY }}
          CEO_EMAIL: ${{ secrets.CEO_EMAIL }}
          ENG_LEAD_EMAIL: ${{ secrets.ENG_LEAD_EMAIL }}
```

**Notes:**
- Top-level `permissions:` is **explicitly minimal** — no `contents:
  write`. The daily report commit uses a **separate Personal Access
  Token** scoped only to `qa-watchtower-reports` branch, not main. This
  prevents the Watchtower from ever pushing to main even if a script
  bug tried.
- `concurrency: cancel-in-progress: false` — never cancel a finding mid-flight.
- `workflow_dispatch` — engineers can run manually for testing without
  waiting for nightly schedule.

**Secrets required (added through GitHub UI, never committed):**
- `STAGING_BASE_URL` — e.g. `https://staging.petwash.co.il`
- `QA_BOT_EMAIL`, `QA_BOT_PASSWORD` — synthetic account
- `CLAUDE_API_KEY` — Anthropic API key
- `GEMINI_API_KEY` — Google API key (optional, for Flash pre-screen)
- `QA_REPORT_PAT` — restricted PAT for committing daily reports
- `SENDGRID_API_KEY`, `CEO_EMAIL`, `ENG_LEAD_EMAIL` — summary email

---

## §10 Daily report format

Filed at `docs/qa-reports/YYYY-MM-DD.md`. One per day. Sample:

```markdown
# AI QA Watchtower — Daily Report
**Date:** 2026-05-16 (run started 03:00 IDT, finished 03:24 IDT)
**Branch:** main
**Commit:** 44fad93fa
**Status:** 2 P0, 5 P1, 14 P2, 7 P3
**Generated by:** Claude Sonnet 4.6 + Gemini 2.5 Flash (pre-screen)
**Envelope:** { wired: true, fallback: false, generatedAt: "2026-05-16T03:24Z", ttlSeconds: 86400 }

---

## P0 — fix today

### 1. eGift checkout double-charge possible
- **Route:** /egift/checkout
- **Viewport:** iPhone 15 Pro (390×844)
- **Locale:** he
- **Evidence:** screenshot, console log, network trace
- **Finding:** Pay button has no loading state. Bot tapped twice in 200ms,
  resulting in 2 POST /api/checkout/tranzila requests. Both returned 200.
- **Severity rationale:** double-charge against real customer is P0.
- **Suggested fix:** disable button + show spinner from click until response.
  File: client/src/pages/EGiftCheckout.tsx ~line 412 (button handler).
- **Cannot fix automatically:** touches checkout flow — requires human
  investigation per safety rule §8.4.
- **GitHub issue:** #312 (label: qa-watchtower, P0, requires-human-investigation)

### 2. /signin auth loop on returning Apple users
- **Route:** /signin → /home
- **Viewport:** iPad Pro 11" (820×1180)
- **Locale:** en
- **Finding:** 3 consecutive redirects observed before reaching /home.
  Average extra latency: 1.4 seconds. Affects users returning via
  "Continue with Apple."
- **Severity rationale:** auth friction on luxury brand surface.
- **Suggested fix:** investigate getRedirectResult() race in AuthProvider.tsx.
- **GitHub issue:** #313 (label: qa-watchtower, P0, auth)

---

## P1 — fix this week

### 3. Hamburger drawer slides from wrong side in Hebrew
- **Route:** anywhere (header)
- **Locale:** he
- **Evidence:** screenshot pair (LTR vs RTL)
- **Finding:** Drawer slides from the right in both locales. In Hebrew
  this is unnatural — should slide from the left.
- **Issue:** #314 (mobile-safari, rtl, P1)
- **Already documented:** docs/MOBILE_FIRST_2026_REBUILD_AUDIT.md §2.5.
  Auto-deduped to existing issue (no new issue created).

[... 4 more P1 entries ...]

---

## P2 — backlog (14 entries)

[summary table only — link to per-issue detail]

## P3 — informational (7 entries)

[summary table only]

---

## Trends (rolling 7-day)

- Auth flow median latency: 1.8s (▼ 0.2s WoW — improving)
- Booking flow completion rate (synthetic): 98% (▲ 2% WoW)
- Lighthouse performance score, /home: 87 (▼ 4 WoW — investigate)
- Lighthouse a11y score, /home: 96 (steady)
- Visual regressions flagged: 3 (▼ 1 WoW)

## What was NOT checked today

- /admin/* routes (intentionally excluded — see §8.3)
- Payment processor (Tranzila) — read-only assertion, no mutation
- Real customer data — no production data accessed (see §7)

## Run cost

- Claude Sonnet 4.6: $2.21
- Gemini 2.5 Flash: $0.18
- GitHub Actions minutes: 24
- Total: $2.39 USD
```

The format is intentionally **scannable in 60 seconds for the CEO**, with
deep links to detail for engineering. The first three sections (status,
P0, P1) are the only items the CEO needs to read daily.

---

## §11 Phased rollout

| Phase | Title                                                | Days | Risk      | Decisions needed |
|-------|------------------------------------------------------|------|-----------|------------------|
| 0     | Decisions A–G locked (this proposal)                 | 0    | none      | All              |
| 1     | MVP: 1 nightly run, Agent 1 + Agent 5, 6 customer routes, iPhone + Desktop, both locales | 5 | low | D, E, F, G |
| 2     | Add Agent 2 (visual luxury), Argos CI, full 30 routes| 5    | low       | F                |
| 3     | Add Agent 3 (mobile Safari) + iPad viewport          | 3    | low       | -                |
| 4     | Add Sentry production wiring + RUM correlation       | 3    | low       | -                |
| 5     | Add Agent 4 (legal copy) — weekly run only           | 2    | very low  | E                |
| 6     | Add hourly canary runs for /welcome + /signin + /booking | 4 | medium    | G                |
| 7     | Brain Dashboard panel "/admin/brain → QA Watchtower" with `requireBrainAccess` gate | 5 | low | -        |

**Total to full ambition:** ~27 working days = 6 weeks calendar. **MVP:
1 week.**

Each phase is independently revertible — the workflow file change is the
only artifact, no schema, no production code.

---

## §12 First safe MVP — the 2-week proof

**Scope:** Phase 1 only. Ship the smallest useful thing, prove the
governance works, then expand.

**Concrete deliverables:**

1. New folder `qa-watchtower/` at repo root, **separate from `client/`
   and `server/`** so it can be excluded from production builds entirely.
   - `qa-watchtower/playwright.config.ts`
   - `qa-watchtower/journeys/` — 5 Playwright journeys
   - `qa-watchtower/lib/ai-client.ts` — thin wrapper for Claude / Gemini
   - `qa-watchtower/lib/redact.ts` — PII redaction before AI
   - `qa-watchtower/scripts/triage.ts`, `ai-review.ts`, `file-issues.ts`
   - `qa-watchtower/lighthouserc.json`
2. New GitHub Actions workflow `.github/workflows/ai-qa-watchtower-nightly.yml`.
3. New folder `docs/qa-reports/` for daily reports.
4. New section in `.claude/skills/petwash-platform/SKILL.md` under §3
   pointing to the Watchtower as the QA arm of the AI governance model.
5. Synthetic bot accounts created in staging Firebase project.
6. First passing nightly run → first daily report committed → first
   summary email delivered to CEO.

**The 5 journeys for MVP:**
1. Public home → /welcome → /signup → /onboarding/name (LTR + RTL)
2. Returning user /signin → /home (LTR + RTL)
3. /booking flow create → confirmation (LTR only)
4. /egift purchase flow (with Tranzila sandbox) (LTR only)
5. /paw-finder browse → lost-pet detail (LTR + RTL)

**What MVP does NOT include:**
- Visual luxury review (Phase 2).
- Mobile Safari layout audit (Phase 3).
- Production error monitoring (Phase 4).
- Legal copy scan (Phase 5).
- Hourly canary (Phase 6).
- Brain dashboard panel (Phase 7).

**Why this scope:** the highest-revenue, highest-risk customer flows are
covered. The governance model is proven end-to-end. If Watchtower works
for these 5 flows, expanding to 30 is mechanical, not architectural.

---

## §13 Decisions awaiting CEO

Numbered to lock one at a time.

- **A.** Staging environment: do we have a deploy-mirror of production at
  `staging.petwash.co.il` today? If yes, Watchtower deploys there. If no,
  Phase 1 first creates one (additional 3 days, ~$15/mo Cloud Run).
  *Recommendation: confirm staging exists — Watchtower needs it.*

- **B.** Synthetic bot accounts in production Firebase or in a separate
  staging Firebase project?
  *Recommendation: separate staging Firebase project. Cleanest privacy
  boundary, cleanest auth boundary, avoids any chance of bot data
  polluting production.*

- **C.** AI provider posture: Claude-primary (recommended) OR
  Gemini-primary OR multi-provider with no preference?
  *Recommendation: Claude-primary for reasoning + vision. Gemini Flash
  as optional pre-screen. Both behind the same `ai-client.ts` wrapper.*

- **D.** Daily report recipient list: CEO only, OR CEO + eng lead, OR
  CEO + eng lead + design lead?
  *Recommendation: CEO + eng lead at MVP. Design lead added at Phase 2
  when visual luxury agent ships.*

- **E.** Legal / compliance copy scanning — is the language model
  trusted to flag potential Israeli consumer protection issues, or does
  this need an Israeli lawyer review of the agent's prompt first?
  *Recommendation: lawyer review of Agent 4's system prompt before
  Phase 5 ships. Until then, Agent 4 only flags trademark misuse +
  accessibility statement currency — both low-risk categories.*

- **F.** Visual regression baseline — establish baseline against current
  main branch (today's design = baseline) OR against the Mobile-First
  2026 Rebuild target (future design = baseline)?
  *Recommendation: today's main as baseline. Update baseline when
  Phase 5 of Rebuild ships the new Welcome screen. Gives us regression
  protection during the transition.*

- **G.** Hourly canary scope — only the 3 core flows (sign-in, booking,
  eGift) OR all 30 routes?
  *Recommendation: 3 core flows only. Hourly Lighthouse on all 30 is
  cost-prohibitive without telling us much; the 3 revenue-critical
  flows are where outages hurt.*

---

## §14 What this PR does NOT do

Per platform skill §2 (one purpose per PR + non-negotiable rules):

- No code changes.
- No new dependencies.
- No schema migrations.
- No wallet / finance / Tranzila / K9000 / Nayax changes.
- No Firebase project configuration changes.
- No CI workflow changes (the YAML in §9 is illustrative only).
- No new files outside `docs/`.
- No deletion of any existing file.
- No SKILL.md §7 status update (this is a new branch, nothing merged).

When Phase 1 of the Watchtower ships, **it does so as its own PR** with
its own scope, its own report, its own approval gate. This proposal does
not pre-authorize any of that.

---

## §15 References

- `.claude/skills/petwash-platform/SKILL.md` — platform conventions,
  AI/Gemini limits (§3), PR discipline (§4), mobile-first rules (§5).
- `docs/MOBILE_FIRST_2026_REBUILD_AUDIT.md` — UX rebuild context.
- `docs/AUTH_REBUILD_AUDIT.md` — auth flow context.
- `docs/EXECUTIVE_ACCESS_IDENTITY_AUDIT.md` — identity audit context.
- `docs/PRODUCTION_QUALITY_AUDIT.md` — prior production quality issues.
- `server/lib/gemini-client.ts` — existing Gemini wrapper.
- `server/services/coworker/CoworkerAgentService.ts` — existing 6-family
  advisory AI scaffold (PR-20, parked).
- `server/routes/admin-brain.ts` — Octopus Brain entry point.
- Playwright docs: https://playwright.dev
- Lighthouse CI docs: https://github.com/GoogleChrome/lighthouse-ci
- Argos CI docs: https://argos-ci.com
- Anthropic API data usage policy: https://www.anthropic.com/legal/commercial-terms
- Google AI API data usage policy: https://ai.google.dev/terms

---

**End of proposal.** No code ships from this PR. Implementation gated on
CEO sign-off on Decisions A–G.
