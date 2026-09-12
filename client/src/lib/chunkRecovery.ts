/**
 * Stale / failed code-split chunk recovery — ONE implementation, shared by the
 * boot script (main.tsx) and the AppErrorBoundary.
 *
 * 2026-09-13 — monitoring alert "Cannot read properties of undefined (reading
 * 'default')" at <Lazy> on /payment-status. Root cause was OUR recovery code:
 *
 *   main.tsx listened for `vite:preloadError` and called `preventDefault()`.
 *   Vite's preload helper is `baseModule().catch(handlePreloadError)`; when the
 *   event is default-prevented it does NOT rethrow, so the catch returns
 *   `undefined` and the dynamic import RESOLVES to `undefined`. React.lazy then
 *   reads `undefined.default` → TypeError. The boundary's chunk detector did not
 *   know that message, so it was classified as a "render" crash: crash card +
 *   critical alert, and no reload. And when main.tsx's 12s throttle skipped the
 *   reload, nothing reloaded at all.
 *
 * Rules now:
 *   - never preventDefault the preload error — let the real error reach the
 *     boundary, which knows it is a chunk failure;
 *   - reload attempts are counted in sessionStorage (in-memory counters reset on
 *     every reload, so a permanently missing chunk used to reload forever).
 */

const RELOAD_KEY = 'pw_chunk_reload_at';
const RELOAD_COUNT_KEY = 'pw_chunk_reload_count';
/** Window in which reload attempts are counted. */
const WINDOW_MS = 60_000;
/** Max automatic reloads inside the window; after that the manual card shows. */
const MAX_AUTO_RELOADS = 2;

/**
 * Messages that mean "a code-split chunk the running bundle expects failed to
 * load" across Chrome, Safari, Firefox and Vite. `reading 'default'` is the
 * React.lazy symptom of a module that resolved to undefined (see header).
 */
export const CHUNK_ERROR_PATTERN =
  /valid JavaScript MIME type|dynamically imported module|module script failed|Loading (chunk|CSS chunk)|error loading dynamically imported|Importing a module script failed|Unable to preload CSS|reading ['"]default['"]/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: unknown; message?: unknown };
  if (e.name === 'ChunkLoadError') return true;
  const msg = typeof e.message === 'string' ? e.message : typeof error === 'string' ? error : '';
  return CHUNK_ERROR_PATTERN.test(msg);
}

/**
 * Reload to pull the current index.html + chunks, unless we already reloaded
 * MAX_AUTO_RELOADS times in the last minute. Returns true when a reload was
 * started (the caller should render nothing and send no alert).
 */
let reloadStarted = false;

export function tryChunkReload(now: number = Date.now()): boolean {
  // The preload event, the boundary and window.onerror can all fire for ONE
  // failure — count it once per page life.
  if (reloadStarted) return true;
  let storage: Storage | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }
  if (!storage) {
    // No storage (blocked site data) → we cannot bound a loop. Do not reload;
    // the boundary shows its "reload to get the latest version" button instead.
    return false;
  }
  try {
    const last = Number(storage.getItem(RELOAD_KEY) || 0);
    let count = Number(storage.getItem(RELOAD_COUNT_KEY) || 0);
    if (!(now - last < WINDOW_MS)) count = 0;
    if (count >= MAX_AUTO_RELOADS) return false;
    storage.setItem(RELOAD_KEY, String(now));
    storage.setItem(RELOAD_COUNT_KEY, String(count + 1));
  } catch {
    return false;
  }
  reloadStarted = true;
  window.location.reload();
  return true;
}
