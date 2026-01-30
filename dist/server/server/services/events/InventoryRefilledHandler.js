import { logger } from '../../lib/logger';
import { EmailService } from '../../emailService';
export async function handleInventoryRefilled(event) {
    const { stationSupplyId, stationId, supplyName, previousLevel, newLevel, amount, refilledBy } = event.payload;
    logger.info('[InventoryRefilledHandler] Inventory refilled event processed', {
        eventId: event.id,
        stationId,
        supplyName,
        previousLevel,
        newLevel,
        amount,
        refilledBy,
    });
    try {
        const emailService = new EmailService();
        const notificationEmail = process.env.INVENTORY_NOTIFICATION_EMAIL || 'operations@petwash.co.il';
        await emailService.sendEmail({
            to: notificationEmail,
            subject: `Inventory Refilled - Station ${stationId}`,
            html: `
        <h2>Inventory Refill Notification</h2>
        <p><strong>Station ID:</strong> ${stationId}</p>
        <p><strong>Supply:</strong> ${supplyName}</p>
        <p><strong>Previous Level:</strong> ${previousLevel}</p>
        <p><strong>Amount Added:</strong> ${amount}</p>
        <p><strong>New Level:</strong> ${newLevel}</p>
        <p><strong>Refilled By:</strong> ${refilledBy}</p>
        <p><strong>Time:</strong> ${event.occurredAt}</p>
        <p>Inventory has been successfully restocked.</p>
      `,
        });
        logger.info('[InventoryRefilledHandler] Refill notification email sent', {
            eventId: event.id,
            stationId,
            supplyName,
        });
    }
    catch (error) {
        logger.error('[InventoryRefilledHandler] Failed to process inventory refilled event', {
            eventId: event.id,
            stationId,
            error: error.message,
            stack: error.stack,
        });
    }
}
