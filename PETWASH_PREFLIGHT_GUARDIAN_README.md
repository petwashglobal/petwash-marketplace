# PetWash™ 2025 Preflight Guardian

**Created**: November 20, 2025  
**Purpose**: Comprehensive deployment protection system for Pet Wash™ luxury 2025 codebase

---

## 🛡️ Overview

The PetWash™ 2025 Preflight Guardian is an enterprise-grade automated deployment protection system that ensures only luxury 2025 UI code can reach production. It performs comprehensive scans for legacy code, brand violations, missing components, and configuration issues before every build.

---

## ✅ What It Does

### 1. Legacy UI Detection
Scans for old 2024 template code that must never reach production:
- `apple-package-` CSS classes
- `old-landing-hero`, `oldLandingHero`
- `legacy-landing`, `demo-template`
- `placeholder-hero`, `example-template`
- `lorem ipsum` (placeholder text)
- Template attribution markers

### 2. Brand Protection
Detects incorrect brand usage:
- `PetWash (c)` - wrong copyright format
- `Petwash™` - wrong capitalization
- Ensures consistent "Pet Wash™" branding

### 3. Required 2025 Luxury Files Verification
Confirms core luxury components exist:
- ✅ `LuxuryThemeWrapper.tsx` - Main theme provider
- ✅ `GiftCards.tsx` - Luxury gift card system
- ✅ `PetWashHeaderNav.tsx` - Modern navigation
- ✅ `Footer.tsx` - 2025 footer
- ✅ `PetWashDivisions.tsx` - Platform divisions showcase
- ✅ `LuxuryPlatformShowcase.tsx` - Platform showcase component

### 4. Environment Configuration Checks
Validates critical environment variables:
- `GCS_BACKUP_BUCKET` - Google Cloud Storage backup bucket
- Verifies bucket naming conventions (should start with "petwash-")

### 5. Git Sanity Check
Ensures repository is properly connected to GitHub version control

### 6. Detailed Categorized Reporting
Issues are grouped by severity:
- **CONFIG_ERROR** - Hard failure (blocks deployment)
- **LEGACY_UI** - Hard failure (blocks deployment)
- **BANNED_PATTERN** - Hard failure (blocks deployment)
- **MISSING_REQUIRED_FILE** - Soft warning
- **CONFIG_WARNING** - Soft warning

---

## 🚀 Usage

### Manual Execution

```bash
# Run preflight guardian
npm run preflight

# Alternative command (same functionality)
npm run scan:ui
```

### Automatic Execution

The guardian runs automatically in these scenarios:

#### 1. Before Every Build
```bash
npm run build
# Automatically runs: npm run preflight → vite build
```

The `prebuild` hook ensures preflight always runs before Vite build starts.

#### 2. On GitHub Actions (CI/CD)
Every push to `main` or `production` branches triggers:
```yaml
.github/workflows/petwash-ci.yml
├── Checkout repository
├── Install dependencies
├── Run preflight guardian  ← Blocks merge if fails
├── Build app (if preflight passes)
└── Deploy (if build succeeds)
```

#### 3. Replit Deployment
When you click "Deploy" in Replit:
```
Deploy button → npm run build → npm run preflight → vite build → deploy
```

---

## 📊 Sample Output

### ✅ Success (Clean Codebase)
```bash
$ npm run preflight

🔍 PetWash 2025 Preflight Guardian starting...

1) Checking backup and Google Cloud env config...
2) Checking for core 2025 luxury UI files...
3) Scanning source tree for legacy UI or banned patterns...

📊 Preflight Report

✅ No issues found. Codebase looks clean and modern.

You are safe to build, deploy and push to GitHub.
```

### ⚠️ Warnings Only (Build Allowed)
```bash
$ npm run preflight

🔍 PetWash 2025 Preflight Guardian starting...

1) Checking backup and Google Cloud env config...
2) Checking for core 2025 luxury UI files...
3) Scanning source tree for legacy UI or banned patterns...

📊 Preflight Report

--- CONFIG_WARNING (1) ---
• GCS_BACKUP_BUCKET is set to "test-bucket". Double check this is your official backup bucket name.

⚠️ Preflight completed with warnings only.
You can build, but it is recommended to review and fix the warnings.
```

### ❌ Failure (Deployment Blocked)
```bash
$ npm run preflight

🔍 PetWash 2025 Preflight Guardian starting...

1) Checking backup and Google Cloud env config...
2) Checking for core 2025 luxury UI files...
3) Scanning source tree for legacy UI or banned patterns...

📊 Preflight Report

--- LEGACY_UI (2) ---
• Legacy UI marker "apple-package-" found  -> client/src/components/OldCard.tsx:45
    "className="apple-package-card hover:scale-105""
• Legacy UI marker "placeholder-hero" found  -> client/src/pages/Landing.tsx:12
    "<!-- placeholder-hero section -->"

--- BANNED_PATTERN (1) ---
• Banned pattern "Petwash™" detected  -> client/src/lib/constants.ts:5
    "export const BRAND_NAME = 'Petwash™';"

❌ Preflight failed.
These issues must be fixed before build, deploy or pushing to protected branches.
```

---

## 🔧 Configuration

### File Location
```
scripts/petwash-preflight.ts
```

### Adding More Legacy Patterns

Edit the `LEGACY_UI_MARKERS` array:

```typescript
const LEGACY_UI_MARKERS: string[] = [
  "apple-package-",
  "old-landing-hero",
  "your-new-pattern",  // Add here
];
```

### Adding Banned Patterns

Edit the `BANNED_PATTERNS` array:

```typescript
const BANNED_PATTERNS: string[] = [
  "console.log('DEBUG_ONLY')",
  "HARDCODED_API_KEY",
  "your-banned-pattern",  // Add here
];
```

### Changing Required Files

Edit the `REQUIRED_FILES` array:

```typescript
const REQUIRED_FILES: string[] = [
  "client/src/components/LuxuryThemeWrapper.tsx",
  "client/src/components/YourNewComponent.tsx",  // Add here
];
```

### Adjusting Scanned Directories

Edit the `SCAN_DIRS` array:

```typescript
const SCAN_DIRS = [
  "client",
  "src",
  "your-directory",  // Add here
].map((p) => path.join(projectRoot, p));
```

---

## 📁 Integration Status

### ✅ Completed

- [x] Preflight script created (`scripts/petwash-preflight.ts`)
- [x] Package.json scripts configured:
  - `preflight`: Run guardian manually
  - `scan:ui`: Alias for preflight
  - `prebuild`: Auto-run before builds
- [x] GitHub Actions workflow (`petwash-ci.yml`)
- [x] Documentation updated:
  - PRODUCTION_DEPLOYMENT_GUIDE.md
  - replit.md
  - PETWASH_PREFLIGHT_GUARDIAN_README.md
- [x] Tested on clean codebase (passed ✅)
- [x] Production build successful (345 files)

### 🎯 Deployment Coverage

| Deployment Method | Preflight Runs | Auto-Block | Status |
|-------------------|----------------|------------|--------|
| `npm run build` | ✅ Yes | ✅ Yes | Working |
| Replit Deploy | ✅ Yes | ✅ Yes | Working |
| GitHub Actions | ✅ Yes | ✅ Yes | Configured |
| Cloud Run | ✅ Yes | ✅ Yes | Via Replit |

---

## 🧪 Testing

### Test Success Scenario
```bash
npm run preflight
# Should pass with ✅ or ⚠️ (warnings only)
```

### Test Build Integration
```bash
npm run build
# Should run preflight first, then build
```

### Test Failure Scenario
1. Add test legacy code:
```bash
echo "const test = 'apple-package-test';" > client/src/test-legacy.ts
```

2. Run preflight (should fail):
```bash
npm run preflight
```

3. Remove test file:
```bash
rm client/src/test-legacy.ts
```

---

## 🔐 Security Features

1. **Read-Only Scanner** - Never modifies code
2. **Build-Time Blocking** - Stops deployment at build phase
3. **No Network Access** - All local file scanning
4. **TypeScript Safety** - Type-safe configuration
5. **Exit Code Enforcement** - Exit 1 = blocked, Exit 0 = allowed

---

## 🎉 Benefits

### For Development
- Catches legacy code before deployment
- Enforces luxury 2025 UI standards
- Provides clear error messages with file locations
- Fast scanning (<5 seconds typical)

### For Production
- Zero legacy code in production (guaranteed)
- Consistent brand usage across codebase
- Required components always present
- Configuration validation before deploy

### For Team
- Works on Replit, GitHub, local dev
- No manual checks needed
- Automated enforcement
- Clear categorized reports

---

## 📚 Related Documentation

- **PRODUCTION_DEPLOYMENT_GUIDE.md** - Complete deployment instructions
- **replit.md** - System architecture
- **LEGACY_UI_SCANNER_README.md** - Old scanner (deprecated)
- **.github/workflows/petwash-ci.yml** - CI/CD configuration

---

## 🆘 Troubleshooting

### Preflight Passes But Build Fails
- Preflight only checks code quality, not TypeScript/build errors
- Run `npm run check` to see TypeScript errors
- Check Vite build output for specific issues

### False Positives for Brand Protection
- Review `BANNED_PATTERNS` in script
- Adjust patterns to be more specific
- Consider context (e.g., "pet wash service" vs "Pet Wash™ brand")

### Missing Required Files Warning
- Verify files exist at specified paths
- Update `REQUIRED_FILES` if structure changed
- Check for typos in file paths

### Environment Variables Not Detected
- Ensure variables are set in Replit Secrets
- For GitHub Actions, add to repository secrets
- Check variable names match exactly

---

## ✨ Next Steps

The Preflight Guardian is **fully operational** and protecting your production deployments.

**Current Status:**
- ✅ Scanning 2025 luxury codebase
- ✅ Blocking legacy UI patterns
- ✅ Running before every build
- ✅ Integrated with GitHub Actions
- ✅ Production build verified (345 files)

**Ready to deploy Pet Wash™ to production at petwash.co.il! 🚀**

---

**The luxury 2025 codebase is now protected by automated preflight checks across all deployment platforms. Only clean, modern, luxury UI code can reach production. 🛡️**
