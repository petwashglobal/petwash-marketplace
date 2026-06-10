# PetWash™ Shop — Returns & Cancellation Policy (Physical Goods)

| | |
|---|---|
| **Status** | Adopted — CLO draft approved for shop launch |
| **Date** | 2026-06-10 |
| **Owner** | CLO (agent) on CEO instruction 2026-06-10: "be hard by the law on returns… always protect us" |
| **Scope** | Physical goods sold via `/shop` (flag-gated). Does NOT cover services/bookings (covered in `client/src/pages/legal/Terms.tsx`), eGifts (`EGiftPolicy.tsx`), or wash packages |
| **Legal basis** | חוק הגנת הצרכן, התשמ״א-1981 — §14ג (מכר מרחוק), §14ג(ד) (חריגים), §14ה (דמי ביטול), §14ג1 (אוכלוסיות מוגנות); תקנות הגנת הצרכן (ביטול עסקה), התשע״א-2010 |
| **UI surfaces** | Checkout drawer disclosure (`ShopStore.tsx`), engraving panel final-sale notice, orders-page cancel flow (`ShopOrders.tsx`) |

---

## 1. Design principle

**Exactly as hard as the law allows — never harder.** Every protection the statute gives the seller is taken in full. No term in this policy exceeds the statute, because over-reaching terms are voidable (תנאי מקפח, חוק החוזים האחידים), invite Consumer Protection Authority action, and create the class-action template we are deliberately avoiding (see Wolt precedent in `pricing-display-audit-2026-05-31.md`).

## 2. Customer-facing policy (canonical text)

### 2.1 Before dispatch — free cancellation

Cancel any order **before dispatch** from *My Orders* (`/shop/orders`) for a **full refund to your PetWash wallet**, no fee, no questions.

> System behavior (current, verified): `POST /api/shop/orders/:id/cancel` allows statuses `pending` / `confirmed` / `payment_required`, restores stock, releases escrow, credits the wallet in full. We refund 100% even though §14ה would permit a 5%/₪100 fee — a deliberate generosity while the order hasn't shipped (costs us nothing, removes dispute surface). **Changing this to charge a fee is a money-logic change requiring separate CEO approval.**

### 2.2 After delivery — statutory 14-day right (regular goods)

For goods that are NOT in the exempt list (§2.3), the customer may cancel within **14 days of receiving the goods** (or of receiving the disclosure document, the later), per §14ג(ג)(1).

Conditions we enforce (all permitted by law):

- **Cancellation fee:** 5% of the transaction or ₪100, whichever is LOWER (§14ה(ב)(1)) — charged on change-of-mind cancellations. Not charged when cancellation is due to defect or non-conformity (§14ה(א)).
- **Return shipping** on change-of-mind is borne by the customer; goods are returned per our instructions.
- **Condition:** goods must be returned unused, in original packaging, with proof of purchase. (Deterioration caused by the customer may be charged per §14ה(ב)(2) — ירידת ערך.)
- **Original delivery fee** is not refunded on change-of-mind cancellation after the goods shipped.
- **Refund timing:** within 14 days of the cancellation notice, to the original payment method (wallet).

### 2.3 EXEMPT from the cancellation right (final sale) — §14ג(ד)

1. **Custom-engraved / personalized items** — any product engraved with a pet name, owner name, or other personalization, manufactured specially for the customer following the order (§14ג(ד)(4) — "טובין שיוצרו במיוחד בעבור הצרכן בעקבות העסקה"). **Final sale.** This covers the bespoke engraving line (collars, ID tags, keychains).
2. **Perishable goods** (§14ג(ד)(1) — "טובין פסידים") — treats and food items. Additionally, opened/unsealed food is never returnable for hygiene reasons.
3. **Sealed care products** (shampoo, conditioner, tea-tree oil) whose seal/packaging was opened — returnable only while sealed.

**Disclosure duty:** these exemptions are shown (a) on the engraving panel itself before add-to-cart ("final sale" line), and (b) in the checkout disclosure, BEFORE payment. Disclosure before commitment is what makes the exemption clean to enforce.

### 2.4 What we can NEVER refuse (non-negotiable statutory floor)

- **Defective or non-conforming goods** — including engraved items (e.g. we engraved the wrong name, or the tag broke): replacement or full refund including delivery, no fee, our return shipping. Engraving exemption does NOT shield us from our own defects. Misspelled-by-customer names are not a defect (we engrave the string the customer typed and previewed — the live preview in the engraving panel is our evidence of confirmation).
- **Protected populations** (§14ג1): senior citizens (65+), new immigrants, persons with disabilities — up to **4 months** cancellation window on distance sales that included a conversation (incl. electronic communication). Support must honor this; never auto-reject by the 14-day clock alone.
- Refund of the transaction price on lawful cancellation may not be conditioned on anything beyond what the statute allows.

## 3. Operational notes

- **Post-delivery returns have no backend flow yet** — they are handled by support manually (wallet credit via the audited admin path). A `return_requested → returned → refunded` order-state extension is future work (shop SDD §5 lifecycle), separate PR, money-approval required.
- **Receipts/credit notes:** issued via SUMIT (templates prepared in the sumit.co.il control panel). A cancellation after invoice issuance requires a credit note (חשבונית זיכוי) — SUMIT flow, not manual edits.
- **Wolt/courier refusals at the door** are treated as pre-delivery cancellation (full statutory rights).

## 4. What the UI shows (kept deliberately short and luxury-toned)

- Engraving panel: one line — *"Custom engraved · final sale (defects excepted) / חריטה אישית · ללא החזרה (למעט פגם)"*.
- Checkout drawer: collapsible "Cancellation & returns" with the four bullets (free before dispatch / 14 days by law / engraved & perishables final sale / defects always covered).
- Orders page cancel: "full refund before dispatch" (matches actual behavior).

## 5. Maintenance

Re-validate against statute on any amendment to חוק הגנת הצרכן (the CLO compliance report `CLO-israel-2026-compliance-report.md` tracks pending amendments). If the backend ever adds the 5%/₪100 fee or a post-delivery return flow, update §2.1/§3 and the UI copy in the same PR.
