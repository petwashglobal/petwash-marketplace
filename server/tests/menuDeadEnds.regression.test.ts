/**
 * Menu dead ends — regression pins (2026-09-13).
 *
 * Every page below is reachable from the hamburger menu and was, on main,
 * either a dead end (nothing to click, or a click that went nowhere) or a
 * surface stating something nobody measured. Each pin reads the source and
 * fails if the specific defect returns. The franchise inquiry fix is pinned by
 * BEHAVIOUR (injected store/email), not by source text.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  handleFranchiseInquiry,
  escapeHtmlForEmail,
  FRANCHISE_INQUIRY_SUPPORT_EMAIL,
} from '../lib/franchiseInquiry';

const ROOT = resolve(__dirname, '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');
/** Strip block + line comments so prose ABOUT a removed defect can't satisfy/trip a pin. */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('1. Hub PetTrek card', () => {
  const src = code('client/src/pages/Hub.tsx');
  it('links to the PetTrek waitlist page, not "#"', () => {
    const block = src.slice(src.indexOf('nameKey: "petTrek"'), src.indexOf('nameKey: "academy"'));
    expect(block).toContain('href: "/pettrek/book"');
    expect(block).not.toContain('href: "#"');
  });
  it('a coming-soon card with a real href is still clickable', () => {
    expect(src).not.toMatch(/onClick=\{platform\.comingSoon \? undefined/);
    expect(src).toMatch(/onClick=\{platform\.href && platform\.href !== "#" \? \(\) => setLocation\(platform\.href\)/);
  });
  it('/pettrek/book is a registered route', () => {
    expect(read('client/src/App.tsx')).toMatch(/<Route path="\/pettrek\/book">/);
  });
});

describe('2. /map goes straight to the station list', () => {
  const src = code('client/src/pages/StationMap.tsx');
  it('redirects to /locations', () => {
    expect(src).toMatch(/<Redirect to="\/locations"/);
  });
  it('the "coming soon" placeholder is gone', () => {
    expect(src).not.toMatch(/Coming Soon|בקרוב/);
  });
});

describe('3. /status shows only what is measured', () => {
  const src = code('client/src/pages/SystemStatus.tsx');
  it('reads the real public health endpoint', () => {
    expect(src).toMatch(/fetch\('\/api\/health'/);
    expect(read('server/index.ts')).toMatch(/app\.get\('\/api\/health', async/);
  });
  it('no hard-coded per-service "operational" rows, no fabricated incident history', () => {
    expect(src).not.toMatch(/status: "operational"/);
    expect(src).not.toMatch(/Payment Gateway/);
    expect(src).not.toMatch(/No incidents reported/);
    expect(src).not.toMatch(/All Systems Operational/);
  });
  it('unmeasured services are labelled, and copy is Hebrew-first via the app language store', () => {
    expect(src).toMatch(/not_monitored/);
    expect(src).toMatch(/לא מנוטר בעמוד זה/);
    expect(src).toMatch(/useLanguage\(\)/);
  });
});

describe('4. /support renders a real FAQ', () => {
  const src = code('client/src/pages/Support.tsx');
  it('the coming-soon badge is gone', () => {
    expect(src).not.toMatch(/badge-faq-coming-soon/);
    expect(src).not.toMatch(/faqComingSoon/);
  });
  it('renders the existing reviewed K9000 FAQ through the shared accordion', () => {
    expect(src).toMatch(/<SeoFaqSection faq=\{K9000_FAQ\}/);
    expect(read('client/src/content/k9000Faq.ts')).toMatch(/export const K9000_FAQ/);
    // /k9000 uses the same single source — no second copy.
    expect(read('client/src/pages/k9000/Overview.tsx')).toMatch(/from "@\/content\/k9000Faq"/);
    expect(read('client/src/pages/k9000/Overview.tsx')).not.toMatch(/const K9000_FAQ/);
  });
  it('keeps the search → /contact hand-off', () => {
    expect(src).toMatch(/setLocation\(`\/contact\?message=\$\{encodeURIComponent\(question\)\}`\)/);
  });
});

describe('5. Academy list — no unbacked verification claims', () => {
  const src = code('client/src/pages/Academy.tsx');
  it('no hard-coded "100%" certified stat', () => {
    expect(src).not.toMatch(/>\s*100%\s*</);
    expect(src).not.toMatch(/Certified & Verified/);
    expect(src).toMatch(/filteredTrainers\.filter\(\(tr\) => tr\.isCertified\)\.length/);
  });
  it('no "background-checked" claim', () => {
    expect(src).not.toMatch(/background-checked/i);
  });
  it('trainer card link resolves to a registered route', () => {
    const app = read('client/src/App.tsx');
    const m = src.match(/<Link href=\{`\/academy\/(trainers?)\/\$\{trainer\.id\}`\}>/);
    expect(m).not.toBeNull();
    const seg = m![1];
    expect(app).toMatch(new RegExp(`<Route path="/academy/${seg}/:[A-Za-z]+">`));
  });
});

describe('6. Academy booking — members-only 403 offers a way to join', () => {
  const src = code('client/src/pages/academy/BookingFlow.tsx');
  it('the membership toast carries a join action to /loyalty with returnTo', () => {
    const i = src.indexOf('נדרשת חברות במועדון');
    expect(i).toBeGreaterThan(-1);
    const block = src.slice(i - 400, i + 700);
    expect(block).toMatch(/\/loyalty\$\{buildReturnToParam\(/);
    expect(block).toMatch(/<ToastAction/);
    expect(block).toMatch(/setLocation\(joinHref\)/);
  });
});

describe('7. /api/franchise/inquiry — honest on store failure, notifies support (behaviour)', () => {
  const body = {
    fullName: '<img src=x onerror=alert(1)>',
    email: 'lead@example.com',
    phone: '+972500000000',
    country: 'IL',
    city: 'Kfar "Saba"',
    message: "<script>alert('x')</script>",
  };
  const log = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

  it('store failure → 503, success NOT claimed, no email sent', async () => {
    const sendEmail = vi.fn(async () => true);
    const r = await handleFranchiseInquiry(body, {
      store: async () => { throw new Error('firestore down'); },
      sendEmail,
      log: log(),
    });
    expect(r.status).toBe(503);
    expect(r.body.success).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('stored → 200 and support is emailed with every user field HTML-escaped', async () => {
    const sendEmail = vi.fn(async (_p: { to: string; subject: string; html: string }) => true);
    const store = vi.fn(async () => 'doc123');
    const r = await handleFranchiseInquiry(body, { store, sendEmail, log: log() });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(store).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const sent = sendEmail.mock.calls[0][0];
    expect(sent.to).toBe(FRANCHISE_INQUIRY_SUPPORT_EMAIL);
    expect(sent.html).not.toContain('<img');
    expect(sent.html).not.toContain('<script>');
    expect(sent.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(sent.html).toContain('&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;');
    expect(sent.html).toContain('Kfar &quot;Saba&quot;');
  });

  it('email failure is fail-soft: the stored inquiry still answers 200', async () => {
    const l = log();
    const r1 = await handleFranchiseInquiry(body, { store: async () => 'a', sendEmail: async () => false, log: l });
    const r2 = await handleFranchiseInquiry(body, {
      store: async () => 'b',
      sendEmail: async () => { throw new Error('smtp'); },
      log: l,
    });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(l.warn).toHaveBeenCalledTimes(2);
  });

  it('missing required fields → 400 and nothing stored', async () => {
    const store = vi.fn(async () => 'x');
    const r = await handleFranchiseInquiry({ fullName: 'A' }, { store, sendEmail: async () => true, log: log() });
    expect(r.status).toBe(400);
    expect(store).not.toHaveBeenCalled();
  });

  it('escapeHtmlForEmail escapes the five HTML metacharacters', () => {
    expect(escapeHtmlForEmail(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('routes.ts uses the tested handler and EmailService (no raw sgMail.send), and no longer swallows the store error', () => {
    const routes = read('server/routes.ts');
    const start = routes.indexOf("app.post('/api/franchise/inquiry'");
    const block = routes.slice(start, routes.indexOf('// Franchise routes (Firebase auth applied here', start));
    expect(block).toMatch(/handleFranchiseInquiry\(req\.body/);
    expect(block).toMatch(/EmailService\.send\(/);
    expect(block).not.toMatch(/sgMail\.send\(/);
    expect(block).not.toMatch(/falling back to logs/);
    expect(block).toMatch(/res\.status\(result\.status\)\.json\(result\.body\)/);
  });
});

describe('8. /locations — honest open state, no unrequested location prompt', () => {
  const src = code('client/src/pages/Locations.tsx');
  it('geolocation is requested only from a tap handler, not in a mount effect', () => {
    const effect = src.slice(src.indexOf('window.scrollTo(0, 0);'), src.indexOf("fetch(getApiUrl('/api/public/stations'))"));
    expect(effect).not.toMatch(/getCurrentPosition/);
    expect(src).toMatch(/const requestUserLocation = \(\) => \{[\s\S]*?getCurrentPosition/);
    expect(src).toMatch(/onClick=\{requestUserLocation\}/);
  });
  it('"OPEN NOW" is computed from the stated hours', () => {
    expect(src).toMatch(/isOpenNowInIsrael\(a\.opens, a\.closes\) === true \?/);
    expect(src).toMatch(/CLOSED NOW/);
  });
  it('isOpenNowInIsrael matches the stated 05:30–23:00 Asia/Jerusalem hours', async () => {
    // Pure function in the page module; evaluate it without React by
    // extracting its source (the page imports browser-only assets).
    const full = read('client/src/pages/Locations.tsx');
    const fnSrc = full.slice(full.indexOf('export function isOpenNowInIsrael'), full.indexOf('export default function Locations'));
    const js = fnSrc
      .replace('export function isOpenNowInIsrael(opens?: string, closes?: string, now: Date = new Date()): boolean | null', 'return function isOpenNowInIsrael(opens, closes, now = new Date())')
      .replace('(hhmm: string)', '(hhmm)');
    // eslint-disable-next-line no-new-func
    const isOpen = new Function(js)() as (o?: string, c?: string, n?: Date) => boolean | null;
    // Israel is UTC+3 in September (IDT).
    expect(isOpen('05:30', '23:00', new Date('2026-09-13T02:00:00Z'))).toBe(false); // 05:00 IDT
    expect(isOpen('05:30', '23:00', new Date('2026-09-13T02:30:00Z'))).toBe(true); // 05:30 IDT
    expect(isOpen('05:30', '23:00', new Date('2026-09-13T19:59:00Z'))).toBe(true); // 22:59 IDT
    expect(isOpen('05:30', '23:00', new Date('2026-09-13T20:00:00Z'))).toBe(false); // 23:00 IDT
    expect(isOpen('05:30', '23:00', new Date('2026-09-12T23:00:00Z'))).toBe(false); // 02:00 IDT
    // Winter (IST, UTC+2): 04:00Z = 06:00 local → open.
    expect(isOpen('05:30', '23:00', new Date('2026-12-10T04:00:00Z'))).toBe(true);
    // 24/7 station.
    expect(isOpen('00:00', '23:59', new Date('2026-09-12T23:00:00Z'))).toBe(true);
    expect(isOpen(undefined, undefined)).toBeNull();
  });
});

describe('9. Careers — Hebrew reachable, no promised email', () => {
  const src = code('client/src/pages/Careers.tsx');
  it('reads the app language store, not react-i18next i18n.language', () => {
    expect(src).not.toMatch(/i18n\.language/);
    expect(src).toMatch(/useLanguage\(\)/);
  });
  it('neither the server nor the success dialog promises a confirmation email', () => {
    expect(code('server/routes/careers.ts')).not.toMatch(/Check your email for confirmation/);
    expect(src).not.toMatch(/Check your email for confirmation/);
    expect(src).not.toMatch(/בדוק את האימייל שלך לאישור/);
  });
});

describe('10. Media — no fake "Download Kit"', () => {
  const src = code('client/src/pages/Media.tsx');
  it('the press card no longer claims a download', () => {
    expect(src).not.toMatch(/Download Kit|הורדת ערכה/);
    expect(src).not.toMatch(/<Download\b/);
    expect(src).toMatch(/pressBtn: 'צפו בגלריה'/);
  });
});

describe('11. Shop waitlist — consent is actually given', () => {
  const src = code('client/src/pages/Shop.tsx');
  it('sends the checkbox value, not a hard-coded true', () => {
    expect(src).not.toMatch(/consentToContact: true/);
    expect(src).toMatch(/const \[consentToContact, setConsentToContact\] = useState\(false\)/);
    expect(src).toMatch(/type="checkbox"[\s\S]{0,80}checked=\{consentToContact\}/);
  });
  it('submit is blocked until ticked', () => {
    expect(src).toMatch(/if \(!consentToContact\) \{\s*setConsentMissing\(true\);\s*return;/);
  });
});

describe('12. About / Story — no unprovable claims', () => {
  const about = code('client/src/pages/About.tsx');
  const story = code('client/src/pages/Story.tsx');
  it('About drops the 100% safety record and "millions worldwide"', () => {
    expect(about).not.toMatch(/100% global safety record/);
    expect(about).not.toMatch(/רישום בטיחות מושלם/);
    expect(about).not.toMatch(/Safety Record/);
    expect(about).not.toMatch(/millions worldwide|מיליונים ברחבי העולם/);
    expect(about).not.toMatch(/flawless safety record/);
  });
  it('Story drops "world\'s first" and "8 different platforms"', () => {
    expect(story).not.toMatch(/world's first/i);
    expect(story).not.toMatch(/8 different platforms/);
  });
});
