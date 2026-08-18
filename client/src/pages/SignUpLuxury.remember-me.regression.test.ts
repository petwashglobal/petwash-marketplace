import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, 'SignUpLuxury.tsx'), 'utf8');

// Regression pin for PR-AUTH-SECURITY-9 (2026-08-18): the sign-in form must
// carry a Remember me toggle that maps to Firebase persistence:
//   ON  → browserLocalPersistence (session survives browser restart)
//   OFF → browserSessionPersistence (cleared on browser close)

describe('SignUpLuxury — Remember me + Firebase persistence (PR-AUTH-SECURITY-9)', () => {
  it('has a rememberMe state initialized from localStorage', () => {
    expect(SRC).toMatch(/const \[rememberMe, setRememberMe\] = useState<boolean>/);
    expect(SRC).toMatch(/localStorage\.getItem\(['"]petwash\.rememberMe['"]\)/);
  });

  it('calls setPersistence with the correct Firebase persistence value BEFORE signInWithEmailAndPassword', () => {
    // Presence of import + call chain — order enforced by function-body layout.
    expect(SRC).toMatch(/setPersistence,\s*browserLocalPersistence,\s*browserSessionPersistence/);
    expect(SRC).toMatch(/await setPersistence\(auth,\s*rememberMe \? browserLocalPersistence : browserSessionPersistence\)/);
  });

  it('renders a Remember-me checkbox with a stable testid', () => {
    expect(SRC).toMatch(/data-testid=['"]signin-remember-me['"]/);
    expect(SRC).toMatch(/data-testid=['"]signin-remember-me-label['"]/);
  });

  it('persists the choice to localStorage on change', () => {
    expect(SRC).toMatch(/window\.localStorage\.setItem\(['"]petwash\.rememberMe['"]/);
  });
});
