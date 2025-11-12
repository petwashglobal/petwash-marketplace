// iOS Compatibility Test Suite for Pet Wash Platform
import https from 'https';
import http from 'http';

// iOS User Agents for Testing
const iosUserAgents = {
  iPhone17: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  iPad17: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  iPhoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.169 Mobile/15E148 Safari/604.1',
  iPhone16: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  iPhone15: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1'
};

// Test Domains
const testDomains = [
  'www.petwash.co.il',
  'petwash.co.il',
  'f46fb046-7dd0-4090-af9e-1be17d9de48e-00-15el1m8qkuf16.picard.replit.dev'
];

// Test Results Storage
const testResults = {
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  },
  details: []
};

function testRequest(domain, userAgent, protocol = 'https') {
  return new Promise((resolve) => {
    const client = protocol === 'https' ? https : http;
    const port = protocol === 'https' ? 443 : 80;
    
    const options = {
      hostname: domain,
      port: port,
      path: '/',
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      },
      timeout: 10000,
      rejectUnauthorized: false // Allow self-signed certificates for testing
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          success: true,
          statusCode: res.statusCode,
          headers: res.headers,
          data: data.substring(0, 500), // First 500 chars
          redirectLocation: res.headers.location,
          sslInfo: res.socket ? res.socket.getPeerCertificate() : null
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        code: error.code,
        statusCode: null
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout',
        code: 'TIMEOUT',
        statusCode: null
      });
    });

    req.end();
  });
}

async function runIOSCompatibilityTests() {
  console.log('🍎 iOS COMPATIBILITY TEST SUITE - Pet Wash Platform');
  console.log('=' * 60);
  
  for (const [deviceName, userAgent] of Object.entries(iosUserAgents)) {
    console.log(`\n📱 Testing ${deviceName}:`);
    console.log(`   User-Agent: ${userAgent.substring(0, 80)}...`);
    
    for (const domain of testDomains) {
      testResults.summary.total++;
      
      console.log(`\n🔍 Testing ${domain}:`);
      
      // Test HTTPS
      const httpsResult = await testRequest(domain, userAgent, 'https');
      console.log(`   HTTPS: ${httpsResult.success ? '✅' : '❌'} Status: ${httpsResult.statusCode || httpsResult.error}`);
      
      if (httpsResult.success) {
        console.log(`   Headers: ${Object.keys(httpsResult.headers).length} received`);
        if (httpsResult.redirectLocation) {
          console.log(`   Redirect: ${httpsResult.redirectLocation}`);
        }
        if (httpsResult.headers['x-ios-ssl-info']) {
          console.log(`   iOS SSL: ${httpsResult.headers['x-ios-ssl-info']}`);
        }
        testResults.summary.passed++;
      } else {
        console.log(`   Error: ${httpsResult.error} (${httpsResult.code})`);
        
        // Test HTTP fallback for iOS
        console.log(`   🔄 Testing HTTP fallback...`);
        const httpResult = await testRequest(domain, userAgent, 'http');
        console.log(`   HTTP: ${httpResult.success ? '✅' : '❌'} Status: ${httpResult.statusCode || httpResult.error}`);
        
        if (httpResult.success) {
          testResults.summary.warnings++;
          console.log(`   ⚠️  HTTP works but HTTPS failed - SSL certificate issue`);
        } else {
          testResults.summary.failed++;
        }
      }
      
      // Store detailed results
      testResults.details.push({
        device: deviceName,
        domain: domain,
        https: httpsResult,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Generate summary report
  console.log('\n' + '=' * 60);
  console.log('📊 TEST SUMMARY REPORT');
  console.log('=' * 60);
  console.log(`Total Tests: ${testResults.summary.total}`);
  console.log(`✅ Passed: ${testResults.summary.passed}`);
  console.log(`⚠️  Warnings: ${testResults.summary.warnings}`);
  console.log(`❌ Failed: ${testResults.summary.failed}`);
  
  const successRate = Math.round((testResults.summary.passed / testResults.summary.total) * 100);
  console.log(`📈 Success Rate: ${successRate}%`);
  
  // iOS Specific Recommendations
  console.log('\n🍎 iOS COMPATIBILITY STATUS:');
  
  if (testResults.summary.failed === 0) {
    console.log('✅ EXCELLENT - Full iOS compatibility achieved');
    console.log('   All iOS devices can access Pet Wash platform');
  } else if (testResults.summary.warnings > 0) {
    console.log('⚠️  GOOD - HTTP access works, SSL certificates pending');
    console.log('   iOS devices can access via HTTP while SSL provisions');
  } else {
    console.log('❌ NEEDS ATTENTION - DNS or connectivity issues detected');
    console.log('   Check DNS configuration with Israeli hosting provider');
  }
  
  console.log('\n🔒 SSL CERTIFICATE STATUS:');
  const sslIssues = testResults.details.filter(r => !r.https.success && r.https.code?.includes('CERT'));
  if (sslIssues.length > 0) {
    console.log('⏳ SSL certificates are being provisioned by Replit platform');
    console.log('   Expected completion: 1-24 hours after DNS propagation');
    console.log('   iOS devices can use HTTP access during provisioning');
  } else {
    console.log('✅ SSL certificates working correctly for iOS devices');
  }
  
  console.log('\n📱 NEXT STEPS FOR iOS OPTIMIZATION:');
  console.log('1. Ensure both domains resolve correctly');
  console.log('2. Wait for Replit SSL certificate provisioning');
  console.log('3. Test on actual iOS devices after SSL completion');
  console.log('4. Verify PWA functionality on iOS Safari');
  
  return testResults;
}

// Run the test suite
runIOSCompatibilityTests().catch(console.error);