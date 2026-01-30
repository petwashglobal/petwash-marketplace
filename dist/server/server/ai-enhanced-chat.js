/**
 * Enhanced AI Chat with Learning System
 * Combines Google Gemini with learned user behavior for better answers
 */
import { chatWithPetWashAI } from './gemini';
import { trackChatInteraction, getLearnedFAQAnswer } from './ai-learning-system';
import { logger } from './lib/logger';
import { nanoid } from 'nanoid';
/**
 * Enhanced chat handler with learning
 * First checks learned FAQs, then falls back to Gemini
 */
export async function enhancedChatWithLearning(request, ipAddress, userAgent) {
    const { message, language, sessionId, userId, previousMessage, timeSpentOnPreviousAnswer, conversationHistory } = request;
    // Generate or use existing session ID
    const chatSessionId = sessionId || `chat_${nanoid(16)}`;
    // DEBUG: Log incoming request details
    logger.info('[AI Chat] Request received', {
        message: message?.substring(0, 50),
        language,
        sessionId: chatSessionId?.substring(0, 8),
        hasHistory: !!conversationHistory?.length
    });
    try {
        // Step 1: Check if we have a learned answer with high confidence
        const learnedAnswer = await getLearnedFAQAnswer(message, language);
        // DEBUG: Log learned answer result
        logger.info('[AI Chat] Learned answer check', {
            confidence: learnedAnswer.confidence,
            source: learnedAnswer.source,
            answerPreview: learnedAnswer.answer?.substring(0, 50)
        });
        let finalAnswer;
        let source;
        if (learnedAnswer.confidence > 0.75) {
            // High confidence - use learned answer
            finalAnswer = learnedAnswer.answer;
            source = 'learned';
            logger.info('[AI Chat] Using learned answer', {
                confidence: learnedAnswer.confidence,
                language
            });
        }
        else if (learnedAnswer.confidence > 0.5) {
            // Medium confidence - use hybrid (learned + Gemini enhancement)
            const geminiResponse = await chatWithPetWashAI(message, language, conversationHistory);
            // Combine learned answer with Gemini's response
            finalAnswer = geminiResponse;
            source = 'hybrid';
            logger.info('[AI Chat] Using hybrid answer', {
                learnedConfidence: learnedAnswer.confidence,
                language
            });
        }
        else {
            // Low/no confidence - use Gemini with full conversation context
            finalAnswer = await chatWithPetWashAI(message, language, conversationHistory);
            source = 'gemini';
            logger.info('[AI Chat] Using Gemini answer', {
                language
            });
        }
        // Step 2: Track this interaction for learning (PRIVACY-FIRST)
        const interaction = {
            sessionId: chatSessionId,
            // NO userId - Fully anonymous
            userQuestion: message, // Will be sanitized in trackChatInteraction
            aiResponse: finalAnswer,
            language,
            timestamp: new Date(),
            followUpQuestion: previousMessage ? message : undefined,
            timeToRead: timeSpentOnPreviousAnswer
            // NO ipAddress, NO userAgent - PRIVACY GUARANTEED
        };
        // Track anonymously (non-blocking)
        setImmediate(async () => {
            try {
                await trackChatInteraction(interaction);
            }
            catch (error) {
                logger.error('[AI Chat] Failed to track interaction', error);
            }
        });
        return {
            success: true,
            response: finalAnswer,
            sessionId: chatSessionId,
            source,
            confidence: learnedAnswer.confidence
        };
    }
    catch (error) {
        logger.error('[AI Chat] Enhanced chat failed', error);
        const fallbackMessages = {
            he: "מצטער, משהו השתבש. אנא נסה שוב.",
            en: "Sorry, something went wrong. Please try again.",
            ar: "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.",
            es: "Lo siento, algo salió mal. Por favor, inténtalo de nuevo.",
            fr: "Désolé, une erreur s'est produite. Veuillez réessayer.",
            ru: "Извините, что-то пошло не так. Пожалуйста, попробуйте снова."
        };
        return {
            success: false,
            response: fallbackMessages[language] || fallbackMessages.en,
            sessionId: chatSessionId,
            source: 'gemini',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
/**
 * Get chat suggestions based on learned popular questions
 */
export async function getIntelligentSuggestions(language) {
    try {
        // Get top 5 most asked questions with high satisfaction
        const topQuestionsSnapshot = await require('./lib/firebase-admin').db
            .collection('ai_faq_learning')
            .where('language', '==', language)
            .where('avgSatisfaction', '>', 0.7)
            .orderBy('avgSatisfaction', 'desc')
            .orderBy('timesAsked', 'desc')
            .limit(5)
            .get();
        if (!topQuestionsSnapshot.empty) {
            const suggestions = topQuestionsSnapshot.docs.map((doc) => doc.data().question);
            return suggestions.slice(0, 5);
        }
    }
    catch (error) {
        logger.error('[AI Chat] Failed to get intelligent suggestions', error);
    }
    // Fallback to default suggestions
    const { getPetWashSuggestions } = await import('./gemini');
    return getPetWashSuggestions(language);
}
