/**
 * AI Feature Approval System
 * Detects new AI feature opportunities and emails admin for one-click approval
 * 
 * OWNER: Nir Hadad (ניר חדד) - Israeli ID 033554437
 * Only the owner can approve new features
 */

import { logger } from './lib/logger';
import { db as adminDb } from './lib/firebase-admin';
// Note: SendGrid integration for feature approval emails
// This will be implemented when needed - for now, log to console
import { nanoid } from 'nanoid';

interface NewFeatureSuggestion {
  featureName: string;
  description: string;
  reason: string;
  userRequests: number;
  confidence: number; // 0-1
  detectedAt: Date;
  language: 'he' | 'en';
  examples?: string[]; // Example questions that led to this suggestion
}

interface FeatureApproval {
  id: string;
  suggestion: NewFeatureSuggestion;
  status: 'pending' | 'approved' | 'rejected';
  approvalToken: string;
  rejectionToken: string;
  emailSentAt: Date;
  decidedAt?: Date;
  decidedBy?: string; // Email of decision maker
}

const ADMIN_EMAIL = 'nirhadad1@gmail.com'; // Nir Hadad - sole decision maker
const BASE_URL = process.env.BASE_URL || 'https://petwash.co.il';

/**
 * Detect if a new feature is needed based on user patterns
 */
export async function detectNewFeatureOpportunity(
  topic: string,
  frequency: number,
  language: 'he' | 'en'
): Promise<NewFeatureSuggestion | null> {
  try {
    // Only suggest if frequency is significant (>10 requests in 7 days)
    if (frequency < 10) return null;
    
    // Get recent questions on this topic
    const recentQuestions = await adminDb
      .collection('ai_chat_interactions')
      .where('topic', '==', topic)
      .where('language', '==', language)
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    if (recentQuestions.empty) return null;
    
    const examples = recentQuestions.docs.map(doc => doc.data().userQuestion);
    
    // Analyze if this represents a new feature need
    const suggestion = await analyzeFeatureNeed(topic, frequency, examples, language);
    
    return suggestion;
  } catch (error) {
    logger.error('[AI Feature Detection] Failed to detect opportunity', error);
    return null;
  }
}

/**
 * Analyze if topic represents a genuine feature need
 */
async function analyzeFeatureNeed(
  topic: string,
  frequency: number,
  examples: string[],
  language: 'he' | 'en'
): Promise<NewFeatureSuggestion | null> {
  // Define confidence based on frequency
  const confidence = Math.min(frequency / 50, 1); // Max at 50 requests
  
  // Only suggest if confidence is reasonable
  if (confidence < 0.3) return null;
  
  // Map topics to potential features
  const featureMapping: { [key: string]: { name: string; description: string; reason: string } } = {
    'subscription_box': {
      name: 'AI Subscription Box Service',
      description: 'Automated monthly pet care box with AI-selected products',
      reason: 'Users frequently ask about subscription services'
    },
    'grooming_booking': {
      name: 'Online Grooming Appointments',
      description: 'Direct booking system for grooming services',
      reason: 'High demand for appointment scheduling'
    },
    'pet_health_tracking': {
      name: 'Pet Health Monitoring',
      description: 'Track vaccinations, vet visits, and health records',
      reason: 'Users ask about health tracking features'
    },
    'loyalty_rewards': {
      name: 'Enhanced Loyalty Program',
      description: 'Gamified rewards with bonus points and challenges',
      reason: 'Interest in earning more rewards'
    },
    'mobile_app': {
      name: 'Native Mobile App',
      description: 'iOS/Android app for easier access',
      reason: 'Users request mobile app experience'
    }
  };
  
  const feature = featureMapping[topic];
  if (!feature) return null;
  
  return {
    featureName: feature.name,
    description: feature.description,
    reason: feature.reason,
    userRequests: frequency,
    confidence,
    detectedAt: new Date(),
    language,
    examples: examples.slice(0, 3) // Top 3 examples
  };
}

/**
 * Send feature approval email to admin
 */
export async function sendFeatureApprovalEmail(
  suggestion: NewFeatureSuggestion
): Promise<void> {
  try {
    // Check if we already sent email for this feature recently
    const existingApproval = await adminDb
      .collection('feature_approvals')
      .where('suggestion.featureName', '==', suggestion.featureName)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    
    if (!existingApproval.empty) {
      logger.info('[AI Feature Approval] Already sent approval request for this feature');
      return;
    }
    
    // Create approval record
    const approvalId = nanoid(16);
    const approvalToken = nanoid(32);
    const rejectionToken = nanoid(32);
    
    const approval: FeatureApproval = {
      id: approvalId,
      suggestion,
      status: 'pending',
      approvalToken,
      rejectionToken,
      emailSentAt: new Date()
    };
    
    await adminDb.collection('feature_approvals').doc(approvalId).set(approval);
    
    // Construct email
    const approveUrl = `${BASE_URL}/api/ai-features/approve?token=${approvalToken}`;
    const rejectUrl = `${BASE_URL}/api/ai-features/reject?token=${rejectionToken}`;
    
    const emailSubject = suggestion.language === 'he' 
      ? `🤖 הצעה לפיצ'ר חדש - דרוש אישור`
      : `🤖 New AI Feature Suggestion - Requires Approval`;
    
    const emailBody = suggestion.language === 'he' ? `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4C1D95;">שלום ניר,</h2>
        
        <p>מערכת ה-AI שלנו זיהתה הזדמנות לפיצ'ר חדש:</p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #7C3AED; margin-top: 0;">${suggestion.featureName}</h3>
          <p><strong>תיאור:</strong> ${suggestion.description}</p>
          <p><strong>סיבה:</strong> ${suggestion.reason}</p>
          <p><strong>בקשות משתמשים:</strong> ${suggestion.userRequests} פעמים ב-7 ימים האחרונים</p>
          <p><strong>רמת ביטחון:</strong> ${(suggestion.confidence * 100).toFixed(0)}%</p>
        </div>
        
        ${suggestion.examples && suggestion.examples.length > 0 ? `
          <h4>דוגמאות לשאלות:</h4>
          <ul>
            ${suggestion.examples.map(ex => `<li>${ex}</li>`).join('')}
          </ul>
        ` : ''}
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${approveUrl}" style="background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 10px;">
            ✅ אישור הפיצ'ר
          </a>
          
          <a href="${rejectUrl}" style="background: #EF4444; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 10px;">
            ❌ דחייה
          </a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
        
        <p style="color: #6B7280; font-size: 12px;">
          אימייל זה נשלח אוטומטית על ידי מערכת AI Learning של Pet Wash™<br>
          רק אתה יכול לאשר פיצ'רים חדשים.<br>
          ID אישור: ${approvalId}
        </p>
      </div>
    ` : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4C1D95;">Hi Nir,</h2>
        
        <p>Our AI system has detected a new feature opportunity:</p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #7C3AED; margin-top: 0;">${suggestion.featureName}</h3>
          <p><strong>Description:</strong> ${suggestion.description}</p>
          <p><strong>Reason:</strong> ${suggestion.reason}</p>
          <p><strong>User Requests:</strong> ${suggestion.userRequests} times in the last 7 days</p>
          <p><strong>Confidence:</strong> ${(suggestion.confidence * 100).toFixed(0)}%</p>
        </div>
        
        ${suggestion.examples && suggestion.examples.length > 0 ? `
          <h4>Example Questions:</h4>
          <ul>
            ${suggestion.examples.map(ex => `<li>${ex}</li>`).join('')}
          </ul>
        ` : ''}
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${approveUrl}" style="background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 10px;">
            ✅ APPROVE
          </a>
          
          <a href="${rejectUrl}" style="background: #EF4444; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 10px;">
            ❌ REJECT
          </a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
        
        <p style="color: #6B7280; font-size: 12px;">
          This email was sent automatically by Pet Wash™ AI Learning System.<br>
          Only you can approve new features.<br>
          Approval ID: ${approvalId}
        </p>
      </div>
    `;
    
    // TODO: Implement actual email sending when SendGrid is configured
    logger.info('[AI Feature Approval] Feature approval email ready to send', {
      to: ADMIN_EMAIL,
      subject: emailSubject,
      feature: suggestion.featureName,
      approvalId,
      approveUrl,
      rejectUrl
    });
    
    // For now, console log the email (will send real email when SendGrid configured)
    console.log('\n📧 FEATURE APPROVAL EMAIL:\n');
    console.log(`To: ${ADMIN_EMAIL}`);
    console.log(`Subject: ${emailSubject}`);
    console.log(`Approve: ${approveUrl}`);
    console.log(`Reject: ${rejectUrl}`);
    console.log('\n');
    
  } catch (error) {
    logger.error('[AI Feature Approval] Failed to send approval email', error);
    throw error;
  }
}

/**
 * Process approval/rejection
 */
export async function processFeatureDecision(
  token: string,
  decision: 'approved' | 'rejected',
  decidedBy: string
): Promise<boolean> {
  try {
    const field = decision === 'approved' ? 'approvalToken' : 'rejectionToken';
    
    const approvalSnapshot = await adminDb
      .collection('feature_approvals')
      .where(field, '==', token)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    
    if (approvalSnapshot.empty) {
      logger.warn('[AI Feature Approval] Invalid or expired token');
      return false;
    }
    
    const approvalDoc = approvalSnapshot.docs[0];
    
    await approvalDoc.ref.update({
      status: decision,
      decidedAt: new Date(),
      decidedBy
    });
    
    logger.info('[AI Feature Approval] Feature decision recorded', {
      decision,
      feature: approvalDoc.data().suggestion.featureName
    });
    
    return true;
  } catch (error) {
    logger.error('[AI Feature Approval] Failed to process decision', error);
    return false;
  }
}
