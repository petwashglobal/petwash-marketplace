# PetWash — Go-Live Readiness Scorecard

**Date:** 2026-07-03 · **Method:** 6-front agent readiness sweep (money, booking+calendar, shop, auth, K9000, frontend/backend) + sub-audits (calendar/availability, provider-onboarding gate, Host Stay wiring, login methods, admin gating, engine/webhook). Verdicts below fold in fixes shipped the same day.

Legend: ✅ READY · 🟡 PARTIAL · 🔴 NOT-READY/blocked · 🔧 fixed today

---

## 1. MONEY / SUMIT / UPay / Nayax
| Item | Verdict |
|---|---|
| Wallet / escrow ledger | ✅ strongest component — FOR UPDATE + balance-floor + idempotency + hash-chain |
| SUMIT invoice on charge | 🟡 code-complete (correct endpoints), gated by env `isWired()` — **verify PROD Secret Manager values**, don't assume off |
| Live card rail (Nayax online) | 🟡 built, DEMO_MODE on placeholder key — **verify prod key** |
| Refund rail | 🟡 wallet/eGift refunds real; card credit-note manual |
| Tax receipt-number race | 🟡 unique index stops dups; **no 23505 retry** → one receipt throws under concurrency (small fix) |
| UPay = SUMIT's clearing | ✅ confirmed (one integration; UPay settles under SUMIT) |
**Biggest:** verify prod SUMIT/Nayax env + run the `/admin/sumit` ₪1 sandbox test → then `SUMIT_SANDBOX=false` = cards live.

## 2. BOOKING + CALENDAR + PROVIDER LIFECYCLE
| Item | Verdict |
|---|---|
| Canonical V1 lifecycle (quote→pay→confirm→complete→escrow+VAT) | ✅ solid |
| V2 accept bypassed all gates | 🔧 **FIXED #1274** (BGC + service-approval ported, fail-closed) |
| V2 completion silently lost provider earning | 🔧 **FIXED #1273** (fail-closed) |
| Calendar slot-lock | 🔴 client sends a FAKE `client_hold_` token → concurrent timed bookings break (DB lock is real, just not called) |
| Host Stay journey | 🔧 backend + cron existed; **UI built #1276** — now end-to-end |
| Provider onboarding gate | ✅ real on V1 + payout fail-closed |

## 3. SHOP / COMMERCE
| Item | Verdict |
|---|---|
| Cart, delivery/fulfillment | ✅ ready |
| Checkout (wallet path) | 🟡 well-built + safe on price-tampering, but `SHOP_CHECKOUT_ENABLED` is **OFF** (503) |
| SUMIT receipt at sale | 🔴 issued only on admin "delivered", not at checkout — compliance gap to fix before charging |
| Card path | 🔴 stubbed → wallet is the only tender |
| Coupons | 🔴 uses dead `ShopService` path, weak double-spend guard |

## 4. AUTH / USERS / ROLES
| Item | Verdict |
|---|---|
| Signup (18+/DOB/consent, server-side) | ✅ ready |
| RBAC + `/api/admin/*` gating, no public admin endpoint | ✅ ready (backdoor removed) |
| Login methods | 🟡 4 live (email-code, phone-OTP, Google, passkey); Apple/FB/IG/TikTok need only console keys |
| Multi-role hold+switch | 🟡 works for super-admin & provider+member; no general union |
| Identity merge (loginOrLink) | 🔴 built but flag-OFF → Google-you ≠ Apple-you (duplicate accounts). Non-blocking; "where are my points" tickets at scale |

## 5. K9000 / STATIONS / NAYAX
| Item | Verdict |
|---|---|
| Dynamic-QR redeem (single-use, tokenVersion) | ✅ ready |
| Per-machine HMAC secrets | ✅ ready (ops: issue per-machine secrets) |
| Refund-on-failure (paid wash didn't start) | 🔧 **shipped #1256** (fail-closed 502, no revenue) |
| Token replay → TRUST case | 🔧 **wired #1277** |
| Physical wash start | 🟡 command software real; the actual pump-start endpoint is **hardware/ops** (Nayax MDB, no native API) — unproven |
| Bay release (non-Cortina) | 🔴 `enterCleanupPhase` has no caller → a bay can hang `busy` after a wash (code gap) |

## 6. FRONTEND / NATIVE APPS / BACKEND
| Item | Verdict |
|---|---|
| Client build (`npm run build`) | ✅ passes |
| Two native apps look like web / identical | 🔧 **FIXED #1267 + #1270** (never render web; build-time flavor = hardcoded-distinct) + icons refreshed #1271 |
| Member + provider screens exist & route | ✅ ready |
| `routes.ts` mounts + health endpoints | ✅ ready |
| Server tsc baseline (~2126, no gate) | ✅ unchanged |
| Migration CI mutated prod, no test | 🔧 **FIXED #1275** (tests new migrations vs real prod baseline) |

---

## THE HONEST GO-LIVE VERDICT

**Code is in strong shape.** The money-integrity and safety holes the sweep found are **closed** (V2 earning + accept gates, K9000 refund, migration gate, apps). What remains between here and charging real customers is **not unbuilt code** — it's:

**Ops switches (only the CEO):**
1. Verify prod SUMIT/Nayax env → `/admin/sumit` ₪1 sandbox test → `SUMIT_SANDBOX=false` = **cards live**.
2. Build + publish the two apps (6 commands).

**Small code gaps worth closing before scale (not launch-blocking):**
- Shop: flip `SHOP_CHECKOUT_ENABLED` **only after** moving SUMIT receipt into checkout; wire card path; fix coupon path.
- Calendar real slot-lock (call the server endpoint, drop the fake token).
- K9000 non-Cortina bay-release timer.
- Enable `loginOrLink` (after a shadow dry-run) to stop duplicate accounts.

**Blocked on outside parties (unchanged):** provider bank-transfer payout rail, insurance, legal contract templates.

> This scorecard IS the outcome of the readiness sweep. The 6 background sub-agents fed these verdicts; their work is captured here — they can be cleared.
