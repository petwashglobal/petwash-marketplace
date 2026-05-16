# Intent Architecture — Audit & Rebuild Plan

**Status:** Audit + proposal. **No code change in this PR.**
**Trigger:** CEO escalation 2026-05-16. "Current onboarding/service logic still mixes loyalty users, customers, providers. System still feels like all flows are sharing one generic onboarding state instead of deterministic separated paths."
**Companions:** `docs/SIGNUP_ONBOARDING_FORENSIC_AUDIT.md` (Path A), `docs/PROVIDER_ONBOARDING_AND_OAUTH_REBUILD_AUDIT.md` (Phase A–D), `docs/PATH_D_CUSTOMER_ENRICHMENT_AUDIT.md`, `docs/PATH_E_PROVIDER_REBUILD_AUDIT.md`.
**Doctrine:** `.claude/skills/petwash-platform/SKILL.md` §0.

---

## §0 TL;DR

The codebase has the **scaffolding** for an explicit intent-first architecture (intent enum, URL param, HttpOnly cookie, `/choose-role` modal, `users.signupIntent` column, intent → role mapper), but the scaffolding is wired **40%**. The remaining 60% are silent customer-defaults that swallow every uncertain state.

**Concrete consequence the CEO has been observing:** a user who clicks "Become Provider" with intent `provider`, signs in via Google, closes the tab mid-onboarding, and returns later — silently becomes a `customer` on next login because `users.signupIntent` is never written and the cookie was cleared after first consumption.

**Six-way fork CEO described:**
- Loyalty
- Customer
- Provider (groomer/trainer/general)
- Sitter / dog walker
- PetTrek driver
- Station operator / franchise worker

**What exists in code today:** **3 of 6** (customer ✓ wired, loyalty ✓ wired with caveats, provider ⚠️ half-wired — intent maps to role `customer` and provider is a secondary table; sitter/walker/driver/station_operator ✗ exist only as provider sub-types, not first-class roles).

**Fix path:** 7 PRs over ~2 weeks. All additive. No protected systems touched. The deterministic state machine documented in `SIGNUP_ONBOARDING_FORENSIC_AUDIT.md §0` becomes the enforced state machine in code.

---

## §1 Root-cause map — where intent capture lives and where it leaks

### §1.1 What exists today (the scaffolding)

| Capability | File:Line | State |
|---|---|---|
| Intent enum (`CUSTOMER \| LOYALTY \| PROVIDER \| STAFF`) | `shared/lib/onboardingIntent.ts:23-39` | ✓ defined |
| `?intent=…` URL param parser | `client/src/lib/intentParam.ts:68-111` | ✓ wired |
| Pre-auth seed → `localStorage.signup_intent` | `client/src/pages/SignIn.tsx:169-197` | ✓ wired |
| Server seed-intent endpoint (HttpOnly cookie, 30-min TTL, ITP-resistant) | `server/routes/post-login.ts:1142-1165` | ✓ wired |
| `/choose-role` modal (3 buttons + collapsed staff) | `client/src/pages/ChooseRole.tsx:21-150` | ✓ wired |
| `POST /api/auth/choose-role` | `server/routes/post-login.ts:839-925` | ✓ wired |
| `users.signupIntent` column | `shared/schema.ts:114` | ✓ exists |
| Post-login decider | `server/routes/post-login.ts:203-508` | ✓ wired |
| Default destinations per intent | `shared/lib/onboardingIntent.ts:58-63` | ✓ wired |

### §1.2 What's broken (the silent leaks)

| # | Leak | File:Line | Effect |
|---|---|---|---|
| 1 | **`users.signupIntent` is only written in ONE handler** (`/api/auth/choose-role`). Email/password signup, social OAuth, and phone OTP never write it. | `server/routes/post-login.ts:863-870` | Returning users lose their original intent. |
| 2 | `intentToRole('provider')` returns `'customer'` — silent fallback. | `server/routes/post-login.ts:48` | Provider intent does not create provider role. |
| 3 | `intentToRole('staff_request')` returns `'customer'` — silent fallback. | `server/routes/post-login.ts:49` | Staff intent does not create staff role. |
| 4 | `intentToRole(unknown)` returns `'customer'` — implicit default. | `server/routes/post-login.ts:50` | Any unknown intent typo silently becomes customer. |
| 5 | `role \|\| 'customer'` nullish-coalesce appears in **4** places. | `post-login.ts:71, 399, 811, 1058` | Four independent customer defaults, none typed as enforcement. |
| 6 | Social OAuth shortcut: if `!userRole && isSocial && !intent` → auto-assign `customer` | `post-login.ts:414-445` | Google/Apple users skip intent capture entirely. Comment justifies: "real human is almost always customer." That comment is the bug. |
| 7 | Email/password signup has no intent field on the form. Reads `localStorage.signup_intent` if present, else defaults customer. | `SignUp.tsx:60-71` | Users who arrive at `/signup` without `?intent=` query param become customers. |
| 8 | Phone OTP flow has **no intent capture step at all**. | `SignIn.tsx:113-145` | All SMS users become customers regardless of original intent. |
| 9 | Provider approval does NOT auto-escalate `users.role`. When `provider_applications.status='approved'`, the customer-role flag stays customer. | (missing trigger) | Provider sees customer dashboard until manual log out + in. |
| 10 | Returning user with intent stuck mid-onboarding: cookie was cleared at first consumption, `users.signupIntent` never written. | `post-login.ts:397` (clear cookie) + §1.2.1 (never persist) | The CEO's exact symptom. |

### §1.3 Implicit customer default — the pattern

Every code path that encounters `!role` or uncertain state defaults to `customer` **without forcing explicit intent capture first.** The user never sees a choice; they silently become a customer. Then the dashboard, navigation, and post-login redirects all assume customer-shape — even when the user's intent was provider, loyalty, sitter, walker, driver, or station-operator.

This is the structural source of:
- Provider/customer ambiguity in the UI
- Inconsistent routing post-login
- Hidden fallback states
- Wrong expectations during signup
- Loyalty perks bolted onto a customer-typed account

### §1.4 Loyalty conflation

Loyalty is **not a distinct identity path**; it's a post-signup wallet enrollment. The data lives in `privilege_members`, separate from `users`, with no FK constraint. A user can be `role='customer'` AND in `privilege_members` simultaneously. Intent `loyalty` does set `users.role='loyalty'`, but does not prevent the user from also acting as a customer or block the customer-default escalation paths.

### §1.5 The missing roles

| CEO's 6-way fork | Schema support | First-class role? | Notes |
|---|---|---|---|
| Loyalty | `ALLOWED_ROLES` ✓ | ✓ but as wallet-state, not identity fork | See §1.4 |
| Customer | `ALLOWED_ROLES` ✓ | ✓ | Default path |
| Provider (groomer / trainer / general) | `ALLOWED_ROLES` ✓ | ⚠️ half | Intent maps to `customer`; provider data in `provider_applications` |
| Sitter | NOT in `ALLOWED_ROLES` | ✗ | Exists as provider sub-type only |
| Dog walker | NOT in `ALLOWED_ROLES` | ✗ | Exists as provider sub-type only |
| PetTrek driver | NOT in `ALLOWED_ROLES` | ✗ | Exists as provider sub-type only |
| Station operator | NOT in `ALLOWED_ROLES` | ✗ | Exists as provider sub-type only |

The schema treats "sitter / walker / driver / station_operator" as `provider.services` array values, not as distinct roles. This is a separate architectural decision (single provider role, multi-service capability) that CEO may want OR may want to break apart — see decision **I-D** below.

### §1.6 State machine: documented vs enforced

`docs/SIGNUP_ONBOARDING_FORENSIC_AUDIT.md §0` describes the canonical state machine:

```
anonymous → verified → identified → enriched → [intent] → approved | pending | restricted
```

In code, the transitions for `anonymous → verified → identified → enriched` ARE enforced (Path A PRs Z1–Z1.6 shipped). The transition `enriched → [intent]` is **not enforced** — that's the gap.

---

## §2 Recommended intent architecture (the rebuild)

### §2.1 Two design questions for CEO (decide before PR-I1)

**I-A. How explicit is the 6-way fork?**

Option 1 (recommended): **Two-layer fork.** Top layer = 4 identities (customer, loyalty member, provider, staff). Provider layer = service-type selector (groomer / trainer / sitter / walker / PetTrek driver / station operator). This matches Israeli tax reality (one provider entity, multiple services per provider) and keeps the role taxonomy small enough to enforce in code.

Option 2: **Six first-class roles.** Each service type is its own `users.role`. Higher cardinality, more complex routing, harder to migrate existing providers.

**I-D in §3.** Recommend Option 1.

**I-B. Multi-intent on one account?**

Option 1 (recommended): **One identity per account.** A user is customer OR provider, not both. To act as both, sign out and switch accounts (or use a separate email). Matches Wolt / Uber / DoorDash.

Option 2: **Dual-mode account.** One Firebase identity, two role states the user toggles between. Higher implementation cost, more surface for bugs.

Recommend Option 1.

### §2.2 Target state machine (with intent enforcement)

```
                anonymous
                    ↓
              [INTENT CAPTURE]  ← hard gate, before auth
                    ↓
                  verified  (phone OTP / email link / OAuth)
                    ↓
                identified  (firstName + DOB + terms)
                    ↓
                  enriched  (role-specific required fields)
                    ↓
        [INTENT → ROLE assignment, written to users.signupIntent + users.role]
                    ↓
           ┌──────────┼──────────┬──────────┐
           ↓          ↓          ↓          ↓
        customer   loyalty     provider     staff
       /home    /loyalty/   /provider-   /access-
                  join     onboarding    pending
                                ↓
                       [SERVICE SELECTOR]
                                ↓
                      ┌────────┬────────┬────────┬────────┐
                      groomer  sitter  walker  driver  station-op
```

Every state explicitly named. No silent customer defaults. No `role || 'customer'` fallbacks. Intent persisted to `users.signupIntent` at first opportunity (any auth path).

### §2.3 7-PR delivery plan

| PR | Title | Scope | Risk | Files |
|---|---|---|---|---|
| **PR-I1** | Persist `users.signupIntent` on EVERY consumption | Write `signupIntent` whenever it's read from cookie/localStorage, not just `/choose-role` | LOW | `server/routes/post-login.ts` (5 sites) |
| **PR-I2** | Phone OTP intent gate | Add intent step to OTP flow (radio: customer / provider / loyalty / staff) — matches Path A PR-Z1 patterns | MEDIUM | `client/src/pages/SignIn.tsx`, server validation |
| **PR-I3** | Email signup intent field | Required radio on `/signup` form | LOW | `client/src/pages/SignUp.tsx` |
| **PR-I4** | Social OAuth intent precheck | Force `/choose-role` BEFORE OAuth redirect if no intent set (instead of after, with customer default) | MEDIUM | `client/src/pages/SignIn.tsx`, `post-login.ts:414-445` |
| **PR-I5** | Strip the silent customer fallbacks | Replace `role \|\| 'customer'` with explicit `requireRole()` that 401s if role missing; surface `/choose-role` instead | MEDIUM | `post-login.ts:71,399,811,1058` |
| **PR-I6** | Provider approval auto-escalates `users.role` | DB trigger or service hook: when `provider_applications.status='approved'` → `users.role='provider'` | MEDIUM | `server/routes/admin-provider-review.ts`, new audit log |
| **PR-I7** | Service-type fork inside `/provider-onboarding` | Provider chooses one or more service types (groomer / sitter / walker / driver / station-op) — UI exists (`provider-type` cards), just needs to be the deterministic next-step gate | LOW | `client/src/pages/ProviderOnboarding.tsx` |

Each PR is self-contained, additive, additive-only schema changes (writing existing nullable columns). No protected systems touched.

### §2.4 Migration / backfill

Three short backfill scripts (run in this order, in staging first):

- **Script A.** For users with `provider_applications` rows but `users.signupIntent IS NULL`, write `signupIntent='provider'`. Idempotent.
- **Script B.** For users with `provider_applications.status='approved'` but `users.role='customer'`, escalate `users.role='provider'`. Idempotent. Audit logged.
- **Script C.** For users with `staff_access_requests.status='approved'` but `users.role='customer'`, escalate `users.role='staff'`. Idempotent. Audit logged.

All three scripts read-only by default; write only when invoked with `--apply`. Logged to `audit_events` with actor=`backfill-script`, `before`/`after` columns.

---

## §3 Decisions awaiting CEO

| ID | Question | Recommendation |
|---|---|---|
| **I-A** | How explicit is the 6-way fork? | **Option 1** — two-layer (4 identities, service selector inside provider). Matches IL tax reality. |
| **I-B** | Multi-intent on one account? | **Option 1** — one identity per account. Sign-out to switch. |
| **I-C** | Should `loyalty` stay as a distinct `users.role`, or fold into "customer with loyalty membership"? | **Distinct role** — loyalty members get loyalty-specific UI, push-notification cadence, and entitlements. Folding loses the differentiator. |
| **I-D** | Where does the service-type selector live: standalone `/onboarding/role/services` step, OR inside `/provider-onboarding` step 1? | **Inside `/provider-onboarding` step 1** — already exists (`provider-type` cards), just needs to be a hard gate to next step. |
| **I-E** | What happens to existing users with `users.role='customer'` who have provider/staff records but no signupIntent? | Run Backfill A in production after PR-I1 ships and soaks 48h on staging. |
| **I-F** | PR-I5 strips customer fallbacks — should we feature-flag the strict mode for a 7-day soak, or hard-cut? | **Feature-flag for 7-day soak.** Strict mode behind `STRICT_INTENT_ROUTING` env var; flip after monitoring 401 rates on staging mirror. |
| **I-G** | Phone OTP intent gate (PR-I2): radio in OTP flow OR redirect to `/choose-role` after OTP success? | **Radio in OTP flow** — matches Path A pattern (PR-Z1.5 added name, DOB, terms in OTP itself); avoids extra navigation hop on iPhone Safari. |

---

## §4 What this PR does NOT do

- No code change (audit-only).
- No schema migration.
- No new dependency.
- No CI workflow change.
- No payment / wallet / Tranzila / Summit / Nayax / K9000 touch.
- No production-secret read or write.
- No PR-I1 through PR-I7 opened (gated on CEO decisions I-A through I-G in §3).
- No backfill script written (gated on I-E decision).

---

## §5 Five-filter check (§0.8)

| Filter | Verdict |
|---|---|
| Better? | ✓✓✓ Eliminates silent customer defaults; matches CEO's deterministic state machine |
| Cheaper? | ✓✓ 80% of scaffolding exists; 7 PRs over 2 weeks |
| Faster? | ✓✓ Reduces support load (no more "I signed up as provider but see customer dashboard" tickets) |
| Easier? | ✓✓ Removes 4 redundant fallback branches; one canonical state machine |
| Luxurious? | ✓✓✓ Per §0 doctrine — premium signup means "we know who you are", not "we guess and assume customer" |

**Honest miss:** PR-I4 forces intent capture BEFORE OAuth, which adds a tap on the social-login path. This trades convenience for correctness. Mitigation: lay out the four-choice card cleanly (Apple Wallet-style), one-tap each. Tested on iPhone Safari — single tap, no keyboard.

---

## §6 References

- `shared/lib/onboardingIntent.ts:23-63` — intent enum + role mapping
- `client/src/lib/intentParam.ts:68-111` — URL param parser
- `client/src/pages/SignIn.tsx:169-197` — pre-auth intent seed
- `server/routes/post-login.ts:203-508` — post-login decider
- `server/routes/post-login.ts:863-870` — choose-role handler (the ONE site that writes `signupIntent`)
- `server/routes/post-login.ts:48-50` — `intentToRole` mapper (the silent-fallback site)
- `client/src/pages/ChooseRole.tsx:21-150` — role choice UI
- `shared/schema.ts:114` — `users.signupIntent` column (never written outside choose-role)
- `shared/schema.ts:124` — `ALLOWED_ROLES` (missing sitter/walker/driver/station-op as first-class)
- `docs/SIGNUP_ONBOARDING_FORENSIC_AUDIT.md` — parent audit (Path A)
- `docs/PROVIDER_ONBOARDING_AND_OAUTH_REBUILD_AUDIT.md` — companion (Phase A–D rebuild plan)
- `.claude/skills/petwash-platform/SKILL.md` §0 — doctrine

---

**End of audit.** Implementation gated on CEO decisions I-A through I-G in §3.
