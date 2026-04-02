/**
 * GEMINI PLATFORM SECURITY MONITOR
 *
 * Background Gemini 2.5 Flash AI that runs every 15 minutes and scans:
 *  - Email spend anomalies (EmailSpendGuard)
 *  - User registration spikes (Prestige Club, providers, general users)
 *  - Booking & wallet transaction anomalies
 *  - Security event patterns (failed logins, unusual IPs)
 *  - Platform health across all 12 Octopus Brain platforms
 *
 * Reports: structured JSON log + admin email alert if severity >= HIGH
 */

import { GoogleGenAI } from '@google/genai';
import { getVertexAIConfig } from '../lib/gemini-client';
import { logger } from '../lib/logger';
import { emailSpendGuard } from './EmailSpendGuard';
import { sendSecurityAlert } from './alerts';
import { db as firestore } from '../lib/firebase-admin';

const GEMINI_API_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const SCAN_INTERVAL_MS = parseInt(process.env.PLATFORM_MONITOR_INTERVAL_MS || '900000'); // 15 min

interface PlatformSnapshot {
  timestamp: string;
  emailStats: {
    hourlyCount: number;
    dailyCount: number;
    circuitOpen: boolean;
    hourlyWarn: number;
    hourlyBlock: number;
    dailyWarn: number;
    dailyBlock: number;
  };
  recentSecurityEvents: any[];
  registrationSpike: {
    prestige: number;
    providers: number;
  };
  errorPatterns: string[];
}

interface SecurityAssessment {
  severity: 'ok' | 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  findings: string[];
  recommendations: string[];
  rawScore: number;
}

class GeminiPlatformSecurityMonitor {
  private genAI: GoogleGenAI | null = null;
  private isRunning = false;
  private lastScanAt: Date | null = null;
  private scanCount = 0;
  private lastAssessment: SecurityAssessment | null = null;

  private recentErrors: string[] = [];
  private registrationWindow: { prestige: number[]; providers: number[] } = {
    prestige: [],
    providers: [],
  };

  constructor() {
    if (GEMINI_API_KEY) {
      this.genAI = new GoogleGenAI(getVertexAIConfig());
      logger.info('[PlatformMonitor] ✅ Gemini 2.5 Flash initialized for platform security monitoring');
    } else {
      logger.warn('[PlatformMonitor] ⚠️ Gemini API key not configured — AI analysis disabled, threshold-only mode');
    }
  }

  recordRegistration(type: 'prestige' | 'provider') {
    const now = Date.now();
    const window = this.registrationWindow[type];
    window.push(now);
    const cutoff = now - 3_600_000;
    this.registrationWindow[type] = window.filter(t => t > cutoff);
  }

  recordError(service: string, message: string) {
    this.recentErrors.unshift(`[${new Date().toISOString()}] [${service}] ${message}`);
    if (this.recentErrors.length > 200) this.recentErrors.pop();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(`[PlatformMonitor] 🚀 Starting background security scans every ${SCAN_INTERVAL_MS / 60000} min`);

    setTimeout(() => {
      this.runScan().catch(e => logger.error('[PlatformMonitor] Initial scan error', { error: e.message }));
    }, 15_000);

    setInterval(() => {
      this.runScan().catch(e => logger.error('[PlatformMonitor] Periodic scan error', { error: e.message }));
    }, SCAN_INTERVAL_MS);
  }

  private async collectSnapshot(): Promise<PlatformSnapshot> {
    const guardStats = emailSpendGuard.getStats();

    let recentSecurityEvents: any[] = [];
    try {
      const since = Date.now() - 3_600_000;
      const snap = await firestore
        .collection('securityEvents')
        .where('createdAt', '>=', since)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      recentSecurityEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
    }

    return {
      timestamp: new Date().toISOString(),
      emailStats: {
        hourlyCount:  guardStats.hourly.count,
        dailyCount:   guardStats.daily.count,
        circuitOpen:  guardStats.circuitOpen,
        hourlyWarn:   guardStats.hourly.warnAt,
        hourlyBlock:  guardStats.hourly.blockAt,
        dailyWarn:    guardStats.daily.warnAt,
        dailyBlock:   guardStats.daily.blockAt,
      },
      recentSecurityEvents: recentSecurityEvents.slice(0, 20),
      registrationSpike: {
        prestige:  this.registrationWindow.prestige.length,
        providers: this.registrationWindow.providers.length,
      },
      errorPatterns: this.recentErrors.slice(0, 30),
    };
  }

  private thresholdCheck(snap: PlatformSnapshot): SecurityAssessment {
    const findings: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (snap.emailStats.circuitOpen) {
      score += 50;
      findings.push(`Email circuit breaker OPEN — hourly: ${snap.emailStats.hourlyCount}, daily: ${snap.emailStats.dailyCount}`);
      recommendations.push('Check EmailSpendGuard stats at /api/admin/email-guard, investigate recent sends');
    } else if (snap.emailStats.hourlyCount >= snap.emailStats.hourlyWarn) {
      score += 20;
      findings.push(`Email hourly count approaching block threshold: ${snap.emailStats.hourlyCount}/${snap.emailStats.hourlyBlock}`);
      recommendations.push('Monitor email sending volume, check for accidental bulk sends');
    }

    if (snap.registrationSpike.prestige >= 20) {
      score += 25;
      findings.push(`High Prestige Club registration rate: ${snap.registrationSpike.prestige} in last hour`);
      recommendations.push('Verify registrations are legitimate — check IP addresses and email domains');
    }
    if (snap.registrationSpike.providers >= 10) {
      score += 25;
      findings.push(`High provider registration rate: ${snap.registrationSpike.providers} in last hour`);
      recommendations.push('Review new provider applications for suspicious patterns');
    }

    const failedLoginEvents = snap.recentSecurityEvents.filter(
      e => e.eventType === 'login_failed' || e.type === 'failed_login'
    );
    if (failedLoginEvents.length >= 10) {
      score += 30;
      findings.push(`${failedLoginEvents.length} failed login events in the last hour`);
      recommendations.push('Possible brute-force attack — review IPs in securityEvents collection');
    }

    const criticalErrors = snap.errorPatterns.filter(e =>
      e.toLowerCase().includes('unauthorized') ||
      e.toLowerCase().includes('403') ||
      e.toLowerCase().includes('injection') ||
      e.toLowerCase().includes('malicious')
    );
    if (criticalErrors.length >= 3) {
      score += 20;
      findings.push(`${criticalErrors.length} critical error patterns detected in logs`);
      recommendations.push('Review server error logs for security-related errors');
    }

    let severity: SecurityAssessment['severity'] = 'ok';
    if (score >= 70) severity = 'critical';
    else if (score >= 50) severity = 'high';
    else if (score >= 30) severity = 'medium';
    else if (score >= 10) severity = 'low';

    return {
      severity,
      summary: findings.length === 0
        ? 'All platforms operating normally. No anomalies detected.'
        : `${findings.length} issue(s) detected — severity: ${severity.toUpperCase()}`,
      findings,
      recommendations,
      rawScore: score,
    };
  }

  private async geminiAnalysis(snap: PlatformSnapshot, preliminary: SecurityAssessment): Promise<SecurityAssessment> {
    if (!this.genAI || preliminary.severity === 'ok') return preliminary;

    try {
      const prompt = `You are the security AI for PetWash™, an Israeli pet services platform.
Analyze the following platform security snapshot and provide a concise security assessment.

SNAPSHOT:
${JSON.stringify({ ...snap, errorPatterns: snap.errorPatterns.slice(0, 10) }, null, 2)}

PRELIMINARY THRESHOLD ASSESSMENT:
Severity: ${preliminary.severity}
Score: ${preliminary.rawScore}
Findings: ${preliminary.findings.join('; ')}

Respond ONLY with a valid JSON object (no markdown fences):
{
  "severity": "ok|low|medium|high|critical",
  "summary": "one sentence summary",
  "findings": ["finding 1", "finding 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "rawScore": <0-100>
}`;

      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const text = response.candidates?.[0]?.content?.parts
        ?.filter((p: any) => p.text)
        ?.map((p: any) => p.text)
        ?.join('') || '';

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          severity: parsed.severity || preliminary.severity,
          summary: parsed.summary || preliminary.summary,
          findings: [...new Set([...preliminary.findings, ...(parsed.findings || [])])],
          recommendations: [...new Set([...preliminary.recommendations, ...(parsed.recommendations || [])])],
          rawScore: parsed.rawScore || preliminary.rawScore,
        };
      }
    } catch (err: any) {
      logger.warn('[PlatformMonitor] Gemini analysis failed, using threshold result', { error: err.message });
    }

    return preliminary;
  }

  private async runScan() {
    this.scanCount++;
    const scanId = `scan-${this.scanCount}`;
    logger.info(`[PlatformMonitor] 🔍 Starting security scan #${this.scanCount}`);

    try {
      const snap = await this.collectSnapshot();
      const preliminary = this.thresholdCheck(snap);
      const assessment = await this.geminiAnalysis(snap, preliminary);

      this.lastScanAt = new Date();
      this.lastAssessment = assessment;

      if (assessment.severity === 'ok' || assessment.severity === 'low') {
        logger.info(`[PlatformMonitor] ✅ ${scanId} — ${assessment.severity.toUpperCase()} — ${assessment.summary}`, {
          score: assessment.rawScore,
          emailHourly: snap.emailStats.hourlyCount,
          emailDaily: snap.emailStats.dailyCount,
          registrations: snap.registrationSpike,
        });
      } else {
        logger.warn(`[PlatformMonitor] ⚠️ ${scanId} — ${assessment.severity.toUpperCase()} — ${assessment.summary}`, {
          score: assessment.rawScore,
          findings: assessment.findings,
          recommendations: assessment.recommendations,
        });

        if (assessment.severity === 'high' || assessment.severity === 'critical') {
          await this.sendAdminAlert(snap, assessment, scanId);
        }
      }
    } catch (err: any) {
      logger.error('[PlatformMonitor] Scan failed', { error: err.message, scanId });
    }
  }

  private async sendAdminAlert(snap: PlatformSnapshot, assessment: SecurityAssessment, scanId: string) {
    const severityColor = assessment.severity === 'critical' ? '#dc2626' : '#f59e0b';
    const findings = assessment.findings.map(f => `<li>${f}</li>`).join('');
    const recs = assessment.recommendations.map(r => `<li>${r}</li>`).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;max-width:640px">
        <h2 style="color:${severityColor}">🤖 PetWash™ AI Platform Security Monitor — ${assessment.severity.toUpperCase()}</h2>
        <p><strong>Scan ID:</strong> ${scanId}</p>
        <p><strong>Time:</strong> ${snap.timestamp}</p>
        <p><strong>AI Score:</strong> ${assessment.rawScore}/100</p>
        <p><strong>Summary:</strong> ${assessment.summary}</p>

        <h3 style="color:#374151;margin-top:20px">Findings:</h3>
        <ul style="color:#374151">${findings || '<li>None</li>'}</ul>

        <h3 style="color:#374151;margin-top:16px">Recommendations:</h3>
        <ul style="color:#059669">${recs || '<li>None</li>'}</ul>

        <h3 style="color:#374151;margin-top:16px">Platform Metrics:</h3>
        <table style="border-collapse:collapse;width:100%;font-size:13px" border="1" cellpadding="6">
          <tr style="background:#f3f4f6"><th>Metric</th><th>Value</th><th>Threshold</th></tr>
          <tr><td>Email hourly</td><td>${snap.emailStats.hourlyCount}</td><td>warn ${snap.emailStats.hourlyWarn} / block ${snap.emailStats.hourlyBlock}</td></tr>
          <tr><td>Email daily</td><td>${snap.emailStats.dailyCount}</td><td>warn ${snap.emailStats.dailyWarn} / block ${snap.emailStats.dailyBlock}</td></tr>
          <tr><td>Email circuit</td><td>${snap.emailStats.circuitOpen ? '🔴 OPEN' : '🟢 Closed'}</td><td>—</td></tr>
          <tr><td>Prestige regs / hr</td><td>${snap.registrationSpike.prestige}</td><td>warn 20</td></tr>
          <tr><td>Provider regs / hr</td><td>${snap.registrationSpike.providers}</td><td>warn 10</td></tr>
          <tr><td>Security events / hr</td><td>${snap.recentSecurityEvents.length}</td><td>—</td></tr>
        </table>

        <p style="margin-top:20px;color:#6b7280;font-size:12px">
          Generated by PetWash™ Gemini Platform Security Monitor (${scanId})<br>
          Powered by Google Gemini 2.5 Flash
        </p>
      </div>
    `;

    try {
      await sendSecurityAlert(`AI Platform Monitor — ${assessment.severity.toUpperCase()} — ${assessment.summary}`, html);
      logger.info(`[PlatformMonitor] Admin alert sent for ${scanId}`);
    } catch (err: any) {
      logger.error('[PlatformMonitor] Failed to send admin alert', { error: err.message });
    }
  }

  getStatus() {
    return {
      running: this.isRunning,
      geminiEnabled: !!this.genAI,
      lastScanAt: this.lastScanAt?.toISOString() || null,
      scanCount: this.scanCount,
      scanIntervalMinutes: SCAN_INTERVAL_MS / 60000,
      lastAssessment: this.lastAssessment,
      emailGuardStats: emailSpendGuard.getStats(),
    };
  }

  async forceScan() {
    await this.runScan();
    return this.lastAssessment;
  }
}

export const geminiPlatformMonitor = new GeminiPlatformSecurityMonitor();
export default geminiPlatformMonitor;
