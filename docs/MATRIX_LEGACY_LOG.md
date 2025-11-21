# 🔥 PETWASH™ MATRIX LEGACY LOG
## Total System Purge - November 21, 2025

---

## 🎯 TARGETS FOR DELETION

### 1. PARALLEL UI SYSTEMS (48KB TOTAL)

#### Old Header System:
- ❌ `client/src/components/Header.old.tsx` (28KB, 790 lines)
  - Archived old header with GlobalNavigation
  - NOT imported anywhere
  - **STATUS**: MARKED FOR DELETION

#### Old Navigation Systems:
- ❌ `client/src/components/GlobalNavigation.tsx` (12KB, 286 lines)
  - Only imported by Header.old.tsx (archived)
  - Multi-layer hamburger menu
  - **STATUS**: MARKED FOR DELETION

- ❌ `client/src/components/MultiLayerNavigation.tsx` (8KB, ~200 lines)
  - Old navigation experiment
  - Usage: UNKNOWN - needs verification
  - **STATUS**: MARKED FOR DELETION

#### Duplicate Headers:
- ⚠️ `client/src/components/BrandHeader.tsx` (1KB, 19 lines)
  - Simple logo display
  - **IMPORTED BY**: AccessibilityStatement.tsx, PrivacyPolicy.tsx
  - **STATUS**: MIGRATE PAGES FIRST, THEN DELETE

### 2. LEGACY COMPONENTS

- ❌ `client/src/components/PlatformPlaceholder.tsx`
  - Name suggests old/test component
  - **STATUS**: VERIFY USAGE, THEN DELETE

### 3. LUXURY UI SYSTEM (KEEP - DO NOT DELETE)

#### Headers (Keep):
- ✅ `client/src/components/PetWashHeader.tsx` - Main luxury header
- ✅ `client/src/components/Header.tsx` - Compatibility shim (temporary)

#### Layouts (Keep):
- ✅ `client/src/components/Layout.tsx` - Main luxury layout wrapper

#### Footers (Keep):
- ✅ `client/src/components/Footer.tsx` - Main luxury footer
- ⚠️ `client/src/components/LegalFooter.tsx` - Verify if needed

#### Navigation (Keep):
- ✅ `client/src/components/NavigationButton.tsx` - Utility component

### 4. CSS FILES AUDIT

#### Luxury CSS (KEEP):
- ✅ `client/src/styles/petwash-header.css` (14KB, 550 lines) - Luxury header styles
- ✅ `client/src/styles/override-2025.css` - White background enforcement
- ✅ `client/src/styles/responsive-tokens.css` - Breakpoints
- ✅ `client/src/styles/floating-stack.css` - Floating action button
- ✅ `client/src/styles/ai-chat.css` - AI chat widget
- ✅ `client/src/index.css` - Main CSS file

#### Verify:
- ⚠️ `client/src/components/NewHumanAvatar.css` - Component-specific CSS, verify if used

### 5. PUBLIC ASSETS

✅ **NO OLD/LEGACY FILES FOUND** - Clean

---

## 📊 DELETION SUMMARY

| Category | Files to Delete | Total Size |
|----------|----------------|------------|
| Old Headers | 1 | 28KB |
| Old Navigation | 2 | 20KB |
| Duplicate Headers | 1* | 1KB |
| Legacy Components | 1 | TBD |
| **TOTAL** | **5** | **~49KB** |

*Requires page migration first

---

## 🔄 MIGRATION REQUIRED

Before deleting BrandHeader.tsx:
1. Update `AccessibilityStatement.tsx` to use PetWashHeader
2. Update `PrivacyPolicy.tsx` to use PetWashHeader

---

## ✅ VERIFICATION CHECKLIST

- [ ] Delete Header.old.tsx
- [ ] Delete GlobalNavigation.tsx
- [ ] Delete MultiLayerNavigation.tsx
- [ ] Migrate AccessibilityStatement.tsx from BrandHeader to Layout
- [ ] Migrate PrivacyPolicy.tsx from BrandHeader to Layout
- [ ] Delete BrandHeader.tsx
- [ ] Verify PlatformPlaceholder.tsx usage
- [ ] Delete PlatformPlaceholder.tsx if unused
- [ ] Verify LegalFooter.tsx usage
- [ ] Verify NewHumanAvatar.css usage
- [ ] Run preflight scan
- [ ] Run build verification

---

*Scan completed: November 21, 2025*
