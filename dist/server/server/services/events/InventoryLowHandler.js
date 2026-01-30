import { logger } from '../../lib/logger';
import { EmailService } from '../../emailService';
export async function handleInventoryLow(event) {
    const { stationId, itemType, currentLevel, threshold } = event.payload;
    logger.warn('[InventoryLowHandler] Inventory low alert triggered', {
        eventId: event.id,
        stationId,
        itemType,
        currentLevel,
        threshold,
    });
    try {
        const emailService = new EmailService();
        const alertEmail = process.env.INVENTORY_ALERT_EMAIL || 'operations@petwash.co.il';
        await emailService.sendEmail({
            to: alertEmail,
            subject: `Inventory Low Alert - Station ${stationId}`,
            html: `
        <h2>Inventory Low Alert</h2>
        <p><strong>Station ID:</strong> ${stationId}</p>
        <p><strong>Item Type:</strong> ${itemType}</p>
        <p><strong>Current Level:</strong> ${currentLevel}</p>
        <p><strong>Threshold:</strong> ${threshold}</p>
        <p><strong>Time:</strong> ${event.occurredAt}</p>
        <p>Please schedule a refill for this station.</p>
      `,
        });
        logger.info('[InventoryLowHandler] Inventory alert email sent', {
            eventId: event.id,
            stationId,
            itemType,
        });
    }
    catch (error) {
        logger.error('[InventoryLowHandler] Failed to process inventory low alert', {
            eventId: event.id,
            stationId,
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
}
