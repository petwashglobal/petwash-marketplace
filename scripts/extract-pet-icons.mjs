/**
 * extract-pet-icons.mjs — slice the CEO's luxury icon contact-sheet into individual
 * premium icons per the PetWash icon-system spec.
 *
 * Per spec: auto-detected content boxes (NOT blind row bands), NO label text, NO
 * header, NO grey background, NO clipped heads. Each output is a SQUARE canvas with
 * a WHITE background + breathing space (icon occupies ~74%, ≥13% padding all sides),
 * named by stable icon_key, written to the category folder.
 *
 * Boxes were auto-detected by content profiling (exact, not eyeballed).
 * Usage: node scripts/extract-pet-icons.mjs <board.png> [--preview]
 */
import sharp from 'sharp';
import { PNG } from 'pngjs';
import { promises as fs } from 'fs';
import path from 'path';

const WHITE = 236, NEAR = 18;
const CANVAS = 512, OCCUPANCY = 0.74; // icon fills 74% of the square; rest is white breathing space
const ICON_ROOT = 'client/public/assets/icons/petwash';

// detection-name → [icon_key, category]  (spec naming)
const KEY_MAP = {
  dog: ['animal_dog', 'animals'], cat: ['animal_cat', 'animals'], rabbit: ['animal_rabbit', 'animals'],
  'guinea-pig': ['animal_guinea_pig', 'animals'], snake: ['animal_snake', 'animals'], pony: ['animal_pony', 'animals'],
  horse: ['animal_horse', 'animals'], bird: ['animal_bird', 'animals'], fish: ['animal_fish', 'animals'], turtle: ['animal_turtle', 'animals'],
  paw: ['brand_paw', 'brand'], 'pet-owner': ['brand_pet_owner', 'brand'], 'botanical-leaf': ['nature_leaf', 'nature'],
  shampoo: ['product_shampoo', 'products'], conditioner: ['product_conditioner', 'products'], bubbles: ['nature_bubbles', 'nature'],
  'water-droplet': ['nature_water_drop', 'nature'], 'grooming-brush': ['product_grooming_brush', 'products'], towel: ['product_towel', 'products'],
  collar: ['product_collar', 'products'], treat: ['product_treat', 'products'], sparkle: ['brand_sparkle', 'brand'],
  'natural-ingredients': ['nature_natural_ingredients', 'nature'], 'pet-safe': ['trust_pet_safe', 'trust'],
};

const PAD = 6;
const BOARD_1 = {
  rows: [
    { top: 261, bottom: 430, cols: [['dog',68,202],['cat',254,385],['rabbit',441,553],['guinea-pig',599,726],['snake',765,886],['pony',922,1054],['horse',1085,1224],['bird',1257,1349],['fish',1377,1481],['turtle',1501,1650]] },
    { top: 491, bottom: 661, cols: [['paw',61,192],['pet-owner',248,394],['botanical-leaf',442,556],['shampoo',626,697],['conditioner',769,841],['bubbles',923,1053],['water-droplet',1124,1211],['grooming-brush',1281,1408],['towel',1466,1616]] },
    { top: 745, bottom: 885, cols: [['collar',328,511],['treat',599,748],['sparkle',846,961],['natural-ingredients',1066,1217],['pet-safe',1280,1399]] },
  ],
};

function cells() {
  const out = [];
  for (const row of BOARD_1.rows)
    for (const [name, x0, x1] of row.cols)
      out.push({ name, left: Math.max(0, x0 - PAD), top: Math.max(0, row.top - PAD), width: (x1 - x0) + PAD * 2, height: (row.bottom - row.top) + PAD * 2 });
  return out;
}

const isWhite = (r, g, b) => r >= WHITE && g >= WHITE && b >= WHITE && (Math.max(r, g, b) - Math.min(r, g, b)) <= NEAR;

/** Flood-fill transparency from the border over connected near-white pixels. */
function cutBackground(png) {
  const { width, height, data } = png;
  const seen = new Uint8Array(width * height), stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x; if (seen[p]) return; seen[p] = 1; const i = p * 4;
    if (isWhite(data[i], data[i + 1], data[i + 2])) { data[i + 3] = 0; stack.push(p); }
  };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  while (stack.length) { const p = stack.pop(), x = p % width, y = (p / width) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
  return png;
}

async function extractOne(board, cell) {
  const raw = await sharp(board).extract({ left: cell.left, top: cell.top, width: cell.width, height: cell.height }).ensureAlpha().png().toBuffer();
  const png = PNG.sync.read(raw); cutBackground(png);
  const cut = PNG.sync.write(png);
  const inner = Math.round(CANVAS * OCCUPANCY);
  const pad = Math.round((CANVAS - inner) / 2);
  // Trim transparent margin → fit into the inner box on WHITE → pad to square white tile.
  const innerBuf = await sharp(cut).trim({ threshold: 1 }).resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
  const [key, category] = KEY_MAP[cell.name] || [cell.name, 'misc'];
  const dir = path.join(ICON_ROOT, category);
  await fs.mkdir(dir, { recursive: true });
  const outPath = path.join(dir, `${key}.png`);
  await sharp(innerBuf).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toFile(outPath);
  return { key, category, outPath };
}

const [boardPath, ...flags] = process.argv.slice(2);
if (!boardPath) { console.error('usage: node scripts/extract-pet-icons.mjs <board.png> [--preview]'); process.exit(1); }

const list = cells();
const results = [];
for (const cell of list) {
  try { const r = await extractOne(boardPath, cell); results.push(r); console.log('✓', r.key, '→', r.outPath); }
  catch (e) { console.error('✗', cell.name, e.message); }
}

if (flags.includes('--preview')) {
  const size = 132, cols = 10, gap = 10;
  const rows = Math.ceil(results.length / cols);
  const W = cols * (size + gap) + gap, H = rows * (size + gap) + gap;
  const comps = [];
  for (let i = 0; i < results.length; i++) {
    const buf = await sharp(results[i].outPath).resize(size, size).png().toBuffer();
    comps.push({ input: buf, left: gap + (i % cols) * (size + gap), top: gap + Math.floor(i / cols) * (size + gap) });
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 230, g: 232, b: 235, alpha: 1 } } }).composite(comps).png().toFile('/tmp/_petwash_preview.png');
  console.log('preview → /tmp/_petwash_preview.png');
}
