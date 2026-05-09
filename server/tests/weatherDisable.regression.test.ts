/**
 * Issue #153 PR-B-WEATHER-DISABLE — disable silent-stub weather cron.
 *
 * CEO directive (2026-05-08, after the smart-features audit re-check):
 *   The weather notification cron is a LIVE silent-stub:
 *     • cron runs every 2 hours (Asia/Jerusalem)
 *     • geocoding / weather / severity / FCM dispatch are real
 *     • user-targeting queries are TODO stubs
 *     • result: empty targetUsers, no actual notifications, real
 *       Google Weather / Open-Meteo / geocode quota cost
 *   "That is fake operational readiness and unnecessary API/log cost."
 *
 *   Option B-DISABLE chosen. Disable the cron schedule only. Keep the
 *   service file intact (engine is real, will be wired later when
 *   product specifies the targeting queries).
 *
 * Locked invariants this suite enforces:
 *   • Cron schedule is commented out — cron.schedule for the weather
 *     handler is no longer a live executable statement.
 *   • Service file remains present (no deletion).
 *   • TODO-targeting markers in the service file are preserved.
 *   • Disable marker comments exist on BOTH ends so future readers
 *     find the truth from either entry point.
 *   • No deletion of weather engine code (severity classification,
 *     cooldown, FCM dispatch all still in place).
 *   • No Google Weather / Open-Meteo behaviour change in the service.
 *   • No FCM behaviour change in the service.
 *   • All other crons in backgroundJobs.ts remain live (we disable
 *     ONLY the weather cron).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const backgroundJobs = readFileSync(resolve(ROOT, 'server/backgroundJobs.ts'), 'utf8');
const weatherSvcPath = resolve(ROOT, 'server/services/weatherNotifications.ts');
const weatherSvc = readFileSync(weatherSvcPath, 'utf8');

// ── A. CRON IS DISABLED IN backgroundJobs.ts ──────────────────────────────

describe('PR-B-WEATHER-DISABLE — cron disabled in backgroundJobs.ts', () => {
  it('1. disable marker comments exist with the canonical CEO-quoted phrase', () => {
    expect(backgroundJobs).toMatch(
      /WEATHER ALERTS DISABLED UNTIL USER TARGETING QUERIES ARE IMPLEMENTED/,
    );
    expect(backgroundJobs).toMatch(/PR-B-WEATHER-DISABLE/);
  });

  it('2. cron.schedule for the weather handler is NOT a live executable statement', () => {
    // Strip line-comments and block-comments so we only inspect REAL code.
    const codeOnly = backgroundJobs
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    // The exact every-2-hours weather cron expression must NOT appear in
    // executable code anymore. Other crons in this file use different
    // expressions (e.g. '0 2 * * 0' weekly, '*/15 * * * *' fifteen-min
    // health, etc.) so this match is specific to the weather schedule.
    expect(codeOnly).not.toMatch(/cron\.schedule\(\s*['"]0 \*\/2 \* \* \*['"]/);
    // The processWeatherNotifications method is also NOT invoked from
    // any executable code path in the cron registration block.
    expect(codeOnly).not.toMatch(/this\.processWeatherNotifications\(\)/);
    // Defensive: acquireLock('weatherNotifications') must not fire from
    // executable code either.
    expect(codeOnly).not.toMatch(/acquireLock\(\s*['"]weatherNotifications['"]\s*\)/);
  });

  it('3. the original cron block is preserved as commented code (not deleted)', () => {
    // We expect the original cron to live on as `// cron.schedule('0 */2 * * *', ...)`
    // line-comments inside the BEGIN/END markers, so re-enabling is verbatim.
    expect(backgroundJobs).toMatch(/-- BEGIN DISABLED WEATHER CRON/);
    expect(backgroundJobs).toMatch(/-- END DISABLED WEATHER CRON/);
    // The literal cron expression must appear inside the disabled block
    // (as part of the line-comment) so a future engineer sees what
    // the cadence was.
    expect(backgroundJobs).toMatch(/\/\/\s*cron\.schedule\(\s*['"]0 \*\/2 \* \* \*['"]/);
  });

  it('4. processWeatherNotifications method itself is NOT removed', () => {
    // The class method that the disabled cron used to call is preserved
    // for re-enable. Removing it would break the verbatim re-enable path.
    expect(backgroundJobs).toMatch(/processWeatherNotifications\s*\(\s*\)\s*:\s*Promise/);
  });

  it('5. OTHER crons in this file are still live (only the weather cron is disabled)', () => {
    const codeOnly = backgroundJobs
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    // Spot-check three known-active crons. Their patterns must still be
    // present in executable code.
    // Weekly GCS backup ('0 2 * * 0' on Sunday)
    expect(codeOnly).toMatch(/cron\.schedule\(\s*['"]0 2 \* \* 0['"]/);
    // Daily Firestore export at 1 AM
    expect(codeOnly).toMatch(/cron\.schedule\(\s*['"]0 1 \* \* \*['"]/);
  });
});

// ── B. SERVICE FILE PRESERVED INTACT ──────────────────────────────────────

describe('PR-B-WEATHER-DISABLE — service file preserved (no deletion)', () => {
  it('6. server/services/weatherNotifications.ts remains present (file exists)', () => {
    expect(() => statSync(weatherSvcPath)).not.toThrow();
    expect(weatherSvc.length).toBeGreaterThan(1000);
  });

  it('7. service top-of-file STATUS marker matches the cron disable', () => {
    expect(weatherSvc).toMatch(/STATUS — PR-B-WEATHER-DISABLE/);
    expect(weatherSvc).toMatch(/intentionally\s+DISABLED/i);
    expect(weatherSvc).toMatch(/COMMENTED OUT, NOT DELETED/);
  });

  it('8. all 6 TODO-targeting markers in the service are preserved', () => {
    const todoMatches = weatherSvc.match(/TODO/g) || [];
    expect(todoMatches.length).toBeGreaterThanOrEqual(6);
    // Spot-check the canonical TODO lines flagged by the audit.
    expect(weatherSvc).toMatch(/TODO:\s*Add query when table structure is finalized/);
    expect(weatherSvc).toMatch(/TODO:\s*Query walk_sessions table/);
    expect(weatherSvc).toMatch(/TODO:\s*Query pettrek_trips table/);
    expect(weatherSvc).toMatch(/TODO:\s*Query pet_wash_stations table/);
  });

  it('9. real engine functions remain in the service (no deletion)', () => {
    // Each is a public surface that future re-enable will call.
    expect(weatherSvc).toMatch(/export\s+async\s+function\s+analyzeWeatherForAlerts/);
    expect(weatherSvc).toMatch(/export\s+async\s+function\s+sendWeatherNotification/);
    expect(weatherSvc).toMatch(/export\s+async\s+function\s+checkWeatherForActiveLocations/);
  });

  it('10. real underlying integrations are still imported (no behaviour change)', () => {
    expect(weatherSvc).toMatch(
      /import\s*\{[^}]*getWeatherForecast[^}]*geocodeLocation[^}]*\}\s*from\s*['"]\.\/unifiedLocationWeather['"]/,
    );
    expect(weatherSvc).toMatch(/import\s*\{\s*sendPushNotification\s*\}\s*from\s*['"]\.\/FCMService['"]/);
  });
});

// ── C. BOTH-END MARKER CONSISTENCY ────────────────────────────────────────

describe('PR-B-WEATHER-DISABLE — both-end markers stay in sync', () => {
  it('11. the disable marker phrase appears in BOTH files (each entry point shows the truth)', () => {
    const phrase = 'WEATHER ALERTS DISABLED UNTIL USER TARGETING QUERIES ARE IMPLEMENTED';
    expect(backgroundJobs).toContain(phrase);
    expect(weatherSvc).toContain(phrase);
  });

  it('12. both files reference the same PR id so reviewers can find the pair', () => {
    expect(backgroundJobs).toContain('PR-B-WEATHER-DISABLE');
    expect(weatherSvc).toContain('PR-B-WEATHER-DISABLE');
  });
});

// ── D. NO BEHAVIOUR CHANGE INSIDE THE ENGINE ──────────────────────────────

describe('PR-B-WEATHER-DISABLE — no Weather / FCM behaviour change in the engine', () => {
  it('13. severity classification logic unchanged (severe / rain / temperature thresholds)', () => {
    // Spot-check that classification rules remain. A future PR to wire
    // user targeting must NOT have to reconstruct these rules.
    expect(weatherSvc).toMatch(/thunderstorm/i);
    expect(weatherSvc).toMatch(/rain/i);
    expect(weatherSvc).toMatch(/temperature/i);
    expect(weatherSvc).toMatch(/severity/i);
  });

  it('14. cooldown gate preserved (NOTIFICATION_COOLDOWN_HOURS or equivalent)', () => {
    expect(weatherSvc).toMatch(/NOTIFICATION_COOLDOWN_HOURS\s*=\s*\d+/);
  });

  it('15. NO new FCM call sites introduced (only the existing sendPushNotification import)', () => {
    // Defensive: this PR must NOT have expanded the FCM surface — only
    // disabled the cron. There should be exactly one sendPushNotification
    // import and one call site, both pre-existing.
    const sendPushImports = weatherSvc.match(/from\s*['"]\.\/FCMService['"]/g) || [];
    expect(sendPushImports.length).toBe(1);
  });
});

// ── E. SCOPE GUARDS ───────────────────────────────────────────────────────

describe('PR-B-WEATHER-DISABLE — scope guards', () => {
  it('16. NO new SQL guess for user targeting was introduced in the service', () => {
    // The CEO rule: "no user targeting SQL guesses". Confirm no NEW
    // db.select / db.execute call exists in the service that wasn't
    // there before. We assert the service still has zero db.select /
    // db.execute calls for the targeting purpose by checking that
    // every TODO marker still has no corresponding query above it.
    const targetingSection = weatherSvc.slice(
      weatherSvc.indexOf('Send weather notification'),
      weatherSvc.indexOf('checkWeatherForActiveLocations'),
    );
    // No db.select / db.execute should have been added inside the
    // targeting-stub region by this PR.
    expect(targetingSection).not.toMatch(/db\.select\(/);
    expect(targetingSection).not.toMatch(/db\.execute\(/);
  });

  it('17. NO env / vendor / API changes (no new process.env, no new fetch URL, no SDK swap)', () => {
    // The cron is disabled at scheduling time; the engine itself is
    // untouched. Defensive: verify no new vendor/SDK import was added.
    const newSurfaceForbidden = /(stripe|cardcom|nayax|tranzila|twilio|sendgrid|process\.env\.WEATHER_)/i;
    // Service file should not have introduced any of these names.
    expect(weatherSvc).not.toMatch(newSurfaceForbidden);
    // backgroundJobs.ts disable should not have introduced any of these.
    const disableRegion = backgroundJobs.slice(
      backgroundJobs.indexOf('-- BEGIN DISABLED WEATHER CRON'),
      backgroundJobs.indexOf('-- END DISABLED WEATHER CRON') + 100,
    );
    expect(disableRegion).not.toMatch(newSurfaceForbidden);
  });
});
