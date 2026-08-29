# PetWash Action + Confirmation Brain — Doctrine + Catalog 2026

Author: CEO directive 2026-08-30 (Action + Confirmation Brain Doctrine)
Status: DOCTRINE (source of truth for every mutating user click)
Companions:
- `petwash-marketplace-business-doctrine-2026.md`
- `petwash-marketplace-integrity-and-communications-2026.md`

## 0. Why this exists (§100)

For every user click that changes state, PetWash MUST answer these questions
before the state changes:

- WHO is acting? IN WHICH CAPACITY? ON WHAT?
- Are they allowed? What will change? Do they need a preview? Do they need
  to confirm?
- Is money involved? Privacy? Safety? Is it reversible?
- What if they double-click? Network dies? State changed under them?
- What happens on success? Who gets notified? What document / timeline
  event is created? What are the next valid actions?

If the system cannot answer any of those, the button is NOT production-ready.

## 1. The fundamental model (§0)

Every meaningful action moves through this pipeline:

```
ACTION INTENT
   ↓
ELIGIBILITY (server-authoritative)
   ↓
PREVIEW (server-computed impact)
   ↓
CONFIRMATION POLICY (matches consequence, not decoration)
   ↓
EXECUTION (idempotent + stale-safe)
   ↓
RESULT (typed status + reason code + nextActions)
   ↓
AUDIT + NOTIFICATIONS + DOCUMENT + TIMELINE effects
```

Never `button → random POST → hope`.

## 2. `ActionDefinition` contract (§1)

Every mutating action registers a definition. See
`shared/marketplace/action.ts` for the code contract; this section is the
plain-language spec.

```ts
type ActionDefinition = {
  actionType: ActionType;         // stable slug (e.g. BOOKING_ACCEPT)
  domain: ActionDomain;           // BOOKING / COMMUNICATION / MONEY / …
  riskLevel: RiskLevel;           // L0..L4
  confirmationPolicy: ConfirmationPolicy;
  eligibility: (ctx) => EligibilityResult;
  preview?: (ctx) => Promise<ActionPreview>;
  execution: (ctx, cmd) => Promise<ActionResult>;
  nextActions: (ctx, result) => ActionType[];
  audit: AuditRequirement;
  notifications: NotificationRequirement;
  idempotency: IdempotencyRequirement;
};
```

**Rule** (§2): An action is not the same as a button. Ten UI buttons that
all trigger `BOOKING_CANCEL` invoke the SAME server contract. The business
rule exists once.

## 3. Risk ladder (§4)

| Level | Description | Examples |
| --- | --- | --- |
| L0 | Navigation / read | open booking, view provider, view receipt |
| L1 | Low-risk preference | favourite, save search, dismiss recommendation |
| L2 | Business state change | send request, accept M&G, availability, message |
| L3 | Money / contract / material | confirm booking, refund, wallet top-up, gift, join Prestige |
| L4 | Irreversible / high-risk | delete account, remove provider capability, large admin adjust, change bank |

## 4. Confirmation policy engine (§5, §43, §44, §45)

`ConfirmationPolicyResolver(actionType, riskLevel, actor, entityState,
financialImpact, legalImpact, safetyImpact) → ConfirmationLevel`

| Level | UX | Example actions |
| --- | --- | --- |
| `NONE` | immediate | favourite, mark read, non-money preference |
| `TOAST_UNDO` | fire + undo affordance | remove favourite, archive chat |
| `LIGHT_CONFIRM` | inline yes/no sheet | provider decline reason |
| `REVIEW_SCREEN` | full preview, itemised effect | send booking request, accept booking |
| `EXPLICIT_CONFIRM` | preview + typed action verb button | cancel paid booking, wallet top-up |
| `REAUTH_AND_CONFIRM` | re-auth prompt + explicit confirm | change bank account, delete account, large admin |

**Confirmation matches the consequence — never generic "Are you sure?"** (§5, §45).

**Prefer Undo over Confirm** where safety allows (§46).

## 5. Idempotency + double-click (§8, §9, §10)

- Every material action carries an `idempotencyKey` generated per user
  intent (not per network request).
- Server dedupes retries by `(idempotencyKey, actorUid, actionType)`.
- On reconnect after network failure, the client QUERIES action status by
  key — never blindly executes again.
- Stale-state guard: the preview stamps a `previewVersion`; execute
  refuses if the material state changed under the user (`STALE_STATE`
  response with fresh preview attached).

## 6. `ActionResult` contract (§39, §78, §93)

```ts
type ActionResult = {
  actionId: string;
  actionType: ActionType;
  status: ActionStatus;           // SUCCEEDED | PROCESSING | REQUIRES_ACTION | FAILED | STALE
  entityRef?: { kind: string; id: string };
  newState?: string;
  userMessage: { code: ReasonCode; params?: Record<string, unknown> };
  financialEffect?: MoneyEffect;
  documentEffect?: DocumentEffect;
  notificationEffect?: NotificationEffect;
  nextActions: ActionType[];
  auditRef: string;
  correlationId: string;
};
```

**Rules:**
- Frontend renders the result. It does NOT invent the next step (§39, §41).
- Reason codes are stable slugs; translations are display-only (§93).
- Never expose raw backend error strings; always map to a reason code.

## 7. Next-action engine (§40, §41, §42)

`GET /entity/actions?actor=…&workspace=…` → `[{ type, enabled, reason?, requiresPreview? }]`

The server is the single authority for which actions surface where.
Client cannot guess. Same action can differ by state:

- `CANCEL_BOOKING` on REQUESTED / unpaid → simple cancel
- `CANCEL_BOOKING` on CONFIRMED / paid → refund preview required
- `CANCEL_BOOKING` on IN_PROGRESS → different policy
- `CANCEL_BOOKING` on COMPLETED → NOT available
- `CANCEL_BOOKING` on DISPUTED → restricted

## 8. Money truth (§54, §82, §84)

- UI preview receives SERVER-CALCULATED amounts. UI never invents totals.
- Confirmation sends `previewVersion`. Server recomputes + verifies.
- Payment uncertainty ≠ payment failure. Show "checking your payment" —
  never say failed until authoritative. Never offer "Pay Again" until safe.

## 9. Safety invariants (§87, §88, §89, §90)

Critical actions CANNOT be triggered by:

- GET requests
- URL visits (`/booking/123/cancel` OPENS a preview; never cancels)
- Push notification opening alone
- Page render
- AI text generation

They require an authenticated + explicit user action. Email + push may
DEEP-LINK to a review surface; they may not execute money / accept / cancel.

## 10. AI Concierge separation (§56, §57, §97)

Two brains:

- **Deterministic Business Brain** — states, permissions, money, policies,
  eligible actions, confirmation requirements.
- **AI Experience Brain** — understands language, explains, suggests,
  orders attention, helps navigate.

AI CANNOT override the deterministic brain. AI CAN:

- Say "your sitter request is awaiting Maya" + `[Message Maya]` `[Find Alternatives]`
- Interpret "cancel it" → propose `ActionPreview(CANCEL_BOOKING)` and show
  the deterministic quote for user confirmation.

AI CANNOT:

- Cancel, refund, accept, pay, complete without a deterministic preview +
  user confirmation.
- Treat free text as authorization (§57).

## 11. Optimistic vs pending (§47, §48)

**Optimistic OK:** favourite, mark read, small preference toggles.

**Wait for server truth:** payment, refund, booking acceptance, payout,
service completion. UI shows `PROCESSING`. AttentionFeed picks up the
final result — never pretend immediate completion.

## 12. Two-device chaos (§95, §96)

Every high-risk action test MUST cover:

- double click
- refresh while submitting
- browser closes
- network timeout
- server 500
- webhook late / duplicate
- two devices act simultaneously
- stale preview
- expired quote
- already-completed action

Second device seeing a stale confirmation → server returns `STALE`; UI
shows the updated preview. Never resurrect a cancelled booking.

## 13. State-machine ownership (§72)

Each domain owns its state machine. Client CANNOT POST `status=COMPLETED`
— it invokes the ACTION (`COMPLETE_JOB`) and the server validates the
transition.

## 14. The Top-100 action catalog

The full inventory lives in `shared/marketplace/actionCatalog.ts`. This
section indexes them by domain with their `riskLevel` + `confirmationPolicy`.

### 14.1 AUTH + PROFILE
| Action | Risk | Confirmation |
| --- | --- | --- |
| `AUTH_SIGN_IN` | L2 | REVIEW_SCREEN |
| `AUTH_SIGN_OUT` | L1 | LIGHT_CONFIRM |
| `PROFILE_UPDATE_NAME` | L1 | NONE |
| `PROFILE_UPDATE_LANGUAGE` | L1 | NONE |
| `PROFILE_UPDATE_MARKETING_CONSENT` | L1 | LIGHT_CONFIRM |
| `ACCOUNT_DELETE` | L4 | REAUTH_AND_CONFIRM |

### 14.2 PET / KYA
| Action | Risk | Confirmation |
| --- | --- | --- |
| `PET_CREATE` | L2 | REVIEW_SCREEN |
| `PET_UPDATE` | L2 | LIGHT_CONFIRM |
| `PET_ARCHIVE` | L2 | EXPLICIT_CONFIRM |
| `PET_DELETE_NO_HISTORY` | L3 | EXPLICIT_CONFIRM |
| `KYA_SHARE_MEDICAL_FOR_BOOKING` | L2 | LIGHT_CONFIRM |
| `KYA_REVIEW_TIMESTAMP_TOUCH` | L1 | NONE |

### 14.3 PRESTIGE
| Action | Risk | Confirmation |
| --- | --- | --- |
| `PRESTIGE_JOIN` | L3 | REVIEW_SCREEN |
| `PRESTIGE_CANCEL_MEMBERSHIP` | L3 | EXPLICIT_CONFIRM |

### 14.4 BOOKING lifecycle
| Action | Risk | Confirmation |
| --- | --- | --- |
| `BOOKING_REQUEST_SUBMIT` | L2 | REVIEW_SCREEN |
| `BOOKING_ACCEPT` | L2 | REVIEW_SCREEN |
| `BOOKING_DECLINE` | L2 | LIGHT_CONFIRM |
| `BOOKING_PROPOSE_CHANGE` | L2 | REVIEW_SCREEN |
| `BOOKING_ACCEPT_PROPOSED_CHANGE` | L3 | REVIEW_SCREEN |
| `BOOKING_ADD_PET` | L2 | REVIEW_SCREEN |
| `BOOKING_EXTEND` | L3 | REVIEW_SCREEN |
| `BOOKING_CANCEL_UNPAID` | L2 | LIGHT_CONFIRM |
| `BOOKING_CANCEL_PAID` | L3 | EXPLICIT_CONFIRM |
| `BOOKING_START_JOB` | L2 | LIGHT_CONFIRM |
| `BOOKING_COMPLETE_JOB` | L3 | REVIEW_SCREEN |
| `BOOKING_PET_HANDOFF` | L3 | REVIEW_SCREEN (PIN/QR verify) |
| `BOOKING_PET_RETURN` | L3 | REVIEW_SCREEN (PIN/QR verify) |
| `BOOKING_REVIEW_SUBMIT` | L2 | NONE |

### 14.5 MEET & GREET
| Action | Risk | Confirmation |
| --- | --- | --- |
| `MEET_GREET_REQUEST` | L2 | REVIEW_SCREEN |
| `MEET_GREET_ACCEPT` | L2 | REVIEW_SCREEN |
| `MEET_GREET_SUGGEST_TIME` | L2 | REVIEW_SCREEN |
| `MEET_GREET_DECLINE` | L2 | LIGHT_CONFIRM |
| `MEET_GREET_COMPLETE` | L2 | LIGHT_CONFIRM |
| `MEET_GREET_ACKNOWLEDGE` | L2 | REVIEW_SCREEN |

### 14.6 COMMUNICATION
| Action | Risk | Confirmation |
| --- | --- | --- |
| `MESSAGE_SEND` | L2 | NONE (policy engine gates) |
| `MESSAGE_KEEP_ON_PETWASH_REPLY` | L1 | NONE |
| `MESSAGE_REPORT` | L2 | LIGHT_CONFIRM |
| `THREAD_BLOCK_USER` | L3 | EXPLICIT_CONFIRM |
| `CALL_PROVIDER` | L2 | LIGHT_CONFIRM (masked) |
| `CALL_OWNER` | L2 | LIGHT_CONFIRM (masked) |

### 14.7 PROVIDER surface
| Action | Risk | Confirmation |
| --- | --- | --- |
| `PROVIDER_APPLICATION_SAVE_DRAFT` | L1 | NONE |
| `PROVIDER_APPLICATION_UPLOAD_ID` | L2 | REVIEW_SCREEN |
| `PROVIDER_APPLICATION_ADD_SERVICE` | L2 | REVIEW_SCREEN |
| `PROVIDER_APPLICATION_REMOVE_SERVICE` | L2 | LIGHT_CONFIRM |
| `PROVIDER_APPLICATION_SUBMIT` | L3 | REVIEW_SCREEN |
| `PROVIDER_AGREEMENT_ACCEPT` | L3 | REVIEW_SCREEN |
| `PROVIDER_APPLICATION_WITHDRAW` | L3 | EXPLICIT_CONFIRM |
| `PROVIDER_SERVICE_ENABLE` | L2 | LIGHT_CONFIRM |
| `PROVIDER_SERVICE_DISABLE` | L2 | LIGHT_CONFIRM |
| `PROVIDER_PRICE_UPDATE` | L3 | REVIEW_SCREEN |
| `PROVIDER_AVAILABILITY_UPDATE` | L2 | REVIEW_SCREEN (conflict warning) |
| `PROVIDER_PAYOUT_BANK_CHANGE` | L4 | REAUTH_AND_CONFIRM |

### 14.8 MONEY
| Action | Risk | Confirmation |
| --- | --- | --- |
| `WALLET_TOPUP` | L3 | EXPLICIT_CONFIRM |
| `EGIFT_SEND` | L3 | EXPLICIT_CONFIRM |
| `EGIFT_REDEEM` | L3 | REVIEW_SCREEN |
| `REFUND_REQUEST` | L3 | REVIEW_SCREEN |
| `SHOP_CHECKOUT` | L3 | EXPLICIT_CONFIRM |
| `SHOP_CANCEL_ORDER` | L3 | EXPLICIT_CONFIRM |
| `SHOP_PICKUP_VERIFY` | L2 | REVIEW_SCREEN (PIN/QR) |

### 14.9 SUPPORT + SAFETY
| Action | Risk | Confirmation |
| --- | --- | --- |
| `SUPPORT_CONTACT_OPEN` | L1 | NONE |
| `SUPPORT_ATTACH_EVIDENCE` | L2 | REVIEW_SCREEN |
| `SAFETY_REPORT_SUBMIT` | L3 | REVIEW_SCREEN |
| `INCIDENT_REPORT_ACTIVE_JOB` | L3 | REVIEW_SCREEN |

### 14.10 ADMIN
| Action | Risk | Confirmation |
| --- | --- | --- |
| `ADMIN_SUSPEND_PROVIDER` | L4 | REAUTH_AND_CONFIRM |
| `ADMIN_REINSTATE_PROVIDER` | L3 | EXPLICIT_CONFIRM |
| `ADMIN_ISSUE_REFUND_LARGE` | L4 | REAUTH_AND_CONFIRM |
| `ADMIN_BULK_MESSAGE` | L3 | EXPLICIT_CONFIRM |
| `ADMIN_BULK_SUSPEND` | L4 | REAUTH_AND_CONFIRM |

## 15. Success / processing / failure copy (§81, §82, §83, §84)

Every success answers:
1. WHAT HAPPENED?
2. WHAT HAPPENS NEXT?
3. DO I NEED TO DO ANYTHING?

Every failure includes NEXT VALID ACTIONS — never a dead-end message.

Payment failure: **truth first**. If payment attempt is uncertain, say
"We're checking your payment." Do NOT say failed until authoritative.
Do NOT offer "Pay Again" until safe.

## 16. Button label discipline (§79, §80)

Bad: `Continue`, `Submit`, `OK`, `Yes`.
Good: `Send Request`, `Accept Booking`, `Confirm ₪220`, `Join Prestige`,
`Save New Rate`, `Cancel Booking`, `Send Gift`, `Start Walk`.

Destructive confirmation buttons repeat the ACTION verb — `[Cancel Booking]`,
not `[Yes]`.

## 17. Rule composition, not million if-statements (§70)

Predicates compose:

```
CanCancel = participant
         && cancellableBookingState
         && !alreadyCancelled
         && policyResolver.returnsQuote

CanCall = participant
       && communicationPhase.permitsCall

CanReview = customer
         && completed
         && !hasExistingReview

CanAccept = assignedProvider
         && requestPending
         && providerService.eligible
         && availability.stillValid
```

## 18. Test acceptance (§94, §95)

Business journey PASS/FAIL — not "N tests green":

- BOOKING REQUEST · ACCEPT · CHANGE QUOTE · CANCEL+REFUND
- ADD PET · EXTEND · MEET & GREET
- PRESTIGE JOIN
- PROVIDER PRICE CHANGE · PAYOUT BANK CHANGE
- START JOB · COMPLETE JOB · PET HANDOFF
- SHOP PURCHASE · WALLET TOPUP · EGIFT SEND · EGIFT REDEEM

Chaos matrix (§95) is a required layer for every L3/L4 action.

## 19. Non-goals (§65, §66)

- No production activation of non-circumvention penalties (counsel gate).
- No LLM-decided execution of any L2+ action.
- No generic `POST /actions` if it hurts clarity — domain endpoints keep
  their shape; they IMPLEMENT the common contract.
- No mass rewrite of legacy buttons. The framework absorbs them
  incrementally.

## 20. Execution plan (§74, §100)

**Phase 1** — Doctrine + action types + ConfirmationPolicyResolver +
top-100 action catalog with (risk, confirmation) entries.

**Phase 2** — `ActionResult` + `ReasonCode` + `IdempotencyKey` primitives;
`STALE_STATE` handshake.

**Phase 3** — Wire highest-risk domains (booking / payments / refunds /
provider accept / cancel / job start·complete / Prestige join / provider
pricing / payout).

**Phase 4** — KYA · chat structured actions · Meet & Greet · Shop · Wallet ·
eGift · reviews · support.

**Phase 5** — Journey Brain / AI Concierge consume `availableActions[]`
instead of guessing buttons.

## 21. Final rule (§100)

If the system cannot answer §0's questions for a click, the button is NOT
production-ready.
