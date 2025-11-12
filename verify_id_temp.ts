import { readFileSync } from 'fs';
import { ImageAnnotatorClient } from '@google-cloud/vision';

async function verifyID() {
  try {
    const imageBuffer = readFileSync('attached_assets/IMG_0267_1761988017657.jpeg');
    
    const visionClient = new ImageAnnotatorClient({
      credentials: process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        : undefined
    });

    console.log('📸 Analyzing ID document...\n');

    const [result] = await visionClient.documentTextDetection({
      image: { content: imageBuffer },
    });

    const detections = result.textAnnotations || [];
    
    if (detections.length === 0) {
      console.log('❌ No text detected in the image');
      return;
    }

    const fullText = detections[0]?.description || '';
    console.log('✅ Text extracted from document:\n');
    console.log('='.repeat(60));
    console.log(fullText);
    console.log('='.repeat(60));

    const lines = fullText.split('\n').map(line => line.trim());
    const mrzPattern = /^[A-Z0-9<]{30,44}$/;
    
    const mrzLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\s/g, '');
      if (mrzPattern.test(line) && line.length >= 30) {
        mrzLines.push(line);
      }
    }

    console.log('\n📋 Analysis Results:\n');
    
    if (mrzLines.length >= 2) {
      console.log('✅ MRZ (Machine Readable Zone) FOUND - Indicates AUTHENTIC passport');
      console.log('   MRZ lines detected:', mrzLines.length);
      console.log('\n🔐 MRZ Data (redacted for privacy):');
      mrzLines.forEach((line, idx) => {
        console.log(`   Line ${idx + 1}: ${line.substring(0, 5)}... (${line.length} chars)`);
      });
      
      if (mrzLines.length >= 2) {
        const line1 = mrzLines[0].padEnd(44, '<');
        const line2 = mrzLines[1].padEnd(44, '<');
        
        const docType = line1[0];
        const country = line1.substring(2, 5).replace(/</g, '');
        const nationality = line2.substring(10, 13).replace(/</g, '');
        
        console.log('\n📍 Document Information:');
        console.log(`   Type: ${docType === 'P' ? 'Passport' : docType === 'I' ? 'ID Card' : 'Other'}`);
        console.log(`   Issuing Country: ${country}`);
        console.log(`   Nationality: ${nationality}`);
      }
      
      console.log('\n✅ VERDICT: Document appears to be AUTHENTIC');
      console.log('   Real passports have properly formatted MRZ zones');
      
    } else {
      console.log('⚠️  No MRZ detected');
      console.log('   This could mean:');
      console.log('   - Document is NOT a passport/ID');
      console.log('   - Image quality is too low');
      console.log('   - Document is potentially FAKE');
      console.log('\n❌ VERDICT: Cannot confirm authenticity - suspicious');
    }

    const securityKeywords = ['hologram', 'microprint', 'watermark', 'security'];
    const hasSecurityText = securityKeywords.some(kw => 
      fullText.toLowerCase().includes(kw)
    );
    
    if (hasSecurityText) {
      console.log('\n🔒 Security features mentioned in text');
    }

    console.log('\n' + '='.repeat(60));

  } catch (error: any) {
    console.error('❌ Error analyzing document:', error.message);
  }
}

verifyID();
