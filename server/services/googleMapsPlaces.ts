/**
 * Google Maps Platform - Places API Service
 * Display customer reviews, photos, and ratings on website
 * 
 * Features:
 * - Fetch place details (reviews, photos, ratings)
 * - Get up to 5 most recent reviews per location
 * - Retrieve customer photos
 * - AI-powered review summaries with Gemini
 * 
 * API Documentation: https://developers.google.com/maps/documentation/places/web-service
 */

import { logger } from '../lib/logger';

interface PlaceReview {
  authorName: string;
  authorUrl?: string;
  language: string;
  profilePhotoUrl?: string;
  rating: number;
  relativeTimeDescription: string;
  text: string;
  time: number;
}

interface PlacePhoto {
  height: number;
  width: number;
  photoReference: string;
  htmlAttributions: string[];
}

interface PlaceDetails {
  placeId: string;
  name: string;
  rating: number;
  userRatingsTotal: number;
  reviews: PlaceReview[];
  photos: PlacePhoto[];
  formattedAddress: string;
  formattedPhoneNumber?: string;
  website?: string;
  openingHours?: {
    openNow: boolean;
    weekdayText: string[];
  };
}

export class GoogleMapsPlacesService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api/place';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get place details including reviews and photos
   */
  async getPlaceDetails(placeId: string, language: string = 'iw'): Promise<PlaceDetails | null> {
    try {
      const fields = [
        'place_id',
        'name',
        'rating',
        'user_ratings_total',
        'reviews',
        'photos',
        'formatted_address',
        'formatted_phone_number',
        'website',
        'opening_hours'
      ].join(',');

      const url = `${this.baseUrl}/details/json?place_id=${placeId}&fields=${fields}&language=${language}&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        logger.error(`[Google Maps Places] API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
        return null;
      }

      const result = data.result;

      return {
        placeId: result.place_id,
        name: result.name,
        rating: result.rating || 0,
        userRatingsTotal: result.user_ratings_total || 0,
        reviews: result.reviews || [],
        photos: result.photos || [],
        formattedAddress: result.formatted_address || '',
        formattedPhoneNumber: result.formatted_phone_number,
        website: result.website,
        openingHours: result.opening_hours
      };
    } catch (error) {
      logger.error('[Google Maps Places] Failed to fetch place details:', error);
      return null;
    }
  }

  /**
   * Get photo URL from photo reference
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `${this.baseUrl}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
  }

  /**
   * Search for places by text query
   */
  async searchPlaces(query: string, language: string = 'iw'): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/textsearch/json?query=${encodeURIComponent(query)}&language=${language}&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        logger.error(`[Google Maps Places] Search error: ${data.status}`);
        return [];
      }

      return data.results || [];
    } catch (error) {
      logger.error('[Google Maps Places] Search failed:', error);
      return [];
    }
  }

  /**
   * Get reviews for multiple locations
   */
  async getBatchReviews(placeIds: string[], language: string = 'iw'): Promise<Map<string, PlaceReview[]>> {
    const reviewsMap = new Map<string, PlaceReview[]>();

    for (const placeId of placeIds) {
      const details = await this.getPlaceDetails(placeId, language);
      if (details) {
        reviewsMap.set(placeId, details.reviews);
      }

      // Rate limiting: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return reviewsMap;
  }

  /**
   * Generate AI-powered review summary using Gemini
   */
  async generateReviewSummary(reviews: PlaceReview[], language: 'he' | 'en' = 'he'): Promise<string> {
    try {
      const { generateGeminiResponse } = await import('../gemini');

      if (reviews.length === 0) {
        return language === 'he' 
          ? 'אין ביקורות זמינות כרגע.'
          : 'No reviews available at this time.';
      }

      const reviewTexts = reviews
        .slice(0, 10) // Use top 10 reviews
        .map(r => `⭐ ${r.rating}/5 - "${r.text}"`)
        .join('\n\n');

      const prompt = language === 'he'
        ? `סכם את הביקורות הבאות של Pet Wash בעברית, תוך הדגשת הנקודות החיוביות והשליליות העיקריות:

${reviewTexts}

סיכום קצר (2-3 משפטים):`
        : `Summarize the following Pet Wash reviews in English, highlighting main positive and negative points:

${reviewTexts}

Brief summary (2-3 sentences):`;

      const summary = await generateGeminiResponse(prompt);
      return summary.trim();
    } catch (error) {
      logger.error('[Google Maps Places] Failed to generate review summary:', error);
      return language === 'he'
        ? 'לא ניתן ליצור סיכום ביקורות כרגע.'
        : 'Unable to generate review summary at this time.';
    }
  }

  /**
   * Get review statistics
   */
  getReviewStats(reviews: PlaceReview[]): {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
    languageDistribution: { [key: string]: number };
  } {
    const ratingDistribution: { [key: number]: number } = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0
    };
    const languageDistribution: { [key: string]: number } = {};
    let totalRating = 0;

    for (const review of reviews) {
      const rating = Math.floor(review.rating);
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      languageDistribution[review.language] = (languageDistribution[review.language] || 0) + 1;
      totalRating += review.rating;
    }

    return {
      averageRating: reviews.length > 0 ? totalRating / reviews.length : 0,
      totalReviews: reviews.length,
      ratingDistribution,
      languageDistribution
    };
  }
}

// Export singleton instance
let placesService: GoogleMapsPlacesService | null = null;

export function initializeGoogleMapsPlaces(apiKey: string): GoogleMapsPlacesService {
  placesService = new GoogleMapsPlacesService(apiKey);
  return placesService;
}

export function getGoogleMapsPlaces(): GoogleMapsPlacesService {
  if (!placesService) {
    throw new Error('Google Maps Places service not initialized');
  }
  return placesService;
}
