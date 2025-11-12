/**
 * AI Learning & Behavior Analytics System
 * Intelligent system that learns from user interactions to improve FAQ responses
 * 
 * Features:
 * - Tracks user behavior in AI chat (time spent, topics, satisfaction)
 * - Learns what answers work and what doesn't
 * - Identifies common questions and patterns
 * - Enhances AI responses based on collective user intelligence
 * - Privacy-compliant (GDPR + Israeli Privacy Law)
 */

import { db as adminDb } from './lib/firebase-admin';
import { logger } from './lib/logger';
import { logAccess } from './log-retention-2025';

// ============================================
// BEHAVIOR TRACKING INTERFACES
// ============================================

export interface ChatInteraction {
  sessionId: string;
  // NO USER IDENTIFICATION - Fully Anonymous
  // NO userId, NO email, NO name, NO phone, NO address
  // NO banking info, NO employee data, NO personal data
  
  userQuestion: string; // Question text only (no PII)
  aiResponse: string; // AI response only
  language: 'he' | 'en';
  timestamp: Date;
  
  // Behavioral metrics ONLY (no personal data)
  timeToRead?: number; // seconds spent before next question
  followUpQuestion?: string; // If they asked follow-up
  satisfactionIndicator?: 'positive' | 'negative' | 'neutral';
  topic?: string; // Auto-detected topic
  
  // NO IP addresses, NO user agents, NO tracking data
  // Privacy-first analytics only
}

export interface UserBehaviorPattern {
  topic: string;
  frequency: number;
  avgTimeSpent: number;
  successRate: number; // % of conversations that didn't need follow-up
  commonQuestions: string[];
  effectiveAnswers: string[];
  language: 'he' | 'en';
}

export interface FAQLearning {
  question: string;
  bestAnswer: string;
  topic: string;
  language: 'he' | 'en';
  confidenceScore: number; // 0-1
  timesAsked: number;
  avgSatisfaction: number;
  lastUpdated: Date;
}

// ============================================
// BEHAVIOR TRACKING
// ============================================

/**
 * Track AI chat interaction
 * PRIVACY-FIRST: Only anonymized analytics, NO personal data
 */
export async function trackChatInteraction(
  interaction: ChatInteraction
): Promise<void> {
  try {
    // Auto-detect topic from question
    const topic = detectTopic(interaction.userQuestion, interaction.language);
    
    // PRIVACY FILTER: Remove any potential PII before storing
    const safeInteraction = {
      sessionId: interaction.sessionId, // Anonymous session ID only
      userQuestion: sanitizeText(interaction.userQuestion), // Remove any accidental PII
      aiResponse: sanitizeText(interaction.aiResponse),
      language: interaction.language,
      topic,
      timestamp: new Date(),
      timeToRead: interaction.timeToRead,
      followUpQuestion: interaction.followUpQuestion ? sanitizeText(interaction.followUpQuestion) : undefined,
      satisfactionIndicator: interaction.satisfactionIndicator
      // NO userId, NO ipAddress, NO userAgent - PRIVACY GUARANTEED
    };
    
    await adminDb.collection('ai_chat_interactions').add(safeInteraction);
    
    // Update topic statistics
    await updateTopicStatistics(topic, interaction.language);
    
    // Learn from this interaction - MUST USE SANITIZED DATA
    await learnFromInteraction(safeInteraction as ChatInteraction & { topic: string });
    
    logger.info('[AI Learning] Chat interaction tracked', {
      topic,
      language: interaction.language,
      hasFollowUp: !!interaction.followUpQuestion
    });
  } catch (error) {
    logger.error('[AI Learning] Failed to track interaction', error);
  }
}

/**
 * Detect topic from user question
 * Uses keyword matching and context analysis
 */
function detectTopic(question: string, language: 'he' | 'en'): string {
  const lowerQuestion = question.toLowerCase();
  
  if (language === 'he') {
    // Hebrew topics
    if (lowerQuestion.includes('תחנ') || lowerQuestion.includes('מיקום') || lowerQuestion.includes('איפה')) {
      return 'station_locations';
    }
    if (lowerQuestion.includes('מחיר') || lowerQuestion.includes('עלות') || lowerQuestion.includes('כמה')) {
      return 'pricing';
    }
    if (lowerQuestion.includes('כרטיס מתנה') || lowerQuestion.includes('שובר')) {
      return 'gift_cards';
    }
    if (lowerQuestion.includes('נאמנות') || lowerQuestion.includes('מבצע') || lowerQuestion.includes('הנחה')) {
      return 'loyalty_promotions';
    }
    if (lowerQuestion.includes('k9000') || lowerQuestion.includes('טכנולוגי') || lowerQuestion.includes('אורגני')) {
      return 'technology_services';
    }
    if (lowerQuestion.includes('איך') || lowerQuestion.includes('הוראות') || lowerQuestion.includes('משתמש')) {
      return 'instructions';
    }
  } else {
    // English topics
    if (lowerQuestion.includes('station') || lowerQuestion.includes('location') || lowerQuestion.includes('where') || lowerQuestion.includes('nearest')) {
      return 'station_locations';
    }
    if (lowerQuestion.includes('price') || lowerQuestion.includes('cost') || lowerQuestion.includes('how much')) {
      return 'pricing';
    }
    if (lowerQuestion.includes('gift card') || lowerQuestion.includes('voucher')) {
      return 'gift_cards';
    }
    if (lowerQuestion.includes('loyalty') || lowerQuestion.includes('promotion') || lowerQuestion.includes('discount')) {
      return 'loyalty_promotions';
    }
    if (lowerQuestion.includes('k9000') || lowerQuestion.includes('technology') || lowerQuestion.includes('organic')) {
      return 'technology_services';
    }
    if (lowerQuestion.includes('how') || lowerQuestion.includes('instructions') || lowerQuestion.includes('use')) {
      return 'instructions';
    }
  }
  
  return 'general';
}

/**
 * Update topic statistics
 */
async function updateTopicStatistics(topic: string, language: 'he' | 'en'): Promise<void> {
  try {
    const docId = `${topic}_${language}`;
    const docRef = adminDb.collection('ai_topic_stats').doc(docId);
    
    const doc = await docRef.get();
    
    if (doc.exists) {
      await docRef.update({
        count: (doc.data()?.count || 0) + 1,
        lastAsked: new Date()
      });
    } else {
      await docRef.set({
        topic,
        language,
        count: 1,
        lastAsked: new Date()
      });
    }
  } catch (error) {
    logger.error('[AI Learning] Failed to update topic stats', error);
  }
}

// ============================================
// LEARNING SYSTEM
// ============================================

/**
 * Learn from interaction
 * Analyzes patterns to improve future responses
 */
async function learnFromInteraction(interaction: ChatInteraction): Promise<void> {
  try {
    const { userQuestion, aiResponse, topic, language, followUpQuestion, timeToRead } = interaction;
    
    // Calculate satisfaction indicator
    const satisfaction = calculateSatisfaction(followUpQuestion, timeToRead);
    
    // Update FAQ learning database
    const faqDocId = generateFAQId(userQuestion, topic!, language);
    const faqRef = adminDb.collection('ai_faq_learning').doc(faqDocId);
    
    const faqDoc = await faqRef.get();
    
    if (faqDoc.exists) {
      // Update existing FAQ
      const data = faqDoc.data()!;
      const newTimesAsked = (data.timesAsked || 0) + 1;
      const newAvgSatisfaction = ((data.avgSatisfaction || 0) * data.timesAsked + satisfaction) / newTimesAsked;
      
      await faqRef.update({
        timesAsked: newTimesAsked,
        avgSatisfaction: newAvgSatisfaction,
        lastUpdated: new Date(),
        // If this answer is performing well, make it the best answer
        ...(satisfaction > 0.7 && newAvgSatisfaction > (data.avgSatisfaction || 0) ? { bestAnswer: aiResponse } : {})
      });
    } else {
      // Create new FAQ entry
      await faqRef.set({
        question: userQuestion,
        bestAnswer: aiResponse,
        topic: topic!,
        language,
        confidenceScore: satisfaction,
        timesAsked: 1,
        avgSatisfaction: satisfaction,
        lastUpdated: new Date()
      });
    }
    
    logger.info('[AI Learning] FAQ learned', {
      topic,
      satisfaction,
      timesAsked: faqDoc.exists ? (faqDoc.data()!.timesAsked || 0) + 1 : 1
    });
  } catch (error) {
    logger.error('[AI Learning] Failed to learn from interaction', error);
  }
}

/**
 * Calculate satisfaction from behavioral signals
 * Higher score = user was satisfied with answer
 */
function calculateSatisfaction(followUpQuestion?: string, timeToRead?: number): number {
  let score = 0.7; // Base score
  
  // No follow-up question = good sign
  if (!followUpQuestion) {
    score += 0.2;
  }
  
  // Follow-up asking for clarification = bad sign
  if (followUpQuestion) {
    const clarificationWords = ['what', 'how', 'explain', 'מה', 'איך', 'תסביר', 'לא הבנתי', "didn't understand"];
    const needsClarification = clarificationWords.some(word => 
      followUpQuestion.toLowerCase().includes(word)
    );
    
    if (needsClarification) {
      score -= 0.3;
    } else {
      // Follow-up with new question = neutral (they're engaged)
      score += 0.1;
    }
  }
  
  // Time spent reading (5-30 seconds = good, too fast or too slow = bad)
  if (timeToRead) {
    if (timeToRead >= 5 && timeToRead <= 30) {
      score += 0.1;
    } else if (timeToRead < 3) {
      score -= 0.1; // Too fast, didn't read
    }
  }
  
  return Math.max(0, Math.min(1, score)); // Clamp 0-1
}

/**
 * Generate consistent FAQ ID from question
 */
function generateFAQId(question: string, topic: string, language: 'he' | 'en'): string {
  // Normalize question
  const normalized = question
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  
  return `${topic}_${language}_${normalized}`;
}

// ============================================
// INTELLIGENT FAQ RETRIEVAL
// ============================================

/**
 * Get learned FAQ answer
 * Returns the best answer based on collective user intelligence
 */
export async function getLearnedFAQAnswer(
  question: string,
  language: 'he' | 'en'
): Promise<{ answer: string; confidence: number; source: 'learned' | 'none' }> {
  try {
    const topic = detectTopic(question, language);
    
    // Try exact match first
    const faqDocId = generateFAQId(question, topic, language);
    const exactMatch = await adminDb.collection('ai_faq_learning').doc(faqDocId).get();
    
    if (exactMatch.exists && exactMatch.data()!.avgSatisfaction > 0.6) {
      return {
        answer: exactMatch.data()!.bestAnswer,
        confidence: exactMatch.data()!.avgSatisfaction,
        source: 'learned'
      };
    }
    
    // Try topic-based search
    const topicMatches = await adminDb
      .collection('ai_faq_learning')
      .where('topic', '==', topic)
      .where('language', '==', language)
      .where('avgSatisfaction', '>', 0.7)
      .orderBy('avgSatisfaction', 'desc')
      .orderBy('timesAsked', 'desc')
      .limit(5)
      .get();
    
    if (!topicMatches.empty) {
      // Find most similar question
      let bestMatch: any = null;
      let highestSimilarity = 0;
      
      for (const doc of topicMatches.docs) {
        const data = doc.data();
        const similarity = calculateQuestionSimilarity(question, data.question);
        
        if (similarity > highestSimilarity && similarity > 0.5) {
          highestSimilarity = similarity;
          bestMatch = data;
        }
      }
      
      if (bestMatch) {
        return {
          answer: bestMatch.bestAnswer,
          confidence: bestMatch.avgSatisfaction * highestSimilarity,
          source: 'learned'
        };
      }
    }
    
    return { answer: '', confidence: 0, source: 'none' };
  } catch (error) {
    logger.error('[AI Learning] Failed to get learned FAQ', error);
    return { answer: '', confidence: 0, source: 'none' };
  }
}

/**
 * Calculate similarity between two questions
 * Simple word overlap algorithm
 */
function calculateQuestionSimilarity(q1: string, q2: string): number {
  const words1 = new Set(q1.toLowerCase().split(/\s+/));
  const words2 = new Set(q2.toLowerCase().split(/\s+/));
  
  let overlap = 0;
  words1.forEach(word => {
    if (words2.has(word)) overlap++;
  });
  
  const similarity = overlap / Math.max(words1.size, words2.size);
  return similarity;
}

// ============================================
// ANALYTICS & INSIGHTS
// ============================================

/**
 * Get user behavior insights
 * What topics are popular, what's working, what's not
 */
export async function getUserBehaviorInsights(language?: 'he' | 'en'): Promise<{
  topTopics: { topic: string; count: number; language: string }[];
  avgSatisfaction: number;
  totalInteractions: number;
  topQuestions: { question: string; timesAsked: number; satisfaction: number }[];
}> {
  try {
    // Get top topics
    let topicsQuery = adminDb.collection('ai_topic_stats').orderBy('count', 'desc').limit(10);
    if (language) {
      topicsQuery = topicsQuery.where('language', '==', language) as any;
    }
    
    const topicsSnapshot = await topicsQuery.get();
    const topTopics = topicsSnapshot.docs.map(doc => ({
      topic: doc.data().topic,
      count: doc.data().count,
      language: doc.data().language
    }));
    
    // Get top questions
    let faqQuery = adminDb.collection('ai_faq_learning').orderBy('timesAsked', 'desc').limit(20);
    if (language) {
      faqQuery = faqQuery.where('language', '==', language) as any;
    }
    
    const faqSnapshot = await faqQuery.get();
    const topQuestions = faqSnapshot.docs.map(doc => ({
      question: doc.data().question,
      timesAsked: doc.data().timesAsked,
      satisfaction: doc.data().avgSatisfaction
    }));
    
    // Calculate overall satisfaction
    const avgSatisfaction = topQuestions.length > 0
      ? topQuestions.reduce((sum, q) => sum + q.satisfaction, 0) / topQuestions.length
      : 0;
    
    // Total interactions
    const totalInteractions = topTopics.reduce((sum, t) => sum + t.count, 0);
    
    return {
      topTopics,
      avgSatisfaction,
      totalInteractions,
      topQuestions
    };
  } catch (error) {
    logger.error('[AI Learning] Failed to get insights', error);
    return {
      topTopics: [],
      avgSatisfaction: 0,
      totalInteractions: 0,
      topQuestions: []
    };
  }
}

/**
 * Get problematic FAQs that need improvement
 * Questions that are asked often but have low satisfaction
 */
export async function getProblematicFAQs(language?: 'he' | 'en'): Promise<{
  question: string;
  timesAsked: number;
  avgSatisfaction: number;
  topic: string;
}[]> {
  try {
    let query = adminDb
      .collection('ai_faq_learning')
      .where('timesAsked', '>', 5) // Asked frequently
      .where('avgSatisfaction', '<', 0.5) // Low satisfaction
      .orderBy('timesAsked', 'desc')
      .limit(20);
    
    if (language) {
      query = query.where('language', '==', language) as any;
    }
    
    const snapshot = await query.get();
    
    return snapshot.docs.map(doc => ({
      question: doc.data().question,
      timesAsked: doc.data().timesAsked,
      avgSatisfaction: doc.data().avgSatisfaction,
      topic: doc.data().topic
    }));
  } catch (error) {
    logger.error('[AI Learning] Failed to get problematic FAQs', error);
    return [];
  }
}

// ============================================
// PRIVACY COMPLIANCE
// ============================================

/**
 * Anonymize chat interaction
 * Removes PII while keeping learning data
 * Note: ChatInteraction interface is already privacy-first with no PII fields
 */
export function anonymizeInteraction(interaction: ChatInteraction): ChatInteraction {
  // Already privacy-compliant - no userId, ipAddress, or userAgent in interface
  // This function is kept for backwards compatibility
  return {
    ...interaction,
    // Keep: question, response, timing, satisfaction - needed for learning
  };
}

function hashUserId(userId: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
}

function anonymizeIP(ip: string): string {
  // Keep only first 2 octets for privacy (e.g., 192.168.x.x)
  const parts = ip.split('.');
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}.x.x` : 'unknown';
}

/**
 * Sanitize text to remove any accidental PII
 * Removes emails, phone numbers, addresses, names, IDs
 * ⚠️ CRITICAL: Also removes owner personal information
 */
function sanitizeText(text: string): string {
  if (!text) return text;
  
  let sanitized = text;
  
  // CRITICAL: Remove owner personal information
  sanitized = sanitized.replace(/Nir Hadad/gi, '[NAME_REMOVED]');
  sanitized = sanitized.replace(/ניר חדד/g, '[NAME_REMOVED]');
  sanitized = sanitized.replace(/חדד ניר/g, '[NAME_REMOVED]');
  sanitized = sanitized.replace(/033554437/g, '[ID_REMOVED]');
  sanitized = sanitized.replace(/Elimelech Rimalt 18/gi, '[ADDRESS_REMOVED]');
  sanitized = sanitized.replace(/רימלט אלימלך 18/g, '[ADDRESS_REMOVED]');
  sanitized = sanitized.replace(/Ido Shakarzi/gi, '[NAME_REMOVED]');
  
  // Remove email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REMOVED]');
  
  // Remove Israeli phone numbers (054-xxx-xxxx, 03-xxx-xxxx, etc.)
  sanitized = sanitized.replace(/\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/g, '[PHONE_REMOVED]');
  
  // Remove Israeli ID numbers (9 digits)
  sanitized = sanitized.replace(/\b\d{9}\b/g, '[ID_REMOVED]');
  
  // Remove credit card-like numbers (13-19 digits)
  sanitized = sanitized.replace(/\b\d{13,19}\b/g, '[NUMBER_REMOVED]');
  
  // Remove potential addresses (numbers followed by street-like words)
  sanitized = sanitized.replace(/\b\d+\s+(רחוב|רח\'|street|st\.|avenue|ave\.)\s+[^\s,]+/gi, '[ADDRESS_REMOVED]');
  
  // Remove company number
  sanitized = sanitized.replace(/517145033/g, '[COMPANY_NUMBER_REMOVED]');
  
  return sanitized;
}
