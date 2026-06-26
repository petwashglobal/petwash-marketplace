// One-off: regenerate every app-icon raster for BOTH native apps from the new
// brand sources, preserving each target file's existing dimensions.
//   Provider  (ios/, android/)            <- brand/PETWASG_PROVIDOR.png        (white bg)
//   Customer  (ios-customer/, android-customer/) <- brand/FINAL_PETWASH_PRESTIGE_APP_ICON.png (black bg)
// App-store rule: 1024x1024, NO alpha, no transparency. Round/adaptive layers keep alpha.
import sharp from 'sharp';
import { existsSync } from 'fs';

const APPS = [
  {
    name: 'Provider',
    src: 'brand/PETWASG_PROVIDOR.png',
    bg: '#FFFFFF',
    ios: 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
    androidRoot: 'android/app/src/main/res',
  },
  {
    name: 'Customer',
    src: 'brand/FINAL_PETWASH_PRESTIGE_APP_ICON.png',
    bg: '#0A0A0A',
    ios: 'ios-customer/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
    androidRoot: 'android-customer/app/src/main/res',
  },
];
const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

async function sizeOf(p) { return (await sharp(p).metadata()).width; }

async function flat(src, size, bg, dest) {
  await sharp(src).flatten({ background: bg }).resize(size, size, { fit: 'cover' }).removeAlpha().png().toFile(dest);
}
async function circle(src, size, bg, dest) {
  const base = await sharp(src).flatten({ background: bg }).resize(size, size, { fit: 'cover' }).png().toBuffer();
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
  await sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toFile(dest);
}

for (const app of APPS) {
  if (!existsSync(app.src)) throw new Error(`missing source ${app.src}`);
  // iOS — single 1024 store icon, full-bleed, no alpha
  const iosSize = await sizeOf(app.ios);
  await flat(app.src, iosSize, app.bg, app.ios);
  console.log(`[${app.name}] iOS ${iosSize}x${iosSize} <- ${app.src}`);
  // Android — each density: legacy square (no alpha), round (circle), adaptive foreground (full-bleed)
  for (const d of DENSITIES) {
    const dir = `${app.androidRoot}/mipmap-${d}`;
    const launcher = `${dir}/ic_launcher.png`;
    const round = `${dir}/ic_launcher_round.png`;
    const fg = `${dir}/ic_launcher_foreground.png`;
    if (existsSync(launcher)) { const s = await sizeOf(launcher); await flat(app.src, s, app.bg, launcher); }
    if (existsSync(round))    { const s = await sizeOf(round);    await circle(app.src, s, app.bg, round); }
    if (existsSync(fg))       { const s = await sizeOf(fg);       await flat(app.src, s, app.bg, fg); }
    console.log(`[${app.name}] android ${d} ok`);
  }
}
console.log('done');
