# Nayax go-live: secrets audit + setup checklist (2026-06-29)

Plain-language record of the GCP Secret Manager audit (CEO + agent, 2026-06-29) and
the exact steps to bring the K9000 Nayax flows live. **The agent never handles secret
values or the GCP console** — it verifies against code; the CEO/ops sets values.

## How secrets reach the running server (the "fix first" fact)
Runtime secrets live in **GCP Secret Manager** and are mounted into Cloud Run by the
deploy (`.github/workflows/petwash-ci.yml`). The deploy uses
`secrets_update_strategy=overwrite`, so a secret only reaches the server **if it is
listed in the mapping array** in that workflow. Putting a value in Secret Manager
alone is not enough.

- GitHub Actions secrets = for the build/deploy robot, **not** runtime.
- The Lynx + Cortina token mappings were wired in #1157 (optional → auto-mount once created).

## Secret audit — KEEP vs DELETED
Cross-referenced all secrets against `process.env` / `import.meta.env` reads + the
deploy workflow. **DELETED 2026-06-29 (confirmed unused — Replit/legacy leftovers):**
`PGDATABASE, PGHOST, PGPASSWORD, PGPORT, PGUSER` (app uses `DATABASE_URL` only),
`CS_BACKUP_BUCKET` (typo twin of `GCS_BACKUP_BUCKET`), `GOOGLE_AGENT_ID`,
`GOOGLE_AGENT_LOCATION`, `GOOGLE_DIALOGFLOW_PROJECT_ID` (dead chatbot),
`METRICS_AUTH_TOKEN`.

**CHECK INTENT then decide:** `SUMIT_MARKETPLACE_CONTRACT_CONFIRMED` — no code reads
it; likely a human "contract signed" marker. Delete if just a note; keep if a record.

**KEEP — all others are really used.** Never delete the salts/keys
(`KYC_SALT, VOUCHER_SALT, *_SECRET, *_KEY, VOUCHER_ES256_*`) — that breaks existing
encrypted data. All `VITE_*` are used at build time. `NAYAX_SECRET` (not
`NAYAX_SECRET_KEY`) is the real one; `routes.ts:803` reads a non-existent
`NAYAX_SECRET_KEY` (harmless always-off branch — optional tiny cleanup).

## Two Nayax integrations we use (and only these)
- **In-Person Payments → Static QR (Cortina)** — pre-paid wash redeem at the bay.
- **Operations & Management → Lynx API** — inventory / devices / reports.
(Skip Marshall, Spark, OCPI, EMV, DynamicQR, Fuel.)

## Go-live setup checklist
### A. Lynx (self-serve — do now)
1. Nayax Core → 👤 (top-right) → Account Settings → **Security and Login** → **User
   Tokens** → **Show Token** → copy.
2. GCP Secret Manager → create **`LYNX_USER_TOKEN`** = that token.
3. Cloud Run → plain env **`LYNX_ENABLED=true`** (optional **`LYNX_TEST_MACHINE_ID`**).
4. Verify: `POST /api/admin/lynx/connection-test` (super-admin).

### B. Cortina (needs your Nayax rep — "Cortina onboarding") — UPDATED 2026-09-12
Ask the rep to onboard PetWash as a **Cortina External Prepaid** payment provider
(EntryMode "QR" — the DOT reader scans the member's app QR) and provide:
- **integrator / payment-method name** → GCP secret `NAYAX_CORTINA_INTEGRATOR_NAME`
- **64-char SecretToken** → GCP secret `NAYAX_CORTINA_SECRET_TOKEN` (used ONLY as the
  StartSession AES key — Nayax never sends it in a callback body)
- register our **integrator base URL**: `https://petwash.co.il/api/webhooks/nayax/cortina`
  Nayax appends the spec suffixes itself; all are mounted:
  `/Cortina/StartSession`, `/Cortina/PrePaid/{Sale,Authorization,Settlement,Void,Cancel,Refund}`,
  `/Cortina/SaleEndNotification`.
- the **IP addresses** Nayax calls us from. Default allowlist = Israel production
  `185.159.232.2, 84.110.125.194, 82.102.172.206, 212.179.76.198` + QA `31.154.55.2`;
  override with plain env `NAYAX_CORTINA_ALLOWED_IPS=ip1,ip2,cidr/24` (fail-closed).
- confirm **PreSelection** on the four K9000s (MDB "02 PreSelection Enabled" — already the
  case in MoMa) — `/Sale` is then the money call and the code debits there.
- confirm whether **StartSession** is configured for us. It is expected (default
  `CORTINA_REQUIRE_START_SESSION=true`: every /Authorization and /Sale must carry a
  TransactionId we minted ≤10 min earlier). If Nayax runs us WITHOUT StartSession, set
  `CORTINA_REQUIRE_START_SESSION=false` — auth then rests on the IP allowlist + our
  signed 45-second QR.
- give **sandbox (QA)** access first.

### C. Bay mapping (station_bays)
Each of the four bays must carry its Nayax terminal id in `station_bays.nayaxTerminalId`
(or `nayaxQrReaderId`) — the callback's `MachineInfo.TerminalId` / `MachineInfo.Id` is
matched against them. Machines: Wald right 182443, Wald left 182462, Park 80 right 182403,
Park 80 left 182374 (MoMa, 2026-09-11).

### D. Flip ON (only after a passing sandbox cycle)
- `NAYAX_CORTINA_ENABLED=true` (plain Cloud Run env). Everything above is DARK until then.
- Sandbox default base = `qa-lynx.nayax.com`; production = set `NAYAX_CORTINA_SANDBOX=false`
  (or `LYNX_SANDBOX=false`) to use `lynx.nayax.com`.

## What is built (code, all DARK until the flags above)
- Inbound callbacks + reserve→commit→release + recon (`server/routes/nayax-cortina.ts`,
  mig `0076`) — #1042/#1043/#1047; verified spec response shape + `/cancel` + `/refund` (#1155).
- Start Session AES handshake, proven vs Nayax's example (`server/lib/cortinaStartSession.ts`, #1156).
- Outbound StaticQR Start client (`server/services/NayaxCortinaClient.ts`, this PR).
- Lynx read-only ops client + admin routes (`server/services/LynxClient.ts`,
  `server/routes/admin-lynx.ts`, #1154).

## Still OUTSTANDING (not code)
Nayax credentials (Lynx token self-serve; Cortina onboarding via rep) → sandbox cycle →
flip the flags. Walk-up card payment at the machine already works (native Nayax).
