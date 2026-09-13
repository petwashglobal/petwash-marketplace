import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { welcomeBackCelebration } from './welcomeBack';
import { israelOccasion } from './israelOccasions';

/**
 * 2026-09-13 — the CEO saw "Shana Tova" on the home page but Welcome Back
 * always said only "ברוך שובך". Welcome Back now shows the same celebration
 * line the home page does, from the same rules, with the real Hebrew calendar.
 * It also gains screen 6 of the flow: the green brand beat before home.
 */
const at = (iso: string) => new Date(iso);

describe('welcomeBackCelebration — real Hebrew calendar, no mocks', () => {
  it('Rosh Hashana 5787 (2026-09-12) → שנה טובה ומתוקה 🍎', () => {
    const now = at('2026-09-12T10:00:00');
    expect(welcomeBackCelebration('he', null, israelOccasion('he', now), now)).toBe('שנה טובה ומתוקה 🍎');
  });

  it('Rosh Hashana II (2026-09-13, the day the CEO checked) still says Shana Tova', () => {
    const now = at('2026-09-13T10:00:00');
    expect(welcomeBackCelebration('he', null, israelOccasion('he', now), now)).toBe('שנה טובה ומתוקה 🍎');
  });

  it('Yom Kippur (2026-09-21) → גמר חתימה טובה', () => {
    const now = at('2026-09-21T10:00:00');
    expect(welcomeBackCelebration('he', null, israelOccasion('he', now), now)).toBe('גמר חתימה טובה 🤍');
  });

  it('English member on Rosh Hashana → Shana Tova', () => {
    const now = at('2026-09-12T10:00:00');
    expect(welcomeBackCelebration('en', null, israelOccasion('en', now), now)).toBe('Shana Tova 🍎');
  });

  it('an ordinary day shows NO extra line (the name greeting is enough)', () => {
    const now = at('2026-09-10T19:00:00');
    expect(israelOccasion('he', now)).toBeNull();
    expect(welcomeBackCelebration('he', null, null, now)).toBeNull();
  });

  it('the member birthday wins over the holiday', () => {
    const now = at('2026-09-12T10:00:00');
    const line = welcomeBackCelebration('he', { birthday: '1985-09-12', pets: [] }, israelOccasion('he', now), now);
    expect(line).toBe('יום הולדת שמח 🎂');
  });

  it("a pet's birthday is celebrated by name", () => {
    const now = at('2026-03-04T10:00:00');
    const line = welcomeBackCelebration('he', { birthday: null, pets: [{ name: 'קנזו', dob: '2020-03-04' }] }, null, now);
    expect(line).toBe('יום הולדת שמח לקנזו 🐾');
  });

  it('missing greeting context (network failure) still shows the holiday', () => {
    const now = at('2026-09-12T10:00:00');
    expect(welcomeBackCelebration('he', null, israelOccasion('he', now), now)).not.toBeNull();
  });
});

describe('Welcome Back wiring', () => {
  const read = (f: string) => fs.readFileSync(path.resolve(__dirname, f), 'utf8');
  const WB = read('../pages/WelcomeBack.tsx');
  const BM = read('../components/auth/BrandMoment.tsx');
  const LIB = read('./welcomeBack.ts');

  it('renders the celebration line above the name', () => {
    expect(WB).toContain('data-testid="welcome-back-celebration"');
    expect(WB.indexOf('welcome-back-celebration')).toBeLessThan(WB.indexOf('data-testid="welcome-back-title"'));
  });

  it('loads the Hebrew calendar lazily, never statically', () => {
    expect(WB).toContain("import('@/lib/israelOccasions')");
    expect(WB).not.toMatch(/^import \{[^}]*israelOccasion[^}]*\} from/m);
    // lib/welcomeBack.ts is imported by SignUpLuxury and One Tap: type-only there.
    expect(LIB).toContain("import type { Occasion } from './israelOccasions'");
    expect(LIB).not.toMatch(/^import \{[^}]*\} from '\.\/israelOccasions'/m);
  });

  it('reads birthdays from the same endpoint the home greeting uses', () => {
    expect(WB).toContain("'/api/me/greeting-context'");
  });

  it('Continue and the auto timer go through the brand moment, then home, exactly once', () => {
    expect(WB).toContain('BRAND_MOMENT_MS');
    expect(WB).toContain('<BrandMoment he={he} onSkip={finish} />');
    expect(WB).toContain('if (left.current) return;');
    expect(WB).toMatch(/timer\.current = window\.setTimeout\(go, AUTO_CONTINUE_MS\)/);
  });

  it('"Not you?" cancels the brand moment timer too', () => {
    const notYou = WB.slice(WB.indexOf('const notYou'), WB.indexOf('const Arrow'));
    expect(notYou).toContain('brandTimer.current');
    expect(notYou).toContain('left.current = true');
  });

  it('screen 6 uses the real logo component, white variant, and the brand slogan', () => {
    expect(BM).toContain('<PetWashLogo variant="white"');
    expect(BM).not.toMatch(/petwash-logo[^'"]*\.png/); // never a logo file directly
    expect(BM).toContain('חיות נקיות');
    expect(BM).toContain('CLEAN PETS. HAPPIER LIVES.');
    expect(BM).toContain('prefers-reduced-motion');
  });
});
