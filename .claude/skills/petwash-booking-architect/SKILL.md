---
name: petwash-booking-architect
description: Design or review PetWash provider-booking code (Pet Sitter / Walk My Pet / Academy) so the PetWash backend stays the single source of truth. Use before changing booking flow, status transitions, calendar sync, payment/SUMIT wiring, cancellation/refund, or payout gating. Encodes the real state machine, the four gates, and the CPA-approved fiscal rules — nothing external (calendar, SUMIT, webhook) may confirm a booking alone.
---

# PetWash Booking Architect Skill

The rule above everything: **the PetWash backend is the source of truth.** A calendar event, a SUMIT document, or a payment webhook may *inform* a booking — none of them may *confirm* it alone. Do not adopt an external SaaS (Cal.com, Calendly, Booksy) as the booking database; PetWash already has the engine. External calendars are **projection only**.

## 0. What already exists — extend, don't rebuild
- **Canonical engine:** `server/routes/booking-requests.ts` (source of truth) + `EscrowService` + slot-lock + `statusHistory` audit trail.
- **Four gates stay separate** (never merge): **Deal** (booking-requests) · **MachineSession** (K9000) · **Commerce** (purchases/SUMIT) · **Ledger** (wallet). A change in one must not silently mutate another.
- **Fiscal:** the per-class SUMIT mapping is built — `getSumitDocumentMapping` + `IsraeliDigitalReceiptService.generateReceipt({ paymentClass: 'PROVIDER_BOOKING_COMMISSION' })`. Provider bookings are **disclosed-agent → Invoice on the 15% commission** (VAT on commission only). Do not re-derive tax logic (CPA order #1).

## 1. The state machine (real values — don't invent new ones)
`pending → accepted → confirmed → in_progress → completed → reviewed`, plus `payment_pending`, `meet_greet_scheduled`, `declined`, `cancelled`, `disputed`. Every transition writes a `statusHistory` entry.

**No transition without its gate.** Example — `provider_pending/accepted → confirmed` is allowed ONLY if: provider accepted **and** payment authorized/captured **and** customer+pet profile complete **and** provider KYC approved **and** no fraud/dispute hold **and** the audit event is written. If any gate is unmet, the booking does not confirm — full stop.

## 2. Backend-authoritative money & entitlement (the non-negotiables)
- **No booking confirmation, wallet change, eGift issue, or payout on a frontend success screen or a raw webhook.** Only the backend flips state, after verifying payment + idempotency (this matches the wallet/webhook rules already in the repo — webhooks fail *closed*, insert-first dedup).
- **Address privacy:** never reveal the customer's exact address to the provider until `paid/authorized` + provider accepted + fraud checks passed. Area/map-circle only before that.
- **Payout gating:** hold provider payout until booking completed, payment cleared, no open dispute/chargeback, KYC complete, bank verified, cancellation window passed. Payout state is its own machine (`not_eligible / pending_completion / pending_review / approved / paid / held / reversed`).

## 3. Cancellation / refund (void-not-delete)
Use `BookingPolicyEngine` for the policy. On refund: issue a **CreditInvoice via SUMIT linked to the original document id** (`createCreditDocument`), reverse wallet/eGift/booking through an accounting event, and **freeze the provider payout** automatically. **Never delete a money event** — void/credit/reverse only, always with an audit row.

## 4. Calendar = projection, never truth
If/when external calendar sync is built: provider Google/Apple busy/free → *informs* PetWash availability; a *confirmed* PetWash booking → writes a provider calendar event; cancel/reschedule updates it. Every sync row carries `external_calendar_id, external_event_id, sync_status, last_synced_at, idempotency_key, retry_count, sync_error`. A calendar event never knows KYC, fraud, SUMIT, or payout — so it never decides anything. (Two-way provider calendar sync is currently the one real gap; a one-way add-to-calendar for confirmed bookings already exists.)

## 5. Tax model must be explicit
Never let a `PROVIDER_BOOKING` proceed without a tax model. It is **DISCLOSED_AGENT_MARKETPLACE** (settled, #1222 — VAT on the 15% commission). `PETWASH_PRINCIPAL` (full-VAT) only if the CPA explicitly chose it for a specific service. No guessing, no mixing.

## Definition of done
Backend is truth · every transition gated + audited · no money/entitlement change without verified payment + idempotency · address privacy respected · payout gated · refunds void-not-delete + CreditInvoice-linked · calendar only projects · tax model explicit (disclosed-agent). If the change touches public copy or fiscal docs, also run `petwash-marketing-legal` / the SUMIT mapping.
