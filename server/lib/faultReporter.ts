/**
 * faultReporter.ts — make the platform SELF-AWARE of runtime faults.
 *
 * The observability pieces already existed but were dark: Sentry no-ops without a
 * DSN, and the global error handler only logged locally — so a prod crash/5xx
 * alerted no one (which is why the CEO found the spinning app + dead buttons, not
 * the system). This central reporter wires fault → capture → record → alert.
 *
 * On any caught server fault, reportFault():
 *   1. Emits a GCP Error Reporting-formatted ERROR log. Cloud Run's Error
 *      Reporting auto-ingests structured logs carrying the ReportedErrorEvent
 *      @type + a stack trace, grouping by signature and surfacing the exact
 *      file:line ("the line of fault"). No new dependency, no vendor, no secret.
 *   2. Records a deduped admin_alert (category 'system') → shows in the Alerts
 *      Center + Octopus Control Tower so faults are visible, not buried in logs.
 *   3. Alerts Nir + Ido (email REPORTS_EMAIL_TO + Slack), rate-limited per fault
 *      signature so a storm can't spam.
 *
 * Fully GUARDED: every step is try/caught and it NEVER throws, so the caller's
 * response/exit path is unaffected. Advisory only — it reports + pinpoints; humans
 * (or an approved fix task) apply the patch (no unattended prod auto-fix).
 */

import { logger } from './logger';
import { createOrUpdateAlert } from '../services/AlertEngine';
import { sendAlert } from '../monitoring';

/** First app (non-node_modules) stack frame → the file:line of the fault. */
function firstAppFrame(stack?: string): string {
  if (!stack) return 'unknown';
  const lines = stack.split('\n');
  const appLine = lines.find(
    (l) => /\/(server|client|shared)\//.test(l) && !/node_modules/.test(l),
  );
  return (appLine || lines[1] || lines[0] || '').trim().slice(0, 200);
}

export interface FaultContext {
  /** Where it was caught: 'express' | 'uncaughtException' | 'unhandledRejection' | a job name */
  source: string;
  method?: string;
  url?: string;
  traceId?: string;
  statusCode?: number;
  /** First app frame of the React componentStack (client faults) — the alert was anonymous without it. */
  component?: string;
  /** Browser identity of a client fault. Without it an alert could not be told apart from a test sweep. */
  userAgent?: string;
  /** Client reported navigator.webdriver, or the UA is a known automation/headless browser. */
  automated?: boolean;
  /**
   * 'warning' for faults that happen on the visitor's side and do not mean our
   * code is broken (a third-party script their network or ad-blocker refused).
   * Recorded and visible, never paged. Default: critical.
   */
  severity?: 'critical' | 'warning';
}

/**
 * Automation that is NOT a customer: our own Playwright/Puppeteer sweeps,
 * headless Chrome, Lighthouse, crawlers — and Playwright's iPhone emulation.
 *
 * The iPhone rule is deliberately narrow. Real Safari on iOS 26+ FREEZES the
 * OS token at "iPhone OS 18_6" while reporting "Version/26.x" (WebKit, Safari
 * 26.0 release notes), so a big OS/Safari gap alone is a real customer. What
 * no real iPhone can send is Safari 26+ with an OS token BELOW 18 — Safari 26
 * only ships with iOS 26. Playwright's devices['iPhone 13'] sends exactly that
 * ("iPhone OS 15_0 … Version/26.0"): 2026-09-13, 8 critical alerts, 0 real users.
 */
export function isAutomatedUserAgent(ua?: string | null): boolean {
  if (!ua) return false;
  if (/HeadlessChrome|Playwright|Puppeteer|Chrome-Lighthouse|\bLighthouse\b|Googlebot|bingbot|\bbot\b|crawler|spider/i.test(ua)) return true;
  const ios = ua.match(/iPhone OS (\d+)_/);
  const safari = ua.match(/Version\/(\d+)(?:\.\d+)* Mobile\/\S+ Safari\//);
  if (ios && safari && Number(safari[1]) >= 26 && Number(ios[1]) < 18) return true;
  return false;
}

// Per-signature throttle so a fault storm doesn't flood email/Slack (the GCP
// Error Reporting log + admin_alert dedupe still capture every occurrence).
const lastAlertedAt: Record<string, number> = {};
const ALERT_THROTTLE_MS = 10 * 60 * 1000; // 10 min per signature

export async function reportFault(err: unknown, ctx: FaultContext): Promise<void> {
  const e =
    err instanceof Error
      ? err
      : new Error(typeof err === 'string' ? err : (() => { try { return JSON.stringify(err); } catch { return String(err); } })());
  const faultLine = firstAppFrame(e.stack);
  const dedupeKey = `fault:${ctx.source}:${e.name}:${ctx.component || faultLine}`.slice(0, 200);

  // 1. GCP Error Reporting (Cloud Run auto-captures this structured ERROR log).
  try {
    console.error(
      JSON.stringify({
        severity: 'ERROR',
        '@type': 'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
        message: e.stack || `${e.name}: ${e.message}`,
        context: {
          source: ctx.source,
          httpRequest: ctx.url ? { method: ctx.method, url: ctx.url } : undefined,
          traceId: ctx.traceId,
          faultLine,
          component: ctx.component,
        },
      }),
    );
  } catch {
    /* logging must never throw */
  }

  // Automated traffic is recorded (never hidden) but does not page anyone:
  // a separate dedupe key so a test sweep can't hold open — or close — the
  // alert for the same fault in a real customer's browser.
  const automated = ctx.automated === true || isAutomatedUserAgent(ctx.userAgent);
  const alertKey = automated ? `${dedupeKey}:automated`.slice(0, 200) : dedupeKey;
  const quiet = automated || ctx.severity === 'warning';

  // 2. Record (deduped) → Alerts Center / Octopus Control Tower.
  try {
    await createOrUpdateAlert({
      dedupeKey: alertKey,
      category: 'system',
      severity: quiet ? 'warning' : 'critical',
      title: `${e.name}: ${(e.message || 'fault').slice(0, 120)}`,
      message: `${automated ? '[automated browser] ' : ''}${ctx.source}${ctx.url ? ` · ${ctx.method} ${ctx.url}` : ''}${ctx.component ? `\nComponent: ${ctx.component}` : ''}\nLine of fault: ${faultLine}${ctx.userAgent ? `\nBrowser: ${ctx.userAgent.slice(0, 200)}` : ''}`,
      source: 'fault_reporter',
      metadata: {
        faultLine,
        component: ctx.component,
        traceId: ctx.traceId,
        statusCode: ctx.statusCode,
        userAgent: ctx.userAgent?.slice(0, 300),
        automated,
        stack: (e.stack || '').slice(0, 2000),
      },
    });
  } catch (recErr) {
    logger.warn('[faultReporter] alert record failed (non-blocking)', { err: (recErr as Error)?.message });
  }

  // 3. Alert Nir + Ido (throttled per signature).
  try {
    const now = Date.now();
    if (!quiet && (!lastAlertedAt[dedupeKey] || now - lastAlertedAt[dedupeKey] > ALERT_THROTTLE_MS)) {
      lastAlertedAt[dedupeKey] = now;
      await sendAlert({
        type: 'system_error',
        severity: 'critical',
        message: `Fault in ${ctx.source}: ${e.name}: ${(e.message || '').slice(0, 160)}`,
        details: `${ctx.component ? `Component: ${ctx.component}\n` : ''}Line of fault: ${faultLine}\n${ctx.url ? `${ctx.method} ${ctx.url}\n` : ''}${ctx.userAgent ? `Browser: ${ctx.userAgent.slice(0, 200)}\n` : ''}traceId: ${ctx.traceId || '-'}\n\n${(e.stack || '').slice(0, 1500)}`,
      });
    }
  } catch (alErr) {
    logger.warn('[faultReporter] alert send failed (non-blocking)', { err: (alErr as Error)?.message });
  }
}
