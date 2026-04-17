# PR_REVIEW_STANDARD.md
> Established: 2026-04-17 (session 4)  
> Status: MANDATORY — applies to all PRs on this platform  
> Source: EXECUTION_SCOREBOARD.md, problem statement session 3 + session 4  
> Template: `.github/PULL_REQUEST_TEMPLATE.md`

---

## Why This Standard Exists

This platform previously had a pattern of PRs that fixed code without proving business impact, accepted changes without formal criteria, and generated fake-progress signals. The scoreboard and truth maps introduced in prior sessions fixed the tracking problem. This standard fixes the PR description problem.

The standard forces every engineer to answer three questions that are easy to skip:
- What real user pain was reduced?
- What risk still remains?
- What is deliberately not solved yet?

Without these answers, architecture review cannot distinguish a finished fix from a temporary patch.

---

## The Six Required Sections

Every PR on this platform must include all six sections below. Incomplete PRs are not ready for review.

### 1. Technical Root Cause

**What it is:** The proven cause of the problem. Not a hypothesis. Not an observation. A proven cause backed by evidence — a truth map, a log, a test, a code trace.

**Why it matters:** If the cause is wrong, the fix is wrong. Separating proven cause from assumed cause is the first discipline of platform engineering.

**Acceptance bar:** The root cause must reference a specific document, log line, or code location. "I noticed the code was slow" does not pass. "Lines 400–428 in booking-requests.ts fire two overlapping dispatchers simultaneously, as documented in MESSAGING_ACCEPTANCE_MATRIX.md §BOOKING_CREATED" does pass.

---

### 2. Exact Code Change

**What it is:** A file-by-file description of what was changed and why. Precise, not vague.

**Why it matters:** Vague descriptions ("improved notification handling") make it impossible to verify that the change matches the root cause. Precise descriptions make review fast and make rollback safe.

**Acceptance bar:** Every modified file must be listed. Each entry must state the exact behaviour that changed (function removed, guard added, field renamed, route mounted). Before/after code blocks are welcome but not required if the description is precise.

---

### 3. Acceptance Proof

**What it is:** A checklist of criteria that were verified. Each item is either ✅ PASSED or ⚠️ PENDING.

**Why it matters:** Without explicit criteria, "it works" is meaningless. Explicit criteria create a contract between the engineer and the reviewer. Pending items must state what evidence is still required and by when — they are not a reason to block merge if the reason is a 30-day observation window.

**Acceptance bar:** Every behavioural claim in the root cause must appear as a criterion. If telemetry was added, the tag name must be listed. Pending criteria must have a defined window and owner.

---

### 4. Business Impact

**What it is:** One plain-English paragraph describing what user problem is now reduced.

**Why it matters:** Code changes without user impact are maintenance. This section forces the engineer to connect the fix to a user journey: booking, notification, login, payment, loyalty. If no user pain is reduced, the PR should ask whether the work belongs on the scoreboard.

**Acceptance bar:** The paragraph must name a specific user role (customer, provider, admin), a specific flow (booking creation, checkout, login), and a specific symptom that is now reduced (duplicate notifications, missing booking history, fake crash alerts).

---

### 5. Remaining Risk

**What it is:** An honest statement of what risk still exists after this PR.

**Why it matters:** Declaring a PR "done" while leaving active risks undocumented is how debt hides. Stating risk explicitly is not weakness — it is the only way the next engineer knows what they are inheriting.

**Acceptance bar:** Must address data risk (split truth, stale rows), operational risk (degraded integrations, unmonitored paths), and user risk (affected flows not yet migrated). "None" is acceptable only when it can be supported by evidence. Leaving this section blank is not acceptable.

---

### 6. What Is Not Solved Yet

**What it is:** An explicit list of what this PR deliberately did not change, and why.

**Why it matters:** Every PR that fixes one side of a problem leaves the other side open. If the read side is fixed but the write side is not, that must be stated. If the backend is fixed but the frontend is not migrated, that must be stated. This section prevents premature celebration.

**Acceptance bar:** Must reference the next required action for this scoreboard item. If the answer is "nothing — this is complete" then the scoreboard item must be advanced to DONE.

---

## Scoreboard Reference (Required)

Every PR must reference its EXECUTION_SCOREBOARD.md entry:
- Which item does it close, advance, or open?
- What does the status change to?
- What is the next required action after merge?

PRs that do not touch the scoreboard must explain why (e.g., "hotfix — no scoreboard item exists; opening item PR9 in this PR").

---

## Enforcement — Five Rejection Triggers

These rules are active. Reviewers must reject PRs that violate any of them. There are no exceptions and no grace period.

### Trigger 1 — Missing section

A PR that omits any of the six required sections is not ready for review. The reviewer must request changes immediately, without reading the rest of the PR. "I forgot" and "it was obvious" are not valid responses. The template exists precisely to prevent this.

### Trigger 2 — "Fixed" without acceptance proof

A PR that describes a problem as "fixed", "resolved", or "done" without a corresponding acceptance criterion marked ✅ PASSED is making an unverified claim. Unverified claims are the origin of fake progress. The reviewer must request the missing proof before approving. If the proof requires a 30-day observation window, the criterion must be listed as ⚠️ PENDING with the window and owner named — that is acceptable. Silence is not.

### Trigger 3 — Hidden remaining risk

A PR that leaves section 5 blank, writes "N/A" without evidence, or describes risk only in vague terms ("may have edge cases") is hiding information. Risk that is not named cannot be tracked, mitigated, or handed off. The reviewer must request a specific statement covering data risk, operational risk, and user risk before approving.

### Trigger 4 — Domain mixing without scoreboard reference

A PR that touches more than one domain (e.g., booking + messaging, identity + provider) without a scoreboard reference for each domain is creating invisible debt. Cross-domain changes must either be split into separate PRs or must include one scoreboard reference per domain affected, with explicit justification for why they were combined. A PR that mixes domains and references only one scoreboard item must be returned for correction.

### Trigger 5 — Live-path removal without telemetry evidence

A PR that deprecates, removes, gates, or redirects any endpoint, route, function, or service path that may still have active callers must provide one of the following before merge:

1. **Telemetry evidence** — a named telemetry tag showing zero callers over a defined observation window (minimum 30 days unless the path was introduced in the same release cycle), or
2. **Route truth proof** — a truth map showing the path is unreachable under all known client versions and traffic sources, with the evidence document linked directly in section 1 of the PR.

A PR that says "this path is dead" without one of the above is making an unverifiable claim. Dead-path claims have been a significant source of production incidents on this platform. The reviewer must request evidence before approving removal. "I believe no one uses it" and "the old code looks unused" are not evidence.

This trigger applies to: API routes, Cloud Functions, Cloud Run handlers, Firebase callable functions, client-side navigation paths, feature flags that gate functional code, and any service method that is exposed across module boundaries.

**Required inline evidence block** — every PR that invokes Trigger 5 must include the following four fields directly in section 1 (Technical Root Cause). Reviewers must not accept a vague prose description as a substitute:

| Field | What to provide |
|-------|----------------|
| Telemetry tag | The exact tag name used to measure callers (e.g. `[PROVIDER_LEGACY_READ]`) |
| Observation window | Start date → end date; minimum 30 days; zero-caller result stated explicitly |
| Truth map document | Link to the route truth document that confirms the path is unreachable (e.g. `docs/architecture/PROVIDER_ROUTE_TRUTH.md §DEAD_PATHS`) |
| Exact path removed | The full path identifier being removed (e.g. `GET /api/provider/legacy-profile`, function `getLegacyProviderProfile`) |

If telemetry was not instrumented before the observation window, the window cannot be counted retroactively. The engineer must add instrumentation, wait the minimum window, then submit the removal PR.

---

## Compliance Map — Existing PRs

The eight completed PRs have been retroactively mapped to this standard. Each section is confirmed present in EXECUTION_SCOREBOARD.md.

| PR | Root Cause | Code Change | Acceptance | Business Impact | Remaining Risk | Not Solved |
|----|-----------|-------------|------------|-----------------|---------------|------------|
| PR1 Booking reads | ✅ | ✅ | ⚠️ (telemetry pending) | ✅ | ✅ | ✅ |
| PR2 Messaging dedup | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PR3 Identity reads | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PR4 Marketplace | ✅ | ❌ (blocked) | ❌ (blocked) | ✅ | ✅ | ✅ |
| PR5 Cloud Run | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PR6 Popup suppression | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PR7 Provider dedup | ✅ | ✅ | ⚠️ (telemetry pending) | ✅ | ✅ | ✅ |
| PR8 Loyalty isolation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

PR4 is blocked at the decision gate — code change and acceptance proof will be added once the write-volume check is run.

---

## Most Important Warning

> Do not confuse read unification with the problem being solved.

PR3 cleaned the read side of identity. The write split still exists underneath. Until:
1. Frontend screens migrate to `/api/auth/identity` (Wave 1 + Wave 2)
2. Writes are mirrored from `customers` → `users` (Stage 3)
3. Legacy endpoints show zero callers (30-day window)

…the identity problem is not solved. It is only observed more clearly. The same logic applies to every PR on this platform: a cleaner read layer is not a fixed write layer.

---

## Priority Order (from problem statement, session 4)

These priorities must not be reordered without a scoreboard update:

1. **Booking truth** — verify telemetry; repair write-side if splits are found
2. **Identity frontend migration** — Wave 1 screens, then Wave 2 `useIdentity()` hook
3. **Provider dead-path removal** — only after telemetry window proves zero callers
4. **Messaging Stage C cleanup** — consolidate `booking_completed` and cancellation paths
5. **Loyalty cleanup** — dead modal removal after core truth is stable

No new work outside this list until the above items advance.

---

## Change Log

| Date | Session | Change |
|------|---------|--------|
| 2026-04-17 | 4 | Document created; 6-point standard formalized; `.github/PULL_REQUEST_TEMPLATE.md` created; compliance map added for PRs 1–8 |
| 2026-04-17 | 5 | Enforcement section added with four explicit rejection triggers; PR template updated with rejection reminder block |
| 2026-04-17 | 6 | Trigger 5 added — no live-path deprecation or removal without telemetry evidence or route truth proof; PR template updated |
| 2026-04-17 | 7 | Trigger 5 evidence checklist formalized — four required inline fields (telemetry tag, observation window, truth map, exact path); PR template updated with conditional evidence block |
