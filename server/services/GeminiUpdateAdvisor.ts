/**
 * Gemini AI Update Advisor
 * 
 * SAFE APPROACH: Analyzes updates with Gemini AI but requires human approval
 * - Continuously monitors for updates (npm, browsers, platforms)
 * - Uses Gemini 2.5 Flash to analyze safety, breaking changes, risks
 * - Sends intelligent recommendations via email
 * - Stores advisories in Firestore for dashboard review
 * - NO AUTO-INSTALL (prevents production breakage)
 * 
 * Why Not Auto-Install?
 * - Breaking changes could brick production
 * - npm install failures could corrupt package.json
 * - No testing before deployment = high risk
 * - Missing rollback mechanism
 * 
 * Future Enhancement: Build approval dashboard where you click "Apply Update"
 * 
 * Created: November 10, 2025
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../lib/logger';
import { EmailService } from '../emailService';
import { db } from '../lib/firebase-admin';
import { SecurityUpdateMonitor } from '../securityUpdateMonitor';

interface UpdateAdvisory {
  package: string;
  currentVersion: string;
  latestVersion: string;
  updateType: 'major' | 'minor' | 'patch' | 'security';
  priority: 'critical' | 'high' | 'medium' | 'low';
  recommendation: 'APPLY_NOW' | 'SCHEDULE_SOON' | 'REVIEW_LATER' | 'SKIP';
  analysis: {
    breakingChanges: string[];
    benefits: string[];
    risks: string[];
    summary: string;
    estimatedEffort: string;
  };
  geminiConfidence: number;
  detectedAt: Date;
  status: 'pending' | 'approved' | 'applied' | 'skipped';
}

export class GeminiUpdateAdvisor {
  private static genAI: GoogleGenerativeAI;
  private static model: any;
  private static isInitialized = false;

  /**
   * Initialize Gemini AI
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        logger.warn('[Gemini Advisor] ⚠️ GEMINI_API_KEY not configured - advisory disabled');
        return;
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 2048,
        }
      });

      this.isInitialized = true;
      logger.info('[Gemini Advisor] ✅ Gemini AI initialized for update analysis');
    } catch (error) {
      logger.error('[Gemini Advisor] Failed to initialize:', error);
    }
  }

  /**
   * Run update analysis and send recommendations
   */
  static async analyzeUpdates(): Promise<void> {
    try {
      await this.initialize();

      if (!this.isInitialized) {
        logger.warn('[Gemini Advisor] Skipping analysis - Gemini not initialized');
        return;
      }

      logger.info('[Gemini Advisor] 🔍 Analyzing system updates with Gemini AI...');

      // Use existing SecurityUpdateMonitor to get updates
      const updates = await SecurityUpdateMonitor.checkAllUpdates();

      if (updates.length === 0) {
        logger.info('[Gemini Advisor] ✅ System fully up-to-date');
        return;
      }

      logger.info(`[Gemini Advisor] 📦 Found ${updates.length} updates - analyzing...`);

      // Analyze each update with Gemini
      const advisories: UpdateAdvisory[] = [];
      
      for (const update of updates) {
        const advisory = await this.analyzeUpdate(update);
        advisories.push(advisory);
      }

      // Categorize advisories
      const critical = advisories.filter(a => a.recommendation === 'APPLY_NOW');
      const high = advisories.filter(a => a.recommendation === 'SCHEDULE_SOON');
      const medium = advisories.filter(a => a.recommendation === 'REVIEW_LATER');

      logger.info(`[Gemini Advisor] 📊 Analysis complete: ${critical.length} critical, ${high.length} high priority, ${medium.length} medium priority`);

      // Store advisories
      await this.storeAdvisories(advisories);

      // Send email recommendations
      await this.sendAdvisoryEmail(advisories);

      logger.info('[Gemini Advisor] ✅ Advisory complete - awaiting your approval');
    } catch (error) {
      logger.error('[Gemini Advisor] Error analyzing updates:', error);
    }
  }

  /**
   * Analyze single update with Gemini AI
   */
  private static async analyzeUpdate(update: any): Promise<UpdateAdvisory> {
    try {
      const prompt = `
You are a senior DevOps engineer advising on a software update for Pet Wash™ production platform.

**Update Details:**
Package: ${update.component}
Current: ${update.currentVersion}
Latest: ${update.latestVersion}
Severity: ${update.severity}
Description: ${update.description}

**Your Task:**
Provide expert analysis as JSON:

{
  "updateType": "major|minor|patch|security",
  "recommendation": "APPLY_NOW|SCHEDULE_SOON|REVIEW_LATER|SKIP",
  "priority": "critical|high|medium|low",
  "breakingChanges": ["specific breaking changes if any"],
  "benefits": ["security fixes", "performance improvements", "new features"],
  "risks": ["potential issues"],
  "summary": "1-sentence recommendation",
  "estimatedEffort": "5 min|30 min|2 hours|1 day",
  "confidence": 0.95
}

**Guidelines:**
- APPLY_NOW: Critical security fixes only
- SCHEDULE_SOON: High-priority updates, minimal risk
- REVIEW_LATER: Major updates, needs testing
- SKIP: Deprecated packages, low value
- confidence: 0-1 scale of your analysis certainty

Respond ONLY with valid JSON.
`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON from Gemini');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      return {
        package: update.component,
        currentVersion: update.currentVersion,
        latestVersion: update.latestVersion,
        updateType: analysis.updateType || 'minor',
        priority: analysis.priority || 'medium',
        recommendation: analysis.recommendation || 'REVIEW_LATER',
        analysis: {
          breakingChanges: analysis.breakingChanges || [],
          benefits: analysis.benefits || [],
          risks: analysis.risks || [],
          summary: analysis.summary || 'Review recommended',
          estimatedEffort: analysis.estimatedEffort || '30 min',
        },
        geminiConfidence: analysis.confidence || 0.7,
        detectedAt: new Date(),
        status: 'pending'
      };
    } catch (error) {
      logger.error(`[Gemini Analysis] Error for ${update.component}:`, error);
      
      // Safe fallback
      return {
        package: update.component,
        currentVersion: update.currentVersion,
        latestVersion: update.latestVersion,
        updateType: 'minor',
        priority: 'low',
        recommendation: 'REVIEW_LATER',
        analysis: {
          breakingChanges: [],
          benefits: [],
          risks: ['Analysis failed - manual review required'],
          summary: 'Manual review needed',
          estimatedEffort: '30 min',
        },
        geminiConfidence: 0,
        detectedAt: new Date(),
        status: 'pending'
      };
    }
  }

  /**
   * Store advisories in Firestore
   */
  private static async storeAdvisories(advisories: UpdateAdvisory[]): Promise<void> {
    try {
      const batch = db.batch();

      for (const advisory of advisories) {
        const ref = db.collection('update_advisories').doc();
        batch.set(ref, {
          ...advisory,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await batch.commit();
      logger.info('[Gemini Advisor] 💾 Advisories saved to Firestore');
    } catch (error) {
      logger.error('[Gemini Advisor] Failed to store advisories:', error);
    }
  }

  /**
   * Send advisory email with recommendations
   */
  private static async sendAdvisoryEmail(advisories: UpdateAdvisory[]): Promise<void> {
    try {
      const emailService = new EmailService();

      const criticalItems = advisories.filter(a => a.recommendation === 'APPLY_NOW');
      const highItems = advisories.filter(a => a.recommendation === 'SCHEDULE_SOON');
      const reviewItems = advisories.filter(a => a.recommendation === 'REVIEW_LATER');

      const formatAdvisoryList = (items: UpdateAdvisory[]) => items.map(item => `
        <div style="margin: 15px 0; padding: 15px; background: #f5f5f5; border-left: 4px solid ${
          item.priority === 'critical' ? '#dc2626' : 
          item.priority === 'high' ? '#ea580c' : '#3b82f6'
        };">
          <h3 style="margin: 0 0 10px 0;">${item.package}</h3>
          <p><strong>Version:</strong> ${item.currentVersion} → ${item.latestVersion}</p>
          <p><strong>Type:</strong> ${item.updateType} | <strong>Priority:</strong> ${item.priority}</p>
          <p><strong>Summary:</strong> ${item.analysis.summary}</p>
          <p><strong>Estimated Effort:</strong> ${item.analysis.estimatedEffort}</p>
          ${item.analysis.breakingChanges.length > 0 ? `
            <p><strong>⚠️ Breaking Changes:</strong></p>
            <ul>${item.analysis.breakingChanges.map(c => `<li>${c}</li>`).join('')}</ul>
          ` : ''}
          ${item.analysis.benefits.length > 0 ? `
            <p><strong>✅ Benefits:</strong></p>
            <ul>${item.analysis.benefits.map(b => `<li>${b}</li>`).join('')}</ul>
          ` : ''}
          <p><strong>Gemini Confidence:</strong> ${(item.geminiConfidence * 100).toFixed(0)}%</p>
        </div>
      `).join('');

      await emailService.sendEmail({
        to: 'nirhadad1@gmail.com',
        subject: `🤖 Pet Wash™ - Gemini AI Update Recommendations (${advisories.length} updates)`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <h1 style="color: #0B57D0;">🤖 Gemini AI Update Advisory</h1>
            <p>Gemini 2.5 Flash has analyzed ${advisories.length} available updates for your Pet Wash™ platform.</p>
            
            ${criticalItems.length > 0 ? `
              <h2 style="color: #dc2626;">🚨 Apply Now (${criticalItems.length})</h2>
              <p>Critical security updates that should be applied immediately:</p>
              ${formatAdvisoryList(criticalItems)}
            ` : ''}
            
            ${highItems.length > 0 ? `
              <h2 style="color: #ea580c;">⚡ Schedule Soon (${highItems.length})</h2>
              <p>High-priority updates with minimal risk:</p>
              ${formatAdvisoryList(highItems)}
            ` : ''}
            
            ${reviewItems.length > 0 ? `
              <h2 style="color: #3b82f6;">📋 Review Later (${reviewItems.length})</h2>
              <p>Updates requiring careful review and testing:</p>
              ${formatAdvisoryList(reviewItems)}
            ` : ''}
            
            <hr style="margin: 30px 0; border: 1px solid #ddd;">
            <h2>Next Steps</h2>
            <ol>
              <li>Review Gemini's recommendations above</li>
              <li>For critical updates: Run <code>npm install package@version</code></li>
              <li>Test in development environment</li>
              <li>Deploy to production when ready</li>
            </ol>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              <em>This advisory was generated by Gemini 2.5 Flash AI. All recommendations should be reviewed by a human before applying.</em>
            </p>
          </div>
        `
      });

      logger.info('[Gemini Advisor] 📧 Advisory email sent successfully');
    } catch (error) {
      logger.error('[Gemini Advisor] Failed to send email:', error);
    }
  }

  /**
   * Get pending advisories from Firestore
   */
  static async getPendingAdvisories(): Promise<UpdateAdvisory[]> {
    try {
      const snapshot = await db.collection('update_advisories')
        .where('status', '==', 'pending')
        .orderBy('priority', 'desc')
        .orderBy('detectedAt', 'desc')
        .limit(50)
        .get();

      return snapshot.docs.map(doc => ({ ...doc.data() } as UpdateAdvisory));
    } catch (error) {
      logger.error('[Gemini Advisor] Error fetching advisories:', error);
      return [];
    }
  }
}
