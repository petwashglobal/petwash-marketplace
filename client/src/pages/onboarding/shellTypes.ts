/**
 * Shared types for pet onboarding step components (PR-PET-4).
 * Kept tiny so each step file stays self-contained.
 */

/** A `t(key)` function injected from the shell — same shape as the
 *  rest of the codebase's i18n consumers (key in, string out). */
export type TFn = (key: string) => string;
