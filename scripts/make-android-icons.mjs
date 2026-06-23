import sharp from 'sharp';
import path from 'path';

const apps = [
  { name: 'provider', src: '/Users/nirhadadnewmacbook2026/Downloads/PETWASH_PROVIDER.PNG', res: 'android/app/src/main/res' },
  { name: 'customer', src: 'ios-customer/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', res: 'android-customer/app/src/main/res' },
];
const LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FG     = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

const circle = (s) => Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s/2}" cy="${s/2}" r="${s/2}" fill="#fff"/></svg>`);

for (const app of apps) {
  for (const [dpi, size] of Object.entries(LEGACY)) {
    const dir = path.join(app.res, `mipmap-${dpi}`);
    // square (legacy launcher)
    await sharp(app.src).flatten({ background: '#ffffff' }).resize(size, size, { fit: 'cover' }).removeAlpha().png().toFile(path.join(dir, 'ic_launcher.png'));
    // round (circle-masked)
    const sq = await sharp(app.src).flatten({ background: '#ffffff' }).resize(size, size, { fit: 'cover' }).png().toBuffer();
    await sharp(sq).composite([{ input: circle(size), blend: 'dest-in' }]).png().toFile(path.join(dir, 'ic_launcher_round.png'));
    // adaptive foreground (transparent, icon ~80% within the 108dp safe zone)
    const fg = FG[dpi], inner = Math.round(fg * 0.80), pad = Math.round((fg - inner) / 2);
    const innerBuf = await sharp(app.src).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await sharp(innerBuf).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
  }
  console.log(`✓ ${app.name}: all densities (launcher + round + adaptive foreground)`);
}
