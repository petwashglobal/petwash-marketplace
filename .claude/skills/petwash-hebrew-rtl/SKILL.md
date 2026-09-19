---
name: petwash-hebrew-rtl
description: Use this skill BEFORE writing, translating, reviewing or rendering ANY Hebrew text or any right-to-left layout in PetWash — UI strings in client/src/lib/i18n.ts or client/public/locales/he, `isHebrew ? '…' : '…'` ternaries, email/SMS/push templates under server/, toasts, error messages, legal copy, SEO titles. Triggers on: Hebrew, עברית, RTL, rtl, dir="rtl", bidi, LRM, isolate, ⁦, maqaf, geresh, gershayim, ״, ׳, translation, i18n, locale, translation.json, "reads like Google Translate", wrong letters, reversed numbers, ₪, +972, register, gender, imperative, terminology, שמרטף, מוליך, רחיצה, ארנק. It fixes the three things the CEO flagged on 2026-09-19 ("Hebrew not ok in all places, Google-Translate Hebrew, some letters/RTL wrong"): machine-translated register, wrong words, and bidi/RTL layout defects. Pairs with petwash-ui-ux §5 (layout) and petwash-marketing-legal (claims).
---

# PetWash Hebrew & RTL

Hebrew is the primary market. A string that a native speaker reads as translated is a brand defect (platform skill §0.3: premium restraint, no cheap-startup energy). A number that renders backwards is a correctness defect. This skill is the house style for both.

**Audience:** any agent touching customer-visible Hebrew or an RTL surface.

## 1. Register — one voice

PetWash speaks to the customer in the **plural / gender-neutral second person** (Israeli product Hebrew: Wolt, Bit, Monday), never in the masculine singular imperative and never as a translated English sentence.

| Never | Write |
|---|---|
| `הזן`, `בחר`, `לחץ`, `נסה שוב` (masc. singular) | `הזינו`, `בחרו`, `לחצו`, `נסו שוב` — or the impersonal `יש להזין`, `יש לבחור` on validation lines |
| `אנא …`, `בבקשה …` (the tell-tale of "Please …") | drop it; `יש ל…` or the plural imperative carries the politeness |
| `נכשל להתחבר`, `נכשל לשלוח` (English "failed to X" syntax) | `ההתחברות נכשלה`, `השליחה נכשלה` — noun + verb |
| `משהו השתבש` as a generic error | say what happened and what to do: `לא הצלחנו לשמור. נסו שוב.` |
| `מעביר אותך…`, `יוצר חשבון…` (the app as a masculine "he") | `מעבירים אותך…`, `יוצרים את החשבון…` (we, plural) |
| `אופס!`, `וואו!`, `בהצלחה!` as toast titles | a plain statement: `נשמר`, `נשלח`, `ההזמנה אושרה` |
| slash forms everywhere (`נסה/י`, `מאשר/ת`) | slash forms only where a real person is addressed in the singular and gender is unknown (`מחובר/ת בתור`, `השמרטף/ית`); never on buttons |
| a button as a verb in the imperative (`שמור`, `בטל`) | a button as a noun / infinitive: `שמירה`, `ביטול`, `להזמנה`, `לתשלום`, `המשך` |

Copy that is fine in English and wrong in Hebrew because it was translated word for word: "learn more" (`למד עוד` → `מידע נוסף`), "please slow down" (`אנא האט` → `יותר מדי ניסיונות, נסו בעוד דקה`), "for details" (`לפרטי` → `עם פרטי`), "eligible washes" (`רחיצות זכאיות` → `רחיצות המשתתפות במבצע`), "the server is warming up" (never shown to a customer at all).

## 2. Terminology canon — one word per thing

| Thing | Canon | Never |
|---|---|---|
| a K9000 wash | `רחיצה` / `רחיצות` (`חבילות רחיצה`) | `שטיפה` (that is a car), `שטוף עכשיו` |
| pet sitter | `שמרטף` / `שמרטפית` / `שמרטף/ית` | `בייביסיטר` (a babysitter for children), `שומר`, `סיטר`, `פט סיטר` |
| dog walker | `מוליך/ה כלבים`, or the brand `⁦Walk My Pet™⁩` | `מטייל` (a hiker), `דוגווקר` |
| trainer | `מאלף/ת` | `מאמן` (sports), `מדריך` (a how-to) |
| daycare | `פנסיון יומי` | `מעון יום` (a nursery for toddlers) |
| a booking | `הזמנה`; `בקשת הזמנה` only before the provider accepts | `ביקור`, `בוקינג`, `הזמנת שירות` |
| the wallet / the balance / loyalty points | `ארנק` / `יתרה` / `נקודות` | `קרדיט`, `קרדיטים` |
| gift card | `תו שי דיגיטלי`; `eGift` only as the SKU / product name | `שובר מתנה`, `כרטיס מתנה` |
| the customer's home screen | `האזור האישי` (staff screens: `לוח הבקרה`) | `דשבורד`, `המערכת`, `פאנל` |
| terms | `תנאי השימוש` | `תנאים והגבלות`, `התנאים והתקנות` (installations!), `תקנון` |
| disclaimer | `הבהרה משפטית` | `כתב ויתור` (a legal waiver — misleading in a footer) |
| drop-off address | `כתובת יעד` | `כתובת הורדה` (download) |
| passkey | `מפתח גישה` | bare `Passkey` in a Hebrew sentence |
| concierge | `קונסיירז׳` (U+05F3) | `קונסיירז`, `קונסיירז'` |
| premium | `פרימיום` | `פרמיום` |
| minutes / number / Ltd. / VAT | `דק׳` `מס׳` `בע״מ` `מע״מ` (U+05F3 geresh, U+05F4 gershayim) | ASCII `'` and `"` |

When you meet a word not in this table, search the codebase for its existing Hebrew before inventing one; if two exist, add the winner here.

## 3. Bidi — what actually renders wrong, and the fix

The bidi algorithm handles more than people think. **Digits with separators stay left-to-right on their own**: `24-48`, `22:00-06:00`, `₪30-80`, `10%`, `2026-09-22` all render correctly inside Hebrew. Do not wrap them.

What does break, and the house fix:

| Case | Why it breaks | Fix |
|---|---|---|
| a Hebrew prefix letter glued to a Latin value: `ל${petName}`, `ב${city}` | the prefix jumps to the other side of the name | `ל-⁦${petName}⁩` — maqaf **and** isolate |
| `+972…` inside Hebrew | the `+` is not part of the digit run; the paragraph places it | wrap the example: `⁦+972-50-123-4567⁩` (or `‎` before the `+`) |
| `#${ref}`, `#12345` next to Hebrew | `#` before letters is a neutral | `⁦#${ref}⁩` |
| a token that mixes digits and Latin: `256-bit`, `10MB`, `{seconds}s`, `{{x}}x` | the hyphen/letters split the run | translate it (`256 סיביות`, `10 מגה-בייט`, `{seconds} שניות`) or isolate it |
| `PetWash™`, `K9000` and every Latin brand inside Hebrew | the `™` and trailing punctuation flip | `⁦PetWash™⁩` — the isolate form, guarded by `scripts/guards/trademark_bidi_anchored.py`; in `client/src/lib/i18n.ts` `t()` adds the LRM at runtime, so write the plain isolate there too |
| phone / email / code **inputs** | typed digits reorder while typing | `dir="ltr"` on the `<input>` (keep `inputMode`/`autoComplete`); `PhoneInput` already does it |
| a phone number, email, IBAN, code, price **displayed** inside Hebrew prose | mixed runs shuffle | `<bdi>…</bdi>` in JSX, `dir="ltr"` on the block in email HTML (see `payment-confirmation-2026.ts`) |
| a sentence ending in a Latin word + `?`/`!`/`.` | **this one is fine** — the mark takes the paragraph direction and lands at the left end, where a Hebrew sentence ends | nothing |

Guard: `scripts/guards/hebrew_bidi_glue.py` (prefix-glue and bare `+972`; baseline in `hebrew_bidi_glue_baseline.txt`, shrink it, never grow it).

## 4. Layout — RTL is a layout property, not a translation

- `dir` is set once, on `<html>`, by `applyDirToDOM()` in `client/src/lib/languageStore.tsx`. **Never** hard-code `dir="rtl"` on a component; write `dir={isRTL(language) ? 'rtl' : 'ltr'}` only when a subtree must differ (a chat input, a code block), and never hard-code Hebrew labels next to it (`google-places-autocomplete.tsx`, `AiChatWidget.tsx` do — fix, don't copy).
- Tailwind 3.4 has logical utilities. Use `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`text-start`/`text-end`; never `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`/`text-left`/`text-right` on a customer surface. An icon pinned with `absolute left-3` plus `pl-10` on the input floats over empty space in Hebrew (fixed in `BookingSearch.tsx` on 2026-09-19: `start-3` + `ps-10`).
- Directional icons (`ChevronRight`, `ArrowRight`, `→`) flip: add `rtl:rotate-180`; decorative icons do not. Never put a literal `→` inside a Hebrew string.
- CSS: `padding-inline-start`, `text-align: start`, `inset-inline-end`; `[dir="rtl"]` overrides only for things logical properties cannot express.
- Numbers, dates, prices: `Intl.NumberFormat('he-IL')`, `Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem' })`; never `toLocaleDateString()` without a locale; never an ISO timestamp in copy.
- Emails: `<html lang="he" dir="rtl">`, `text-align` via the `align`/`dir` variables the 2026 templates already compute; every Latin value in a `dir="ltr"` span.

## 5. Where the Hebrew lives (and which one you are editing)

| Channel | File | Notes |
|---|---|---|
| main dictionary | `client/src/lib/i18n.ts` (`t(key, language)`) | 2,408 keys, he complete; `t()` appends LRM after `™` at runtime |
| react-i18next | `client/public/locales/he/translation.json` (`useTranslation`) | 294 keys, fully Hebrew since 2026-09-19 (was 88 % English); keep key set identical to `en/translation.json` |
| inline ternaries | `isHebrew ? '…' : '…'` in ~630 files | the undisciplined channel; prefer a key; if you must inline, follow §1–§3 |
| server templates | `server/email/templates/*-2026.ts`, `server/services/*Templates.ts`, `server/routes/*` SMS/push strings | trademark guard now covers `server/` |
| validation | `client/src/lib/validation/messages.ts` | impersonal `יש להזין…` |

## 6. Review checklist (paste into the PR)

- [ ] Register: plural/neutral or impersonal; no `אנא`; no "failed to X" syntax; buttons are nouns
- [ ] Every term in §2 is the canon word
- [ ] No prefix letter glued to `${…}`; `+972`, `#ref`, mixed digit-Latin tokens isolated or translated
- [ ] Latin brand names wrapped `⁦…⁩`; `™` never bare (guard)
- [ ] No `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right` on a customer surface; directional icons `rtl:rotate-180`
- [ ] `dir` not hard-coded on components; `dir="ltr"` on phone/email/code inputs
- [ ] Geresh/gershayim are U+05F3 / U+05F4
- [ ] Arabic strings contain no Hebrew letters (three did until 2026-09-19)
- [ ] Rendered once with `<html dir="rtl">` at 390 px wide

## 7. Backlog left by the 2026-09-19 audit (do these, in this order)

1. Physical Tailwind utilities on customer pages — worst first: `pages/MyAccount.tsx` (43), `pages/booking/MultiPetBookingWizard.tsx` (32, also hard-codes `text-right` which breaks the wizard for English visitors), `pages/MobileStationSheet.tsx` (28), `pages/MarketplaceBookingFlow.tsx`, `pages/BookingChat.tsx`, `pages/Settings.tsx`, `pages/Academy.tsx`, `components/marketplace/LuxuryHeroSearch.tsx`, `components/location/CityPicker.tsx`, the legal pages.
2. Hard-coded `dir="rtl"` + Hebrew-only labels in `components/ui/google-places-autocomplete.tsx` and `components/AiChatWidget.tsx` (a non-Hebrew customer gets a Hebrew, forced-RTL form).
3. `→` inside Hebrew strings in `components/NotificationCenterPanel.tsx` (20) and the unflipped chevrons listed in the audit (296 lines).
4. Six email templates with no `dir` at all: `confirm-end-of-stay-2026.ts`, `provider-workflow-emails.ts`, `partner-invitation-2025.ts`, `backend-team-invitation-2025.ts`, `workflow-notification-2025.ts`.
5. The `ל${…}` glue in `service-completed-review-2026.ts`, `confirm-end-of-stay-2026.ts`, `wash-reminder.ts`, `care-notes-reminder.ts`, `StationPage.tsx`, `ServiceLandingPage.tsx` (guard baseline lists every file).
6. The remaining masculine-singular imperatives (~470) and `משהו השתבש` variants — sweep per surface, starting with signup/login/OTP and the booking flows.
7. Collapse the three writers of `document.documentElement.dir` (`App.tsx`, `Layout.tsx`, `PetWashHeader.tsx`) into `applyDirToDOM()`.

**Last updated:** 2026-09-19 (created from the audit; first fixes in the same PR: 41 dictionary strings, the Hebrew locale file, validation messages, BookingSearch icons, MarketplaceBookingFlow chevrons, email/phone inputs, three Arabic strings with Hebrew letters, two guards).
