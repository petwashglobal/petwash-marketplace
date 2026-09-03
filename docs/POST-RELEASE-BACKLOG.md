# Pet Wash — Post-Release Engineering Backlog

Severity-ranked. Continuously improved AFTER release. Not required to
close the current release.

New findings land here by default. Something only jumps to
`RELEASE-BLOCKERS.md` if it is a P0 security / money / data-loss
issue, a direct regression of a release-blocker fix, or a test the
release requires that we can't ship without.

---

## P1

- **`IsraeliDigitalReceiptService.ts:1294-1301` — SUMIT credit-note
  stamp UPDATE swallowed on error.** Local `sumitDocumentId` not
  written; ops can re-issue in SUMIT and produce the double-credit
  scenario the comment warns about. Fix: enqueue a retry into the
  `fiscal_document_outbox` (drainer already shipped this release —
  just needs the SUMIT-stamp path to write a row on failure).

- **Fiscal outbox admin surface** — a small `/api/admin/fiscal-outbox`
  read + `POST /api/admin/fiscal-outbox/:id/force-retry` and
  `POST /api/admin/fiscal-outbox/:id/mark-reviewed` so ops can act on
  `failed_needs_review` rows the drainer flags. Drainer + retry loop
  already ship — only the surface is deferred.

- **Security-floor remainder** (deferred from #2176 reconciliation
  2026-09-03; strategic wire + high-value single-file protections
  already shipped in `security-floor top-up` on this release):
  - AI-3 / AI-4 / AI-5 / AI-7 — expand `aiChatLimiter` to every AI
    endpoint (Kenzo, provider-console, ai/booking). Middleware
    exists (`server/middleware/rateLimiter.ts`, `aiUserBudget.ts`)
    and is wired into ~2 of the ~30 AI callers.
  - LOG-2 / LOG-3 / LOG-4 / LOG-6 / LOG-7 — per-caller sanitize
    sweep for `nayaxService.ts`, `sumit-webhook.ts`,
    `birthdayVoucher.ts`, generic 5xx handlers, and
    `provider-onboarding.ts:1797-1803`. The strategic
    `redactLogContext` wire in `ServerLogger.formatLog` scrubs
    known secret KEYS globally; these callers still emit big
    verbatim bodies that the redactor cannot scrub by value.
  - AUTH-3 — domain-based admin bypass on provider availability
    (still unverified at release HEAD).
  - AUTH-4 — escrow release gate depends only on a shared header
    secret; needs a second factor (auth + audit).

- **Deploy-hardening** (reclaimed from closed PR #2169 — old
  architecture, must be recreated cleanly on post-release main):
  - `scripts/verify-dist-manifest.ts` — pre-deploy check that every
    lazy chunk listed in the client manifest is present on disk.
  - `scripts/critical-route-canary.sh` — smoke-check the auth
    routes against a real browser before promoting an image.
  - `scripts/audit-cache-headers.sh` — pin the auth-route no-cache
    headers.
  - `client/src/components/AuthRouteErrorBoundary.tsx` — branded
    fallback when a lazy auth chunk 404s under the new ReturnLogin
    architecture (still possible even after eager SignUpLuxury).
  - `/api/release-info` + `/api/errors/log` endpoints for
    fingerprinted crash reporting from the auth routes.

- **CTA action-id registry** (closed #2173 without merging its
  58-commit lane). If we still want the discipline post-release,
  re-open by cutting a fresh focused branch from main with only
  `client/src/lib/ctaActions.ts` + regression pin.

- **Provider `requestedService` preservation** (closed #2170).
  Provider funnel UX bug: tapping "Become a Pet Sitter" lands on an
  empty service picker. Small fix — one new lib file + one wire.

- **Canonical customer destination** (closed #2171). `post-login.ts`
  today emits `/prestige/home` in four branches; canonical target is
  `/pet-parent/home` with Prestige as an in-workspace badge. Product
  routing decision — do NOT auto-merge until product owner rules.

- **Journey Brain Phase 1+2** (closed #2168). Refund-pending probe +
  JourneyCheckpoint scaffold. Journey Brain is product; re-cut from
  main and RENUMBER the `0134_journey_checkpoints` migration (slot
  taken by `0134_user_passkeys_lossless_columns`).

- **Real-browser E2E for provider requestedService + canonical
  destination** (closed #2172). Recreate alongside its dependencies
  above.

## P2 — hygiene / observability

- Per-file grep-scanning pins that overlap the invariant pins already
  in `server/tests/*.regression.test.ts`. Consolidate to reduce
  duplication.

- Dependabot alert stream on the repo (3 high, 4 moderate at last
  push). Triage and land the safe ones.

- `tsc --noEmit` full-repo run takes > 3 minutes in this environment.
  Investigate whether the tsconfig `include` is over-broad or if a
  `tsc --incremental` cache would help CI.

- Playwright `returning-user-passkey.e2e.spec.ts` uses stubbed
  endpoints. When the live-app-E2E infra lands (booted server +
  Firebase emulator + DB), rewrite the same scenarios against real
  runtime.

## P3 — deferred product decisions

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
   forever. Git history is the audit.
