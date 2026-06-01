#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const filesToScan = [
  'client/src/pages/Franchise.tsx',
  'client/src/pages/partners/Franchise.tsx',
  'client/src/pages/FranchiseManagementDashboard.tsx',
  'client/src/pages/PetWashTalentMarketplacePage.tsx',
  'client/src/components/VIPLoyaltyPopup.tsx',
  'client/src/components/LuxuryPlatformShowcase.tsx',
  'client/src/components/control-panel/FinanceSettlementsView.tsx',
  'client/src/pages/StandaloneDivisions.tsx',
  'client/src/lib/i18n.ts',
  'client/src/lib/seo.ts',
];

const forbidden = [
  /fastest-growing/i,
  /proven business model/i,
  /global franchise network/i,
  /global expansion planned/i,
  /Global Premium Opportunity/i,
  /Interactive ROI Calculator/i,
  /Annual ROI/i,
  /Excellent ROI/i,
  /220%/i,
  /500\+ franchisees/i,
  /92% success probability/i,
  /world's leading network/i,
  /become a successful business owner/i,
  /Exclusive Territory/i,
  /Complete Insurance/i,
  /Regional master franchise/i,
  /City franchise partner/i,
  /Franchise and white label/i,
  /white-label solutions/i,
  /Success Stories/i,
];

const findings = [];

for (const relative of filesToScan) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    continue;
  }

  const lines = fs.readFileSync(absolute, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const pattern of forbidden) {
      if (pattern.test(line)) {
        findings.push({
          file: relative,
          line: index + 1,
          pattern: pattern.toString(),
          text: line.trim().slice(0, 180),
        });
      }
    }
  });
}

if (findings.length > 0) {
  console.error('Unsafe franchise/location-partner public claims found:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.pattern} :: ${finding.text}`);
  }
  process.exit(1);
}

console.log('Franchise/location-partner public claims audit passed.');
console.log(`Scanned files: ${filesToScan.length}`);
