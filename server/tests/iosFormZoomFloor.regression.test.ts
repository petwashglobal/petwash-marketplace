/**
 * CEO 2026-09-12 — "not easy to put info in and save" on the iPhone.
 *
 * iOS Safari zooms the entire page in when a NATIVE form control whose
 * font-size is under 16px receives focus, and it does not zoom back out. The
 * page is then stuck at ~1.3x, the layout is wider than the screen, and the
 * customer is typing into a field that has drifted off the side.
 *
 * The usual "fix" — maximum-scale=1 / user-scalable=no in the viewport meta —
 * is NOT available to us and should not be: it takes pinch-zoom away from
 * every user, iOS 10+ ignores it in Safari anyway, and this app's meta is
 * deliberately `width=device-width, initial-scale=1.0, viewport-fit=cover`.
 * So 16px on the control is the only real defence.
 *
 * Found live at 375px on petwash.co.il: the phone-number field on signup/OTP
 * (15px), its country picker (14px), every My Account field (15px), and the
 * header language pill (0.6rem = 9.6px).
 *
 * This scans EVERY stylesheet in the client, not just the four that were
 * wrong — the point is that the next one cannot be added quietly.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CLIENT = path.join(process.cwd(), 'client', 'src');

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) cssFiles(p, out);
    else if (entry.name.endsWith('.css')) out.push(p);
  }
  return out;
}

/** Resolve a CSS length to px. Returns null for anything not a fixed length. */
function toPx(raw: string): number | null {
  const m = /^([\d.]+)(px|rem|em|pt)$/.exec(raw.trim().toLowerCase());
  if (!m) return null;
  const n = parseFloat(m[1]);
  // The app's root font-size is the browser default 16px (no html{font-size}
  // override anywhere in the client), so rem/em resolve against 16.
  return { px: n, rem: n * 16, em: n * 16, pt: (n * 4) / 3 }[m[2] as 'px' | 'rem' | 'em' | 'pt'];
}

/**
 * Does this selector target a NATIVE form control — the only thing iOS zooms
 * into? Radix/shadcn triggers are <button>s and are deliberately excluded.
 */
const TARGETS_NATIVE_CONTROL =
  /(?:^|[\s,>+~])(?:select|input|textarea)\b|(?:^|[\s,>+~])\.[A-Za-z0-9_-]*(?:select|input|field|textarea)[A-Za-z0-9_-]*\b/i;

type Offender = { file: string; line: number; selector: string; value: string; px: number };

function scan(): Offender[] {
  const bad: Offender[] = [];
  for (const file of cssFiles(CLIENT).sort()) {
    const css = fs.readFileSync(file, 'utf8');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = m[1].trim();
      if (selector.startsWith('@')) continue;
      if (!TARGETS_NATIVE_CONTROL.test(selector)) continue;
      // (?<![-\w]) so `-webkit-…-font-size` / `font-size-adjust` don't match.
      const fs_ = /(?<![-\w])font-size\s*:\s*([^;!}]+)/.exec(m[2]);
      if (!fs_) continue;
      const px = toPx(fs_[1]);
      if (px === null || px >= 16) continue;
      bad.push({
        file: path.relative(process.cwd(), file),
        line: css.slice(0, m.index).split('\n').length,
        selector: selector.replace(/\s+/g, ' ').slice(0, 80),
        value: fs_[1].trim(),
        px,
      });
    }
  }
  return bad;
}

describe('no native form control may be styled below the iOS zoom threshold', () => {
  it('every client stylesheet is clean', () => {
    const bad = scan();
    const report = bad.map(b => `  ${b.file}:${b.line}  ${b.px}px (${b.value})  ${b.selector}`).join('\n');
    expect(bad, `iOS will zoom the page on focus for:\n${report}`).toEqual([]);
  });

  it('the scanner is not vacuous — it finds a planted violation', () => {
    // Guards the guard: a scanner that matches nothing would pass forever.
    const css = '.x-input { font-size: 14px; }';
    const m = /([^{}]+)\{([^{}]*)\}/.exec(css)!;
    expect(TARGETS_NATIVE_CONTROL.test(m[1].trim())).toBe(true);
    expect(toPx(/font-size\s*:\s*([^;!}]+)/.exec(m[2])![1])).toBe(14);
    expect(toPx('0.6rem')).toBeCloseTo(9.6, 5);
    expect(toPx('1rem')).toBe(16);
  });

  it('the four fields the CEO actually hit are pinned by name', () => {
    const index = fs.readFileSync(path.join(CLIENT, 'index.css'), 'utf8');
    const account = fs.readFileSync(path.join(CLIENT, 'styles', 'my-account-luxury.css'), 'utf8');
    const header = fs.readFileSync(path.join(CLIENT, 'styles', 'petwash-header.css'), 'utf8');

    const rule = (css: string, sel: string) => {
      const at = css.indexOf(sel + ' {');
      expect(at, `${sel} not found`).toBeGreaterThan(-1);
      return css.slice(at, css.indexOf('}', at));
    };

    // The signup / OTP phone field and its country picker.
    expect(rule(index, '.intl-phone-wrapper .PhoneInputInput')).toMatch(/font-size:\s*16px/);
    expect(rule(index, '.intl-phone-wrapper .PhoneInputCountrySelect')).toMatch(/font-size:\s*16px/);
    // Every My Account field.
    expect(rule(account, '.pw-input-luxury')).toMatch(/font-size:\s*16px/);
    // The drawer language row.
    expect(rule(header, '.pw-language-select')).toMatch(/font-size:\s*1rem/);
  });

  it('the header language pill goes legible WITHOUT growing the header', () => {
    const header = fs.readFileSync(path.join(CLIENT, 'styles', 'petwash-header.css'), 'utf8');
    const at = header.indexOf('.pw-language-tap > .pw-language-select,');
    expect(at).toBeGreaterThan(-1);
    const block = header.slice(at, header.indexOf('}', at));
    expect(block).toMatch(/font-size:\s*16px\s*!important/);
    // .pw-language-tap-pill is absolutely inset to left:0/right:0 inside an
    // inline-flex wrapper, so it takes its painted width from this select.
    // Without the pin, 16px text would widen the pill and push the header out.
    expect(block, 'pill would grow — pin the select to its painted width').toMatch(/width:\s*74px\s*!important/);
    expect(block, 'padding must be zeroed or 16px text will not fit in 74px').toMatch(/padding:\s*0\s*!important/);

    // And the pill really is width-driven by the select, not fixed itself.
    const pillAt = header.indexOf('.pw-language-tap-pill {');
    const pill = header.slice(pillAt, header.indexOf('}', pillAt));
    expect(pill).toMatch(/left:\s*0/);
    expect(pill).toMatch(/right:\s*0/);
  });

  it('the viewport meta still lets users pinch-zoom (we did NOT take the cheap way out)', () => {
    const html = fs.readFileSync(path.join(process.cwd(), 'client', 'index.html'), 'utf8');
    const meta = /<meta[^>]+name=["']viewport["'][^>]*>/i.exec(html);
    expect(meta, 'no viewport meta').not.toBeNull();
    expect(meta![0]).not.toMatch(/maximum-scale/i);
    expect(meta![0]).not.toMatch(/user-scalable\s*=\s*(no|0)/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// QA follow-up (CEO 2026-09-12): the CSS scan above missed an entire vector.
//
// Verifying the first fix on production turned up two things. One, the
// `.pw-input-luxury` rule it "fixed" is dead — the class has zero usages, and
// MyAccount was never affected. Two, and worse: a raw <input> can carry its
// font size as a Tailwind class instead of CSS, and the scan above only reads
// .css files. Six customer- and provider-facing controls were still under the
// threshold, styled `text-sm` (14px) inline.
//
// Those six are fixed. The 72 remaining live in admin/internal desktop tools
// and are carried as a RATCHET baseline: a count may fall, never rise, and a
// file not on the list may not have any at all.
// ─────────────────────────────────────────────────────────────────────────────

const TSX_BASELINE = 'scripts/guards/ios_form_zoom_tsx_baseline.txt';

/** Base font-size utility only — NOT a variant like `file:text-sm`. */
const SMALL_CLASS = /(?<![\w:-])text-(?:xs|sm|\[(?:1[0-5])(?:\.\d+)?px\]|\[[0-9](?:\.\d+)?px\])(?![\w-])/;
const RAW_CONTROL = /<(input|select|textarea)\b((?:[^<>]|\{[^{}]*\})*?)\/?>/gs;
/** iOS only zooms into controls you can type in. */
const NON_TEXT_INPUT = new Set(['hidden', 'checkbox', 'radio', 'file', 'range', 'color', 'submit', 'button', 'image']);

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(p, out);
    else if (entry.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function scanTsx(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of tsxFiles(CLIENT).sort()) {
    const src = fs.readFileSync(file, 'utf8');
    let n = 0;
    for (const m of src.matchAll(RAW_CONTROL)) {
      const attrs = m[2];
      const type = /type=["']([a-z]+)["']/.exec(attrs);
      if (type && NON_TEXT_INPUT.has(type[1])) continue;
      const cls = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{cn\(([^)]*)\))/.exec(attrs);
      const clstext = cls ? cls.slice(1).filter(Boolean).join(' ') : '';
      if (!SMALL_CLASS.test(clstext)) continue;
      // An explicit inline fontSize >= 16 rescues it.
      if (/fontSize:\s*['"]?(1[6-9]|[2-9]\d)/.test(attrs)) continue;
      n++;
    }
    if (n) counts[path.relative(process.cwd(), file)] = n;
  }
  return counts;
}

function readBaseline(): Record<string, number> {
  const raw = fs.readFileSync(path.join(process.cwd(), TSX_BASELINE), 'utf8');
  const out: Record<string, number> = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = /^(\d+)\s+(.+)$/.exec(t);
    if (m) out[m[2]] = parseInt(m[1], 10);
  }
  return out;
}

describe('raw JSX controls may not be styled below the iOS zoom threshold either', () => {
  it('the scanner is not vacuous, and ignores variant prefixes', () => {
    // `file:text-sm` on the shared Input styles the file-picker BUTTON, not the
    // field, and must not be flagged — that false positive is what made the
    // first pass of this scan report the shared Input as broken.
    expect(SMALL_CLASS.test('px-3 py-2 text-sm')).toBe(true);
    expect(SMALL_CLASS.test('text-xs')).toBe(true);
    expect(SMALL_CLASS.test('text-[13px]')).toBe(true);
    expect(SMALL_CLASS.test('file:text-sm placeholder:text-xs')).toBe(false);
    expect(SMALL_CLASS.test('text-[16px]')).toBe(false);
    expect(SMALL_CLASS.test('text-sm-custom')).toBe(false);
  });

  it('the shared Input and Textarea are at 16px — they are the reason most screens are safe', () => {
    for (const f of ['components/ui/input.tsx', 'components/ui/textarea.tsx']) {
      expect(fs.readFileSync(path.join(CLIENT, f), 'utf8'), `${f} dropped below 16px`)
        .toContain('text-[16px]');
    }
  });

  it('the six customer- and provider-facing controls are fixed', () => {
    const counts = scanTsx();
    for (const f of [
      'client/src/pages/GroomingFeedback.tsx',
      'client/src/pages/LoyaltyDashboard.tsx',
      'client/src/pages/PrestigeInterestWaitlist.tsx',
      'client/src/pages/ProviderCompliance.tsx',
    ]) {
      expect(counts[f], `${f} has a control back under 16px`).toBeUndefined();
    }
  });

  it('no file outside the admin debt ledger has any', () => {
    const counts = scanTsx();
    const baseline = readBaseline();
    const strangers = Object.keys(counts).filter(f => !(f in baseline));
    expect(strangers, `new file(s) with sub-16px native controls:\n  ${strangers.join('\n  ')}`)
      .toEqual([]);
  });

  it('the ledger only ratchets down', () => {
    const counts = scanTsx();
    const baseline = readBaseline();
    const grew = Object.entries(counts)
      .filter(([f, n]) => n > (baseline[f] ?? 0))
      .map(([f, n]) => `${f}: ${baseline[f] ?? 0} -> ${n}`);
    expect(grew, `debt grew:\n  ${grew.join('\n  ')}`).toEqual([]);
  });

  it('the baseline itself is honest — every listed file still exists', () => {
    for (const f of Object.keys(readBaseline())) {
      expect(fs.existsSync(path.join(process.cwd(), f)), `${f} is in the ledger but gone`).toBe(true);
    }
  });
});
