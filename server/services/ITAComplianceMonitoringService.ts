import { logger } from '../lib/logger';
import axios from 'axios';
import IsraeliTaxAPIService from './IsraeliTaxAPIService';

interface ComplianceUpdate {
  type: 'vat_format' | 'invoice_format' | 'threshold_change' | 'regulation_change';
  title: string;
  description: string;
  effectiveDate: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  actionRequired: boolean;
  details?: any;
}

interface FormatChange {
  formatVersion: string;
  formatType: '874' | '835' | 'e-invoice';
  changes: string[];
  effectiveDate: string;
  deprecatedVersion?: string;
}

class ITAComplianceMonitoringService {
  private readonly ITA_COMPLIANCE_API = 'https://api.taxes.gov.il/shaam/production/compliance/updates';
  private readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000;
  private lastCheckTime: number = 0;
  private consecutiveFailures: number = 0;
  private circuitBreakerOpen: boolean = false;
  
  private knownThresholds = {
    b2bElectronicInvoicing: {
      '2025': 25000,
      '2026': 20000,
      '2027': 15000,
      '2028': 0,
    },
    vatRate: 0.18,
  };

  private formatVersions = {
    vat874: '1.0',
    vat835: '2.1',
    electronicInvoice: '1.2',
  };

  async checkForUpdates(): Promise<ComplianceUpdate[]> {
    try {
      // Check circuit breaker
      if (this.circuitBreakerOpen) {
        logger.warn('[ITA Compliance] Circuit breaker is open - skipping check after consecutive failures', {
          consecutiveFailures: this.consecutiveFailures,
        });
        return [];
      }
      
      const now = Date.now();
      if (now - this.lastCheckTime < this.CHECK_INTERVAL) {
        logger.info('[ITA Compliance] Skipping check - last checked recently');
        return [];
      }

      logger.info('[ITA Compliance] Checking for regulatory updates...');

      const updates: ComplianceUpdate[] = [];

      const thresholdUpdates = this.checkThresholdChanges();
      updates.push(...thresholdUpdates);

      const formatUpdates = await this.checkFormatChanges();
      updates.push(...formatUpdates);

      this.lastCheckTime = now;
      
      // Reset failure counter on success
      this.consecutiveFailures = 0;
      this.circuitBreakerOpen = false;

      if (updates.length > 0) {
        logger.warn('[ITA Compliance] ⚠️ Found updates requiring attention', {
          count: updates.length,
          critical: updates.filter(u => u.severity === 'critical').length,
        });
        
        // Send alerts for critical updates
        const criticalUpdates = updates.filter(u => u.severity === 'critical');
        if (criticalUpdates.length > 0) {
          await this.sendComplianceAlert(criticalUpdates);
        }
      } else {
        logger.info('[ITA Compliance] ✅ No compliance updates required');
      }

      return updates;
    } catch (error: any) {
      this.consecutiveFailures++;
      
      logger.error('[ITA Compliance] Failed to check for updates', {
        error: error.message,
        consecutiveFailures: this.consecutiveFailures,
      });
      
      // Open circuit breaker after 3 consecutive failures
      if (this.consecutiveFailures >= 3) {
        this.circuitBreakerOpen = true;
        logger.error('[ITA Compliance] 🔴 Circuit breaker OPENED - too many consecutive failures', {
          consecutiveFailures: this.consecutiveFailures,
        });
        
        await this.sendSystemAlert({
          title: 'ITA Compliance Monitoring System Failure',
          message: `Compliance monitoring has failed ${this.consecutiveFailures} times consecutively. Manual intervention required.`,
          severity: 'critical',
        });
      }
      
      return [];
    }
  }

  private checkThresholdChanges(): ComplianceUpdate[] {
    const updates: ComplianceUpdate[] = [];
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    const currentThreshold = this.knownThresholds.b2bElectronicInvoicing[currentYear.toString() as '2025' | '2026' | '2027' | '2028'];
    const nextThreshold = this.knownThresholds.b2bElectronicInvoicing[nextYear.toString() as '2025' | '2026' | '2027' | '2028'];

    if (nextThreshold !== undefined && nextThreshold !== currentThreshold) {
      const monthsUntilChange = 12 - new Date().getMonth();
      
      updates.push({
        type: 'threshold_change',
        title: 'B2B Electronic Invoicing Threshold Decrease',
        description: `B2B electronic invoicing threshold will decrease from ₪${currentThreshold.toLocaleString()} to ₪${nextThreshold.toLocaleString()} on January 1, ${nextYear}`,
        effectiveDate: `${nextYear}-01-01`,
        severity: monthsUntilChange <= 3 ? 'high' : 'medium',
        actionRequired: true,
        details: {
          currentThreshold,
          nextThreshold,
          monthsRemaining: monthsUntilChange,
        },
      });
    }

    return updates;
  }

  private async checkFormatChanges(): Promise<ComplianceUpdate[]> {
    const updates: ComplianceUpdate[] = [];

    // Only check if ITA API is configured
    if (!IsraeliTaxAPIService.isConfigured()) {
      logger.debug('[ITA Compliance] ITA API not configured - skipping format change check');
      return updates;
    }

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        // Get access token for authenticated request
        const token = await IsraeliTaxAPIService.getAccessToken();
        
        const response = await axios.get(`${this.ITA_COMPLIANCE_API}?type=format`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
          validateStatus: (status) => status < 500,
        });

        if (response.status === 200 && response.data?.updates) {
          const formatUpdates = response.data.updates as FormatChange[];
          
          for (const update of formatUpdates) {
            if (this.isFormatUpdateRequired(update)) {
              updates.push({
                type: 'invoice_format',
                title: `Format Update Required: ${update.formatType.toUpperCase()} v${update.formatVersion}`,
                description: `New version ${update.formatVersion} of ${update.formatType} format available`,
                effectiveDate: update.effectiveDate,
                severity: this.getFormatUpdateSeverity(update),
                actionRequired: true,
                details: update,
              });
            }
          }
          
          // Success - break retry loop
          break;
        } else if (response.status === 404) {
          logger.info('[ITA Compliance] Compliance API endpoint not available yet - using fallback monitoring');
          break;
        }
      } catch (error: any) {
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          logger.warn('[ITA Compliance] Compliance API not reachable - using fallback monitoring');
          break;
        }
        
        logger.error('[ITA Compliance] Format check failed (attempt %d/%d)', attempt, this.MAX_RETRIES, { 
          error: error.message 
        });
        
        // If not the last attempt, wait before retrying
        if (attempt < this.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
        } else {
          // All retries exhausted
          throw error;
        }
      }
    }

    return updates;
  }

  private isFormatUpdateRequired(update: FormatChange): boolean {
    const currentVersion = this.formatVersions[
      update.formatType === '874' ? 'vat874' :
      update.formatType === '835' ? 'vat835' :
      'electronicInvoice'
    ];

    return this.compareVersions(update.formatVersion, currentVersion) > 0;
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }

  private getFormatUpdateSeverity(update: FormatChange): 'critical' | 'high' | 'medium' | 'low' {
    const daysUntilEffective = Math.floor(
      (new Date(update.effectiveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilEffective < 0) return 'critical';
    if (daysUntilEffective <= 30) return 'high';
    if (daysUntilEffective <= 90) return 'medium';
    return 'low';
  }

  async generateComplianceReport(): Promise<{
    currentCompliance: any;
    upcomingChanges: ComplianceUpdate[];
    recommendations: string[];
  }> {
    const updates = await this.checkForUpdates();
    
    const currentYear = new Date().getFullYear();
    const currentThreshold = this.knownThresholds.b2bElectronicInvoicing[currentYear.toString() as '2025' | '2026' | '2027' | '2028'];

    return {
      currentCompliance: {
        vatRate: this.knownThresholds.vatRate,
        b2bElectronicThreshold: currentThreshold,
        formatVersions: this.formatVersions,
        year: currentYear,
      },
      upcomingChanges: updates,
      recommendations: this.generateRecommendations(updates),
    };
  }

  private generateRecommendations(updates: ComplianceUpdate[]): string[] {
    const recommendations: string[] = [];

    const criticalUpdates = updates.filter(u => u.severity === 'critical');
    const highUpdates = updates.filter(u => u.severity === 'high');

    if (criticalUpdates.length > 0) {
      recommendations.push('⚠️ URGENT: There are critical compliance updates that require immediate action.');
      recommendations.push('Review and implement all critical updates within 7 days.');
    }

    if (highUpdates.length > 0) {
      recommendations.push('High-priority updates detected. Plan implementation within 30 days.');
    }

    const thresholdChanges = updates.filter(u => u.type === 'threshold_change');
    if (thresholdChanges.length > 0) {
      recommendations.push('Electronic invoicing thresholds are changing. Prepare systems for lower thresholds.');
      recommendations.push('Review current B2B transaction volumes to estimate impact.');
    }

    const formatChanges = updates.filter(u => u.type === 'invoice_format');
    if (formatChanges.length > 0) {
      recommendations.push('New invoice format versions available. Test integration before effective date.');
      recommendations.push('Update API integration to support latest format specifications.');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ System is compliant with all current Israeli tax regulations.');
      recommendations.push('Continue monitoring for quarterly updates from ITA.');
    }

    return recommendations;
  }

  getKnownRegulations() {
    return {
      electronicInvoicingThresholds: this.knownThresholds.b2bElectronicInvoicing,
      vatRate: this.knownThresholds.vatRate,
      formatVersions: this.formatVersions,
      complianceCheckInterval: this.CHECK_INTERVAL,
      lastCheckTime: this.lastCheckTime > 0 ? new Date(this.lastCheckTime).toISOString() : 'never',
      systemHealth: {
        consecutiveFailures: this.consecutiveFailures,
        circuitBreakerOpen: this.circuitBreakerOpen,
      },
    };
  }
  
  private async sendComplianceAlert(updates: ComplianceUpdate[]) {
    try {
      logger.warn('[ITA Compliance] 🚨 CRITICAL COMPLIANCE ALERT', {
        count: updates.length,
        updates: updates.map(u => ({
          title: u.title,
          severity: u.severity,
          effectiveDate: u.effectiveDate,
        })),
      });
      
      // Send Slack alert if webhook is configured
      const slackWebhook = process.env.ALERTS_SLACK_WEBHOOK;
      if (slackWebhook) {
        await axios.post(slackWebhook, {
          text: '🚨 CRITICAL: Israeli Tax Authority Compliance Updates Detected',
          attachments: updates.map(update => ({
            color: update.severity === 'critical' ? 'danger' : 'warning',
            title: update.title,
            text: update.description,
            fields: [
              { title: 'Severity', value: update.severity.toUpperCase(), short: true },
              { title: 'Effective Date', value: update.effectiveDate, short: true },
              { title: 'Action Required', value: update.actionRequired ? 'YES' : 'NO', short: true },
            ],
          })),
        }, { timeout: 5000 });
      }
    } catch (error: any) {
      logger.error('[ITA Compliance] Failed to send compliance alert', { 
        error: error.message 
      });
    }
  }
  
  private async sendSystemAlert(alert: { title: string; message: string; severity: string }) {
    try {
      logger.error('[ITA Compliance] 🔴 SYSTEM ALERT', alert);
      
      const slackWebhook = process.env.ALERTS_SLACK_WEBHOOK;
      if (slackWebhook) {
        await axios.post(slackWebhook, {
          text: `🔴 ${alert.title}`,
          attachments: [{
            color: 'danger',
            text: alert.message,
            fields: [
              { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
              { title: 'System', value: 'ITA Compliance Monitor', short: true },
            ],
          }],
        }, { timeout: 5000 });
      }
    } catch (error: any) {
      logger.error('[ITA Compliance] Failed to send system alert', { 
        error: error.message 
      });
    }
  }
  
  resetCircuitBreaker() {
    logger.info('[ITA Compliance] Circuit breaker manually reset');
    this.circuitBreakerOpen = false;
    this.consecutiveFailures = 0;
  }
}

export default new ITAComplianceMonitoringService();
