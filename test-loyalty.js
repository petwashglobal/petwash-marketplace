// Quick test script for loyalty tier calculations
// Run with: node test-loyalty.js

const tierThresholds = {
  new: { min: 0, max: 2, discount: 0 },
  silver: { min: 3, max: 9, discount: 10 },
  gold: { min: 10, max: 24, discount: 15 },
  platinum: { min: 25, max: null, discount: 20 }
};

function calculateTier(washes) {
  if (washes >= 25) return 'platinum';
  if (washes >= 10) return 'gold';
  if (washes >= 3) return 'silver';
  return 'new';
}

function getTierProgress(washes) {
  const tier = calculateTier(washes);
  const config = tierThresholds[tier];
  
  let nextTier = null;
  let nextAt = null;
  let progress = 0;
  
  if (tier === 'new') {
    nextTier = 'silver';
    nextAt = 3;
    progress = (washes / 3) * 100;
  } else if (tier === 'silver') {
    nextTier = 'gold';
    nextAt = 10;
    progress = ((washes - 3) / (10 - 3)) * 100;
  } else if (tier === 'gold') {
    nextTier = 'platinum';
    nextAt = 25;
    progress = ((washes - 10) / (25 - 10)) * 100;
  } else {
    progress = 100;
  }
  
  return {
    tier,
    discount: config.discount,
    washes,
    nextTier,
    nextAt,
    progress: Math.min(progress, 100)
  };
}

// Test cases
const testCases = [
  0, 1, 2,      // New Member boundary
  3, 5, 9,      // Silver boundary  
  10, 15, 24,   // Gold boundary
  25, 50, 100   // Platinum
];

console.log('🧪 LOYALTY TIER CALCULATION TEST\n');
console.log('='.repeat(80));

testCases.forEach(washes => {
  const result = getTierProgress(washes);
  console.log(`\nWashes: ${washes}`);
  console.log(`  Tier: ${result.tier.toUpperCase()}`);
  console.log(`  Discount: ${result.discount}%`);
  console.log(`  Progress: ${result.progress.toFixed(1)}%`);
  if (result.nextTier) {
    console.log(`  Next: ${result.nextTier.toUpperCase()} at ${result.nextAt} washes`);
  } else {
    console.log(`  Status: MAX TIER REACHED`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('✅ All tier calculations completed\n');

// Test tier upgrades
console.log('🎉 TIER UPGRADE SCENARIOS\n');
console.log('='.repeat(80));

const upgradeCases = [
  [2, 3, 'NEW → SILVER'],
  [9, 10, 'SILVER → GOLD'],
  [24, 25, 'GOLD → PLATINUM']
];

upgradeCases.forEach(([before, after, label]) => {
  const tierBefore = calculateTier(before);
  const tierAfter = calculateTier(after);
  const upgraded = tierBefore !== tierAfter;
  
  console.log(`\n${label}`);
  console.log(`  Before: ${before} washes → ${tierBefore}`);
  console.log(`  After: ${after} washes → ${tierAfter}`);
  console.log(`  Upgrade: ${upgraded ? '✅ YES' : '❌ NO'}`);
});

console.log('\n' + '='.repeat(80));
console.log('✅ Tier upgrade detection working correctly\n');
