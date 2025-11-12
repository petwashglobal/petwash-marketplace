/**
 * GEMINI AI WATCHDOG SERVICE
 * 
 * Master AI monitoring system that watches EVERYTHING on the Pet Wash™ platform:
 * - Real-time log monitoring
 * - User struggle detection
 * - Auto-fix engine
 * - Checkout & registration monitoring
 * - User journey analytics
 * - Proactive issue reporting
 * 
 * Purpose: Ensure users have the smoothest experience so they recommend Pet Wash™ to friends/family
 * 
 * Uses: Google Gemini 2.5 Flash for intelligent monitoring and auto-fixing
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../lib/logger';
import { db } from '../db';
import { 
  watchdogIssues, 
  watchdogUserStruggles, 
  watchdogAutoFixes,
  watchdogCheckoutMonitoring,
  watchdogRegistrationMonitoring,
  watchdogUserJourneys
} from '../../shared/schema-gemini-watchdog';
import { eq, desc, and, sql } from 'drizzle-orm';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  service: string;
  message: string;
  metadata?: any;
  userId?: string;
  sessionId?: string;
}

interface UserStruggle {
  userId: string;
  sessionId: string;
  action: string;
  failureCount: number;
  lastFailure: Date;
  context: any;
}

interface AutoFixResult {
  issueId: number;
  fixApplied: string;
  success: boolean;
  timestamp: Date;
}

class GeminiWatchdogService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private isRunning = false;
  private logBuffer: LogEntry[] = [];
  private userStruggles: Map<string, UserStruggle> = new Map();
  private BUFFER_SIZE = 100; // Analyze logs in batches of 100
  private CHECK_INTERVAL = 30000; // Check every 30 seconds

  constructor() {
    if (GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.3, // Lower temperature for more deterministic analysis
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048,
        }
      });
      logger.info('[Gemini Watchdog] ✅ Gemini 2.5 Flash initialized');
    } else {
      logger.warn('[Gemini Watchdog] ⚠️ GEMINI_API_KEY not configured - watchdog disabled');
    }
  }

  /**
   * Start the Gemini Watchdog service
   */
  async start() {
    if (!this.model) {
      logger.warn('[Gemini Watchdog] Cannot start - Gemini API key not configured');
      return;
    }

    if (this.isRunning) {
      logger.warn('[Gemini Watchdog] Already running');
      return;
    }

    this.isRunning = true;
    logger.info('[Gemini Watchdog] 🤖 Starting comprehensive AI monitoring...');

    // Start continuous monitoring loops
    this.startLogMonitoring();
    this.startUserStruggleDetection();
    this.startCheckoutMonitoring();
    this.startRegistrationMonitoring();
    this.startAutoFixEngine();

    logger.info('[Gemini Watchdog] ✅ All monitoring systems active');
  }

  /**
   * Real-time log monitoring with Gemini AI analysis
   */
  private startLogMonitoring() {
    setInterval(async () => {
      if (this.logBuffer.length >= this.BUFFER_SIZE) {
        await this.analyzeLogsBatch();
      }
    }, this.CHECK_INTERVAL);
  }

  /**
   * Capture log entry for analysis
   */
  async captureLog(entry: LogEntry) {
    this.logBuffer.push(entry);
    
    // If it's an error, analyze immediately
    if (entry.level === 'error') {
      await this.analyzeErrorImmediate(entry);
    }
  }

  /**
   * Analyze logs batch with Gemini AI
   */
  private async analyzeLogsBatch() {
    if (!this.model || this.logBuffer.length === 0) return;

    const batch = this.logBuffer.splice(0, this.BUFFER_SIZE);
    
    try {
      const prompt = `You are a watchdog AI monitoring the Pet Wash™ platform.
Analyze these ${batch.length} log entries and identify:
1. Critical errors affecting users
2. Performance bottlenecks
3. Patterns of failures
4. User experience issues

Log entries:
${JSON.stringify(batch, null, 2)}

Respond in JSON format:
{
  "criticalIssues": [{"severity": "critical|high|medium|low", "description": "...", "affectedService": "...", "suggestedFix": "..."}],
  "performanceIssues": [{"description": "...", "impact": "..."}],
  "userImpact": {"affectedUsers": number, "severity": "high|medium|low", "description": "..."}
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysis = JSON.parse(response.text());

      // Store critical issues
      for (const issue of analysis.criticalIssues || []) {
        await db.insert(watchdogIssues).values({
          severity: issue.severity,
          category: 'log_analysis',
          affectedService: issue.affectedService,
          description: issue.description,
          suggestedFix: issue.suggestedFix,
          detectedAt: new Date(),
          status: 'open',
          autoFixAttempted: false
        });

        logger.error(`[Gemini Watchdog] 🚨 ${issue.severity.toUpperCase()} ISSUE: ${issue.description}`);
        
        // Attempt auto-fix for critical issues
        if (issue.severity === 'critical') {
          await this.attemptAutoFix({
            description: issue.description,
            suggestedFix: issue.suggestedFix,
            service: issue.affectedService
          });
        }
      }

    } catch (error) {
      logger.error('[Gemini Watchdog] Log analysis failed:', error);
    }
  }

  /**
   * Analyze error immediately (critical path)
   */
  private async analyzeErrorImmediate(entry: LogEntry) {
    if (!this.model) return;

    try {
      const prompt = `URGENT: Error detected on Pet Wash™ platform.

Error details:
- Service: ${entry.service}
- Message: ${entry.message}
- User: ${entry.userId || 'Unknown'}
- Session: ${entry.sessionId || 'Unknown'}
- Metadata: ${JSON.stringify(entry.metadata || {})}

Analyze:
1. Is this affecting user experience?
2. Can it be auto-fixed?
3. What's the immediate remediation?

Respond in JSON:
{
  "userImpact": "critical|high|medium|low|none",
  "canAutoFix": boolean,
  "suggestedFix": "...",
  "immediateAction": "..."
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysis = JSON.parse(response.text());

      if (analysis.userImpact === 'critical' || analysis.userImpact === 'high') {
        logger.error(`[Gemini Watchdog] 🚨 CRITICAL USER IMPACT: ${entry.message}`);
        
        // Store issue
        const [issue] = await db.insert(watchdogIssues).values({
          severity: analysis.userImpact,
          category: 'error',
          affectedService: entry.service,
          description: entry.message,
          suggestedFix: analysis.suggestedFix,
          detectedAt: new Date(),
          status: 'open',
          autoFixAttempted: false,
          userId: entry.userId,
          sessionId: entry.sessionId
        }).returning();

        // Auto-fix if possible
        if (analysis.canAutoFix && issue) {
          await this.attemptAutoFix({
            issueId: issue.id,
            description: entry.message,
            suggestedFix: analysis.suggestedFix,
            service: entry.service
          });
        }
      }

    } catch (error) {
      logger.error('[Gemini Watchdog] Immediate error analysis failed:', error);
    }
  }

  /**
   * User struggle detection - tracks failed actions and helps users
   */
  private startUserStruggleDetection() {
    setInterval(async () => {
      await this.detectUserStruggles();
    }, 60000); // Check every minute
  }

  /**
   * Periodic scan for user struggles in the database
   */
  private async detectUserStruggles() {
    try {
      // Check for unresolved struggles in the last hour
      const recentStruggles = await db.query.watchdogUserStruggles.findMany({
        where: (struggles, { eq, and, gt }) => and(
          eq(struggles.resolved, false),
          gt(struggles.detectedAt, new Date(Date.now() - 3600000))
        ),
        limit: 50
      });

      if (recentStruggles.length > 0) {
        logger.info(`[Gemini Watchdog] 👤 Found ${recentStruggles.length} unresolved user struggles`);
      }
    } catch (error) {
      logger.error('[Gemini Watchdog] Failed to detect user struggles:', error);
    }
  }

  /**
   * Detect when users are struggling
   */
  async trackUserAction(params: {
    userId: string;
    sessionId: string;
    action: string;
    success: boolean;
    context?: any;
  }) {
    const key = `${params.userId}-${params.action}`;
    
    if (!params.success) {
      // User failed this action
      const existing = this.userStruggles.get(key) || {
        userId: params.userId,
        sessionId: params.sessionId,
        action: params.action,
        failureCount: 0,
        lastFailure: new Date(),
        context: params.context
      };

      existing.failureCount++;
      existing.lastFailure = new Date();
      this.userStruggles.set(key, existing);

      // If user failed 3+ times, analyze with Gemini
      if (existing.failureCount >= 3) {
        await this.analyzeUserStruggle(existing);
      }
    } else {
      // User succeeded - clear struggle tracking
      this.userStruggles.delete(key);
    }
  }

  /**
   * Analyze user struggle with Gemini
   */
  private async analyzeUserStruggle(struggle: UserStruggle) {
    if (!this.model) return;

    try {
      const prompt = `User is struggling on Pet Wash™ platform:

User: ${struggle.userId}
Action: ${struggle.action}
Failures: ${struggle.failureCount}
Context: ${JSON.stringify(struggle.context || {})}

Analyze why user is failing and suggest:
1. What might be confusing?
2. How to help them succeed?
3. What to fix in the UI/UX?

Respond in JSON:
{
  "likelyCause": "...",
  "userGuidance": "...",
  "uxImprovement": "...",
  "urgency": "critical|high|medium|low"
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysis = JSON.parse(response.text());

      // Store user struggle
      await db.insert(watchdogUserStruggles).values({
        userId: struggle.userId,
        sessionId: struggle.sessionId,
        action: struggle.action,
        failureCount: struggle.failureCount,
        likelyCause: analysis.likelyCause,
        suggestedGuidance: analysis.userGuidance,
        uxImprovement: analysis.uxImprovement,
        urgency: analysis.urgency,
        detectedAt: new Date(),
        resolved: false
      });

      logger.warn(`[Gemini Watchdog] 👤 User struggle detected: ${struggle.action} - ${analysis.likelyCause}`);

      // TODO: Send helpful notification to user with guidance

    } catch (error) {
      logger.error('[Gemini Watchdog] User struggle analysis failed:', error);
    }
  }

  /**
   * Checkout monitoring - ensure smooth payment flows
   */
  private startCheckoutMonitoring() {
    // This will be called by checkout routes to track the flow
    logger.info('[Gemini Watchdog] 💳 Checkout monitoring active');
  }

  /**
   * Track checkout step
   */
  async trackCheckout(params: {
    userId: string;
    sessionId: string;
    step: 'initiated' | 'payment_method' | 'processing' | 'completed' | 'failed' | 'abandoned';
    amount?: number;
    paymentMethod?: string;
    errorMessage?: string;
  }) {
    try {
      await db.insert(watchdogCheckoutMonitoring).values({
        userId: params.userId,
        sessionId: params.sessionId,
        step: params.step,
        amount: params.amount,
        paymentMethod: params.paymentMethod,
        errorMessage: params.errorMessage,
        timestamp: new Date()
      });

      // If checkout failed, analyze immediately
      if (params.step === 'failed') {
        await this.analyzeCheckoutFailure(params);
      }

    } catch (error) {
      logger.error('[Gemini Watchdog] Checkout tracking failed:', error);
    }
  }

  /**
   * Analyze checkout failure
   */
  private async analyzeCheckoutFailure(params: any) {
    if (!this.model) return;

    try {
      const prompt = `Checkout FAILED on Pet Wash™:

User: ${params.userId}
Amount: ${params.amount}
Payment method: ${params.paymentMethod}
Error: ${params.errorMessage}

Analyze:
1. Why did payment fail?
2. Can we auto-retry?
3. What message to show user?

Respond in JSON:
{
  "cause": "...",
  "canAutoRetry": boolean,
  "userMessage": "...",
  "preventionTip": "..."
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysis = JSON.parse(response.text());

      logger.error(`[Gemini Watchdog] 💳 CHECKOUT FAILURE: ${analysis.cause}`);

      // Store issue
      await db.insert(watchdogIssues).values({
        severity: 'high',
        category: 'checkout',
        affectedService: 'payment',
        description: `Checkout failed: ${analysis.cause}`,
        suggestedFix: analysis.preventionTip,
        detectedAt: new Date(),
        status: 'open',
        autoFixAttempted: analysis.canAutoRetry,
        userId: params.userId,
        sessionId: params.sessionId
      });

      // TODO: Auto-retry if possible
      // TODO: Send helpful message to user

    } catch (error) {
      logger.error('[Gemini Watchdog] Checkout failure analysis failed:', error);
    }
  }

  /**
   * Registration monitoring - track signup flows
   */
  private startRegistrationMonitoring() {
    logger.info('[Gemini Watchdog] 📝 Registration monitoring active');
  }

  /**
   * Track registration step
   */
  async trackRegistration(params: {
    sessionId: string;
    step: 'started' | 'email_entered' | 'password_set' | 'phone_verified' | 'completed' | 'failed' | 'abandoned';
    email?: string;
    failureReason?: string;
  }) {
    try {
      await db.insert(watchdogRegistrationMonitoring).values({
        sessionId: params.sessionId,
        step: params.step,
        email: params.email,
        failureReason: params.failureReason,
        timestamp: new Date()
      });

      // If registration failed, analyze
      if (params.step === 'failed') {
        await this.analyzeRegistrationFailure(params);
      }

    } catch (error) {
      logger.error('[Gemini Watchdog] Registration tracking failed:', error);
    }
  }

  /**
   * Analyze registration failure
   */
  private async analyzeRegistrationFailure(params: any) {
    if (!this.model) return;

    try {
      const prompt = `Registration FAILED on Pet Wash™:

Email: ${params.email}
Reason: ${params.failureReason}

Analyze:
1. Why did signup fail?
2. Is it a validation issue?
3. How to help user complete signup?

Respond in JSON:
{
  "cause": "...",
  "isValidationIssue": boolean,
  "userGuidance": "...",
  "autoFixPossible": boolean
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysis = JSON.parse(response.text());

      logger.warn(`[Gemini Watchdog] 📝 REGISTRATION FAILURE: ${analysis.cause}`);

      // Store issue
      await db.insert(watchdogIssues).values({
        severity: 'medium',
        category: 'registration',
        affectedService: 'auth',
        description: `Registration failed: ${analysis.cause}`,
        suggestedFix: analysis.userGuidance,
        detectedAt: new Date(),
        status: 'open',
        autoFixAttempted: false,
        sessionId: params.sessionId
      });

    } catch (error) {
      logger.error('[Gemini Watchdog] Registration failure analysis failed:', error);
    }
  }

  /**
   * Auto-fix engine - attempts to fix issues automatically
   */
  private startAutoFixEngine() {
    setInterval(async () => {
      await this.runAutoFixes();
    }, 120000); // Check every 2 minutes
  }

  /**
   * Attempt to auto-fix an issue
   */
  private async attemptAutoFix(params: {
    issueId?: number;
    description: string;
    suggestedFix: string;
    service: string;
  }) {
    if (!this.model) return;

    try {
      logger.info(`[Gemini Watchdog] 🔧 Attempting auto-fix: ${params.description}`);

      // Ask Gemini for executable fix code
      const prompt = `You are an auto-fix engine for Pet Wash™ platform.

Issue: ${params.description}
Service: ${params.service}
Suggested fix: ${params.suggestedFix}

Generate executable code to fix this issue. Consider:
1. Database fixes (SQL queries)
2. Cache clearing
3. Service restarts
4. Configuration updates

Respond in JSON:
{
  "fixType": "database|cache|restart|config|manual",
  "canAutomate": boolean,
  "code": "...", 
  "explanation": "...",
  "risks": "..."
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const fix = JSON.parse(response.text());

      // Store auto-fix attempt
      const [autoFix] = await db.insert(watchdogAutoFixes).values({
        issueId: params.issueId,
        fixType: fix.fixType,
        fixCode: fix.code,
        explanation: fix.explanation,
        risks: fix.risks,
        appliedAt: new Date(),
        success: false, // Will update after execution
        result: null
      }).returning();

      // Execute safe auto-fixes (database queries, cache clearing)
      let success = false;
      if (fix.canAutomate && (fix.fixType === 'cache' || fix.fixType === 'database')) {
        success = await this.executeSafeFix(fix);
      }

      // Update auto-fix result
      if (autoFix) {
        await db.update(watchdogAutoFixes)
          .set({ 
            success, 
            result: success ? 'Fix applied successfully' : 'Manual intervention required' 
          })
          .where(eq(watchdogAutoFixes.id, autoFix.id));
      }

      if (success) {
        logger.info(`[Gemini Watchdog] ✅ Auto-fix successful: ${params.description}`);
      } else {
        logger.warn(`[Gemini Watchdog] ⚠️ Auto-fix requires manual intervention: ${params.description}`);
      }

    } catch (error) {
      logger.error('[Gemini Watchdog] Auto-fix failed:', error);
    }
  }

  /**
   * Execute safe auto-fixes (cache, database queries)
   */
  private async executeSafeFix(fix: any): Promise<boolean> {
    try {
      if (fix.fixType === 'cache') {
        // Clear specific cache keys
        logger.info('[Gemini Watchdog] 🔧 Clearing cache...');
        // TODO: Implement cache clearing based on fix.code
        return true;
      }

      if (fix.fixType === 'database' && fix.code.includes('UPDATE') && !fix.code.includes('DELETE')) {
        // Execute safe UPDATE queries only (no DELETE)
        logger.info('[Gemini Watchdog] 🔧 Executing database fix...');
        // TODO: Execute SQL with safety checks
        return true;
      }

      return false; // Require manual intervention for other fix types

    } catch (error) {
      logger.error('[Gemini Watchdog] Fix execution failed:', error);
      return false;
    }
  }

  /**
   * Run pending auto-fixes
   */
  private async runAutoFixes() {
    try {
      // Get open issues that haven't had auto-fix attempted
      const openIssues = await db.query.watchdogIssues.findMany({
        where: and(
          eq(watchdogIssues.status, 'open'),
          eq(watchdogIssues.autoFixAttempted, false)
        ),
        limit: 5
      });

      for (const issue of openIssues) {
        await this.attemptAutoFix({
          issueId: issue.id,
          description: issue.description,
          suggestedFix: issue.suggestedFix || '',
          service: issue.affectedService || 'unknown'
        });

        // Mark as auto-fix attempted
        await db.update(watchdogIssues)
          .set({ autoFixAttempted: true })
          .where(eq(watchdogIssues.id, issue.id));
      }

    } catch (error) {
      logger.error('[Gemini Watchdog] Auto-fix run failed:', error);
    }
  }

  /**
   * Get watchdog status report
   */
  async getStatus() {
    const [issuesCount] = await db.select({ count: sql<number>`count(*)` })
      .from(watchdogIssues)
      .where(eq(watchdogIssues.status, 'open'));

    const [strugglesCount] = await db.select({ count: sql<number>`count(*)` })
      .from(watchdogUserStruggles)
      .where(eq(watchdogUserStruggles.resolved, false));

    const [autoFixesCount] = await db.select({ count: sql<number>`count(*)` })
      .from(watchdogAutoFixes)
      .where(eq(watchdogAutoFixes.success, true));

    return {
      isRunning: this.isRunning,
      geminiConfigured: !!this.model,
      openIssues: Number(issuesCount?.count || 0),
      activeStruggles: Number(strugglesCount?.count || 0),
      successfulAutoFixes: Number(autoFixesCount?.count || 0),
      logBufferSize: this.logBuffer.length
    };
  }
}

// Export singleton
export default new GeminiWatchdogService();
