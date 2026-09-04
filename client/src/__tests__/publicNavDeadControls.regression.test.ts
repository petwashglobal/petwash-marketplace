import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Public-surface dead-control regression guard (PR-NAV-3 / PR-NAV-4).
 *
 * Two classes of failure keep coming back on the public site, and both are
 * invisible in code review because the JSX looks completely normal:
 *
 *   1. A <Button> with a real label and NO handler. Shipped examples this
 *      guard was written from:
 *        - /partners/locations  "Submit Partnership Enquiry"  (no onClick)
 *        - /partners/municipal  "Submit Council Enquiry"      (no onClick)
 *        - /support             "View FAQ" + 6 topic buttons  (no onClick)
 *      Every landlord, council and support lead that touched one of those was
 *      silently lost.
 *
 *   2. A header/footer/menu entry pointing at a path that no <Route> serves,
 *      so the link renders fine and lands on the 404 fallback.
 *
 * These tests read source text rather than rendering, so they stay fast and do
 * not need the component tree, a DOM or a router.
 */

const ROOT = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Strip // and block comments before scanning for links. Without this the
 * scanner trips over prose ABOUT a removed dead link — PetWashHeader.tsx
 * carries the note `"avatar" (Avatar Studio) removed — it was a dead
 * href:"#" frozen item`, which is documentation, not a live link.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Public surfaces whose CTAs must never be inert. */
const PUBLIC_SURFACES = [
  'client/src/pages/partners/Locations.tsx',
  'client/src/pages/partners/Municipal.tsx',
  'client/src/pages/partners/Suppliers.tsx',
  'client/src/pages/Support.tsx',
  'client/src/pages/Contact.tsx',
];

/** Nav surfaces whose internal links must all resolve to a registered route. */
const NAV_SURFACES = [
  'client/src/components/PetWashHeader.tsx',
  'client/src/components/Footer.tsx',
  'client/src/components/MobileBottomNav.tsx',
  'client/src/content/platformCards.ts',
];

function registeredRoutes(): RegExp[] {
  const app = read('client/src/App.tsx');
  const raw = [...app.matchAll(/<Route\s+path=["']([^"']+)["']/g)].map((m) => m[1]);
  expect(raw.length).toBeGreaterThan(100); // sanity: we really parsed App.tsx
  return raw.map(
    (r) =>
      new RegExp(
        '^' +
          r
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/:[A-Za-z0-9_]+\??/g, '[^/]+')
            .replace(/\*/g, '.*') +
          '$',
      ),
  );
}

/**
 * Collect <Button>/<button> opening tags that carry no handler of any kind and
 * are not a submit control, skipping ones wrapped by a Link/<a> (where the
 * anchor supplies the behaviour) and ones inside a clickable card.
 */
function inertButtons(src: string): Array<{ line: number; tag: string }> {
  const out: Array<{ line: number; tag: string }> = [];
  const lines = src.split('\n');
  for (const m of src.matchAll(/<(Button|button)(\s|>)/g)) {
    let depth = 0;
    let end = -1;
    for (let k = m.index!; k < src.length; k++) {
      const c = src[k];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) {
        end = k;
        break;
      }
    }
    if (end < 0) continue;
    const tag = src.slice(m.index!, end + 1);
    // A handler, a submit control, or a Radix `asChild` passthrough is fine.
    if (/onClick|onPress|onSubmit|type=["']submit["']|asChild/.test(tag)) continue;
    const line = src.slice(0, m.index!).split('\n').length;
    // Wrapped by an anchor/Link on one of the preceding lines → the wrapper navigates.
    const ctx = lines.slice(Math.max(0, line - 4), line).join('\n');
    if (/<Link|<a\s|href=/.test(ctx)) continue;
    // Inside a card that handles the click itself.
    if (/onClick/.test(lines.slice(Math.max(0, line - 12), line).join('\n'))) continue;
    out.push({ line, tag: tag.slice(0, 120) });
  }
  return out;
}

describe('public surfaces have no inert CTAs', () => {
  for (const file of PUBLIC_SURFACES) {
    it(`${file} — every button does something`, () => {
      expect(existsSync(join(ROOT, file))).toBe(true);
      const dead = inertButtons(read(file));
      expect(
        dead,
        `Inert button(s) in ${file}:\n` +
          dead.map((d) => `  line ${d.line}: ${d.tag}`).join('\n') +
          '\nA labelled control that does nothing is worse than no control. ' +
          'Wire it, wrap it in a Link, or give it an explicit coming-soon state.',
      ).toEqual([]);
    });
  }
});

describe('the two partner enquiry CTAs stay wired to the real form', () => {
  it('/partners/locations opens the enquiry form', () => {
    const src = read('client/src/pages/partners/Locations.tsx');
    expect(src).toContain('PartnerEnquiryForm');
    expect(src).toMatch(/data-testid="button-submit-enquiry"/);
    expect(src).toMatch(/onClick=\{\(\) => setEnquiryOpen\(true\)\}/);
  });

  it('/partners/municipal opens the enquiry form', () => {
    const src = read('client/src/pages/partners/Municipal.tsx');
    expect(src).toContain('PartnerEnquiryForm');
    expect(src).toMatch(/data-testid="button-council-enquiry"/);
    expect(src).toMatch(/onClick=\{\(\) => setEnquiryOpen\(true\)\}/);
  });

  it('the shared form posts to a real route and gates success on a real result', () => {
    const src = read('client/src/components/partners/PartnerEnquiryForm.tsx');
    expect(src).toContain("/api/franchise/inquiry");
    // Success must require the server's own success flag, never res.ok alone.
    expect(src).toMatch(/body\?\.success !== true/);
    // Double-submit guard must precede the request.
    expect(src).toMatch(/if \(isSubmitting\) return;/);
    // The spinner must always be cleared.
    expect(src).toMatch(/finally\s*\{[\s\S]*setIsSubmitting\(false\)/);
  });
});

describe('public forms guard against double submission', () => {
  const cases: Array<[string, RegExp]> = [
    ['client/src/pages/Contact.tsx', /if \(submitting\) return;/],
    ['client/src/pages/partners/Suppliers.tsx', /if \(isSubmitting\) return;/],
    ['client/src/pages/Careers.tsx', /if \(applyMutation\.isPending\) return;/],
    ['client/src/pages/Careers.tsx', /if \(isUploadingResume\) return;/],
  ];
  for (const [file, re] of cases) {
    it(`${file} has ${re}`, () => {
      expect(read(file)).toMatch(re);
    });
  }
});

describe('every internal nav link resolves to a registered route', () => {
  const routes = registeredRoutes();
  const resolves = (href: string) => {
    const path = href.split('#')[0].split('?')[0] || '/';
    return routes.some((r) => r.test(path));
  };

  for (const file of NAV_SURFACES) {
    it(`${file} — no link points at a missing route`, () => {
      const src = stripComments(read(file));
      const hrefs = new Set<string>();
      for (const re of [/href[:=]\s*["'`]([^"'`]*)["'`]/g, /href=\{["'`]([^"'`]*)["'`]\}/g]) {
        for (const m of src.matchAll(re)) hrefs.add(m[1]);
      }
      const broken: string[] = [];
      for (const h of hrefs) {
        if (h === '' || h === '#') {
          broken.push(`${JSON.stringify(h)} (placeholder link)`);
          continue;
        }
        if (/^(https?:|mailto:|tel:|wa\.me|\/\/|#)/.test(h)) continue;
        if (!h.startsWith('/')) continue;
        if (!resolves(h)) broken.push(`${h} (no <Route> in App.tsx)`);
      }
      expect(broken, `Broken link(s) in ${file}:\n  ${broken.join('\n  ')}`).toEqual([]);
    });
  }
});

describe('public careers POSTs are reachable through the CSRF gate', () => {
  /**
   * /careers is a public page and its apply-flow routes carry no
   * validateFirebaseToken, so an anonymous applicant sends no Bearer. The
   * global gate skips CSRF only for Bearer requests, so without these
   * exemptions every step of the job funnel 403s before its handler runs.
   */
  const idx = read('server/index.ts');
  it('exempts the anonymous apply endpoints', () => {
    expect(idx).toContain("req.path === '/api/careers/apply'");
    expect(idx).toContain("req.path === '/api/careers/start-application'");
    expect(idx).toMatch(/api\\\/careers\\\/applications.*autosave\|documents/);
  });

  it('does NOT exempt the admin careers routes', () => {
    const m = idx.match(/\/\^\\\/api\\\/careers\\\/applications\\\/\[\^\/\]\+\\\/\(autosave\|documents\)\$\//);
    expect(m, 'the careers exemption must stay anchored so /api/careers/admin/* is never matched').toBeTruthy();
    const re = new RegExp('^/api/careers/applications/[^/]+/(autosave|documents)$');
    expect(re.test('/api/careers/admin/applications')).toBe(false);
    expect(re.test('/api/careers/applications/1/documents/evil')).toBe(false);
    expect(re.test('/api/careers/applications/1/documents')).toBe(true);
  });
});
