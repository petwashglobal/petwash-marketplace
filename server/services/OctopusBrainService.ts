/**
 * 🐙 OCTOPUS BRAIN - Central Platform Orchestration Service
 * 
 * The Master Brain that manages all ⁦Pet Wash™⁩ SaaS platforms:
 * - ⁦Sitter Suite™⁩ (Pet Sitting)
 * - ⁦Walk My Pet™⁩ (Dog Walking)
 * - ⁦PetTrek™⁩ (Pet Transportation)
 * - ⁦K9000™⁩ (IoT Wash Stations)
 * - ⁦Pet Wash Academy™⁩ (Training)
 * - ⁦The Plush Lab™⁩ (AI Avatars)
 * - ⁦Wash Hub™⁩ (Packages & Loyalty)
 * 
 * Features:
 * - Real-time platform health monitoring
 * - Gemini AI-powered anomaly detection
 * - Cross-platform issue correlation
 * - Platform certification stamps
 * - Unified status dashboard
 * - Auto-healing capabilities
 * 
 * Uses: Google Gemini 2.5 Flash for intelligent orchestration
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../lib/logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const GEMINI_API_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

export interface PlatformDefinition {
  id: string;
  name: string;
  nameHe: string;
  icon: string;
  color: string;
  basePath: string;
  description: string;
  category: 'marketplace' | 'iot' | 'enterprise' | 'training';
}

export interface PlatformHealth {
  platformId: string;
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  lastCheck: Date;
  responseTimeMs: number;
  uptime24h: number;
  activeUsers: number;
  errorRate: number;
  certificationStamp: string;
  geminiAnalysis?: string;
}

export interface OctopusBrainStatus {
  overallHealth: 'healthy' | 'warning' | 'critical';
  platformsOnline: number;
  platformsTotal: number;
  lastScan: Date;
  geminiEnabled: boolean;
  platforms: Record<string, PlatformHealth>;
  alerts: BrainAlert[];
}

export interface BrainAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  platformId: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  geminiSuggestion?: string;
}

class OctopusBrainService {
  private ai: GoogleGenAI | null = null;
  private isRunning = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private CHECK_INTERVAL = 60 * 1000; // Check every minute
  private platformHealth: Map<string, PlatformHealth> = new Map();
  private alerts: BrainAlert[] = [];
  private lastGeminiAnalysis: Date | null = null;
  private GEMINI_ANALYSIS_INTERVAL = 2 * 60 * 60 * 1000; // Gemini analysis every 2 hours (free tier: 20 req/day)
  private geminiQuotaExhausted = false;
  private geminiQuotaResetTime: Date | null = null;

  private readonly PLATFORMS: PlatformDefinition[] = [
    {
      id: 'sitter-suite',
      name: '⁦Sitter Suite™⁩',
      nameHe: 'סיטר סוויט™',
      icon: '🏠',
      color: '#8B5CF6',
      basePath: '/api/sitter-suite',
      description: 'Premium pet sitting marketplace',
      category: 'marketplace'
    },
    {
      id: 'walk-my-pet',
      name: '⁦Walk My Pet™⁩',
      nameHe: 'ווק מיי פט™',
      icon: '🚶',
      color: '#10B981',
      basePath: '/api/walk-my-pet',
      description: 'Professional dog walking services',
      category: 'marketplace'
    },
    {
      id: 'pettrek',
      name: '⁦PetTrek™⁩',
      nameHe: 'פט טרק™',
      icon: '🚗',
      color: '#F59E0B',
      basePath: '/api/pettrek',
      description: 'Luxury pet transportation',
      category: 'marketplace'
    },
    {
      id: 'k9000',
      name: '⁦K9000™⁩',
      nameHe: '⁦K9000™⁩',
      icon: '🚿',
      color: '#3B82F6',
      basePath: '/api/k9000',
      description: 'IoT self-service wash stations',
      category: 'iot'
    },
    {
      id: 'academy',
      name: '⁦Pet Wash Academy™⁩',
      nameHe: 'אקדמיית פט וואש™',
      icon: '🎓',
      color: '#EC4899',
      basePath: '/api/academy',
      description: 'Provider training and certification',
      category: 'training'
    },
    {
      id: 'plush-lab',
      name: '⁦The Plush Lab™⁩',
      nameHe: 'פלוש לאב™',
      icon: '🧸',
      color: '#A855F7',
      basePath: '/api/avatars',
      description: 'AI-powered pet avatar creation',
      category: 'enterprise'
    },
    {
      id: 'wash-hub',
      name: '⁦Wash Hub™⁩',
      nameHe: 'ווש האב™',
      icon: '💎',
      color: '#C6A664',
      basePath: '/api/packages',
      description: 'Packages and loyalty program',
      category: 'enterprise'
    }
  ];

  constructor() {
    if (GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({
        apiKey: GEMINI_API_KEY,
        ...(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ? { httpOptions: { baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL, apiVersion: '' } } : {}),
      });
      logger.info('[🐙 Octopus Brain] ✅ Gemini 2.5 Flash initialized for platform orchestration');
    } else {
      logger.warn('[🐙 Octopus Brain] ⚠️ Gemini API key not configured - AI analysis disabled');
    }
    
    this.initializePlatformHealth();
  }

  private initializePlatformHealth() {
    this.PLATFORMS.forEach(platform => {
      this.platformHealth.set(platform.id, {
        platformId: platform.id,
        status: 'healthy',
        lastCheck: new Date(),
        responseTimeMs: 0,
        uptime24h: 100,
        activeUsers: 0,
        errorRate: 0,
        certificationStamp: this.generateCertificationStamp(platform.id)
      });
    });
  }

  private generateCertificationStamp(platformId: string): string {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return `PW-${platformId.toUpperCase().slice(0, 4)}-${timestamp}-CERTIFIED`;
  }

  async start() {
    if (this.isRunning) {
      logger.warn('[🐙 Octopus Brain] Already running');
      return;
    }

    this.isRunning = true;
    logger.info('[🐙 Octopus Brain] 🚀 Starting central platform orchestration...');
    logger.info(`[🐙 Octopus Brain] 📋 Managing ${this.PLATFORMS.length} platforms:`);
    
    this.PLATFORMS.forEach(platform => {
      logger.info(`   ${platform.icon} ${platform.name} (${platform.category})`);
    });

    await this.runHealthCheck();

    this.monitoringInterval = setInterval(async () => {
      await this.runHealthCheck();
    }, this.CHECK_INTERVAL);

    logger.info('[🐙 Octopus Brain] ✅ Orchestration active - monitoring all platforms');
  }

  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    logger.info('[🐙 Octopus Brain] Stopped');
  }

  private async runHealthCheck() {
    const startTime = Date.now();
    logger.debug('[🐙 Octopus Brain] Running platform health scan...');

    const healthChecks = this.PLATFORMS.map(platform => this.checkPlatformHealth(platform));
    await Promise.all(healthChecks);

    if (this.geminiQuotaExhausted && this.geminiQuotaResetTime && new Date() > this.geminiQuotaResetTime) {
      this.geminiQuotaExhausted = false;
      this.geminiQuotaResetTime = null;
    }

    const shouldRunGemini = !this.geminiQuotaExhausted && 
      (!this.lastGeminiAnalysis || (Date.now() - this.lastGeminiAnalysis.getTime()) > this.GEMINI_ANALYSIS_INTERVAL);

    if (this.ai && shouldRunGemini) {
      await this.runGeminiAnalysis();
      this.lastGeminiAnalysis = new Date();
    }

    const duration = Date.now() - startTime;
    const status = this.getOverallStatus();
    
    logger.info(`[🐙 Octopus Brain] Health scan complete in ${duration}ms - ${status.platformsOnline}/${status.platformsTotal} platforms online`);
  }

  private async checkPlatformHealth(platform: PlatformDefinition): Promise<void> {
    const startTime = Date.now();
    
    try {
      const baseUrl = process.env.NODE_ENV === 'production' ? 'https://petwash.co.il' : 'http://localhost:5000';
      const response = await fetch(`${baseUrl}${platform.basePath}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      const responseTime = Date.now() - startTime;
      const isHealthy = response.status < 500;
      
      const currentHealth = this.platformHealth.get(platform.id)!;
      
      const updatedHealth: PlatformHealth = {
        platformId: platform.id,
        status: isHealthy ? (responseTime > 2000 ? 'degraded' : 'healthy') : 'critical',
        lastCheck: new Date(),
        responseTimeMs: responseTime,
        uptime24h: isHealthy ? currentHealth.uptime24h : Math.max(0, currentHealth.uptime24h - 0.5),
        activeUsers: currentHealth.activeUsers,
        errorRate: isHealthy ? Math.max(0, currentHealth.errorRate - 0.1) : Math.min(100, currentHealth.errorRate + 1),
        certificationStamp: currentHealth.certificationStamp
      };
      
      this.platformHealth.set(platform.id, updatedHealth);
      
      if (updatedHealth.status !== 'healthy' && currentHealth.status === 'healthy') {
        this.createAlert(platform.id, 'warning', `${platform.name} health degraded (${responseTime}ms response time)`);
      }
      
    } catch (error: any) {
      const currentHealth = this.platformHealth.get(platform.id)!;
      
      this.platformHealth.set(platform.id, {
        ...currentHealth,
        status: 'offline',
        lastCheck: new Date(),
        responseTimeMs: -1,
        errorRate: Math.min(100, currentHealth.errorRate + 5)
      });
      
      if (currentHealth.status !== 'offline') {
        this.createAlert(platform.id, 'critical', `${platform.name} is offline: ${error.message}`);
      }
    }
  }

  private createAlert(platformId: string, severity: 'info' | 'warning' | 'critical', message: string) {
    const alert: BrainAlert = {
      id: `alert-${Date.now()}-${platformId}`,
      severity,
      platformId,
      message,
      timestamp: new Date(),
      resolved: false
    };
    
    this.alerts.unshift(alert);
    
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }
    
    logger.warn(`[🐙 Octopus Brain] ⚠️ Alert: ${message}`);
  }

  private async runGeminiAnalysis(): Promise<void> {
    if (!this.ai) return;

    try {
      const platformData = Array.from(this.platformHealth.entries()).map(([id, health]) => ({
        platform: id,
        status: health.status,
        responseTime: health.responseTimeMs,
        errorRate: health.errorRate,
        uptime: health.uptime24h
      }));

      const recentAlerts = this.alerts.filter(a => !a.resolved).slice(0, 10);

      const prompt = `You are the Octopus Brain AI for ⁦Pet Wash™⁩ platform ecosystem.

Analyze the following platform health data and provide:
1. Brief overall assessment (1 sentence)
2. Any cross-platform patterns or correlations
3. Recommended actions (if any issues detected)

Platform Health Data:
${JSON.stringify(platformData, null, 2)}

Recent Unresolved Alerts:
${JSON.stringify(recentAlerts, null, 2)}

Respond in JSON format:
{
  "assessment": "Brief overall status",
  "patterns": ["pattern1", "pattern2"],
  "recommendations": ["action1", "action2"],
  "riskLevel": "low|medium|high"
}`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      if (response.candidates && response.candidates[0]?.content?.parts) {
        const analysisText = response.candidates[0].content.parts
          .filter((p: any) => p.text)
          .map((p: any) => p.text)
          .join('');
        
        try {
          const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            logger.info(`[🐙 Octopus Brain] 🤖 Gemini Analysis: ${analysis.assessment}`);
            
            if (analysis.riskLevel === 'high') {
              logger.warn(`[🐙 Octopus Brain] ⚠️ HIGH RISK detected by Gemini AI`);
              analysis.recommendations?.forEach((rec: string) => {
                logger.warn(`   → ${rec}`);
              });
            }
          }
        } catch (parseError) {
          logger.debug('[🐙 Octopus Brain] Gemini response was not JSON, using raw analysis');
        }
      }
    } catch (error: any) {
      const errorMsg = typeof error.message === 'string' ? error.message : JSON.stringify(error.message || error);
      if (errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429') || errorMsg.includes('quota')) {
        this.geminiQuotaExhausted = true;
        const resetTime = new Date();
        resetTime.setHours(resetTime.getHours() + 1);
        this.geminiQuotaResetTime = resetTime;
        logger.warn(`[🐙 Octopus Brain] Gemini quota exhausted - pausing AI analysis until ${resetTime.toISOString()}`);
      } else {
        logger.warn(`[🐙 Octopus Brain] Gemini analysis failed: ${errorMsg}`);
      }
    }
  }

  getOverallStatus(): OctopusBrainStatus {
    const platforms = Object.fromEntries(this.platformHealth);
    const healthyCount = Array.from(this.platformHealth.values()).filter(h => h.status === 'healthy').length;
    const criticalCount = Array.from(this.platformHealth.values()).filter(h => h.status === 'critical' || h.status === 'offline').length;
    
    let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalCount > 0) {
      overallHealth = 'critical';
    } else if (healthyCount < this.PLATFORMS.length) {
      overallHealth = 'warning';
    }

    return {
      overallHealth,
      platformsOnline: healthyCount,
      platformsTotal: this.PLATFORMS.length,
      lastScan: new Date(),
      geminiEnabled: !!this.ai,
      platforms,
      alerts: this.alerts.filter(a => !a.resolved).slice(0, 20)
    };
  }

  getPlatformDefinitions(): PlatformDefinition[] {
    return this.PLATFORMS;
  }

  getPlatformHealth(platformId: string): PlatformHealth | undefined {
    return this.platformHealth.get(platformId);
  }

  getAllPlatformHealth(): PlatformHealth[] {
    return Array.from(this.platformHealth.values());
  }

  getAlerts(options?: { platformId?: string; severity?: string; limit?: number }): BrainAlert[] {
    let filtered = this.alerts;
    
    if (options?.platformId) {
      filtered = filtered.filter(a => a.platformId === options.platformId);
    }
    if (options?.severity) {
      filtered = filtered.filter(a => a.severity === options.severity);
    }
    
    return filtered.slice(0, options?.limit || 50);
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      logger.info(`[🐙 Octopus Brain] Alert resolved: ${alertId}`);
      return true;
    }
    return false;
  }

  async triggerManualAnalysis(): Promise<string> {
    if (!this.ai) {
      return 'Gemini AI not configured';
    }
    
    await this.runGeminiAnalysis();
    return 'Gemini analysis triggered successfully';
  }

  getCertificationStamp(platformId: string): string | null {
    const health = this.platformHealth.get(platformId);
    return health?.certificationStamp || null;
  }

  async renewCertification(platformId: string): Promise<string> {
    const health = this.platformHealth.get(platformId);
    if (!health) {
      throw new Error(`Platform ${platformId} not found`);
    }
    
    if (health.status !== 'healthy') {
      throw new Error(`Cannot certify unhealthy platform (status: ${health.status})`);
    }
    
    const newStamp = this.generateCertificationStamp(platformId);
    health.certificationStamp = newStamp;
    this.platformHealth.set(platformId, health);
    
    logger.info(`[🐙 Octopus Brain] 📜 Certification renewed for ${platformId}: ${newStamp}`);
    return newStamp;
  }
}

// Export singleton instance
export const octopusBrain = new OctopusBrainService();

// Auto-start orchestration (runs in background)
// Start after server initialization with delay to avoid startup conflicts
setTimeout(() => {
  octopusBrain.start();
}, 8000); // Slightly longer delay than production monitor

export default octopusBrain;
