# PetWash Activation Triage — built-but-dark → switch-on checklist
**Generated 2026-06-30.** Every flag below defaults OFF. This is the "turn on / finish / kill" worklist for the CEO's built-but-dark work. Go group by group.

> Money flags run in **shadow mode** while off (the amount is *calculated* but never charged). Flipping = real money. Those need a CEO/CPA decision, not just a flag.

---

## GROUP A — Flip-and-go (built, low risk, no money/legal) — fastest wins
| Flag (env=`true`) | Turns on | One step |
|---|---|---|
| `FLASH_DEALS_ENABLED` | Flash deals on homepage | set env |
| `VITE_PET_ICONS_ENABLED` | Luxury pet icon set | set env (client build) |
| `CONVERSION_RESCUE_ENABLED` | Booking rescue / abandonment recovery | set env (+ migration 0082 applied) |
| `MAYA_OPS_TASKS_ENABLED` | Maya AI ops task surface | set env |
| `SOCIAL_AUTH_FIXES_ENABLED` | Social login fixes | set env |
| `UNIFIED_BOOKING_ENABLED` | Unified booking engine | set env (verify first) |
| `IDENTITY_UNIFIED_ENABLED` | Unified identity routing | set env (verify first) |

## GROUP B — Unified Verification (built; 9 per-flow flags) — turn on flow-by-flow
`UNIFIED_VERIFICATION_ENABLED` (umbrella) + `_SIGNUP` `_LOGIN` `_PAYOUT` `_EGIFT_REDEEM` `_CHANGE_EMAIL` `_CLOSE_ACCOUNT` `_DIAGNOSTIC`. One step each: set env per flow. Start with `_DIAGNOSTIC` + `_LOGIN`.

## GROUP C — Shop module (fully built, 3 flags dark)
| Flag | Turns on | One step |
|---|---|---|
| `SHOP_ENABLED` | Shop browse/catalog | set env |
| `SHOP_CHECKOUT_ENABLED` | Shop checkout (money) | set env (after CPA receipt call) |
| `SHOP_SHIPPING_WOLT_ENABLED` | Wolt shipping | set env + Wolt creds |

## GROUP D — Money engines / Deal Gate (built + shadow) — **CEO/CPA decision, then flip**
`CANCELLATION_FEES_ENABLED` · `NO_SHOW_FEES_ENABLED` · `CARD_FEE_RECOVERY_ENABLED` · `AUTO_REFUNDS_ENABLED` · `PROVIDER_COMPENSATION_ENABLED`. Architecture done; flipping charges/refunds real money. **Step: you approve the policy (fees, §14ג, disclosure) → set env.** `AUTO_REFUNDS_ENABLED` pairs with the refund rail.

## GROUP E — Payment rails (built, dormant) — need EXTERNAL config, not just a flag
| Flag | Turns on | One step |
|---|---|---|
| `SUMIT_ENABLED` | SUMIT tax invoices / payments | set SUMIT_API_KEY + COMPANY_ID + WEBHOOK_SECRET, connect SUMIT→רשות |
| `LYNX_ENABLED` | Nayax Lynx K9000 inventory | Nayax-provisioned token + env |
| `NAYAX_ENABLED` / `NAYAX_CORTINA_ENABLED` | Nayax rails | creds + env |

## GROUP F — Commerce OS (`FF_COMMERCE_*`) — **SCAFFOLD ONLY, not flip-and-go**
`FF_COMMERCE_UNIFIED_PURCHASE_LIFECYCLE_ENABLED` + router/lifecycle/audit keys. Honest status: *"inert — nothing reads these yet."* Flipping does nothing until the lifecycle is wired. **Needs build, not a flip.**

## GROUP G — Legal gates (built, pending counsel)
`PROVIDER_DECLARATIONS_ENFORCE` · `PROVIDER_HOST_AGREEMENT_COUNSEL_APPROVED`. Step: counsel approves + Hebrew translation + DocuSeal templates created → flip. (See [[provider-legal-documents-map-2026-06-30]].)

## GROUP H — Infra / ops
`AI_CRONS_ENABLED` (left OFF after ~$1k Google bill — keep off / scope before on) · `EMAIL_SENDING_ENABLED` `EXCEPTION_EMAIL_ENABLED` `EXECUTIVE_DIGEST_ENABLED` `DAILY_CLOSE_REMINDER_ENABLED` (comms — set env when ready) · `FIREBASE_PERFORMANCE_ENABLED`.

---

## Migrations waiting (apply before flipping dependent flags)
84 migrations exist (0001–0085). Likely UNAPPLIED in prod: **0084** (chat threads), **0085** (payout double-payout guard). Apply numbered migrations in order.

## Recommended order
1. Group A (instant, safe wins) → 2. Group B diagnostic+login → 3. Shop browse (`SHOP_ENABLED`) → 4. apply 0084/0085 → 5. money decisions (Group D) + SUMIT connect (Group E) → 6. legal (Group G) → 7. Commerce OS build (Group F).
