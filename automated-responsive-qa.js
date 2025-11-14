#!/usr/bin/env node
/**
 * PetWash™ Automated Responsive QA System
 * Tests ALL device sizes (XS-3XL) in portrait + landscape
 * Generates screenshots + comprehensive HTML report
 */

import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Device matrix - ALL sizes user requested
const DEVICE_MATRIX = [
  // Extra Small (XS) - Mobile portrait
  { name: 'iPhone_SE_Portrait', width: 375, height: 667, orientation: 'portrait', category: 'XS' },
  { name: 'iPhone_SE_Landscape', width: 667, height: 375, orientation: 'landscape', category: 'XS' },
  { name: 'Galaxy_Fold_Portrait', width: 280, height: 653, orientation: 'portrait', category: 'XS' },
  
  // Small (SM) - Large mobile
  { name: 'iPhone_12_Pro_Portrait', width: 390, height: 844, orientation: 'portrait', category: 'SM' },
  { name: 'iPhone_12_Pro_Landscape', width: 844, height: 390, orientation: 'landscape', category: 'SM' },
  { name: 'iPhone_14_Pro_Max_Portrait', width: 430, height: 932, orientation: 'portrait', category: 'SM' },
  { name: 'Pixel_5_Portrait', width: 393, height: 851, orientation: 'portrait', category: 'SM' },
  
  // Medium (MD) - Tablets
  { name: 'iPad_Mini_Portrait', width: 768, height: 1024, orientation: 'portrait', category: 'MD' },
  { name: 'iPad_Mini_Landscape', width: 1024, height: 768, orientation: 'landscape', category: 'MD' },
  { name: 'Surface_Duo_Portrait', width: 540, height: 720, orientation: 'portrait', category: 'MD' },
  
  // Large (LG) - Large tablets
  { name: 'iPad_Pro_11_Portrait', width: 834, height: 1194, orientation: 'portrait', category: 'LG' },
  { name: 'iPad_Pro_11_Landscape', width: 1194, height: 834, orientation: 'landscape', category: 'LG' },
  { name: 'iPad_Air_Portrait', width: 820, height: 1180, orientation: 'portrait', category: 'LG' },
  
  // Extra Large (XL) - Desktops
  { name: 'Desktop_1440p', width: 1440, height: 900, orientation: 'landscape', category: 'XL' },
  { name: 'MacBook_Air', width: 1280, height: 800, orientation: 'landscape', category: 'XL' },
  
  // Extra Extra Large (2XL)
  { name: 'Desktop_1536p', width: 1536, height: 864, orientation: 'landscape', category: '2XL' },
  { name: 'iMac', width: 1600, height: 900, orientation: 'landscape', category: '2XL' },
  
  // Extra Extra Extra Large (3XL) - Ultra-wide
  { name: 'Ultra_Wide_1920', width: 1920, height: 1080, orientation: 'landscape', category: '3XL' },
  { name: 'Ultra_Wide_2560', width: 2560, height: 1440, orientation: 'landscape', category: '3XL' },
];

// Critical pages to test
const TEST_PAGES = [
  { url: '/', name: 'Landing', critical: true },
  { url: '/wallet', name: 'MyWallet', critical: true },
  { url: '/signin', name: 'SignIn', critical: true },
  { url: '/franchise', name: 'Franchise', critical: true },
  { url: '/k9000/overview', name: 'K9000', critical: false },
  { url: '/sitter-suite/overview', name: 'SitterSuite', critical: false },
  { url: '/walk-my-pet/overview', name: 'WalkMyPet', critical: false },
];

// Critical UI elements to verify
const CRITICAL_ELEMENTS = [
  { selector: 'header', name: 'Header', required: true },
  { selector: '.hamburger-right, [data-testid*="menu"]', name: 'Hamburger Menu', required: true },
  { selector: 'img[alt*="PetWash"], img[src*="logo"]', name: 'Logo', required: true },
  { selector: 'footer', name: 'Footer', required: false },
];

class ResponsiveQARunner {
  constructor() {
    this.results = [];
    this.screenshotsDir = 'backstop_data/screenshots';
    this.reportPath = 'backstop_data/responsive-qa-report.html';
    this.baseUrl = 'http://localhost:5000';
  }

  async init() {
    console.log('🚀 Initializing PetWash™ Responsive QA System...\n');
    await fs.mkdir(this.screenshotsDir, { recursive: true });
  }

  async testDevice(browser, device, page) {
    const testStart = Date.now();
    const deviceResult = {
      device: device.name,
      category: device.category,
      orientation: device.orientation,
      viewport: `${device.width}x${device.height}`,
      pages: [],
      passed: 0,
      failed: 0,
      warnings: 0,
    };

    console.log(`\n📱 Testing: ${device.name} (${device.category}) - ${device.width}x${device.height}`);

    // Test each page
    for (const testPage of TEST_PAGES) {
      const pageResult = {
        url: testPage.url,
        name: testPage.name,
        status: 'unknown',
        issues: [],
        screenshot: '',
        loadTime: 0,
      };

      try {
        const pageStart = Date.now();
        
        // Navigate to page
        await page.goto(`${this.baseUrl}${testPage.url}`, {
          waitUntil: 'networkidle0',
          timeout: 15000,
        });

        pageResult.loadTime = Date.now() - pageStart;

        // Wait for content to stabilize
        await page.waitForTimeout(2000);

        // Check critical elements
        for (const element of CRITICAL_ELEMENTS) {
          try {
            const found = await page.$(element.selector);
            if (!found && element.required && testPage.critical) {
              pageResult.issues.push(`❌ Missing required element: ${element.name}`);
              deviceResult.failed++;
            } else if (!found && element.required) {
              pageResult.issues.push(`⚠️ Missing element: ${element.name}`);
              deviceResult.warnings++;
            }
          } catch (err) {
            if (element.required) {
              pageResult.issues.push(`❌ Error checking ${element.name}: ${err.message}`);
              deviceResult.failed++;
            }
          }
        }

        // Check for horizontal scroll (bad for responsive)
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        if (hasHorizontalScroll) {
          pageResult.issues.push(`⚠️ Horizontal scroll detected - layout overflow`);
          deviceResult.warnings++;
        }

        // Check viewport meta tag
        const hasViewportMeta = await page.evaluate(() => {
          return !!document.querySelector('meta[name="viewport"]');
        });

        if (!hasViewportMeta) {
          pageResult.issues.push(`⚠️ Missing viewport meta tag`);
          deviceResult.warnings++;
        }

        // Take screenshot
        const screenshotName = `${device.name}_${testPage.name}.png`;
        const screenshotPath = path.join(this.screenshotsDir, screenshotName);
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        });
        pageResult.screenshot = screenshotName;

        // Determine status
        if (pageResult.issues.length === 0) {
          pageResult.status = 'pass';
          deviceResult.passed++;
          console.log(`  ✅ ${testPage.name} - PASS (${pageResult.loadTime}ms)`);
        } else if (pageResult.issues.some(i => i.startsWith('❌'))) {
          pageResult.status = 'fail';
          console.log(`  ❌ ${testPage.name} - FAIL (${pageResult.issues.length} issues)`);
        } else {
          pageResult.status = 'warning';
          console.log(`  ⚠️ ${testPage.name} - WARNINGS (${pageResult.issues.length})`);
        }

      } catch (error) {
        pageResult.status = 'error';
        pageResult.issues.push(`❌ Page load error: ${error.message}`);
        deviceResult.failed++;
        console.log(`  ❌ ${testPage.name} - ERROR: ${error.message}`);
      }

      deviceResult.pages.push(pageResult);
    }

    deviceResult.duration = Date.now() - testStart;
    return deviceResult;
  }

  async run() {
    console.log(`🎯 Testing ${DEVICE_MATRIX.length} devices × ${TEST_PAGES.length} pages = ${DEVICE_MATRIX.length * TEST_PAGES.length} total checks\n`);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();

      // Test each device
      for (const device of DEVICE_MATRIX) {
        await page.setViewport({
          width: device.width,
          height: device.height,
        });

        const result = await this.testDevice(browser, device, page);
        this.results.push(result);
      }

    } finally {
      await browser.close();
    }
  }

  generateReport() {
    const totalDevices = this.results.length;
    const totalTests = this.results.reduce((sum, r) => sum + r.pages.length, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalWarnings = this.results.reduce((sum, r) => sum + r.warnings, 0);
    const passRate = ((totalPassed / totalTests) * 100).toFixed(1);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PetWash™ Responsive QA Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 12px; margin-bottom: 30px; }
    h1 { font-size: 36px; margin-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .stat-value { font-size: 36px; font-weight: bold; margin-bottom: 8px; }
    .stat-label { color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
    .pass { color: #10b981; }
    .fail { color: #ef4444; }
    .warning { color: #f59e0b; }
    .device-section { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
    .device-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
    .device-name { font-size: 24px; font-weight: bold; }
    .device-meta { color: #666; font-size: 14px; }
    .page-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .page-card { border: 2px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .page-card.pass { border-color: #10b981; }
    .page-card.fail { border-color: #ef4444; }
    .page-card.warning { border-color: #f59e0b; }
    .page-header { padding: 12px 16px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
    .page-name { font-weight: bold; font-size: 16px; }
    .screenshot { width: 100%; height: 200px; object-fit: cover; background: #f3f4f6; }
    .issues { padding: 12px 16px; font-size: 14px; }
    .issue { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .issue:last-child { border: none; }
    .category-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 8px; }
    .badge-xs { background: #dbeafe; color: #1e40af; }
    .badge-sm { background: #ddd6fe; color: #5b21b6; }
    .badge-md { background: #fce7f3; color: #9f1239; }
    .badge-lg { background: #d1fae5; color: #065f46; }
    .badge-xl { background: #fed7aa; color: #92400e; }
    .badge-2xl { background: #fce7f3; color: #831843; }
    .badge-3xl { background: #e0e7ff; color: #3730a3; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐾 PetWash™ Responsive QA Report</h1>
      <p>Automated Visual Regression Testing - All Devices & Orientations</p>
      <p style="margin-top: 10px; opacity: 0.9;">Generated: ${new Date().toLocaleString()}</p>
    </div>

    <div class="summary">
      <div class="stat-card">
        <div class="stat-value">${totalDevices}</div>
        <div class="stat-label">Devices Tested</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalTests}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat-card">
        <div class="stat-value pass">${totalPassed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value fail">${totalFailed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value warning">${totalWarnings}</div>
        <div class="stat-label">Warnings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value ${passRate >= 90 ? 'pass' : passRate >= 70 ? 'warning' : 'fail'}">${passRate}%</div>
        <div class="stat-label">Pass Rate</div>
      </div>
    </div>

    ${this.results.map(device => `
      <div class="device-section">
        <div class="device-header">
          <div>
            <div class="device-name">
              <span class="category-badge badge-${device.category.toLowerCase()}">${device.category}</span>
              ${device.device}
            </div>
            <div class="device-meta">
              ${device.viewport} · ${device.orientation} · ${device.duration}ms
            </div>
          </div>
          <div style="text-align: right;">
            <div class="stat-value pass" style="font-size: 24px;">${device.passed}</div>
            <div class="stat-label">Passed</div>
          </div>
        </div>

        <div class="page-grid">
          ${device.pages.map(page => `
            <div class="page-card ${page.status}">
              <div class="page-header">
                <div class="page-name">
                  ${page.status === 'pass' ? '✅' : page.status === 'fail' ? '❌' : '⚠️'}
                  ${page.name}
                </div>
                <div style="font-size: 12px; color: #666;">${page.loadTime}ms</div>
              </div>
              ${page.screenshot ? `<img src="screenshots/${page.screenshot}" alt="${page.name}" class="screenshot">` : ''}
              ${page.issues.length > 0 ? `
                <div class="issues">
                  ${page.issues.map(issue => `<div class="issue">${issue}</div>`).join('')}
                </div>
              ` : '<div class="issues" style="color: #10b981;">✓ All checks passed</div>'}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}

  </div>
</body>
</html>`;

    return html;
  }

  async saveReport() {
    const html = this.generateReport();
    await fs.writeFile(this.reportPath, html);
    console.log(`\n📊 Report saved: ${this.reportPath}`);
  }

  printSummary() {
    const totalTests = this.results.reduce((sum, r) => sum + r.pages.length, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalWarnings = this.results.reduce((sum, r) => sum + r.warnings, 0);
    const passRate = ((totalPassed / totalTests) * 100).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESPONSIVE QA SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Devices: ${this.results.length}`);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`⚠️ Warnings: ${totalWarnings}`);
    console.log(`📈 Pass Rate: ${passRate}%`);
    console.log('='.repeat(60));

    if (passRate >= 95) {
      console.log('🎉 EXCELLENT - Ready for deployment!');
    } else if (passRate >= 85) {
      console.log('✅ GOOD - Minor issues to address');
    } else if (passRate >= 70) {
      console.log('⚠️ NEEDS WORK - Several issues found');
    } else {
      console.log('❌ CRITICAL - Major issues blocking deployment');
    }
  }
}

// Run the tests
(async () => {
  const qa = new ResponsiveQARunner();
  
  try {
    await qa.init();
    await qa.run();
    await qa.saveReport();
    qa.printSummary();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ QA Runner failed:', error);
    process.exit(1);
  }
})();
