/**
 * Floating web FABs (WhatsApp / AI / accessibility) are WEBSITE chrome — they
 * were floating over the CEO's canonical native app screens (seen live on the
 * simulator, 2026-07-23). Native flavors must never render them, same rule as
 * header/footer/promo (#1477/#1478).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const app = readFileSync(resolve(__dirname, '..', '..', 'client/src/App.tsx'), 'utf8');

describe('native flavors have no floating web FABs', () => {
  it('showFloatingStack requires web flavor', () => {
    expect(app).toMatch(/const showFloatingStack = !isImmersive && !isNativeApp;/);
  });
});
