# Pet Wash™ Language Compliance Rules 🌍

## Core Principle

**ONLY English can mix other languages for branding.**  
**All other languages MUST be pure translations - NO English words.**

---

## ✅ The Golden Rule

### English (en)
- **Primary language**: Can include strategic Hebrew/Arabic/Russian touches for luxury branding
- **Example**: "Premium Pet Care" → "Premium Pet Care — טיפול יוקרתי"
- **Purpose**: Global brand appeal with local cultural touches

### Hebrew (he) 
- **100% Hebrew** - Zero English except brand names
- **Only exception**: "Pet Wash™" (trademark brand name)
- **Example**: "Sign In" → "התחברות" ✅ (NOT "Login" ❌)

### Arabic (ar)
- **100% Arabic** - Zero English except brand names
- **Only exception**: "Pet Wash™" (trademark brand name)
- **Example**: "Dashboard" → "لوحة التحكم" ✅ (NOT "Dashboard" ❌)

### Russian (ru)
- **100% Russian** - Zero English except brand names
- **Only exception**: "Pet Wash™" (trademark brand name)
- **Example**: "Settings" → "Настройки" ✅ (NOT "Settings" ❌)

### French (fr)
- **100% French** - Zero English except brand names
- **Only exception**: "Pet Wash™" (trademark brand name)
- **Example**: "Contact" → "Contact" ✅ (French word)

### Spanish (es)
- **100% Spanish** - Zero English except brand names
- **Only exception**: "Pet Wash™" (trademark brand name)
- **Example**: "Premium" → "Premium" ✅ (Same word)

---

## 🚫 Common Violations to Fix

### ❌ WRONG:
```typescript
// Hebrew page with English text
<button>Sign In</button> // In Hebrew mode
<h1>Dashboard</h1> // In Arabic mode
<p>Loading...</p> // In Russian mode
```

### ✅ CORRECT:
```typescript
// Hebrew page with Hebrew text
<button>{t('auth.login')}</button> // "התחברות"
<h1>{t('nav.dashboard')}</h1> // "לוח בקרה"
<p>{t('common.loading')}</p> // "טוען..."
```

---

## 📋 Allowed Brand Name Exceptions

These brand names stay in English across ALL languages:

1. **Pet Wash™** - Main brand (always with ™)
2. **K9000** - Technology name
3. **The Sitter Suite™** - Division name
4. **Walk My Pet™** - Division name
5. **PetTrek™** - Division name
6. **Paw Finder™** - Division name
7. **The Plush Lab™** - Division name

**Example in Hebrew:**
```html
<h1>ברוכים הבאים ל-Pet Wash™</h1>
<!-- "Welcome to Pet Wash™" -->
```

---

## 🔍 How to Find Violations

### Search for English in Hebrew files:
```bash
grep -r "Sign In\|Login\|Dashboard\|Settings" client/src/pages --include="*.tsx"
```

### Check translation coverage:
```bash
# Look for missing Hebrew translations
grep "he:" client/src/lib/i18n.ts
```

---

## 🛠️ Fixing Translation Issues

### Step 1: Add missing translation
```typescript
// client/src/lib/i18n.ts
export const translations = {
  'button.submit': { 
    en: 'Submit', 
    he: 'שלח',  // Add Hebrew
    ar: 'إرسال', // Add Arabic
    ru: 'Отправить' // Add Russian
  }
};
```

### Step 2: Use translation in component
```typescript
// Before (WRONG)
<button>Submit</button>

// After (CORRECT)
<button>{t('button.submit')}</button>
```

### Step 3: Verify RTL support
```typescript
// Ensure dir attribute changes with language
<html lang={language} dir={language === 'he' || language === 'ar' ? 'rtl' : 'ltr'}>
```

---

## 📊 Translation Coverage Report

Run this command to see missing translations:
```bash
npm run check-translations
```

**Current Status** (as of Nov 2025):
- English: ✅ 100% complete
- Hebrew: ⚠️ ~70% complete (416 missing translations)
- Arabic: ⚠️ ~60% complete
- Russian: ⚠️ ~60% complete
- French: ⚠️ ~60% complete
- Spanish: ⚠️ ~60% complete

---

## 🎯 Priority Translation Areas

Fix these high-traffic pages first:

1. **Landing Page** (`client/src/pages/Landing.tsx`)
2. **Sign In/Sign Up** (`client/src/pages/SignIn.tsx`, `SignUp.tsx`)
3. **Dashboard** (`client/src/pages/Dashboard.tsx`)
4. **Packages** (`client/src/pages/Packages.tsx`)
5. **Loyalty Program** (`client/src/pages/Loyalty.tsx`)
6. **E-Sign Forms** (`public/esign-petwash-he.html`)

---

## 💡 Best Practices

### 1. Never hardcode text
```typescript
// ❌ BAD
<h1>Welcome to Pet Wash</h1>

// ✅ GOOD
<h1>{t('hero.welcome')}</h1>
```

### 2. Use language ternaries ONLY for brand touches in English
```typescript
// ✅ GOOD (English page adding Hebrew touch)
{language === 'en' && <span className="text-muted">טיפול יוקרתי</span>}

// ❌ BAD (Hebrew page using English)
{language === 'he' && <span>Premium Care</span>}
```

### 3. Inline ternaries are code smell
```typescript
// ❌ BAD (found 67 times in codebase)
{language === 'he' ? 'שלום' : 'Hello'}

// ✅ GOOD
{t('common.hello')}
```

---

## 🚨 Automated Detection

AI Monitor flags these violations:

```javascript
// From AIMonitoringService.ts
if (language === 'he' && /[A-Za-z]{4,}/.test(textContent)) {
  violations.push({
    severity: 'warning',
    message: 'English text found in Hebrew mode',
    file: filePath,
    line: lineNumber
  });
}
```

---

## 📝 E-Sign HTML Files

For standalone HTML files (like `/esign-petwash-he.html`):

### English Version:
- File: `esign-petwash.html`
- Language: `<html lang="en">`
- All text in English

### Hebrew Version:
- File: `esign-petwash-he.html`
- Language: `<html lang="he" dir="rtl">`
- **All text in Hebrew** (buttons, labels, messages)
- **Only exception**: Technical terms like "SHA-256", "PDF", "PNG"

---

## 🎓 Israeli Market Strategy

Per user requirements:

**Primary Language**: Messages to Israeli users and partners → **MAINLY Hebrew**

**Brand Touches**: Include touches of English to maintain:
- Cool, luxury lifestyle brand
- Global, leading image
- Premium positioning

**Target Balance**: 
- 80% Hebrew content
- 20% strategic English phrases/terms that enhance premium brand

**Example**:
```html
<!-- Landing page in Israel -->
<h1>Pet Wash™ — מהפכה בטיפול לחיות מחמד</h1>
<!-- "Pet Wash™ — Revolution in Pet Care" -->
```

---

## ✅ Compliance Checklist

Before deploying ANY page:

- [ ] All UI text uses `t()` function
- [ ] No hardcoded English in Hebrew/Arabic/Russian modes
- [ ] Brand names keep English with ™ symbol
- [ ] RTL layout works correctly (Hebrew, Arabic)
- [ ] Alert/toast messages are translated
- [ ] Error messages are translated
- [ ] Button labels are translated
- [ ] Form placeholders are translated
- [ ] Navigation menu is translated
- [ ] Footer is translated

---

## 🔗 Related Files

- **Translations**: `client/src/lib/i18n.ts`
- **Language Toggle**: `client/src/components/LanguageToggle.tsx`
- **Server i18n**: `server/lib/i18n.ts`
- **Hebrew E-Sign**: `public/esign-petwash-he.html`
- **English E-Sign**: `public/esign-petwash.html`

---

## 📞 Questions?

If unsure whether to translate a term:
1. **Technical terms** (API, URL, PDF, SHA-256) → Keep English
2. **Brand names** (Pet Wash™, K9000) → Keep English
3. **UI elements** (buttons, labels, messages) → **MUST translate**
4. **User content** (names, addresses) → User's choice

---

**Remember**: Israeli users deserve a **FULL Hebrew experience**. Only English can show off with other languages! 🇮🇱

---

---

## 🆕 New Features (November 5, 2025)

### Personalized AI Greetings 🎉

Pet Wash™ now features **personalized AI-powered greetings** on app launch using Gemini 2.5 Flash!

**Greetings adapt to:**
- 🎂 **User's Birthday** - Special birthday wishes
- 🕎 **Israeli/Jewish Holidays** - Powered by FREE Hebcal API (Purim, Pesach, Rosh Hashanah, etc.)
- ☀️ **Time of Day** - Morning greetings (5 AM - 12 PM)
- 🌙 **Late Night** - Good night wishes (10 PM - 5 AM)
- 🌍 **User's Language** - Hebrew or English

**Files:**
- `server/services/PersonalizedGreetingService.ts` - AI greeting generation service
- `client/src/hooks/usePersonalizedGreeting.ts` - React hook for app launch
- API Endpoint: `GET /api/greeting/personalized` (requires auth)

**Example Greetings:**
- Hebrew Birthday: `שלום ניר! 🎉 מזל טוב ליום ההולדת שלך!`
- English Morning: `Good morning, Nir! ☀️ Great to see you today!`
- Hebrew Holiday (Purim): `היי ניר! חג פורים שמח! 🎭`

---

**Last Updated**: November 5, 2025  
**Maintained by**: Pet Wash™ Engineering Team
