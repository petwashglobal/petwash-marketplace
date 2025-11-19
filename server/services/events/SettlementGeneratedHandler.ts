import { DomainEvent, DomainEventType, SettlementGeneratedPayload } from '@shared/events';
import { logger } from '../../lib/logger';
import { EmailService } from '../../emailService';
import { db } from '../../db';
import { franchises } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function handleSettlementGenerated(event: DomainEvent<SettlementGeneratedPayload>): Promise<void> {
  const { settlementId, franchiseId, amount, period } = event.payload;

  logger.info('[SettlementGeneratedHandler] Processing settlement generation', {
    eventId: event.id,
    settlementId,
    franchiseId,
    amount,
    period,
  });

  try {
    const franchise = await db
      .select()
      .from(franchises)
      .where(eq(franchises.id, franchiseId))
      .limit(1);

    if (franchise.length === 0) {
      throw new Error(`Franchise not found: ${franchiseId}`);
    }

    const franchiseData = franchise[0];
    const emailService = new EmailService();
    
    const financeEmail = process.env.FINANCE_EMAIL || 'finance@petwash.co.il';
    const franchiseOwnerEmail = franchiseData.ownerEmail;

    await emailService.sendEmail({
      to: [financeEmail, franchiseOwnerEmail].filter(Boolean).join(','),
      subject: `Settlement Generated - ${franchiseData.name} - ${period}`,
      html: `
        <h2>Settlement Generated</h2>
        <p><strong>Settlement ID:</strong> ${settlementId}</p>
        <p><strong>Franchise:</strong> ${franchiseData.name}</p>
        <p><strong>Franchise ID:</strong> ${franchiseId}</p>
        <p><strong>Period:</strong> ${period}</p>
        <p><strong>Amount:</strong> ₪${amount.toFixed(2)}</p>
        <p><strong>Generated:</strong> ${event.occurredAt}</p>
        <hr>
        <p>This settlement is now pending approval. Please review the details in the finance dashboard.</p>
      `,
    });

    logger.info('[SettlementGeneratedHandler] Finance team and franchise owner notified', {
      eventId: event.id,
      settlementId,
      franchiseId,
    });
  } catch (error: any) {
    logger.error('[SettlementGeneratedHandler] Failed to process settlement generation', {
      eventId: event.id,
      settlementId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
