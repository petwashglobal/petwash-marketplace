# SUMIT SUPPORT EMAIL — INTEGRATION CLARIFICATIONS

**Status:** READY TO SEND. CEO holds the send action.
**Built from:** `PROVIDER_FINANCE_SUMIT_INTEGRATION_AUDIT_V2.md` §12 (18 open questions, 1:1 traceable via the `#Q` tags).
**Suggested recipient:** `support@sumit.co.il` (and the developer contact at `https://app.sumit.co.il/developers/keys/` if a separate dev address is shown).
**Suggested subject (EN):** PetWash — API integration questions (marketplace clearing + per-vendor invoicing)
**Suggested subject (HE):** PetWash — שאלות אינטגרציה ל-API (סליקת מרקטפלייס + הפקת מסמכים לכל ספק)

> Send ONE language. Hebrew is recommended as the primary version for SUMIT support; the English version below is provided as a fallback / for the developer team. The `#Q` tags are for our internal traceability — they may be left in or removed before sending.

---

## ENGLISH VERSION

Hello SUMIT team,

We are PetWash (PetWash Ltd), building a marketplace on top of the SUMIT API. The model: PetWash is the marketplace master account, and each approved service provider becomes a SUMIT sub-business created via `/website/companies/create/`. Customer payments are cleared through `/billing/payments/multivendorcharge/` so that each provider receives a document issued on their own books, and PetWash issues separate commission documents on its own books.

We have built our integration design against the official Swagger client and the maintained WordPress/Woo plugin, and most endpoint shapes are confirmed. Before we go live we need to close the following points, which we could not determine reliably from public sources. Numbered tags (`#Q…`) are internal references.

### A. Response envelope & error handling
1. **(#Q1)** The response envelope `Status` field appears as both an integer `0` and the string `"Success"` across your documentation/plugin code. Which is the canonical value, and is that contract stable across all endpoints?
2. **(#Q17)** Is `Content-Language: en` fully supported for English error messages on every endpoint, or are some `UserErrorMessage` / `TechnicalErrorDetails` strings Hebrew-only?

### B. Documents
3. **(#Q2)** Please provide the exact enumeration of `DocumentType` values for `/accounting/documents/create/` (both numeric and string forms), each mapped to its accounting category: Invoice / Receipt / Tax Invoice Receipt (חשבונית מס קבלה) / Proforma / Credit Note / Order / Price Quotation / Payment Request / Donation Receipt.
4. **(#Q18)** For a document issued by `/billing/payments/multivendorcharge/`, does `/accounting/documents/cancel/` also reverse the clearing (refund the card), or are document cancellation and payment refund separate operations? If separate, what is the correct refund endpoint/flow?
5. **(#Q15a)** Please share the full request/response schemas for the document endpoints not in the public Swagger: `/accounting/documents/list/`, `/getdebt/`, `/getdebtreport/`, `/movetobooks/`, plus `/accounting/general/getnextdocumentnumber/`.

### C. Customers
6. **(#Q3)** Full enumeration of `AccountingTypedCustomer.SearchMode` (we use `"Automatic"` for find-or-create by `ExternalIdentifier` and `"None"` for strict create — are there other valid values?).
7. **(#Q15b)** Request/response schemas for `/accounting/customers/update/`, `/getdetailsurl/`, `/createremark/`, and `/accounting/incomeitems/list/`.

### D. Marketplace / multivendor clearing
8. **(#Q4a)** In `/billing/payments/multivendorcharge/`, must every `Items[]` row carry its own `CompanyID` + `APIKey` even when all items belong to a single vendor?
9. **(#Q4b)** Partial-failure semantics: in one multivendor call, can vendor A succeed while vendor B fails? What does the response look like in that case, and is anything rolled back?
10. **(#Q4c)** Which field sets the document type **per vendor** within a multivendor charge?
11. **(#Q5a)** For `/website/companies/create/`, which `Company` fields are strictly required? (The Swagger marks nearly all optional; the help center implies name, business number, business type, email, phone.)
12. **(#Q5b)** Which field/value at company creation selects clearing-enabled vs document-only mode?
13. **(#Q6)** Is the clearing-activation step for a newly created sub-business automatable via API, or does it always require emailing `support@sumit.co.il`? If manual, what is the typical turnaround?
14. **(#Q7)** Can a provider's pre-existing, independently created SUMIT account be linked to our marketplace, or must every sub-business be created through the marketplace API?

### E. Webhooks / triggers
15. **(#Q8)** For `/triggers/triggers/subscribe/`: (a) full enumeration of valid `TriggerType` values, and (b) the exact JSON body SUMIT POSTs to the subscriber URL for each type.
16. **(#Q9)** For incoming webhooks: (a) which HTTP header carries the signature, (b) the algorithm (HMAC-SHA256?), (c) the exact signed content (raw body, or body + timestamp?), and (d) where we obtain the signing secret.

### F. Reliability — idempotency, rate limits, quota
17. **(#Q11)** For transactional calls (`/billing/payments/charge/`, `/multivendorcharge/`): is there an `Idempotency-Key` header or equivalent? If not, what retry-safety pattern do you recommend so a network retry never double-charges?
18. **(#Q13)** Published rate limits per `CompanyID` and/or per IP? What HTTP status and response body do you return on rate-limit?
19. **(#Q14)** Action-quota mechanics: what counts as one "action" against the included monthly quota (charges? document creates? customer creates? webhook deliveries? SMS sends?), and are sub-businesses' actions counted against the marketplace master quota or each sub-business's own?

### G. Security & verification
20. **(#Q12)** `Role` enum values for `/website/users/create/` and `/website/permissions/set/` — which role grants API access vs UI-only?
21. **(#Q16)** The `/billing/payments/beginredirect/` success redirect carries `OG-CustomerID`, `OG-PaymentID`, `OG-ExternalIdentifier`. Is there an additional signed/HMAC query parameter so we can verify the redirect genuinely came from SUMIT and was not forged?

### H. Testing
22. **(#Q10)** Do you offer a sandbox / test environment — host, test credentials, and test card numbers? Is `dev.api.sumit.co.il` (referenced in plugin source) publicly usable for testing?

Thank you very much — clear answers to the above will let us complete a robust, retry-safe integration. Happy to jump on a short call with your developer team if that is easier.

Best regards,
Nir — PetWash

---

## HEBREW VERSION / גרסה בעברית

שלום צוות SUMIT,

אנחנו PetWash (פטוואש בע"מ), ובונים מרקטפלייס מעל ה-API שלכם. המודל: PetWash הוא חשבון ה-master של המרקטפלייס, וכל ספק שירות מאושר הופך לעסק-בן (sub-business) ב-SUMIT שנוצר דרך `/website/companies/create/`. תשלומי הלקוחות נסלקים דרך `/billing/payments/multivendorcharge/` כך שכל ספק מקבל מסמך שמופק על הספרים שלו עצמו, ו-PetWash מפיקה מסמכי עמלה נפרדים על הספרים שלה.

בנינו את תכנון האינטגרציה מול ה-Swagger הרשמי ומול תוסף ה-WordPress/Woo המתוחזק, ורוב מבני ה-endpoints מאומתים. לפני עלייה לאוויר נשמח לסגור את הנקודות הבאות, שלא הצלחנו לקבוע באופן מהימן ממקורות ציבוריים. התגיות הממוספרות (`#Q…`) הן הפניות פנימיות שלנו.

### א. מעטפת תשובה וטיפול בשגיאות
1. **(#Q1)** שדה ה-`Status` במעטפת התשובה מופיע גם כמספר שלם `0` וגם כמחרוזת `"Success"` בתיעוד/בקוד התוסף. מהו הערך הקנוני, והאם החוזה הזה יציב בכל ה-endpoints?
2. **(#Q17)** האם `Content-Language: en` נתמך באופן מלא להודעות שגיאה באנגלית בכל endpoint, או שחלק מהמחרוזות (`UserErrorMessage` / `TechnicalErrorDetails`) הן בעברית בלבד?

### ב. מסמכים
3. **(#Q2)** נא לספק את הרשימה המדויקת של ערכי `DocumentType` עבור `/accounting/documents/create/` (גם מספריים וגם מחרוזות), כשכל ערך ממופה לקטגוריה החשבונאית שלו: חשבונית / קבלה / חשבונית מס קבלה / פרופורמה / חשבונית זיכוי / הזמנה / הצעת מחיר / דרישת תשלום / קבלה על תרומה.
4. **(#Q18)** עבור מסמך שהופק דרך `/billing/payments/multivendorcharge/`, האם `/accounting/documents/cancel/` גם מבטל את הסליקה (זיכוי האשראי), או שביטול מסמך והחזר תשלום הם פעולות נפרדות? אם נפרדות — מהו ה-endpoint/התהליך הנכון להחזר?
5. **(#Q15a)** נא לשתף את מבני הבקשה/תשובה המלאים ל-endpoints של מסמכים שאינם ב-Swagger הציבורי: `/accounting/documents/list/`, `/getdebt/`, `/getdebtreport/`, `/movetobooks/`, וכן `/accounting/general/getnextdocumentnumber/`.

### ג. לקוחות
6. **(#Q3)** רשימה מלאה של ערכי `AccountingTypedCustomer.SearchMode` (אנו משתמשים ב-`"Automatic"` ל-find-or-create לפי `ExternalIdentifier` וב-`"None"` ליצירה מחמירה — האם יש ערכים נוספים?).
7. **(#Q15b)** מבני בקשה/תשובה ל-`/accounting/customers/update/`, `/getdetailsurl/`, `/createremark/`, ו-`/accounting/incomeitems/list/`.

### ד. מרקטפלייס / סליקה רב-ספקית
8. **(#Q4a)** ב-`/billing/payments/multivendorcharge/`, האם כל שורת `Items[]` חייבת לשאת `CompanyID` + `APIKey` משלה גם כאשר כל הפריטים שייכים לספק יחיד?
9. **(#Q4b)** סמנטיקת כשל חלקי: בקריאה רב-ספקית אחת, האם ספק א' יכול להצליח בעוד ספק ב' נכשל? איך נראית התשובה במקרה כזה, והאם משהו מבוטל (rollback)?
10. **(#Q4c)** איזה שדה קובע את סוג המסמך **לכל ספק** בתוך חיוב רב-ספקי?
11. **(#Q5a)** עבור `/website/companies/create/`, אילו שדות ב-`Company` הם חובה ממש? (ה-Swagger מסמן כמעט הכול כאופציונלי; מרכז העזרה מרמז על שם, מספר עוסק/ח"פ, סוג עסק, אימייל, טלפון.)
12. **(#Q5b)** איזה שדה/ערך בעת יצירת החברה בוחר בין מצב סליקה-מאופשרת לבין מצב מסמכים-בלבד?
13. **(#Q6)** האם שלב הפעלת הסליקה לעסק-בן חדש ניתן לאוטומציה דרך ה-API, או שהוא תמיד מצריך שליחת מייל ל-`support@sumit.co.il`? אם ידני — מהו זמן הטיפול הטיפוסי?
14. **(#Q7)** האם ניתן לקשר חשבון SUMIT קיים ועצמאי של ספק למרקטפלייס שלנו, או שכל עסק-בן חייב להיווצר דרך ה-API של המרקטפלייס?

### ה. Webhooks / טריגרים
15. **(#Q8)** עבור `/triggers/triggers/subscribe/`: (א) רשימה מלאה של ערכי `TriggerType` תקפים, ו-(ב) מבנה ה-JSON המדויק ש-SUMIT שולחת (POST) ל-URL של המנוי עבור כל סוג.
16. **(#Q9)** עבור webhooks נכנסים: (א) איזו כותרת HTTP נושאת את החתימה, (ב) האלגוריתם (HMAC-SHA256?), (ג) התוכן החתום המדויק (גוף הבקשה הגולמי, או גוף + חותמת זמן?), ו-(ד) מהיכן משיגים את סוד החתימה.

### ו. אמינות — אידמפוטנטיות, הגבלות קצב, מכסה
17. **(#Q11)** עבור קריאות טרנזקציוניות (`/billing/payments/charge/`, `/multivendorcharge/`): האם קיימת כותרת `Idempotency-Key` או מקבילה? אם לא — איזו תבנית בטוחה-לניסיון-חוזר (retry-safety) אתם ממליצים כדי שניסיון חוזר ברשת לא יחייב פעמיים?
18. **(#Q13)** האם יש הגבלות קצב מפורסמות לכל `CompanyID` ו/או לכל IP? איזה סטטוס HTTP וגוף תשובה אתם מחזירים בעת חריגה?
19. **(#Q14)** מנגנון מכסת הפעולות: מה נחשב ל"פעולה" אחת מול המכסה החודשית הכלולה (חיובים? יצירת מסמכים? יצירת לקוחות? משלוחי webhook? משלוחי SMS?), והאם פעולות של עסקים-בנים נספרות מול מכסת ה-master של המרקטפלייס או שלכל עסק-בן מכסה משלו?

### ז. אבטחה ואימות
20. **(#Q12)** ערכי ה-enum של `Role` עבור `/website/users/create/` ו-`/website/permissions/set/` — איזה role מעניק גישת API לעומת ממשק-בלבד?
21. **(#Q16)** ה-redirect של הצלחה ב-`/billing/payments/beginredirect/` נושא `OG-CustomerID`, `OG-PaymentID`, `OG-ExternalIdentifier`. האם קיים פרמטר חתום/HMAC נוסף כדי שנוכל לאמת שה-redirect אכן הגיע מ-SUMIT ולא זויף?

### ח. בדיקות
22. **(#Q10)** האם קיימת סביבת sandbox / בדיקות — host, פרטי התחברות לבדיקה, ומספרי כרטיסי אשראי לבדיקה? האם `dev.api.sumit.co.il` (המופיע בקוד התוסף) שמיש לבדיקות באופן ציבורי?

תודה רבה — תשובות ברורות לנקודות הללו יאפשרו לנו להשלים אינטגרציה יציבה ובטוחה-לניסיון-חוזר. נשמח גם לשיחה קצרה עם צוות הפיתוח שלכם אם זה נוח יותר.

בברכה,
ניר — PetWash

---

## TRACEABILITY MAP (internal — not for sending)

Every question above maps back to `PROVIDER_FINANCE_SUMIT_INTEGRATION_AUDIT_V2.md` §12. The audit lists 18 `#Q` items; this email expands the multi-part ones (#Q4, #Q5, #Q8, #Q9, #Q15) into lettered sub-points and groups all of them into eight themes (A–H) for readability. No question from §12 was dropped:

| Email # | Audit tag | Theme |
|---|---|---|
| 1 | #Q1 | A. Envelope |
| 2 | #Q17 | A. Envelope |
| 3 | #Q2 | B. Documents |
| 4 | #Q18 | B. Documents |
| 5 | #Q15 (docs subset) | B. Documents |
| 6 | #Q3 | C. Customers |
| 7 | #Q15 (customers subset) | C. Customers |
| 8–10 | #Q4 (a/b/c) | D. Marketplace |
| 11–12 | #Q5 (a/b) | D. Marketplace |
| 13 | #Q6 | D. Marketplace |
| 14 | #Q7 | D. Marketplace |
| 15 | #Q8 | E. Webhooks |
| 16 | #Q9 | E. Webhooks |
| 17 | #Q11 | F. Reliability |
| 18 | #Q13 | F. Reliability |
| 19 | #Q14 | F. Reliability |
| 20 | #Q12 | G. Security |
| 21 | #Q16 | G. Security |
| 22 | #Q10 | H. Testing |

All 18 audit `#Q` tags are represented (#Q15 is split across rows 5 and 7).
</content>
</invoke>
