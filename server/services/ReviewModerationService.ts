/**
 * REVIEW MODERATION SERVICE
 * =========================
 * AI-powered review moderation (like TripAdvisor)
 * 
 * Features:
 * - Gemini AI pre-screening for defamation, profanity, fake reviews
 * - Israeli Defamation Law 1965 compliance
 * - EU Digital Services Act compliance
 * - Immutable audit trail
 * - Provider response mechanism
 * - Legal safe-harbor protection
 * 
 * Created: November 10, 2025
 */

import { db } from "../db";
import { eq, and, or } from "drizzle-orm";
import {
  reviewModeration,
  reviewModerationRules,
  type InsertReviewModeration,
  type ReviewModerationRule,
} from "@shared/schema-compliance";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";

/**
 * AI moderation result
 */
export interface AIModerationResult {
  shouldFlag: boolean;
  confidence: number; // 0-100
  detectedIssues: string[];
  recommendation: "approve" | "reject" | "manual_review";
  explanation: string;
  flaggedRules: string[];
  requiresLegalReview: boolean;
}

/**
 * Review submission for moderation
 */
export interface ReviewSubmission {
  reviewId: number;
  customerId: number;
  providerId: number;
  serviceType: string;
  reviewText: string;
  rating: number;
}

/**
 * Review Moderation Service
 */
export class ReviewModerationService {
  private geminiAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.geminiAI = new GoogleGenerativeAI(apiKey);
    } else {
      console.warn("GEMINI_API_KEY not set - AI moderation will be limited to keyword matching");
    }
  }

  /**
   * Moderate review with AI pre-screening
   */
  async moderateReview(submission: ReviewSubmission): Promise<any> {
    // Get active moderation rules
    const rules = await db
      .select()
      .from(reviewModerationRules)
      .where(eq(reviewModerationRules.isActive, true));

    // Run AI analysis if available
    let aiResult: AIModerationResult | null = null;
    if (this.geminiAI) {
      aiResult = await this.runAIModeration(submission.reviewText, rules);
    } else {
      // Fallback to keyword matching
      aiResult = await this.runKeywordModeration(submission.reviewText, rules);
    }

    // Determine status
    let status = "pending";
    if (aiResult.recommendation === "approve" && aiResult.confidence >= 90) {
      status = "approved";
    } else if (aiResult.recommendation === "reject" && aiResult.confidence >= 90) {
      status = "rejected";
    } else {
      status = "flagged"; // Requires manual review
    }

    // Create audit hash for immutability
    const auditData = {
      ...submission,
      aiResult,
      timestamp: new Date().toISOString(),
    };
    const auditHash = createHash("sha256").update(JSON.stringify(auditData)).digest("hex");

    // Save moderation record
    const [moderated] = await db
      .insert(reviewModeration)
      .values({
        reviewId: submission.reviewId,
        customerId: submission.customerId,
        providerId: submission.providerId,
        serviceType: submission.serviceType,
        originalReviewText: submission.reviewText,
        rating: submission.rating,
        status,
        flaggedReason: aiResult.detectedIssues.length > 0 ? aiResult.detectedIssues[0] : null,
        flaggedByRule: aiResult.flaggedRules.length > 0 ? aiResult.flaggedRules[0] : null,
        aiConfidenceScore: aiResult.confidence.toString(),
        aiDetectedIssues: aiResult.detectedIssues,
        aiRecommendation: aiResult.recommendation,
        legalReviewRequired: aiResult.requiresLegalReview,
        auditHash,
      } as InsertReviewModeration)
      .returning();

    return moderated;
  }

  /**
   * Run Gemini AI moderation
   */
  private async runAIModeration(reviewText: string, rules: ReviewModerationRule[]): Promise<AIModerationResult> {
    if (!this.geminiAI) {
      return this.runKeywordModeration(reviewText, rules);
    }

    try {
      const model = this.geminiAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const prompt = `You are a review moderation AI for Pet Wash™, a pet services platform.

Your task: Analyze this customer review for policy violations.

Review Text: "${reviewText}"

Check for these violations:
1. Defamation - False statements that could harm provider's reputation (Israeli Defamation Law 1965)
2. Profanity - Offensive language, curse words, slurs
3. Fake Review - Suspicious patterns suggesting fake review (repetitive text, generic praise/criticism, competitor mention)
4. Personal Information - Disclosure of personal data (names, phone numbers, addresses, emails)
5. Spam - Commercial links, advertising, promotional content
6. Threats or Violence - Threats, violent language, harassment

Israeli Legal Context:
- Defamation Law 1965: Prohibits publishing false statements that damage reputation
- Privacy Protection Law: Prohibits unauthorized disclosure of personal information
- Prohibition of Defamation Law Amendment 2011: Increased penalties for online defamation

Return ONLY a valid JSON object with this exact structure:
{
  "shouldFlag": boolean,
  "confidence": number (0-100),
  "detectedIssues": string[],
  "recommendation": "approve" | "reject" | "manual_review",
  "explanation": string,
  "requiresLegalReview": boolean
}`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse AI response");
      }

      const aiAnalysis = JSON.parse(jsonMatch[0]);

      // Map to our result format
      const detectedIssues = aiAnalysis.detectedIssues || [];
      const flaggedRules = this.mapIssusToRules(detectedIssues, rules);

      return {
        shouldFlag: aiAnalysis.shouldFlag || false,
        confidence: aiAnalysis.confidence || 50,
        detectedIssues,
        recommendation: aiAnalysis.recommendation || "manual_review",
        explanation: aiAnalysis.explanation || "AI analysis completed",
        flaggedRules,
        requiresLegalReview: aiAnalysis.requiresLegalReview || false,
      };
    } catch (error: any) {
      console.error("Gemini AI moderation error:", error);
      // Fallback to keyword matching
      return this.runKeywordModeration(reviewText, rules);
    }
  }

  /**
   * Fallback keyword-based moderation
   */
  private async runKeywordModeration(reviewText: string, rules: ReviewModerationRule[]): Promise<AIModerationResult> {
    const detectedIssues: string[] = [];
    const flaggedRules: string[] = [];
    let maxSeverity = "low";
    let requiresLegalReview = false;

    const lowerText = reviewText.toLowerCase();

    for (const rule of rules) {
      if (!rule.keywords) continue;

      const keywords = rule.keywords as string[];
      const keywordsHe = rule.keywordsHe as string[] || [];

      const allKeywords = [...keywords, ...keywordsHe];
      const found = allKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));

      if (found) {
        detectedIssues.push(rule.ruleType);
        flaggedRules.push(rule.ruleId);
        
        if (rule.severityLevel === "critical" || rule.severityLevel === "high") {
          maxSeverity = "high";
        }

        if (rule.requiresLegalReview) {
          requiresLegalReview = true;
        }
      }
    }

    const shouldFlag = detectedIssues.length > 0;
    const confidence = shouldFlag ? 75 : 85; // Keyword matching is less confident than AI

    let recommendation: "approve" | "reject" | "manual_review" = "approve";
    if (maxSeverity === "high" || requiresLegalReview) {
      recommendation = "manual_review";
    } else if (shouldFlag) {
      recommendation = "manual_review";
    }

    return {
      shouldFlag,
      confidence,
      detectedIssues,
      recommendation,
      explanation: shouldFlag
        ? `Flagged by keyword matching: ${detectedIssues.join(", ")}`
        : "No policy violations detected",
      flaggedRules,
      requiresLegalReview,
    };
  }

  /**
   * Map detected issues to rule IDs
   */
  private mapIssusToRules(issues: string[], rules: ReviewModerationRule[]): string[] {
    const flaggedRules: string[] = [];

    for (const issue of issues) {
      const matchingRule = rules.find(r => 
        r.ruleType.toLowerCase().includes(issue.toLowerCase()) ||
        issue.toLowerCase().includes(r.ruleType.toLowerCase())
      );

      if (matchingRule) {
        flaggedRules.push(matchingRule.ruleId);
      }
    }

    return flaggedRules;
  }

  /**
   * Approve review (admin action)
   */
  async approveReview(
    moderationId: number,
    reviewedBy: number,
    moderatorNotes?: string
  ): Promise<any> {
    const [updated] = await db
      .update(reviewModeration)
      .set({
        status: "approved",
        reviewedBy,
        reviewedAt: new Date(),
        moderatorNotes,
        updatedAt: new Date(),
      })
      .where(eq(reviewModeration.id, moderationId))
      .returning();

    return updated;
  }

  /**
   * Reject review (admin action)
   */
  async rejectReview(
    moderationId: number,
    reviewedBy: number,
    moderatorNotes?: string
  ): Promise<any> {
    const [updated] = await db
      .update(reviewModeration)
      .set({
        status: "rejected",
        reviewedBy,
        reviewedAt: new Date(),
        moderatorNotes,
        updatedAt: new Date(),
      })
      .where(eq(reviewModeration.id, moderationId))
      .returning();

    return updated;
  }

  /**
   * Escalate to legal review
   */
  async escalateToLegal(
    moderationId: number,
    reviewedBy: number,
    legalNotes: string
  ): Promise<any> {
    const [updated] = await db
      .update(reviewModeration)
      .set({
        status: "escalated",
        legalReviewRequired: true,
        reviewedBy,
        reviewedAt: new Date(),
        moderatorNotes: legalNotes,
        updatedAt: new Date(),
      })
      .where(eq(reviewModeration.id, moderationId))
      .returning();

    return updated;
  }

  /**
   * Allow provider response
   */
  async addProviderResponse(
    moderationId: number,
    responseText: string
  ): Promise<any> {
    const [updated] = await db
      .update(reviewModeration)
      .set({
        providerResponseText: responseText,
        providerResponseAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reviewModeration.id, moderationId))
      .returning();

    // Notify provider
    const [moderation] = await db
      .update(reviewModeration)
      .set({
        providerNotified: true,
        providerNotifiedAt: new Date(),
      })
      .where(eq(reviewModeration.id, moderationId))
      .returning();

    return updated;
  }

  /**
   * Get reviews pending moderation
   */
  async getPendingReviews(limit: number = 50): Promise<any[]> {
    const pending = await db
      .select()
      .from(reviewModeration)
      .where(
        or(
          eq(reviewModeration.status, "pending"),
          eq(reviewModeration.status, "flagged")
        )
      )
      .limit(limit);

    return pending;
  }

  /**
   * Get reviews requiring legal review
   */
  async getReviewsForLegal(limit: number = 50): Promise<any[]> {
    const forLegal = await db
      .select()
      .from(reviewModeration)
      .where(
        and(
          eq(reviewModeration.legalReviewRequired, true),
          or(
            eq(reviewModeration.status, "flagged"),
            eq(reviewModeration.status, "escalated")
          )
        )
      )
      .limit(limit);

    return forLegal;
  }
}

// Export singleton instance
export const reviewModerationService = new ReviewModerationService();
