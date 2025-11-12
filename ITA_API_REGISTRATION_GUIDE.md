# 🇮🇱 מדריך הרשמה ל-API של רשות המסים בישראל
# Israeli Tax Authority (ITA) API Registration Guide

---

## 📋 סקירה כללית | Overview

מדריך זה מסביר כיצד לקבל את האישורים הנדרשים (CLIENT_ID ו-CLIENT_SECRET) לחיבור ישיר ל-API של רשות המסים בישראל, כולל מערכת החשבוניות האלקטרוניות והגשת דוחות אוטומטית.

This guide explains how to obtain the required credentials (CLIENT_ID and CLIENT_SECRET) for direct integration with the Israeli Tax Authority API, including the electronic invoicing system and automated report submission.

---

## 🎯 מה צריך להשיג | What You Need to Obtain

1. **CLIENT_ID** - מזהה לקוח ייחודי מרשות המסים
2. **CLIENT_SECRET** - מפתח סודי לאימות
3. **SCOPE** - הרשאות גישה (למשל: `invoice`, `vat`, `reports`)

---

## 📝 תהליך ההרשמה | Registration Process

### שלב 1: הכנה מקדימה | Pre-Registration

**דרישות:**
- ✅ **מספר עוסק מורשה (ע״מ)** - חובה
- ✅ **חשבון פעיל ב"שירותי רשות המסים"** - https://www.misim.gov.il
- ✅ **תעודת התאגדות** (לחברות)
- ✅ **פרטי חשבון בנק עסקי**
- ✅ **כתובת דוא״ל עסקית פעילה**

**Requirements:**
- Valid Tax ID (Osek Murshe / Company Number)
- Active account at Israel Tax Authority online services
- Certificate of Incorporation (for companies)
- Business bank account details
- Active business email address

---

### שלב 2: הרשמה למערכת ה-API | API System Registration

#### אופציה א': דרך אתר רשות המסים (המומלץ)

**צעדים:**

1. **היכנס לאזור האישי:**
   - גש ל: https://www.misim.gov.il
   - התחבר עם שם משתמש וסיסמה
   - או באמצעות אימות ביומטרי (אם זמין)

2. **נווט למערכת ה-API:**
   - בתפריט הראשי: **"שירותים דיגיטליים"**
   - בחר: **"API למפתחים"** או **"חיבור מערכות חיצוניות"**
   - לחץ על: **"בקשה לאישורי גישה חדשים"**

3. **מלא את הטופס:**
   ```
   שם המערכת: Pet Wash™ - Premium Pet Care Platform
   תיאור: מערכת ניהול עסקי מקיפה עם ספרי חשבונות אוטומטיים
   סוג השירות: B2B + B2C
   היקף עסקאות: מעל ₪25,000 בחודש
   
   הרשאות מבוקשות (Scopes):
   ☑️ invoice - חשבוניות אלקטרוניות
   ☑️ vat - דיווחי מע״מ
   ☑️ income_tax - מס הכנסה
   ☑️ reports - דוחות כלליים
   ```

4. **העלה מסמכים נדרשים:**
   - תעודת עוסק מורשה (PDF)
   - אישור ניהול ספרים (מרו״ח)
   - הסכם סודיות (ניתן להוריד מהאתר)
   - פרטי איש קשר טכני

5. **אישור זהות:**
   - ייתכן שתתבקש לאמת זהות באמצעות:
     - SMS לנייד רשום
     - שיחת וידאו עם נציג הרשות
     - ביקור פיזי במשרדי רשות המסים

6. **המתן לאישור:**
   - זמן טיפול: **5-14 ימי עסקים**
   - תקבל הודעה למייל כשהבקשה תאושר

---

#### אופציה ב': דרך מוקד הטלפוני של רשות המסים

**מספר טלפון:** *4954 או 02-5656400

**שעות פעילות:**
- ראשון-חמישי: 08:00-16:00
- יום שישי: סגור

**מה להכין לפני השיחה:**
- מספר עוסק מורשה
- תעודת זהות
- כתובת דוא״ל עסקית
- תיאור המערכת והשימוש המתוכנן

**בקש:**
"אני צריך לקבל CLIENT_ID ו-CLIENT_SECRET לחיבור למערכת ה-API של רשות המסים, כולל חשבוניות אלקטרוניות."

---

#### אופציה ג': דרך רואה חשבון (CPA)

רבים מרואי החשבון בישראל מורשים לסייע בתהליך זה:

1. פנה לרואה החשבון שלך
2. בקש ממנו לפתוח בקשה ל-API access בשמך
3. הוא יטפל בכל המסמכים והאישורים

**יתרון:** תהליך מהיר יותר, פחות טרחה
**חיסרון:** ייתכן תשלום נוסף (₪500-2,000)

---

### שלב 3: קבלת האישורים | Receiving Credentials

**לאחר אישור הבקשה, תקבל:**

```json
{
  "client_id": "PETWASH_ITA_CLIENT_abc123xyz",
  "client_secret": "SECRET_KEY_VERY_LONG_STRING_456def789ghi",
  "scope": "invoice vat income_tax reports",
  "token_url": "https://openapi.taxes.gov.il/shaam/longtimetoken/oauth2/token",
  "api_base_url": "https://api.taxes.gov.il/shaam/production/"
}
```

**⚠️ אבטחה קריטית:**
- **לעולם אל תחשוף את CLIENT_SECRET**
- שמור במנהל סודות מאובטח (Replit Secrets, AWS Secrets Manager, וכו')
- אל תעלה ל-Git או לקוד פומבי

---

## 🔐 הגדרת הסודות במערכת | Setting Up Secrets

### ב-Replit (המערכת הנוכחית):

1. פתח את לוח הסודות (Secrets)
2. הוסף את הערכים הבאים:

```env
ITA_CLIENT_ID=YOUR_CLIENT_ID_FROM_ITA
ITA_CLIENT_SECRET=YOUR_CLIENT_SECRET_FROM_ITA
ITA_SCOPE=invoice vat income_tax reports
ITA_TOKEN_URL=https://openapi.taxes.gov.il/shaam/longtimetoken/oauth2/token
ITA_API_BASE_URL=https://api.taxes.gov.il/shaam/production/
```

### בסביבת production אחרת:

```bash
# AWS Secrets Manager
aws secretsmanager create-secret \
  --name petwash/ita/credentials \
  --secret-string '{"client_id":"...","client_secret":"..."}'

# Google Cloud Secret Manager
echo -n "YOUR_CLIENT_SECRET" | gcloud secrets create ita-client-secret --data-file=-
```

---

## 📚 משאבים נוספים | Additional Resources

### קישורים רשמיים:

1. **פורטל מפתחים של רשות המסים:**
   - https://www.gov.il/he/departments/israel_tax_authority/govil-landing-page
   
2. **תיעוד טכני API:**
   - https://openapi.taxes.gov.il/developer-docs
   
3. **מערכת חשבוניות אלקטרוניות:**
   - https://www.gov.il/he/service/electronic_invoicing_system

4. **חוק המס הרלוונטי:**
   - חוק מע״מ, תשל״ו-1975
   - פקודת מס הכנסה (נוסח חדש), תשכ״א-1961

### תמיכה טכנית:

- **אימייל:** api-support@taxes.gov.il
- **טלפון:** 02-5656400 (שלוחה 3 - תמיכה טכנית)
- **שעות תמיכה:** ראשון-חמישי 08:00-16:00

---

## 🧪 בדיקת החיבור | Testing the Connection

### סביבת Sandbox (אם זמינה):

לפני שימוש בסביבת production, רשות המסים מספקת לעיתים sandbox:

```python
# Sandbox URLs (אם זמין)
SANDBOX_TOKEN_URL = "https://sandbox.openapi.taxes.gov.il/oauth2/token"
SANDBOX_API_URL = "https://sandbox.api.taxes.gov.il/shaam/test/"
```

### בדיקה ראשונית:

```bash
# Test OAuth2 token
curl -X POST https://openapi.taxes.gov.il/shaam/longtimetoken/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n 'CLIENT_ID:CLIENT_SECRET' | base64)" \
  -d "grant_type=client_credentials&scope=invoice"
```

**תגובה מוצלחת:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "invoice vat"
}
```

---

## ⚖️ דרישות משפטיות | Legal Requirements

### חובות משפטיות:

1. **שמירת נתונים:** 7 שנים לפחות (חוק עסקאות גופים ציבוריים)
2. **הצפנה:** כל התקשורת חייבת להיות מוצפנת (TLS 1.2+)
3. **גיבויים:** חובה לשמור גיבויים של כל החשבוניות
4. **דיווח תקלות:** תקלות במערכת חייבות להידווח תוך 24 שעות

### תקנות חשבוניות אלקטרוניות:

**סף חובה נוכחי (2025):**
- עסקאות B2B מעל **₪25,000** - חובה חשבונית אלקטרונית
- יורד ל-**₪20,000** ב-2026
- יורד ל-**₪15,000** ב-2027
- **כל העסקאות** החל מ-2028

---

## ✅ רשימת בדיקה סופית | Final Checklist

לפני שאתה מוכן להתחיל:

- [ ] יש לי מספר עוסק מורשה פעיל
- [ ] יש לי חשבון באתר רשות המסים
- [ ] הגשתי בקשה ל-API access
- [ ] קיבלתי CLIENT_ID ו-CLIENT_SECRET
- [ ] הגדרתי את הסודות במערכת
- [ ] בדקתי חיבור ראשוני (OAuth2 token)
- [ ] קראתי את התיעוד הטכני של הרשות
- [ ] יש לי תמיכת רואה חשבון (אופציונלי אבל מומלץ)
- [ ] הבנתי את הדרישות המשפטיות
- [ ] המערכת שלי תומכת בהצפנה ושמירת לוגים

---

## 🚀 מוכן להתחיל | Ready to Start

לאחר שיש לך את כל האישורים, המערכת שלנו תטפל אוטומטית ב:

✅ **OAuth2 Authentication** - חיבור מאובטח עם חידוש אוטומטי של tokens  
✅ **Invoice Submission** - הגשת חשבוניות אוטומטית לרשות המסים  
✅ **VAT Reports** - דיווחי מע״מ חודשיים אוטומטיים  
✅ **Compliance Monitoring** - בדיקת עדכוני פורמט ותקנות  
✅ **Audit Trail** - מעקב מלא אחר כל פעולה  
✅ **7-Year Retention** - שמירת נתונים ל-7 שנים כחוק  

---

## 📞 צריך עזרה? | Need Help?

**Pet Wash Support:**
- Email: support@petwash.co.il
- WhatsApp: +972-54-983-3355

**רשות המסים:**
- טלפון: *4954 או 02-5656400
- אימייל: api-support@taxes.gov.il

---

**עודכן לאחרונה:** 30 אוקטובר 2025  
**גרסה:** 1.0  
**מחבר:** Pet Wash™ Technical Team
