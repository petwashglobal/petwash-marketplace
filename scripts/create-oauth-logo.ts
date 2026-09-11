/**
 * Build the brand images Google and the browser show for PetWash™.
 *
 *   1. the OAuth icon on "Sign in with Google"  — the FULL official wordmark
 *   2. the favicon / URL-bar mark               — the droplet alone
 *
 * WHICH SOURCE, AND WHY NOT THE BIG ONE (2026-09-12).
 *
 * public/brand/petwash-logo-official.png is 3072x1186 and looks like the
 * highest-resolution copy we own. It is not. Measured by normalising both
 * files to the same 300px mark height and counting pixels that are neither
 * near-black nor near-white — the anti-aliasing smear that upscaling creates:
 *
 *   petwash-logo-official.png ............ mark 2828x936, soft edge 9.85%
 *   petwash-logo-black-on-white.png ...... mark  600x202, soft edge 4.90%
 *
 * The 3072px file is an UPSCALE: five times the pixels, twice the mush. The
 * 600x202 copy is the crispest true rendering of the wordmark in the repo, so
 * it is the master here even though its pixel count is smaller.
 *
 * THE WORDMARK IS THE LOGO. An earlier pass cropped the droplet out on its own
 * because a 3:1 wordmark can only fill about a third of a square slot. That was
 * wrong: the droplet alone is not the logo. It is used here ONLY for the
 * favicon, where a 16px wordmark would be an illegible smudge and the droplet
 * is the only thing that reads.
 *
 * NOTHING IS DRAWN. Both outputs are crops and scales of a real brand file.
 * The logo is never traced, re-lettered or approximated.
 *
 * CEILING WORTH KNOWING: neither source is vector, so there is a size beyond
 * which nothing here can look sharp. For a logo that is flawless at every size,
 * the original vector (AI / EPS / true SVG) has to come from whoever drew it.
 * client/public/brand/petwash-logo.svg is NOT that file — it is a fake built
 * from circles and Arial, and is deleted in this change.
 */
import sharp from 'sharp';
import fs from 'fs';

/** Crispest true rendering of the official wordmark we hold. */
const SOURCE = 'client/src/assets/brand/petwash-logo-black-on-white.png';
const OAUTH_OUT = 'public/brand/petwash-oauth-icon-120x120.png';
const FAVICON_OUT = 'public/brand/petwash-mark-512.png';

/** Ink bounding box, measured — never assumed. Re-runs if the file changes. */
async function inkBox(file: string) {
  const { data, info } = await sharp(file).flatten({ background: '#FFFFFF' }).greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[y * W + x] < 128) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, canvasW: W, canvasH: H };
}


/**
 * The droplet is the only large mark sitting above the letters' cap line.
 * Scanning for it survives a change of source file; hard-coded fractions do
 * not — they clipped it in half the first time.
 */
async function dropletBox(file: string, mark: { left: number; top: number; width: number; height: number }) {
  const { data, info } = await sharp(file).flatten({ background: '#FFFFFF' }).greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const ink = (x: number, y: number) => data[y * W + x] < 128;

  // The left 40% of the wordmark holds letters and no droplet, so the first
  // ink there is the cap line.
  let letterTop = mark.top + mark.height;
  outer: for (let y = mark.top; y < mark.top + mark.height; y++) {
    for (let x = mark.left; x < mark.left + Math.floor(mark.width * 0.4); x++) {
      if (ink(x, y)) { letterTop = y; break outer; }
    }
  }

  // Horizontal runs of ink above that line: the droplet, then the small ™.
  const runs: Array<[number, number]> = [];
  let inRun = false, start = 0;
  for (let x = mark.left; x < mark.left + mark.width; x++) {
    let any = false;
    for (let y = mark.top; y < letterTop; y++) if (ink(x, y)) { any = true; break; }
    if (any && !inRun) { inRun = true; start = x; }
    else if (!any && inRun) { inRun = false; runs.push([start, x - 1]); }
  }
  if (inRun) runs.push([start, mark.left + mark.width - 1]);
  if (runs.length === 0) throw new Error('No ink found above the letters — is this the right logo file?');

  const [dl, dr] = runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];

  // The droplet TOUCHES the letter beneath it, so "scan down until the column
  // is empty" never stops — it runs to the baseline and returns a box twice the
  // real height, which then centres the droplet in the top third of the canvas.
  // Walk down only until the ink WIDENS into the letter: the droplet tapers,
  // the letter does not.
  let top = mark.top + mark.height;
  for (let y = mark.top; y < mark.top + mark.height; y++) {
    let any = false;
    for (let x = dl; x <= dr; x++) if (ink(x, y)) { any = true; break; }
    if (any) { top = y; break; }
  }
  let bottom = top;
  let prevWidth = 0;
  for (let y = top; y < mark.top + mark.height; y++) {
    let first = -1, last = -1;
    for (let x = dl; x <= dr; x++) if (ink(x, y)) { if (first < 0) first = x; last = x; }
    if (first < 0) break;                       // clean gap — droplet ended
    const w = last - first + 1;
    if (prevWidth && w > prevWidth * 1.6 && y > top + (dr - dl)) break;  // letter began
    prevWidth = w;
    bottom = y;
  }
  return { left: dl, top, width: dr - dl + 1, height: bottom - top + 1 };
}

async function build() {
  const box = await inkBox(SOURCE);
  const ratio = box.width / box.height;
  if (ratio < 2.5 || ratio > 3.5) {
    console.error(`\n  The mark in ${SOURCE} measures ${box.width}x${box.height} (ratio ${ratio.toFixed(2)}).`);
    console.error(`  The official wordmark is about 3:1. This is a different asset — check before trusting it.\n`);
    process.exit(1);
  }

  // ── 1. OAuth icon: the whole wordmark, as large as a square permits ───────
  // A 3:1 mark in a 1:1 slot tops out near a third of the area. Trimming the
  // source's own padding first is what buys the difference between "tiny" and
  // "as big as it can be" — the old script skipped that and letterboxed the
  // full padded canvas, which is why the icon looked lost.
  // Padding is a fraction of the 120px OUTPUT, not of the 600px source. Taking
  // 4% of the source gave a 24px inset on a 120px canvas — the wordmark came
  // out 72px wide and filled 12% of the square, worse than the bug being fixed.
  const pad = Math.round(120 * 0.04);
  const mark = await sharp(SOURCE).extract(box).flatten({ background: '#FFFFFF' })
    .resize({ width: 120 - pad * 2, kernel: 'lanczos3' }).toBuffer();
  const markMeta = await sharp(mark).metadata();
  await sharp({ create: { width: 120, height: 120, channels: 3, background: '#FFFFFF' } })
    .composite([{ input: mark, left: pad, top: Math.round((120 - (markMeta.height ?? 0)) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(OAUTH_OUT);

  // ── 2. Favicon mark: the droplet only ────────────────────────────────────
  // MEASURED, not guessed at with percentages. A first attempt placed this box
  // by fractions of the mark width and clipped the droplet in half, taking a
  // slice of the "h" with it. The droplet is the widest run of ink ABOVE the
  // line where the letters start, so find that line and find that run.
  const drop = await dropletBox(SOURCE, box);
  const dropMark = await sharp(SOURCE).extract(drop).flatten({ background: '#FFFFFF' }).toBuffer();
  const side = Math.max(drop.width, drop.height);
  const canvas = side + Math.round(side * 0.14) * 2;
  // TWO STAGES ON PURPOSE. sharp runs resize BEFORE composite regardless of the
  // order they are chained, so a single chain scaled the blank canvas to 512 and
  // then pasted the droplet at its original 103px — a small mark in the corner
  // of a big white square. Compose first, hand the result to a new pipeline,
  // then scale.
  const composed = await sharp({ create: { width: canvas, height: canvas, channels: 3, background: '#FFFFFF' } })
    .composite([{ input: dropMark, left: Math.round((canvas - drop.width) / 2), top: Math.round((canvas - drop.height) / 2) }])
    .png()
    .toBuffer();
  await sharp(composed)
    .resize(512, 512, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(FAVICON_OUT);

  for (const out of [OAUTH_OUT, FAVICON_OUT]) {
    const m = await sharp(out).metadata();
    console.log(`${out}  ${m.width}x${m.height}  ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
  }
  console.log(`source mark: ${box.width}x${box.height} (ratio ${ratio.toFixed(2)})`);
}

build().catch((err) => { console.error(err); process.exit(1); });
