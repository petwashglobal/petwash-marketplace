/**
 * Observances API Routes
 * Manage pet holiday/observance data
 */

import { Router } from 'express';
import { db as adminDb } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

const router = Router();

const enAUObservances = {
  "locale": "en-AU",
  "tz": "Australia/Melbourne",
  "evaluate_at": "09:00",
  "currency": "AUD",
  "events": [
    {
      "key": "international_dog_day",
      "active": true,
      "titles": { "en": "International Dog Day", "he": "יום הכלב הבינלאומי" },
      "bodies": {
        "en": "Celebrate the bond with your furry friend! Enjoy 10% off your next wash today.",
        "he": "היום מציינים את יום הכלב הבינלאומי! תפנקו את החבר הטוב ביותר שלכם בהנחה של 10% על השטיפה הבאה."
      },
      "rule": { "type": "fixed_date", "month": 8, "day": 26 },
      "promo": {
        "discount_percent": 10,
        "code_template": "DOGDAY-{YYYY}-{RND6}",
        "valid_days": 30
      },
      "appearance": {
        "icon": "Paw",
        "accent": "gold",
        "card_style": "luxury"
      },
      "idempotency_key_template": "observance:{UID}:international_dog_day:{YYYY}"
    },
    {
      "key": "national_puppy_day",
      "active": true,
      "titles": { "en": "National Puppy Day", "he": "יום הגור הלאומי" },
      "bodies": {
        "en": "It's National Puppy Day! Pup or young at heart, enjoy 10% off a wash today.",
        "he": "יום הגור הלאומי הגיע! גור אמיתי או רק בלב – תיהנו מהנחה של 10% על שטיפה היום."
      },
      "rule": { "type": "fixed_date", "month": 3, "day": 23 },
      "promo": {
        "discount_percent": 10,
        "code_template": "PUPPY-{YYYY}-{RND6}",
        "valid_days": 14
      },
      "appearance": {
        "icon": "Bone",
        "accent": "rose",
        "card_style": "luxury"
      },
      "idempotency_key_template": "observance:{UID}:national_puppy_day:{YYYY}"
    },
    {
      "key": "international_guide_dog_day",
      "active": true,
      "titles": { "en": "International Guide Dog Day", "he": "יום הכלב המדריך הבינלאומי" },
      "bodies": {
        "en": "Honoring guide dogs who change lives. A portion of today's proceeds is donated to guide dog programs.",
        "he": "היום מוקדש לכלבי הנחייה שמשנים חיים. חלק מהרווחים היום ייתרם לתוכניות הכשרת כלבי נחייה."
      },
      "rule": { "type": "last_weekday_in_month", "weekday": "WEDNESDAY", "month": 4 },
      "promo": {
        "donation_percent": 5,
        "code_template": "GUIDE-{YYYY}-{RND6}",
        "valid_days": 7
      },
      "appearance": {
        "icon": "ServiceDog",
        "accent": "emerald",
        "card_style": "luxury"
      },
      "idempotency_key_template": "observance:{UID}:international_guide_dog_day:{YYYY}"
    },
    {
      "key": "world_veterinary_day",
      "active": true,
      "titles": { "en": "World Veterinary Day", "he": "יום הווטרינר העולמי" },
      "bodies": {
        "en": "We celebrate veterinarians for their dedication to animal health. Enjoy a healthy fresh wash with 10% off.",
        "he": "חוגגים את יום הווטרינר העולמי ומוקירים את מסירות הווטרינרים. שטיפה רעננה ובריאה בהנחה של 10%."
      },
      "rule": { "type": "last_weekday_in_month", "weekday": "SATURDAY", "month": 4 },
      "promo": {
        "discount_percent": 10,
        "code_template": "VETDAY-{YYYY}-{RND6}",
        "valid_days": 14
      },
      "appearance": {
        "icon": "Stethoscope",
        "accent": "amber",
        "card_style": "luxury"
      },
      "idempotency_key_template": "observance:{UID}:world_veterinary_day:{YYYY}"
    },
    {
      "key": "international_cat_day",
      "active": true,
      "titles": { "en": "International Cat Day", "he": "יום החתול הבינלאומי" },
      "bodies": {
        "en": "Even cats deserve the spotlight. Celebrate International Cat Day with love for all furry friends.",
        "he": "גם לחתולים מגיע יום מיוחד! מציינים את יום החתול הבינלאומי באהבה לכל החברים הפרוותיים."
      },
      "rule": { "type": "fixed_date", "month": 8, "day": 8 },
      "promo": {
        "discount_percent": 0,
        "code_template": "CATDAY-{YYYY}-{RND6}",
        "valid_days": 7,
        "informational_only": true
      },
      "appearance": {
        "icon": "Cat",
        "accent": "pink",
        "card_style": "luxury"
      },
      "idempotency_key_template": "observance:{UID}:international_cat_day:{YYYY}"
    }
  ],
  "updated_at": new Date().toISOString()
};

const heILObservances = {
  "locale": "he-IL",
  "tz": "Asia/Jerusalem",
  "evaluate_at": "09:00",
  "currency": "ILS",
  "events": [
    {
      "key": "international_dog_day",
      "active": true,
      "titles": { "en": "International Dog Day", "he": "יום הכלב הבינלאומי" },
      "bodies": {
        "en": "Celebrate the bond with your furry friend! Enjoy 10% off your next wash today.",
        "he": "היום מציינים את יום הכלב הבינלאומי! תפנקו את החבר הטוב ביותר שלכם בהנחה של 10% על השטיפה הבאה."
      },
      "rule": { "type": "fixed_date", "month": 8, "day": 26 },
      "promo": {
        "discount_percent": 10,
        "code_template": "DOGDAY-{YYYY}-{RND6}",
        "valid_days": 30
      },
      "appearance": {
        "icon": "Paw",
        "accent": "gold",
        "card_style": "luxury"
      },
      "idempotency_key_template": "observance:{UID}:international_dog_day:{YYYY}"
    },
    {
      "key": "national_puppy_day",
      "active": true,
      "titles": { "en": "National Puppy Day", "he": "יום הגור הלאומי" },
      "bodies": {
        "en": "It's National Puppy Day! Pup or young at heart, enjoy 10% off a wash today.",
        "he": "יום הגור הלאומי הגיע! גור אמיתי או רק בלב – תיהנו מהנחה של 10% על שטיפה היום."
      },
      "rule": { "type": "fixed_date", "month": 3, "day": 23 },
      "promo": {
        "discount_percent": 10,
        "code_template": "PUPPY-{YYYY}-{RND6}",
        "valid_days": 14
      },
      "appearance": {
        "icon": "Bone",
        "accent": "rose",
        "card_style": "luxury"
      },
      "idempotency_key_template": "observance:{UID}:national_puppy_day:{YYYY}"
    },
    {
      "key": "international_guide_dog_day",
      "active": true,
      "titles": { "en": "International Guide Dog Day", "he": "יום הכלב המדריך הבינלאומי" },
      "bodies": {
        "en": "Honoring guide dogs who change lives. A portion of today's proceeds is donated to guide dog programs.",
        "he": "היום מוקדש לכלבי הנחייה שמשנים חיים. חלק מהרווחים היום ייתרם לתוכניות הכשרת כלבי נחייה."
      },
      "rule": { "type": "last_weekday_in_month", "weekday": "WEDNESDAY", "month": 4 },
      "promo": {
        "donation_percent": 5,
        "code_template": "GUIDE-{YYYY}-{RND6}",
        "valid_days": 7
      },
      "appearance": {
        "icon": "ServiceDog",
        "accent": "emerald",
        "card_style": "luxury"
      },
      "idempotency_key_template": "observance:{UID}:international_guide_dog_day:{YYYY}"
    },
    {
      "key": "world_veterinary_day",
      "active": true,
      "titles": { "en": "World Veterinary Day", "he": "יום הווטרינר העולמי" },
      "bodies": {
        "en": "We celebrate veterinarians for their dedication to animal health. Enjoy a healthy fresh wash with 10% off.",
        "he": "חוגגים את יום הווטרינר העולמי ומוקירים את מסירות הווטרינרים. שטיפה רעננה ובריאה בהנחה של 10%."
      },
      "rule": { "type": "last_weekday_in_month", "weekday": "SATURDAY", "month": 4 },
      "promo": {
        "discount_percent": 10,
        "code_template": "VETDAY-{YYYY}-{RND6}",
        "valid_days": 14
      },
      "appearance": {
        "icon": "Stethoscope",
        "accent": "amber",
        "card_style": "luxury"
      },
      "idempotency_key_template": "observance:{UID}:world_veterinary_day:{YYYY}"
    },
    {
      "key": "international_cat_day",
      "active": true,
      "titles": { "en": "International Cat Day", "he": "יום החתול הבינלאומי" },
      "bodies": {
        "en": "Even cats deserve the spotlight. Celebrate International Cat Day with love for all furry friends.",
        "he": "גם לחתולים מגיע יום מיוחד! מציינים את יום החתול הבינלאומי באהבה לכל החברים הפרוותיים."
      },
      "rule": { "type": "fixed_date", "month": 8, "day": 8 },
      "promo": {
        "discount_percent": 0,
        "code_template": "CATDAY-{YYYY}-{RND6}",
        "valid_days": 7,
        "informational_only": true
      },
      "appearance": {
        "icon": "Cat",
        "accent": "pink",
        "card_style": "luxury"
      },
      "idempotency_key_template": "observance:{UID}:international_cat_day:{YYYY}"
    }
  ],
  "updated_at": new Date().toISOString()
};

/**
 * Populate observances data (admin only)
 * POST /api/observances/populate
 */
router.post('/populate', async (req, res) => {
  try {
    logger.info('Populating observances data...');
    
    // Create en-AU document
    await adminDb.collection('observances').doc('en-AU').set(enAUObservances);
    logger.info('Created observances/en-AU');
    
    // Create he-IL document
    await adminDb.collection('observances').doc('he-IL').set(heILObservances);
    logger.info('Created observances/he-IL');
    
    res.status(200).json({
      success: true,
      message: 'Observances data populated successfully',
      locales: ['en-AU', 'he-IL'],
      eventsPerLocale: enAUObservances.events.length
    });
  } catch (error) {
    logger.error('Error populating observances', error);
    res.status(500).json({
      success: false,
      error: 'Failed to populate observances'
    });
  }
});

/**
 * Get observances for a locale
 * GET /api/observances/:locale
 */
router.get('/:locale', async (req, res) => {
  try {
    const { locale } = req.params;
    const doc = await adminDb.collection('observances').doc(locale).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Observances not found for locale'
      });
    }
    
    res.status(200).json({
      success: true,
      data: doc.data()
    });
  } catch (error) {
    logger.error('Error fetching observances', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch observances'
    });
  }
});

export default router;
