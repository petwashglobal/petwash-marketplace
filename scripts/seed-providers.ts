import { db } from '../server/db';
import { providerRateCards } from '../shared/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

const testProviders = [
  {
    rateCardId: `RATE-${nanoid(12)}`,
    providerId: 'provider-maya-1',
    platform: 'sitter_suite',
    serviceType: 'boarding',
    baseRatePerNightCents: 15000,
    additionalPetSurchargeCents: 5000,
    weekendSurchargePercent: 10,
    maxPets: 4,
    acceptedPetTypes: ['dog', 'cat'],
    addonsAvailable: ['pickup', 'grooming', 'photo-updates'],
    instantBooking: true,
    cancellationPolicy: 'flexible',
    displayName: 'מאיה כהן',
    bio: 'אוהבת חיות מחמד עם 8 שנות ניסיון. גרה בבית פרטי עם חצר גדולה.',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    location: 'תל אביב - יפו',
    averageRating: '4.9',
    totalReviews: 47,
    isActive: true,
  },
  {
    rateCardId: `RATE-${nanoid(12)}`,
    providerId: 'provider-dan-2',
    platform: 'sitter_suite',
    serviceType: 'boarding',
    baseRatePerNightCents: 12000,
    additionalPetSurchargeCents: 4000,
    weekendSurchargePercent: 15,
    maxPets: 3,
    acceptedPetTypes: ['dog'],
    addonsAvailable: ['pickup', 'training', 'playtime'],
    instantBooking: false,
    cancellationPolicy: 'moderate',
    displayName: 'דן לוי',
    bio: 'מאלף כלבים מוסמך. מתמחה בכלבים גדולים ואנרגטיים.',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    location: 'רמת גן',
    averageRating: '4.7',
    totalReviews: 32,
    isActive: true,
  },
  {
    rateCardId: `RATE-${nanoid(12)}`,
    providerId: 'provider-noa-3',
    platform: 'sitter_suite',
    serviceType: 'house-sitting',
    baseRatePerNightCents: 18000,
    additionalPetSurchargeCents: 6000,
    weekendSurchargePercent: 0,
    maxPets: 5,
    acceptedPetTypes: ['dog', 'cat', 'bird', 'fish'],
    addonsAvailable: ['water-plants', 'collect-mail', 'medication'],
    instantBooking: true,
    cancellationPolicy: 'flexible',
    displayName: 'נועה ברקוביץ',
    bio: 'וטרינרית בהכשרתי. אשמח לשמור על כל סוגי חיות המחמד בביתכם.',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
    location: 'הרצליה',
    averageRating: '5.0',
    totalReviews: 89,
    isActive: true,
  },
  {
    rateCardId: `RATE-${nanoid(12)}`,
    providerId: 'provider-yossi-4',
    platform: 'sitter_suite',
    serviceType: 'daycare',
    baseRatePerHourCents: 5000,
    additionalPetSurchargeCents: 2500,
    weekendSurchargePercent: 20,
    maxPets: 6,
    acceptedPetTypes: ['dog'],
    addonsAvailable: ['grooming', 'training', 'bath'],
    instantBooking: true,
    cancellationPolicy: 'strict',
    displayName: 'יוסי אברמוביץ',
    bio: 'מעון יום לכלבים ביפו. חצר גדולה, הרבה משחקים וחברים.',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200',
    location: 'יפו',
    averageRating: '4.6',
    totalReviews: 156,
    isActive: true,
  },
];

async function seedProviders() {
  console.log('Seeding test providers...');
  
  for (const provider of testProviders) {
    try {
      const existing = await db.select().from(providerRateCards)
        .where(eq(providerRateCards.providerId, provider.providerId))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(providerRateCards).values(provider as any);
        console.log('Created:', provider.displayName);
      } else {
        console.log('Already exists:', provider.displayName);
      }
    } catch (error) {
      console.error('Error inserting', provider.displayName, (error as Error).message);
    }
  }
  
  console.log('Done!');
  process.exit(0);
}

seedProviders();
