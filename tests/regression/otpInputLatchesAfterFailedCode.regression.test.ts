import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 2026-09-08 — one rejected code killed the OTP form.
 *
 * OtpCodeInput fires onComplete once per fill and used a boolean ref to stop a
 * double-fire. That ref latched `true` and only cleared on Backspace or a
 * change to the `error` prop — and NONE of the three call sites in
 * SignUpLuxury (SMS signup, email signup, login 2FA) pass `error`. So on the
 * real screens it never cleared: after a rejected code, typing a fresh six
 * digits produced no request and no feedback. The only escape was a Backspace
 * the customer has no reason to try.
 *
 * Found driving the real production signup, immediately after the verify-404
 * (#2306) was fixed: I had to backspace one digit to get a second attempt to
 * fire at all.
 *
 * THIS IS A SOURCE PIN, and deliberately labelled as one. The repo has no
 * jsdom / @testing-library harness, and adding one for a single component was
 * a bigger change than the fix. It asserts the invariant at the two places a
 * regression would land — both edit paths must clear the latch — rather than
 * claiming to have re-run the browser behaviour.
 */

const root = resolve(import.meta.dirname, "../..");

/** Comments stripped: a pin must never pass on its own explanation. */
function code(path: string): string {
  return readFileSync(resolve(root, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("OtpCodeInput lets the customer try a second code", () => {
  const src = code("client/src/components/OtpCodeInput.tsx");

  /** Slice one useCallback body, stopping at the NEXT top-level useCallback. */
  const body = (fnName: string): string => {
    const start = src.indexOf(`const ${fnName} = useCallback(`);
    expect(start, `${fnName} not found`).toBeGreaterThan(-1);
    const rest = src.slice(start + 10);
    const nextIdx = rest.search(/\n  const \w+ = useCallback\(/);
    return nextIdx === -1 ? rest : rest.slice(0, nextIdx);
  };

  it("typing a digit clears the completed latch", () => {
    expect(body("handleChange")).toContain("completedRef.current = false");
  });

  it("a paste or autofill clears the completed latch", () => {
    expect(body("distribute")).toContain("completedRef.current = false");
  });

  it("Backspace still clears it (the original, insufficient escape hatch)", () => {
    expect(body("handleKeyDown")).toContain("completedRef.current = false");
  });

  it("records that no call site passes `error`, so that reset path is dead", () => {
    // If someone later wires `error`, this pin should be revisited rather than
    // silently kept — the comment above explains why the latch cannot rely on it.
    const page = code("client/src/pages/SignUpLuxury.tsx");
    const usages = page.match(/<OtpCodeInput[^>]*>/g) ?? [];
    expect(usages.length).toBeGreaterThanOrEqual(3);
    for (const usage of usages) {
      expect(usage).not.toContain("error=");
    }
  });
});
