/**
 * GEMINI SPAM GUARD — PetWash HQ Spam Intelligence System
 *
 * Continuously monitors all user-generated content on the platform using
 * Gemini 2.5 Flash AI to detect:
 *  - Fake/bot-generated reviews
 *  - Promotional spam in messages, bios, booking notes
 *  - Coordinated multi-account abuse campaigns
 *  - Harassment and toxic content
 *  - Phishing/scam links in user content
 *
 * Reports:
 *  - Twilio SMS to SUPER_ADMIN_ALERT_PHONE for HIGH/CRITICAL detections
 *  - SendGrid email alert for any spam campaign or critical finding
 *  - SystemEventService entry for every detection (admin dashboard visible)
 *  - Firestore log for full audit trail
 *
 * Background sweep: every 30 minutes (configurable via SPAM_GUARD_INTERVAL_MS)
 */

import { GoogleGenAI } from '@google/genai';
import { getVertexAIConfig } from '../lib/gemini-client';
import { logger } from '../lib/logger';
import { sendSecurityAlert } from './alerts';
import { SystemEventService } from './SystemEventService';
import { db as firestore } from '../lib/firebase-admin';
import { pool } from '../db';

const GEMINI_API_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const SWEEP_INTERVAL_MS = parseInt(process.env.SPAM_GUARD_INTERVAL_MS || '1800000'); // 30 min
const ALERT_PHONE = process.env.SUPER_ADMIN_ALERT_PHONE ?? null;

export interface SpamDetection {
  id: string;
  detectedAt: string;
  contentType: 'review' | 'message' | 'booking_note' | 'provider_bio' | 'user_profile' | 'platform_sweep';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0–100
  reason: string;
  excerpt: string; // first 200 chars of flagged content
  userId?: string;
  entityId?: string; // review ID, booking ID, etc.
  aiSummary: string;
  resolved: boolean;
}

export interface SpamSweepReport {
  sweepId: string;
  startedAt: string;
  completedAt: string;
  itemsAnalyzed: number;
  detectionsFound: number;
  highSeverity: number;
  detections: SpamDetection[];
  aiSummary: string;
  recommendations: string[];
}

class GeminiSpamGuardService {
  private genAI: GoogleGenAI | null = null;
  private isRunning = false;
  private sweepCount = 0;
  private lastSweepAt: Date | null = null;
  private lastReport: SpamSweepReport | null = null;
  private recentDetections: SpamDetection[] = []; // in-memory ring buffer (last 200)

  constructor() {
    try {
      if (GEMINI_API_KEY) {
        this.genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        logger.info('[SpamGuard] ✅ Gemini 2.5 Flash initialized for spam monitoring');
      } else {
        const { apiKey, vertexOptions } = getVertexAIConfig();
        this.genAI = new GoogleGenAI(
          vertexOptions
            ? { vertexai: true, ...vertexOptions }
            : { apiKey: apiKey! }
        );
        logger.info('[SpamGuard] ✅ Vertex AI initialized for spam monitoring');
      }
    } catch (err) {
      logger.error('[SpamGuard] Failed to initialize Gemini AI', { error: (err as any)?.message });
    }
  }

  /** Start the background sweep scheduler */
  startScheduler(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const run = async () => {
      try {
        await this.runSweep();
      } catch (err) {
        logger.error('[SpamGuard] Sweep failed', { error: (err as any)?.message });
      }
      setTimeout(run, SWEEP_INTERVAL_MS);
    };

    // Initial sweep after 2 minutes (let the server fully initialize)
    setTimeout(run, 2 * 60 * 1000);
    logger.info(`[SpamGuard] ✅ Scheduler started — sweeps every ${SWEEP_INTERVAL_MS / 60000}min`);
  }

  /** Run a full platform spam sweep */
  async runSweep(): Promise<SpamSweepReport> {
    if (!this.genAI) throw new Error('[SpamGuard] Gemini not initialized');

    const sweepId = `sweep_${Date.now()}`;
    const startedAt = new Date().toISOString();
    this.sweepCount++;

    logger.info(`[SpamGuard] Starting sweep #${this.sweepCount} (${sweepId})`);

    const contentBatch = await this.harvestRecentContent();
    const detections: SpamDetection[] = [];

    // Analyze in batches of 20 to stay within Gemini token limits
    const BATCH = 20;
    for (let i = 0; i < contentBatch.length; i += BATCH) {
      const slice = contentBatch.slice(i, i + BATCH);
      const found = await this.analyzeContentBatch(slice);
      detections.push(...found);
    }

    // Also run a holistic platform-level abuse pattern analysis
    if (contentBatch.length > 0) {
      const patternDetection = await this.detectCoordinatedAbuse(contentBatch);
      if (patternDetection) detections.push(patternDetection);
    }

    const highSeverity = detections.filter(d => d.severity === 'high' || d.severity === 'critical');

    // Build sweep report
    const aiSummary = await this.generateSweepSummary(contentBatch.length, detections);
    const recommendations = this.buildRecommendations(detections);

    const report: SpamSweepReport = {
      sweepId,
      startedAt,
      completedAt: new Date().toISOString(),
      itemsAnalyzed: contentBatch.length,
      detectionsFound: detections.length,
      highSeverity: highSeverity.length,
      detections,
      aiSummary,
      recommendations,
    };

    this.lastReport = report;
    this.lastSweepAt = new Date();

    // Store in memory ring buffer
    this.recentDetections = [...detections, ...this.recentDetections].slice(0, 200);

    // Persist to Firestore
    await this.persistReport(report);

    // Stamp each HIGH/CRITICAL detection to SystemEventService
    for (const det of highSeverity) {
      SystemEventService.stamp({
        eventType: 'spam_detected',
        severity: det.severity === 'critical' ? 'critical' : 'error',
        entityType: det.contentType,
        entityId: det.entityId || det.id,
        message: `[SpamGuard] ${det.contentType} flagged: ${det.reason}`,
        metadata: { confidence: det.confidence, excerpt: det.excerpt, userId: det.userId },
      });
    }

    // Alert HQ if significant spam found
    if (highSeverity.length > 0) {
      await this.alertHQ(report, highSeverity);
    }

    logger.info(`[SpamGuard] Sweep #${this.sweepCount} complete`, {
      itemsAnalyzed: contentBatch.length,
      detections: detections.length,
      highSeverity: highSeverity.length,
    });

    return report;
  }

  /** Analyze a single piece of content on-demand (called from routes) */
  async analyzeContent(content: string, contentType: SpamDetection['contentType'], userId?: string, entityId?: string): Promise<SpamDetection | null> {
    if (!this.genAI || !content?.trim()) return null;

    try {
      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: this.buildSingleAnalysisPrompt(content, contentType) }],
        }],
        config: { responseMimeType: 'application/json', temperature: 0.1 },
      });

      const raw = result.text ?? '';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

      if (!parsed.isSpam) return null;

      const detection: SpamDetection = {
        id: `det_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        detectedAt: new Date().toISOString(),
        contentType,
        severity: parsed.severity ?? 'medium',
        confidence: parsed.confidence ?? 50,
        reason: parsed.reason ?? 'Spam detected',
        excerpt: content.slice(0, 200),
        userId,
        entityId,
        aiSummary: parsed.summary ?? '',
        resolved: false,
      };

      this.recentDetections = [detection, ...this.recentDetections].slice(0, 200);

      if (detection.severity === 'high' || detection.severity === 'critical') {
        SystemEventService.stamp({
          eventType: 'spam_detected',
          severity: detection.severity === 'critical' ? 'critical' : 'error',
          entityType: contentType,
          entityId: entityId || detection.id,
          message: `[SpamGuard] Real-time detection: ${detection.reason}`,
          metadata: { confidence: detection.confidence, userId },
        });
        await this.sendSMSAlert(`🚫 SPAM DETECTED\nType: ${contentType}\nSeverity: ${detection.severity.toUpperCase()}\nReason: ${detection.reason.slice(0, 100)}`);
      }

      return detection;
    } catch (err) {
      logger.warn('[SpamGuard] Real-time analysis failed', { error: (err as any)?.message });
      return null;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /** Harvest recent user-generated content from the last sweep window */
  private async harvestRecentContent(): Promise<Array<{ id: string; type: SpamDetection['contentType']; text: string; userId?: string; entityId?: string }>> {
    const items: Array<{ id: string; type: SpamDetection['contentType']; text: string; userId?: string; entityId?: string }> = [];
    const since = new Date(Date.now() - SWEEP_INTERVAL_MS * 2).toISOString(); // last 2 sweep windows

    try {
      // Recent reviews
      const reviews = await pool.query(
        `SELECT id::text, user_id::text, comment FROM service_reviews WHERE created_at >= $1 AND comment IS NOT NULL AND length(comment) > 5 LIMIT 50`,
        [since]
      );
      for (const r of reviews.rows) {
        items.push({ id: `review_${r.id}`, type: 'review', text: r.comment, userId: r.user_id, entityId: r.id });
      }
    } catch { /* table may not exist in all environments */ }

    try {
      // Recent chat messages
      const messages = await pool.query(
        `SELECT id::text, sender_id::text, content FROM chat_messages WHERE created_at >= $1 AND content IS NOT NULL AND length(content) > 5 LIMIT 50`,
        [since]
      );
      for (const m of messages.rows) {
        items.push({ id: `msg_${m.id}`, type: 'message', text: m.content, userId: m.sender_id, entityId: m.id });
      }
    } catch { /* table may not exist */ }

    try {
      // Recent booking notes
      const bookings = await pool.query(
        `SELECT id::text, customer_id::text, notes FROM bookings WHERE created_at >= $1 AND notes IS NOT NULL AND length(notes) > 5 LIMIT 30`,
        [since]
      );
      for (const b of bookings.rows) {
        items.push({ id: `booking_${b.id}`, type: 'booking_note', text: b.notes, userId: b.customer_id, entityId: b.id });
      }
    } catch { /* table may not exist */ }

    try {
      // New provider bio/profile changes
      const providers = await pool.query(
        `SELECT id::text, user_id::text, bio FROM service_providers WHERE updated_at >= $1 AND bio IS NOT NULL AND length(bio) > 10 LIMIT 20`,
        [since]
      );
      for (const p of providers.rows) {
        items.push({ id: `provider_${p.id}`, type: 'provider_bio', text: p.bio, userId: p.user_id, entityId: p.id });
      }
    } catch { /* table may not exist */ }

    return items;
  }

  /** Analyze a batch of content items in one Gemini call */
  private async analyzeContentBatch(items: Array<{ id: string; type: SpamDetection['contentType']; text: string; userId?: string; entityId?: string }>): Promise<SpamDetection[]> {
    if (!this.genAI || items.length === 0) return [];

    const prompt = `You are a spam detection AI for PetWash™, an Israeli pet care platform.

Analyze the following user-generated content items for spam, abuse, or manipulation.

For EACH item return a JSON object in the array. Only flag items that are genuinely problematic.

Spam categories to detect:
- Fake/template/bot-generated reviews (repetitive phrases, generic praise/complaints, suspiciously positive or negative)
- Promotional spam (advertising unrelated services, links, competitor mentions)
- Phishing or scam content (fake offers, suspicious URLs, payment redirection)
- Harassment or hate speech
- Coordinated/astroturfing content (similar phrasing across multiple items)
- Booking note abuse (threats, offensive language)

Content items:
${items.map((item, i) => `[${i + 1}] ID: ${item.id} | Type: ${item.type}\nText: ${item.text.slice(0, 300)}`).join('\n\n')}

Respond with a JSON array. Each element must have:
{
  "itemId": "<id from above>",
  "isSpam": true/false,
  "severity": "low"|"medium"|"high"|"critical",
  "confidence": 0-100,
  "reason": "<brief 1-sentence reason>",
  "summary": "<AI explanation>"
}

Only include items where isSpam=true. Empty array if nothing suspicious.`;

    try {
      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json', temperature: 0.1 },
      });

      const raw = result.text ?? '[]';
      const parsed: any[] = JSON.parse(raw.replace(/```json|```/g, '').trim());

      return parsed
        .filter(p => p.isSpam)
        .map(p => {
          const item = items.find(i => i.id === p.itemId);
          return {
            id: `det_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            detectedAt: new Date().toISOString(),
            contentType: item?.type ?? 'review',
            severity: p.severity ?? 'medium',
            confidence: p.confidence ?? 50,
            reason: p.reason ?? 'Spam detected',
            excerpt: (item?.text ?? '').slice(0, 200),
            userId: item?.userId,
            entityId: item?.entityId,
            aiSummary: p.summary ?? '',
            resolved: false,
          } as SpamDetection;
        });
    } catch (err) {
      logger.warn('[SpamGuard] Batch analysis failed', { error: (err as any)?.message });
      return [];
    }
  }

  /** Look for coordinated abuse across the content batch */
  private async detectCoordinatedAbuse(items: Array<{ id: string; type: string; text: string }>): Promise<SpamDetection | null> {
    if (!this.genAI || items.length < 5) return null;

    const prompt = `You are a fraud detection AI analyzing user-generated content on PetWash™.

Look across ALL ${items.length} content items for signs of coordinated abuse:
- Multiple items with nearly identical phrasing (bot/template content)
- Sudden unusual volume spike in a content type
- Coordinated negative/positive rating campaigns
- Injection attack patterns (SQL, XSS, path traversal)

Content summary (first 100 chars each):
${items.slice(0, 50).map((item, i) => `[${i + 1}] ${item.type}: ${item.text.slice(0, 100)}`).join('\n')}

Respond ONLY with JSON:
{
  "coordinated": true/false,
  "severity": "low"|"medium"|"high"|"critical",
  "confidence": 0-100,
  "pattern": "<describe the pattern if coordinated>",
  "summary": "<explanation>"
}`;

    try {
      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json', temperature: 0.1 },
      });

      const raw = result.text ?? '{}';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

      if (!parsed.coordinated || parsed.confidence < 60) return null;

      return {
        id: `coord_${Date.now()}`,
        detectedAt: new Date().toISOString(),
        contentType: 'platform_sweep',
        severity: parsed.severity ?? 'high',
        confidence: parsed.confidence ?? 70,
        reason: `Coordinated abuse pattern: ${parsed.pattern ?? 'unknown'}`,
        excerpt: `Detected across ${items.length} items`,
        aiSummary: parsed.summary ?? '',
        resolved: false,
      };
    } catch {
      return null;
    }
  }

  /** Generate a plain-English sweep summary for HQ */
  private async generateSweepSummary(totalItems: number, detections: SpamDetection[]): Promise<string> {
    if (!this.genAI || detections.length === 0) {
      return `Sweep complete. Analyzed ${totalItems} content items. No spam detected.`;
    }

    const counts = detections.reduce((acc, d) => {
      acc[d.severity] = (acc[d.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return `Analyzed ${totalItems} items. Found ${detections.length} spam detections: ${
      Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')
    }. Top issues: ${detections.slice(0, 3).map(d => d.reason).join('; ')}.`;
  }

  private buildRecommendations(detections: SpamDetection[]): string[] {
    const recs: string[] = [];
    const highConf = detections.filter(d => d.confidence >= 80);
    const byType = detections.reduce((acc, d) => { acc[d.contentType] = (acc[d.contentType] || 0) + 1; return acc; }, {} as Record<string, number>);

    if (highConf.length > 0) recs.push(`Review and remove ${highConf.length} high-confidence detections immediately`);
    if (byType['review'] >= 3) recs.push('Enable manual review approval for new service reviews temporarily');
    if (byType['message'] >= 5) recs.push('Consider rate-limiting chat messages for new accounts (<7 days old)');
    if (detections.some(d => d.contentType === 'platform_sweep')) recs.push('Investigate coordinated abuse campaign — check for linked accounts');
    if (detections.length === 0) recs.push('Platform content appears clean — no immediate action required');

    return recs;
  }

  private buildSingleAnalysisPrompt(content: string, contentType: string): string {
    return `You are a spam detection AI for PetWash™, an Israeli pet care app.

Analyze this ${contentType} content for spam, abuse, or manipulation:
"${content.slice(0, 500)}"

Respond ONLY with JSON:
{
  "isSpam": true/false,
  "severity": "low"|"medium"|"high"|"critical",
  "confidence": 0-100,
  "reason": "<brief 1-sentence reason>",
  "summary": "<detailed explanation>"
}`;
  }

  /** Send Twilio SMS to super admin (fire-and-forget) */
  private async sendSMSAlert(message: string): Promise<void> {
    if (!ALERT_PHONE) return;
    try {
      const { twilioSMSService } = await import('./TwilioSMSService');
      if (!twilioSMSService) return;
      await (twilioSMSService as any).sendSMS(ALERT_PHONE, message, {});
      logger.warn('[SpamGuard] 🚨 SMS alert sent to super-admin');
    } catch (err) {
      logger.error('[SpamGuard] SMS alert failed', { error: (err as any)?.message });
    }
  }

  /** Alert HQ via SMS + email for significant findings */
  private async alertHQ(report: SpamSweepReport, highSeverity: SpamDetection[]): Promise<void> {
    const smsBody = [
      `🚫 PetWash™ SPAM ALERT`,
      `Sweep #${this.sweepCount}: ${report.detectionsFound} detections`,
      `⚠️ HIGH/CRITICAL: ${highSeverity.length}`,
      highSeverity.slice(0, 2).map(d => `• ${d.contentType}: ${d.reason.slice(0, 80)}`).join('\n'),
      `Admin: /api/admin/spam-guard/report`,
    ].join('\n');

    await this.sendSMSAlert(smsBody);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #dc2626;">🚫 PetWash™ Spam Detection Report</h2>
        <p><strong>Sweep #${this.sweepCount}</strong> — ${report.startedAt}</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr style="background: #f3f4f6;"><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Items Analyzed</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${report.itemsAnalyzed}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Spam Detections</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${report.detectionsFound}</td></tr>
          <tr style="background: #fef2f2;"><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>HIGH/CRITICAL</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${report.highSeverity}</td></tr>
        </table>
        <h3>AI Summary</h3>
        <p>${report.aiSummary}</p>
        <h3>Top Detections</h3>
        <ul>
          ${highSeverity.slice(0, 5).map(d => `
            <li style="margin-bottom: 8px;">
              <strong>[${d.severity.toUpperCase()}]</strong> ${d.contentType} — ${d.reason}
              <br><em style="color: #6b7280;">"${d.excerpt.slice(0, 100)}..."</em>
            </li>`).join('')}
        </ul>
        <h3>Recommendations</h3>
        <ul>${report.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
        <hr style="margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          PetWash™ Gemini Spam Guard — Automated HQ Report<br>
          ח.פ. 517145033 | פט וואש בע"מ | PET WASH LTD
        </p>
      </div>`;

    await sendSecurityAlert(`Spam Sweep #${this.sweepCount}: ${highSeverity.length} HIGH/CRITICAL detections`, emailHtml);
  }

  /** Persist sweep report to Firestore */
  private async persistReport(report: SpamSweepReport): Promise<void> {
    if (!firestore) return;
    try {
      await firestore
        .collection('spam_guard_reports')
        .doc(report.sweepId)
        .set({
          ...report,
          detections: report.detections.slice(0, 50), // cap Firestore doc size
        });
    } catch (err) {
      logger.warn('[SpamGuard] Failed to persist report to Firestore', { error: (err as any)?.message });
    }
  }

  // ── Public getters for admin API ─────────────────────────────────────────────

  getStatus() {
    return {
      initialized: !!this.genAI,
      isRunning: this.isRunning,
      sweepCount: this.sweepCount,
      lastSweepAt: this.lastSweepAt?.toISOString() ?? null,
      sweepIntervalMs: SWEEP_INTERVAL_MS,
      recentDetectionCount: this.recentDetections.length,
      lastReport: this.lastReport
        ? {
            sweepId: this.lastReport.sweepId,
            completedAt: this.lastReport.completedAt,
            itemsAnalyzed: this.lastReport.itemsAnalyzed,
            detectionsFound: this.lastReport.detectionsFound,
            highSeverity: this.lastReport.highSeverity,
            aiSummary: this.lastReport.aiSummary,
          }
        : null,
    };
  }

  getRecentDetections(limit = 50): SpamDetection[] {
    return this.recentDetections.slice(0, limit);
  }

  resolveDetection(detectionId: string): boolean {
    const idx = this.recentDetections.findIndex(d => d.id === detectionId);
    if (idx === -1) return false;
    this.recentDetections[idx] = { ...this.recentDetections[idx], resolved: true };
    return true;
  }
}

export const geminiSpamGuard = new GeminiSpamGuardService();
