/**
 * MONTHLY SETTLEMENTS CRON JOB
 * 
 * Automatically generates revenue sharing settlements for all active partners
 * on the 1st of each month for the previous month's transactions.
 * 
 * Features:
 * - Runs monthly on the 1st at 00:05 (5 minutes after midnight)
 * - Processes all active partners with agreements
 * - Calculates revenue share based on Nayax transactions
 * - Sends email notifications to finance team
 * - Comprehensive error handling and logging
 * 
 * Israeli Business Context:
 * - Municipalities (עיריות)
 * - Shopping centers (קניונים)
 * - Franchise partners (זכיינים)
 * - Gas station chains (תחנות דלק)
 */

import cron from 'node-cron';
import { db } from '../db';
import { partners, partnerAgreements } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { FinanceSettlementService } from '../services/FinanceSettlementService';
import { EmailService } from '../emailService';

/**
 * Generate settlements for all active partners for the previous month
 */
async function generateMonthlySettlements() {
  try {
    logger.info('[MonthlySettlements] Starting automated settlement generation');

    // Calculate previous month's date range
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1); // First day of previous month

    logger.info('[MonthlySettlements] Processing period', {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });

    // 1. Find all active partners
    const activePartners = await db.query.partners.findMany({
      where: eq(partners.isActive, true),
    });

    if (activePartners.length === 0) {
      logger.info('[MonthlySettlements] No active partners found');
      return;
    }

    logger.info('[MonthlySettlements] Found active partners', {
      count: activePartners.length,
    });

    // 2. Filter partners with active agreements
    const partnersWithAgreements = [];
    for (const partner of activePartners) {
      const agreements = await db.query.partnerAgreements.findMany({
        where: and(
          eq(partnerAgreements.partnerId, partner.id),
          eq(partnerAgreements.isActive, true)
        ),
      });

      if (agreements.length > 0) {
        partnersWithAgreements.push({
          partner,
          agreementsCount: agreements.length,
        });
      }
    }

    if (partnersWithAgreements.length === 0) {
      logger.warn('[MonthlySettlements] No partners with active agreements found');
      return;
    }

    logger.info('[MonthlySettlements] Partners with active agreements', {
      count: partnersWithAgreements.length,
    });

    // 3. Generate settlements for each partner
    const settlementResults = await Promise.allSettled(
      partnersWithAgreements.map(async ({ partner, agreementsCount }) => {
        try {
          logger.info('[MonthlySettlements] Generating settlement for partner', {
            partnerId: partner.id,
            partnerName: partner.name,
            partnerType: partner.type,
            agreementsCount,
          });

          const settlement = await FinanceSettlementService.generateSettlement(
            partner.id,
            periodStart,
            periodEnd,
            'monthly'
          );

          logger.info('[MonthlySettlements] Settlement created successfully', {
            partnerId: partner.id,
            partnerName: partner.name,
            settlementNumber: settlement.settlementNumber,
            partnerShare: settlement.partnerShare,
            grossRevenue: settlement.grossRevenue,
          });

          return {
            success: true,
            partner,
            settlement,
          };

        } catch (error) {
          logger.error('[MonthlySettlements] Failed to generate settlement for partner', {
            partnerId: partner.id,
            partnerName: partner.name,
            error: error instanceof Error ? error.message : String(error),
          });

          return {
            success: false,
            partner,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    // 4. Collect results
    const successful = settlementResults.filter(r => 
      r.status === 'fulfilled' && r.value.success
    );
    const failed = settlementResults.filter(r => 
      r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    );

    logger.info('[MonthlySettlements] Batch complete', {
      total: partnersWithAgreements.length,
      successful: successful.length,
      failed: failed.length,
    });

    // 5. Send email notification to finance team
    await sendFinanceTeamNotification({
      periodStart,
      periodEnd,
      totalPartners: partnersWithAgreements.length,
      successful: successful.length,
      failed: failed.length,
      settlements: successful
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value.settlement),
    });

    logger.info('[MonthlySettlements] Process completed successfully');

  } catch (error) {
    logger.error('[MonthlySettlements] Cron job error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Send error notification to finance team
    await sendErrorNotification(error);
  }
}

/**
 * Send email notification to finance team about settlement generation
 */
async function sendFinanceTeamNotification(data: {
  periodStart: Date;
  periodEnd: Date;
  totalPartners: number;
  successful: number;
  failed: number;
  settlements: any[];
}) {
  try {
    const financeEmail = process.env.FINANCE_EMAIL || 'finance@petwash.co.il';

    const emailBody = `
      <h2>Monthly Settlements Generated</h2>
      <p><strong>Period:</strong> ${data.periodStart.toLocaleDateString('he-IL')} - ${data.periodEnd.toLocaleDateString('he-IL')}</p>
      
      <h3>Summary</h3>
      <ul>
        <li>Total Partners Processed: ${data.totalPartners}</li>
        <li>Successful Settlements: ${data.successful}</li>
        <li>Failed Settlements: ${data.failed}</li>
      </ul>

      <h3>Generated Settlements</h3>
      <table border="1" cellpadding="8" cellspacing="0">
        <thead>
          <tr>
            <th>Settlement Number</th>
            <th>Partner</th>
            <th>Gross Revenue</th>
            <th>Partner Share</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.settlements.map(s => `
            <tr>
              <td>${s.settlementNumber}</td>
              <td>${s.partner?.name || 'N/A'}</td>
              <td>₪${s.grossRevenue}</td>
              <td>₪${s.partnerShare}</td>
              <td>${s.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p style="margin-top: 20px;">
        <strong>Next Steps:</strong><br>
        1. Review settlements in the admin dashboard<br>
        2. Approve settlements for payment<br>
        3. Process payments via banking system<br>
        4. Mark settlements as paid after confirmation
      </p>

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated notification from PetWash Settlement System.<br>
        Generated on ${new Date().toLocaleString('he-IL')}
      </p>
    `;

    await EmailService.send({
      to: financeEmail,
      subject: `Monthly Settlements Generated - ${data.periodStart.toLocaleDateString('he-IL')}`,
      html: emailBody,
    });

    logger.info('[MonthlySettlements] Finance team notification sent', {
      to: financeEmail,
    });

  } catch (error) {
    logger.error('[MonthlySettlements] Failed to send finance notification', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Send error notification to finance team
 */
async function sendErrorNotification(error: any) {
  try {
    const financeEmail = process.env.FINANCE_EMAIL || 'finance@petwash.co.il';

    const emailBody = `
      <h2 style="color: red;">Settlement Generation Failed</h2>
      <p><strong>Error occurred during monthly settlement generation</strong></p>
      
      <h3>Error Details</h3>
      <pre style="background: #f4f4f4; padding: 15px; border-radius: 5px;">
${error instanceof Error ? error.message : String(error)}
      </pre>

      <p style="margin-top: 20px;">
        <strong>Required Action:</strong><br>
        1. Check server logs for detailed error information<br>
        2. Verify database connectivity<br>
        3. Manually trigger settlement generation if needed<br>
        4. Contact technical support if issue persists
      </p>

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated error notification from PetWash Settlement System.<br>
        Generated on ${new Date().toLocaleString('he-IL')}
      </p>
    `;

    await EmailService.send({
      to: financeEmail,
      subject: '⚠️ Settlement Generation Error',
      html: emailBody,
    });

    logger.info('[MonthlySettlements] Error notification sent to finance team');

  } catch (notificationError) {
    logger.error('[MonthlySettlements] Failed to send error notification', {
      error: notificationError instanceof Error ? notificationError.message : String(notificationError),
    });
  }
}

/**
 * Initialize monthly settlements cron job
 * 
 * Schedule: 1st of each month at 00:05 (5 minutes after midnight)
 * Cron pattern: "5 0 1 * *"
 * - Minute: 5
 * - Hour: 0 (midnight)
 * - Day of month: 1
 * - Month: * (every month)
 * - Day of week: * (any day)
 */
export function startMonthlySettlementsCron() {
  logger.info('[MonthlySettlements] Initializing monthly settlements cron job');

  // Run on the 1st of each month at 00:05
  cron.schedule('5 0 1 * *', async () => {
    logger.info('[MonthlySettlements] Cron job triggered');
    await generateMonthlySettlements();
  });

  logger.info('[MonthlySettlements] Cron job scheduled successfully (1st of month at 00:05)');
  
  // Manual trigger option for testing (disabled in production)
  if (process.env.NODE_ENV === 'development') {
    logger.info('[MonthlySettlements] Development mode - manual trigger available');
    logger.info('[MonthlySettlements] To manually trigger: Call generateMonthlySettlements()');
  }
}

// Export for manual testing
export { generateMonthlySettlements };

export default startMonthlySettlementsCron;
