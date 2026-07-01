# PetWash Octopus Backend — K9000 / Nayax Physical-Layer Wiring Plan

**Status:** Operator vision document. Docs-only — no runtime change from this PR. Preserves the CEO's directive verbatim (Appendix A) per session norm; engineering annotation is separate from the verbatim text.

**Author:** Operator (Nir Hadad, CEO, nir.h@petwash.co.il), 2026-07-01.

**Relationship to existing Octopus docs (does NOT supersede any of them):**
- `docs/architecture/2026-petwash-octopus-vision.md` (v1) and `2026-05-27-petwash-octopus-vision-v2-amendment.md` (v2) — strategic tentacle-level vision. This doc is a **deep-dive on one physical layer** (K9000 + Nayax) that those docs treat at a higher level.
- `docs/architecture/OCTOPUS_ARCHITECTURE_RESET_RFC.md` — the authoritative engineering RFC for how the reset lands generally. This doc is the **K9000/Nayax-specific operationalization** of that RFC — protocol choice (Nayax DOT/VPOS/MDB), bay-level state machine, QR token design, reconciliation rules — at a level of detail the RFC doesn't go into.
- `docs/governance/octopus-brain-doctrine.md` — governance doctrine (D1–D19). This spec is **consistent with it**, not in conflict: Nayax as "payment/vend bridge, not the system" matches D2 (vendor demotion — rails, not the system); "no wallet debit before vend success, no free wash without admin reason" matches D16 (no manual money mutation outside ledger/audit evidence); the reconciliation section (§25) matches D19 (single-source-of-truth inventory).

## Where this already meets existing code (engineering annotation, 2026-07-01)

Checked against the current codebase before filing this doc, so it doesn't read as a from-scratch ask:

- **K9000 reserve→commit→release wallet flow** is already built (Nayax redeem-at-bay, PR #1042/43/47 per prior session record) — currently dark pending Nayax OPS credentials, not pending a design.
- **`WALLET_CREDIT_REDEEM` rulebook + hash-chained audit trail** was just wired into all three real redemption paths (K9000 kiosk `/token/redeem`, online booking-credit `/redeem-online`, staff POS `/staff/charge`) in shadow mode — see PR #1226. This is a live down-payment on this doc's §9 (wash session states) and §25 (reconciliation) sections.
- **K9000 HMAC auth exists** (`server/middleware/k9000Security.ts`, `MACHINE_SECRET_KEY`) but is a **single global secret across the entire machine fleet**, not per-station/per-machine as §8 of this doc implies (`machine_id`, per-bay modeling). Same pattern on `NAYAX_TERMINAL_SECRET` (single secret for all Nayax terminals). Confirmed by direct secret audit 2026-07-01 — this is the concrete architecture gap to close before real K9000 units go live (they're currently in storage, not installed, so this is fixable with zero live-traffic risk). Tracked as an open item, not yet built.
- **Nayax Lynx** (inventory/reporting) has no remote-vend capability per prior session record — consistent with this doc's §7 decision to lead with Nayax DOT + VPOS Touch for vend/QR, not Lynx.

## What this doc does NOT do

- Does not implement any of the 29 sections below. It is the reference; implementation happens as separately-scoped, sequenced PRs (per-machine secrets first, since that's zero-risk today; then whichever redemption route the CEO/Nayax conversation confirms).
- Does not answer the 20 supplier questions in §22 — those go to Nayax/K9000 directly, not to engineering.
- Does not override doctrine D1–D19. Any future shortcut request that conflicts with this doc or the doctrine gets refused and routed back here, per D1.

---

## Appendix A — Operator directive, verbatim

> PETWASH OCTOPUS BACKEND — END-TO-END WIRE ROUTES FOR SAAS + K9000 + NAYAX + WALLET + QR
> Version: 2026
> Owner: Pet Wash Ltd
> Core rule: One Octopus backend controls every arm. The K9000 machine is physical vending hardware. The SaaS platforms are marketplace software. They must connect through one source-of-truth ledger, identity system, CRM, audit log, notification system and admin command center.
>
> ============================================================
> 0. BIG PICTURE
> ============================================================
>
> PetWash has two worlds:
>
> A) DIGITAL SAAS MARKETPLACE WORLD
> - PetWash Prestige
> - Pet Sitter Suite
> - Walk My Pet
> - Pet Wash Academy
> - PetTrek
> - Paw Finder
> - Shop
> - Gifts
> - Wallet
> - Membership
> - Provider App
> - Admin Command Center
> - Support / Incident / Messages
>
> B) PHYSICAL MACHINE WORLD
> - K9000 2.0 Twin dual bay dog wash
> - Bay A
> - Bay B
> - Nayax VPOS Touch card terminal
> - Nayax DOT QR reader
> - K9000 ECU / MDB / pulse / card interface
> - Station electricity / water / waste / hot water
> - Service menu / audit / fault / door access
> - Technician maintenance
>
> The mistake would be to treat them as separate businesses.
>
> Correct structure:
> PetWash Octopus Backend is the brain.
> Every platform, every payment, every QR, every booking, every K9000 wash, every gift, every provider payout, every support case, every station fault and every customer interaction must route through Octopus.
>
> ============================================================
> 1. ABSOLUTE SOURCE OF TRUTH
> ============================================================
>
> Frontend is not source of truth.
> Nayax is not source of truth.
> K9000 is not source of truth.
> SUMIT/uPay is not source of truth alone.
> Google Sheets is not source of truth.
> Manual admin notes are not source of truth.
>
> The source of truth is:
>
> 1. PostgreSQL / Neon database
> 2. Wallet ledger
> 3. Payment event ledger
> 4. Booking ledger
> 5. Wash transaction ledger
> 6. Provider payout ledger
> 7. Gift ledger
> 8. Audit log
> 9. Signed document/declaration log
> 10. Case/incident log
>
> Every action must create immutable records.
>
> ============================================================
> 2. MAIN SYSTEM MAP
> ============================================================
>
> CUSTOMER APP / WEBSITE
>         |
>         v
> PETWASH OCTOPUS API
>         |
>         |---- Auth / user / role / membership
>         |---- Wallet / reward / gift balance
>         |---- Booking engine
>         |---- Provider engine
>         |---- Station / K9000 engine
>         |---- Shop / gifts engine
>         |---- Payment orchestration
>         |---- Notification hub
>         |---- Admin / CRM / support
>         |---- Audit / legal records
>         |
>         v
> PAYMENT RAILS
>         |---- SUMIT
>         |---- uPay
>         |---- Nayax
>         |---- Apple Pay / Google Pay / card
>         |
>         v
> PHYSICAL STATION
>         |---- Nayax VPOS Touch
>         |---- Nayax DOT QR Reader
>         |---- K9000 ECU / MDB / Pulse / Card interface
>         |---- Bay A
>         |---- Bay B
>
> ============================================================
> 3. PLATFORM ROUTES
> ============================================================
>
> Route group A: Customer account
> /signup
> /login
> /verify-mobile
> /verify-email
> /passkey
> /prestige
> /wallet
> /my-pets
> /my-bookings
> /my-gifts
> /my-washes
> /my-messages
> /my-cases
>
> Route group B: Pet care SaaS
> /pet-sitter-suite
> /pet-sitter-suite/search
> /pet-sitter-suite/provider/:id
> /pet-sitter-suite/booking/:id
> /walk-my-pet
> /walk-my-pet/search
> /walk-my-pet/booking/:id
> /pet-wash-academy
> /pet-wash-academy/courses
> /pet-wash-academy/session/:id
> /pettrek
> /pettrek/waitlist
>
> Route group C: K9000 station
> /stations
> /stations/:station_id
> /stations/:station_id/bay-a
> /stations/:station_id/bay-b
> /wash/start
> /wash/redeem
> /wash/history
> /wash/support
> /wash/fault
>
> Route group D: Gifts / wallet / shop
> /gifts
> /gifts/buy
> /gifts/:gift_id
> /gifts/redeem
> /wallet/top-up
> /wallet/ledger
> /shop
> /shop/order/:id
>
> Route group E: Provider
> /provider
> /provider/apply
> /provider/documents
> /provider/services
> /provider/bookings
> /provider/messages
> /provider/earnings
> /provider/payouts
> /provider/reconfirm
> /provider/incidents
>
> Route group F: Admin
> /admin
> /admin/users
> /admin/providers
> /admin/bookings
> /admin/stations
> /admin/washes
> /admin/payments
> /admin/gifts
> /admin/wallet
> /admin/support
> /admin/incidents
> /admin/maintenance
> /admin/franchise
> /admin/reports
> /admin/audit
>
> ============================================================
> 4. K9000 REALITY CHECK
> ============================================================
>
> The K9000 is not a normal smart IoT product by default.
> It is closer to a vending machine / self-service machine.
>
> The uploaded docs show:
> - K9000 Twin has two wash stations.
> - It can be note/card operated.
> - It has MDB/device/payment interfaces.
> - It has an ECU board.
> - It has service menus.
> - It has audit counters for payments, free items, token, cashless, coinbox and notes.
> - It has test outputs and test switch inputs.
> - It has door access times and fault history.
> - It requires proper electrical/water/waste/backflow installation.
> - It must not be hacked or bypassed unsafely.
>
> Therefore our plan must respect the K9000 as certified machinery.
> We do not bypass safety.
> We do not touch pumps/heaters/high-voltage circuits.
> We do not use override key as customer wash logic.
> We do not create unsafe remote activation.
>
> Correct method:
> Use the approved payment/vend input route through Nayax/MDB/Pulse/Card interface where possible.
> If extra control is needed, use a certified/isolated industrial IoT relay only on an approved low-voltage vend/credit input, installed by qualified technician/electrician and approved by K9000/Nayax where possible.
>
> ============================================================
> 5. RECOMMENDED HARDWARE STACK
> ============================================================
>
> Primary hardware:
> 1. Nayax VPOS Touch for normal tap/card payment.
> 2. Nayax DOT QR Reader for QR/barcode redemption.
> 3. Existing K9000 payment/credit interface.
> 4. Industrial router with LTE fallback at each station.
> 5. Optional IoT station controller only if Nayax cannot provide all needed backend approval logic.
> 6. Door/open sensor if not already exposed.
> 7. Water leak sensor.
> 8. Temperature sensor.
> 9. Power monitor.
> 10. CCTV only if legally allowed and signed properly.
> 11. QR signage on station.
> 12. Bay A / Bay B visible labels.
> 13. Support QR sticker per station.
> 14. Emergency support sticker.
> 15. Maintenance QR sticker inside operator panel.
>
> Nayax DOT should be first option because it is designed for QR/barcode scanning from phone/paper and integrates with Nayax VPOS Touch style payment devices.
>
> Optional IoT controller:
> Only install if required.
> Must be industrial grade.
> Must be fail-closed.
> Must use isolated dry contact relay.
> Must only trigger approved vend/credit input.
> Must never touch high voltage, pump, heater, dryer, emergency or safety circuit.
> Must log every command.
> Must support remote disable.
> Must support technician override for maintenance.
> Must use signed commands.
> Must include heartbeat.
> Must not pulse twice for one payment.
>
> ============================================================
> 6. PAYMENT ROUTE TYPES
> ============================================================
>
> There are 5 payment/redemption routes:
>
> ROUTE 1 — Normal walk-up card payment at K9000
> Customer taps card / Apple Pay / Google Pay on Nayax.
> Nayax approves.
> K9000 receives vend/credit signal.
> Wash starts.
> Nayax sends transaction event to PetWash backend if integration available.
> PetWash creates wash_transaction record.
> If customer was identified, attach reward.
> If anonymous, record station revenue only.
>
> ROUTE 2 — PetWash app wallet QR
> Customer opens PetWash app.
> Customer chooses station and Bay A/B.
> Backend checks wallet/gift/reward eligibility.
> Backend creates short-lived one-time QR.
> Customer scans QR at Nayax DOT.
> Nayax verifies or reports scan event.
> Backend approves one vend only.
> K9000 receives approved vend/credit.
> Backend marks wallet ledger debit and wash transaction complete.
>
> ROUTE 3 — eGift QR
> Buyer purchases gift online through SUMIT/uPay.
> Backend issues gift_code + QR.
> Receiver scans QR at station DOT.
> Backend checks:
> - gift is valid
> - not expired
> - not used
> - allowed product
> - station active
> - bay selected
> - no duplicate redemption
> Backend approves one vend.
> Gift marked redeemed.
> Accounting event created.
>
> ROUTE 4 — coupon / municipality / senior-disabled discount QR
> User must be logged in.
> Backend checks eligibility.
> Backend calculates final amount.
> Payment happens first if needed.
> Discount does not create free vend unless approved campaign.
> Backend issues one-time QR.
> DOT scans.
> Backend approves one vend.
> Audit log records policy version.
>
> ROUTE 5 — admin/service/launch/free wash
> Admin can issue controlled free wash only from admin.
> Must require reason:
> - launch day
> - support recovery
> - technician test
> - municipality event
> - customer complaint credit
> - fault recovery
> Must select:
> - station
> - bay
> - user optional
> - expiry time
> - reason
> - admin ID
> Backend creates free_vend record.
> K9000 audit may count it as free/token depending hardware path.
> PetWash audit must record it separately.
>
> ============================================================
> 7. BEST PRACTICE DECISION: NAYAX FIRST, IOT SECOND
> ============================================================
>
> Do not build IoT relay first if Nayax can do it properly.
>
> Phase 1:
> Use Nayax VPOS Touch + DOT QR Reader + Nayax backend/API integration as much as possible.
>
> We need to ask Nayax Israel / K9000:
>
> 1. Can DOT QR scan a PetWash-generated QR and call our backend for real-time approval?
> 2. Can Nayax send QR scan payload to our backend before vend?
> 3. Can Nayax validate closed-loop prepaid QR?
> 4. Can Nayax support single-use QR?
> 5. Can Nayax pass station_id and bay_id?
> 6. Can Nayax send successful vend event to webhook?
> 7. Can Nayax separate Bay A and Bay B on one Twin?
> 8. Can Nayax expose MDB/cashless events?
> 9. Can Nayax block duplicate scan/replay?
> 10. Can Nayax support test environment?
> 11. Can Nayax provide transaction ID and refund/void data?
> 12. Can Nayax support offline mode rules?
> 13. Can QR reader scan from phone screen in outdoor sunlight?
> 14. Can QR reader read PDF417 as well as QR?
> 15. Can Nayax handle customer payment + loyalty ID in same flow?
>
> If yes:
> Use Nayax as primary machine controller.
>
> If no:
> Use Nayax for card payments and add PetWash IoT controller only for wallet/gift/free-vend redemption.
>
> ============================================================
> 8. K9000 BAY CONTROL LOGIC
> ============================================================
>
> K9000 Twin has two bays.
> PetWash must model each bay separately.
>
> station_id = KFAR_SABA_001
> machine_id = K9000_TWIN_001
> bay_id = A
> bay_id = B
>
> Every wash transaction must include:
> - station_id
> - machine_id
> - bay_id
> - user_id if known
> - payment_provider
> - payment_event_id
> - wallet_ledger_id if wallet
> - gift_id if gift
> - campaign_id if discount/free
> - QR code ID if QR
> - vend_status
> - start_time
> - end_time if known
> - audit_snapshot if available
> - support_case_id if fault
>
> Do not allow:
> - one QR for both bays
> - one payment starting unknown bay
> - QR reuse
> - frontend choosing price
> - backend approving without station/bay
> - free wash without admin reason
>
> ============================================================
> 9. K9000 WASH SESSION STATES
> ============================================================
>
> wash_transaction_status:
>
> CREATED
> PAYMENT_PENDING
> PAYMENT_AUTHORISED
> QR_ISSUED
> QR_SCANNED
> VEND_APPROVAL_PENDING
> VEND_APPROVED
> VEND_SENT
> MACHINE_ACCEPTED
> ACTIVE
> COMPLETED
> FAILED_BEFORE_VEND
> FAILED_AFTER_VEND_UNKNOWN
> REFUND_REVIEW_REQUIRED
> REFUNDED
> SUPPORT_CASE_OPENED
> EXPIRED
> CANCELLED
>
> Important:
> If payment succeeds but vend fails, do not auto-send another vend blindly.
> Create support review.
> Maybe issue replacement QR after checking no vend occurred.
>
> ============================================================
> 10. WALLET QR REDEEM PLAN
> ============================================================
>
> Wallet QR must be secure.
>
> QR token format:
> - random 128-bit or stronger token
> - not guessable
> - not user ID only
> - not amount only
> - not static member QR for payment
> - single-use
> - short expiry, e.g. 2–5 minutes
> - station locked if user selected station
> - bay locked if selected
> - product locked: K9000_WASH
> - amount locked
> - signature/HMAC
> - replay protection
>
> Wallet flow:
> 1. User selects Find Station.
> 2. User selects K9000 station.
> 3. User selects Bay A or Bay B.
> 4. Backend checks station online.
> 5. Backend checks user wallet/gift/reward.
> 6. Backend creates reservation.
> 7. Backend issues QR.
> 8. DOT scans QR.
> 9. Backend verifies token.
> 10. Backend sends vend approval through Nayax or IoT.
> 11. Wallet ledger changes from RESERVED to DEBITED.
> 12. Wash transaction marked VEND_SENT.
> 13. If vend failed, reservation released or support review opens.
>
> Wallet ledger states:
> - CREDITED
> - RESERVED
> - DEBITED
> - RELEASED
> - EXPIRED
> - ADJUSTED_BY_ADMIN
> - REFUNDED
>
> ============================================================
> 11. GIFT CARD / EGIFT PLAN
> ============================================================
>
> Gift purchase:
> - buyer name
> - receiver name
> - receiver email/mobile
> - gift amount or wash package
> - payment through SUMIT/uPay
> - invoice/receipt
> - gift code generated
> - QR generated
> - email sent
> - wallet add option
> - fraud check
> - gift ledger credit
>
> Gift redemption:
> - scan QR at station
> - backend validates
> - gift not used
> - gift product allowed
> - station active
> - expiry valid
> - not refunded
> - not suspicious
> - create wash transaction
> - mark gift redeemed only after vend success
> - if scan succeeds but vend unknown, lock gift and open support review
>
> Gift must not be discounted unless specifically approved.
> Gift is not loyalty reward.
> Gift is not provider payout.
> Gift is not withdrawable cash.
>
> ============================================================
> 12. SAAS MARKETPLACE PAYMENT ROUTE
> ============================================================
>
> Pet Sitter / Walk My Pet / Academy are NOT the same as K9000.
>
> Marketplace route:
> 1. Customer creates booking enquiry.
> 2. Provider accepts or asks question.
> 3. Customer confirms.
> 4. Deal Gate runs.
> 5. Payment authorised/captured through SUMIT/uPay.
> 6. Booking confirmed.
> 7. Service happens.
> 8. Completion confirmed.
> 9. Provider earning created.
> 10. Payout later after dispute/cancellation window.
> 11. Review/tip optional.
> 12. Accounting events created.
>
> No K9000 vend signal.
> No Nayax terminal needed.
> No wallet wash QR unless the service explicitly allows wallet payment later.
>
> Provider payout is separate ledger.
> Customer wallet is separate ledger.
> K9000 wash revenue is separate ledger.
> Do not mix them.
>
> ============================================================
> 13. OCTOPUS BACKEND MODULES
> ============================================================
>
> Required modules:
>
> AUTH MODULE
> - user account
> - phone OTP
> - email
> - Google/Apple
> - passkey
> - roles
> - age gate
> - provider access
>
> WALLET MODULE
> - balance
> - rewards
> - gift credits
> - reservations
> - ledger
> - QR issue
> - QR redemption
>
> BOOKING MODULE
> - pet sitter
> - walking
> - academy
> - pettrek later
> - deal gate
> - cancellation
> - no-show
> - provider acceptance
> - payment
> - tips
> - reviews
>
> STATION MODULE
> - station registry
> - K9000 machine registry
> - bay registry
> - station status
> - bay status
> - maintenance
> - fault logs
> - audit snapshots
> - QR/vend commands
>
> PAYMENT MODULE
> - SUMIT
> - uPay
> - Nayax
> - Apple Pay / Google Pay through processors
> - payment webhooks
> - idempotency
> - refunds
> - chargebacks
> - accounting status
>
> GIFT MODULE
> - eGift purchase
> - gift QR
> - send gift
> - redeem gift
> - expiry
> - fraud
> - accounting
>
> PROVIDER MODULE
> - application
> - declarations
> - documents
> - services
> - availability
> - bookings
> - earnings
> - payout
> - six-month reconfirmation
>
> MESSAGING MODULE
> - chat
> - SMS
> - email
> - push
> - calls
> - support history
> - risk flags
>
> INCIDENT MODULE
> - case ID
> - evidence
> - status
> - support owner
> - station fault
> - pet care incident
> - refund review
> - legal/insurance review
>
> FRANCHISE MODULE
> - territory
> - station group
> - franchisee user
> - trademark license
> - supply ordering
> - shampoo/chemical stock
> - revenue share
> - SLA
> - training
> - compliance
> - station performance
>
> ANALYTICS MODULE
> - station revenue
> - wash count
> - conversion
> - wallet redemption
> - gift redemption
> - provider bookings
> - support cases
> - machine uptime
> - chemical usage estimate
> - water/electric usage estimate
> - franchise P&L
>
> ============================================================
> 14. DATABASE TABLES
> ============================================================
>
> users
> user_roles
> user_consents
> user_devices
> pets
> pet_passports
>
> wallets
> wallet_ledger_entries
> wallet_reservations
> reward_events
> gift_cards
> gift_redemptions
> coupon_redemptions
>
> stations
> machines
> machine_bays
> machine_devices
> machine_device_integrations
> station_status_events
> station_fault_events
> station_maintenance_logs
> station_supply_logs
>
> wash_transactions
> wash_transaction_events
> wash_qr_tokens
> machine_vend_commands
> nayax_transactions
> nayax_qr_scans
> nayax_webhook_events
> iot_controller_events
>
> bookings
> booking_events
> booking_price_breakdowns
> deal_acceptance_records
> provider_applications
> provider_profiles
> provider_services
> provider_earnings
> provider_payouts
> provider_tips
>
> payments
> payment_events
> refunds
> chargebacks
> accounting_events
> sumit_documents
> upay_documents
>
> chat_threads
> chat_messages
> notification_events
> sms_logs
> email_logs
> push_logs
> call_logs
>
> incident_cases
> incident_evidence
> case_events
>
> franchisees
> franchise_locations
> franchise_station_assignments
> franchise_royalty_events
> franchise_supply_orders
> franchise_training_records
>
> audit_logs
> admin_actions
> signed_documents
> document_versions
>
> ============================================================
> 15. API ROUTES
> ============================================================
>
> Station:
> GET /api/stations
> GET /api/stations/:station_id
> GET /api/stations/:station_id/status
> GET /api/stations/:station_id/bays
> POST /api/stations/:station_id/support-case
> POST /api/admin/stations/:station_id/disable
> POST /api/admin/stations/:station_id/enable
>
> Wash:
> POST /api/washes/quote
> POST /api/washes/create
> POST /api/washes/:wash_id/issue-qr
> POST /api/washes/:wash_id/redeem
> POST /api/washes/:wash_id/cancel
> GET /api/washes/:wash_id/status
> GET /api/users/me/washes
>
> Nayax:
> POST /api/webhooks/nayax/transaction
> POST /api/webhooks/nayax/qr-scan
> POST /api/webhooks/nayax/vend-result
> POST /api/admin/nayax/reconcile
>
> IoT fallback:
> POST /api/iot/:controller_id/heartbeat
> POST /api/iot/:controller_id/vend-result
> POST /api/admin/iot/:controller_id/disable
> POST /api/admin/iot/:controller_id/test-vend
>
> Wallet:
> GET /api/wallet
> GET /api/wallet/ledger
> POST /api/wallet/top-up
> POST /api/wallet/reserve
> POST /api/wallet/release
> POST /api/wallet/debit
>
> Gifts:
> POST /api/gifts/purchase
> POST /api/gifts/:gift_id/send
> POST /api/gifts/:gift_id/redeem
> GET /api/gifts/:gift_id/status
>
> Marketplace:
> POST /api/bookings/enquiry
> POST /api/bookings/:id/provider-accept
> POST /api/bookings/:id/customer-confirm
> POST /api/bookings/:id/pay
> POST /api/bookings/:id/cancel
> POST /api/bookings/:id/complete
> POST /api/bookings/:id/tip
> POST /api/bookings/:id/review
>
> Provider:
> POST /api/provider/apply
> POST /api/provider/declarations/sign
> GET /api/provider/bookings
> GET /api/provider/earnings
> POST /api/provider/reconfirm
>
> Admin:
> GET /api/admin/command-center
> GET /api/admin/stations
> GET /api/admin/washes
> GET /api/admin/payments
> GET /api/admin/reconcile
> GET /api/admin/franchise
> GET /api/admin/audit
>
> ============================================================
> 16. FRONTEND CUSTOMER FLOW — K9000 WALLET WASH
> ============================================================
>
> 1. Customer opens PetWash.
> 2. Tap "Wash Now".
> 3. App shows nearest stations.
> 4. Customer selects station.
> 5. App shows:
>    - station open/closed
>    - Bay A available
>    - Bay B available
>    - price
>    - wallet/gift/reward balance
>    - safety instructions
> 6. Customer selects Bay A/B.
> 7. Backend calculates price.
> 8. Customer chooses:
>    - Pay by card
>    - Use wallet
>    - Use gift
>    - Use reward credit if eligible
> 9. Backend creates wash transaction.
> 10. App displays QR.
> 11. Customer scans QR on Nayax DOT.
> 12. Backend approves only that bay.
> 13. Machine starts.
> 14. App shows "Wash started".
> 15. Receipt/accounting created.
> 16. Loyalty/reward event calculated if eligible.
> 17. Push notification: "Your wash is active."
> 18. After estimated time, app asks:
>    - Was everything OK?
>    - Report issue
>    - Buy package
>    - Send gift
>
> ============================================================
> 17. FRONTEND CUSTOMER FLOW — WALK-UP CARD PAYMENT
> ============================================================
>
> 1. Customer taps card directly on Nayax.
> 2. K9000 starts.
> 3. Nayax sends transaction event to backend if integration exists.
> 4. If no user identity, transaction is anonymous station revenue.
> 5. If customer scanned member QR before/after payment, backend may attach transaction if Nayax supports it.
> 6. Do not give loyalty reward unless identity and transaction match safely.
>
> Future smart feature:
> "Claim this wash"
> Customer scans receipt/station QR within X minutes.
> Backend checks Nayax transaction timestamp/amount/station.
> If safe, attach wash to user for history/reward.
> Must prevent fraud.
>
> ============================================================
> 18. FRONTEND PROVIDER / SAAS FLOW
> ============================================================
>
> Pet Sitter / Walk My Pet / Academy:
> 1. Customer creates enquiry.
> 2. Provider replies.
> 3. Provider accepts.
> 4. Customer confirms and pays.
> 5. Deal Gate records both sides.
> 6. Booking active.
> 7. Chat/call/push history saved.
> 8. Provider completes.
> 9. Customer reviews/tips if desired.
> 10. Provider earning moves to payable after rules.
>
> No Nayax.
> No K9000 machine signal.
> No physical vend.
> This is booking/payment/payout workflow.
>
> ============================================================
> 19. DEAL GATE FOR MARKETPLACE BOOKINGS
> ============================================================
>
> Before a booking becomes confirmed:
>
> - customer ID verified
> - provider approved
> - provider service approved
> - pet profile sufficient
> - dates valid
> - price from backend
> - cancellation policy shown
> - booker accepted
> - provider accepted
> - payment authorised/captured
> - terms version saved
> - declarations saved
> - audit log saved
> - chat thread linked
> - booking ID generated
> - notification sent
>
> If any fail:
> No confirmed booking.
>
> ============================================================
> 20. DEAL GATE FOR K9000 WASH
> ============================================================
>
> Before K9000 vend:
>
> - station active
> - bay selected
> - payment/wallet/gift valid
> - price from backend
> - QR token valid
> - QR not expired
> - QR not used
> - user eligible if discount/reward
> - no duplicate vend
> - Nayax/DOT or IoT online enough
> - vend command idempotency key created
> - ledger reservation created
> - audit log created
>
> Then:
> Vend once only.
>
> ============================================================
> 21. WHAT TO BUY / BUILD
> ============================================================
>
> BUY / USE NOW:
> - Nayax VPOS Touch
> - Nayax DOT QR Reader
> - Nayax backend/API access
> - SUMIT/uPay online payment
> - Neon/PostgreSQL
> - Google Cloud Storage backup
> - Firebase/Auth or current auth stack
> - Twilio/Israeli SMS provider
> - Push notification service
> - Email provider
> - Monitoring/logging
> - QR generation library
> - Admin audit logging
>
> POSSIBLY BUY LATER:
> - Industrial IoT controller per station
> - LTE router per station
> - Power monitor
> - Water leak sensor
> - Door sensor
> - CCTV only if legal/privacy done
> - Smart chemical level sensors
> - Digital signage screen
> - QR printer for maintenance stickers
>
> BUILD IN-HOUSE:
> - Octopus backend
> - wallet ledger
> - gift ledger
> - booking engine
> - provider engine
> - station registry
> - wash transaction engine
> - QR token engine
> - admin command center
> - support/case system
> - franchise command center
> - analytics
> - reconciliation tools
>
> DO NOT BUILD FIRST:
> - custom payment processor
> - custom card terminal
> - unsafe machine bypass
> - fake IoT before Nayax route is exhausted
> - separate wallet outside ledger
> - separate app database for each platform
>
> ============================================================
> 22. K9000 / NAYAX QUESTIONS TO SEND SUPPLIER
> ============================================================
>
> Send to K9000/Nayax:
>
> We need to connect PetWash wallet, eGift QR, loyalty QR and admin free wash approvals to K9000 Twin machines using Nayax VPOS Touch and DOT QR reader.
>
> Please confirm:
>
> 1. Does DOT QR Reader support backend-authorised closed-loop QR redemption?
> 2. Can DOT scan a QR from phone screen and send token to Nayax/PetWash backend before vend?
> 3. Can Nayax call our API to approve/decline a QR in real time?
> 4. Can Nayax send station ID/device ID/bay ID with each scan?
> 5. Can one K9000 Twin support separate Bay A and Bay B product/vend selection?
> 6. Can Nayax return successful vend confirmation?
> 7. Can Nayax prevent duplicate QR replay?
> 8. Can QR token expire after 2–5 minutes?
> 9. Can Nayax work with wallet/gift/coupon that was paid outside Nayax through SUMIT/uPay?
> 10. Can Nayax report cashless transaction data to our backend?
> 11. Can Nayax identify MDB devices and card devices per machine?
> 12. Can Nayax support Apple Pay/Google Pay/card normally while also supporting QR redemption?
> 13. What exact machine protocol will be used for K9000: MDB, Pulse, JVMA, FUJI or other?
> 14. Can DOT work outdoors in Israeli sunlight?
> 15. Is there a sandbox/test mode?
> 16. What happens if internet drops after QR scan before vend?
> 17. Can we disable QR redemption remotely per station?
> 18. Can we remotely refund/void if vend fails?
> 19. Can Nayax expose error codes/fault codes?
> 20. What wiring diagram is approved for K9000 Twin + VPOS Touch + DOT?
>
> ============================================================
> 23. ADMIN COMMAND CENTER
> ============================================================
>
> Admin must control all arms from one place.
>
> Admin dashboard cards:
> - Today K9000 revenue
> - Today marketplace revenue
> - Active washes
> - Failed vend attempts
> - Payment failed
> - Gift redemptions
> - Wallet redemptions
> - Provider bookings
> - Open support cases
> - Station offline
> - Bay offline
> - Chemical low
> - Maintenance due
> - Franchise performance
> - Backup status
>
> Station view:
> - station name
> - city
> - municipality
> - franchisee if any
> - machine serial/asset
> - Bay A status
> - Bay B status
> - Nayax device ID
> - DOT device ID
> - last transaction
> - last QR scan
> - last fault
> - last maintenance
> - water/electric status if sensors
> - cash/card/wallet/gift split
> - wash count
> - support cases
> - remote disable
> - technician notes
>
> User view:
> - account
> - pets
> - wallet
> - gifts
> - washes
> - bookings
> - support cases
> - messages
> - signed documents
> - risk flags
>
> Provider view:
> - application
> - documents
> - bookings
> - earnings
> - payout
> - incidents
> - status
>
> Franchise view:
> - locations
> - trademark license
> - station uptime
> - revenue share
> - supply orders
> - training
> - support SLA
> - compliance
>
> ============================================================
> 24. FRANCHISE MODEL WIRING
> ============================================================
>
> Franchisee does not get raw database.
> Franchisee gets controlled portal.
>
> Franchisee can see:
> - own stations
> - revenue reports
> - wash counts
> - stock/supply status
> - support tickets
> - maintenance checklist
> - training manuals
> - approved marketing
> - invoices/royalties
> - customer reviews related to stations
>
> Franchisee cannot:
> - change money math
> - change wallet balance
> - approve refunds without permission
> - access all PetWash users
> - export sensitive data
> - change platform terms
> - change trademark rules
> - bypass machine payment
> - create free washes without audit
>
> Franchise routes:
> /franchise/dashboard
> /franchise/stations
> /franchise/revenue
> /franchise/supplies
> /franchise/training
> /franchise/support
> /franchise/compliance
> /franchise/brand-assets
>
> ============================================================
> 25. RECONCILIATION
> ============================================================
>
> Daily reconciliation:
>
> Nayax report
> vs
> PetWash wash_transactions
> vs
> wallet ledger
> vs
> gift ledger
> vs
> SUMIT/uPay accounting
> vs
> station audit menu if manually checked
>
> Flag:
> - Nayax paid but no wash record
> - wash record but no payment
> - QR scanned but no vend
> - vend sent but no completion
> - wallet debited but vend failed
> - gift redeemed but no vend
> - free wash without admin reason
> - station audit cashless mismatch
> - support refund not reflected
> - duplicate QR attempt
> - unknown transaction
>
> Admin page:
> /admin/reconcile
>
> ============================================================
> 26. BACKUP AND DATA RETENTION
> ============================================================
>
> Every night:
> - PostgreSQL encrypted dump
> - upload to GCS bucket
> - verify file exists
> - verify file size > minimum
> - verify checksum
> - write backup_run record
> - send success/failure to Slack/email
>
> Every week:
> - restore test into temporary database
> - verify schema
> - verify key tables count
> - write restore_test record
>
> Retention:
> - daily backups: 35–90 days
> - monthly backups: 7 years if legal/accounting requires
> - signed documents: long-term
> - payment/accounting records: long-term
> - audit logs: long-term for sensitive actions
>
> Backup failure:
> - immediate alert
> - do not ignore
> - support@petwash.co.il and admin notified
> - GitHub action must not try to create bucket if service account lacks permission; bucket should exist and service account should only write objects.
>
> ============================================================
> 27. SECURITY RULES
> ============================================================
>
> - All QR tokens signed.
> - All payment webhooks verify signature.
> - All vend commands idempotent.
> - No frontend amount trusted.
> - No frontend role trusted.
> - No frontend station status trusted.
> - No admin action without audit.
> - No free wash without reason.
> - No wallet balance direct update.
> - No gift redemption without ledger.
> - No provider payout without completed booking.
> - No machine command without station/bay/product.
> - No unsafe K9000 wiring.
> - No customer wash via override key.
> - No deleting signed/payment/incident records.
>
> ============================================================
> 28. ACCEPTANCE TESTS
> ============================================================
>
> K9000 tests:
> 1. Card tap creates Nayax transaction.
> 2. Wallet QR starts only selected bay.
> 3. Gift QR cannot be reused.
> 4. Expired QR fails.
> 5. Wrong station QR fails.
> 6. Wrong bay QR fails.
> 7. Wallet debit only after vend success.
> 8. Vend failure opens support review.
> 9. Admin free wash requires reason.
> 10. Reconciliation catches mismatch.
> 11. Station offline blocks QR issue.
> 12. Duplicate scan does not pulse twice.
>
> Marketplace tests:
> 1. Provider cannot accept before approval.
> 2. Booking cannot confirm before both parties accept.
> 3. Payment amount comes from backend.
> 4. Cancellation creates fee logic record.
> 5. Tip only after completion.
> 6. Review only after completion.
> 7. Provider payout separate from customer wallet.
> 8. Incident case links to booking.
> 9. Chat history preserved.
> 10. SMS/push deep link to correct booking.
>
> Franchise tests:
> 1. Franchisee sees own station only.
> 2. Franchisee cannot change money.
> 3. Franchisee can order shampoo/supplies.
> 4. Franchisee can see maintenance manuals.
> 5. Franchisee cannot export all user data.
> 6. Trademark assets are controlled.
>
> ============================================================
> 29. FINAL ARCHITECTURE DECISION
> ============================================================
>
> Build PetWash like this:
>
> Octopus Backend = brain.
> K9000 = physical vending endpoint.
> Nayax = card/QR/payment/vend bridge.
> SUMIT/uPay = online payment/accounting rails.
> Wallet = PetWash closed-loop ledger.
> Gift = PetWash closed-loop QR product.
> Provider apps = SaaS marketplace.
> Admin = command center.
> Franchise = controlled business portal.
>
> Do not build scattered systems.
> Do not let every product have its own wallet/payment logic.
> Do not let K9000 become a dumb disconnected machine.
> Do not bypass safety.
> Do not let Nayax be the only record.
> Do not let SUMIT/uPay be the only record.
> Do not let front end decide money.
>
> One user.
> One ledger.
> One audit.
> One Octopus.
> Many arms.

## Appendix B — Operator's closing note, verbatim

> The most important decision: start with Nayax DOT + VPOS Touch as the official bridge, because the DOT reader is already designed for phone/paper QR and machine protocols. Add a PetWash IoT controller only if Nayax cannot do real-time wallet/gift approval cleanly. Never use the K9000 override key as customer logic; the manual shows override and service/test functions are operator/maintenance tools, and test outputs can damage pumps if used incorrectly without the wash gun on.
