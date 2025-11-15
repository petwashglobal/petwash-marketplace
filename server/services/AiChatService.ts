/**
 * Google Dialogflow CX AI Chat Service
 * Production-grade Gemini-powered chatbot for Pet Wash™
 * 
 * Security: API keys stored in environment variables, never exposed to frontend
 * Supports: Hebrew/English bilingual conversations, pet care expertise
 */

import { SessionsClient } from '@google-cloud/dialogflow-cx';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';

// Parse Google credentials from environment (using EXISTING Replit secrets)
let googleCreds: any;
try {
  // ✅ Use existing GOOGLE_SERVICE_ACCOUNT_JSON secret
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    googleCreds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else {
    logger.warn('[AiChatService] GOOGLE_SERVICE_ACCOUNT_JSON is not set.');
  }
} catch (error) {
  logger.error('[AiChatService] Failed to parse Google credentials JSON', { error });
}

// Initialize Dialogflow CX Client
const client = googleCreds ? new SessionsClient({
  credentials: {
    client_email: googleCreds.client_email,
    private_key: googleCreds.private_key,
  },
  apiEndpoint: `${process.env.GOOGLE_AGENT_LOCATION || 'global'}-dialogflow.googleapis.com`
}) : null;

class AiChatService {
  private projectId: string;
  private agentId: string;
  private location: string;
  private languageCode: string;

  constructor() {
    // ✅ Use Dialogflow project ID (may differ from Firebase project)
    this.projectId = process.env.GOOGLE_DIALOGFLOW_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
    
    // ⚠️ NEW SECRETS NEEDED (only 3!)
    this.agentId = process.env.GOOGLE_AGENT_ID || '';
    this.location = process.env.GOOGLE_AGENT_LOCATION || 'global';
    
    this.languageCode = 'he'; // Default to Hebrew for Israeli market

    if (!this.projectId || !this.agentId || !googleCreds) {
      logger.error('[AiChatService] Missing required environment variables. Chat will not function.', {
        hasProjectId: !!this.projectId,
        hasAgentId: !!this.agentId,
        hasCreds: !!googleCreds,
      });
    }
  }

  /**
   * Check if service is properly configured
   */
  public isConfigured(): boolean {
    return !!(this.projectId && this.agentId && googleCreds && client);
  }

  /**
   * Send message to Dialogflow CX agent and get AI response
   * @param text User's message text
   * @param sessionId Unique conversation session ID
   * @param languageCode Optional language override (he/en)
   * @returns AI's text response
   */
  public async detectIntent(
    text: string,
    sessionId: string,
    languageCode?: string
  ): Promise<string> {
    if (!this.isConfigured() || !client) {
      throw new Error(
        'AiChatService is not configured. Please create a Dialogflow CX agent and add GOOGLE_AGENT_ID and GOOGLE_AGENT_LOCATION to Replit Secrets.'
      );
    }

    try {
      const sessionPath = client.projectLocationAgentSessionPath(
        this.projectId,
        this.location,
        this.agentId,
        sessionId
      );

      const request = {
        session: sessionPath,
        queryInput: {
          text: {
            text: text,
          },
          languageCode: languageCode || this.languageCode,
        },
      };

      logger.info('[AiChatService] Sending message to Dialogflow CX', {
        sessionId: sessionId.substring(0, 8) + '***',
        textLength: text.length,
        language: languageCode || this.languageCode,
      });

      const [response] = await client.detectIntent(request);

      // Extract text responses from Dialogflow CX
      const aiResponses = response.queryResult?.responseMessages
        ?.filter(msg => msg.text)
        .map(msg => msg.text?.text?.join('\n') || '')
        .join('\n');

      const finalResponse = aiResponses || "מצטער, לא הבנתי. אנא נסה שוב.";

      logger.info('[AiChatService] AI response generated', {
        sessionId: sessionId.substring(0, 8) + '***',
        responseLength: finalResponse.length,
      });

      return finalResponse;

    } catch (error: any) {
      // Enhanced error logging for debugging
      const errorInfo = {
        message: error.message,
        code: error.code,
        details: error.details,
        statusCode: error.statusCode,
        statusMessage: error.statusMessage,
        metadata: error.metadata,
        stack: error.stack?.split('\n')[0], // First line of stack trace
        sessionId: sessionId.substring(0, 8) + '***',
      };
      
      logger.error('[AiChatService] Dialogflow CX error - Full details:', errorInfo);
      
      // User-friendly error message in Hebrew
      throw new Error(`מצטערים, אנחנו חווים בעיה טכנית. ${error.message || 'נסה שוב בעוד רגע.'}`);
    }
  }

  /**
   * Generate unique session ID for new conversation
   */
  public generateSessionId(): string {
    return `session-${nanoid(16)}`;
  }
}

// Export singleton instance
export const aiChatService = new AiChatService();
