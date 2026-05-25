# Secret Audit + Maya USA Voice Diagnosis — 2026-05-25

**Scope:** Operator (`nir.h@petwash.co.il`) reported two production issues + asked for a secret-drift audit across GitHub Actions / GCP Secret Manager / application code.

**Type:** Audit / diagnosis document. No runtime change introduced by this PR.

**Caveat on what I can verify:** I have access to the workflow YAML, the application source code, and `cloudrun-service.yaml`. I do **NOT** have access to the actual VALUES of any secret in GitHub Actions or GCP Secret Manager. Findings about value drift are inferences from name references. Every finding tagged **OPERATOR-VERIFY** needs you to log into the GCP console or GitHub Settings to confirm.

---

## 1. Maya USA "error voice message" — diagnosis

### Symptom (per operator)
> "Maya don't answer the phone in USA when I ring it say error system voice message by computer"

### Why it sounds like "error system voice message by computer"

That's almost certainly **Twilio's default fallback TwiML** — usually one of:

| Twilio default message | Triggered when |
|---|---|
| *"An application error has occurred. Goodbye."* | TwiML webhook returns 4xx/5xx, or returns non-XML body, or HMAC fails (we return `403 JSON`) |
| *"We're sorry; an application error has occurred. Goodbye."* | Same — different vintage |
| *"We are unable to fulfill your request at this time. Please try your call later."* | Twilio account suspended or geo-permission missing |

PetWash's intended message (when Maya is unavailable) is bilingual Hebrew/English at `server/routes/maya-voice-twilio.ts:167-176`:

```xml
<Response>
  <Say language="he-IL">אנחנו לא זמינים כרגע. אנא נסו שוב מאוחר יותר.</Say>
  <Say language="en-US">We are not available right now. Please try again later.</Say>
  <Hangup/>
</Response>
```

If you heard **that** message, the system was working as designed (Maya disabled via flag). If you heard a different "error system voice message by computer," it was Twilio's default — and that means our webhook response is failing before our TwiML can speak.

### Most likely root cause (P0 hypothesis — verify first)

**`TWILIO_AUTH_TOKEN` is empty, wrong, or rotated in GitHub Actions secrets** → synced empty to GCP → app reads empty → HMAC signature verification fails-closed → returns `403 JSON` (not TwiML) → Twilio plays its default "application error" message.

Evidence chain:

1. `server/services/voice/TwilioVoiceProvider.ts:75-79`:
   ```ts
   if (!authToken) {
     // No token configured — fail-closed. Production must set TWILIO_AUTH_TOKEN.
     logger.warn({}, 'TwilioVoiceProvider: TWILIO_AUTH_TOKEN not set; rejecting');
     return false;
   }
   ```
2. `server/routes/maya-voice-twilio.ts:64-70`:
   ```ts
   // HMAC verification middleware. Aborts with 403 (no TwiML, no audio leak).
   async function requireValidSignature(req: Request, res: Response, next: NextFunction) {
     const ok = await getProvider().verifySignature(req, '');
     if (!ok) {
       logger.warn({}, 'maya twilio: signature verification failed');
       return res.status(403).json({ ok: false, error: 'invalid_signature' });
     }
     ...
   ```
3. Twilio, when its webhook returns 403 (or any non-TwiML response), plays its built-in "application error has occurred" message to the caller. **This matches the operator's description.**

### How to verify (operator action, 5 minutes)

```bash
# 1. Confirm the secret exists and has SOMETHING in it (won't show the value)
gcloud secrets versions describe latest --secret=TWILIO_AUTH_TOKEN --project=signinpetwash

# 2. Hash-compare the GCP value with what Twilio Console shows you
#    (Twilio Console → Account → API keys & tokens → AUTH TOKEN → reveal)
TWILIO_CONSOLE_TOKEN="<paste from Twilio Console>"
GCP_TOKEN=$(gcloud secrets versions access latest --secret=TWILIO_AUTH_TOKEN --project=signinpetwash)
[ "$TWILIO_CONSOLE_TOKEN" = "$GCP_TOKEN" ] && echo "MATCH ✓" || echo "DRIFT ✗ — sync from Twilio Console"

# 3. If they don't match, update GCP:
echo -n "$TWILIO_CONSOLE_TOKEN" | gcloud secrets versions add TWILIO_AUTH_TOKEN \
  --data-file=- --project=signinpetwash

# 4. Update the GitHub Actions secret to match (so future deploys sync correctly):
# GitHub → repo Settings → Secrets and variables → Actions → TWILIO_AUTH_TOKEN → Update
```

### Second-most-likely cause (P1)

**`TWILIO_VOICE_PUBLIC_URL` doesn't match what Twilio Console has configured as the webhook URL.**

HMAC verification is computed using the URL Twilio called. If our code reconstructs a DIFFERENT URL (because `TWILIO_VOICE_PUBLIC_URL` is wrong or unset and the header-derived URL differs), HMAC won't match even with a correct auth token.

`server/services/voice/TwilioVoiceProvider.ts:18-19`:
```
*   TWILIO_VOICE_PUBLIC_URL    — full https URL the webhook is reachable at
*                                (optional; otherwise built from request headers)
```

**Verify:** in Twilio Console → Phone Numbers → [the USA number] → Voice Configuration → **A call comes in / Webhook**. Whatever URL is there MUST match either:
- `process.env.TWILIO_VOICE_PUBLIC_URL` (if set in GCP Secret Manager), OR
- The derived URL from `https://<host-of-cloud-run-or-firebase>/api/maya/voice/twilio/voice`

If the Twilio Console points to an old Cloud Run URL (e.g. `petwash-api-OLD-HASH.a.run.app`), that's the bug.

### Third theory (P2)

**Twilio account doesn't have inbound USA geo-permissions** OR **the USA number isn't actually a Twilio number** (maybe a forwarder).

If you call a USA number and Twilio rejects it at the account level, you'd hear an account-suspended-style message, not the "application error" pattern. But worth checking:

- Twilio Console → Voice → Geographic Permissions → confirm USA outbound *and* inbound are both enabled
- Twilio Console → Phone Numbers → confirm the USA number is provisioned and **Voice URL** is set (not just SMS)

### What's NOT the bug (ruled out by code)

- **NOT the Maya master switch.** `ff.maya.voice.enabled` defaults to `true` in `server/services/SystemConfig.ts:119` and SystemConfig is in-memory-only (no DB drift)
- **NOT the inbound flag.** `ff.maya.voice.inbound.enabled` also defaults `true` in same file
- **NOT CSRF.** Already exempted per merged PR #439
- **NOT a missing application code path.** The TwiML handlers are mounted at `/api/maya/voice/twilio/{voice,gather,status}` per `server/routes.ts:455`

### Recommended fix order

1. **First** — verify `TWILIO_AUTH_TOKEN` matches Twilio Console (P0)
2. **Second** — verify Twilio Console webhook URL matches our expected path (P1)
3. **Third** — verify Twilio account geo-permissions allow USA inbound (P2)
4. **If all three pass and it still doesn't work** — add a temporary diagnostic endpoint that logs HMAC verification details (signature received vs computed) so we can see the exact mismatch. This is its own focused code PR.

---

## 2. Secret audit — workflow vs GCP Secret Manager vs code

### Method
- Listed every `X=Y:latest` mapping in `.github/workflows/petwash-ci.yml` (the CI mounts these to Cloud Run)
- Listed every `${{ secrets.X }}` reference in the same workflow (GitHub Actions secrets the CI reads)
- Listed every secret in `cloudrun-service.yaml` (orphan documentation — the file is NOT applied by the actual deploy step, per earlier audit)
- Listed every `process.env.X` reference in `server/**/*.ts` (343 distinct env vars the application reads)

### Findings — drift between layers

#### 🔴 NAMING MISMATCHES (must be operator-fixed)

| GCP Secret Manager (workflow expects) | App code reads | Notes |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | `process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON` AND `process.env.GOOGLE_SERVICE_ACCOUNT_JSON` | Workflow mounts the secret under BOTH env var names (correct — see line 990: `"GOOGLE_APPLICATION_CREDENTIALS_JSON=GOOGLE_SERVICE_ACCOUNT_JSON:latest"`). Safe. |
| `APPLE_WALLET_*` (5 secrets) | `process.env.APPLE_*` AND `process.env.APPLE_SIGNER_*` AND `process.env.APPLE_WWDR_*` | The compat shim at `server/lib/wallet-env-compat.ts:25-30` maps `APPLE_WALLET_*` GCP secret names onto BOTH legacy and modern code names. **OPERATOR-VERIFY:** the actual cert values in GCP must be valid PEM-encoded, base64-decoded, with matching private key. Inspector A noted today: "every wallet endpoint returns HTTP 503 — `AppleWalletService.hasValidCertificates()` returns false." → most likely the GCP secret VALUES are empty or wrong format. |
| `GOOGLE_API_KEY` (referenced in `cloudrun-service.yaml:42`) | `process.env.GOOGLE_API_KEY` (read in `server/index.ts:62`) | **NOT in workflow mappings at all.** Workflow only syncs `GOOGLE_MAPS_API_KEY`. If GCP has a separate `GOOGLE_API_KEY` secret, it's not being mounted. If the app needs it, the call paths that use it will fail silently. |
| `FIREBASE_SERVICE_ACCOUNT_KEY` (referenced in `cloudrun-service.yaml:52`) | `process.env.FIREBASE_SERVICE_ACCOUNT_KEY` (referenced from a few code paths) | Workflow explicitly comments at line 974-977: *"FIREBASE_SERVICE_ACCOUNT_KEY removed from required mappings. Cloud Run uses Application Default Credentials via the service account's IAM roles."* Code paths that still read this var will get `undefined` — verify they all have fallback to ADC. |

#### 🟡 GITHUB SECRET → GCP SYNC PATHS (operator-verify each value is current)

The workflow has SEVERAL "sync from GitHub Actions secret to GCP Secret Manager" steps. Each is one-way (GitHub → GCP). If the GitHub secret holds an OLD value (e.g. a rotated API key), every deploy overwrites GCP with the old value.

| Sync step (workflow line) | Source: GitHub Actions secret | Sink: GCP Secret Manager | Risk if GitHub value is stale |
|---|---|---|---|
| ~651 | `GOOGLE_MAPS_API_KEY` | `GOOGLE_MAPS_API_KEY` | Maps API key rotated in GCP Console → next deploy overwrites with stale GitHub value → maps + places autocomplete break |
| ~700 | `SENDGRID_API_KEY` | `SENDGRID_API_KEY` | Same risk for transactional email |
| ~720 | `RECAPTCHA_SECRET_KEY` | `RECAPTCHA_SECRET_KEY` | Same risk for CAPTCHA |
| ~740 | `GEMINI_API_KEY` | `GEMINI_API_KEY` | Same risk for AI |
| ~760 | `SUPER_ADMIN_EMAILS` | `SUPER_ADMIN_EMAILS` | If list edited in GCP but not GitHub, next deploy overwrites |
| ~780 | `FIREBASE_WEB_API_KEY` + 6 other Firebase client config | each | Same risk for client Firebase init |
| ~810 | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | each | **THIS IS THE MOST LIKELY MAYA-USA ROOT CAUSE** — if Twilio rotated the auth token (or you regenerated it for any reason), GCP gets stale value on next deploy |
| ~840 | Various Tranzila secrets | each | Crown-jewel — verify carefully before any rotation |

**OPERATOR-VERIFY (one-time audit, ~30 minutes):** For each row above, log into the vendor console (Twilio, SendGrid, reCAPTCHA, Google Cloud, etc.), copy the current production value, and compare against:
- GitHub: repo Settings → Secrets and variables → Actions → [secret name] → Update (you can paste the value to verify the field accepts it; GitHub doesn't show the existing value)
- GCP: `gcloud secrets versions access latest --secret=<NAME> --project=signinpetwash`

If they don't all match, the vendor value is the source of truth — push it to GitHub, let CI sync to GCP on the next deploy.

#### 🟢 SECRETS IN WORKFLOW BUT NOT YET CREATED IN GCP (would fail if promoted from optional → required)

These were the cause of PR #447's broken deploy. They're currently in `optional_mappings` (safe — deploy skips them if missing):

- `SUPER_ADMIN_UID` — needed by `disputes.ts:27-36` for dispute endpoints
- `ADMIN_APPROVER_EMAIL` — needed by `post-login.ts:13` for admin approval emails
- `FINANCE_AUTHORIZED_EMAILS` — needed by `bank.ts:83` for finance admin gating
- `SUPER_ADMIN_ALERT_PHONE` — emergency SMS pager (always optional)
- `VITE_TURNSTILE_SITE_KEY` — needed by `client/src/components/TurnstileWidget.tsx` for bot protection
- `VITE_FIREBASE_APPCHECK_SITE_KEY` — needed by `firebase.ts:109` for App Check

**OPERATOR-ACTION:** Create each in GCP Secret Manager when ready. Values are in `.replit` at the repo root (the legacy reference file).

#### 🟡 ORPHAN SECRETS (in cloudrun-service.yaml but NOT in workflow)

`cloudrun-service.yaml` is not applied by the current deploy (per audit in PR #448's body). These secrets are referenced ONLY in the orphan yaml — not actually mounted:

- `GOOGLE_API_KEY` (≠ `GOOGLE_MAPS_API_KEY`)
- `FIREBASE_SERVICE_ACCOUNT_KEY` (Cloud Run uses ADC instead)
- `WALLET_LINK_SECRET` — referenced in cloudrun yaml line 94 but NOT in workflow required_mappings; however IS in workflow optional_mappings line 1001 ✓
- `MOBILE_LINK_SECRET` — same, optional only

**No action required unless the app actively reads these as undefined**. Run a one-line grep:
```bash
grep -rn "process.env.GOOGLE_API_KEY\|process.env.FIREBASE_SERVICE_ACCOUNT_KEY" server/ --include="*.ts"
```
If results exist, those code paths get `undefined` in production. Either remove the references or wire the secrets.

#### 🟢 CONFIRMED-SYNCED (no action needed if vendor values are stable)

About 60 secrets are correctly wired through:
1. GCP Secret Manager has them
2. Workflow `required_mappings` mounts them onto Cloud Run
3. App reads `process.env.X` and gets the right value

These include core auth secrets (`JWT_SECRET`, `COOKIE_SECRET`, `SESSION_SECRET`), database (`DATABASE_URL`), and the bulk of vendor integrations.

---

## 3. Past missions — open issues count

I tried to pull the open-issues list via the GitHub MCP tool, but the response was 90KB+ — too large to triage in this turn without losing focus on the current bugs.

**Inferred from the count:** the screenshot shows **15 open issues** + **122 Security and quality findings**. That's a real backlog.

**Recommended next session:**
1. One agent does a triage pass on the 15 open issues → "must-fix, nice-to-have, can-close"
2. Separate agent triages the 122 Security and quality findings into "real CVE / false positive / accept the risk"
3. Output: a single prioritized backlog document at `docs/audit/2026-05-25-backlog-triage.md`

I have not done this in this PR because the user-blocking items (Maya USA + secret drift) take precedence. Defer to a focused session.

---

## 4. Recommended action priority

In order of "user-frustrating impact ÷ effort":

| # | Action | Who | ETA | Risk |
|---|---|---|---|---|
| 1 | Verify `TWILIO_AUTH_TOKEN` value in GitHub + GCP matches Twilio Console (P0 for Maya USA) | Operator | 5 min | None |
| 2 | Verify Twilio Console webhook URL matches `/api/maya/voice/twilio/voice` on the current Cloud Run service | Operator | 5 min | None |
| 3 | Verify Twilio geo-permissions allow USA inbound | Operator | 2 min | None |
| 4 | Add the 6 missing optional secrets to GCP (SUPER_ADMIN_UID, ADMIN_APPROVER_EMAIL, FINANCE_AUTHORIZED_EMAILS, SUPER_ADMIN_ALERT_PHONE, VITE_TURNSTILE_SITE_KEY, VITE_FIREBASE_APPCHECK_SITE_KEY) | Operator | 30 min | None — values are in `.replit` |
| 5 | Audit each GitHub→GCP sync source (Maps, SendGrid, reCAPTCHA, Gemini, Firebase client config, Twilio, Tranzila) to confirm GitHub holds the current vendor value | Operator | 30 min | None — non-destructive read |
| 6 | Decide on `GOOGLE_API_KEY` vs `GOOGLE_MAPS_API_KEY` — do we need both? If yes, add `GOOGLE_API_KEY` to workflow mappings. If no, remove from `cloudrun-service.yaml` to stop the false reference. | Operator + agent (single PR) | 30 min | Low |
| 7 | Delete `cloudrun-service.yaml` OR refactor the deploy to actually use it (orphan file is causing audit confusion) | Agent (single PR) | 1 hr | Low |
| 8 | Add startup diagnostic: log presence/absence of key secrets at boot (no values, just names) so future drift gets caught at deploy time, not when a customer calls | Agent (single PR) | 2 hr | Low |
| 9 | PR-2 from SDD: capture `firstName` on phone OTP signup (fixes "Pet Parent" bug) | Agent (single PR) | 2-3 hr | Low |
| 10 | Triage 15 open GitHub issues into must-fix/nice-to-have/close | Agent (separate session) | 1 hr | None |
| 11 | Triage 122 Security/quality findings | Agent (separate session) | 1-2 hr | None |

Items 1-5 are **operator-only**. I cannot do them — secrets aren't accessible from this environment.

Items 6-11 are **agent-doable** as separate focused PRs once the operator says go.

---

## 5. What this PR explicitly does NOT do

- Does not change any application code
- Does not modify the CI workflow
- Does not modify any secret values (impossible from this environment)
- Does not touch any crown-jewel system
- Does not promise that items 1-5 will fix Maya USA — those are the highest-probability theories, but only operator verification can confirm
- Does not triage the 15 open issues or 122 Security findings — separate sessions, separate focus
