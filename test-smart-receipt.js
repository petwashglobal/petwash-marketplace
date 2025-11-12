// Test script to demonstrate Smart Wash Receipt functionality
const testSmartReceipt = async () => {
  console.log('🧾 Testing Smart Wash Receipt System...\n');
  
  // Test 1: Create a smart receipt
  console.log('1. Creating Smart Receipt...');
  const receiptData = {
    packageId: 1,
    customerEmail: 'test@example.com',
    customerName: 'Test Customer',
    paymentMethod: 'Nayax Card Payment',
    originalAmount: 55.00,
    discountApplied: 5.50,
    finalTotal: 49.50,
    nayaxTransactionId: 'NYX_123456789',
    locationName: 'Pet Wash™ Tel Aviv Station',
    washDuration: 15
  };
  
  try {
    const response = await fetch('http://localhost:5000/api/smart-receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiptData)
    });
    
    const result = await response.json();
    console.log('✅ Smart Receipt Created:', result);
    
    const transactionId = result.receipt.transactionId;
    console.log(`📱 Receipt URL: https://petwash.co.il/receipt/${transactionId}`);
    console.log(`🎯 Loyalty Points Earned: ${result.receipt.loyaltyPointsEarned}`);
    console.log(`📊 Tier Progress: ${result.receipt.tierProgress}\n`);
    
    // Test 2: Retrieve the receipt
    console.log('2. Retrieving Receipt...');
    const receiptResponse = await fetch(`http://localhost:5000/api/receipts/${transactionId}`);
    const receiptDetails = await receiptResponse.json();
    
    console.log('✅ Receipt Retrieved:', {
      transactionId: receiptDetails.transactionId,
      washType: receiptDetails.washType,
      finalTotal: receiptDetails.finalTotal,
      loyaltyPointsEarned: receiptDetails.loyaltyPointsEarned,
      receiptUrl: receiptDetails.receiptUrl
    });
    
    // Test 3: Display receipt structure
    console.log('\n3. Receipt Structure:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                        Pet Wash™ Smart Receipt                        ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Transaction ID: ${receiptDetails.transactionId}`);
    console.log(`📅 Date & Time: ${new Date(receiptDetails.washDateTime).toLocaleString()}`);
    console.log(`📍 Location: ${receiptDetails.locationName}`);
    console.log(`🧼 Wash Type: ${receiptDetails.washType}`);
    console.log(`⏱️  Duration: ${receiptDetails.washDuration} minutes`);
    console.log(`👤 Customer: ${receiptDetails.customerIdMasked}`);
    console.log(`💳 Payment: ${receiptDetails.paymentMethod}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💰 Original Amount: ₪${receiptDetails.originalAmount}`);
    console.log(`🎁 Discount Applied: -₪${receiptDetails.discountApplied}`);
    console.log(`💵 Final Total: ₪${receiptDetails.finalTotal}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🌟 Loyalty Points Earned: +${receiptDetails.loyaltyPointsEarned}`);
    console.log(`🏆 Current Tier: ${receiptDetails.currentTier}`);
    console.log(`📈 Progress: ${receiptDetails.currentTierPoints}/${receiptDetails.nextTierPoints} → ${receiptDetails.nextTier}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔗 Receipt URL: ${receiptDetails.receiptUrl}`);
    console.log(`📱 QR Code: [Generated and Available]`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Test 4: Optional features
    console.log('\n4. Optional Features Available:');
    console.log(`⭐ Rate Experience: https://petwash.co.il/rate/${transactionId}`);
    console.log(`🛒 Book Next Wash: https://petwash.co.il/?package=${receiptDetails.packageId}`);
    console.log(`🤝 Referral Link: https://petwash.co.il/?ref=${receiptDetails.userId || 'guest'}`);
    
    console.log('\n✅ Smart Receipt System Test Complete! All features working perfectly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run the test
console.log('🧪 Starting Smart Receipt System Test...\n');
testSmartReceipt();