import sharp from 'sharp';
const [src, dest] = process.argv.slice(2);
// App Store icon rules: 1024x1024, NO alpha channel, no transparency.
await sharp(src).flatten({ background: '#0a0a0a' }).resize(1024, 1024, { fit: 'cover' }).removeAlpha().png().toFile(dest);
const m = await sharp(dest).metadata();
console.log(`wrote ${dest} ${m.width}x${m.height} channels=${m.channels} hasAlpha=${m.hasAlpha}`);
