# PetWash — Master Backlog & Roadmap (consolidated 2026‑06‑22)

The single place that captures **everything** the CEO has specced or asked for, so nothing is lost. Status legend: ✅ shipped · 🟢 open PR · 🔒 blocked on CEO/vendor · 🔧 queued build · 📋 spec captured (future).

---

## 1. Shipped today (merged)
Money honesty (refund `refund_pending` not fake "refunded"; discount truth‑up K9000‑only 10% cap; sitter payout `pending` not fake "completed"; dead fake‑charge stubs fail‑closed; walk/sitter payout+refund fail‑closed), SMS template registry (70 events), read‑only **viewer** admin role (Ido), **signup gate** (customer/provider fork) + **consent + 18+** (un‑pre‑ticked, clickable terms), whole app **teal → Cartier gold** + warmed token `#D9B84C` + sheen, 3 old‑programmer wiring bugs, `/find‑provider` + `/talent` fake providers killed, AdminInbox fake KPIs removed, PrivilegeSignup fake stats removed, **provider min‑price floors**, payout‑rail design doc, legal‑pack pre‑counsel brief.

## 2. Open PRs awaiting merge
#953 (money‑rail design — needs answers, not a merge), #958, #959, #960, #961, #962, #963, #964.

## 3. 🔒 Blocked on the CEO (only you can unblock)
1. **Apple Pass cert** → register `pass.il.petwash.prestige` + create/export the cert in your Apple Developer account → 4 server secrets. Pass cannot be signed without it.
2. **Money‑rail #953**: 5 answers (which escrow ledger is canonical, capture vendor, bank API).
3. **Company number**: `515673247` vs `517145033` — confirm, then it goes on every invoice/legal doc.
4. **Legal pack** → send `docs/legal/legal-protection-pack-review-2026-06-22.md` to your Israeli lawyer.
5. **PrivilegeSignup** marketing stats — already removed; confirm no real counts wanted.

## 4. 🔧 Queued builds (each its own focused PR)
- **A — In‑app member pass page** (your Royal Tier design + live QR). Makes the pass work with NO Apple cert. *(approved)*
- **C — Long‑stay + house‑hosting rate engine** — day/week/2‑wk/month/3‑mo/6‑mo tiers + the host‑stays‑at‑your‑home service variant. Needs schema. *(approved)*
- **D — Provider/host rulebook PDF** — assemble approved legal text (now fed by the legal‑pack review). *(approved)*
- **B — Tier‑ladder reconciliation** — THREE different tier ladders exist (PrivilegeSignup Bronze→Crown, Loyalty page Member→Black Reserve, schema Bronze→Royal). Unify to one canonical ladder. *(approved)*
- SMS senders → migrate real events onto the registry (#948), one tested PR at a time (enrich copy, no downgrade).
- Surface insurance‑expiry + cancellation‑deadline data into admin refund/dispute + provider screens (follow‑ups to #945/#946).

## 5. 📋 Forms backlog (from the "Forms & Smart Flows" spec — priority 15)
Most ALREADY EXIST (don't rebuild — extend): provider tax declaration (✅ tax_status #947), insurance (✅ alerts #945), pricing min‑floor (✅ #962), pet profile/passport, booking, incident, refund, station issue, admin provider‑review (✅ #911), data‑rights/account‑deletion, marketing consent (communicationPreferences). **Gaps to add:** provider service‑selection extra questions (per‑service), home‑hosting premises check, meet‑&‑greet mini‑product, care‑card/service report, provider invoice‑upload gate (payout blocked until uploaded), accessibility support form, separate marketing‑consent management surface, auto‑save/save‑and‑continue + progress bar on long forms. Every important form must answer: who/when/what‑agreed/evidence/what‑changed/who‑approved.

## 6. 📋 Multi‑role architecture (one master identity, two app experiences)
ONE user, roles = customer / prestige_member / provider_pending|approved / admin. **Separate provider‑earnings wallet from customer wallet** (do not mix). Choose‑mode screen for "both" users + mode switch. **Self‑booking block** (`customer_user_id === provider_user_id` → reject) + self‑review block. Provider pending can log in but not receive bookings; expired insurance/tax blocks relevant services. 15% commission everywhere (✅ confirmed in code). The signup gate (✅ #956) is the front door; the rest is backend role wiring — largely exists, audit before building.

## 7. 📋 Legal‑pack fixes (from #964 — for the lawyer, then wire in app)
CRITICAL: **C2 payments/stored‑value licensing** (wallet+e‑gift+escrow hold funds → may need a payment‑services licence or PSP‑held/trust funds — biggest exposure, clear before payments go live); **C4 "not insurance"** (re‑structure to no‑premium‑discretionary or insurer‑backed); **C1 §17a all‑in price** (Wolt precedent — bind in checkout); C3 contractor re‑classification hardening. HIGH: H1 Privacy → Amendment 13 + Spam‑Law opt‑in; H2 cancellation statutory floor (14‑day / 5%‑₪100); H3 VAT 18% + disclosed‑agent in docs; H4 premises addenda + recording clause; H5 incident‑form no‑admission header. Missing docs: walk/transport/station/wallet terms, sub‑processor DPAs, cookie notice.

## 8. 📋 K9000 Smart‑Hub Licensed‑Operator / Franchise model (NEW big future epic — "fix later")
*Captured from the CEO's 33‑section spec. Not to build now — sequenced after launch. Start as a "Licensed Operator Program" (3 contracts), upgrade to full franchise once proven.*

- **Models:** A company‑owned · B licensed site operator · C full franchise · D management agreement · E joint venture.
- **PetWash supplies (full package):** K9000 dual‑bay + Nayax/QR + install + consumables (shampoo/conditioner/tea‑tree — **regulatory check required**: Israeli MoH cosmetics registration, labelling, no medical claims) + operator dashboard + training + marketing + legal/compliance.
- **Three‑leg system** (McDonald's‑style): PetWash Ltd (brand/system/app/standards) + operator (site ops/cleaning/local marketing/fees) + approved suppliers.
- **Revenue streams:** setup fee · machine sale/lease margin · monthly platform fee · royalty 8–12% (lawyer/accountant) · consumables margin · maintenance plan · marketing fund 1–3% · online‑shop upsell · Prestige membership · provider‑marketplace 15%.
- **Packages:** Starter Licence · Smart Hub Pro · Territory Partner · Managed Site.
- **15 legal docs** (Israeli franchise lawyer): Franchise/Licence Agreement, Disclosure Pack, Site‑Owner Agreement, Equipment Supply, Approved‑Supplier, Consumables Purchase, Operations Manual, Brand/IP Licence (record TM with the Trademark Register; know‑how as trade secret), Training Cert, Insurance Schedule, Data‑Processing Addendum, Safety/Chemical (SDS) Manual, Maintenance SLA, Launch Marketing Plan, Exit/Termination Checklist.
- **Operator tooling:** site‑score system (≥80 excellent / 65–79 conditional / <65 reject), daily/weekly/monthly checklists in‑app (48h‑no‑checklist → admin alert), operator scorecard (A–F), quality‑control rights (inspect/audit/suspend listing/terminate), approved‑consumables‑only supply chain, per‑site financial model + KPIs, uptime SLA, refill monitoring, consumables reorder portal, station appears in app station‑finder (open‑now/24‑7/dual‑bay/near‑me), QR online‑shop upsell after wash.
- **Non‑negotiables:** **no profit guarantee** disclaimer everywhere · territory rules need competition‑law review (Economic Competition Law / block exemptions) · "PetWash is not insurance" · operators carry own insurance (PetWash additional insured) · approved products only.
- **Launch path:** Phase 1 pilot flagship → Phase 2 documentation → Phase 3 first 3–5 licensed sites → Phase 4 scale (territories + operator academy + supply warehouse).
- **Existing in repo:** franchise/HR/finance admin modules already exist (per prior audits) — extend, don't rebuild. The K9000 dual‑bay hardware model is sorted; the live blockers are Nayax wash‑activation + the cert (see `k9000-nayax-golive-state-2026-06-22`).

## 9. Standing rules (apply to all the above)
Brand: pure white · black · bright metallic gold `#D9B84C` (token `--pw-gold`) accent only, real logo top‑center, RTL Hebrew‑first. 15% commission (never 20%). Discounts K9000‑only, capped 10% (15% via Black code only). VAT 18%. No fake data in production. Money math + schema changes need explicit approval. One purpose per PR; batch merges. Every money/admin mutation audit‑logged.
