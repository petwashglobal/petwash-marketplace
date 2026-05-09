# 10 — Global Scaling Preparation

**Status:** Spec only. No runtime change.

**Scope class:** Informational / future. NO near-term PRs implied.

---

## 1. Objective

Document the abstractions we should be careful to preserve TODAY so a future cross-border launch (Australia, EU, UK, US) is feasible without a full rewrite. This section is the architectural conscience for v1 decisions in Sections 1-9: each one should at minimum not foreclose multi-jurisdiction expansion.

---

## 2. Current state

| Surface | Today |
|---|---|
| Currency | ILS only — codified in Money type (Part 2.1), VAT calculator, payout layer |
| Tax | Israeli VAT 18% + Israeli withholding rules |
| Provider taxonomy | Israeli עוסק מורשה / עוסק פטור |
| Bank | Mizrahi-Tefahot only (Masav file format) |
| Acquirer | Nayax (machines), UPay/SUMIT planned (online) |
| Legal entity | Pet Wash Ltd (Israel) |
| Compliance | SHAAM, חוק הגנת הצרכן, חוק מסמכי חשבונות |
| Languages | Hebrew + English |
| Time zone | Asia/Jerusalem (calendar-day math: PR-I) |

---

## 3. Target architecture (when expanding cross-border)

### 3.1 Multi-country tax abstraction

A `JurisdictionTaxRule` interface that each implementation satisfies:

```ts
interface JurisdictionTaxRule {
  jurisdictionId: string;            // 'IL', 'AU', 'GB', 'EU.DE'
  vatRate(category: TaxCategory): Money;
  vatTimingForChannel(ch): 'on_charge' | 'on_redemption' | 'no_vat';
  invoiceFormat(): InvoiceTemplateId;
  numberingDomainPrefix(): string;
  retentionYears(): number;
  withholdingPolicy(provider: ProviderTaxProfile): WithholdingPolicy;
  consumerCancellationWindow(channel): Duration;
  giftCardLifetimeMin(): Duration;
}
```

The current Israeli implementation becomes one concrete: `IsraelJurisdictionTaxRule`. Future jurisdictions add their own.

### 3.2 Currency abstraction

The Money type already carries currency (Part 2.1). Multi-currency adds:

- Currency-aware comparison (no cross-currency arithmetic without explicit conversion)
- FX rate source per period (CPA-approved) for cross-currency reporting
- Per-account preferred currency (settlement currency)
- Per-transaction currency (charge currency, may differ from settlement)

### 3.3 Provider adapter model (per-jurisdiction acquirer + bank)

A future `RegionPaymentConfig` mapping:

| Region | Card acquirer | Bank rail | Recurring | Local-rules adapter |
|---|---|---|---|---|
| IL | UPay/SUMIT/Nayax | Mizrahi-Tefahot Masav | SUMIT | IsraelJurisdictionTaxRule |
| AU (future) | Stripe AU / Zip / Tyro | NPP | Stripe Subscriptions | AustraliaJurisdictionTaxRule |
| GB (future) | Stripe UK | Faster Payments | Stripe Subscriptions | UKJurisdictionTaxRule |
| EU (future) | Stripe / Mollie / Adyen | SEPA Instant | Stripe / Mollie | EUJurisdictionTaxRule |

The unified `PaymentProvider` interface (Section 1) accommodates this — adapters are added without business-logic changes.

### 3.4 Legal entity abstraction

Pet Wash Ltd (Israel) is one operating entity. Future regions may require:

- Local subsidiaries (e.g. Pet Wash Australia Pty Ltd)
- Per-entity legal-identity store (`shared/finance-identity.ts` becomes `getEntityIdentity(jurisdictionId)`)
- Per-entity bank custody (TreasuryConfigService → multi-entity)
- Inter-entity transfer pricing rules (CPA territory)

### 3.5 Region-aware pricing

- Per-region price-list publishing
- Local consumer-protection price-display rules (e.g. EU "no surprise fees")
- Per-region FX policy if customer pays in a non-settlement currency
- Per-region promotional rules (some regions limit promos / loyalty by law)

### 3.6 Region-aware booking

- Per-region calendar-day math (Section 06 with timezone parameter; not just Asia/Jerusalem)
- Per-region cancellation windows (consumer-protection floor varies)
- Per-region operating hours / holidays

---

## 4. Decisions to PRESERVE today (so future expansion is possible)

| Today's decision | Why it matters for tomorrow |
|---|---|
| Money type is currency-tagged (Part 2.1) | Multi-currency adds an adapter, not a refactor |
| Numbering domain has prefix structure (Part 2.4) | Add `INVOICE.PETWASH.AU.K9000` without disturbing `INVOICE.PETWASH.K9000` |
| `JurisdictionTaxRule`-style boundary in VAT calculator | Israel-specific rules don't leak into general VAT logic |
| Calendar-day helper accepts timezone parameter (PR-I) | Per-region calendar math is one-line change |
| `PaymentProvider` abstraction (Section 1) | New region's acquirer = new adapter |
| Banking identity in `TreasuryConfigService` (encrypted, isolated from legal identity) | Per-entity bank rotation possible |
| Hebrew + English already separated at the rendering layer | EU languages add as more renderings, not as data duplication |
| Audit chain is hash-chained per Part 9 (jurisdiction-agnostic) | Hash chain doesn't care which legal entity issued |

---

## 5. Decisions to AVOID today (so future expansion isn't foreclosed)

| Avoid | Why |
|---|---|
| Hardcoding 18% VAT outside `ISRAEL_VAT_RATE` constant | Future rate change OR future region needs different rate |
| Inline `process.env.NAYAX_*` in business logic | New region's acquirer can't substitute |
| Hardcoded `Asia/Jerusalem` strings outside the calendar helper | Future region's calendar math needs different default |
| Single legal-entity assumption in invoice generator (`PET WASH LTD` baked in) | Future entity per-region |
| Single currency hardcoded as `'ILS'` outside the Money type definition | Future multi-currency requires plumbing |
| Israeli withholding rate inline in payout calculation | Future region has different withholding rules |
| ILS-only pricing UI strings (e.g. `₪${price}`) | Future locale needs different symbol / position |

These are easy to slip during implementation; reviewers should flag.

---

## 6. Open questions for human decision (FUTURE — not v1)

1. Which region after Israel? Drives which abstractions to actually build first.
2. Subsidiary vs branch structure?
3. Multi-currency strategy: settle to local currency vs ILS-back-home-with-FX?
4. Per-region acquirer choice (Stripe ubiquitous; local rails sometimes cheaper)
5. Cross-border data-residency rules (GDPR territory)

---

## 7. Dependency graph

**This section blocks:**
- Nothing in v1 (it is informational)

**This section is informed by:**
- All other sections — Section 10 is the conscience layer that ensures they don't foreclose expansion

---

## 8. Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| Israeli-specific assumption baked into v1 code | Multi-region adoption requires refactor | Reviewer checklist (Section 5 "avoid" list above) |
| Hash-chain or audit-event taxonomy made jurisdiction-specific | Cross-border audit becomes incompatible | Audit taxonomy is locked enum, jurisdiction-neutral |
| Numbering domain re-used across jurisdictions | Two regions' invoices share a sequence — illegal | Region prefix in numbering domain |

---

## 9. Reconciliation strategy

n/a — no runtime in this section.

---

## 10. Rollback / offset strategy

n/a — no runtime in this section.

---

## 11. Execution PR sequence

NO PRs implied by this section in v1. It is informational.

When CEO eventually decides to expand cross-border, this section becomes the spec layer and a new PR sequence (`PR-REGION-AU-1..N` etc.) is drafted at that time.
