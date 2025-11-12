/**
 * Kenzo Avatar Chat Service
 * Web-based implementation inspired by Kotlin Multiplatform architecture
 * Provides real-time AI chat with avatar animation support
 */

import { logger } from '@/lib/logger';
import { type Language } from '@/lib/i18n';

// 1. Define the interface for the AI service (The "contract" for chat functionality)
export interface AvatarChatService {
  getResponse(message: string, language: Language): Promise<string>;
  getAvatarState(): AvatarState;
}

// Avatar animation states
export interface AvatarState {
  expression: 'happy' | 'thinking' | 'excited' | 'kiss' | 'wink' | 'smile' | 'love' | 'helpful' | 'playful';
  animation: 'idle' | 'speaking' | 'nodding' | 'wagging';
  emotion: 'joy' | 'curiosity' | 'helpful' | 'playful_wink' | 'playful_fun' | 'love' | 'affectionate' | 'excited' | 'grateful' | 'friendly';
}

// Chat context for conversation memory
interface ChatContext {
  sessionId: string;
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  language: Language;
}

// 2. Implement the service (using Gemini AI for intelligence)
export class KenzoAvatarChatService implements AvatarChatService {
  private context: ChatContext;
  private currentAvatarState: AvatarState;
  private apiEndpoint = '/api/ai/chat';

  constructor(sessionId?: string, language: Language = 'en') {
    this.context = {
      sessionId: sessionId || `kenzo_${Date.now()}`,
      messageHistory: [],
      language,
    };

    this.currentAvatarState = {
      expression: 'happy',
      animation: 'idle',
      emotion: 'joy',
    };

    logger.info('[Kenzo Chat Service] Initialized', {
      sessionId: this.context.sessionId,
      language,
    });
  }

  /**
   * The best code: An async function that uses asynchronous programming
   * to safely call the AI model without blocking the user interface,
   * supporting real-time avatar animation.
   */
  async getResponse(message: string, language: Language): Promise<string> {
    try {
      // Update avatar state to "thinking"
      this.updateAvatarState({
        expression: 'thinking',
        animation: 'nodding',
        emotion: 'curiosity',
      });

      // Convert message history to Gemini format (user/model roles)
      // NOTE: Don't include current message - it will be added by the server
      const conversationHistory = this.context.messageHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        text: msg.content
      }));
      
      // Add user message to local history AFTER creating the history payload
      this.context.messageHistory.push({
        role: 'user',
        content: message,
      });

      // Call the AI API (Gemini 2.5 Flash with Kenzo personality + conversation context)
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          language,
          sessionId: this.context.sessionId,
          userId: null, // Anonymous for privacy
          conversationHistory, // Full conversation context like Kotlin's startChat(history)
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'AI response failed');
      }

      const aiResponse = data.response;

      // Add AI response to history
      this.context.messageHistory.push({
        role: 'assistant',
        content: aiResponse,
      });

      // Detect emotion and map to expression
      const detectedEmotion = this.detectEmotion(aiResponse);
      const expression = this.mapEmotionToExpression(detectedEmotion);
      
      // Update avatar state to "talking"
      this.updateAvatarState({
        expression,
        animation: 'speaking',
        emotion: detectedEmotion,
      });

      // (Conceptual) Route this text response to the high-graphics 3D engine/SDK
      // await this.updateAvatarLipSync(aiResponse);

      logger.info('[Kenzo Chat Service] Response received', {
        messageLength: aiResponse.length,
        emotion: this.currentAvatarState.emotion,
      });

      return aiResponse;
    } catch (error) {
      logger.error('[Kenzo Chat Service] Error:', error);

      // Update avatar to sad/apologetic state
      this.updateAvatarState({
        expression: 'thinking',
        animation: 'idle',
        emotion: 'helpful',
      });

      // Fallback response for stability (multilingual)
      const fallbackMessages: Record<Language, string> = {
        he: 'סליחה, משהו השתבש. אוכל לנסות שוב? 🐾',
        en: "I seem to be having connection issues right now. Could you please repeat that? 🐾",
        ar: 'عذراً، أواجه مشاكل في الاتصال الآن. هل يمكنك تكرار ذلك؟ 🐾',
        es: 'Parece que tengo problemas de conexión ahora. ¿Podrías repetir eso? 🐾',
        fr: "Je semble avoir des problèmes de connexion maintenant. Pourriez-vous répéter ça? 🐾",
        ru: 'Кажется, у меня проблемы с подключением. Не могли бы вы повторить? 🐾'
      };

      return fallbackMessages[language] || fallbackMessages.en;
    }
  }

  /**
   * Get current avatar animation state
   */
  getAvatarState(): AvatarState {
    return { ...this.currentAvatarState };
  }

  /**
   * Update avatar state for animations
   */
  private updateAvatarState(state: Partial<AvatarState>): void {
    this.currentAvatarState = {
      ...this.currentAvatarState,
      ...state,
    };

    // Emit state change event for UI components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('kenzo-avatar-state-change', {
          detail: this.currentAvatarState,
        })
      );
    }
  }

  /**
   * Detect emotion from AI response for avatar expression (multilingual)
   * Enhanced with comprehensive keyword coverage across 6 languages
   */
  private detectEmotion(response: string): AvatarState['emotion'] {
    const text = response.toLowerCase();

    // Love/affection indicators (comprehensive coverage across all languages)
    const lovePatterns = [
      // English
      'love', 'loving', 'loved', 'adore', 'cherish', 'affection',
      // Hebrew (including gender variations)
      'אהבה', 'אוהב', 'אוהבת', 'אהב', 'חיבה', 'חבב',
      // Arabic (including variations)
      'حب', 'أحب', 'أحبك', 'محبة', 'عشق',
      // Spanish (common phrases)
      'amor', 'te amo', 'te quiero', 'cariño', 'quiero',
      // French (common phrases)
      'amour', "je t'aime", 'aime', 'chéri', 'adore',
      // Russian (variations)
      'любовь', 'люблю', 'любимый', 'обожаю',
      // Emojis
      '❤️', '💕', '😘', '💖', '💗', '💓', '💞'
    ];
    if (lovePatterns.some(pattern => text.includes(pattern.toLowerCase()))) {
      return 'love';
    }

    // Kiss/affectionate indicators
    const kissPatterns = [
      // English
      'kiss', 'kisses', 'kissing', 'smooch', 'xoxo',
      // Hebrew
      'נשיקה', 'נשיקות', 'נשק', 'נשקה',
      // Arabic
      'قبلة', 'قبلات', 'بوسة',
      // Spanish
      'beso', 'besos', 'besito',
      // French
      'baiser', 'bisou', 'bisous', 'bise',
      // Russian
      'поцелуй', 'целую', 'поцеловать',
      // Emojis
      '😘', '💋', '😗', '😚', '😙'
    ];
    if (kissPatterns.some(pattern => text.includes(pattern.toLowerCase()))) {
      return 'affectionate';
    }

    // Helpful indicators (comprehensive multilingual)
    const helpPatterns = [
      // English
      'help', 'helping', 'assist', 'support', 'guide', 'service', 'happy to help',
      // Hebrew
      'עזור', 'עזרה', 'עוזר', 'עוזרת', 'סיוע', 'תמיכה',
      // Arabic
      'مساعدة', 'أساعد', 'دعم', 'خدمة',
      // Spanish
      'ayuda', 'ayudar', 'asistir', 'servicio',
      // French
      'aide', 'aider', 'assistance', 'service',
      // Russian
      'помощь', 'помогаю', 'поддержка', 'служба'
    ];
    if (helpPatterns.some(pattern => text.includes(pattern.toLowerCase()))) {
      return 'helpful';
    }

    // Grateful/thankful indicators (for smile expression)
    const gratefulPatterns = [
      // English
      'thank', 'thanks', 'grateful', 'appreciate', 'welcome', 'pleasure',
      // Hebrew
      'תודה', 'תודות', 'מעריך', 'אסיר תודה',
      // Arabic
      'شكرا', 'شكراً', 'ممتن',
      // Spanish
      'gracias', 'agradecido',
      // French
      'merci', 'reconnaissant',
      // Russian
      'спасибо', 'благодарен', 'благодарю'
    ];
    if (gratefulPatterns.some(pattern => text.includes(pattern.toLowerCase()))) {
      return 'grateful'; // Will map to smile expression
    }

    // Friendly greeting indicators (for smile expression)
    const friendlyPatterns = [
      'hello', 'hi', 'hey', 'greetings', 'good morning', 'good day',
      'שלום', 'היי', 'בוקר טוב', 'مرحبا', 'hola', 'bonjour', 'привет'
    ];
    if (friendlyPatterns.some(pattern => text.includes(pattern.toLowerCase()))) {
      return 'friendly'; // Will map to smile expression
    }

    // Wink indicators (specific)
    const winkPatterns = ['wink', '😉', ';)', 'nudge', 'winking'];
    if (winkPatterns.some(pattern => text.includes(pattern))) {
      return 'playful_wink'; // Will map to wink expression
    }

    // Playful/fun indicators (distinct from wink)
    const playfulPatterns = ['🐾', 'fun', 'play', 'playing', 'playful', 'yay', 'woohoo'];
    if (playfulPatterns.some(pattern => text.includes(pattern.toLowerCase()))) {
      return 'playful_fun'; // Will map to playful expression
    }

    // Excited indicators
    const excitedPatterns = [
      '!', '🎉', 'exciting', 'wow', 'amazing', 'awesome', 'fantastic', 
      'incredible', 'great', 'wonderful', '🤩', '😍', '🔥'
    ];
    if (excitedPatterns.some(pattern => text.includes(pattern))) {
      return 'excited';
    }

    // Curious indicators
    if (text.includes('?') || text.includes('let me') || text.includes('wondering')) {
      return 'curiosity';
    }

    // Default to joyful Kenzo
    return 'joy';
  }

  /**
   * Map detected emotion to visual expression
   * ALL 9 expressions now properly reachable:
   * happy, thinking, excited, kiss, wink, smile, love, helpful, playful
   */
  private mapEmotionToExpression(emotion: AvatarState['emotion']): AvatarState['expression'] {
    const emotionToExpressionMap: Record<AvatarState['emotion'], AvatarState['expression']> = {
      'love': 'love',                 // ❤️ Floating hearts
      'affectionate': 'kiss',         // 😘 Kiss emoji + hearts
      'joy': 'happy',                 // 😊 Default cheerful
      'playful_wink': 'wink',         // 😉 Wink expression
      'playful_fun': 'playful',       // 🐾 Fun playful expression
      'curiosity': 'thinking',        // 🤔 Pondering state
      'helpful': 'helpful',           // 🙋 Helpful assistance mode
      'excited': 'excited',           // 🎉 Enthusiastic state
      'grateful': 'smile',            // 😊 Warm thankful smile
      'friendly': 'smile',            // 😊 Welcoming smile
    };

    return emotionToExpressionMap[emotion] || 'happy';
  }

  /**
   * (Future) Conceptual method for lip-sync animation
   * Would integrate with Three.js / Ready Player Me / D-ID
   */
  private async updateAvatarLipSync(text: string): Promise<void> {
    // Future integration point:
    // - Convert text to speech (TTS)
    // - Analyze phonemes for mouth shapes
    // - Drive 3D avatar facial animation
    // - Sync with audio playback
    logger.debug('[Kenzo Avatar] Lip-sync update (placeholder)', {
      textLength: text.length,
    });
  }

  /**
   * Reset conversation context
   */
  resetContext(): void {
    this.context.messageHistory = [];
    this.updateAvatarState({
      expression: 'happy',
      animation: 'idle',
      emotion: 'joy',
    });

    logger.info('[Kenzo Chat Service] Context reset');
  }

  /**
   * Get conversation history
   */
  getHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return [...this.context.messageHistory];
  }
}

// Singleton instance for the application
export const kenzoAvatarService = new KenzoAvatarChatService();
