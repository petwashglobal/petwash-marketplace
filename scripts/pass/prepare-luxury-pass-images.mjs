#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..', '..');
const defaultCard = path.join(root, 'client/src/assets/prestige-card-black.png');
const finalCleanMockup = path.join(process.env.HOME || '', 'Downloads/ChatGPT Image May 31, 2026 at 05_12_48 PM (1).png');
const officialLogo = path.join(root, 'public/brand/petwash-logo-official.png');
const defaultIconCandidates = [
  path.join(process.env.HOME || '', 'Desktop/PetWash/PetWash/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png'),
  path.join(root, 'client/src/assets/prestige-logo-diamond.png'),
];

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const apply = args.includes('--apply');
const finalClean = args.includes('--final-clean') || process.env.PETWASH_PASS_STYLE === 'final-clean';
const cardSource = path.resolve(
  getArg('--card-source')
    || process.env.PETWASH_PASS_CARD_SOURCE
    || (finalClean && fs.existsSync(finalCleanMockup) ? finalCleanMockup : defaultCard),
);
const iconSource = path.resolve(
  getArg('--icon-source')
    || process.env.PETWASH_PASS_ICON_SOURCE
    || defaultIconCandidates.find((candidate) => fs.existsSync(candidate))
    || defaultCard,
);
const logoSource = path.resolve(
  getArg('--logo-source')
    || process.env.PETWASH_PASS_LOGO_SOURCE
    || (fs.existsSync(officialLogo) ? officialLogo : iconSource),
);
const outDir = path.resolve(
  getArg('--out')
    || (apply ? path.join(root, 'wallet/apple-model.pass') : path.join(root, 'artifacts/wallet/pass-images')),
);

const ensureReadable = (file, label) => {
  if (!fs.existsSync(file)) {
    throw new Error(`${label} not found: ${file}`);
  }
};

ensureReadable(cardSource, 'Card source');
ensureReadable(iconSource, 'Icon source');
ensureReadable(logoSource, 'Logo source');
fs.mkdirSync(outDir, { recursive: true });

const writeCover = async (source, width, height, file) => {
  await sharp(source)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, file));
};

const writeContain = async (source, width, height, file) => {
  await sharp(source)
    .resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, file));
};

await writeCover(iconSource, 29, 29, 'icon.png');
await writeCover(iconSource, 58, 58, 'icon@2x.png');
await writeCover(iconSource, 87, 87, 'icon@3x.png');

await writeContain(logoSource, 160, 50, 'logo.png');
await writeContain(logoSource, 320, 100, 'logo@2x.png');
await writeContain(logoSource, 480, 150, 'logo@3x.png');

const stripPipeline = async (width, height, file) => {
  if (!finalClean) {
    await writeCover(cardSource, width, height, file);
    return;
  }

  await sharp(cardSource)
    .extract({ left: 0, top: 210, width: 941, height: 309 })
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, file));
};

await stripPipeline(375, 123, 'strip.png');
await stripPipeline(750, 246, 'strip@2x.png');
await stripPipeline(1125, 369, 'strip@3x.png');

await writeCover(iconSource, 90, 90, 'thumbnail.png');
await writeCover(iconSource, 180, 180, 'thumbnail@2x.png');
await writeCover(iconSource, 270, 270, 'thumbnail@3x.png');

const generated = [
  'icon.png',
  'icon@2x.png',
  'icon@3x.png',
  'logo.png',
  'logo@2x.png',
  'logo@3x.png',
  'strip.png',
  'strip@2x.png',
  'strip@3x.png',
  'thumbnail.png',
  'thumbnail@2x.png',
  'thumbnail@3x.png',
];

const rows = generated.map((file) => {
  const stat = fs.statSync(path.join(outDir, file));
  return `${file}\t${stat.size} bytes`;
});

console.log(`PetWash luxury pass images written to ${outDir}`);
console.log(`Card source: ${cardSource}`);
console.log(`Icon source: ${iconSource}`);
console.log(`Logo source: ${logoSource}`);
console.log(rows.join('\n'));
