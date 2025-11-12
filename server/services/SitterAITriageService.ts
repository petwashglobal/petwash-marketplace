/**
 * THE SITTER SUITE™ - AI-Powered Booking Triage Service
 * 
 * Uses Google Gemini 2.5 Flash to analyze booking requests and assign urgency scores.
 * Critical bookings (urgencyScore: 3) trigger instant push notifications to local sitters.
 */

import { GoogleGenAI } from '@google/genai';

export interface BookingTriageRequest {
  startDate: Date;
  endDate: Date;
  petType: string;
  specialNeeds?: string;
  allergies?: string;
  city: string;
  ownerMessage?: string;
}

export interface BookingTriageResult {
  urgencyScore: 1 | 2 | 3; // 1 = standard, 2 = moderate, 3 = critical/last-minute
  triageNotes: string;
  recommendedSitterCount: number;
  estimatedResponseTime: string; // "2-4 hours", "24 hours", "immediate"
  specialRequirements: string[];
}

export class SitterAITriageService {
  private genAI: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('[Sitter AI Triage] GEMINI_API_KEY not configured');
    }
    
    this.genAI = new GoogleGenAI({ apiKey });
  }

  /**
   * Analyze booking request and assign urgency score
   * 
   * Urgency Criteria:
   * - Score 3 (CRITICAL): Booking starts within 24 hours, or pet has severe medical needs
   * - Score 2 (MODERATE): Booking starts within 48 hours, or pet requires special care
   * - Score 1 (STANDARD): Booking starts >48 hours out, standard care needs
   */
  async analyzeBookingUrgency(request: BookingTriageRequest): Promise<BookingTriageResult> {
    try {
      const hoursUntilStart = this.calculateHoursUntilStart(request.startDate);
      const durationDays = this.calculateBookingDays(request.startDate, request.endDate);
      
      const prompt = `You are an AI triage assistant for The Sitter Suite™ pet sitting marketplace.

Analyze this booking request and provide:
1. Urgency Score (1-3):
   - 3 = CRITICAL (starts <24h, severe medical needs, emergency situation)
   - 2 = MODERATE (starts 24-48h, special care requirements)
   - 1 = STANDARD (starts >48h, routine care)

2. Triage Notes (2-3 sentences explaining urgency and key considerations)

3. Recommended Sitter Count (how many sitters should receive instant notification: 3-10)

4. Special Requirements (list any critical care needs)

BOOKING REQUEST:
- Starts in: ${hoursUntilStart} hours
- Duration: ${durationDays} days
- Pet Type: ${request.petType}
- City: ${request.city}
${request.specialNeeds ? `- Special Needs: ${request.specialNeeds}` : ''}
${request.allergies ? `- Allergies: ${request.allergies}` : ''}
${request.ownerMessage ? `- Owner Message: ${request.ownerMessage}` : ''}

Respond in JSON format:
{
  "urgencyScore": 1 | 2 | 3,
  "triageNotes": "string",
  "recommendedSitterCount": number,
  "estimatedResponseTime": "string",
  "specialRequirements": ["string"]
}`;

      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }]
      });
      
      // Extract text from response
      let response = '';
      if (result.candidates && result.candidates.length > 0) {
        const candidate = result.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          const textPart = candidate.content.parts.find(part => part.text);
          if (textPart && textPart.text) {
            response = textPart.text;
          }
        }
      }
      
      if (!response) {
        throw new Error('No valid response from Gemini API');
      }
      
      // Parse JSON response (remove markdown code blocks if present)
      const jsonText = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const triageResult: BookingTriageResult = JSON.parse(jsonText);
      
      // Validate urgency score
      if (![1, 2, 3].includes(triageResult.urgencyScore)) {
        console.warn('[AI Triage] Invalid urgency score, defaulting to 2', { 
          score: triageResult.urgencyScore 
        });
        triageResult.urgencyScore = 2;
      }
      
      console.info('[AI Triage] Booking analyzed', {
        urgencyScore: triageResult.urgencyScore,
        hoursUntilStart,
        city: request.city,
      });
      
      return triageResult;
      
    } catch (error) {
      console.error('[AI Triage] Analysis failed', error);
      
      // Fallback: Calculate urgency based on time alone
      const hoursUntilStart = this.calculateHoursUntilStart(request.startDate);
      const fallbackScore = hoursUntilStart < 24 ? 3 : hoursUntilStart < 48 ? 2 : 1;
      
      return {
        urgencyScore: fallbackScore,
        triageNotes: 'Automated triage (AI analysis unavailable). Urgency based on booking timeline.',
        recommendedSitterCount: fallbackScore === 3 ? 10 : fallbackScore === 2 ? 5 : 3,
        estimatedResponseTime: fallbackScore === 3 ? 'immediate' : fallbackScore === 2 ? '2-4 hours' : '24 hours',
        specialRequirements: request.specialNeeds ? [request.specialNeeds] : [],
      };
    }
  }

  /**
   * Calculate hours until booking start
   */
  private calculateHoursUntilStart(startDate: Date): number {
    const now = new Date();
    const diffMs = startDate.getTime() - now.getTime();
    return Math.round(diffMs / (1000 * 60 * 60));
  }

  /**
   * Calculate booking duration in days
   */
  private calculateBookingDays(startDate: Date, endDate: Date): number {
    const diffMs = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }
}

// Export singleton instance
export const sitterAITriageService = new SitterAITriageService();
