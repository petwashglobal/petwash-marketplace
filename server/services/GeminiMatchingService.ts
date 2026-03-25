/**
 * Gemini AI Provider Matching Service
 * 
 * Smart AI-powered matching that finds the closest and best-suited providers
 * for any ⁦Pet Wash™⁩ service request. Uses Gemini 2.5 Flash for intelligent
 * recommendations based on client needs, location, and provider specializations.
 */

import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import { providers, locations, walkerProfiles, pettrekProviders, platforms } from "@shared/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";

const ai = new GoogleGenAI({ 
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "" 
});

interface ClientLocation {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

interface ServiceRequest {
  // pet_taxi REMOVED — PetTrek not licensed in Israel (DO NOT restore without legal clearance)
  serviceType: 'pet_sitting' | 'daycare' | 'dog_walking' | 'training' | 'grooming' | 'k9000_wash';
  petType?: string;
  petSize?: string;
  specialNeeds?: string[];
  preferredLanguage?: 'en' | 'he' | 'ar' | 'ru' | 'fr' | 'es';
  scheduledDate?: string;
  scheduledTime?: string;
  notes?: string;
}

interface MatchedProvider {
  providerId: number;
  userId: string;
  displayName: string;
  businessName?: string | null;
  photoUrl?: string | null;
  bio?: string | null;
  distance: number;
  distanceUnit: 'km' | 'mi';
  averageRating: number;
  totalReviews: number;
  totalBookings: number;
  isVerified: boolean;
  specializations?: string[];
  languages?: string[];
  matchScore: number;
  aiRecommendation?: string;
  platformId: string;
}

interface MatchingResult {
  success: boolean;
  matches: MatchedProvider[];
  totalFound: number;
  aiSummary?: string;
  searchRadius: number;
  serviceType: string;
  error?: string;
}

// LEGAL: pet_taxi → 'pettrek' REMOVED. PetTrek is not licensed in Israel.
// All 5 server layers already return 403 PETTREK_NOT_LICENSED.
// Removing from the matching service prevents pettrek providers from
// surfacing in AI recommendation results even before they hit the API.
const SERVICE_TYPE_TO_PLATFORM: Record<string, string> = {
  pet_sitting: 'sitter-suite',
  daycare: 'daycare',
  dog_walking: 'walk-my-pet',
  training: 'training',
  grooming: 'grooming',
  k9000_wash: 'k9000',
};

function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10;
}

export class GeminiMatchingService {
  private maxRadius = 50;
  private defaultRadius = 15;
  private maxResults = 20;

  async findMatchingProviders(
    clientLocation: ClientLocation,
    serviceRequest: ServiceRequest,
    radiusKm?: number
  ): Promise<MatchingResult> {
    const startTime = Date.now();
    const searchRadius = radiusKm || this.defaultRadius;
    
    try {
      logger.info('[GeminiMatching] Starting provider search', {
        serviceType: serviceRequest.serviceType,
        location: `${clientLocation.latitude}, ${clientLocation.longitude}`,
        radius: searchRadius
      });

      const platformId = SERVICE_TYPE_TO_PLATFORM[serviceRequest.serviceType];
      if (!platformId) {
        return {
          success: false,
          matches: [],
          totalFound: 0,
          searchRadius,
          serviceType: serviceRequest.serviceType,
          error: `Unknown service type: ${serviceRequest.serviceType}`
        };
      }

      const providersWithLocations = await db
        .select({
          provider: providers,
          location: locations,
        })
        .from(providers)
        .leftJoin(locations, eq(locations.providerId, providers.id))
        .where(
          and(
            eq(providers.platformId, platformId),
            eq(providers.isActive, true),
            eq(providers.isAvailable, true)
          )
        )
        .limit(100);

      const matchedProviders: MatchedProvider[] = [];

      for (const row of providersWithLocations) {
        const { provider, location } = row;
        
        // Skip providers with no known location — do NOT assign a fake random
        // distance (previous code did Math.random() × searchRadius which made
        // unlocated providers appear in results with fabricated distances).
        if (!location?.latitude || !location?.longitude) {
          logger.debug('[GeminiMatching] Skipping provider with no location', {
            providerId: provider.id,
          });
          continue;
        }

        const distance = calculateDistance(
          clientLocation.latitude,
          clientLocation.longitude,
          location.latitude,
          location.longitude
        );

        if (distance <= searchRadius) {
          const serviceRadius = provider.serviceRadius || 10;
          const inServiceArea = distance <= serviceRadius;
          
          const rating = parseFloat(provider.averageRating?.toString() || '4.5');
          const bookings = provider.totalBookings || 0;
          const reviews = provider.totalReviews || 0;
          const isVerified = provider.verificationStatus === 'verified';
          
          let matchScore = 100;
          matchScore -= (distance / searchRadius) * 30;
          matchScore += (rating / 5) * 25;
          matchScore += Math.min(bookings / 50, 1) * 15;
          matchScore += Math.min(reviews / 30, 1) * 10;
          matchScore += isVerified ? 20 : 0;
          if (!inServiceArea) matchScore -= 20;
          
          matchScore = Math.max(0, Math.min(100, Math.round(matchScore)));

          matchedProviders.push({
            providerId: provider.id,
            userId: provider.userId,
            displayName: provider.businessName || `Provider #${provider.id}`,
            businessName: provider.businessName,
            photoUrl: provider.photoUrl,
            bio: provider.bio,
            distance,
            distanceUnit: 'km',
            averageRating: rating,
            totalReviews: reviews,
            totalBookings: bookings,
            isVerified,
            specializations: [],
            languages: provider.languages || [],
            matchScore,
            platformId: provider.platformId,
          });
        }
      }

      matchedProviders.sort((a, b) => b.matchScore - a.matchScore);
      const topMatches = matchedProviders.slice(0, this.maxResults);

      let aiSummary: string | undefined;
      if (topMatches.length > 0) {
        aiSummary = await this.generateAIRecommendations(
          topMatches.slice(0, 5),
          serviceRequest,
          clientLocation
        );
      }

      const duration = Date.now() - startTime;
      logger.info('[GeminiMatching] Search completed', {
        serviceType: serviceRequest.serviceType,
        totalFound: matchedProviders.length,
        returned: topMatches.length,
        duration: `${duration}ms`
      });

      return {
        success: true,
        matches: topMatches,
        totalFound: matchedProviders.length,
        aiSummary,
        searchRadius,
        serviceType: serviceRequest.serviceType,
      };

    } catch (error) {
      logger.error('[GeminiMatching] Search failed', error);
      return {
        success: false,
        matches: [],
        totalFound: 0,
        searchRadius,
        serviceType: serviceRequest.serviceType,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async generateAIRecommendations(
    providers: MatchedProvider[],
    request: ServiceRequest,
    location: ClientLocation
  ): Promise<string | undefined> {
    try {
      const lang = request.preferredLanguage || 'en';
      const langName = {
        en: 'English',
        he: 'Hebrew',
        ar: 'Arabic',
        ru: 'Russian',
        fr: 'French',
        es: 'Spanish'
      }[lang];

      const providerSummary = providers.map((p, i) => 
        `${i + 1}. ${p.displayName} - ${p.distance}km away, ${p.averageRating}★ rating, ${p.totalBookings} bookings, ${p.isVerified ? 'verified' : 'pending verification'}`
      ).join('\n');

      const prompt = `You are a helpful pet care concierge for ⁦Pet Wash™⁩, Israel's premier luxury pet services marketplace.

A customer is looking for ${request.serviceType.replace(/_/g, ' ')} services.
${request.petType ? `Pet type: ${request.petType}` : ''}
${request.petSize ? `Pet size: ${request.petSize}` : ''}
${request.specialNeeds?.length ? `Special needs: ${request.specialNeeds.join(', ')}` : ''}
${request.notes ? `Customer notes: ${request.notes}` : ''}

Here are the closest available providers:
${providerSummary}

Respond in ${langName}. Write a brief, friendly 2-3 sentence recommendation explaining why the top provider(s) would be a great match. Be warm and professional. Do NOT use emojis.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      return response.text || undefined;

    } catch (error) {
      logger.warn('[GeminiMatching] AI recommendation failed, continuing without', { error });
      return undefined;
    }
  }

  async findNearestProvider(
    clientLocation: ClientLocation,
    serviceType: string
  ): Promise<MatchedProvider | null> {
    const result = await this.findMatchingProviders(
      clientLocation,
      { serviceType: serviceType as ServiceRequest['serviceType'] },
      this.maxRadius
    );

    if (result.success && result.matches.length > 0) {
      return result.matches[0];
    }
    return null;
  }

  async searchWithAI(
    query: string,
    clientLocation: ClientLocation,
    preferredLanguage: 'en' | 'he' = 'en'
  ): Promise<MatchingResult> {
    try {
      // pet_taxi / PetTrek intentionally excluded — not licensed in Israel
      const detectPrompt = `Analyze this pet care service request and extract the service type.
      
Request: "${query}"

Respond with ONLY one of these service types (no other text):
- pet_sitting
- daycare
- dog_walking
- training
- grooming
- k9000_wash

If unclear, respond with: pet_sitting`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: detectPrompt }] }],
      });

      const detectedService = (response.text || 'pet_sitting').trim().toLowerCase() as ServiceRequest['serviceType'];
      const validServices = ['pet_sitting', 'daycare', 'dog_walking', 'training', 'grooming', 'k9000_wash'];
      const serviceType = validServices.includes(detectedService) ? detectedService : 'pet_sitting';

      return this.findMatchingProviders(
        clientLocation,
        { serviceType, preferredLanguage, notes: query }
      );

    } catch (error) {
      logger.error('[GeminiMatching] AI search failed', error);
      return this.findMatchingProviders(
        clientLocation,
        { serviceType: 'pet_sitting', preferredLanguage }
      );
    }
  }
}

export const geminiMatchingService = new GeminiMatchingService();
