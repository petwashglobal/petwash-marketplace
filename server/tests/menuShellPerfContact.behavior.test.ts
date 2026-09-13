import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
// @ts-expect-error — plain .mjs build script, no types
import { toAppShell, APP_SHELL_FILE } from '../../scripts/write-app-shell.mjs';
import { escapeHtml, toHeaderText } from '../lib/htmlEscape';

/**
 * Hamburger-menu audit 2026-09-13 (live probe of all 33 items on production).
 *  1. 26 of 33 menu pages were served the HOMEPAGE html — prerender wrote the '/'
 *     snapshot to index.html, which was also the Hosting `**` fallback — with
 *     canonical "/" (Google: duplicates of home) and the home YouTube embed.
 *  2. 4–7.7 MB per page: 60 icon PNGs ≈ 12.7 MB (≈300 KB each, shown ≤112px),
 *     an 854 KB header logo, a 601 KB popup PNG, a dead HubSpot loader (410).
 *  3. Every menu tap was window.location.assign → full reload.
 *  4. /api/contact pasted raw visitor text into mail from Support@PetWash,
 *     including an auto-reply to any typed address (phishing relay).
 *  5. Eight menu destinations rendered with no header (no way back to the menu).
 */
const ROOT = resolve(__dirname, '..', '..');
const R = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const KB = (p: string) => statSync(join(ROOT, p)).size / 1024;

describe('1. the Hosting fallback is a pristine shell, never the homepage snapshot', () => {
  const pristine = `<head>\n    <link rel="canonical" href="https://petwash.co.il/">\n    <meta property="og:url" content="https://petwash.co.il">\n</head><body><div id="root"></div></body>`;

  it('toAppShell strips the homepage-only canonical and og:url and keeps the empty root', () => {
    const out = toAppShell(pristine);
    expect(out).not.toMatch(/rel="canonical"/);
    expect(out).not.toMatch(/og:url/);
    expect(out).toContain('<div id="root"></div>');
    expect(APP_SHELL_FILE).toBe('app-shell.html');
  });

  it('refuses to build a shell from a prerendered snapshot', () => {
    expect(() => toAppShell('<div id="root"><main>How to Use a PetWash™ Station</main></div>')).toThrow(/pristine/);
  });

  it('the pristine source index.html is a valid shell input', () => {
    expect(() => toAppShell(R('client/index.html'))).not.toThrow();
  });

  it('firebase.json falls back to /app-shell.html (never cached), not /index.html', () => {
    const fb = JSON.parse(R('firebase.json'));
    for (const h of [fb.hosting].flat()) {
      const catchAll = (h.rewrites ?? []).filter((r: any) => r.source === '**');
      expect(catchAll).toEqual([{ source: '**', destination: '/app-shell.html' }]);
      const hdr = (h.headers ?? []).find((x: any) => x.source === '/app-shell.html');
      expect(JSON.stringify(hdr)).toContain('no-store');
    }
  });

  it('the shell is written on every build, and prerender serves it as its own fallback', () => {
    expect(JSON.parse(R('package.json')).scripts.postbuild).toBe('node scripts/write-app-shell.mjs');
    const p = R('scripts/prerender.mjs');
    expect(p).toContain('file = join(DIST, APP_SHELL_FILE);');
    expect(p).not.toContain("file = join(DIST, 'index.html');");
    expect(p.indexOf('await writeAppShell(DIST)')).toBeLessThan(p.indexOf('const { server, port } = await serveDist();'));
  });
});

describe('2. page weight', () => {
  function pngs(dir: string): string[] {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? pngs(join(dir, e.name)) : e.name.endsWith('.png') ? [join(dir, e.name)] : []);
  }

  it('every PetWash icon is ≤ 60 KB (they render at ≤112px)', () => {
    const icons = pngs('client/public/assets/icons');
    expect(icons.length).toBeGreaterThan(40);
    const heavy = icons.filter((f) => KB(f) > 60).map((f) => `${f} ${KB(f).toFixed(0)}KB`);
    expect(heavy).toEqual([]);
  });

  it('header, footer, drawer and PetWashLogo use the downscaled official logo', () => {
    expect(KB('client/public/brand/petwash-logo-official-810w.png')).toBeLessThan(120);
    for (const f of ['client/src/components/PetWashHeader.tsx', 'client/src/components/Footer.tsx', 'client/src/components/brand/PetWashLogo.tsx']) {
      const src = R(f);
      expect(src, f).toContain('/brand/petwash-logo-official-810w.png');
      expect(src, f).not.toMatch(/['"]\/brand\/petwash-logo-official\.png['"]/);
    }
  });

  it('the promo poster is the JPEG', () => {
    expect(KB('client/public/petwash-popup.jpg')).toBeLessThan(400);
    expect(R('client/src/components/PromoAdPopup.tsx')).toContain("imageUrl: '/petwash-popup.jpg',");
  });

  it('the dead HubSpot loader and its endless retry are gone', () => {
    expect(R('client/index.html')).not.toContain('js.hs-scripts.com/46822710.js"></script>');
    expect(R('client/src/lib/utils.ts')).not.toContain('createHubSpotForm');
    expect(R('client/src/pages/Contact.tsx')).not.toContain('createHubSpotForm');
  });
});

describe('3. menu taps stay inside the app', () => {
  const h = R('client/src/components/PetWashHeader.tsx');

  it('goTo closes the drawer and uses the router', () => {
    const goTo = h.slice(h.indexOf('const goTo = (href: string) => {'), h.indexOf('const handleLanguageChange'));
    expect(goTo).toContain('setIsMobileOpen(false);');
    expect(goTo).toContain('setLocation(href);');
    expect(goTo).not.toContain('window.location.assign');
  });

  it('every menu list item navigates with goTo', () => {
    expect(h.match(/onClick=\{\(\) => goTo\(item\.href\)\}/g)?.length).toBe(5);
    expect(h).not.toMatch(/onClick=\{\(\) => handleNavigate\(item\.href\)\}/);
    expect(h).toContain('goTo(item.href);');
  });

  it('the unused 30 s inbox poll is gone from the header', () => {
    expect(h).not.toContain('/api/booking-chat/inbox');
  });
});

describe('4. the contact form cannot relay attacker HTML', () => {
  it('escapeHtml / toHeaderText', () => {
    expect(escapeHtml('<a href="https://evil">x</a> & \'')).toBe('&lt;a href=&quot;https://evil&quot;&gt;x&lt;/a&gt; &amp; &#39;');
    expect(escapeHtml(undefined)).toBe('');
    expect(toHeaderText('Hi\r\nBcc: victim@example.com')).toBe('Hi Bcc: victim@example.com');
  });

  const routes = R('server/routes.ts');
  const start = routes.indexOf("app.post('/api/contact'");
  const handler = routes.slice(start, routes.indexOf('// Admin Test Endpoints', start));

  it('is bot-checked and escapes every visitor field', () => {
    expect(handler).toContain("app.post('/api/contact', apiLimiter, turnstileGuard({ action: 'contact_form' }), async (req, res) => {");
    for (const f of ['name', 'email', 'phone', 'subject', 'message']) expect(handler).toContain(`escapeHtml(${f})`);
    expect(handler).not.toMatch(/<p>\$\{message\}<\/p>/);
    expect(handler).not.toMatch(/\$\{name\}/);
  });

  it('the auto-reply to the typed address carries nothing the visitor wrote', () => {
    const reply = handler.slice(handler.indexOf('to: email,'));
    expect(reply).not.toMatch(/\$\{(name|message|subject|phone)\}|escapeHtml\(/);
  });

  it('the client sends the Turnstile token; bot-check health lists the surface', () => {
    expect(R('client/src/pages/Contact.tsx')).toContain("executeTurnstileInvisible('contact_form')");
    expect(R('server/index.ts')).toContain("'contact_form',");
  });
});

describe('5. menu destinations keep the site header', () => {
  it.each([
    ['/loyalty/refer', '<Layout><LoyaltyRefer /></Layout>'],
    ['/booking', '<Layout><BookingUnified /></Layout>'],
    ['/support', '<Layout><Support /></Layout>'],
    ['/status', '<Layout><SystemStatus /></Layout>'],
    ['/partners/locations', '<Layout><LocationPartners /></Layout>'],
    ['/partners/suppliers', '<Layout><SuppliersPartners /></Layout>'],
    ['/partners/municipal', '<Layout><MunicipalPartners /></Layout>'],
    ['/legal/terms', '<Layout><LegalCustomerTerms /></Layout>'],
  ])('%s', (_route, jsx) => {
    expect(R('client/src/App.tsx')).toContain(jsx);
  });
});
