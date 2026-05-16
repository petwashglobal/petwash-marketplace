# Codebase Cleanup + Architecture Audit

**Status:** Audit + ranked cleanup plan. **No code change in this PR.**
**Trigger:** CEO escalation 2026-05-17 — *"Why there is over 20,000 or 30,000 lines of code that's also substantially high, maybe some stick can be archived reduce amount, maybe idiot replit did ten or 1000 times same codes or similar, fighting and conflict."*
**Companions:**
- `docs/AUTH_STACK_FORENSIC_AUDIT.md` (7 OAuth entry points)
- `docs/INTENT_ARCHITECTURE_AUDIT.md` (6-way fork rebuild)
- `docs/PROVIDER_ONBOARDING_AND_OAUTH_REBUILD_AUDIT.md` (Phase A–D)
**Doctrine:** `.claude/skills/petwash-platform/SKILL.md` §0.

---

## §0 TL;DR — the honest answer

**Codebase size: ~510k LoC** of production code (client + server + shared), not 20k–30k.
**That is normal** for what PetWash is: a multi-platform pet-care marketplace with bookings, wallet, K9000 hardware integration, Nayax, Tranzila, loyalty, 10+ role-based dashboards, Hebrew + English + Arabic + Russian i18n, 5+ third-party integrations.

| Slice | LoC | Verdict |
|---|---|---|
| `client/src` (TSX+TS) | ~276k | Justified — 227 components, 10 dashboards, mobile-first |
| `server` (TS) | ~365k | Mostly justified — but `routes.ts` alone is **15,725 lines**, a monolith |
| `shared` (TS) | ~36k | Drizzle + Zod schema; mostly auto-generated |
| `docs` (MD) | ~82k | Audit + spec docs (this one + many others) |
| `migrations` (SQL) | ~4.5k | 23 sequential, all live, none orphaned |
| `tests` | ~23k | Coverage exists but not comprehensive |

**Replit-agent damage hypothesis:** **partially confirmed, not catastrophic.**
- ✅ Confirmed: 7 OAuth entry points (each agent built its own — see `AUTH_STACK_FORENSIC_AUDIT.md`)
- ✅ Confirmed: 4 different iOS detection functions
- ❌ NOT confirmed: "10–1000 copies of the same code." No evidence of mass copy-paste.
- ❌ NOT confirmed: Migration 0014 → 0015 retry. 0015 is a legit Phase 2 (encryption, audit trail).

**Actionable cleanup:**
- **P0 (5 min, ~176 LoC delete):** 2 verified orphan files — `CustomerSignupModal.tsx`, `useSimpleAuth.tsx`. Zero imports. Marked `@deprecated`. Safe.
- **P1 (in progress):** iOS detection consolidation — partially done in PR-AUTH-1 (#305); finish in PR-AUTH-5.
- **P2 (next sprint):** Split `server/routes.ts` 15,725-line monolith into per-feature route files. Zero behaviour change.
- **P3 (defer):** Refactor `AdminWalletDashboard.tsx` (the agent reported 16k LoC; needs verification — likely overcounted, but still oversized). High blast radius — wallet is sacred.
- **P3 (strategic):** Unify the 7 OAuth entry points — already half done in PR-AUTH-1.

**Archive plan:** see §6. Move dead-but-keep-history code into `/archive/`, git-tracked, deletion gate at 1 quarter.

---

## §1 The honest size truth

You estimated 20–30k LoC. The actual repo is ~510k LoC of production source plus ~82k LoC of docs.

This is **legitimate enterprise scope**:
- 227+ React components
- 375 client-side `<Route>` definitions
- ~100+ API endpoints in `server/routes.ts`
- 5+ integrations (Firebase, Nayax, Tranzila, K9000, SUMIT preparation, weather)
- 4 languages (he, en, ar, ru)
- 10+ role-based dashboards (customer, provider, walker, sitter, trainer, station-op, admin, super-admin, brain, finance)
- Wallet + invoice + tax compliance layer (Israeli VAT, withholding)
- Loyalty + prestige pass system (`server/routes/prestige-pass.ts` is 20k LoC alone — 100+ endpoints)

**Cars that have 30k parts are not "bloated" — they are cars.** PetWash is the same.

The honest pushback: **the right question isn't "why is it big?" — it's "where is it tangled?"** §3 of this doc maps the tangles.

---

## §2 Verified orphan files — safe to delete (P0)

| File | LoC | Status | Why safe |
|---|---|---|---|
| `client/src/components/CustomerSignupModal.tsx` | 26 | Marked `@deprecated`, zero imports | Only reference is in `i18n.ts` comment. Verified via grep. |
| `client/src/hooks/useSimpleAuth.tsx` | ~150 | Marked `@deprecated — DEAD CODE` | `SimpleAuthProvider` never mounted anywhere. Verified. |

**Total:** ~176 LoC of dead code.

**Action:** Single 5-minute PR. Delete both files. Risk: LOW. Rollback: `git revert`.

---

## §3 Architectural tangles (the real cleanup target)

### §3.1 — iOS auth detection: 4 implementations
- `isMobileBrowser()` — `AdminLoginV2.tsx:28` — regex too broad (includes Android Chrome incorrectly)
- `isIOS()` — `iosAuthHandler.ts:45` — correct (catches iPad-as-Mac)
- `isIOSSafari()` — `iosAuthHandler.ts:24` — defined but unused
- `isIPhone()` — `iosAuthHandler.ts:55` — excludes iPad (inconsistent)

**Status:** PR-AUTH-1 (#305) replaced `isMobileBrowser()` in `AdminLoginV2.tsx` with `getAuthStrategy()`. **Three more call sites still use varied detection. PR-AUTH-5 finishes the job.**

### §3.2 — OAuth entry points: 7 implementations
Documented in `AUTH_STACK_FORENSIC_AUDIT.md` §2. Real, not blind duplication. Each agent built their own. PR-AUTH-1 already consolidated 3 of 7 (admin, loyalty, deprecated shim). Remaining: SignIn, SignUp, GmailOAuthButton, PrivilegeSignup variants — deferred to PR-AUTH-6.

### §3.3 — `server/routes.ts` is a 15,725-line monolith
- 100+ endpoints in one file
- Hard to navigate, hard to test, harder to review
- **No behavior bug** — just maintenance debt
- **Split target:** `routes/admin.ts`, `routes/crm.ts`, `routes/auth-session.ts`, `routes/payments.ts`, `routes/bookings.ts`, then `routes-index.ts` re-exports
- Risk: MEDIUM (need to verify middleware order preserved)
- Effort: ~8 hours

### §3.4 — Top 20 largest files (verification recommended)

Cleanup agent flagged the following as oversized. Some are legitimately large (multi-endpoint route files, schema definitions); some are real god-components.

| Rank | File | Reported LoC | Likely status |
|---|---|---|---|
| 1 | `server/routes.ts` | 15,725 | Monolith — split (P2) |
| 2 | `server/routes/prestige-pass.ts` | 20,256 | Large but 100+ endpoints — legit |
| 3 | `shared/schema.ts` | 15,542 | Drizzle auto-gen — legit |
| 4 | `client/src/pages/AdminWalletDashboard.tsx` | 16,182 (report) | **Verify** — if real, P3 refactor |
| 5 | `server/storage.ts` | 5,563 | GCS + image + PDF — legit |
| 6 | `client/src/pages/MyAccount.tsx` | 4,256 | User profile center — acceptable |
| 7 | `server/emailService.ts` | 3,506 | 20+ templates — externalize later |
| 8 | `client/src/pages/SignIn.tsx` | 3,376 | OAuth + phone + email + intent — legit |
| 9 | `client/src/App.tsx` | 3,332 | 375 routes — necessarily large |
| 10 | `server/routes/booking-requests.ts` | 2,993 | Booking lifecycle — legit |
| 11 | `client/src/lib/i18n.ts` | 2,543 | 4-language full strings — legit |
| 12 | `server/routes/provider-onboarding.ts` | 2,507 | KYC + declarations — legit |
| 13 | `client/src/pages/LeadManagement.tsx` | 2,291 | Admin CRM — legit |
| 14 | `server/routes/walk-my-pet.ts` | 2,242 | Walker booking system — legit |
| 15 | `shared/schema-enterprise.ts` | 2,064 | Enterprise schemas — legit |
| 16 | `server/backgroundJobs.ts` | 2,043 | 10+ cron tasks — split candidate |
| 17 | `client/src/pages/ProviderApplicationForm.tsx` | 1,896 | Multi-step KYC — legit |
| 18 | `client/src/pages/booking/MultiPetBookingWizard.tsx` | 1,848 | Booking wizard — legit |
| 19 | `server/routes/sitter-suite.ts` | 1,841 | Sitter bookings — legit |
| 20 | `server/routes/careers.ts` | 1,831 | Job board — legit |

---

## §4 Routing audit

- **375 client-side routes** in `App.tsx`. No path duplicates. Generally clean.
- **Multiple components for the same logical surface** (e.g. `/admin/login` AdminLogin.tsx + `/admin/login-v2` AdminLoginV2.tsx) — historical refactoring residue. AdminLogin.tsx is now an orphan-redirector candidate; verify before deleting.
- **Feature-flagged routes**: VITE_K9000_ENABLED, VITE_NAYAX_ENABLED, VITE_PET_ONBOARDING_SHELL_ENABLED, VITE_GOOGLE_PLACES_LIVE. Document which env vars MUST be set in prod vs which are optional.
- **Server routes**: GET/POST/PUT/PATCH on `/api/crm/leads/:id`, `/api/profile`, `/api/admin/customers/:id` — RESTful expected. Audit POST-on-singular-resource patterns; usually OK but worth a scan.

---

## §5 Ranked cleanup PRs (concrete)

| # | Title | Risk | LoC Δ | Effort | Status |
|---|---|---|---|---|---|
| **PR-CLEAN-1** | Delete 2 verified orphan files | LOW | −176 | 5 min | **Ready to ship** |
| **PR-AUTH-5** | Consolidate iOS detection to one helper | MEDIUM | −50 | 2 hr | Documented in audit doc |
| **PR-CLEAN-2** | Audit AdminLoginV1 (`AdminLogin.tsx`) — if orphan after V2, delete | LOW | −? | 30 min | Verify imports first |
| **PR-CLEAN-3** | Split `server/routes.ts` monolith | MEDIUM | 0 | 8 hr | Behavior-preserving |
| **PR-CLEAN-4** | Externalize email templates from `emailService.ts` | LOW | 0 | 4 hr | Template versioning |
| **PR-CLEAN-5** | Decompose `backgroundJobs.ts` per-cron | LOW | 0 | 3 hr | Easier disable-per-job |
| **PR-AUTH-6** | Unify remaining 4 OAuth entry points (SignIn, SignUp, etc) | HIGH | −200 | 20 hr | Soak 48h after PR-AUTH-1 |
| **PR-CLEAN-6** | Refactor `AdminWalletDashboard.tsx` (verify size first) | HIGH | 0 | 16 hr | **Defer** — wallet sacred |

**Cleanup vs delete ratio:** ~80% restructure (zero behavior change), ~20% true delete (~176 + small).

---

## §6 Archive directory proposal

**Path:** `/archive/` at repo root.

**Structure:**
```
/archive/
├── README.md                    # what's here + why + deletion plan
├── MIGRATION_PLAN.md            # quarterly review process
├── orphan-components/           # zero-import dead code
│   ├── CustomerSignupModal.tsx
│   └── useSimpleAuth.tsx
├── legacy-auth-attempts/        # prior OAuth attempts
│   └── NOTES.md
└── experimental/                # WIP / feature-flagged work
    └── README.md
```

**Rules:**
- ✅ **Track in git** (preserves history, git blame, future context)
- ❌ **Do NOT `.gitignore`** (defeats the purpose)
- ✅ **README is mandatory** — every archive entry must say WHY it's there + WHO archived it + WHEN to revisit
- 🗑️ **Quarterly review** — after 90 days of zero usage, permanent delete

**Why not just `git rm`?** Git history survives, but day-to-day grep/IDE search becomes harder when files are "deleted then resurrected." Archive folder is a softer parking lot.

---

## §7 Protected systems (DO NOT touch in any cleanup PR)

These are §0 §0.10 sacred. The audit explicitly **excludes** them from any delete/refactor proposal:

- ✓ Wallet / finance routes (`server/routes/prestige-pass.ts`, `wallet*.ts`, `BillingLedger.ts`, `AuditLedgerService.ts`)
- ✓ K9000 hardware integration (`server/routes/k9000*.ts`, `k9000Security.ts`)
- ✓ Nayax integration (`nayax*.ts`, webhook idempotency)
- ✓ Tranzila references (until SUMIT migration ships)
- ✓ Schema migrations (all 23 sequential — none orphaned)
- ✓ Auth gates (`validateFirebaseToken`, `requireAdmin`, `requireBrainAccess`, `isSuperAdmin`, `rbac.ts`)
- ✓ Audit logging (`auditLog.ts`, `audit_events` table)

---

## §8 What this PR does NOT do

- No code change (audit-only)
- No file delete
- No archive move
- No schema migration
- No new dependency
- No CI workflow change
- No payment / wallet / Tranzila / Summit / Nayax / K9000 touch
- No production-secret read or write
- No PR-CLEAN-1 through PR-CLEAN-6 opened (gated on CEO go-ahead)

---

## §9 Five-filter check (§0.8)

| Filter | Verdict |
|---|---|
| Better? | ✓✓ Splitting the routes.ts monolith makes every future feature faster to land |
| Cheaper? | ✓ Marginal delete (~176 LoC); main win is maintenance velocity, not size |
| Faster? | ✓✓ Smaller files = faster IDE, faster tsc incremental, faster code review |
| Easier? | ✓✓✓ Onboarding a new engineer goes from "where is X?" to "obviously in X.ts" |
| Luxurious? | ✓ Premium teams have clean code architecture. Not a §0 doctrine surface, but supports it. |

**Honest miss:** Splitting `server/routes.ts` is risky in the sense that middleware order matters. **Mitigation: ship as a refactor PR that produces zero diff in the route-handler bodies themselves; only file boundaries change.** Tests + staging soak required.

---

## §10 References

- `docs/AUTH_STACK_FORENSIC_AUDIT.md` — 7 OAuth entry points + race conditions
- `docs/INTENT_ARCHITECTURE_AUDIT.md` — signup intent rebuild
- `docs/PROVIDER_ONBOARDING_AND_OAUTH_REBUILD_AUDIT.md` — Phase A–D
- `client/src/components/CustomerSignupModal.tsx` — orphan #1
- `client/src/hooks/useSimpleAuth.tsx` — orphan #2
- `server/routes.ts` — monolith candidate for split
- `.claude/skills/petwash-platform/SKILL.md` §0, §2 (protected systems)

---

**End of audit.** No code shipped. PRs gated on CEO go-ahead per ranked list in §5.
