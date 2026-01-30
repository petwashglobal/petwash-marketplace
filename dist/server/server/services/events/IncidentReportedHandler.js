import { logger } from '../../lib/logger';
import { EmailService } from '../../emailService';
export async function handleIncidentReported(event) {
    const { incidentId, stationId, severity, description, reportedBy } = event.payload;
    logger.warn('[IncidentReportedHandler] Incident reported', {
        eventId: event.id,
        incidentId,
        stationId,
        severity,
        reportedBy,
    });
    try {
        const emailService = new EmailService();
        const alertEmail = process.env.HS_ALERT_EMAIL || 'safety@petwash.co.il';
        const severityEmoji = {
            low: '🟢',
            medium: '🟡',
            high: '🔴',
            critical: '🚨',
        }[severity.toLowerCase()] || '⚠️';
        await emailService.sendEmail({
            to: alertEmail,
            subject: `${severityEmoji} Incident Report - ${severity.toUpperCase()} - Station ${stationId}`,
            html: `
        <h2>${severityEmoji} Incident Report</h2>
        <p><strong>Incident ID:</strong> ${incidentId}</p>
        <p><strong>Station ID:</strong> ${stationId}</p>
        <p><strong>Severity:</strong> ${severity}</p>
        <p><strong>Reported By:</strong> ${reportedBy}</p>
        <p><strong>Time:</strong> ${event.occurredAt}</p>
        <hr>
        <h3>Description:</h3>
        <p>${description}</p>
        <hr>
        <p>Please review and take appropriate action.</p>
      `,
        });
        logger.info('[IncidentReportedHandler] H&S team notified', {
            eventId: event.id,
            incidentId,
            severity,
        });
    }
    catch (error) {
        logger.error('[IncidentReportedHandler] Failed to process incident report', {
            eventId: event.id,
            incidentId,
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
}
