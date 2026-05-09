# 09 — Fraud / Risk Matrix

**Status:** Spec only. No runtime change.

**Owning Financial Core Part:** Cross-cutting; informs Parts 3, 4, 5, 6, 7, 8, 10.

---

## 1. Objective

Catalogue the fraud and abuse vectors that a 2-sided marketplace + machine-payment + wallet platform faces, and define detection / prevention / response controls per vector. Drives the data we collect, the velocity caps we enforce, the dashboards we build (Section 07), and the kill switches we wire (Part 10.5).

---

## 2. Current state

| Vector | Today |
|---|---|
| Wallet top-up fraud | PR-J #209 closed F-05 (caller-supplied nayaxTxId + amountCents trusted). Verification now in place. |
| Replay attacks | Partial — webhook event-id de-dup not yet implemented (Section 03 deferred); `walletIdempotencyKeys` covers /topup |
| Self-matching | PR-H #210 closed F-06 (provider doesn't see themselves) |
| Provider auth bypass | PR-F #204 closed F-02 (auth on completion routes) |
| K9000 fake-success | PR-K #206 closed F-11 (env-presence guard) |
| Hardcoded tax id | PR-G #205 closed F-01 (canonical legal identity) |
| Provider collusion | NOT MONITORED |
| Coupon / promo abuse | NOT MONITORED |
| Wash abuse (free wash exploits) | Partial — confirmation-code path |
| Referral abuse | NOT MONITORED |
| Multi-account abuse (one user, many accounts) | NOT MONITORED |
| Velocity-based fraud | NOT MONITORED |
| Chargeback abuse | NO formal workflow |

---

## 3. Target architecture

### 3.1 Fraud vector matrix

| Vector | Description | Detection signal | Prevention | Response |
|---|---|---|---|---|
| **Wallet top-up fraud** | Caller invents nayaxTxId / amount | (closed by PR-J: verifier rejects) | DB-side verification + idempotency | 402 + audit; freeze if repeat |
| **Replay (webhook)** | Same Nayax/UPay/SUMIT event delivered N times | event_id seen in dedup table | UNIQUE on event_id; first-write wins | Subsequent ignored; metric tracked |
| **Replay (API)** | Same idempotency key reused with different payload | hash(payload) mismatch on cached idemKey | Hard error 409 | audit + alert if frequent |
| **Provider self-matching** | Provider matches themselves to bookings | (closed by PR-H: SQL excludes self) | SQL WHERE ne(providers.userId, callerUserId) | n/a (prevented at source) |
| **Provider collusion (provider X books provider Y for fake services to siphon platform funds via referrals or coupons)** | Two related accounts cross-booking | shared device fingerprint, shared payment instrument, shared address, unusual booking pattern | velocity caps; KYC re-verify on first payout; admin review queue | freeze related accounts; clawback |
| **Coupon / promo abuse** | One customer exploits promo across many fake accounts | new account → immediate promo redemption; shared device / payment | per-promo per-account cap; per-promo total cap; per-promo eligibility check (e.g. new-customer only verified by KYC) | claw back wrongly issued promo credit; audit |
| **Free wash exploits (K9000)** | Confirmation-code shared / brute-forced; QR token replay | nonce burned twice; confirmation code attempted N times in short window | nonce burning (existing); confirmation code rate limit (PR-F bookingLimiter pattern) | session voided; flag account |
| **Referral abuse** | One user refers fake accounts to harvest referral credits | shared device / payment / IP / KYC mismatch on referee | referral credit only released after referee completes a real paid transaction; per-month referral cap | clawback referral credit |
| **Multi-account abuse** | One person, many accounts | device fingerprint + KYC + payment-instrument deduplication | account-merge detection; CAPTCHA on signup; KYC re-verify on suspicious behaviour | merge accounts; cap per real-person quotas |
| **Chargeback abuse** | Customer charges back legitimate transactions | repeated chargebacks from same customer | first-chargeback warning; second triggers wallet freeze pending review | block; provider compensated; legal action threshold |
| **Velocity-based fraud** | Account suddenly spending or earning at non-organic rate | rolling-window thresholds per metric (top-ups, redemptions, payouts received) | per-metric cap; soft-block above threshold | admin review queue |
| **Bot scraping** | Bots scrape provider listings | non-human request patterns; rate exceeding human plausibility | rate-limit per IP / per-account; CAPTCHA on suspicious | block IP; cooling-off |
| **Account takeover** | Stolen credentials | unusual device, location, IP | step-up auth on sensitive actions (refund, payout instructions, password change) | freeze; force re-auth |
| **Provider profile fraud** | Fake provider with stolen photos / fake KYC | KYC verification + biometric (existing) | admin review of new providers; reverse-image search | block; chargeback all paid bookings |
| **Insider abuse** | Admin accidentally or maliciously misuses tools | every admin action audit-logged (PR #198 pattern + Section 07 second-admin approval) | RBAC scoping; second-admin approval over thresholds | postmortem; access revocation |

### 3.2 Detection layer (data we collect)

A `risk_signal` event store captures every detection signal with:

```
{
  signal_id: UUID,
  signal_type: enum,           // velocity_topup_high, shared_device, replay_webhook, etc.
  actor_kind: customer | provider | admin | system,
  actor_id: string,
  related_txn_id?: string,
  related_booking_id?: string,
  evidence: jsonb,             // signal-specific details
  severity: low | medium | high | critical,
  status: open | reviewed | acted | dismissed,
  created_at: timestamptz,
  reviewed_at?: timestamptz,
  reviewed_by?: admin_id,
  action_taken?: string,
}
```

Append-only. Status transitions are paired entries (status_change row with from/to), not in-place updates.

### 3.3 Per-vector velocity caps (configurable env)

```
WALLET_TOPUP_DAILY_MAX_CENTS_PER_USER
WALLET_TOPUP_HOURLY_MAX_TXNS_PER_USER
PAYOUT_DAILY_MAX_CENTS_PER_PROVIDER
REFERRAL_CREDIT_MONTHLY_MAX_PER_USER
PROMO_REDEMPTION_DAILY_MAX_PER_USER
CONFIRMATION_CODE_ATTEMPT_PER_BOOKING
```

Defaults conservative; tuned by Sec + Finance after observed traffic.

### 3.4 Response runbook (per vector)

Each vector has a runbook in `docs/ops/runbooks/fraud-<vector>.md`:
- detection signal
- false-positive risk
- first action (auto / admin click)
- escalation path
- compensation policy (provider / customer)
- legal action threshold

### 3.5 Fraud + payouts coupling

Per Section 05: every payout passes a per-batch fraud gate. Flagged rows held for review. False-positive policy: held items never silently disappear; admin clears with audit log.

### 3.6 Customer-side transparency

- Wallet freeze surfaces a clear "your account is under review" message (no auto-unfreeze; admin clears)
- Refund-status visible to customer in account
- Disputed booking visible in account history

---

## 4. Gaps from current to target

| Gap | Severity |
|---|---|
| `risk_signal` table doesn't exist | high |
| No velocity caps wired | high |
| No device-fingerprint store | medium |
| No per-vector runbook | medium |
| Webhook event-id de-dup (Section 03) blocked on Section 03 implementation | high |
| Fraud queue not in admin (Section 07) | high |
| Per-batch payout fraud gate | high |
| Customer-side freeze messaging | medium |

---

## 5. v1 launch scope vs deferred scope

**v1 launch scope:**
- `risk_signal` schema + write-only library used everywhere
- Velocity caps for wallet top-ups, payouts, referrals, promos
- Webhook event-id de-dup (also part of Section 03)
- Per-batch payout fraud gate
- Admin fraud queue (Section 07 dependency)
- Customer-side freeze messaging
- Runbooks for top-7 vectors

**Deferred scope:**
- Device-fingerprint store + matching (privacy review needed)
- ML-based anomaly detection
- Cross-platform identity correlation
- Reverse-image search for provider profile photos

---

## 6. Legal / regulatory / financial assumptions

- Anti-money-laundering rules — Pet Wash transaction sizes likely below threshold but we monitor; if AML reporting becomes required, separate compliance program kicks in
- Israeli consumer-protection rules limit when we can freeze a customer wallet (must have clear cause + audit trail + appeal path)
- Provider clawback rights governed by Provider Master Agreement
- Privacy rules limit device fingerprinting (GDPR-equivalent caution)

---

## 7. Open questions for human decision

1. **Velocity-cap defaults** — Sec + Finance set; CEO confirms
2. **First-chargeback policy** — warning + education vs immediate freeze?
3. **Referral integrity** — referee must complete N paid transactions before payout? CEO sets N
4. **Device fingerprinting** — adopt? Privacy + counsel review
5. **Auto-unfreeze on appeal** — possible or always admin-decided?
6. **Provider-collusion thresholds** — high-judgment area; admin queue with second-admin sign-off

---

## 8. Dependency graph

**This section blocks:**
- Section 05 (payouts) — fraud gate + velocity caps
- Section 07 (admin) — fraud queue dashboards
- Section 02 (wallet) — freeze mechanics on the wallet bucket layer
- Live launch — cannot launch fraud-blind

**This section is blocked by:**
- Section 02 (wallet bucket separation) for clean velocity tracking
- Section 03 (Nayax reconciliation) for the webhook de-dup
- Section 07 (admin observability) for the queue
- Provider Master Agreement (clawback clause)

---

## 9. Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| False positive freezes legitimate customer | Customer churn + complaint | Always admin-reviewable; appeal path; audit log |
| Threshold tuned too lax | Real fraud slips through | Quarterly threshold review against detected events |
| Runbook outdated | Wrong action under pressure | Quarterly drill |
| `risk_signal` table grows unbounded | Storage cost | TTL on dismissed signals; partitioning |
| Velocity counter stale (cache lag) | Cap not enforced | Counters use atomic increment + row-level lock |
| Customer freeze message confusing | Support burden | UX copy review; clear next-step for customer |

---

## 10. Reconciliation strategy

- Per-day: count(risk_signal opened today) by type
- Per-week: false-positive rate per signal type → tuning input
- Per-month: clawback ledger reconciled to refund-credit issuances
- Per-quarter: vector matrix re-reviewed for new threats

---

## 11. Rollback / offset strategy

- Velocity caps are env-config; cap loosened or disabled by env flip + redeploy (< 5 min)
- A wrongly-frozen account is unfrozen by admin click + audit-logged with reason
- A wrongly-clawed-back credit is restored by an offsetting `wallet.refund_credit` entry — never edits the original clawback

---

## 12. Execution PR sequence

| PR | Purpose | Class |
|---|---|---|
| `PR-FRAUD-SPEC` | This document | spec |
| `PR-FRAUD-1` | `risk_signal` schema + write library | schema-migration + runtime |
| `PR-FRAUD-2` | Velocity caps for wallet top-ups | runtime |
| `PR-FRAUD-3` | Velocity caps for payouts | runtime |
| `PR-FRAUD-4` | Velocity caps for referrals + promos | runtime |
| `PR-FRAUD-5` | Webhook event-id de-dup (also lives in Section 03 sequence) | runtime |
| `PR-FRAUD-6` | Per-batch payout fraud gate | runtime |
| `PR-FRAUD-7..N` | Per-vector runbooks under `docs/ops/runbooks/fraud-*.md` | docs |
| `PR-FRAUD-8` | Customer-facing freeze messaging | runtime + UX |

Each carries full 12-field metadata.
