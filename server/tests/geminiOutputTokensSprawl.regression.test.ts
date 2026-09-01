/**
 * Regression pin — P0-AUDIT-AI-6 (task #201).
 *
 * Every direct `genAI.models.generateContent(...)` or `models.generateContent(...)`
 * call in server/{services,routes,lib} MUST carry a `maxOutputTokens`
 * cap OR go through safeGenerate (which now enforces a default).
 * A new call-site that forgets the cap turns into open-ended
 * pay-per-token — the exact hole the audit found.
 *
 * The pin is intentionally permissive on shape: any `maxOutputTokens`
 * inside the same call expression counts (it may live in `config: {}`
 * or at the top level, depending on the SDK version the caller uses).
 * The pin only refuses call-sites with NO cap ANYWHERE.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVER_ROOT = path.resolve(__dirname, '..');

function walkNarrow(dirs: string[]): string[] {
  const out: string[] = [];
  const stack = [...dirs];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'tests' || e.name === '__tests__') continue;
      const p = path.join(cur, e.name);
      if (e.isDirectory()) { stack.push(p); continue; }
      if (e.isFile() && p.endsWith('.ts')) out.push(p);
    }
  }
  return out;
}

const FILES = walkNarrow([
  path.join(SERVER_ROOT, 'services'),
  path.join(SERVER_ROOT, 'routes'),
  path.join(SERVER_ROOT, 'lib'),
]);

/**
 * Locate every direct generateContent(...) call and test whether the
 * matching balanced-parens argument block contains `maxOutputTokens`
 * anywhere within it. Bounded and simple — we don't need a full JS
 * parser to catch the class of regression we care about.
 */
function unboundedCallSites(src: string): Array<{ line: number; snippet: string }> {
  const offenders: Array<{ line: number; snippet: string }> = [];
  const rx = /generateContent\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src)) !== null) {
    // Walk from the '(' to the matching ')' with a depth counter.
    let depth = 1;
    let i = m.index + m[0].length;
    let end = -1;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) { end = i; break; } }
      i++;
    }
    if (end < 0) continue;
    const args = src.slice(m.index, end + 1);
    if (args.includes('maxOutputTokens')) continue;
    const line = src.slice(0, m.index).split('\n').length;
    const snippet = args.slice(0, 80).replace(/\s+/g, ' ');
    offenders.push({ line, snippet });
  }
  return offenders;
}

/**
 * KNOWN_LEGACY — pre-existing uncapped generateContent call-sites
 * from the audit inventory. Frozen so the pin catches only NEW
 * regressions. Removing an entry from this list requires the site
 * to have been either (a) migrated to safeGenerate (which now
 * enforces the default cap) OR (b) given an explicit
 * maxOutputTokens in its config. Never add a new entry here to
 * silence CI — fix the call-site instead.
 *
 * Format: `${relPath}:${lineNumber}` — pinned to the exact line so
 * an accidental duplicate that lands on a different line still trips.
 */
const KNOWN_LEGACY: ReadonlySet<string> = new Set([
  // Documented in P0-AUDIT-AI-6 audit report; tracked in follow-ups
  // #198, #199, #200, #204, #205, #206, #207 + a per-service cleanup
  // lane. Whitelist by FILE (not line) so a small line-shift inside
  // one of these files doesn't trip CI — the sprawl guarantee is
  // NEW FILES / NEW ROUTES may not add uncapped calls; existing files
  // are migrated on their own schedule.
  'gemini.ts',
  'services/GeminiAI.ts',
  'services/GeminiConsoleService.ts',
  'services/GeminiUpdateAdvisor.ts',
  'services/PawFinderModerationService.ts',
  'services/AIPayoutVerificationService.ts',
  'services/BookingExportService.ts',
  'services/ContentModerationService.ts',
  'services/GeminiEmailMonitor.ts',
  'services/GeminiMatchingService.ts',
  'services/GeminiPlatformSecurityMonitor.ts',
  'services/GeminiSecurityAdvisor.ts',
  'services/GeminiSpamGuard.ts',
  'services/GeminiWatchdogService.ts',
  'services/ManagementAnalyticsService.ts',
  'services/PersonalizedGreetingService.ts',
  'services/PetIdentificationService.ts',
  'services/ProductionWebsiteMonitorService.ts',
  'services/ReceiptFraudDetection.ts',
  'services/SitterAITriageService.ts',
  'services/SmartEnvironmentService.ts',
  'services/geminiTranslation.ts',
  'services/giftOrchestrationService.ts',
  'services/smartWeatherAdvisor.ts',
  'routes/admin.ts',
  'routes/avatars.ts',
  'routes/booking-chat.ts',
  'routes/franchise.ts',
  'routes/loyalty.ts',
  'routes/weather.ts',
  'routes/daycare-calculator.ts',
  'routes/prestige-pass.ts',
  'routes/provider-console.ts',
  'routes/ai-booking.ts',
  'routes.ts',
]);

function isLegacy(rel: string, line: number): boolean {
  if (KNOWN_LEGACY.has(rel)) return true;
  if (KNOWN_LEGACY.has(`${rel}:${line}`)) return true;
  return false;
}

describe('Gemini generateContent — maxOutputTokens sprawl pin (task #201)', () => {
  it('every NEW direct generateContent(...) call carries maxOutputTokens (or lives in KNOWN_LEGACY)', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      if (f.endsWith('geminiOutputTokensSprawl.regression.test.ts')) continue;
      let src: string;
      try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
      if (!src.includes('generateContent')) continue;
      const rel = path.relative(SERVER_ROOT, f);
      for (const site of unboundedCallSites(src)) {
        if (isLegacy(rel, site.line)) continue;
        offenders.push(`${rel}:${site.line}  ${site.snippet}`);
      }
    }
    expect(
      offenders,
      `new uncapped generateContent call-sites (must set maxOutputTokens or route via safeGenerate):\n  - ${offenders.join('\n  - ')}`,
    ).toEqual([]);
  });
});
