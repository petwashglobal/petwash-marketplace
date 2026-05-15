# AI QA Watchtower — Pre-Flight Discovery Report

**Status:** Read-only research. No code, no production change, no Firebase
creation, no GitHub Secrets added, no workflow change, no AI traffic, no
external calls.
**Parent docs:**
- `docs/AI_QA_WATCHTOWER_PROPOSAL.md` (architecture, merged in #280)
- `docs/AI_QA_WATCHTOWER_MVP_SEQUENCING.md` (sequencing + locked decisions A–G, merged in #281)

**Purpose:** Before any code PR opens, answer two questions from inside
the repo: (1) what already exists in the codebase that could support
staging + a separate Firebase project, and (2) what the CEO must check
manually outside the repo. This is the bridge between "decisions locked"
and "first code PR."

**Date stamped:** 2026-05-15.

---

## §0 Status

- Proposal + sequencing plan: **merged to main**.
- Pre-flight gates G1, G2, G3: **not yet confirmed.**
- PR-W2 (first code PR): **still on hold.** Will not open until G1 + G2
  are confirmed by CEO/eng lead.
- This report is the **internal half** of pre-flight. CEO's manual
  external checks (§3) are the **external half.**

---

## §1 Discovery findings

Pure observation from reading the repo. No interpretation of intent —
only what is in the files today.

### §1.1 `staging.petwash.co.il` references vs reality

**The string `staging.petwash.co.il` appears in several places**, but
**no infrastructure code targets it.**

| File                                             | What it says                                                                    | Interpretation                                                |
|--------------------------------------------------|---------------------------------------------------------------------------------|---------------------------------------------------------------|
| `mobile-app/README.md`                            | Hardcodes `API_BASE = "https://staging.petwash.co.il"`                          | Mobile app reads staging as its API base — implies staging was intended |
| `mobile-app/DELIVERY_SUMMARY.md`                 | Same hardcoded reference                                                         | Same                                                          |
| `docs/OPERATIONS_RUNBOOK.md`                      | Example curl commands point at `https://staging.petwash.co.il`                  | Documentation assumes staging exists                          |
| `docs/APPLE_INTEGRATION_SETUP.md` (line 1)        | Lists `https://staging.petwash.co.il` in MapKit allowed origins                 | Apple Developer config provisioned for staging                |
| `docs/AI_QA_WATCHTOWER_MVP_SEQUENCING.md` §2     | Treats staging as a gate (G1)                                                    | This proposal                                                  |
| `.github/workflows/petwash-ci.yml` (line ~685)   | A historical comment mentioning "staging" — about secrets, not deploys           | Vestigial                                                      |
| `.env.example`                                    | No `STAGING_BASE_URL` or `STAGING_*` env vars defined                            | No build-time support for staging                              |
| `firebase.json`                                   | Single hosting target named `"main"` — no staging target                         | No Firebase Hosting site for staging                           |
| `cloudrun-service.yaml`                           | Single Cloud Run service `petwash-api` — no `-staging` sibling                  | No Cloud Run service for staging                               |
| `.github/workflows/petwash-ci.yml` (deploy jobs) | Only deploys production: backend to Cloud Run, frontend to Firebase Hosting     | No staging deploy job                                          |

**Independent concern surfaced for the CEO:**

`mobile-app/README.md` and `mobile-app/DELIVERY_SUMMARY.md` hardcode
`https://staging.petwash.co.il` as the API base. If the mobile app is
currently operating, it is either:
- Calling a staging URL that doesn't resolve (mobile app is broken), OR
- Calling a staging URL that resolves to something we don't have config
  for in this repo (staging exists but is undocumented), OR
- The README is aspirational and the actual `API_BASE` is set via
  environment variable elsewhere.

This is **outside the Watchtower scope** but worth flagging — it
suggests someone at some point planned staging, and there may be partial
state somewhere. CEO check item §3.6 below.

### §1.2 Staging Firebase project — hardwired to production

The codebase has **no multi-environment Firebase support today.**

| File                                             | Finding                                                                                          |
|--------------------------------------------------|--------------------------------------------------------------------------------------------------|
| `client/src/lib/firebase.ts` (lines 39–49)       | Reads `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, etc. — single set of vars             |
| `client/src/lib/firebase.ts` (line 44)           | `projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID` — no environment branching                |
| `client/src/lib/firebase.ts` (lines 41–43)       | `authDomain` switches on `import.meta.env.PROD` (Vite production flag) — but no staging variant  |
| `server/lib/firebase-admin.ts` (line 5)          | `FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID \|\| process.env.VITE_FIREBASE_PROJECT_ID \|\| 'signinpetwash'` — **hardcoded fallback to production project ID** |
| `server/routes.ts` (multiple lines)              | Hardcoded fallback to `'signinpetwash'`                                                           |
| `server/lib/gemini-client.ts`                     | `VERTEX_PROJECT = 'signinpetwash'` hardcoded                                                       |
| `server/routes/recaptcha.ts`                      | `FIREBASE_PROJECT_ID = 'signinpetwash'` fallback                                                  |
| `cloudrun-service.yaml` (lines 152–156)          | `FIREBASE_PROJECT_ID` + `FIREBASE_WEB_API_KEY` from GCP Secret Manager — single (production) set |
| `.env.example`                                    | No `*_STAGING_*` Firebase variables defined                                                       |

**Production Firebase project ID:** `signinpetwash`. **No staging
counterpart found.**

**To support staging Firebase, the codebase would need:**
1. A separate Firebase project (e.g., `petwash-staging`) created in
   the GCP console — **not a code change**.
2. Env-var-driven selection in `client/src/lib/firebase.ts` (replace
   hardcoded fallback with `process.env.NODE_ENV`-aware lookup).
3. Same in `server/lib/firebase-admin.ts`.
4. Same in 6 other server files where `'signinpetwash'` is hardcoded.
5. Cloud Run staging service with its own Secret Manager bindings for
   `FIREBASE_PROJECT_ID_STAGING`, `FIREBASE_WEB_API_KEY_STAGING`.

**Scope estimate:** 10–15 LOC change per file × ~8 files = ~80–120 LOC,
all in the auth + Firebase initialization layer. Each change is a
straight `env.NODE_ENV === 'staging' ? X : Y` pattern. Touches the
auth init layer — **not zero risk** even though small. Would need its
own PR with its own approval gate.

### §1.3 GitHub Actions / deploy structure

Seven workflow files in `.github/workflows/`. Only one deploys
anywhere. None deploys to staging.

| Workflow file                                  | Trigger                          | Purpose                                                  | Staging?                |
|------------------------------------------------|----------------------------------|----------------------------------------------------------|-------------------------|
| `petwash-ci.yml` (70 KB)                       | push to `main`, `workflow_dispatch` | Build + deploy to production Cloud Run + Firebase Hosting | No                      |
| `cloud-run-diagnostics.yml`                    | `workflow_dispatch`              | Post-deploy health check, log inspection                  | No                      |
| `codeql.yml`                                    | PR + scheduled                   | SAST security scanning                                    | No                      |
| `cache-cleanup.yml`                            | scheduled                        | GitHub Actions cache hygiene                              | No                      |
| `cleanup-merged-branches.yml`                  | post-merge                       | Branch hygiene                                            | No                      |
| `deploy-protection.yml`                        | various                           | Branch protection                                         | No                      |
| `copilot-setup-steps.yml`                      | informational                     | Onboarding doc                                            | No                      |

**Reusable patterns identified in `petwash-ci.yml` for Watchtower PR-W5:**
- GCP secret ensure-or-create (lines 40–130+) — the auto-init pattern
  for `PRESTIGE_QR_SECRET`, `JWT_SECRET`, etc. is a useful precedent for
  how Watchtower secrets could be provisioned.
- Artifact Registry push + Cloud Run deploy — same image pattern could
  serve a staging service if one existed.
- Firebase Hosting deploy via `firebase deploy --only hosting:main` —
  staging would need either a second hosting target (`hosting:staging`)
  in `firebase.json` or a separate Firebase site.

**No conflict** between any existing workflow and Watchtower's planned
`ai-qa-watchtower-nightly.yml`. The new file would sit alongside the
others with no overlapping triggers (Watchtower is cron-based, nothing
else is).

### §1.4 `qa-watchtower/` isolation feasibility

**Question A: Can a new top-level `qa-watchtower/` folder exist without
being picked up by `tsc --noEmit` for client or server?**

**Answer: YES, automatically.**

Evidence:
- Root `tsconfig.json` uses **explicit include**: `"include": ["client/src/**/*", "shared/**/*", "server/**/*"]`. A folder at `qa-watchtower/` is **not** in this list, so it is excluded by default.
- `tsconfig.server.json` includes only `server/**/*` and `shared/**/*`, already excludes `client/`, so `qa-watchtower/` is doubly excluded.
- Vite `root: path.resolve(import.meta.dirname, "client")` — Vite watches `client/` only. `qa-watchtower/` is outside Vite's scope entirely.

**Question B: Can the folder have its own `package.json` (sub-package)?**

**Answer: YES.**

Evidence:
- Root `package.json` has **no `"workspaces"` field**. No `pnpm-workspace.yaml`. No `nx.json`. No `lerna.json`. **This is not a monorepo.**
- Therefore, `qa-watchtower/package.json` can be a standalone nested
  package with its own `node_modules/`, installed via
  `npm --prefix qa-watchtower install`.
- Root `package.json` and root `package-lock.json` are **never touched**
  by this pattern. Production builds (which rely on root `package.json`)
  are unaffected.

**Question C: Will Vite production build pick it up?**

**Answer: NO.** Vite root is `client/`. Anything outside `client/` is
invisible to the Vite build.

**Question D: What `exclude` pattern is needed?**

**Answer: None strictly required.** All current configs use explicit
**include** lists that don't reference `qa-watchtower/`. Defensive
addition recommended (one line to each tsconfig):

```json
"exclude": [..., "qa-watchtower/**/*"]
```

This documents intent and prevents accidental future inclusion if
someone widens the include list.

**Question E: Monorepo tooling assumptions?**

**Answer: None.** Not a monorepo. Standalone sub-package is the natural
pattern given the existing structure.

**Conclusion for §1.4:** `qa-watchtower/` can be added at repo root
with zero impact on production builds, zero impact on `tsc --noEmit`,
zero new root dependencies. The defensive exclude additions are a
one-line change per tsconfig and can be bundled into PR-W2 when the
time comes.

### §1.5 Hosting infrastructure

| File                            | Finding                                                                                                  |
|---------------------------------|----------------------------------------------------------------------------------------------------------|
| `firebase.json`                  | Single hosting target `"main"`. Public folder `dist/public`. Rewrites `/**` → Cloud Run service in `me-west1`. |
| `cloudrun-service.yaml`         | Service `petwash-api`. Region `me-west1`. Min replicas 1, max 10. Memory 2Gi. Port 8080. NODE_ENV=production. |
| `firebase.json` (lines 18–50)   | API path rewrites: `/api/**`, `/auth/**`, `/webauthn/**`, `/uploads/**` all route to Cloud Run.            |
| `.github/workflows/petwash-ci.yml` | Image build → Artifact Registry → `gcloud run deploy petwash-api` → `firebase deploy --only hosting:main`. |
| No `app.yaml`                    | Not App Engine.                                                                                            |
| No Dockerfile in repo            | Image built in-workflow by `petwash-ci.yml`, not from repo Dockerfile.                                    |

**To create staging infrastructure (out of scope for Watchtower
proposal, but blocking Watchtower MVP):**
1. New Cloud Run service `petwash-api-staging` in `me-west1` (same
   region for latency parity). Use the same Docker image as production
   initially.
2. New Firebase Hosting target. Two options:
   - **Option A:** Add a second target `"staging"` in `firebase.json`
     under the same `signinpetwash` Firebase project, with a custom
     domain `staging.petwash.co.il`. Cheaper, faster, shares Firebase
     project.
   - **Option B:** Create a separate `petwash-staging` Firebase project,
     wire `staging.petwash.co.il` into that project's hosting. Required
     anyway by Decision B for synthetic accounts. **Use Option B** if we
     want staging Firebase Auth distinct from production Firebase Auth.
3. DNS: `staging.petwash.co.il` CNAME to the Firebase Hosting endpoint
   (Option A) or to the staging Firebase project's endpoint (Option B).
4. Staging database: PostgreSQL read replica or sandbox snapshot.
   Watchtower runs against this — never against production DB.

**Estimated infra work (outside Watchtower scope):**
- Option A: ~1.5 days (no new Firebase project, just hosting + Cloud Run + DNS).
- Option B: ~3 days (new Firebase project + hosting + Cloud Run + DNS + IAM).

Decision B already locked in: **separate staging Firebase project →
Option B path applies.**

---

## §2 Best-guess answers for G1 + G2

Based purely on what is in the repo today. CEO's manual checks (§3) are
authoritative — this is internal evidence only.

| Gate | Best guess | Confidence | Reasoning                                                                                                                                |
|------|------------|------------|------------------------------------------------------------------------------------------------------------------------------------------|
| G1   | **Likely NO** | High       | No staging Cloud Run service config, no staging Firebase Hosting target, no staging deploy workflow, no DNS evidence. References in docs/mobile-app exist but no infrastructure backing them. |
| G2   | **Likely NO** | High       | Production Firebase project ID `signinpetwash` is hardcoded in 8+ files. No multi-environment selection logic. No `*_STAGING_*` env vars in `.env.example`. |

**Caveat:** infrastructure can exist **outside the repo** — e.g., a
Cloud Run service deployed manually that the CI workflow doesn't know
about, or a Firebase project that's never been referenced in code.
That's why §3 is required.

---

## §3 CEO checklist — the manual external checks

This is the **only action requested of the CEO today.** Six checks.
Should take about 10 minutes total. Each has a clear "answer" — copy
the answer back into chat and I will draft the next step.

### §3.1 — Does `https://staging.petwash.co.il` resolve?

1. Open Safari (or any browser) on iPad or desktop.
2. Visit `https://staging.petwash.co.il`.
3. Wait 5 seconds.
4. **Report one of:**
   - **Loads PetWash content** → staging exists somewhere. Note the
     content (is it current marketing? old marketing? broken?).
   - **Loads "service not found" / Cloud Run 404 page** → DNS exists
     but no service.
   - **Doesn't resolve (NXDOMAIN, "this site can't be reached")** → no
     DNS, no infra. **Most likely outcome.**
   - **TLS / certificate error** → partial infra, cert misconfigured.

### §3.2 — Is there a separate Firebase project for staging?

1. Open Firebase Console: `https://console.firebase.google.com/`.
2. Top-left, click the project picker dropdown.
3. **Report one of:**
   - **You see only `signinpetwash` (or whatever the production project
     is)** → no staging project. **Most likely outcome.**
   - **You see `petwash-staging`, `petwash-dev`, or similar** → name it
     exactly. Confirm whether it has any real customer data or only
     test data.

### §3.3 — Mobile app status (independent concern, surfaced from §1.1)

The mobile app's README documents `API_BASE = "https://staging.petwash.co.il"`.

1. Open Firebase Console → check if there is a deployed iOS or Android
   app under your production project that has recent usage data.
2. **Report one of:**
   - **Mobile app exists and is being used by real users** → it must be
     hitting a real backend somewhere. Find out which. Possibly staging
     exists and we don't know where it's deployed.
   - **Mobile app exists but has no recent usage / is a stub** → the
     staging reference is aspirational, ignore for now.
   - **No mobile app deployed at all** → README is aspirational, ignore.

This finding is **outside the Watchtower scope** but should be reported
to your eng lead independently. If users are calling a mystery staging
URL, that's its own concern.

### §3.4 — DNS ownership confirmation

1. The domain `petwash.co.il` is registered where? (probably with an
   Israeli registrar — domain.co.il or similar).
2. Who in PetWash has access to the DNS records today (to add a
   `staging` subdomain CNAME)?
3. **Report:** name + email of the DNS administrator. No action needed
   yet, just confirmation.

### §3.5 — GCP project access confirmation

1. Open Google Cloud Console: `https://console.cloud.google.com/`.
2. Top-left, project picker.
3. Confirm you have access to the `signinpetwash` project.
4. **Report one of:**
   - **Yes, full owner access** → can create new Cloud Run service +
     new Firebase project under same billing account.
   - **Yes, limited access** → name the role (Editor / Viewer / etc.).
   - **No access** → identify who does (likely the original GCP project
     creator).

### §3.6 — Apple Developer staging origin

Per `docs/APPLE_INTEGRATION_SETUP.md`, `staging.petwash.co.il` is
configured as a MapKit allowed origin.

1. Open Apple Developer portal → Certificates, IDs & Profiles → Keys.
2. Find the MapKit JS key.
3. **Confirm:** does it actually list `staging.petwash.co.il` as an
   allowed origin? If yes, someone provisioned it at some point.
4. **Report:** yes / no / I don't know how to find this.

---

## §4 If staging needs to be created — sequencing (not yet authorized)

This is a **possible** plan, not an approved one. If §3.1 and §3.2
return "no infrastructure," the Watchtower MVP cannot proceed until
staging is created. The path:

| Step | What                                                              | Owner    | Days   | Authorization                          |
|------|-------------------------------------------------------------------|----------|--------|----------------------------------------|
| S1   | CEO confirms §3 checklist results                                  | CEO      | 0.5    | None (just reporting)                   |
| S2   | Decision: Option A (shared Firebase) or Option B (separate)        | CEO      | inline | Decision B already locked → Option B   |
| S3   | Create `petwash-staging` Firebase project in GCP                  | Eng lead | 0.5    | CEO confirms after §3                  |
| S4   | Create staging Cloud Run service `petwash-api-staging`            | Eng lead | 1      | CEO confirms                           |
| S5   | Add staging Firebase Hosting target with `staging.petwash.co.il` | Eng lead | 0.5    | CEO confirms                           |
| S6   | DNS: CNAME `staging.petwash.co.il` to Firebase Hosting endpoint   | DNS admin| 0.5    | CEO confirms                           |
| S7   | Create staging PostgreSQL database (read-replica of prod or empty fixture) | Eng lead | 1 | CEO confirms                       |
| S8   | Wire env-var-driven Firebase project selection in client + server | Eng lead | 1      | **Separate PR with its own approval** — touches auth init |
| S9   | First deploy of `main` to staging; verify it loads                 | Eng lead | 0.5    | CEO confirms                           |
| S10  | G1 + G2 now answer YES → Watchtower MVP unblocks                   | —        | —      | Per existing sequencing                |

**Total: ~5.5 days** of infrastructure work, gated step by step. Each
step independently revertible. None ships from this doc.

If §3.1 returns **partial** infrastructure (DNS exists but no service,
or vice versa), only the missing steps execute. Saves time.

---

## §5 What this PR does NOT do

Per the CEO's instruction list (verbatim):

- No production changes. ✓
- No Firebase creation. ✓
- No GitHub Secrets changes. ✓
- No cron. ✓
- No workflow changes. ✓
- No bot accounts. ✓
- No root package changes. ✓
- No AI traffic. ✓
- No external calls. ✓
- No implementation. ✓

Per platform skill §2 also not touched: wallet, K9000, Nayax, Tranzila,
schema migrations, dependencies, auth gates.

Only file added: this report, in `docs/`. Zero impact on production
bundle, zero new tests, zero new dependencies.

---

## §6 Next steps

**Today (CEO action):** complete §3 checklist (6 items, ~10 minutes).
Paste results into chat.

**Then one of three paths opens:**

- **A.** G1 = YES, G2 = YES → I draft PR-W2 (Watchtower scaffolding) per
  the merged sequencing plan. MVP unblocks.
- **B.** G1 = NO, G2 = NO → I draft a mini-spec for §4's staging
  creation (10 steps, each gated). **Separate PR from Watchtower work.**
  Watchtower MVP unblocks only after staging is built.
- **C.** Mixed (e.g., DNS exists, service doesn't) → I draft a
  targeted patch list, only the missing steps.

**Eng lead action (only when CEO authorizes):** none yet. Eng lead
remains idle until §3 results come back.

---

## §7 References

- `docs/AI_QA_WATCHTOWER_PROPOSAL.md` — architecture proposal.
- `docs/AI_QA_WATCHTOWER_MVP_SEQUENCING.md` — sequencing + locked decisions A–G.
- `.claude/skills/petwash-platform/SKILL.md` — platform conventions.
- `mobile-app/README.md` — surfaces the unrelated mobile staging-URL
  concern noted in §1.1 + §3.3.
- `docs/APPLE_INTEGRATION_SETUP.md` — surfaces the MapKit staging
  origin concern noted in §3.6.

---

**End of discovery report.** No code shipped. Eng lead idle until CEO
completes §3.
