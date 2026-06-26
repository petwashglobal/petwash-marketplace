# PetWash™ — Master Work Matrix (2026-06-26)

**Single owned source for everything PetWash needs built.** Supersedes and absorbs
`docs/petwash-master-backlog-2026-06-22.md` for forward planning. Maps every spec the
CEO has given over the last month into one sequenced matrix with status, owner, and
dependencies, so nothing is lost and work proceeds in order.

> Operating principle (CEO, 2026-06-26): *"map all work I wanted and take over the
> PetWash matrix once and for all… stage is yours."* — Capture everything now; ship
> one well-tested PR at a time; never drop a requirement.

---

## 0. Cross-cutting rules (apply to ALL work — non-negotiable)

| Rule | Source |
|---|---|
| ONE user_id + connected modules; backend = source of truth via `GET /me/status` | MASTER BIBLE |
| Money separation: reward ≠ wallet ≠ gift ≠ wash-credits ≠ provider earnings ≠ payout; never edit a ledger row | MASTER BIBLE |
| Discounts (5% Prestige + ≤10% senior/disabled) = **K9000 wash ONLY**, never platforms | discount-policy-K9000-only |
| Nayax = only public physical card at the machine; everything online via SUMIT/UPay | MASTER BIBLE |
| **Brand:** pure white + black + bright gold `#D4AF37` only — never cream/teal/purple/emerald-as-brand | brand-palette |
| **Brand language:** product NAMES stay English everywhere (Paw Finder, PetTrek, Walk My Pet, Pet Sitter Suite, Pet Wash Academy); translate only body; `™` after the word; clean RTL | brand-language-platform-names |
| Logo = official asset only, top-center, never recreated/recolored | logo-rule |
| No dead pages — every page saves a DB record (waitlist/wishlist/case) | waitlist epic |
| AI = assistant only; never auto-approve/refund/decide liability/edit balances | MASTER BIBLE |
| No fake data/balances/insurance; original wording only (no competitor copy) | multiple |
| Build gate: CI typecheck ratchet (no NEW type errors); merge = prod deploy | server-no-typecheck-gate |

---

## 1. Shipped (recent, merged to main)

| # | What | PRs |
|---|---|---|
| ✅ | Contact-first booking-request screen ("Get in touch", country phone, gold) | #1070 |
| ✅ | Nightly Postgres backup fix (pg_dump v18 pin + auto-create GCS bucket) | #1071 |
| ✅ | Customer enquiry-sent email + SMS + in-app on request creation | #1072 |
| ✅ | Search results → detail + contact-first wiring; re-gold provider card | #1073 |
| ✅ | petwash.co.il brand cleanup + dead gallery images removed | #1074 |
| ✅ | Platform names stay English (logo-purity sweep result) | #1075 |
| ✅ | Earlier: GET /me/status, treasury tables, discount app, CI typecheck gate, signup/Prestige flow, redeem-at-bay, iOS loading fix | #1054–#1069 |

---

## 2. Mission board (CEO task list) — status

| # | Mission | Status | Notes |
|---|---|---|---|
| 1 | Platform integrity audit | ✅ done | |
| 2 | Fix confirmed audit findings (money/fraud/state) | 🔄 in progress | drive to closed |
| 3 | K9000 redeem-at-bay screen | ✅ done | |
| 13 | Fix petwash.co.il (audit + repairs) | ✅ done | #1074 |
| 14 | Logo purity sweep | ✅ done | #1075 (logos pure; brand-names fixed) |
| 18 | iOS infinite-loading fix | ✅ done | |
| 4 | Prestige welcome → luxury bar | ⬜ | |
| 5 | Provider app luxury redesign | ⬜ | large |
| 6 | Smart inventory agent (low-stock) | ⬜ | |
| 7 | Shop front+back end-to-end | ⬜ | ties to waitlist wishlist (#22) |
| 8 | KYC/onboarding optional | ⬜ | ties to provider contract e-sign |
| 9 | Nayax DOT live-verify redemption | ⬜ | hardware-gated; see deep-research |
| 10 | Apple + Google Wallet pass | ⬜ | "id pass wallet" |
| 11 | Submit Customer (Prestige) app | ⬜ | needs CEO Apple/store assets |
| 12 | Submit Provider app | ⬜ | needs CEO Apple/store assets |
| 15 | Verify per-role dashboards | ⬜ | |
| 16 | Verify confirmations (email/SMS/push) | ⬜ | builds on #1072 |
| 17 | Merge open PRs #1017–#1020 | ⬜ | check if still open |
| 19 | Redesign app icons | ⬜ | |
| 20 | Brand sweep: images/photos + text | ⬜ | continues #1074/#1075 |

---

## 3. The five big EPICS (CEO master specs — queued, build after backlog)

Each has a full spec in agent memory; build in this order (dependencies noted).

### EPIC A — Booking lifecycle (task #21) · partly shipped
Spec: `booking-lifecycle-master-spec` + `booking-funnel-madpaws-map`.
Mad-Paws-class funnel, original branding. **Done:** contact-first (#1070), enquiry
email/SMS (#1072), results wiring (#1073). **Remaining:** enquiry-sent screen state;
results+profile luxury reskin; address-privacy reveal gating + audit;
contact-more-providers; price-breakdown (§17a total-inclusive); **Meet & Greet**
(EPIC A2); "PetWash Protected Booking Record" (original, counsel-gated, no insurance claim).

### EPIC A2 — Meet & Greet (task within #21)
Spec: `meet-greet-system-spec`. Optional pre-payment intro for Sitter Suite / Walk My
Pet only. Types (video/phone/public/home), `meet_greets` table, lifecycle, address-
privacy reveal log, AI prompts, admin + incident protection. Extend existing
`POST /api/booking-requests/:id/meet-greet`.

### EPIC B — Waitlist / Wishlist / demand-capture (task #22)
Spec: `waitlist-demand-capture-epic`. No dead pages → every page saves a record.
Universal `waitlist_entries` engine + platform states (LIVE/BETA/COMING_SOON/
WAITLIST_OPEN/REQUEST_ONLY/DISABLED). PetTrek waitlist; **Paw Finder** free lost/found
portal + AI matching (extend existing paw-finder routes); shop wishlist; platform/city
demand heatmap; admin panel; CRM tags; SMS/email. Ties to mission #7 (shop) and the
PetTrek/Paw Finder pages.

### EPIC C — Incident Report / Case Management (task #23)
Spec: `incident-case-management-epic` (32 sections). Every issue → CASE ID
(PW-CASE-…) + status/priority/risk + categories A-L + evidence (live camera + hash) +
timeline + SLA + auto-escalation + admin/user/provider views + 8 tables + audit.
Links to K9000/booking/paw-finder/shop/gift/wallet. AI = logged suggestions only.
Legal protection for PetWash Ltd. = the support-ticket/incident gap from
`legal-and-ops-gap-roadmap`.

### EPIC D — Brand sweep: images + text (task #20)
Spec: `brand-language-platform-names` + `brand-palette` + `logo-rule`. App-wide:
off-brand imagery, competitor-referencing copy, English platform names, ™ placement,
RTL, gold/white/black/green. Continues #1074/#1075.

### EPIC E — Provider contract e-sign wiring (under #8)
Map: `provider-contract-esign-infra-unwired`. The DocuSeal contract engine EXISTS but
onboarding never triggers it; `DocumentSigning.tsx` orphaned. Wire stage-1 → generate
contractor-agreement → e-sign → gate payout. Counsel gate currently false.

---

## 4. Recommended build sequence (CEO confirms / reorders)

1. **Finish the mission backlog first** (CEO directive) — bounded items:
   #16 confirmations → #2 audit-findings close → #20 brand sweep → #15 dashboards →
   #4 Prestige welcome → #10 Wallet pass → #6 inventory → #19 icons.
   (#5 provider redesign, #7 shop, #11/#12 store-submit, #9 Nayax-DOT are larger /
   CEO-gated — schedule explicitly.)
2. **Then the epics, in order:** A (finish booking lifecycle + A2 Meet & Greet) →
   B (waitlist/Paw Finder + shop wishlist, with #7) → C (incident system) →
   E (provider contract wiring, with #8). D (brand sweep) runs continuously alongside.

## 5. Open items needing CEO / infra (not codeable by agent)
- Redeploy so the pg18 backup image ships; confirm Neon PITR; allow GCS bucket create;
  **rotate the Neon password** (leaked in chat).
- Apple/store assets + certs for app submission (#11/#12).
- Counsel sign-off: PetWash Guarantee / Protected Booking Record wording; provider
  host-agreement gate; Hosting in-home-boarding liability.
- Decide real insurer (or keep "support + verified record" wording only).

---

*Full detail for every epic lives in the agent memory files referenced above. This
matrix is the index + sequence; update it as epics ship.*
