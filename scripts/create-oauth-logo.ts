import sharp from 'sharp';
import fs from 'fs';

async function createOAuthLogo() {
  try {
    const inputPath = 'public/brand/petwash-logo-official.png';
    const outputPath = 'public/brand/petwash-oauth-logo-120x120.png';
    
    // Get image metadata
    const metadata = await sharp(inputPath).metadata();
    console.log(`Original logo: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
    
    // Create 120x120 square logo (Google OAuth requirement)
    await sharp(inputPath)
      .resize(120, 120, {
        fit: 'contain', // Preserve aspect ratio, add padding if needed
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
      })
      .png({ quality: 100 })
      .toFile(outputPath);
    
    const stats = fs.statSync(outputPath);
    console.log(`✅ Created OAuth logo: ${outputPath}`);
    console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB (max 1024 KB for Google)`);
    
    if (stats.size > 1024 * 1024) {
      console.error('❌ Logo exceeds 1MB limit!');
    } else {
      console.log('✅ Logo size OK for Google OAuth consent screen');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createOAuthLogo();
