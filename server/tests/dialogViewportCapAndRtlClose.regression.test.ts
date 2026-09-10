import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * DIALOG VIEWPORT CAP + RTL CLOSE (2026-09-10)
 *
 * Two defects in the ONE shared primitive that all 116 <DialogContent> call
 * sites render through, so both were app-wide:
 *
 * 1. The content box is `fixed` and centred with `translate(-50%,-50%)` and
 *    had no height cap. Content taller than the viewport overflows off BOTH
 *    the top and the bottom at once, and a `fixed` element has no scroll — so
 *    the first field and the submit button are simultaneously unreachable.
 *    87 of the 116 call sites shipped no cap of their own.
 *
 * 2. The close × was `right-4` — physically right. Hebrew is this app's
 *    default (Layout.tsx sets documentElement.dir = 'rtl'), so it landed on
 *    the start of every right-aligned Hebrew title.
 *
 * These are source pins, not behavioural ones, and that is a deliberate
 * limitation worth stating: jsdom does not run Tailwind, so there is no
 * rendered geometry to assert on. What CAN be pinned is that the utilities
 * survive in the shared base class — which is exactly how both defects would
 * come back (an edit to that one string).
 */
const dialog = readFileSync(
  resolve(__dirname, '../../client/src/components/ui/dialog.tsx'),
  'utf8',
);

/** The single base className string handed to cn() by DialogContent. */
function baseContentClass(): string {
  const m = dialog.match(/"fixed left-\[50%\] top-\[50%\][^"]*"/);
  if (!m) throw new Error('DialogContent base class string not found — did the primitive change shape?');
  return m[0];
}

describe('DialogContent can never exceed the viewport', () => {
  it('caps its height against the SMALL viewport', () => {
    const cls = baseContentClass();
    expect(cls).toMatch(/max-h-\[calc\(100dvh-2rem\)\]/);
  });

  it('uses dvh, not vh — on iOS Safari vh is the LARGE viewport', () => {
    const cls = baseContentClass();
    // A `100vh` cap is already taller than the visible area on iOS before the
    // margin is subtracted, so it caps nothing on the device that needs it.
    expect(cls).not.toMatch(/max-h-\[calc\(100vh/);
    expect(cls).not.toMatch(/max-h-\[100vh\]/);
  });

  it('can actually scroll once capped — a cap without scroll just clips', () => {
    const cls = baseContentClass();
    expect(cls).toMatch(/overflow-y-auto/);
  });
});

describe('DialogContent close button follows the writing direction', () => {
  it('is pinned to the inline END, not the physical right', () => {
    const closeLine = dialog.match(/<DialogPrimitive\.Close className="[^"]*"/);
    expect(closeLine).not.toBeNull();
    expect(closeLine![0]).toMatch(/\bend-4\b/);
  });

  it('no longer uses right-4, which collides with the Hebrew title', () => {
    const closeLine = dialog.match(/<DialogPrimitive\.Close className="[^"]*"/);
    expect(closeLine![0]).not.toMatch(/\bright-4\b/);
  });
});
