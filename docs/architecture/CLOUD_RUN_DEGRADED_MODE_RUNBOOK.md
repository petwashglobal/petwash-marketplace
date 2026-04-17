# CLOUD_RUN_DEGRADED_MODE_RUNBOOK.md
> Branch: copilot/fix-loyalty-flow-issues  
> Generated: 2026-04-17 as part of PR5 acceptance verification  
> Source: server/hubspot.ts, server/spotify.ts, docs/architecture/INTEGRATION_HEALTH_MASTER.md

---

## What "Degraded Mode" Means

Degraded mode is the state the server enters on Cloud Run (or any non-Replit environment) when optional Replit-only integrations are not available. The application starts, accepts traffic, and serves all core features. Optional integrations are silently skipped with a warn-level log.

**Degraded mode is not an error state. It is the correct and expected state on Cloud Run.**

The following is always true in degraded mode:
- Server binds port and returns 200 on health checks
- Firebase Auth works (cloud-native, no Replit dependency)
- Postgres / Drizzle works (cloud-native)
- Firestore works (cloud-native)
- All booking, loyalty, payment, provider, and wallet routes work
- SendGrid email works
- Twilio SMS works
- FCM push notifications work
- Google Maps, Gemini AI work if env vars are set
- Nayax/Tranzila payment processing works

---

## Which Integrations Are Optional (Replit-Only)

| Integration | File | Env Vars Required | On Cloud Run | Degraded Behaviour |
|---|---|---|---|---|
| **HubSpot CRM** | server/hubspot.ts | `REPLIT_CONNECTORS_HOSTNAME` + `REPL_IDENTITY` OR `WEB_REPL_RENEWAL` | ❌ Not available | `syncUserToHubSpot` returns `{ degraded: true }` — no throw. `trackHubSpotEvent` returns `{ degraded: true }` — no throw |
| **Spotify** | server/spotify.ts | `REPLIT_CONNECTORS_HOSTNAME` + `REPL_IDENTITY` OR `WEB_REPL_RENEWAL` | ❌ Not available | `getSpotifyUserProfile` returns `null`. `getSpotifyNowPlaying` returns `null`. `/api/spotify/status` returns `{ connected: false, reason: 'degraded' }` |

---

## IS_REPLIT Detection Logic

Both integrations use the same guard:

```typescript
const IS_REPLIT = !!(
  process.env.REPL_IDENTITY ||
  process.env.WEB_REPL_RENEWAL ||
  process.env.REPLIT_CONNECTORS_HOSTNAME
);
```

- **Replit dev/prod**: at least one of these is set → `IS_REPLIT = true` → connectors work normally
- **Cloud Run**: none of these are set → `IS_REPLIT = false` → degraded mode

---

## Startup Logs to Watch

On Cloud Run startup, both degraded modules log once at `warn` level:

| Log Tag | Module | Message |
|---|---|---|
| `[HUBSPOT_DEGRADED]` | server/hubspot.ts | `[HubSpot] [HUBSPOT_DEGRADED] Replit-only integration — running in degraded mode (Cloud Run / non-Replit env). All HubSpot calls will be silently skipped.` |
| `[SPOTIFY_DEGRADED]` | server/spotify.ts | `[Spotify] [SPOTIFY_DEGRADED] Replit-only integration — running in degraded mode (Cloud Run / non-Replit env). All Spotify calls will return null.` |

These two warn lines on startup are **expected and correct** on Cloud Run. If you do not see them on Replit, also correct — Replit has the env vars so IS_REPLIT is true.

### Per-call degraded logs

When a degraded integration is called at runtime:

| Log Tag | When |
|---|---|
| `[HUBSPOT_DEGRADED] syncUserToHubSpot skipped` | After user registration on Cloud Run |
| `[HUBSPOT_DEGRADED] trackHubSpotEvent skipped` | After loyalty join on Cloud Run |

These are also expected. They confirm the degraded path is running correctly.

---

## What Must Still Work in Degraded Mode

| Feature | Expected Behaviour | How to Verify |
|---|---|---|
| Server startup | Port bound within 15s, `/api/status` returns 200 | `curl https://<cloudrun-url>/api/status` |
| User registration | Firebase + Postgres row created, welcome email sent | Create test account, check `users` table and SendGrid |
| Booking flow | booking_requests row created, notifications sent | POST /api/booking-requests, check notificationLogs |
| Loyalty | Points credited, tier updated in users table | POST /api/loyalty, check loyalty_ledger |
| Provider approval | Admin approves, provider_approved notification sent | Admin portal → approve application |
| Payments (Nayax) | K9000 wash transactions processed | K9000 → complete wash → check nayaxTransactions |
| HubSpot sync | Skipped silently, `[HUBSPOT_DEGRADED]` logged | Check Cloud Run logs for `[HUBSPOT_DEGRADED]` |
| Spotify endpoints | `/api/spotify/status` → `{ connected: false }` | GET /api/spotify/status |

---

## What Does NOT Work in Degraded Mode (By Design)

| Feature | Gap | Impact |
|---|---|---|
| HubSpot contact sync | CRM contacts not created/updated on Cloud Run | HubSpot CRM will not reflect new Cloud Run registrations until Replit sync is re-established |
| HubSpot event tracking | Lifecycle events (registration, prestige join) not tracked | HubSpot timeline incomplete |
| Spotify user profile | `/api/spotify/profile` returns `{ success: true, profile: null }` | Any UI that reads Spotify profile data shows null state |
| Spotify now playing | `/api/spotify/now-playing` returns `{ success: true, nowPlaying: null }` | Now-playing widget shows empty |

These are all non-critical features. **No booking, loyalty, payment, or identity flow depends on HubSpot or Spotify.**

---

## Alert / Escalation Thresholds

| Log Pattern | Frequency | Action |
|---|---|---|
| `[HUBSPOT_DEGRADED]` on startup | Once per deploy | Expected — no action |
| `[HUBSPOT_DEGRADED] syncUserToHubSpot skipped` | Per registration | Expected — no action |
| `[HUBSPOT_DEGRADED]` appearing in Replit env | Any | ⚠️ ALERT — `IS_REPLIT` detection broken, check env vars |
| `[SPOTIFY_DEGRADED]` on startup | Once per deploy | Expected — no action |
| `[SPOTIFY_DEGRADED]` appearing in Replit env | Any | ⚠️ ALERT — `IS_REPLIT` detection broken |

---

## Recovery Procedure (If HubSpot Sync Is Required on Cloud Run)

HubSpot currently requires Replit connectors for OAuth token refresh. To enable HubSpot on Cloud Run:

1. Set `HUBSPOT_ACCESS_TOKEN` as a Cloud Run secret (static PAT — long-lived token from HubSpot developer portal)
2. Update `getUncachableHubSpotClient()` in `server/hubspot.ts` to use `HUBSPOT_ACCESS_TOKEN` env var if `IS_REPLIT` is false
3. Remove `IS_REPLIT` guard from `syncUserToHubSpot` and `trackHubSpotEvent`
4. Test with Cloud Run deploy

This is NOT required now. The degraded mode is the accepted production state for Cloud Run until a proper HubSpot long-lived token is provisioned.

---

## Before/After Acceptance Criteria (PR5)

### Before PR5

```
Cloud Run startup:
  server/hubspot.ts loads → setInterval starts → first tick → getAccessToken() called
  → xReplitToken = null (REPL_IDENTITY not set)
  → throw new Error('X_REPLIT_TOKEN not found for repl/depl')
  → Unhandled exception in setInterval → logged as ERROR
  
Any request that triggers syncUserToHubSpot:
  → getAccessToken() throws
  → caller's .catch() fires → logs warn
  (recoverable, but noisy)
```

### After PR5

```
Cloud Run startup:
  IS_REPLIT = false (none of REPL_IDENTITY, WEB_REPL_RENEWAL, REPLIT_CONNECTORS_HOSTNAME set)
  → logger.warn('[HUBSPOT_DEGRADED] ...') — one line at startup
  → no setInterval retry loop for token (fast-path return)
  → no throw, no error
  
Any request that triggers syncUserToHubSpot:
  → IS_REPLIT check → return { degraded: true }
  → caller never reaches .catch()
  → zero error noise
  
GET /api/spotify/status on Cloud Run:
  → getSpotifyUserProfile() → null
  → { success: true, connected: false, reason: 'degraded' }
  → HTTP 200 (was: getAccessToken() throws → HTTP 500)
```
