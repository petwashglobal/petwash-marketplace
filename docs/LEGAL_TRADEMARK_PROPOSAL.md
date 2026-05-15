# Trademark & IP Protection — Proposal

**Status:** Read-only audit + drafted public-safe content + implementation plan. **NO code changes by this PR.**
**Trigger:** Israeli Trade Mark No. 381713 registered 01/12/2025, valid until 05/03/2035, Class 44 (Pet washing, cleaning, and grooming services).
**Scope:** Add a public trademark notice surface to PetWash's existing legal section, with content safe for public publication (no owner names, no addresses, no ID numbers, no signatures, no scans).

---

## Important warnings before any implementation

1. **No code changes by this PR.** It is the proposal. Implementation only starts after CEO approval AND written sign-off from an Israeli IP attorney on the drafted text.
2. **I am not an Israeli IP attorney.** The drafted text below is standard-practice template content. It must be reviewed and approved by a qualified Israeli IP lawyer before it goes live. Where I'm uncertain about exact Israeli legal phrasing, the lawyer's wording wins.
3. **The original certificate scan stays private.** Per CEO instruction: do not upload the certificate PDF or image publicly. The drafted page references the registration by trade mark number only; anyone who wants to verify can do so at the Israel Patent Office public registry.
4. **No personal information.** No owner names, no addresses, no Israeli ID numbers, no signatures, no contact persons. Only public-safe info (TM number, class, dates).
5. **This proposal covers Class 44 only.** PetWash's marketplace platform, eGift cards, software/app, sub-brands (K9000, Sitter Suite, Walk My Pet, PetTrek, Pet Wash Academy) likely need additional class filings. Flagged for the IP lawyer in §6.

---

## 0. TL;DR

PetWash has a real, valid Israeli trademark registration on the wordmark + logo for pet washing/grooming services. This proposal adds three small things to the website so visitors, partners, and any future infringers know the mark is protected and registered:

1. A new public page at `/legal/trademark` with the drafted notice (HE + EN), surfaced from the existing hamburger menu's LEGAL section.
2. A short footer attribution line referencing the registration.
3. Six-language i18n entries for the new menu item.

No personal info ever appears on the site. The original certificate scan is never uploaded. The registration is referenced by trade mark number only.

After CEO + Israeli IP lawyer approve the drafted text below, I open one small implementation PR. Estimated effort: less than 1 day.

---

## 1. Current state of the legal section (audit findings)

Verified by read-only audit of the codebase, May 2026.

**Existing legal routes** (`client/src/App.tsx`):

- `/legal/terms`
- `/legal/privacy`
- `/legal/egift-policy`
- `/legal/loyalty-terms`
- `/legal/cookies`
- `/legal/marketplace-terms`
- `/legal/disclaimer`
- `/accessibility` (with a redirect from `/legal/accessibility`)

**Hamburger menu LEGAL section** (`client/src/components/PetWashHeader.tsx`):

- Section title is internationalized in 6 languages: EN "LEGAL", HE "משפטי", RU "ЮРИДИЧЕСКАЯ ИНФОРМАЦИЯ", FR "MENTIONS LÉGALES", ES "LEGAL", AR "قانوني".
- Existing menu items: terms, privacy, egift-policy, loyalty-terms, cookies, accessibility.

**Footer** (`client/src/components/Footer.tsx:212`):

- Currently shows: `© 2026 Pet Wash™ Ltd`.
- ™ symbol consistent in the brand mark and across the site.

**"Smart Protect"** — searched for `smart.?protect`, `SmartProtect` across `client/src`. **Not found.** It does not exist as a feature in the codebase today. See §7 for clarification options.

**™ symbol usage** — already consistent. The brand renders "Pet Wash™" or "PetWash™" throughout. No changes needed there.

---

## 2. The registration — public-safe facts only

These are the only facts that should appear on the public page. They match what the Israel Patent Office publishes in its public registry, so anyone can independently verify.

- **Trade Mark Number:** 381713
- **Class:** 44 (Pet washing, cleaning, and grooming services)
- **Application Date:** 5 March 2025
- **Registration Date:** 1 December 2025
- **Registration Valid Until:** 5 March 2035
- **Authority:** Israel Patent Office (רשות הפטנטים), Ministry of Justice, State of Israel
- **Mark covered:** PetWash word mark + the PetWash logo (water-drop + paw design)

**NOT going on the public page** (per CEO instruction):

- The certificate number 033554437 (this links to the scanned document, which stays private).
- Owner name (Pet Wash Ltd — only referenced as "the trademark holder" in the public notice).
- Any address, ID numbers, contact persons, or signatures.
- The certificate scan itself.

---

## 3. The drafted public notice — English

This is the proposed full content of the new `/legal/trademark` page in English. **Requires Israeli IP attorney review before going live.**

---

> # PetWash™ — Registered Trademark
>
> PetWash™ is a registered trademark in the State of Israel.
>
> The PetWash word mark and the PetWash logo (water-drop and paw design) are protected by Israeli Trademark Law [נוסח חדש] 5732–1972. Unauthorized use, reproduction, or imitation of the PetWash trademark, the PetWash logo, or any confusingly similar mark in connection with pet washing, cleaning, or grooming services in Israel may give rise to civil and criminal liability under Israeli law.
>
> ## Registration details
>
> - Trade Mark Number: **381713**
> - Class: **44** (Pet washing, cleaning, and grooming services)
> - Application Date: 5 March 2025
> - Registration Date: 1 December 2025
> - Registration Valid Until: 5 March 2035
> - Registry: Israel Patent Office, Ministry of Justice, State of Israel
>
> The registration is on the public Register of Trade Marks and may be verified directly at the Israel Patent Office.
>
> ## Permitted use
>
> Fair use of the PetWash name in journalism, commentary, criticism, education, or non-commercial reference is not affected by this notice. Authorized partners, affiliates, and licensees are required to follow the PetWash Brand Guidelines.
>
> ## Unauthorized use
>
> If you become aware of any unauthorized use of the PetWash trademark or the PetWash logo, please report it through the contact channels listed on this site. The trademark holder reserves the right to take all appropriate legal action against unauthorized use of its registered marks under Israeli law.
>
> ## Sub-brands and additional registrations
>
> Additional trademark filings and pending applications relating to the PetWash family of services and sub-brands may exist. The absence of a reference on this page does not constitute a waiver of any rights.
>
> ## Last updated
>
> [Date the page is published — to be filled at implementation.]

---

## 4. The drafted public notice — Hebrew

Mirror version of the English text. **Same review requirement applies — Israeli IP attorney must approve the Hebrew phrasing.**

---

> # PetWash™ — סימן מסחר רשום
>
> PetWash™ הוא סימן מסחר רשום במדינת ישראל.
>
> סימן המילה PetWash והלוגו של PetWash (טיפת מים וטביעת כף רגל) מוגנים מכוח פקודת סימני מסחר [נוסח חדש], תשל"ב–1972. שימוש בלתי מורשה, שכפול או חיקוי של סימן המסחר של PetWash, של הלוגו, או של כל סימן הדומה לו עד כדי הטעיה, בקשר לשירותי רחיצה, ניקיון או טיפוח של בעלי חיים בישראל, עלול לחשוף את העושה זאת לאחריות אזרחית ופלילית לפי הדין הישראלי.
>
> ## פרטי הרישום
>
> - מספר סימן מסחר: **381713**
> - סוג מוצרים ושירותים: **44** (שירותי רחיצה, ניקיון וטיפוח של בעלי חיים)
> - תאריך הגשה: 5 במרץ 2025
> - תאריך רישום: 1 בדצמבר 2025
> - תוקף הרישום עד: 5 במרץ 2035
> - רשות הרישום: רשות הפטנטים, משרד המשפטים, מדינת ישראל
>
> הרישום מצוי בפנקס סימני המסחר הציבורי וניתן לאמת אותו ישירות אצל רשות הפטנטים.
>
> ## שימוש מותר
>
> שימוש הוגן בשם PetWash בעיתונאות, בפרשנות, בביקורת, בחינוך או בהתייחסות שאינה מסחרית — אינו מושפע מהודעה זו. שותפים מורשים, חברות שלובות וזכייניים מחויבים לפעול בהתאם להנחיות המותג של PetWash.
>
> ## שימוש בלתי מורשה
>
> אם נתקלת בשימוש בלתי מורשה בסימן המסחר של PetWash או בלוגו של PetWash, אנא דווח באמצעות ערוצי הקשר המופיעים באתר זה. בעל סימן המסחר שומר לעצמו את הזכות לנקוט בכל הליך משפטי הולם כנגד שימוש בלתי מורשה בסימני המסחר הרשומים שלו, על פי הדין הישראלי.
>
> ## תתי-מותגים ורישומים נוספים
>
> ייתכן שקיימים רישומי סימני מסחר נוספים ובקשות תלויות ועומדות הקשורות למשפחת השירותים של PetWash ולתתי-המותגים שלה. היעדר אזכור בדף זה אינו מהווה ויתור על זכויות כלשהן.
>
> ## עודכן לאחרונה
>
> [תאריך פרסום הדף — למילוי במהלך היישום.]

---

## 5. Surfaces to add the notice to

### 5.1 New page: `/legal/trademark`

- File: `client/src/pages/legal/Trademark.tsx` (matches URL structure of other legal pages).
- Renders the drafted content (§3 EN / §4 HE) based on language selection.
- Uses the standard Layout + same visual treatment as `/legal/terms` and friends (consistent legal-section UX).
- Page title: "Trademark" / "סימן מסחר".
- Meta description (EN): "PetWash is a registered trademark in Israel. View the registration notice."
- Meta description (HE): "PetWash הוא סימן מסחר רשום בישראל. צפו בהודעת הרישום."
- OG image: the standard PetWash logo (NOT the certificate scan).

### 5.2 Hamburger menu link

In `client/src/components/PetWashHeader.tsx`, add a new entry under the existing LEGAL section (after `cookies`, before `accessibility`):

```
{ id: "trademark", labelKey: "trademark.label", href: "/legal/trademark" }
```

i18n labels (six languages, matching the rest of the menu):

- EN: "Trademark"
- HE: "סימן מסחר"
- RU: "Товарный знак"
- FR: "Marque déposée"
- ES: "Marca registrada"
- AR: "علامة تجارية"

### 5.3 Footer attribution

Extend the existing footer copyright line at `client/src/components/Footer.tsx:212`:

- **Before:** `© 2026 Pet Wash™ Ltd`
- **After (EN):** `© 2026 Pet Wash™ Ltd · Registered Trademark in Israel (TM 381713, Class 44)`
- **After (HE):** `© 2026 פט וואש™ בע״מ · סימן מסחר רשום בישראל (מס׳ 381713, סוג 44)`

The phrase "Registered Trademark in Israel" / "סימן מסחר רשום בישראל" links to the new `/legal/trademark` page.

### 5.4 Route registration

In `client/src/App.tsx`, add:

```
<Route path="/legal/trademark">
  <Trademark />
</Route>
```

Placed alphabetically near the other legal routes.

### 5.5 What NOT to add

- No certificate PDF or image hosted on the site.
- No owner names on the page or in metadata.
- No addresses, no ID numbers, no signatures.
- No contact persons by name.
- No claims of additional registrations that don't actually exist yet (only reference TM 381713 specifically).

---

## 6. Honest gaps — please discuss with the Israeli IP attorney

These are real strategic considerations the IP lawyer should weigh in on. I am NOT giving legal advice; I am surfacing things the lawyer should consider.

1. **Class 44 only**. The registration covers pet washing/cleaning/grooming services. It does NOT automatically cover:
   - The PetWash app/software (typically Class 9 and/or Class 42).
   - The marketplace platform itself / business operations (Class 35).
   - eGift cards and stored value (Class 9 and/or Class 36).
   - Pet boarding / lodging via Sitter Suite (Class 43).
   - Pet transport via Walk My Pet (Class 39).
   - Pet Wash Academy educational content (Class 41).
   - Anything sold under the PetWash brand that's not a wash/groom service.
2. **Sub-brand protection**. K9000™, Sitter Suite™, Walk My Pet™, PetTrek™, Pet Wash Academy™, Paw Finder™, Nayax Pet Wash™ (if not Nayax's own mark) — each sub-brand likely needs its own filing if it's not already covered.
3. **International protection**. If PetWash plans to operate outside Israel, the Madrid Protocol allows filing in multiple jurisdictions through a single application. Worth discussing if expansion is planned.
4. **Domain protection**. Defensive registration of `petwash.he`, `petwash.co.il` variants, common misspellings, and `.com`/`.net`/`.org` variants if not already owned. Trademark holders typically also subscribe to a watch service that alerts on new filings of confusingly similar marks.
5. **Sticker / packaging notice**. The `®` symbol can now be used in connection with the registered word mark and logo in commercial contexts (vs. the ™ which signals an unregistered claim). The IP lawyer should advise where `®` vs `™` is appropriate.
6. **Enforcement strategy**. This proposal does not define enforcement procedures (cease-and-desist letters, takedown notices, court action). The IP lawyer should advise on the in-house decision tree for spotting infringement, sending notices, and escalating.

None of items 1-6 are required for the public notice page to ship. They are separate workstreams.

---

## 7. About "Smart Protect"

You mentioned placing the trademark notice under "smart protect" in the hamburger menu. I searched the codebase and **no feature, page, or component named "Smart Protect" exists today**. Three reasonable interpretations:

- **A.** You meant the existing LEGAL section in the hamburger menu (closest match by intent).
- **B.** You want to create a new "Smart Protect" section that bundles trademark + IP + privacy + safety into one branded umbrella.
- **C.** You meant something else specific in your mind.

**Default recommendation:** Option A — surface the new page under the existing LEGAL section, as `/legal/trademark`. Lowest risk, cleanest fit.

If you want Option B (create a new "Smart Protect" section), that's a separate scope question: which existing pages move into it, what's the visual treatment, and where it sits in the hamburger menu hierarchy. I'd treat that as a follow-up proposal after this trademark page ships.

---

## 8. Implementation sequence

This is what happens if the proposal is approved.

1. **CEO reads this doc** on iPad Safari (GitHub web UI).
2. **CEO forwards §3 (EN) and §4 (HE)** to the Israeli IP attorney for review.
3. **IP attorney returns approved/revised text.** Any wording changes from the lawyer override my drafted text.
4. **CEO greenlights implementation**, including which "Smart Protect" interpretation to follow (§7 A/B/C).
5. **I open one small implementation PR** with the approved content:
   - `client/src/pages/legal/Trademark.tsx` (new file).
   - `client/src/App.tsx` (one new route).
   - `client/src/components/PetWashHeader.tsx` (one new menu item + 6 i18n labels).
   - `client/src/components/Footer.tsx` (one extended copyright line).
6. **CEO reviews and merges.**
7. **Production deploy.** The notice is live.

Estimated diff for the implementation PR: ~150 lines across 4 files. No new dependencies. No schema, no payment, no server changes.

---

## 9. What this PR (the doc) does NOT do

- Does not change any code.
- Does not commit any text to a user-facing page.
- Does not constitute legal advice.
- Does not replace an Israeli IP attorney's review.
- Does not upload the certificate scan or any personal information.
- Does not file additional class registrations or take any action with the Israel Patent Office.

---

## 10. Decisions awaiting CEO

A. **Approve the drafted English text** in §3, subject to Israeli IP attorney sign-off.
B. **Approve the drafted Hebrew text** in §4, subject to Israeli IP attorney sign-off.
C. **Approve the footer attribution line** in §5.3 (or revise wording).
D. **Confirm the "Smart Protect" interpretation** — Option A (use existing LEGAL section), Option B (create new Smart Protect section as separate workstream), or Option C (clarify what you meant).
E. **Confirm scope.** This PR proposes only the trademark notice page. The strategic items in §6 (other class filings, sub-brand protection, international protection, domain protection, ® vs ™ usage, enforcement strategy) are NOT in this scope and are flagged for the IP lawyer as separate workstreams.

---

**End of proposal. No code, no infrastructure changed. The drafted text requires Israeli IP attorney review before publication. Awaiting CEO + lawyer sign-off on decisions A through E.**
