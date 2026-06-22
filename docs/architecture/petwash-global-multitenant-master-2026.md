# PetWash — Global Master Wiring, Country Expansion & Multi-Tenant Architecture

**CEO master spec, captured 2026-06-23. Future roadmap (build AFTER Israel launch). Source of truth for global expansion.**

> ⛔ **NON-NEGOTIABLE #1: `petwash.co.il` (Israel live) must NOT be damaged, migrated, replaced, broken, or mixed with global beta.** Build global on `petwash.app` separately; connect later only via controlled API + tenant migration plan. No risky direct DB changes to Israel prod.

## 0–1. Two layers, domain structure
- **`petwash.co.il`** = Israel live local business (Hebrew, ILS, Israeli VAT, Israeli legal/providers/admin). Keep as-is.
- **`petwash.app`** = global future platform: global landing, country selector, SaaS, station operators, Prestige/Provider apps, franchise model.
- Country paths: `petwash.app/gr` (Greece), `/cy` (Cyprus), `/ae` (UAE), `/au` (Australia), `/eu`, `/uk`, `/us`. Use **`/gr` not `app.gr`** (cleaner/cheaper). `petwash.app/il` → redirect to `petwash.co.il`. Optional future `petwash.gr` → `/gr` redirects.

## 2. Global principle
One global brand + design system + app pair + codebase + admin shell. **But every country separated legally, financially, operationally, technically**: own legal entity/operator, tax/VAT/GST, provider agreement, customer terms, privacy, cancellation/refund, insurance reqs, payment processor, currency, invoice format, language, support, admin perms, provider approval, station contracts, approved suppliers, product/regulatory checks. **Never assume Israeli rules work elsewhere.**

## 3–4. Multi-tenant system
`petwash.app` = multi-tenant; **tenant = country/market** (IL, GR, CY, AE, AU, EU, UK, US). Every important table carries `tenant_id`, `country_code`, `currency`, `legal_version`, `tax_config`. Every user/wallet/provider/station/booking/payment/invoice/legal-acceptance/payout is tied to a `tenant_id`. NEVER one shared table without tenant separation.

## 5. Core DB tables (global)
- **global_identities** — one human across the system (id, email, phone, password_hash, apple_id, google_id, verified_at, status).
- **tenants** — each country (tenant_id, country_code, url_path, primary_domain, legal_entity_name/number, currency, timezone, languages, tax_name, tax_rate_config, invoice_config, payment_provider_config, privacy_region, support_email, status: planned/coming_soon/pilot/active/suspended/closed).
- **tenant_users** — local profile of a global user in one country (global_identity_id, tenant_id, local_terms/privacy_version+accepted_at, marketing_consent, local_status).
- **user_roles** — (tenant_user_id, tenant_id, role): customer / prestige_member / provider_pending|approved|suspended / station_operator / local_admin / global_admin.
- **customer_profiles**, **provider_profiles** (provider_status: draft/submitted/pending_review/missing_documents/approved/rejected/suspended), **wallets** (customer, local by country — NEVER mix balances across countries), **provider_earnings_wallets** (provider income, SEPARATE from customer wallet), **stations**, **bookings** (petwash_commission_percent default 15), **payments**, **legal_documents**, **legal_acceptances**, **country_compliance_reviews**.

## 6–7. Country config + routing
Per-tenant config JSON (currency, timezone, languages, tax, legal_entity, support, status, routing). IL=active/ILS/he+en/petwash.co.il. GR/CY (EUR, el+en), AE (AED, en+ar), AU (AUD/GST, en) = planned, each "must_be_confirmed_by_local_accountant_2026" + local lawyer review before launch. Routes on petwash.app: /countries, /gr, /gr/signup, /gr/provider/signup, /gr/operators, /operators, /smart-hub, /prestige, /provider, /il→redirect.

## 8–10. Mobile apps + TenantManager
TWO apps only (Prestige Customer + Provider) with a **country selector** as first screen. Each session carries selected_tenant_id, country_code, currency, language, legal versions, support, payment methods, feature flags. iOS workspace `PetWash.xcworkspace`, targets: PetWashPrestige, PetWashProvider, PetWashSharedKit, Networking, DesignSystem, WalletKit, LegalKit, TenantKit. **Do NOT hard-code Israel/Hebrew/ILS/Israeli-VAT/terms/support** — everything via TenantManager/CountryConfig. Every API call includes tenant headers (X-Tenant-ID, X-Country-Code, X-App-Language); **backend MUST validate the user is allowed that tenant**.

## 11–12. API + security
Global API `api.petwash.app/v1`, tenant-scoped. Israel existing backend: do NOT replace immediately; adapter later. **Every query tenant-scoped** (`WHERE tenant_id='GR' AND ...`, never just `user_id`). Middleware `requireTenantAccess(user, tenant_id)`: global_admin=all; local_admin=own tenant; operator=own station; provider=own profile; customer=own.

## 13–16. Country-specific legal system + annual review
Each country has its own versioned legal docs (customer: ToS/privacy/cookie/cancellation/wallet/QR/shop/custom-product/station/not-insurance; provider: agreement/contractor/tax/insurance/no-employment/no-off-platform/host-premises/customer-premises/incident/IP; station: operator/smart-hub-licence/equipment/install/consumables/approved-products/brand-IP/ops-manual/maintenance/insurance/SDS/site-owner/no-profit-guarantee/disclosure; SaaS: subscription/API/DPA/SLA/AUP/admin/support/security/country-addendum/beta). **Method = Global Master Template + Country Local Addendum.** Version format `IL-TOS-2026-001`, `GR-PROVIDER-2027-001`. **Annual review every Jan** per country (consumer/tax/privacy/insurance/employment/franchise/ecommerce/payment law); archive old, publish new, re-accept if material. `country_compliance_reviews` table. **If a doc is expired/unreviewed → block launch + provider onboarding + operator signing in that country.**

## 17–18. Tax + payments (per country)
Never hard-code Israel VAT. Per tenant: currency, tax name/rate, inclusive/exclusive display, invoice language/numbering, legal entity, receipt rules, payout tax treatment, fee treatment. `payment_provider_configs` per country. Provider payouts local (country bank/tax/agreement/invoice). **Commission default 15% (never 20%) unless country contract says otherwise; never hide fees** (show in pricing preview + payout statement + booking + payout record).

## 19–22. Prestige/wallet, provider, pricing, fraud (global rules)
Prestige = global identity/brand; **wallets LOCAL** (IL ₪ ≠ GR € — never mix funds without a legal/accounting transfer system). Apple Wallet pass: global brand, country-specific where needed, QR = secure token only (NO private data): `petwash.app/m/{token}` (IL: `petwash.co.il/m/{token}`). **Provider approval is country-specific** (approved in IL ≠ approved in GR; same human, local approval). Provider pricing: provider sets, platform enforces local minimums (no ₪0.02/nonsense), show price + 15% commission + payout + tax + currency. **Self-booking block:** `booking.customer_global_identity_id == provider.global_identity_id` → reject. Fraud flags: dup bank/device/IP, repeated refunds, QR abuse, fake bookings, off-platform contact, doc mismatch.

## 23–28. Smart Hub / SaaS / franchise / suppliers / shop
Smart Hub = full business system (K9000 dual-bay + brand + install + training + Nayax/QR + app listing + wallet/rewards + approved consumables + ops manual + maintenance + checklist + support + local legal). Operator daily/weekly/monthly checklist (48h-no-checklist → admin alert; critical safety → offline). SaaS modules (station mgmt, QR/wallet, rewards, marketplace, booking, payments, payouts, legal, compliance, incidents, consumables, maintenance, shop, admin, analytics) — tenant-scoped, with SaaS contracts. **Franchise levels: 1 Site Operator → 2 Licensed Operator → 3 Territory Partner → 4 Master Country Partner** (only after proof/legal/capital/targets); country rights conditional (stations opened, deadline, quality/compliance/rating, fees). Approved-supplier/product control (shampoo/conditioner/tea-tree/cleaning/collars): per-country import/labelling/safety/SDS/recall checks; **no medical claims**. Online shop local by tenant.

## 29–31. Admin roles, feature flags, launch checklist
Roles: Global Super Admin (all tenants) / Country Admin (one tenant) / Station Operator (own station) / Provider (own) / Customer (own). `feature_flags` per tenant (prestige/marketplace/smart_hub/shop/apple_wallet/nayax/subscriptions/franchise/payouts/legal_approved/tax_approved/payments_approved). **legal_approved=false → block launch; tax_approved=false → block payments; payments_approved=false → coming soon.** Per-country launch checklist (legal + tax + privacy + payments + operations + products + tech all signed off → status=active).

## 32–38. Roadmap + non-negotiables
Phases: 1 protect Israel → 2 build global shell (petwash.app) → 3 multi-tenant backend → 4 Greece pilot (`/gr`, Greek lawyer+accountant first) → 5 Smart Hub rollout (1 country/city/operator) → 6 SaaS + licensed operators → 7 country expansion (each only after local legal/tax sign-off).

**FINAL NON-NEGOTIABLES:** don't damage petwash.co.il; co.il=Israel, app=global; `/gr` not `app.gr`; every country has tenant_id + own legal/tax/privacy + annual review; provider approval country-specific; wallets country-specific; payments/invoices country-specific; station operators country-specific; PetWash is NOT insurance; QR has NO private data; commission default 15%; no self-booking same identity; don't give country rights too early; no shampoo/tea-tree medical claims; global owns brand/software/system/manuals; local operates under licence/config.

**See also:** [[master-backlog-and-franchise-2026-06-22]] (franchise epic), [[k9000-nayax-golive-state-2026-06-22]], the legal pack drafts in docs/legal/, and `petwash-israel-provider-onboarding-journey-2026.md` (the IL provider compliance gate).
