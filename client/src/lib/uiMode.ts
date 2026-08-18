/**
 * useUiMode — client UI mode preference for multi-role users.
 *
 * Per CEO 2026-08-18 §7 "Customer ↔ Provider mode switch":
 *   Multi-role user needs a Customer Mode and a Provider Mode.
 *   This is UI context.
 *   DO NOT mutate user.role on switch.
 *   DO NOT create another login.
 *   DO NOT create another Firebase user.
 *   DO NOT duplicate profile.
 *   Persist only preferred UI mode if useful.
 *   Authorization always remains server capability-based.
 *
 * This module stores the mode preference LOCALLY (localStorage) — server
 * authority (getUserCapabilities) is still the gate for whether the user
 * CAN switch to a given mode. The stored preference is only used by the
 * UI to decide which surface (customer vs provider) to render by default.
 *
 * All state lives in one module — every mounted ModeSwitch instance and
 * every consumer stays in sync via useSyncExternalStore.
 */

import { useSyncExternalStore, useCallback } from 'react';

export type UiMode = 'customer' | 'provider';

const STORAGE_KEY = 'pw_ui_mode';
const VALID_MODES: readonly UiMode[] = ['customer', 'provider'] as const;

function isUiMode(v: unknown): v is UiMode {
  return typeof v === 'string' && (VALID_MODES as readonly string[]).includes(v);
}

function readFromStorage(): UiMode {
  if (typeof window === 'undefined') return 'customer';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isUiMode(v) ? v : 'customer';
  } catch {
    return 'customer';
  }
}

function writeToStorage(mode: UiMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private-mode errors */
  }
}

/**
 * Module-level listener registry. Every hook subscriber gets notified
 * when setUiMode() is called anywhere in the app.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Cross-tab: `storage` event fires in OTHER tabs. React within-tab
  // consumers are already covered by the module registry.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

function emit(): void {
  for (const l of listeners) l();
}

function getSnapshot(): UiMode {
  return readFromStorage();
}
function getServerSnapshot(): UiMode {
  // SSR-safe default; matches localStorage fallback.
  return 'customer';
}

/**
 * useUiMode — reads and writes the persisted UI mode.
 * Returns [currentMode, setMode].
 *
 * Note: this hook does NOT enforce capability. Wrap the setter in a
 * capability check at the call site (e.g. only offer "provider" mode
 * when useUserCapabilities().capabilities.provider.active is true).
 */
export function useUiMode(): [UiMode, (mode: UiMode) => void] {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setMode = useCallback((next: UiMode) => {
    if (!isUiMode(next)) return;
    writeToStorage(next);
    emit();
  }, []);
  return [mode, setMode];
}

/** Non-hook read for imperative code paths (redirects, guards). */
export function readUiMode(): UiMode {
  return readFromStorage();
}
