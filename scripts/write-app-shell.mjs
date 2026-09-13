/**
 * Write dist/public/app-shell.html — the page Firebase Hosting serves for every
 * route that has no prerendered snapshot of its own (firebase.json `**` rewrite).
 *
 * WHY (2026-09-13): the rewrite pointed at /index.html, and scripts/prerender.mjs
 * writes the HOMEPAGE snapshot to that very file. So /legal/terms, /careers,
 * /contact, /franchise, /status … (26 of the 33 hamburger-menu items) were served
 * the homepage: home <title>, home H1, the YouTube embed (its player loaded on
 * every page), and `<link rel="canonical" href="https://petwash.co.il/">` — which
 * tells Google those pages are duplicates of the homepage.
 *
 * The shell is the pristine Vite index.html (empty #root) with the homepage-only
 * canonical + og:url removed; useSEO sets the correct canonical per route at
 * runtime (client/src/lib/seo.ts).
 *
 * Runs as `postbuild` (so the file exists even if the prerender step is skipped)
 * and again at the start of scripts/prerender.mjs. Idempotent. Refuses to write a
 * shell from an index.html that is already a prerendered snapshot.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_SHELL_FILE = 'app-shell.html';

/** Pure transform — exported for tests. Throws if `html` is not a pristine SPA shell. */
export function toAppShell(html) {
  if (!/<div id="root"><\/div>/.test(html)) {
    throw new Error('index.html is not a pristine SPA shell (#root is not empty) — refusing to write app-shell.html from a prerendered snapshot');
  }
  return html
    .replace(/[ \t]*<link rel="canonical"[^>]*>\s*\n?/gi, '')
    .replace(/[ \t]*<meta property="og:url"[^>]*>\s*\n?/gi, '');
}

export async function writeAppShell(dist) {
  const indexHtml = await readFile(join(dist, 'index.html'), 'utf8');
  const shell = toAppShell(indexHtml);
  await writeFile(join(dist, APP_SHELL_FILE), shell, 'utf8');
  return shell;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'public');
  await writeAppShell(dist);
  console.log(`[app-shell] wrote ${join(dist, APP_SHELL_FILE)}`);
}
