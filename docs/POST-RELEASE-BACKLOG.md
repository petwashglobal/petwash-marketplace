# Pet Wash — Post-Release Engineering Backlog

Severity-ranked. Continuously improved AFTER release. Not required to
close the current release.

New findings land here by default. Something only jumps to
`RELEASE-BLOCKERS.md` if it is a P0 security / money / data-loss
issue, a direct regression of a release-blocker fix, or a test the
release requires that we can't ship without.

---

## P1

### Deferred product decisions (need product-owner input, not eng)

- **Canonical customer destination** (closed #2171). `post-login.ts`
  today emits `/prestige/home` in four branches; the counter-proposal
  is `/pet-parent/home` as the sole customer workspace with Prestige
  as an in-workspace badge. Two competing product models. Do NOT
  auto-merge until the routing owner rules.

- **CTA action-id registry** (closed #2173 without merging its
  58-commit lane). Large product lane. If we still want the
  discipline, cut a fresh focused branch from main with only
  `client/src/lib/ctaActions.ts` + regression pin.

- **Journey Brain Phase 1+2** (closed #2168). Refund-pending probe +
  JourneyCheckpoint scaffold. Product feature; re-cut from main and
  RENUMBER the `0134_journey_checkpoints` migration (slot taken by
  `0134_user_passkeys_lossless_columns`).

- **Real-browser E2E for the two above** (closed #2172). Recreate
  alongside its dependencies.

### Shipped 2026-09-03 (this session — retained for audit trail)

Every P1 that had a clear engineering fix is now on `main`:

- `#2181` — SUMIT credit-note stamp routed through fiscal outbox
  (durable + retryable via the shipped drainer).
- `#2182` — Fiscal outbox admin surface (`GET /`, `GET /:id`,
  `POST /:id/force-retry`, `POST /:id/mark-reviewed`; super-admin
  gated on writes).
- `#2183` — Provider `requestedService` preservation from CTA →
  auth → onboarding (new `client/src/lib/requestedProviderService.ts`
  + wire).
- `#2184` — `AuthRouteErrorBoundary` at `/signin`, `/login`, `/signup`
  (catches stale-chunk 404; sends `sendBeacon` fingerprint).
- `#2185` — `aiChatLimiter` + `aiUserBudget` expansion to
  `provider-console/ai/query` and every `ai-booking/*` endpoint.
- `#2186` — `scripts/verify-dist-manifest.ts` + pre-Docker CI gate
  that catches the stale-chunk 404 shape before promotion.
- `#2187` — `/api/release-info` + `scripts/critical-route-canary.sh`
  + `scripts/audit-cache-headers.sh`.
- `#2188` — `birthdayVoucher.ts` + `nayaxService.ts` per-caller log
  sanitize (LOG-2, LOG-4).

Verified equivalent-or-better already at HEAD (no port needed):

- AUTH-3 domain-based admin bypass on provider availability —
  `marketplace-bookings.ts:1631-1638` already requires
  `email_verified` on the `.endsWith('@petwash.co.il')` path.
- AUTH-4 escrow release header-only gate — `escrow.ts:148-158`
  already uses `requireAuth` + customer-id check.
- LOG-3 SUMIT body preview — `sumit-webhook.ts:283` already removed
  the `bodyPreview` field with the AUDIT-LOG-3 comment.
- LOG-5 dev-OTP log — the profile-settings.ts:379 line is no longer
  present at HEAD.
- LOG-6 5xx handlers echoing `error.message` verbatim — covered by
  `sendSanitizedError` middleware landed in earlier tasks.
- LOG-7 provider-onboarding Postgres `error.detail` — already
  sanitized at `provider-onboarding.ts:1802-1817` (AUDIT-LOG-7 comment).

## P2 — hygiene / observability

- Per-file grep-scanning pins that overlap the invariant pins already
  in `server/tests/*.regression.test.ts`. Consolidate to reduce
  duplication.

- Dependabot alert stream on the repo (3 high, 4 moderate at last
  push, now 5 high + 6 moderate + 1 low per most recent push
  banner). Triage and land the safe ones.

- `tsc --noEmit` full-repo run takes > 3 minutes in this environment.
  Investigate whether the tsconfig `include` is over-broad or if a
  `tsc --incremental` cache would help CI.

- Playwright `returning-user-passkey.e2e.spec.ts` uses stubbed
  endpoints. When the live-app-E2E infra lands (booted server +
  Firebase emulator + DB), rewrite the same scenarios against real
  runtime.

## P3 — deferred product decisions (business/vendor)

- **#135 Pet Finder** — CEO marked "off-instructions". Awaiting product
  decision before any code moves.

- **#166 Nayax letter** — external partner communication; drafted, not
  sent. Blocked on business channel.

- **#90 D-series follow-up defects** — no source documents in the repo;
  reconstruct from audit logs before actioning.

---

## Rules for editing this list

1. Every entry has file:line or endpoint anchor and one-line why.
2. Nothing moves back to `RELEASE-BLOCKERS.md` without a P0 label
   AND a written justification (security / money / data-loss / direct
   regression of a release fix).
3. When something ships, delete the entry — don't strike-through
   forever. Git history is the audit. (The 2026-09-03 shipped block
   above is the one deliberate exception: a compact list of PR
   numbers so a reviewer can find the port commit fast.)
