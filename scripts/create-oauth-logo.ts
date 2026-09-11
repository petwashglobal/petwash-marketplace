/**
 * Build the 120x120 square icon Google shows on "Sign in with Google".
 *
 * WHY THIS IS NOT A RESIZE OF THE WORDMARK (2026-09-12).
 *
 * The previous version did `sharp(official).resize(120,120,{fit:'contain'})`.
 * The official logo is a WORDMARK: 3072x1186, and its ink measures 2828x936 —
 * a ratio of 3.02, three times wider than tall. `contain` letterboxes that into
 * the square, so the mark lands as a 120x40 strip and TWO THIRDS OF GOOGLE'S
 * LOGO SLOT IS EMPTY. That is why the icon on the account chooser looks tiny
 * and unfinished: not a bad logo, a wide logo in a square hole.
 *
 * A square slot wants the SYMBOL, not the wordmark — Google prints the app
 * name next to it anyway, so the words are duplicated and shrunk for nothing.
 *
 * THE CROP IS THE REAL ASSET, NEVER A REDRAW. The brand rule is absolute: the
 * logo is a real file and is never hand-drawn, recreated or approximated. This
 * lifts the droplet-and-paw straight out of petwash-logo-official.png at its
 * measured pixel box and pads it to a square. Nothing is drawn, traced or
 * re-coloured.
 *
 * The box below was measured, not guessed: scanning ink columns in the top
 * band of the official file isolates the droplet at x 1914-2386, y 53-613.
 * It is deliberately EXACT — extending it even slightly pulls in the tops of
 * the letters sitting underneath the droplet, which is visible as black
 * crumbs along the bottom edge of the icon.
 *
 * Re-measure if the official logo file is ever replaced.
 */
import sharp from 'sharp';
import fs from 'fs';

const SOURCE = 'public/brand/petwash-logo-official.png';
const OUTPUT = 'public/brand/petwash-oauth-icon-120x120.png';

/** Measured droplet-and-paw box inside the official wordmark. */
const MARK = { left: 1914, top: 53, width: 473, height: 561 };
/** Breathing room, as a fraction of the mark. Google crops nothing; this is ours. */
const MARGIN_RATIO = 0.12;

async function createOAuthIcon() {
  const meta = await sharp(SOURCE).metadata();
  if (meta.width !== 3072 || meta.height !== 1186) {
    console.error(
      `\n  The official logo is ${meta.width}x${meta.height}, not 3072x1186.\n` +
      `  MARK was measured against the old file and will crop the wrong pixels.\n` +
      `  Re-measure the droplet box before running this.\n`,
    );
    process.exit(1);
  }

  const canvas = MARK.height + Math.round(MARK.height * MARGIN_RATIO) * 2;
  const mark = await sharp(SOURCE).extract(MARK).flatten({ background: '#FFFFFF' }).toBuffer();

  const squared = await sharp({
    create: { width: canvas, height: canvas, channels: 3, background: '#FFFFFF' },
  })
    .composite([{
      input: mark,
      left: Math.round((canvas - MARK.width) / 2),
      top: Math.round((canvas - MARK.height) / 2),
    }])
    .png()
    .toBuffer();

  await sharp(squared).resize(120, 120).png({ compressionLevel: 9 }).toFile(OUTPUT);

  // Report what a human would otherwise have to eyeball: how much of the
  // square the mark actually occupies. The old output scored 33%.
  const { data, info } = await sharp(OUTPUT).raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 128) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const fill = ((maxX - minX + 1) * (maxY - minY + 1)) / (info.width * info.height) * 100;
  const kb = fs.statSync(OUTPUT).size / 1024;

  console.log(`Wrote ${OUTPUT}`);
  console.log(`  120x120, ${kb.toFixed(1)} KB (Google's limit is 1024 KB)`);
  console.log(`  the mark fills ${fill.toFixed(0)}% of the square (the wordmark version managed 33%)`);
  if (fill < 40) {
    console.error('  That is too much empty space — the icon will look tiny on the account chooser.');
    process.exit(1);
  }
}

createOAuthIcon().catch((err) => { console.error(err); process.exit(1); });
