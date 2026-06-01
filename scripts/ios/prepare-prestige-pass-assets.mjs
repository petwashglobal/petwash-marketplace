#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import QRCode from 'qrcode';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..', '..');
const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const assetsRoot = path.resolve(
  getArg('--assets-root')
    || process.env.PETWASH_XCODE_ASSETS
    || path.join(process.env.HOME || '', 'Desktop/PetWash/PetWash/Assets.xcassets'),
);
const logoSource = path.resolve(
  getArg('--logo-source')
    || process.env.PETWASH_OFFICIAL_LOGO_SOURCE
    || path.join(root, 'public/brand/petwash-logo-official.png'),
);
const mockupSource = path.resolve(
  getArg('--mockup-source')
    || process.env.PETWASH_PASS_MOCKUP_SOURCE
    || path.join(process.env.HOME || '', 'Downloads/ChatGPT Image May 31, 2026 at 05_12_48 PM (2).png'),
);
const memberId = getArg('--member-id') || 'pass-founder-001c-f8f9e9fc';

const contents = (filename) => ({
  images: [
    { filename, idiom: 'universal', scale: '1x' },
    { idiom: 'universal', scale: '2x' },
    { idiom: 'universal', scale: '3x' },
  ],
  info: { author: 'xcode', version: 1 },
});

function ensureFile(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label} not found: ${file}`);
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureImageset(name, filename) {
  const dir = path.join(assetsRoot, `${name}.imageset`);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'Contents.json'), contents(filename));
  return path.join(dir, filename);
}

ensureFile(logoSource, 'Official logo');
ensureFile(mockupSource, 'Mockup source');
fs.mkdirSync(assetsRoot, { recursive: true });

fs.copyFileSync(logoSource, ensureImageset('PetWashOfficialLogo', 'PetWashOfficialLogo.png'));

await QRCode.toFile(ensureImageset('prestige_qr', 'prestige_qr.png'), memberId, {
  type: 'png',
  errorCorrectionLevel: 'M',
  margin: 1,
  width: 1024,
  color: { dark: '#000000', light: '#FFFFFF' },
});

const animalCrops = [
  { name: 'pet_dog', left: 48, top: 585, width: 132, height: 190 },
  { name: 'pet_cat', left: 178, top: 585, width: 130, height: 190 },
  { name: 'pet_rabbit', left: 308, top: 585, width: 130, height: 190 },
  { name: 'pet_parrot', left: 430, top: 575, width: 132, height: 200 },
  { name: 'pet_snake', left: 550, top: 625, width: 160, height: 150 },
  { name: 'pet_hamster', left: 704, top: 618, width: 118, height: 156 },
];

for (const crop of animalCrops) {
  await sharp(mockupSource)
    .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(ensureImageset(crop.name, `${crop.name}.png`));
}

console.log(`PetWash Prestige iOS assets written to ${assetsRoot}`);
console.log(`Official logo: ${logoSource}`);
console.log(`Mockup source: ${mockupSource}`);
console.log(`QR member id: ${memberId}`);
