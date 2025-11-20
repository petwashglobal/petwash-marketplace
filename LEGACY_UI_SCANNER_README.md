# Legacy UI Scanner - Deployment Protection System

**Created**: November 20, 2025  
**Purpose**: Block any old 2024 template code from reaching production

---

## 🛡️ Overview

The Legacy UI Scanner is an automated deployment protection system that ensures only luxury 2025 UI code can be deployed to production. It blocks deployments if any old Apple package CSS classes, legacy components, or template code is detected.

---

## ✅ What It Does

The scanner **automatically runs before every build** and:

1. **Scans all frontend code** in `client/src/` for forbidden patterns
2. **Blocks deployment** if legacy code is found (exit code 1)
3. **Allows deployment** only when codebase is clean (exit code 0)
4. **Reports exact locations** of any legacy code with file paths and snippets

---

## 🚫 Forbidden Patterns

The scanner blocks these legacy patterns:

| Pattern | Reason |
|---------|--------|
| `apple-package-*` | Old Apple package CSS (non-luxury design) |
| `apple-old-ui` | Legacy Apple UI component |
| `legacy-ui` | Generic legacy UI marker |
| `OldGiftCards` | Old gift cards screen |

**You can add more patterns** by editing `scripts/scan-legacy-ui.cjs`

---

## 🔧 How It Works

### Automatic Execution

The scanner runs automatically in these scenarios:

#### 1. **Local Development - Before Build**
```bash
npm run build
```
The `prebuild` hook runs `npm run scan:ui` before Vite build starts.

#### 2. **Manual Testing**
```bash
npm run scan:ui
```
Run the scanner anytime to verify your code is clean.

#### 3. **Replit Deployment**
When you click "Deploy" in Replit, the build command runs:
```bash
npm run build  # Automatically runs scan:ui first
```

#### 4. **GitHub Actions (CI/CD)**
Every push to `main` branch triggers `.github/workflows/deploy-protection.yml`:
```yaml
- Run Legacy UI Scanner (npm run scan:ui)
- Build verification (npm run build)
- Only deploy if both pass
```

---

## 📊 Sample Output

### ✅ Success (Clean Codebase)
```bash
$ npm run scan:ui

> rest-express@1.0.0 scan:ui
> node scripts/scan-legacy-ui.cjs

✅ Legacy UI scan passed. Only 2025 luxury UI code detected.
```

### ❌ Failure (Legacy Code Detected)
```bash
$ npm run scan:ui

> rest-express@1.0.0 scan:ui
> node scripts/scan-legacy-ui.cjs

❌ Legacy UI scan FAILED.
The following legacy patterns are still present:

1. File: client/src/pages/GiftCards.tsx
   Pattern: "apple-package-"
   Reason: Old Apple package CSS (non-luxury design)
   Snippet: className="apple-package-card hover:scale-105 transition-transform"

2. File: client/src/styles/legacy.css
   Pattern: "legacy-ui"
   Reason: Generic legacy UI marker
   Snippet: /* legacy-ui styles for backward compatibility */

🚫 Deployment blocked. Please remove/replace these legacy fragments with the 2025 luxury UI before building or deploying.
```

---

## 🔨 How to Fix Failures

When the scanner fails:

1. **Review the error output** - It shows exact file paths and code snippets
2. **Remove or replace legacy code** with 2025 luxury components:
   - Replace `apple-package-*` classes with modern Tailwind utility classes
   - Replace `OldGiftCards` with `GiftCards` (luxury 2025 version)
   - Remove any `legacy-ui` markers
3. **Re-run the scanner** until it passes:
   ```bash
   npm run scan:ui
   ```
4. **Build and deploy** once clean:
   ```bash
   npm run build
   ```

---

## 📁 File Structure

```
petwash-marketplace/
├── scripts/
│   └── scan-legacy-ui.cjs          # Scanner script (CommonJS)
├── .github/
│   └── workflows/
│       └── deploy-protection.yml   # GitHub Actions workflow
├── package.json                     # Scripts configuration
└── client/src/                      # Scanned directory
    ├── pages/
    ├── components/
    └── styles/
```

---

## ⚙️ Configuration

### Add More Forbidden Patterns

Edit `scripts/scan-legacy-ui.cjs`:

```javascript
const forbiddenPatterns = [
  {
    pattern: 'apple-package-',
    reason: 'Old Apple package CSS (non-luxury design)',
  },
  {
    pattern: 'your-legacy-pattern',  // Add new pattern here
    reason: 'Why this pattern is forbidden',
  },
];
```

### Change Scanned Directory

Edit `scripts/scan-legacy-ui.cjs`:

```javascript
const ROOT_DIR = path.join(__dirname, '..', 'client', 'src');
// Change to scan different directory
```

---

## 🚀 Integration Status

### ✅ Completed Integrations

- [x] Script created at `scripts/scan-legacy-ui.cjs`
- [x] Added to package.json scripts:
  - `scan:ui`: Run scanner manually
  - `prebuild`: Auto-run before every build
- [x] GitHub Actions workflow configured
- [x] Documentation created:
  - PRODUCTION_DEPLOYMENT_GUIDE.md (updated)
  - replit.md (updated)
  - LEGACY_UI_SCANNER_README.md (this file)
- [x] Verified on clean codebase (passed ✅)
- [x] Tested with build pipeline (working ✅)

### 🎯 Deployment Coverage

| Deployment Method | Scanner Runs | Auto-Block |
|-------------------|--------------|------------|
| `npm run build` | ✅ Yes (prebuild) | ✅ Yes |
| Replit Deploy UI | ✅ Yes (build command) | ✅ Yes |
| GitHub Actions | ✅ Yes (workflow) | ✅ Yes |
| Cloud Run Deploy | ✅ Yes (build step) | ✅ Yes |

---

## 🧪 Testing

### Test Scanner Works
```bash
# Should pass on current codebase
npm run scan:ui
```

### Test Build Integration
```bash
# Scanner runs automatically, then build
npm run build
```

### Test Failure Scenario
1. Add a test file with forbidden pattern:
   ```bash
   echo "const test = 'apple-package-test';" > client/src/test-legacy.ts
   ```
2. Run scanner (should fail):
   ```bash
   npm run scan:ui
   ```
3. Remove test file:
   ```bash
   rm client/src/test-legacy.ts
   ```

---

## 📚 Related Documentation

- **PRODUCTION_DEPLOYMENT_GUIDE.md** - Complete deployment instructions
- **replit.md** - System architecture and deployment strategy
- **.github/workflows/deploy-protection.yml** - CI/CD configuration

---

## 🎉 Benefits

1. **Zero Legacy Code in Production** - Automated enforcement
2. **Fast Detection** - Catches legacy code before deployment
3. **Clear Error Messages** - Shows exact file and line with legacy code
4. **Multi-Platform Protection** - Works on Replit, GitHub, Cloud Run
5. **Easy Maintenance** - Add new patterns as needed

---

## 🔐 Security Notes

- Scanner is **read-only** - never modifies code
- Runs in **build phase** before any deployment
- **Blocks deployment** at build time (exit code 1)
- **No network access** required - all local file scanning

---

## ✨ Next Steps

The scanner is **fully operational** and protecting your production deployments. 

To deploy Pet Wash™ to production:

1. ✅ Scanner is configured (you're protected!)
2. Verify latest code is on GitHub
3. Click "Deploy" in Replit UI
4. Scanner runs automatically → Build → Deploy to petwash.co.il

**Your luxury 2025 codebase is now protected! 🛡️**
