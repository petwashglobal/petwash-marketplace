import firebaseAdmin from '../server/lib/firebase-admin';

async function fixProfileLocation() {
  const email = 'nirhadad1@gmail.com';
  const db = firebaseAdmin.firestore();
  const auth = firebaseAdmin.auth();
  
  const user = await auth.getUserByEmail(email);
  console.log('Fixing profile for:', user.uid);
  
  // Delete wrong location
  const wrongDoc = db.collection('users').doc(user.uid);
  const wrongData = (await wrongDoc.get()).data();
  if (wrongData) {
    console.log('Deleting profile from wrong location...');
    await wrongDoc.delete();
  }
  
  // Create profile in CORRECT location
  const correctRef = db.collection('users').doc(user.uid).collection('profile').doc('data');
  console.log('Creating profile at correct location...');
  await correctRef.set({
    firstName: 'Nir',
    lastName: 'Hadad',
    email: user.email,
    phone: user.phoneNumber || '',
    dateOfBirth: '',
    petName: '',
    petBreed: '',
    petAge: '',
    petWeight: '',
    loyaltyTier: 'New Member',
    washes: 0,
    giftCardCredits: 0,
    totalSpent: 0,
    verified: false,
    seniorDiscount: false,
    disabilityDiscount: false,
    createdAt: new Date(),
    role: 'founder'
  });
  
  console.log('✅ Profile fixed! Testing...');
  const testFetch = await correctRef.get();
  console.log('Profile exists:', testFetch.exists);
  console.log('Data:', testFetch.data());
}

fixProfileLocation().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
