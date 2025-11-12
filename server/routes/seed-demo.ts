/**
 * Seed Demo Data Endpoint
 * POST /api/seed-demo to populate database with demo sitters
 */

import { Router } from 'express';
import { db } from '../db';
import { sitterProfiles, sitterReviews, petProfilesForSitting } from '@shared/schema';
import { logger } from '../lib/logger';

const router = Router();

router.post('/seed-demo', async (req, res) => {
  try {
    logger.info('[Seed] Starting demo data seeding...');

    const demoSitters = [
      {
        userId: 'sitter-001',
        firstName: 'Sarah',
        lastName: 'Cohen',
        dateOfBirth: new Date('1990-05-15'),
        email: 'sarah.cohen@example.com',
        phone: '+972-50-123-4567',
        streetAddress: '15 Rothschild Blvd',
        apartment: 'Apt 5',
        city: 'Tel Aviv',
        stateProvince: 'Tel Aviv District',
        postalCode: '6688101',
        country: 'Israel',
        latitude: '32.0642',
        longitude: '34.7723',
        profilePictureUrl: 'https://i.pravatar.cc/400?img=5',
        bio: '🐾 Passionate pet lover with 8 years of experience caring for dogs and cats. I treat every pet like family! My home has a large backyard perfect for playtime.',
        yearsOfExperience: 8,
        detailedExperience: 'Certified pet first aid, experienced with senior pets, puppies, and special needs animals.',
        specializations: ['dogs', 'cats', 'puppies'],
        languagesSpoken: ['Hebrew', 'English', 'Russian'],
        smokingStatus: 'non_smoker',
        hasOtherPets: true,
        otherPetsDetails: 'Friendly 5-year-old golden retriever named Max',
        homeType: 'house',
        yardSize: 'large',
        homePhotos: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c'],
        pricePerDayCents: 25000,
        serviceTypes: ['boarding', 'daycare', 'drop_in'],
        selfiePhotoUrl: 'https://i.pravatar.cc/400?img=5',
        idPhotoUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
        biometricMatchStatus: 'matched',
        biometricMatchScore: '98.50',
        biometricVerifiedAt: new Date(),
        verificationStatus: 'active',
        backgroundCheckStatus: 'passed',
        backgroundCheckCompletedAt: new Date(),
        isActive: true,
        isVerified: true,
        rating: '4.95',
        totalBookings: 127,
        totalEarningsCents: 3175000,
        responseTimeMinutes: 15,
      },
      {
        userId: 'sitter-002',
        firstName: 'David',
        lastName: 'Levi',
        dateOfBirth: new Date('1985-08-22'),
        email: 'david.levi@example.com',
        phone: '+972-52-234-5678',
        streetAddress: '42 Herzl Street',
        city: 'Jerusalem',
        stateProvince: 'Jerusalem District',
        postalCode: '9458131',
        country: 'Israel',
        latitude: '31.7683',
        longitude: '35.2137',
        profilePictureUrl: 'https://i.pravatar.cc/400?img=12',
        bio: '🏡 Professional pet sitter specializing in anxious and rescue pets. Creating calm, safe environments since 2015.',
        yearsOfExperience: 10,
        detailedExperience: 'Animal behavior certification, anxiety management specialist.',
        specializations: ['dogs', 'rescue_animals', 'anxious_pets'],
        languagesSpoken: ['Hebrew', 'English'],
        smokingStatus: 'non_smoker',
        hasOtherPets: false,
        homeType: 'house',
        yardSize: 'medium',
        homePhotos: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9'],
        pricePerDayCents: 28000,
        serviceTypes: ['boarding', 'daycare'],
        selfiePhotoUrl: 'https://i.pravatar.cc/400?img=12',
        idPhotoUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
        biometricMatchStatus: 'matched',
        biometricMatchScore: '96.75',
        biometricVerifiedAt: new Date(),
        verificationStatus: 'active',
        backgroundCheckStatus: 'passed',
        backgroundCheckCompletedAt: new Date(),
        isActive: true,
        isVerified: true,
        rating: '4.92',
        totalBookings: 95,
        totalEarningsCents: 2660000,
        responseTimeMinutes: 22,
      },
    ];

    // Insert sitters
    const insertedSitters = await db.insert(sitterProfiles).values(demoSitters).returning();
    logger.info(`[Seed] Inserted ${insertedSitters.length} sitters`);

    // Create reviews
    const reviews = [];
    for (const sitter of insertedSitters) {
      for (let i = 0; i < 3; i++) {
        reviews.push({
          bookingId: 1,
          sitterId: sitter.id,
          ownerId: `owner-${Math.random().toString(36).substr(2, 9)}`,
          rating: Math.floor(Math.random() * 2) + 4,
          comment: [
            '⭐ Amazing experience! My dog was so happy.',
            '💯 Highly professional. Will book again!',
            '🐾 Best pet sitter ever!',
          ][i],
          isVerifiedStay: true,
        });
      }
    }

    await db.insert(sitterReviews).values(reviews);
    logger.info(`[Seed] Inserted ${reviews.length} reviews`);

    res.json({
      success: true,
      message: 'Demo data seeded successfully',
      sitters: insertedSitters.length,
      reviews: reviews.length,
    });
  } catch (error) {
    logger.error('[Seed] Error:', error);
    res.status(500).json({ error: 'Failed to seed data' });
  }
});

export default router;
