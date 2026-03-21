import { useState, useEffect } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * milliseconds of inactivity. Useful for throttling query keys that change
 * on every keystroke or slider move.
 */
export function useDebounced<T>(value: T, delayMs = 375): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
