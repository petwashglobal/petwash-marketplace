/**
 * K9000 Predictive Maintenance Service
 * AI-powered failure prediction for K9000 Twin Dog Wash units
 *
 * Based on user's Python AI maintenance code - adapted for K9000 hardware
 *
 * Hardware Monitoring:
 * - 4 Pumps per bay (Shampoo, Conditioner, Flea Rinse, Disinfectant)
 * - Triple hair filtration system
 * - 2-speed dryers
 * - Hot water units (27amp 3-Phase)
 * - Water pressure sensors
 * - Temperature sensors
 *
 * ZERO COST - Uses existing Nayax telemetry + Email/Slack alerts
 */
import { db } from "../db";
import { nayaxTelemetry, nayaxTransactions } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendSlackAlert } from "../lib/alerts";
// ==================== AI PREDICTIVE MODEL ====================
/**
 * AI Risk Scoring Model
 * Based on user's Python implementation with K9000-specific enhancements
 */
class K9000MaintenancePredictor {
    /**
     * Predict failure risk based on telemetry data
     * @returns Risk score 0.0 (safe) to 1.0 (critical failure imminent)
     */
    predictFailureRisk(data) {
        let riskScore = 0.0;
        // === PUMP & PRESSURE ANALYSIS (User's original logic) ===
        // Low pressure + long pump time = clogged system or pump failure
        if (data.waterPressure < 4.5 && data.pumpRunTime > 180) {
            logger.warn('[K9000 AI] CRITICAL: Low pressure + excessive pump runtime detected');
            return 0.95; // 95% failure risk - URGENT
        }
        // Moderate pressure drop with extended pump time (early warning)
        if (data.waterPressure < 5.0 && data.pumpRunTime > 150) {
            riskScore += 0.4; // Warning level
        }
        // === TEMPERATURE ANALYSIS (User's pattern detection) ===
        // High temp at 50-wash intervals = component wear pattern
        if (data.tempCelsius > 70 && data.washesCount % 50 === 0) {
            logger.warn('[K9000 AI] HIGH: Temperature spike at 50-wash interval');
            return 0.80; // 80% risk - electrical issue likely
        }
        // General overheating (motor or heating element stress)
        if (data.tempCelsius > 65) {
            riskScore += 0.35;
        }
        else if (data.tempCelsius > 55) {
            riskScore += 0.20;
        }
        // === K9000-SPECIFIC PUMP HEALTH ===
        // Check pump efficiency: normal pump should complete in 90-120s
        if (data.pumpRunTime > 160) {
            riskScore += 0.25; // Pump losing efficiency
        }
        // === CHEMICAL LEVEL MONITORING (K9000 4-pump system) ===
        // Critical low levels indicate pump failure or leak
        if (data.shampooLevel < 10 || data.conditionerLevel < 10) {
            riskScore += 0.15; // Needs refill soon
        }
        // === FILTRATION SYSTEM (K9000 Triple Filter) ===
        // High backpressure = clogged filter (Israeli hard water issue)
        if (data.filtrationBackpressure && data.filtrationBackpressure > 25) {
            logger.warn('[K9000 AI] Filter clog detected - hard water buildup likely');
            riskScore += 0.30;
        }
        // === DRYER HEALTH (K9000 2-Speed Dryers) ===
        // Excessive dryer runtime = motor wear or vent blockage
        if (data.dryerRunTime && data.dryerRunTime > 200) {
            riskScore += 0.20;
        }
        // === WEAR PATTERN DETECTION (Predictive) ===
        // Every 100 washes, check for degradation pattern
        if (data.washesCount > 0 && data.washesCount % 100 === 0) {
            // If pressure drops AND runtime increases over cycles = wear trend
            if (data.waterPressure < 5.5 && data.pumpRunTime > 140) {
                riskScore += 0.25;
            }
        }
        // Ensure score stays in 0.0-1.0 range
        return Math.min(riskScore, 1.0);
    }
    /**
     * Determine maintenance alert level
     */
    getAlertLevel(riskScore) {
        if (riskScore >= 0.90)
            return 'critical'; // Imminent failure
        if (riskScore >= 0.70)
            return 'high'; // Failure likely soon
        if (riskScore >= 0.50)
            return 'medium'; // Schedule maintenance
        return 'low'; // Normal operation
    }
}
const predictor = new K9000MaintenancePredictor();
// ==================== TELEMETRY ANALYSIS ====================
/**
 * Analyze K9000 wash data and generate alerts
 * Maps Nayax telemetry to K9000 hardware metrics
 */
export async function analyzeK9000WashData(params) {
    try {
        // Fetch latest telemetry from Nayax
        const latestTelemetry = await db
            .select()
            .from(nayaxTelemetry)
            .where(eq(nayaxTelemetry.terminalId, params.terminalId))
            .orderBy(desc(nayaxTelemetry.createdAt))
            .limit(1);
        if (latestTelemetry.length === 0) {
            logger.info(`[K9000 AI] No telemetry data for terminal ${params.terminalId}`);
            return null;
        }
        const telemetry = latestTelemetry[0];
        // Get wash count from transaction history
        const washHistory = await db
            .select({ count: sql `count(*)::int` })
            .from(nayaxTransactions)
            .where(and(eq(nayaxTransactions.stationId, params.stationId), eq(nayaxTransactions.status, 'settled')));
        const washesCount = washHistory[0]?.count || 0;
        // Map Nayax telemetry to K9000 format
        const k9000Data = {
            waterPressure: parseFloat(telemetry.waterPressure || '6.0'), // Bar
            pumpRunTime: 120, // TODO: Calculate from wash cycle duration
            tempCelsius: parseFloat(telemetry.waterTemp || '40'), // °C
            washesCount,
            shampooLevel: telemetry.shampooLevel || 50,
            conditionerLevel: telemetry.conditionerLevel || 50,
            fleaLevel: 50, // TODO: Add to telemetry schema
            disinfectantLevel: 50, // TODO: Add to telemetry schema
            dryerRunTime: 150, // TODO: Track dryer cycles
            filtrationBackpressure: 15, // TODO: Add pressure sensor
        };
        // Run AI prediction
        const riskScore = predictor.predictFailureRisk(k9000Data);
        const alertLevel = predictor.getAlertLevel(riskScore);
        // Only alert if risk is medium or higher
        if (riskScore < 0.50) {
            logger.info(`[K9000 AI] Station ${params.stationId} healthy (risk: ${riskScore.toFixed(2)})`);
            return null;
        }
        // Generate alert message
        const alert = {
            level: alertLevel,
            riskScore,
            stationId: params.stationId,
            terminalId: params.terminalId,
            telemetryData: k9000Data,
            timestamp: new Date(),
            message: generateAlertMessage(k9000Data, riskScore, 'en'),
            messageHe: generateAlertMessage(k9000Data, riskScore, 'he'),
            recommendedAction: getRecommendedAction(k9000Data, riskScore, 'en'),
            recommendedActionHe: getRecommendedAction(k9000Data, riskScore, 'he'),
        };
        return alert;
    }
    catch (error) {
        logger.error('[K9000 AI] Analysis failed', {
            error: error.message,
            stationId: params.stationId,
            terminalId: params.terminalId,
        });
        return null;
    }
}
/**
 * Generate alert message (bilingual)
 */
function generateAlertMessage(data, riskScore, language) {
    const issues = [];
    // Identify specific issues
    if (data.waterPressure < 4.5) {
        issues.push(language === 'he'
            ? `לחץ מים נמוך: ${data.waterPressure.toFixed(1)} בר`
            : `Low water pressure: ${data.waterPressure.toFixed(1)} bar`);
    }
    if (data.pumpRunTime > 150) {
        issues.push(language === 'he'
            ? `זמן משאבה ארוך: ${data.pumpRunTime} שניות`
            : `Extended pump runtime: ${data.pumpRunTime} seconds`);
    }
    if (data.tempCelsius > 60) {
        issues.push(language === 'he'
            ? `טמפרטורה גבוהה: ${data.tempCelsius}°C`
            : `High temperature: ${data.tempCelsius}°C`);
    }
    if (data.shampooLevel < 15) {
        issues.push(language === 'he'
            ? `שמפו נמוך: ${data.shampooLevel}%`
            : `Low shampoo: ${data.shampooLevel}%`);
    }
    if (data.conditionerLevel < 15) {
        issues.push(language === 'he'
            ? `מרכך נמוך: ${data.conditionerLevel}%`
            : `Low conditioner: ${data.conditionerLevel}%`);
    }
    const issuesList = issues.join(', ');
    if (language === 'he') {
        return `🚨 התרעת תחזוקה K9000 - ציון סיכון: ${(riskScore * 100).toFixed(0)}%\n\n` +
            `בעיות מזוהות: ${issuesList}\n` +
            `סה"כ שטיפות: ${data.washesCount}`;
    }
    else {
        return `🚨 K9000 Maintenance Alert - Risk Score: ${(riskScore * 100).toFixed(0)}%\n\n` +
            `Issues detected: ${issuesList}\n` +
            `Total washes: ${data.washesCount}`;
    }
}
/**
 * Get recommended maintenance action
 */
function getRecommendedAction(data, riskScore, language) {
    if (riskScore >= 0.90) {
        return language === 'he'
            ? '⚠️ פעולה דחופה: הפסק שימוש במכונה והזמן טכנאי מיידית!'
            : '⚠️ URGENT: Stop machine use and call technician immediately!';
    }
    if (riskScore >= 0.70) {
        return language === 'he'
            ? '📞 תזמן תחזוקה תוך 24-48 שעות למניעת כשל'
            : '📞 Schedule maintenance within 24-48 hours to prevent failure';
    }
    if (data.waterPressure < 5.0) {
        return language === 'he'
            ? '🔧 בדוק פילטרים ולחץ מים - סתימה אפשרית'
            : '🔧 Check filters and water pressure - possible clog';
    }
    if (data.shampooLevel < 20 || data.conditionerLevel < 20) {
        return language === 'he'
            ? '🧴 מלא חומרי ניקוי בהקדם'
            : '🧴 Refill cleaning chemicals soon';
    }
    return language === 'he'
        ? '📋 תזמן בדיקה מונעת בשבוע הקרוב'
        : '📋 Schedule preventive check next week';
}
// ==================== ALERT SENDING ====================
/**
 * Send maintenance alert to technician
 * Uses Slack webhooks for critical alerts (ZERO COST)
 */
export async function sendK9000MaintenanceAlert(alert) {
    try {
        const alertMessage = `🚨 K9000 MAINTENANCE ALERT\n\n${alert.messageHe}\n\n${alert.recommendedActionHe}\n\nStation: ${alert.stationId}\nRisk Score: ${(alert.riskScore * 100).toFixed(0)}%\nTime: ${alert.timestamp.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`;
        // Send to Slack for critical/high alerts
        if (alert.level === 'critical' || alert.level === 'high') {
            await sendSlackAlert(alertMessage, alert.level);
        }
        // Always log to console
        console.log('\n' + '='.repeat(50));
        console.log(alertMessage);
        console.log('='.repeat(50) + '\n');
        logger.info('[K9000 AI] Maintenance alert logged', {
            stationId: alert.stationId,
            riskScore: alert.riskScore,
            level: alert.level,
        });
        return true;
    }
    catch (error) {
        logger.error('[K9000 AI] Failed to send alert', {
            error: error.message,
            alert: alert.stationId,
        });
        return false;
    }
}
// ==================== MONITORING SCHEDULER ====================
/**
 * Run predictive maintenance check for all K9000 stations
 * Should be called every 30 minutes via cron job
 */
export async function runK9000HealthCheck() {
    logger.info('[K9000 AI] Starting health check for all stations...');
    try {
        // Get all active stations
        const activeStations = await db
            .select()
            .from(stations)
            .where(eq(stations.isActive, true));
        logger.info(`[K9000 AI] Checking ${activeStations.length} active stations`);
        for (const station of activeStations) {
            // Analyze each station
            const alert = await analyzeK9000WashData({
                stationId: station.id,
                terminalId: station.nayaxTerminalId || 'unknown',
            });
            // Send alert if risk detected
            if (alert && alert.riskScore >= 0.50) {
                await sendK9000MaintenanceAlert(alert);
            }
        }
        logger.info('[K9000 AI] Health check completed');
    }
    catch (error) {
        logger.error('[K9000 AI] Health check failed', {
            error: error.message,
        });
    }
}
export default {
    analyzeK9000WashData,
    sendK9000MaintenanceAlert,
    runK9000HealthCheck,
};
