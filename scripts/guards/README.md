# PetWash™ + Octopus™ Protection Guards

## Overview
Complete dual-end protection system for PetWash™ + Octopus™ platforms covering both Replit (development) and GitHub→Google Cloud (production) environments.

## Protection System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           Master Protection Orchestrator                     │
│                                                              │
│  Coordinates all protection guards:                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
┌─────────────────┐   ┌─────────────────┐
│  Brand Guard    │   │ Purity Scanner  │
│  ✓ PetWash™     │   │ ✓ No legacy     │
│  ✓ Octopus™     │   │ ✓ No templates  │
│  ✓ K9000™       │   │ ✓ No rogue code │
└─────────────────┘   └─────────────────┘
         │                   │
         │                   │
         ▼                   ▼
┌─────────────────┐   ┌─────────────────┐
│ Architecture    │   │  Multi-Platform │
│ Integrity       │   │  Compliance     │
│ ✓ 2025 structure│   │ ✓ All platforms │
│ ✓ Correct dirs  │   │ ✓ EventBus      │
│ ✓ Single port   │   │ ✓ LED system    │
└─────────────────┘   └─────────────────┘
         │                   │
         └─────────┬─────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │  Preflight Guardian │
         │  ✓ UI compliance    │
         │  ✓ Build validation │
         └─────────────────────┘
```

## Guards

### 1. Brand Enforcement Guard
**File**: `brand-enforcement-guard.ts`
**Purpose**: Enforce correct brand naming with ™ trademark

**Checks**:
- ✅ PetWash™ (NOT PetWash, Petwash, PETWASH)
- ✅ Octopus™ (NOT Octopus, octopus)
- ✅ K9000™ (NOT K9000, k9000)
- ✅ All platform names with ™

**Run**: `tsx scripts/guards/brand-enforcement-guard.ts`

### 2. Code Purity Scanner
**File**: `code-purity-scanner.ts`
**Purpose**: Detect and block foreign/legacy code

**Checks**:
- ❌ No template/demo/starter/boilerplate code
- ❌ No rogue folders (legacy/, old/, backup/, template/)
- ❌ No forbidden build directories (public/, build/)
- ✅ All 2025 architecture files present

**Run**: `tsx scripts/guards/code-purity-scanner.ts`

### 3. Architecture Integrity Checker
**File**: `architecture-integrity-checker.ts`
**Purpose**: Validate 2025 PetWash™ structure

**Checks**:
- ✅ Required directories (client/, server/, shared/)
- ✅ Required server dirs (routes/, services/, iot/)
- ✅ Correct import patterns
- ✅ Single port configuration (5000→80)

**Run**: `tsx scripts/guards/architecture-integrity-checker.ts`

### 4. Multi-Platform Compliance Engine
**File**: `multi-platform-compliance.ts`
**Purpose**: Ensure all platforms are integrated

**Checks**:
- ✅ PetWash™ Core routes and components
- ✅ K9000™ LED system and automation
- ✅ EventBus integration
- ✅ Payment systems
- ✅ Loyalty system
- ✅ Critical integrations wired

**Run**: `tsx scripts/guards/multi-platform-compliance.ts`

### 5. Preflight Guardian
**File**: `../petwash-preflight.ts`
**Purpose**: Comprehensive luxury 2025 compliance

**Checks**:
- ❌ No legacy UI patterns
- ❌ No banned code patterns
- ✅ All luxury components present
- ✅ Build configuration valid

**Run**: `tsx scripts/petwash-preflight.ts`

### Master Orchestrator
**File**: `master-protection-orchestrator.ts`
**Purpose**: Run ALL guards in sequence

**Runs**:
1. Brand Enforcement Guard (CRITICAL)
2. Code Purity Scanner (CRITICAL)
3. Architecture Integrity Checker (CRITICAL)
4. Multi-Platform Compliance Engine (WARNING)
5. Preflight Guardian (CRITICAL)

**Run**: `tsx scripts/guards/master-protection-orchestrator.ts`

## Usage

### Manual Protection Check
```bash
# Run all protection checks
tsx scripts/guards/master-protection-orchestrator.ts

# Run individual guard
tsx scripts/guards/brand-enforcement-guard.ts
```

### Automatic Protection (Hooks)

#### Pre-Build Hook
```bash
# Already configured in package.json
npm run build  # Automatically runs protection checks
```

#### GitHub Actions
Protection checks run automatically on:
- Push to any branch
- Pull request
- Before deployment

See `.github/workflows/petwash-ci.yml`

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | ✅ All checks passed |
| 1 | ❌ Critical failure - build/deploy blocked |

## Severity Levels

| Level | Action | Example |
|-------|--------|---------|
| **CRITICAL** | ❌ Block build/deploy | Missing PetWash™ trademark |
| **WARNING** | ⚠️ Allow with warning | Missing optional route |
| **INFO** | ℹ️ Informational only | Performance suggestion |

## Manual Override

**⚠️ DANGER ZONE - USE WITH EXTREME CAUTION**

To temporarily bypass protection (emergency only):
```bash
# Build without protection checks
vite build
```

**Note**: This bypasses ALL protection and should NEVER be used for production deployments.

## Activation Status

🟢 **ACTIVE** - All protection systems are active and enforcing rules.

To verify activation:
```bash
tsx scripts/guards/master-protection-orchestrator.ts
```

## Support

For issues with protection guards:
1. Check guard output for specific error details
2. Review `DEPLOYMENT_ARCHITECTURE_2025.md`
3. Ensure all 2025 architecture files are present
4. Verify brand names use ™ trademark

## Directive Authority

This protection system implements the **PetWash™ + Octopus™ Dual-End Total Protection Directive (2025-2030)** as specified in the master activation document.

All code must pass ALL protection checks before:
- Committing to Git
- Pushing to GitHub
- Building for production
- Deploying to any environment
