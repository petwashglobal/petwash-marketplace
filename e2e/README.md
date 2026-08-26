# e2e/ — Shop-checkout Playwright specs (Lane B punch-list)

Seven specs guarding the PetWash Shop card- and wallet-checkout money
paths, plus one shared fixture (`fixtures/sumit-callback.json`) and a
signing helper (`fixtures/sumitCallback.ts`). Every spec is
self-contained: it uses the `x-test-user-*` dev-only auth bypass
(`fixtures/testBypassHeaders.ts`) and soft-skips when its precondition is
missing, so the file is CI-safe even before SUMIT credentials are wired.

To run the full punch-list once test credentials land, set both
environment variables in the shell that launches Playwright and point
`baseURL` at the target environment:

```bash
export TEST_BYPASS_TOKEN=<dev-bypass-token>          # server/customAuth.ts:170
export SUMIT_WEBHOOK_SECRET=<sumit-webhook-hmac-key> # server/services/SumitClient.ts:960
export SHOP_CHECKOUT_ENABLED=true                    # unblocks POST /api/shop/checkout
# Playwright's baseURL is set by playwright.config.ts — REPLIT_DEV_DOMAIN or
# http://localhost:5000 by default.
npx playwright test e2e/
```

The real receiver is `POST /api/sumit/webhook` (not `/api/sumit/callback`
as the audit trace named it — see the "audit vs code" note in the Lane B
report). Signature header is one of `x-sumit-signature`, `x-signature`,
or `x-hub-signature-256`; value is `sha256=<HMAC-SHA256 hex over the raw
body>`. `sumitCallback.ts` handles that end-to-end. Fixtures on disk
contain only `SIGNATURE_PLACEHOLDER` strings — a real HMAC is only ever
computed at run time from `SUMIT_WEBHOOK_SECRET`.

Because `playwright.config.ts` currently sets `testDir: './tests'`, the
specs in this directory need one of:

- widen `testDir` to `['./tests', './e2e']`, or
- move `e2e/` under `tests/e2e/` (alongside the existing
  `tests/e2e/shop-checkout.e2e.spec.ts` smoke stub), or
- invoke Playwright with an explicit glob:
  `npx playwright test e2e/*.spec.ts`.

The parent agent will land whichever of these is preferred. The specs
themselves have no dependency on their directory location.
