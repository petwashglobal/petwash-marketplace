# Draft email to SUMIT support — marketplace split clearing

**Status: DRAFT FOR THE CEO TO READ AND SEND. Not sent by anyone else.**
**Revised 2026-09-19** after reading the OpenAPI spec — two questions were
already answered there and are now sharpened into confirmations instead.
See sumit-upay-marketplace-integration-2026-09-19.md.
To: support@sumit.co.il
Subject suggestion: פט וואש בע"מ (ח.פ. 517145033) — סליקת Marketplace לספקים עצמאיים

Why these seven questions and no others: each one either blocks the build or
changes the design. Anything we can answer by reading the code or the help
centre has been left out deliberately — a long email gets a short answer.

---

## The email (Hebrew — send as-is)

שלום,

אנחנו פט וואש בע"מ (ח.פ. 517145033), לקוחות קיימים של סאמיט, וכבר מפיקים
חשבוניות וסולקים אשראי דרך המערכת.

אנחנו מפעילים פלטפורמת מרקטפלייס לשירותי חיות מחמד: הלקוח מזמין דרכנו,
נותן השירות (מטפל/דוגווקר/מאלף) הוא עוסק עצמאי שמספק את השירות, ואנחנו
גובים עמלת פלטפורמה בלבד. המודל הוא כמו Rover / Wolt — נותן השירות הוא
המוכר של השירות ללקוח, ואנחנו רק מתווכים וגובים עמלה.

קראנו את המדריך שלכם "סליקה ל-Marketplace" ואנחנו רוצים לעבור למבנה הזה.
לפני שנתחיל בפיתוח, יש לנו כמה שאלות מהותיות:

**1. התאמה רגולטורית/חוזית.**
במבנה הנוכחי שלנו, כל התשלום (כולל חלקו של נותן השירות) נסלק דרך מסוף
הסליקה שלנו ונכנס לחשבון שלנו. הבנו שזה עלול לא להתאים לתנאי השימוש של
מאגד הסליקה, מכיוון שאנחנו למעשה סולקים עסקאות עבור עסקים אחרים.
האם מבנה ה-Marketplace שלכם — שבו לכל ספק יש עסק משלו ומסוף סליקה משלו
מול UPAY — פותר את זה, כך שכל ספק הוא בעל מסוף בזכות עצמו ואנחנו לא
סולקים עבורו? זו השאלה החשובה ביותר עבורנו.

**2. סתירה בין המדריך למפרט ה-API.**
במדריך "סליקה ל-Marketplace" כתוב: "ניתן לבצע רק תפיסת מסגרת אשראי (J5)".
במפרט ה-API (swagger) כתוב תחת AutoCapture: "Leave empty for True (Auto
capture)" — כלומר J4 הוא ברירת המחדל.
נבקש אישור שהמפרט הוא הנכון ושניתן לבצע חיוב מלא (J4) ב-multivendorcharge.
אם המדריך נכון — נשמח שיעודכן.

**3. הצטרפות הספקים ל-UPAY.**
לפי /billing/generalbilling/openupayterminal/ נדרשים פרטי בנק של הספק.
- מה בדיוק נדרש מהספק (מסמכים, אישור עוסק, זמן טיפול)?
- באילו מקרים UPAY עשויה לסרב?
- האם יש מסלול הצטרפות מרוכז למרקטפלייס, או שכל ספק עובר תהליך נפרד?

**4. עמלות סליקה.**
- מהי עמלת הסליקה שחלה עלינו כיום (החוזה שלנו), כולל עמלה קבועה לעסקה
  אם קיימת? (במפרט ה-API ראינו שברירת המחדל למסוף חדש היא תוכנית
  OFFICEGUYNEW10 — 1.5%. נבקש לדעת מה חל עלינו בפועל.)
- מהן ארבע התוכניות (OFFICEGUYNEW10 / UPAYTRANSACTION /
  OFFICEGUYNEWMONTHLY10 / OFFICEGUYMONTHLYNEW10) ובמה הן נבדלות?
- היכן ניתן לראות את העמלה בפועל לכל עסקה? בדוחות מודול סליקת האשראי לא
  מצאנו עמודת עמלה, ורואי החשבון שלנו צריכים את העלות המדויקת.

**5. עלות הקמת עסק לכל ספק.**
הבנו שעסק שנפתח דרך ה-API מחויב מיידית במסלול התחלה, ללא חודש התנסות,
מאמצעי התשלום של העסק שיצר אותו.
- האם יש מסלול/הסדר למרקטפלייס עם מספר גדול של ספקים?
- האם ניתן לחייב אותנו מרוכזת, או להעביר את החיוב לספק עצמו?
- מה קורה לעסק של ספק שאינו פעיל — האם ניתן להשהות ללא סגירה?

**6. זיכויים וביטולים בפיצול.**
כאשר עסקה פוצלה בין שני עסקים ויש ביטול או זיכוי חלקי — כיצד מתבצע
הזיכוי? האם הוא מתחלק אוטומטית בין שני העסקים באותו יחס, ומי מפיק את
חשבונית הזיכוי?

**7. מספר הקצאה.**
האם המערכת מטפלת אוטומטית בקבלת מספר הקצאה מרשות המסים עבור מסמכים
שחייבים בכך — הן עבור המסמכים שלנו והן עבור המסמכים שמופקים בשם הספק
דרך multivendorcharge?

נשמח לשיחה קצרה אם נוח לכם — אנחנו מוכנים להתחיל בפיתוח ברגע שהנקודות
האלה יהיו ברורות.

תודה רבה,
ניר חדד
פט וואש בע"מ
support@petwash.co.il

---

## What it says (English gloss for the CEO)

1. **The blocker.** Today the whole payment, provider's share included, clears
   through our terminal into our account — which may breach the aggregator's
   terms because we are effectively clearing for other businesses. Does their
   Marketplace structure fix that by making each provider a terminal holder in
   their own right?
2. **J5.** Their doc says the split charge can only do an authorization hold.
   If so, how is the money actually captured, and through which endpoint? This
   decides our whole booking flow.
3. **Provider onboarding to Upay.** What the provider must supply, when Upay
   refuses, and whether there is a bulk route.
4. **Fees.** Our actual contract rate including any per-transaction fixed fee;
   the rate on provider terminals; and where the fee is visible per transaction
   — their clearing reports have no fee column and the accountants need the
   exact cost.
5. **Cost per provider.** Confirm the immediate ₪19+VAT/month billing to our
   card, ask for a marketplace arrangement, ask whether a dormant provider's
   business can be suspended rather than closed.
6. **Refunds in a split.** Who issues the credit note and how a partial refund
   divides between the two businesses.
7. **Allocation numbers.** Whether SUMIT obtains the ITA allocation number
   automatically, for our documents and for the provider's.

## Left out on purpose

- Anything the help centre already answers (the general marketplace flow, the
  API paths, the ₪19 plan price — all read and recorded).
- Our own legal position with Nayax. That is a separate conversation with
  Nayax, not with SUMIT.
