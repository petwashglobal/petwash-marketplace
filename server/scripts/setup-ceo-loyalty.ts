/**
 * Setup CEO Loyalty Membership
 * One-time script to initialize Nir Hadad's VIP Platinum membership
 */

import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

async function setupCEOLoyalty() {
  try {
    const ceoEmail = 'nirhadad1@gmail.com';
    
    // Find Nir's user document by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', ceoEmail)
      .limit(1)
      .get();
    
    let userId: string;
    
    if (usersSnapshot.empty) {
      console.log('ℹ️ User not found in users collection, checking by UID...');
      
      // Try to find by known Firebase UID (if exists)
      // Otherwise, we'll need to use the email as document ID
      userId = ceoEmail.replace('@', '_').replace('.', '_');
      
      console.log('Creating new user document:', userId);
      
      // Create new user document
      await db.collection('users').doc(userId).set({
        email: ceoEmail,
        displayName: 'Nir Hadad',
        createdAt: new Date(),
        emailVerified: true
      });
    } else {
      const userDoc = usersSnapshot.docs[0];
      userId = userDoc.id;
    }
    
    console.log('✅ Found CEO user:', userId);
    
    // Update with Platinum VIP membership
    await db.collection('users').doc(userId).update({
      loyaltyTier: 'platinum',
      loyaltyPoints: 5000, // Starting with 5000 points as CEO/Founder
      loyaltyDiscountPercent: 20, // Platinum tier: 20% discount
      loyaltyMemberSince: new Date('2024-01-01'), // Founding date
      membershipType: 'founder',
      displayName: 'Nir Hadad',
      title: 'CEO & Founder',
      company: 'Pet Wash Ltd',
      companyId: '517145033',
      role: 'founder',
      updatedAt: new Date()
    });

    console.log('✅ CEO Loyalty Membership Updated:');
    console.log('   Tier: Platinum (highest)');
    console.log('   Points: 5,000');
    console.log('   Discount: 20%');
    console.log('   Member Since: January 2024');
    console.log('   Title: CEO & Founder');
    console.log('');
    console.log('🎉 Nir Hadad is now a Platinum VIP Member!');
    console.log('');
    console.log('📱 Download your wallet cards at:');
    console.log('   https://petwash.co.il/my-wallet');
    console.log('');
    console.log('💳 Your cards include:');
    console.log('   1. VIP Platinum Loyalty Card (20% discount)');
    console.log('   2. CEO Digital Business Card');
    console.log('');
    
  } catch (error) {
    logger.error('Failed to setup CEO loyalty:', error);
    console.error('❌ Error:', error);
  }
}

// Run the script
setupCEOLoyalty()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
