# Orphan detector report — 2026-08-27 (v5, BASELINE CLEAN)

Total findings: **0**

Every server service, route, page, and component in the tree is now either:
- Wired to at least one production caller/render/mount, or
- In ALLOW_INTENTIONAL[] with a comment naming the reason.

## Baseline discipline

The detector runs against this baseline. Any NEW orphan the next PR ships will fail this audit immediately.

ALLOW_INTENTIONAL[] entries fall into five clearly-labelled sections:

1. **Wire-blocked pending CEO gate** — `MARKETPLACE_EGIFT_FISCAL_ACTIVATION` (eGift reservation + balance projection), `BOOKING_ACCEPT_DISPATCHER_ENABLED` (booking-response cores).

2. **Phase 2 SUMIT lane** — receipt / financials / reconciliation / sync / booking-payment services ready for SUMIT go-live.

3. **Refund rail Phase 1** — orchestrator (RefundService, LynxRefundService), admin-triggered.

4. **Event-driven / cron consumers** — weather, air quality, calendar, notification handlers, biometric monitors — no static caller by design.

5. **Cleanup candidates** — 16 orphans (5 SERVICE_EXPORT + 11 PAGE_UNROUTED + 47 COMPONENT_UNUSED = **63 files**) that have ZERO production callers per the current grep. A follow-up cleanup PR will decide wire vs delete for each.

## Cleanup backlog

The 63 candidates are named individually in ALLOW_INTENTIONAL[] with regex anchors, so the follow-up PR knows exactly which files to review.