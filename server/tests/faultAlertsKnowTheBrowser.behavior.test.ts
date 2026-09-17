import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 2026-09-17: three critical removeChild/insertBefore alerts could not be
 * triaged from the Alerts Center — the alert never stored the browser. The
 * server logs proved they were a Playwright iPhone emulation (0 real users),
 * but nobody should need Cloud Logging for that. Alerts now carry the
 * browser; automated browsers are recorded as warnings and page no one;
 * a real customer's crash stays critical.
 */
const created: any[] = [];
const sent: any[] = [];
vi.mock('../services/AlertEngine', () => ({ createOrUpdateAlert: vi.fn(async (a: any) => { created.push(a); }) }));
vi.mock('../monitoring', () => ({ sendAlert: vi.fn(async (a: any) => { sent.push(a); }) }));
vi.mock('./logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('../lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const REAL_IOS26 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const REAL_IOS17 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const REAL_CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1';
const REAL_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const PLAYWRIGHT_IPHONE13 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const HEADLESS = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36';

describe('isAutomatedUserAgent', () => {
  it('never marks a real customer browser as automated — including iOS 26 with its frozen "18_6" token', async () => {
    const { isAutomatedUserAgent } = await import('../lib/faultReporter');
    for (const ua of [REAL_IOS26, REAL_IOS17, REAL_CHROME_IOS, REAL_ANDROID, '', undefined]) {
      expect(isAutomatedUserAgent(ua)).toBe(false);
    }
  });
  it('recognises Playwright iPhone emulation and headless browsers', async () => {
    const { isAutomatedUserAgent } = await import('../lib/faultReporter');
    expect(isAutomatedUserAgent(PLAYWRIGHT_IPHONE13)).toBe(true);
    expect(isAutomatedUserAgent(HEADLESS)).toBe(true);
  });
});

describe('reportFault', () => {
  beforeEach(() => { created.length = 0; sent.length = 0; vi.spyOn(console, 'error').mockImplementation(() => {}); });

  it('a real customer crash is critical, pages, and records the browser', async () => {
    const { reportFault } = await import('../lib/faultReporter');
    await reportFault(new Error('real crash A'), { source: 'client:AppErrorBoundary', url: '/contact', userAgent: REAL_IOS26 });
    expect(created[0]).toMatchObject({ severity: 'critical', metadata: { userAgent: REAL_IOS26, automated: false } });
    expect(created[0].message).toContain('Browser: ' + REAL_IOS26);
    expect(sent).toHaveLength(1);
  });

  it('an automated browser is recorded as a warning under its own key and pages no one', async () => {
    const { reportFault } = await import('../lib/faultReporter');
    await reportFault(new Error('sweep crash B'), { source: 'client:AppErrorBoundary', url: '/contact', userAgent: PLAYWRIGHT_IPHONE13 });
    await reportFault(new Error('sweep crash C'), { source: 'client:AppErrorBoundary', url: '/contact', userAgent: REAL_ANDROID, automated: true });
    expect(created.map((a) => a.severity)).toEqual(['warning', 'warning']);
    expect(created.every((a) => a.dedupeKey.endsWith(':automated'))).toBe(true);
    expect(created[0].message.startsWith('[automated browser] ')).toBe(true);
    expect(sent).toHaveLength(0);
  });
});

describe('visitor-side faults', () => {
  beforeEach(() => { created.length = 0; sent.length = 0; vi.spyOn(console, 'error').mockImplementation(() => {}); });
  it('severity warning records the alert but pages no one', async () => {
    const { reportFault } = await import('../lib/faultReporter');
    await reportFault(new Error('Turnstile LOAD_FAILED'), { source: 'client:app', userAgent: REAL_ANDROID, severity: 'warning' });
    expect(created[0]).toMatchObject({ severity: 'warning' });
    expect(created[0].dedupeKey.endsWith(':automated')).toBe(false);
    expect(sent).toHaveLength(0);
  });
  it('Turnstile client failures are routed as warnings', () => {
    const src = readFileSync(resolve(__dirname, '..', 'routes.ts'), 'utf8');
    expect(src).toContain("severity: errorReport?.source === 'turnstile-client' ? 'warning' : undefined,");
  });
});

describe('wiring', () => {
  it('the log endpoint passes the request UA and the client webdriver flag', () => {
    const src = readFileSync(resolve(__dirname, '..', 'routes.ts'), 'utf8');
    expect(src).toContain("userAgent: String(req.headers['user-agent'] || errorReport?.userAgent || '') || undefined,");
    expect(src).toContain('automated: errorReport?.webdriver === true,');
  });
  it('the error boundary reports navigator.webdriver', () => {
    const src = readFileSync(resolve(__dirname, '..', '..', 'client/src/components/AppErrorBoundary.tsx'), 'utf8');
    expect(src).toContain('webdriver: typeof navigator !== "undefined" && navigator.webdriver === true,');
  });
});
