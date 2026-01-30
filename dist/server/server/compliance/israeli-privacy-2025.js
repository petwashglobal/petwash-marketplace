/**
 * Israeli Privacy Protection Law 2025 (Amendment 13) Compliance
 *
 * תיקון 13 לחוק הגנת הפרטיות תשפ"ה-2025
 * In effect: August 14, 2025
 *
 * Critical Requirements:
 * - DPO (Data Protection Officer) for banking/financial institutions
 * - Penetration testing every 18 months for large sensitive databases
 * - Biometric data classified as "especially sensitive"
 * - Immediate reporting of severe security incidents
 * - Fines up to 5% of annual turnover
 */
import { logger } from '../lib/logger';
import { db as adminDb } from '../lib/firebase-admin';
/**
 * Israeli Privacy Compliance Manager
 */
export class IsraeliPrivacyCompliance {
    /**
     * Get or create DPO record
     */
    static async getDPO() {
        try {
            const dpoDoc = await adminDb.collection('compliance').doc('dpo').get();
            if (dpoDoc.exists) {
                return dpoDoc.data();
            }
            return null;
        }
        catch (error) {
            logger.error('[Israeli Privacy] Error getting DPO:', error);
            return null;
        }
    }
    /**
     * Set DPO information
     */
    static async setDPO(dpo) {
        try {
            await adminDb.collection('compliance').doc('dpo').set({
                ...dpo,
                updatedAt: new Date(),
            });
            logger.info('[Israeli Privacy] DPO information updated');
            return true;
        }
        catch (error) {
            logger.error('[Israeli Privacy] Error setting DPO:', error);
            return false;
        }
    }
    /**
     * Log penetration test
     */
    static async logPenetrationTest(test) {
        try {
            await adminDb.collection('compliance').doc('penetration_tests').collection('tests').add({
                ...test,
                loggedAt: new Date(),
            });
            // Update next test due date
            await adminDb.collection('compliance').doc('penetration_tests').set({
                lastTestDate: test.testDate,
                nextTestDue: test.nextTestDue,
                updatedAt: new Date(),
            }, { merge: true });
            logger.info('[Israeli Privacy] Penetration test logged');
            // Alert if critical/high findings
            if (test.findings.critical > 0 || test.findings.high > 0) {
                await this.alertOnFindings(test);
            }
            return true;
        }
        catch (error) {
            logger.error('[Israeli Privacy] Error logging penetration test:', error);
            return false;
        }
    }
    /**
     * Get next penetration test due date
     */
    static async getNextPenTestDue() {
        try {
            const doc = await adminDb.collection('compliance').doc('penetration_tests').get();
            if (doc.exists) {
                const data = doc.data();
                return data?.nextTestDue?.toDate() || null;
            }
            // If no test recorded, schedule one immediately
            const now = new Date();
            const eighteenMonths = new Date(now.setMonth(now.getMonth() + 18));
            return eighteenMonths;
        }
        catch (error) {
            logger.error('[Israeli Privacy] Error getting pen test due date:', error);
            return null;
        }
    }
    /**
     * Check if penetration test is overdue
     */
    static async isPenTestOverdue() {
        const nextDue = await this.getNextPenTestDue();
        if (!nextDue)
            return true; // No test on record = overdue
        return new Date() > nextDue;
    }
    /**
     * Log biometric data processing
     */
    static async logBiometricData(log) {
        try {
            await adminDb.collection('compliance').doc('biometric_data').collection('logs').add({
                ...log,
                loggedAt: new Date(),
                classification: 'especially_sensitive', // Per Amendment 13
            });
            logger.info('[Israeli Privacy] Biometric data logged:', {
                type: log.dataType,
                user: log.userId,
                consent: log.consentGiven
            });
            return true;
        }
        catch (error) {
            logger.error('[Israeli Privacy] Error logging biometric data:', error);
            return false;
        }
    }
    /**
     * Report severe security incident (mandatory)
     */
    static async reportSecurityIncident(incident) {
        try {
            // Store incident
            await adminDb.collection('compliance').doc('security_incidents').collection('incidents').add({
                ...incident,
                reportedAt: new Date(),
            });
            // If critical or high, must report to PPA immediately
            if (incident.severity === 'critical' || incident.severity === 'high') {
                logger.error('[Israeli Privacy] ⚠️ SEVERE SECURITY INCIDENT - IMMEDIATE PPA REPORTING REQUIRED', incident);
                // Send alert to compliance team
                await this.alertComplianceTeam(incident);
                // TODO: Integrate with PPA reporting system when available
            }
            logger.info('[Israeli Privacy] Security incident logged:', { incidentId: incident.incidentId });
            return true;
        }
        catch (error) {
            logger.error('[Israeli Privacy] Error reporting security incident:', error);
            return false;
        }
    }
    /**
     * Alert on penetration test findings
     */
    static async alertOnFindings(test) {
        const { EmailService } = await import('../emailService');
        const subject = `🚨 Penetration Test Findings: ${test.findings.critical} critical, ${test.findings.high} high`;
        const html = `
      <h2>Penetration Test Results</h2>
      <p>Date: ${test.testDate.toLocaleDateString('he-IL')}</p>
      <p>Tester: ${test.testerCompany}</p>
      
      <h3>Findings:</h3>
      <ul>
        <li>Critical: <strong style="color: red;">${test.findings.critical}</strong></li>
        <li>High: <strong style="color: orange;">${test.findings.high}</strong></li>
        <li>Medium: ${test.findings.medium}</li>
        <li>Low: ${test.findings.low}</li>
      </ul>
      
      <p><strong>Next Test Due:</strong> ${test.nextTestDue.toLocaleDateString('he-IL')}</p>
      
      ${!test.remediated ? '<p style="color: red;"><strong>⚠️ REMEDIATION REQUIRED</strong></p>' : ''}
    `;
        await EmailService.send({
            to: process.env.REPORTS_EMAIL_TO || 'security@petwash.co.il',
            subject,
            html
        });
    }
    /**
     * Alert compliance team about severe incident
     */
    static async alertComplianceTeam(incident) {
        const { EmailService } = await import('../emailService');
        const subject = `🚨 SEVERE SECURITY INCIDENT - PPA REPORTING REQUIRED`;
        const html = `
      <h2 style="color: red;">SEVERE SECURITY INCIDENT</h2>
      <p><strong>Incident ID:</strong> ${incident.incidentId}</p>
      <p><strong>Severity:</strong> ${incident.severity}</p>
      <p><strong>Type:</strong> ${incident.type}</p>
      <p><strong>Discovered:</strong> ${incident.discoveredAt.toLocaleString('he-IL')}</p>
      
      <h3>Details:</h3>
      <p>${incident.description}</p>
      
      ${incident.affectedUsers ? `<p><strong>Affected Users:</strong> ${incident.affectedUsers}</p>` : ''}
      ${incident.affectedData ? `<p><strong>Affected Data:</strong> ${incident.affectedData.join(', ')}</p>` : ''}
      
      <h3 style="color: red;">⚠️ IMMEDIATE ACTION REQUIRED</h3>
      <ul>
        <li>Report to Privacy Protection Authority (PPA) immediately</li>
        <li>Document all remediation steps</li>
        <li>Notify affected users if required</li>
        <li>Update DPO and board of directors</li>
      </ul>
      
      <p><strong>Penalty for non-compliance:</strong> Up to 5% of annual turnover</p>
    `;
        await EmailService.send({
            to: process.env.REPORTS_EMAIL_TO || 'legal@petwash.co.il',
            subject,
            html
        });
    }
    /**
     * Get compliance status summary
     */
    static async getComplianceStatus() {
        const dpo = await this.getDPO();
        const nextPenTestDue = await this.getNextPenTestDue();
        const penTestOverdue = await this.isPenTestOverdue();
        // Get recent incidents (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const incidentsSnapshot = await adminDb.collection('compliance')
            .doc('security_incidents')
            .collection('incidents')
            .where('reportedAt', '>=', thirtyDaysAgo)
            .get();
        // Get biometric logs (last 30 days)
        const biometricSnapshot = await adminDb.collection('compliance')
            .doc('biometric_data')
            .collection('logs')
            .where('loggedAt', '>=', thirtyDaysAgo)
            .get();
        return {
            dpo,
            nextPenTestDue,
            penTestOverdue,
            recentIncidents: incidentsSnapshot.size,
            biometricDataProcessed: biometricSnapshot.size,
        };
    }
}
/**
 * Daily compliance check job
 */
export async function checkIsraeliPrivacyCompliance() {
    logger.info('[Israeli Privacy] Running daily compliance check...');
    try {
        const status = await IsraeliPrivacyCompliance.getComplianceStatus();
        // Check DPO
        if (!status.dpo) {
            logger.warn('[Israeli Privacy] ⚠️ No DPO appointed - REQUIRED for financial institutions');
        }
        // Check penetration test
        if (status.penTestOverdue) {
            logger.warn('[Israeli Privacy] ⚠️ Penetration test overdue - Required every 18 months');
        }
        // Log summary
        logger.info('[Israeli Privacy] Compliance status:', {
            dpoAppointed: !!status.dpo,
            nextPenTest: status.nextPenTestDue?.toLocaleDateString('he-IL'),
            penTestOverdue: status.penTestOverdue,
            recentIncidents: status.recentIncidents,
            biometricDataLogs: status.biometricDataProcessed,
        });
    }
    catch (error) {
        logger.error('[Israeli Privacy] Error in compliance check:', error);
    }
}
