import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// 2026-08-20 /signup client crash — TDZ ReferenceError:
//
// SignUpLuxury.tsx used to declare, near the top of the component:
//   useEffect(() => {
//     if (resendCountdown <= 0) return;
//     const t = setInterval(() => setResendCountdown(...), 1000);
//     return () => clearInterval(t);
//   }, [resendCountdown]);
//
// …but `const [resendCountdown, setResendCountdown] = useState(0)` was declared
// ~200 lines further down. During the first render, evaluating the dep array
// `[resendCountdown]` reads a `const` binding before it is initialised — TDZ —
// so React throws before the component ever mounts. AppErrorBoundary caught it
// and showed "Something went wrong" (reference a5866ae2) on every /signup load.
//
// The fix: keep this useEffect BELOW the useState that owns the ticked value.
// This test pins that ordering so a future refactor can't reintroduce the bug.

describe('SignUpLuxury — resendCountdown effect must live below its useState (TDZ)', () => {
  const src = readFileSync(
    join(__dirname, '..', '..', 'client/src/pages/SignUpLuxury.tsx'),
    'utf8',
  );

  it('declares the useState before any effect that reads resendCountdown', () => {
    const stateIdx = src.indexOf('const [resendCountdown, setResendCountdown] = useState');
    expect(stateIdx, 'useState declaration must exist').toBeGreaterThan(-1);

    // Every occurrence of `resendCountdown` OUTSIDE JSX/handlers that appears
    // inside a `useEffect(() => {...}, [...resendCountdown...])` dep array must
    // come AFTER the useState declaration. Two lightweight checks:

    // 1) the tick effect itself
    const tickEffectIdx = src.indexOf('if (resendCountdown <= 0) return;');
    expect(tickEffectIdx, 'countdown-tick effect must exist').toBeGreaterThan(-1);
    expect(tickEffectIdx).toBeGreaterThan(stateIdx);

    // 2) any dep array that includes bare `resendCountdown` — must be below the state
    const depMatches = [...src.matchAll(/\},\s*\[[^\]]*\bresendCountdown\b[^\]]*\]\s*\)/g)];
    expect(depMatches.length, 'at least one dep array references resendCountdown').toBeGreaterThan(0);
    for (const m of depMatches) {
      expect(m.index, 'dep array referencing resendCountdown must appear below its useState').toBeGreaterThan(stateIdx);
    }
  });
});
