# PetWash Ltd — Smart Accounting / Invoice / Receipt / Document System (CEO spec, 2026-06-23)

Canonical go-live accounting spec. **The accountant + lawyer must approve the final VAT
treatment + document model before live use.** CEO note: "I might be wrong — don't trust
my team, always check smart" → verify every rule against the real SUMIT API
([[sumit-api-reference-2026-06]], docs/integrations/sumit-officeguy-api-reference-2026.md)
and the EXISTING code before building (a fiscal stack already exists — see audit).

## Non-negotiables (load-bearing)

1. **PetTrek = FROZEN.** No income items, no invoices, no payouts, no billing. Keep disabled until PetWash Ltd approves.
2. **REMOVE all "operator" language from accounting**: station operator, operator invoice, station operation, SaaS fee, Smart Hub licence fee, maintenance plan, operator subscription, operator bank account, operator dashboard, franchise/operator accounting, consumables-supply-to-operator. **Do NOT create** income items PW_STATION_OPERATOR_FEE / PW_OPERATOR_INVOICE / PW_SMART_HUB_LICENSE / PW_SAAS_MONTHLY_FEE / PW_MAINTENANCE_PLAN / PW_CONSUMABLES_SUPPLY_TO_OPERATOR.
3. **Public wash wording** = "self-service dog wash" / "שטיפת כלבים בשירות עצמי" (Pet Wash™ — Premium Self-Service Dog Wash). Never "station operation / Smart Hub operator / operator licence / SaaS station fee".
4. **Server-side ONLY accounting.** Never call SUMIT/Upay/CreditGuy from browser/app/public site. Public surface = POST /api/accounting/{issue-document,refund,send-document,provider-payout-preview}. Never expose accounting/payment secrets, card tokens, provider bank, PDFs without access control.
5. **Document only AFTER payment confirmed.** Never delete final docs — cancel/credit only.
6. **VAT by date** via /accounting/general/getvatrate/ — never hardcode. Store the rate on the record.
7. **Provider marketplace commission = 15%** (never 20% unless management changes in writing).
8. **PetWash Ltd is NOT an insurance company** — footer on relevant docs.

## Active modules (go-live)
Self-service dog wash · wash packages · gift cards · PetWash Shop · PetWash Academy ·
Pet Sitter · Walk My Pet · approved provider services (grooming/transport) · provider payouts.

## Income item catalog (stable codes — full list in CEO spec §8)
PW_SELF_SERVICE_DOG_WASH_{SINGLE,PREMIUM,EXTRA_TIME,UPGRADE} · PW_WASH_PACKAGE_{5,10,CUSTOM} ·
PW_GIFT_CARD · PW_GIFT_WASH_PACKAGE · PW_SHOP_{COLLAR,ENGRAVED_TAG,TREATS,CLOTHING,SHAMPOO,
CONDITIONER,TOWEL,ACCESSORY} · PW_SHIPPING · PW_ACADEMY_{COURSE,CERTIFICATE} ·
PW_PET_SITTER_{BOOKING,HOME_VISIT,OVERNIGHT} · PW_WALK_MY_PET{,_EXTRA_DOG} ·
PW_PROVIDER_{GROOMING,TRANSPORT} · PW_PLATFORM_COMMISSION. (HE/EN titles in spec.)

## Document flows (§6)
- **A — Paid now**: wash/package/gift/shop/academy/sitter/walk/provider booking → חשבונית מס/קבלה (accountant confirms type).
- **B — Invoice first**: approved B2B/corporate/academy-group only. NOT "operator invoice".
- **C — Draft → finalise**: create → /accounting/documents/movetobooks/ when payment/ split/details final.
- **D — Cancel/credit/refund**: /accounting/documents/cancel/ + refund via payment provider. Never delete.

## DB tables (§25)
accounting_documents · accounting_failures · income_item_mappings · gift_cards ·
wash_packages · provider_payout_records. (Columns in spec.)

## Backend service (§26) — AccountingService
createOrUpdateCustomer · getVatRate · createDraftDocument · finalizeDocument · sendDocument ·
getDocumentPdf · cancelDocument · getCustomerDebt · createIncomeItemIfMissing ·
verifyBankAccount · createTransactionBatch · issue{SelfServiceWash,WashPackage,GiftCard,
ShopOrder,Academy}Receipt · issue{PetSitter,WalkMyPet}Document · createProviderPayoutRecord.
Idempotent issue flow (§27): payment-confirmed gate → find/create customer → getVatRate →
build lines → createDocument(draft) → movetobooks → getPdf → send → store doc id.

## Error handling (§28)
Payment-ok-but-doc-fails → keep order, mark accounting_pending, accounting_failures row,
alert + auto+manual retry, never double-charge. Email-fail → resend. PDF-fail → retry.
Customer-create-fail → block doc. VAT-API-fail → fallback only if accountant approved.
Payout-uncalculable → block payout.

## Provider payout (§18) — NOT a customer receipt
gross − 15% commission − (processing fee only if contract says provider bears it) = payout.
Blocked unless: approved · bank verified (/accounting/general/verifybankaccount/) · tax
declaration valid · insurance valid if required · no open incident · job complete · customer
payment cleared · provider invoice uploaded if accountant requires. Books batch only with
accountant-approved mapping (/books/transactions/createbatch/).

## Build sequence (audit-first — do NOT rebuild what exists)
0. AUDIT existing vs this spec (agent) — fiscal stack is largely BUILT: IsraeliDigitalReceiptService,
   TaxSequenceService, SumitClient, SumitSyncService, per-platform booking docs, egift/wash-package
   ledgers, payout rails. Map EXISTING → spec; list real GAPS.
1. SAFE cleanup: remove operator/station/SaaS/Smart-Hub-licence wording from accounting code + copy.
2. Income-item-mapping table + stable codes (income_item_mappings) if not present.
3. accounting_documents/failures unified table + retry/alert if not present.
4. Per-module issue methods wired to the EXISTING SUMIT client (reuse, don't re-add).
5. movetobooks (issue official doc only after payment) — ties to the SUMIT gettransaction fix.
6. Admin accounting dashboard tabs (§24) — reuse existing admin payments/finance surfaces.
BLOCKED on accountant/lawyer: final VAT treatment per case (gift/prepaid/wallet/coupon/refund/
split/commission/academy/engraving/shipping/international), Pet-Sitter document model A vs B.

## See also
[[fiscal-pipeline-live-state-2026-06-17]] · [[booking-fullcircle-findings-2026-06-18]] ·
[[discount-policy-k9000-only-2026-06-22]] · [[service-division-salad-2026-06-21]] ·
[[sumit-api-reference-2026-06]] · docs/integrations/sumit-officeguy-api-reference-2026.md
