/**
 * Gemini AI Email Monitor
 * Automatically detects and fixes broken images, logos, and rendering issues in outgoing emails
 * Ensures all email templates display correctly across iOS, Android, and web clients
 */

import { logger } from '../lib/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

interface EmailValidationResult {
  valid: boolean;
  issues: EmailIssue[];
  fixedHtml?: string;
  suggestions: string[];
}

interface EmailIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'broken_image' | 'missing_logo' | 'layout_issue' | 'compatibility_issue';
  description: string;
  location?: string;
}

class GeminiEmailMonitor {
  /**
   * Validate and fix email HTML before sending
   * Ensures logo displays correctly and all images are properly embedded
   */
  async validateAndFixEmail(
    emailHtml: string,
    emailType: 'invoice' | 'receipt' | 'statement' | 'notification' | 'marketing'
  ): Promise<EmailValidationResult> {
    try {
      if (!genAI) {
        logger.warn('[Gemini Email Monitor] Gemini API not configured, skipping validation');
        return {
          valid: true,
          issues: [],
          suggestions: ['Gemini API not configured - using original HTML without validation']
        };
      }

      logger.info(`[Gemini Email Monitor] Validating ${emailType} email template...`);

      const issues: EmailIssue[] = [];
      const suggestions: string[] = [];

      // Check 1: Verify logo is embedded as base64 (not external URL)
      const hasBase64Logo = emailHtml.includes('data:image/png;base64,') || 
                           emailHtml.includes('data:image/jpeg;base64,');
      const hasExternalLogo = emailHtml.match(/src=["']https?:\/\//);

      if (hasExternalLogo && !hasBase64Logo) {
        issues.push({
          severity: 'critical',
          type: 'broken_image',
          description: 'Logo uses external URL instead of base64 embedding. Will fail in many email clients.',
          location: 'Header logo'
        });
      }

      // Check 2: Verify PetWash™ branding is present
      const hasPetWashBrand = emailHtml.includes('Pet Wash') || emailHtml.includes('PetWash');
      if (!hasPetWashBrand) {
        issues.push({
          severity: 'warning',
          type: 'missing_logo',
          description: 'PetWash™ branding not found in email',
          location: 'Email header'
        });
      }

      // Check 3: Verify email has proper DOCTYPE for client compatibility
      const hasProperDoctype = emailHtml.includes('<!DOCTYPE html>');
      if (!hasProperDoctype) {
        issues.push({
          severity: 'warning',
          type: 'compatibility_issue',
          description: 'Missing DOCTYPE declaration - may cause rendering issues',
          location: 'HTML structure'
        });
      }

      // Check 4: Use Gemini AI to analyze email for deep issues
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const prompt = `You are an email rendering expert. Analyze this HTML email template for issues that would prevent it from displaying correctly in iOS Mail, Android Gmail, Outlook, and web clients.

Focus on:
1. Logo and image embedding (should use base64 data URIs, NOT external URLs)
2. CSS compatibility (inline styles preferred over <style> tags)
3. Table-based layouts (more compatible than div/flexbox)
4. Font loading and fallbacks
5. RTL (right-to-left) support for Hebrew content

Email Type: ${emailType}
HTML Length: ${emailHtml.length} characters

Email HTML (first 2000 chars):
${emailHtml.substring(0, 2000)}

Provide:
1. List of critical rendering issues
2. Compatibility warnings for major email clients
3. Specific fixes needed

Response format:
CRITICAL: [issue 1]
WARNING: [issue 2]
SUGGESTION: [fix 1]`;

      const result = await model.generateContent(prompt);
      const aiAnalysis = result.response.text();

      // Parse AI response
      const criticalMatches = aiAnalysis.match(/CRITICAL: (.+)/g);
      const warningMatches = aiAnalysis.match(/WARNING: (.+)/g);
      const suggestionMatches = aiAnalysis.match(/SUGGESTION: (.+)/g);

      if (criticalMatches) {
        criticalMatches.forEach(match => {
          const desc = match.replace('CRITICAL: ', '');
          issues.push({
            severity: 'critical',
            type: 'layout_issue',
            description: desc
          });
        });
      }

      if (warningMatches) {
        warningMatches.forEach(match => {
          const desc = match.replace('WARNING: ', '');
          issues.push({
            severity: 'warning',
            type: 'compatibility_issue',
            description: desc
          });
        });
      }

      if (suggestionMatches) {
        suggestionMatches.forEach(match => {
          const suggestion = match.replace('SUGGESTION: ', '');
          suggestions.push(suggestion);
        });
      }

      logger.info(`[Gemini Email Monitor] Validation complete: ${issues.length} issues found`);

      const valid = !issues.some(issue => issue.severity === 'critical');

      return {
        valid,
        issues,
        suggestions,
        fixedHtml: valid ? undefined : emailHtml // Future: AI could auto-fix HTML
      };

    } catch (error: any) {
      logger.error('[Gemini Email Monitor] Validation failed', { 
        error: error.message,
        emailType 
      });
      
      // Fail open - don't block emails if monitoring fails
      return {
        valid: true,
        issues: [{
          severity: 'warning',
          type: 'compatibility_issue',
          description: `Gemini validation failed: ${error.message}`
        }],
        suggestions: ['Email validation skipped due to error - sending original HTML']
      };
    }
  }

  /**
   * Log email quality metrics for monitoring
   */
  async logEmailQuality(
    emailType: string,
    recipientEmail: string,
    validationResult: EmailValidationResult,
    sendSuccess: boolean
  ): Promise<void> {
    try {
      const qualityScore = this.calculateQualityScore(validationResult);

      logger.info('[Gemini Email Monitor] Email quality metrics', {
        emailType,
        recipientEmail: recipientEmail.substring(0, 3) + '***', // Privacy
        qualityScore,
        issuesCount: validationResult.issues.length,
        criticalIssues: validationResult.issues.filter(i => i.severity === 'critical').length,
        sendSuccess,
        valid: validationResult.valid
      });

      // Future: Store in database for analytics dashboard
      
    } catch (error: any) {
      logger.error('[Gemini Email Monitor] Failed to log quality metrics', { error: error.message });
    }
  }

  /**
   * Calculate email quality score (0-100)
   */
  private calculateQualityScore(result: EmailValidationResult): number {
    let score = 100;

    result.issues.forEach(issue => {
      if (issue.severity === 'critical') score -= 30;
      else if (issue.severity === 'warning') score -= 10;
      else score -= 5;
    });

    return Math.max(0, score);
  }

  /**
   * Auto-fix common email issues
   */
  async autoFixEmailIssues(emailHtml: string): Promise<string> {
    try {
      let fixedHtml = emailHtml;

      // Auto-fix 1: Ensure proper DOCTYPE
      if (!fixedHtml.includes('<!DOCTYPE html>')) {
        fixedHtml = '<!DOCTYPE html>\n' + fixedHtml;
      }

      // Auto-fix 2: Add viewport meta tag if missing
      if (!fixedHtml.includes('viewport')) {
        fixedHtml = fixedHtml.replace(
          '<head>',
          '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">'
        );
      }

      // Auto-fix 3: Add RTL support if Hebrew content detected
      const hasHebrew = /[\u0590-\u05FF]/.test(fixedHtml);
      if (hasHebrew && !fixedHtml.includes('dir="rtl"')) {
        fixedHtml = fixedHtml.replace('<html', '<html dir="rtl"');
      }

      logger.info('[Gemini Email Monitor] Auto-fixes applied to email');

      return fixedHtml;

    } catch (error: any) {
      logger.error('[Gemini Email Monitor] Auto-fix failed', { error: error.message });
      return emailHtml; // Return original if fix fails
    }
  }
}

export default new GeminiEmailMonitor();
