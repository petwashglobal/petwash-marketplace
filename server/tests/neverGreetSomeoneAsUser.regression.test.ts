import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { resolveGreetingName, isPlaceholderName } from '../../client/src/lib/greetingName';

/**
 * NEVER GREET A CUSTOMER AS "User" (2026-09-12)
 *
 * The CEO's own phone showed:  ערב טוב,  User 👋
 *
 * Not a rendering bug — 'User' was STORED as his first name.
 * `customers.firstName` is NOT NULL and signup satisfied that constraint by
 * inventing a name whenever it collected none, so the fake name then surfaced
 * everywhere a name is shown.
 *
 * BEHAVIOURAL on the display half. An earlier source-shaped version of this
 * test passed while the guard was disconnected from the assignment — it only
 * proved the function EXISTED, not that it was used. That is why the logic was
 * extracted into client/src/lib/greetingName.ts and is called here for real.
 */
describe('greeting name resolution', () => {
  it('refuses the exact bug from the screenshot', () => {
    expect(resolveGreetingName(['User'], true)).toBe('חבר');
    expect(resolveGreetingName(['User'], false)).toBe('Member');
  });

  it.each(['user', 'USER', ' User ', 'Member', 'guest', 'null', 'undefined', 'N/A', ''])(
    'treats %p as not-a-name', (v) => expect(isPlaceholderName(v)).toBe(true),
  );

  it('uses a real name when there is one', () => {
    expect(resolveGreetingName(['ניר'], true)).toBe('ניר');
    expect(resolveGreetingName([null, 'Nir'], false)).toBe('Nir');
  });

  it('falls back to a real localized word when nothing usable is offered', () => {
    expect(resolveGreetingName([null, undefined], true)).toBe('חבר');
    expect(resolveGreetingName([null, undefined], false)).toBe('Member');
  });

  it('trims rather than showing padded whitespace', () => {
    expect(resolveGreetingName(['  Nir  '], false)).toBe('Nir');
  });
});

/** The writers must stop inventing names, or the display fix is a bandage. */
const ROOT = resolve(__dirname, '../..');
const code = (p: string) =>
  readFileSync(resolve(ROOT, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('the home page never offers an email as a name candidate', () => {
  it('resolveGreetingName is called without any email', () => {
    // "ערב טוב, support" is an address with the @ cut off. The pure function
    // cannot know that — 'support' could legitimately be someone's name — so
    // this is the caller's rule and is checked where it lives.
    const home = code('client/src/pages/PrestigeHome.tsx');
    const call = home.slice(home.indexOf('resolveGreetingName('));
    const args = call.slice(0, call.indexOf(');') + 1);
    expect(args).toMatch(/displayName/);
    expect(args).not.toMatch(/email/);
  });
});

describe('signup never invents a name', () => {
  it.each(['server/customAuth.ts', 'server/routes/publicAuthRoutes.ts'])(
    '%s does not default firstName to a placeholder', (file) => {
      expect(code(file)).not.toMatch(/firstName:[^,\n]*\|\|\s*['"]User['"]/);
    },
  );
});
