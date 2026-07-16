/**
 * Build-time prerender for the public marketing routes (SEO audit #234:
 * "the SPA is crawler-blind"). Runs AFTER `vite build`, renders each route in
 * headless Chrome against the built bundle, and writes real HTML snapshots
 * into dist/public/<route>/index.html.
 *
 * Firebase Hosting serves existing static files BEFORE applying the SPA
 * rewrite, so crawlers and AI answer engines get contentful HTML (titles,
 * JSON-LD, visible copy) while human browsers hydrate straight into the app —
 * React 18 createRoot simply re-renders over the snapshot.
 *
 * Design constraints:
 *  - NO runtime infrastructure and NO SaaS (in-house + free rule): this is a
 *    dev-only dependency exercised at build time.
 *  - The local server has NO /api backend, exactly like a crawler's first
 *    paint — pages must (and do) render their static marketing content;
 *    dynamic panels render their honest empty/fallback states.
 *  - FAIL-CLOSED per route, FAIL-OPEN overall: a route that errors or renders
 *    an empty shell is SKIPPED (crawler keeps getting the SPA shell for it,
 *    same as today) and reported; only a total failure exits non-zero.
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist', 'public');

// Public, indexable marketing routes only. No auth pages, no noindex signup,
// no member surfaces. Keep this list in sync with lib/seo.ts pageSEO.
const ROUTES = [
  '/',
  '/locations',
  '/loyalty',
  '/loyalty/tiers',
  '/packages',
  '/egift',
  '/sitter-suite',
  '/walk-my-pet',
  '/academy',
  '/prestige-club',
  '/trust',
  '/support',
];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml',
};

async function serveDist() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let path = decodeURIComponent(url.pathname);
      if (path.endsWith('/')) path += 'index.html';
      let file = join(DIST, path);
      try {
        const st = await stat(file);
        if (st.isDirectory()) file = join(file, 'index.html');
        await stat(file);
      } catch {
        // SPA fallback — mirror of the Firebase rewrite
        file = join(DIST, 'index.html');
      }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(500); res.end('prerender static server error');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: server.address().port };
}

const { server, port } = await serveDist();
console.log(`[prerender] serving dist/public on 127.0.0.1:${port}`);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

let ok = 0;
const skipped = [];

for (const route of ROUTES) {
  const page = await browser.newPage();
  try {
    // Block external hosts: deterministic snapshots, no third-party calls at
    // build time (fonts/analytics/recaptcha all irrelevant to the HTML).
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.hostname === '127.0.0.1') r.continue();
      else r.abort();
    });
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle2', timeout: 30000 });
    // Give React a beat to settle post-idle (lazy chunks, useSEO effects).
    await new Promise((r) => setTimeout(r, 800));

    const { html, textLen, title } = await page.evaluate(() => ({
      html: '<!DOCTYPE html>\n' + document.documentElement.outerHTML,
      textLen: (document.body.innerText || '').trim().length,
      title: document.title,
    }));

    // A snapshot with no real text is worse than none — skip, keep SPA shell.
    if (textLen < 200) {
      skipped.push(`${route} (only ${textLen} chars of text)`);
      continue;
    }

    const outDir = route === '/' ? DIST : join(DIST, route.slice(1));
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'index.html'), html, 'utf8');
    ok++;
    console.log(`[prerender] ✓ ${route}  "${title}"  ${(html.length / 1024).toFixed(0)}kB, ${textLen} chars`);
  } catch (err) {
    skipped.push(`${route} (${err.message.slice(0, 80)})`);
  } finally {
    await page.close().catch(() => {});
  }
}

await browser.close();
server.close();

if (skipped.length) console.warn(`[prerender] SKIPPED (SPA shell kept): ${skipped.join(' · ')}`);
console.log(`[prerender] done — ${ok}/${ROUTES.length} routes snapshotted`);

// Only a wholesale failure should break the build; partial coverage is still
// strictly better than the bare SPA shell.
if (ok === 0) {
  console.error('[prerender] every route failed — refusing to ship zero snapshots');
  process.exit(1);
}
