/**
 * Nayax Transaction Monitoring Service
 * Monitors pending transactions, handles timeouts, and sends alerts
 * 
 * Features:
 * - Auto-void stuck transactions after 30 minutes
 * - Monitor offline stations
 * - Alert on settlement failures
 * - Daily transaction reconciliation reports
 */

import { db } from "../db";
import { nayaxTransactions, nayaxTelemetry } from "@shared/schema";
import { eq, and, lt, isNull, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { NayaxSparkService } from "./NayaxSparkService";
import cron from "node-cron";

export class NayaxMonitoringService {
  
  /**
   * Monitor pending transactions and auto-void if stuck
   * Runs every 5 minutes
   */
  static async monitorPendingTransactions(): Promise<void> {
    logger.info('[Nayax Monitor] Checking pending transactions...');

    try {
      // Find transactions stuck in pending states for > 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      const stuckTransactions = await db
        .select()
        .from(nayaxTransactions)
        .where(
          and(
            inArray(nayaxTransactions.status, ['initiated', 'authorized', 'vend_pending']),
            lt(nayaxTransactions.createdAt, thirtyMinutesAgo)
          )
        );

      logger.info(`[Nayax Monitor] Found ${stuckTransactions.length} stuck transactions`);

      for (const transaction of stuckTransactions) {
        try {
          // If authorized but not settled, void it
          if (transaction.nayaxTransactionId && transaction.status === 'authorized') {
            logger.warn('[Nayax Monitor] Auto-voiding stuck authorized transaction', {
              transactionId: transaction.id,
              nayaxTransactionId: transaction.nayaxTransactionId,
            });

            await NayaxSparkService.voidTransaction(transaction.nayaxTransactionId);

            await db.update(nayaxTransactions)
              .set({
                status: 'voided',
                voidedAt: new Date(),
                errorMessage: 'Auto-voided: Transaction timeout (30min)',
              })
              .where(eq(nayaxTransactions.id, transaction.id));
          } else {
            // Mark as failed if never authorized
            await db.update(nayaxTransactions)
              .set({
                status: 'failed',
                failedAt: new Date(),
                errorMessage: 'Transaction timeout: No response from Nayax',
              })
              .where(eq(nayaxTransactions.id, transaction.id));
          }
        } catch (error: any) {
          logger.error('[Nayax Monitor] Failed to void stuck transaction', {
            transactionId: transaction.id,
            error: error.message,
          });
        }
      }

      // Alert if > 5 stuck transactions
      if (stuckTransactions.length > 5) {
        await this.sendSlackAlert({
          level: 'warning',
          message: `⚠️ ${stuckTransactions.length} stuck Nayax transactions detected`,
          details: 'Multiple payment processing issues detected. Check Nayax API connection.',
        });
      }

    } catch (error: any) {
      logger.error('[Nayax Monitor] Monitoring failed', { 
        error: error.message || 'Unknown error',
        errorStack: error.stack,
        errorDetails: JSON.stringify(error, null, 2)
      });
    }
  }

  /**
   * Monitor offline stations
   * Runs every hour
   */
  static async monitorOfflineStations(): Promise<void> {
    logger.info('[Nayax Monitor] Checking offline stations...');

    try {
      // Check all configured terminals
      const NAYAX_TERMINAL_ID_MAIN = process.env.NAYAX_TERMINAL_ID_MAIN;
      const NAYAX_TERMINAL_ID_SECONDARY = process.env.NAYAX_TERMINAL_ID_SECONDARY;

      const terminals: string[] = [];
      if (NAYAX_TERMINAL_ID_MAIN) terminals.push(NAYAX_TERMINAL_ID_MAIN);
      if (NAYAX_TERMINAL_ID_SECONDARY) terminals.push(NAYAX_TERMINAL_ID_SECONDARY);

      const offlineStations: string[] = [];

      for (const terminalId of terminals) {
        try {
          const status = await NayaxSparkService.getMachineStatus(terminalId);

          if (!status.isAvailable || status.state === 'Offline') {
            offlineStations.push(terminalId);
            logger.warn('[Nayax Monitor] Station offline', {
              terminalId,
              state: status.state,
            });
          }
        } catch (error: any) {
          logger.error('[Nayax Monitor] Failed to check station status', {
            terminalId,
            error: error.message,
          });
          offlineStations.push(terminalId);
        }
      }

      // Alert if any stations offline
      if (offlineStations.length > 0) {
        await this.sendSlackAlert({
          level: 'error',
          message: `🔴 ${offlineStations.length} Nayax stations offline`,
          details: `Offline terminals: ${offlineStations.join(', ')}`,
        });
      }

    } catch (error: any) {
      logger.error('[Nayax Monitor] Station monitoring failed', { error: error.message });
    }
  }

  /**
   * Generate daily Nayax transaction report
   * Runs daily at 7 AM Israel time
   */
  static async generateDailyReport(): Promise<void> {
    logger.info('[Nayax Monitor] Generating daily report...');

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all transactions from yesterday
      const transactions = await db
        .select()
        .from(nayaxTransactions)
        .where(
          and(
            lt(nayaxTransactions.createdAt, today),
            lt(yesterday, nayaxTransactions.createdAt)
          )
        );

      const stats = {
        total: transactions.length,
        settled: transactions.filter(t => t.status === 'settled').length,
        voided: transactions.filter(t => t.status === 'voided').length,
        failed: transactions.filter(t => t.status === 'failed').length,
        pending: transactions.filter(t => !['settled', 'voided', 'failed'].includes(t.status)).length,
        totalRevenue: transactions
          .filter(t => t.status === 'settled')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0),
      };

      logger.info('[Nayax Monitor] Daily report generated', stats);

      // Send to Slack
      await this.sendSlackAlert({
        level: 'info',
        message: `📊 Nayax Daily Report (${yesterday.toLocaleDateString('he-IL')})`,
        details: `
Total Transactions: ${stats.total}
✅ Settled: ${stats.settled} (₪${stats.totalRevenue.toFixed(2)})
🔄 Voided: ${stats.voided}
❌ Failed: ${stats.failed}
⏳ Pending: ${stats.pending}
        `.trim(),
      });

    } catch (error: any) {
      logger.error('[Nayax Monitor] Daily report failed', { error: error.message });
    }
  }

  /**
   * Send Slack alert via webhook
   */
  private static async sendSlackAlert(params: {
    level: 'info' | 'warning' | 'error';
    message: string;
    details?: string;
  }): Promise<void> {
    const SLACK_WEBHOOK = process.env.ALERTS_SLACK_WEBHOOK;
    
    if (!SLACK_WEBHOOK) {
      logger.warn('[Nayax Monitor] Slack webhook not configured, skipping alert');
      return;
    }

    const colors: Record<string, string> = {
      info: '#3B82F6',
      warning: '#F59E0B',
      error: '#EF4444',
    };

    try {
      await fetch(SLACK_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [
            {
              color: colors[params.level],
              title: params.message,
              text: params.details || '',
              footer: 'Pet Wash™ Nayax Monitor',
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        }),
      });

      logger.info('[Nayax Monitor] Slack alert sent', { level: params.level });
    } catch (error: any) {
      logger.error('[Nayax Monitor] Failed to send Slack alert', { error: error.message });
    }
  }

  /**
   * Start all monitoring cron jobs
   */
  static startMonitoring(): void {
    logger.info('[Nayax Monitor] Starting monitoring services...');

    // Monitor pending transactions every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.monitorPendingTransactions();
    });

    // Monitor offline stations every hour
    cron.schedule('0 * * * *', async () => {
      await this.monitorOfflineStations();
    });

    // Daily report at 7 AM Israel time (5 AM UTC in summer, 6 AM in winter)
    cron.schedule('0 5 * * *', async () => {
      await this.generateDailyReport();
    });

    logger.info('[Nayax Monitor] Monitoring services started');
    logger.info('  - Pending transactions: Every 5 minutes');
    logger.info('  - Offline stations: Every hour');
    logger.info('  - Daily report: 7 AM Israel time');
  }
}
