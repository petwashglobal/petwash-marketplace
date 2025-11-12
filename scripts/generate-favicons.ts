import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function generateFavicons() {
  const logoPath = join(process.cwd(), 'client/public/brand/petwash-logo-official.png');
  const publicDir = join(process.cwd(), 'client/public');

  console.log('🎨 Generating favicons from official Pet Wash™ logo...');

  try {
    // Generate apple-touch-icon.png (180x180)
    await sharp(logoPath)
      .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(join(publicDir, 'apple-touch-icon.png'));
    console.log('✅ Created apple-touch-icon.png (180x180)');

    // Generate android-chrome-192x192.png
    await sharp(logoPath)
      .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(join(publicDir, 'android-chrome-192x192.png'));
    console.log('✅ Created android-chrome-192x192.png');

    // Generate android-chrome-512x512.png
    await sharp(logoPath)
      .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(join(publicDir, 'android-chrome-512x512.png'));
    console.log('✅ Created android-chrome-512x512.png');

    // Generate favicon.ico (32x32)
    const favicon32Buffer = await sharp(logoPath)
      .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    
    writeFileSync(join(publicDir, 'favicon.ico'), favicon32Buffer);
    console.log('✅ Created favicon.ico (32x32)');

    console.log('🎉 All favicons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating favicons:', error);
    process.exit(1);
  }
}

generateFavicons();
