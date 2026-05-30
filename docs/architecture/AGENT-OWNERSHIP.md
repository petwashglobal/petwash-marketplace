# PetWash Multi-Agent Ownership Map

**Status:** Active
**Last updated:** 2026-05-29
**Owner:** CTO (Claude Code, desktop)

This document is the **single source of truth** for which AI agent owns which part of the PetWash codebase. Every AI agent working in this repo MUST read this before making changes.

The goal is simple: **4 agents, zero collisions.** Each agent has a clear domain; cross-domain work routes through the CTO.

---

## 0. The Four Agents

| # | Agent | Role | Environment | Primary tools |
|---|---|---|---|---|
| 1 | **Claude Code (desktop)** | **CTO + R&D** | Local terminal, full repo access | Bash, Edit, Read, gh CLI, can ship PRs |
| 2 | **Claude in Chrome** | **Creative + Visual Director** | Browser extension | DOM inspection, screenshots, page navigation |
| 3 | **Claude Desktop (app)** | **Strategy + Long-form Docs** | Standalone Claude app | Deep reasoning, long context for SDDs |
| 4 | **Xcode Agent** | **iOS + Wallet Specialist** | Xcode IDE on Mac | Swift, .pkpass signing, Apple Developer cert |

> Other agents that historically touched this repo (ChatGPT/Codex `chatgpt/*`, GitHub Copilot SWE bot `copilot-swe-agent[bot]`, Replit Agent) are **legacy**. New work goes to the 4 above.

---

## 1. Domain Ownership Matrix

When in doubt, find your domain → that's your agent. If the work spans domains, route through CTO.

### 1.1 Claude Code (CTO + R&D) — desktop

**Owns:**
- All `server/` (Node/Express backend, routes, services, middleware)
- `shared/` (TypeScript schemas, types shared between client and server)
- `.github/workflows/` (CI/CD, deploy pipelines, security scans)
- `scripts/` (admin scripts, migrations, smoke tests)
- `migrations/` (Drizzle SQL migrations)
- `Dockerfile`, build infrastructure
- Security hardening (auth, RBAC, CSRF, signatures, audit logs)
- All cross-agent PR review and merge coordination

**Sacred (touches only with CEO approval):**
- `server/routes/prestige-pass.ts` — wallet release/refund/adjust money math
- `server/routes/k9000.ts` — physical kiosk runtime
- `server/nayaxFirestoreService.ts` — Nayax integration
- `server/services/tranzila*.ts` — Israeli payment processor
- `shared/schema*.ts` — database schema (any change needs migration approval)

**Branch prefixes:** `hotfix/`, `feat/`, `chore/`, `fix/`, `security/`

---

### 1.2 Claude in Chrome (Creative + Visual Director)

**Owns:**
- All `client/src/pages/` (React pages — homepage, signup, hub, franchise)
- `client/src/components/` (UI components, NOT admin internals)
- `client/public/` (brand assets, images, favicons)
- `client/src/styles/`, Tailwind config, design tokens
- Hebrew + English copy (i18n strings)
- Marketing surfaces, social cards, OG images
- Brand kit application (LVMH-grade luxury aesthetic per platform §0)

**Do NOT touch:**
- `server/` of any kind
- `shared/schema*.ts`
- Authentication / wallet / payment client code (route through CTO)
- CI/CD files

**Branch prefixes:** `creative/`, `design/`, `ui/`, `i18n/`

---

### 1.3 Claude Desktop (Strategy + Long-form Docs)

**Owns:**
- `docs/architecture/` (SDDs, system design)
- `docs/finance/` (compliance docs, Israeli tax notes)
- `docs/legal/` (privacy doctrine, GDPR/Israeli Privacy Law writeups)
- `docs/qa/` (QA specs, watchtower)
- Investor / partner / municipal pitch materials
- Brand strategy long-form (NOT visual design — that's Chrome)

**Do NOT touch:**
- Any code file (`.ts`, `.tsx`, `.js`)
- CI/CD
- Schemas

**Branch prefixes:** `docs/`, `sdd/`, `legal/`, `strategy/`

---

### 1.4 Xcode Agent (iOS + Wallet Specialist)

**Owns:**
- All `ios/` (when it exists) — Swift, SwiftUI, Xcode project
- `.pkpass` template generation (Apple Wallet pass JSON + signing)
- Google Wallet pass JWT generation
- iOS-specific assets (icons, splash screens, App Store screenshots)
- `server/appleWallet.ts` (server-side .pkpass issuance)
- `server/googleWallet.ts` (server-side Google Wallet pass issuance)
- Biometric login (FaceID/TouchID) iOS integration
- Apple Developer certificates + provisioning profiles management
- App Store Connect submissions
- TestFlight builds

**Sacred (touches only with CEO approval):**
- Apple Developer signing keys (NEVER commit, NEVER log)
- App Store Connect API credentials

**Coordinate with CTO on:**
- Any `server/` file change (CTO reviews)
- Adding new npm packages for Wallet (CTO approves)

**Branch prefixes:** `ios/`, `wallet/`, `pkpass/`, `gwallet/`

---

## 2. The PR Flow — Every Agent

```
Agent finishes work
       ↓
Opens PR with correct branch prefix
       ↓
Tags @petwashglobal/cto-review (CTO is the gatekeeper)
       ↓
CTO reviews against:
  • Platform skill rules (.claude/skills/petwash-platform/SKILL.md)
  • Domain ownership (this doc)
  • LVMH brand pillar (platform skill §0)
  • Security boundaries
       ↓
CTO either: approves → merge | requests changes | escalates to CEO
       ↓
Merge to main → CI deploys → CTO verifies live
```

**No agent merges its own PR.** Even the CTO requires CEO acknowledgment for high-risk PRs.

---

## 3. Collision Prevention Rules

### Rule 1: Branch prefix matches your role
- Wrong prefix = PR rejected at review
- Forces every agent to declare intent before pushing

### Rule 2: One purpose per PR
- No mixed-domain PRs (UI fix + server fix = two PRs)
- Smaller PRs review faster and rollback cleaner

### Rule 3: Read before writing
- Mandatory reads before any work:
  1. `.claude/skills/petwash-platform/SKILL.md`
  2. `.claude/skills/petwash-ui-ux/SKILL.md` (UI work only)
  3. This file
- File a "no-go" report if your work would violate any of them

### Rule 4: Out-of-domain finds → file, don't fix
- If Chrome Claude finds a server bug while doing UI work → opens an issue → does NOT fix
- If Xcode Agent finds a security issue while doing iOS work → opens an issue → does NOT fix
- Only the domain owner fixes domain bugs

### Rule 5: No agent touches secrets
- Never log a secret
- Never commit a secret
- If you see a secret in a file, flag it and stop

---

## 4. Real Example — Apple Wallet Pass Launch

This is how the 4 agents would coordinate on shipping Apple Wallet + Google Wallet to live users:

| Step | Agent | Output |
|---|---|---|
| 1 | **Desktop Claude** | SDD: `docs/architecture/wallet-pass-lifecycle.md` — pass states, fraud model, redemption flow |
| 2 | **Chrome Claude** | Design: 3 pass variants (black/platinum/gold) in client/public/ + "Add to Wallet" CTA on `/prestige-pass` page |
| 3 | **Xcode Agent** | Backend: `server/appleWallet.ts` + `server/googleWallet.ts` — pass issuance with proper certificate signing |
| 4 | **CTO (me)** | Review all 3 PRs in order: SDD → backend → frontend. Wire audit logging on issuance. Verify no money math change. Merge. |
| 5 | **CTO** | Verify post-deploy: pass downloads work on real iPhone Safari. Update `.claude/skills/petwash-platform/SKILL.md` "Last updated" + add to "Merged" list. |

**Total wall-clock time if coordinated:** 1 day. **If uncoordinated:** 1 week of merge conflicts and brand drift.

---

## 5. What the CTO Does That No Other Agent Does

This is the value I add as the coordinator:

1. **Reviews every cross-agent PR** for security, money, K9000, schema, and dependency rules
2. **Keeps `.claude/skills/petwash-platform/SKILL.md` §7 (Merged list) up to date**
3. **Triages CI failures** (like today's PR #498 → #500 cascade — only the CTO can trace the full chain)
4. **Pushes back on CEO when needed** (per platform §0.10 — challenge wrong thinking)
5. **Routes out-of-domain finds** to the right agent
6. **Manages the deploy gate** (no-traffic candidate verification, rollback if needed)

---

## 6. When Things Go Wrong

### Conflict between two agents' work
1. CTO compares both PRs
2. Identifies which is more aligned with platform rules
3. Merges the aligned one
4. Re-routes the other agent's intent into a fresh PR after rebase

### Agent goes off-script
- Pushes wrong branch prefix → CTO closes PR, asks agent to re-open under correct prefix
- Touches sacred file → CTO blocks merge, escalates to CEO
- Commits secret → CTO immediately reverts + instructs CEO to rotate

### Production breaks
- CTO triages first (deploy gate, smoke tests, post-deploy probe)
- If CTO domain → CTO fixes
- If another agent's domain → CTO opens issue + tags owner, fixes in parallel only if customer-facing emergency

---

## 7. Updating This Document

This doc itself is **CTO-owned**. Other agents propose changes via PR; CTO merges after CEO acknowledgment.

Update protocol:
1. New agent joins the team → add to §0 and create domain row
2. New module added → assign owner in §1
3. New cross-agent collaboration pattern → add to §4

**Last review:** 2026-05-29 by Claude Code (CTO)
**Next review:** When the 5th agent joins, OR quarterly, whichever comes first.
