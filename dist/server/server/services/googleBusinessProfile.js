/**
 * Google Business Profile API Service
 * Manages reviews, locations, and automated responses for Pet Wash stations
 *
 * Features:
 * - Fetch reviews from all station locations
 * - Auto-respond to reviews with Gemini AI
 * - Monitor review sentiment and ratings
 * - Send alerts for negative reviews
 *
 * API Documentation: https://developers.google.com/my-business
 */
import { google } from 'googleapis';
import { logger } from '../lib/logger';
export class GoogleBusinessProfileService {
    oauth2Client;
    mybusinessAPI;
    accountId = null;
    constructor(config) {
        this.oauth2Client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
        this.oauth2Client.setCredentials({
            refresh_token: config.refreshToken
        });
        // Initialize Google My Business API v4
        this.mybusinessAPI = google.mybusinessbusinessinformation({
            version: 'v1',
            auth: this.oauth2Client
        });
    }
    /**
     * Set the Google Business Profile account ID
     */
    setAccountId(accountId) {
        this.accountId = accountId;
    }
    /**
     * List all business locations
     */
    async listLocations() {
        try {
            if (!this.accountId) {
                throw new Error('Account ID not set');
            }
            const response = await this.mybusinessAPI.accounts.locations.list({
                parent: `accounts/${this.accountId}`,
                readMask: 'name,title,storefrontAddress'
            });
            const locations = response.data.locations || [];
            return locations.map((loc) => ({
                name: loc.name,
                locationId: loc.name.split('/').pop(),
                displayName: loc.title || 'Unknown Location',
                address: this.formatAddress(loc.storefrontAddress)
            }));
        }
        catch (error) {
            logger.error('[Google Business] Failed to list locations:', error);
            throw error;
        }
    }
    /**
     * Fetch reviews for a specific location
     */
    async getLocationReviews(locationId, pageSize = 50) {
        try {
            const locationName = `accounts/${this.accountId}/locations/${locationId}`;
            // Use the correct API endpoint for reviews
            const mybusinessAccountManagement = google.mybusinessaccountmanagement({
                version: 'v1',
                auth: this.oauth2Client
            });
            const response = await mybusinessAccountManagement.accounts.locations.reviews.list({
                parent: locationName,
                pageSize,
                orderBy: 'updateTime desc'
            });
            return response.data.reviews || [];
        }
        catch (error) {
            logger.error(`[Google Business] Failed to fetch reviews for location ${locationId}:`, error);
            return [];
        }
    }
    /**
     * Get reviews from all locations
     */
    async getAllReviews() {
        try {
            const locations = await this.listLocations();
            const results = [];
            for (const location of locations) {
                const reviews = await this.getLocationReviews(location.locationId);
                results.push({ location, reviews });
            }
            return results;
        }
        catch (error) {
            logger.error('[Google Business] Failed to fetch all reviews:', error);
            throw error;
        }
    }
    /**
     * Reply to a review
     */
    async replyToReview(reviewName, replyText) {
        try {
            const mybusinessAccountManagement = google.mybusinessaccountmanagement({
                version: 'v1',
                auth: this.oauth2Client
            });
            await mybusinessAccountManagement.accounts.locations.reviews.updateReply({
                name: reviewName,
                requestBody: {
                    comment: replyText
                }
            });
            logger.info(`[Google Business] Successfully replied to review: ${reviewName}`);
        }
        catch (error) {
            logger.error('[Google Business] Failed to reply to review:', error);
            throw error;
        }
    }
    /**
     * Delete a review reply
     */
    async deleteReviewReply(reviewName) {
        try {
            const mybusinessAccountManagement = google.mybusinessaccountmanagement({
                version: 'v1',
                auth: this.oauth2Client
            });
            await mybusinessAccountManagement.accounts.locations.reviews.deleteReply({
                name: reviewName
            });
            logger.info(`[Google Business] Successfully deleted reply for review: ${reviewName}`);
        }
        catch (error) {
            logger.error('[Google Business] Failed to delete review reply:', error);
            throw error;
        }
    }
    /**
     * Generate AI-powered review response using Gemini
     */
    async generateReviewResponse(review, language = 'he') {
        try {
            const { generateGeminiResponse } = await import('../gemini');
            const starRatingMap = {
                'ONE': 1,
                'TWO': 2,
                'THREE': 3,
                'FOUR': 4,
                'FIVE': 5
            };
            const rating = starRatingMap[review.starRating] || 0;
            const reviewText = review.comment || 'No comment provided';
            const reviewerName = review.reviewer.displayName;
            const prompt = language === 'he'
                ? `אתה נציג שירות לקוחות מקצועי של Pet Wash - שירות רחצת כלבים אורגני פרימיום.
        
קיבלת ביקורת בגוגל:
⭐ דירוג: ${rating}/5
📝 תוכן: "${reviewText}"
👤 שם הלקוח: ${reviewerName}

כתב תשובה מקצועית, חמה ואישית בעברית:
- אם הדירוג 4-5: הודה, הבע הערכה, הזמן לביקור הבא
- אם הדירוג 1-3: התנצל בכנות, הציע פתרון, הזמן לשיחה אישית
- השתמש בשם הלקוח אם אפשר
- שמור על טון ידידותי ומקצועי
- אל תהיה יותר מדי רשמי
- אל תשתמש באימוג'ים
- אורך מקסימלי: 150 מילים

תשובה:`
                : `You are a professional customer service representative for Pet Wash - a premium organic pet washing service.

You received a Google review:
⭐ Rating: ${rating}/5
📝 Content: "${reviewText}"
👤 Customer: ${reviewerName}

Write a professional, warm, and personalized response in English:
- If rating 4-5: Thank them, express appreciation, invite for next visit
- If rating 1-3: Apologize sincerely, offer solution, invite to discuss personally
- Use customer's name if possible
- Keep friendly and professional tone
- Don't be overly formal
- Don't use emojis
- Maximum length: 150 words

Response:`;
            const response = await generateGeminiResponse(prompt);
            return response.trim();
        }
        catch (error) {
            logger.error('[Google Business] Failed to generate AI response:', error);
            // Fallback response
            return language === 'he'
                ? 'תודה רבה על המשוב! אנחנו מעריכים את הביקורת שלך ומצפים לראותך שוב בקרוב. 🐾'
                : 'Thank you for your feedback! We appreciate your review and look forward to seeing you again soon. 🐾';
        }
    }
    /**
     * Auto-respond to unanswered reviews
     */
    async autoRespondToReviews(language = 'he') {
        try {
            let responseCount = 0;
            const allReviews = await this.getAllReviews();
            for (const { location, reviews } of allReviews) {
                for (const review of reviews) {
                    // Skip if already replied
                    if (review.reviewReply) {
                        continue;
                    }
                    // Generate AI response
                    const response = await this.generateReviewResponse(review, language);
                    // Post reply
                    await this.replyToReview(review.name, response);
                    responseCount++;
                    logger.info(`[Google Business] Auto-replied to review at ${location.displayName}`);
                    // Rate limiting: wait 2 seconds between replies
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            return responseCount;
        }
        catch (error) {
            logger.error('[Google Business] Auto-respond failed:', error);
            throw error;
        }
    }
    /**
     * Get review statistics
     */
    async getReviewStats() {
        try {
            const allReviews = await this.getAllReviews();
            let totalReviews = 0;
            let totalRating = 0;
            let unansweredCount = 0;
            const ratingDistribution = {
                1: 0, 2: 0, 3: 0, 4: 0, 5: 0
            };
            const starRatingMap = {
                'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5
            };
            for (const { reviews } of allReviews) {
                for (const review of reviews) {
                    totalReviews++;
                    const rating = starRatingMap[review.starRating] || 0;
                    totalRating += rating;
                    ratingDistribution[rating]++;
                    if (!review.reviewReply) {
                        unansweredCount++;
                    }
                }
            }
            return {
                totalReviews,
                averageRating: totalReviews > 0 ? totalRating / totalReviews : 0,
                unansweredCount,
                ratingDistribution
            };
        }
        catch (error) {
            logger.error('[Google Business] Failed to get review stats:', error);
            throw error;
        }
    }
    /**
     * Helper: Format address
     */
    formatAddress(address) {
        if (!address)
            return 'Unknown Address';
        const parts = [
            address.addressLines?.join(', '),
            address.locality,
            address.administrativeArea,
            address.postalCode
        ].filter(Boolean);
        return parts.join(', ');
    }
}
// Export singleton instance (will be initialized with env vars)
let gbpService = null;
export function initializeGoogleBusinessProfile(config) {
    gbpService = new GoogleBusinessProfileService(config);
    return gbpService;
}
export function getGoogleBusinessProfile() {
    if (!gbpService) {
        throw new Error('Google Business Profile service not initialized');
    }
    return gbpService;
}
