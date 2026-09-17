import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * AN EXAMPLE MAY NEVER LOOK LIKE A REAL PET.
 *
 * CEO 2026-09-17: an empty board invites nobody — show what a listing looks
 * like. The danger is the opposite mistake: PetWash already deleted fabricated
 * lost-pet posts once (PR-FAKE 2026-06-13) because an invented missing dog with
 * a reward and a contact button is a real-world harm — people call about a pet
 * that does not exist.
 *
 * So the example block must be: labelled EXAMPLE on every card, named as an
 * example, with no contact button, no phone, no reward, nothing clickable into
 * a pet page — and it must vanish the moment one real row exists.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const SRC = R('client/src/components/pet-community/ExamplePreview.tsx');

describe('the example block cannot be mistaken for a real pet', () => {
  it('every card carries an EXAMPLE ribbon', () => {
    expect(SRC).toContain("data-testid=\"example-ribbon\"");
    expect(SRC).toContain("{isHe ? 'דוגמה' : 'Example'}");
  });

  it('every example pet is NAMED as an example', async () => {
    const { adoptionExamples, pawFinderExamples } = await import('../../client/src/components/pet-community/ExamplePreview.tsx' as string).catch(() => ({} as any));
    // The module is TSX; assert on the source instead of importing JSX here.
    for (const name of ['דוגמה · כלב', 'Example · Dog', 'דוגמה · חתולה', 'Example · Found cat', 'דוגמה · תוכי אבוד']) {
      expect(SRC, name).toContain(name);
    }
    expect(adoptionExamples ?? pawFinderExamples ?? true).toBeTruthy();
  });

  it('there is nothing to press: no contact, no phone, no reward, no pet page', () => {
    expect(SRC).not.toMatch(/tel:/);
    // Comments mention the word; what matters is that no reward is RENDERED.
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/reward/i);
    expect(code).not.toMatch(/₪/);
    expect(SRC).not.toMatch(/\/adoption\/\$\{/);
    expect(SRC).not.toMatch(/\/paw-finder\/\$\{/);
    expect(SRC).not.toMatch(/onContact|ContactModal|enquir/i);
    // The only link is the call to action that creates a REAL listing.
    expect((SRC.match(/<Link href=/g) || []).length).toBe(1);
  });

  it('it says out loud that these are not real pets', () => {
    const adoption = R('client/src/pages/AdoptionMaison.tsx');
    const paw = R('client/src/pages/PawFinder.tsx');
    expect(adoption).toContain('אלה דוגמאות בלבד — לא חיות אמיתיות שמחכות לאימוץ.');
    expect(paw).toContain('אלה דוגמאות בלבד — לא חיות אמיתיות.');
    expect(SRC).toContain("{isHe ? 'כך תיראה המודעה שלכם' : 'This is how your listing will look'}");
  });
});

describe('examples never compete with real listings', () => {
  it('each board renders them ONLY when it has nothing real to show', () => {
    const adoption = R('client/src/pages/AdoptionMaison.tsx');
    const paw = R('client/src/pages/PawFinder.tsx');
    // Inside the `length === 0` branch of each board.
    const aBranch = adoption.slice(adoption.indexOf('shown.length === 0'), adoption.indexOf('shown.map((l)'));
    const pBranch = paw.slice(paw.indexOf('recent.length === 0'), paw.indexOf('recent.map((post)'));
    expect(aBranch).toContain('<ExamplePreview');
    expect(pBranch).toContain('<ExamplePreview');
    expect((adoption.match(/<ExamplePreview/g) || []).length).toBe(1);
    expect((paw.match(/<ExamplePreview/g) || []).length).toBe(1);
  });

  it('the adoption examples do not show on Saved or My Matches', () => {
    const adoption = R('client/src/pages/AdoptionMaison.tsx');
    expect(adoption).toContain("{view === 'browse' && (");
  });

  it('each call to action leads to the real posting flow', () => {
    expect(R('client/src/pages/AdoptionMaison.tsx')).toContain("cta={{ href: '/adoption/new'");
    expect(R('client/src/pages/PawFinder.tsx')).toContain("cta={{ href: '/paw-finder?tab=report'");
  });
});
