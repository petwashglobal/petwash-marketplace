// Stations Alert Service
// Handles low-stock detection, utility renewals, and Slack/email notifications

import { db } from './firebase-admin';
import { EmailService } from '../emailService';
import { logger } from './logger';
import { sendAlert } from '../monitoring';

interface LowStockItem {
  stationId: string;
  serialNumber: string;
  city: string;
  item: string;
  onHand: number;
  threshold: number;
}

interface ExpiringUtility {
  stationId: string;
  serialNumber: string;
  city: string;
  utilityType: string;
  provider: string;
  renewalDate: Date;
  daysUntilRenewal: number;
}

/**
 * Check all stations for low inventory and send alerts
 * Runs daily at 07:10 Israel time
 */
export async function checkLowStockAlerts(): Promise<void> {
  try {
    logger.info('[Stations] Checking low stock alerts...');
    
    const stationsSnapshot = await db.collection('stations')
      .where('status', 'in', ['active', 'installing'])
      .get();
    
    const lowStockAlerts: LowStockItem[] = [];
    const now = new Date();
    
    for (const stationDoc of stationsSnapshot.docs) {
      const station = stationDoc.data();
      const stationId = stationDoc.id;
      const thresholds = station.thresholds?.minStock || {};
      
      // Check inventory
      const inventoryDoc = await db.collection('station_inventory').doc(stationId).get();
      if (!inventoryDoc.exists) continue;
      
      const inventory = inventoryDoc.data();
      const items = inventory?.items || {};
      
      // Check each item
      for (const item of ['shampoo', 'conditioner', 'disinfectant', 'fragrance']) {
        const onHand = items[item]?.onHand || 0;
        const threshold = thresholds[item] || 0;
        
        if (onHand < threshold) {
          lowStockAlerts.push({
            stationId,
            serialNumber: station.serialNumber,
            city: station.address?.city || 'Unknown',
            item,
            onHand,
            threshold,
          });
          
          // Log event
          await db.collection('station_events').add({
            stationId,
            type: 'low_stock',
            at: now,
            by: 'system',
            data: {
              item,
              onHand,
              threshold,
              severity: onHand === 0 ? 'critical' : onHand < threshold / 2 ? 'high' : 'medium',
            },
          });
        }
      }
    }
    
    if (lowStockAlerts.length > 0) {
      logger.warn(`[Stations] Found ${lowStockAlerts.length} low stock alerts`);
      await sendLowStockNotifications(lowStockAlerts);
    } else {
      logger.info('[Stations] No low stock alerts');
    }
    
  } catch (error) {
    logger.error('[Stations] Error checking low stock', error);
    throw error;
  }
}

/**
 * Check all stations for expiring utility renewals and send alerts
 * Runs daily at 07:20 Israel time
 */
export async function checkUtilityRenewalAlerts(): Promise<void> {
  try {
    logger.info('[Stations] Checking utility renewal alerts...');
    
    const stationsSnapshot = await db.collection('stations')
      .where('status', 'in', ['active', 'installing'])
      .get();
    
    const renewalAlerts: ExpiringUtility[] = [];
    const now = new Date();
    
    for (const stationDoc of stationsSnapshot.docs) {
      const station = stationDoc.data();
      const stationId = stationDoc.id;
      const utilities = station.utilities || {};
      
      // Check each utility type
      for (const [utilityType, utilityData] of Object.entries(utilities) as [string, any][]) {
        if (utilityData?.renewalDate) {
          const renewalDate = utilityData.renewalDate.toDate();
          const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          
          // Alert for renewals within 30, 14, or 7 days
          if (daysUntilRenewal <= 30 && daysUntilRenewal >= 0) {
            renewalAlerts.push({
              stationId,
              serialNumber: station.serialNumber,
              city: station.address?.city || 'Unknown',
              utilityType,
              provider: utilityData.provider || 'Unknown',
              renewalDate,
              daysUntilRenewal,
            });
            
            // Log event (only on specific thresholds)
            if ([7, 14, 30].includes(daysUntilRenewal)) {
              await db.collection('station_events').add({
                stationId,
                type: 'policy_expiring',
                at: now,
                by: 'system',
                data: {
                  utilityType,
                  provider: utilityData.provider,
                  renewalDate: renewalDate.toISOString(),
                  daysUntilRenewal,
                  severity: daysUntilRenewal <= 7 ? 'critical' : daysUntilRenewal <= 14 ? 'high' : 'medium',
                },
              });
            }
          }
        }
      }
    }
    
    if (renewalAlerts.length > 0) {
      logger.warn(`[Stations] Found ${renewalAlerts.length} utility renewal alerts`);
      await sendRenewalNotifications(renewalAlerts);
    } else {
      logger.info('[Stations] No utility renewal alerts');
    }
    
  } catch (error) {
    logger.error('[Stations] Error checking utility renewals', error);
    throw error;
  }
}

/**
 * Send email and Slack notifications for low stock
 */
async function sendLowStockNotifications(alerts: LowStockItem[]): Promise<void> {
  try {
    // Group by station for cleaner reporting
    const stationGroups = alerts.reduce((acc, alert) => {
      const key = alert.stationId;
      if (!acc[key]) {
        acc[key] = { serialNumber: alert.serialNumber, city: alert.city, items: [] };
      }
      acc[key].items.push({ item: alert.item, onHand: alert.onHand, threshold: alert.threshold });
      return acc;
    }, {} as Record<string, any>);
    
    // Build email content
    let emailContent = '<h2>Pet Wash™ Low Stock Alert</h2>';
    emailContent += '<p>The following stations have inventory below minimum thresholds:</p>';
    
    for (const [stationId, group] of Object.entries(stationGroups)) {
      emailContent += `<h3>${group.serialNumber} - ${group.city}</h3><ul>`;
      for (const item of group.items) {
        emailContent += `<li><strong>${item.item.charAt(0).toUpperCase() + item.item.slice(1)}</strong>: ${item.onHand}L (min: ${item.threshold}L)</li>`;
      }
      emailContent += '</ul>';
    }
    
    // Send email
    await EmailService.send({
      to: 'Support@PetWash.co.il',
      subject: `[Pet Wash] Low Stock Alert — ${Object.keys(stationGroups).length} Station(s)`,
      html: emailContent,
    });
    
    // Send Slack notification
    await sendAlert({
      type: 'low_stock_alert',
      severity: 'warning',
      message: `Low Stock Alert: ${alerts.length} items across ${Object.keys(stationGroups).length} stations`,
      details: `🔴 *Low Stock Alert*\n${alerts.length} low stock items across ${Object.keys(stationGroups).length} stations.\nCheck admin panel for details.`
    });
    
    logger.info('[Stations] Low stock notifications sent');
  } catch (error) {
    logger.error('[Stations] Error sending low stock notifications', error);
  }
}

/**
 * Send email and Slack notifications for expiring utilities
 */
async function sendRenewalNotifications(alerts: ExpiringUtility[]): Promise<void> {
  try {
    // Group by days until renewal for prioritization
    const critical = alerts.filter(a => a.daysUntilRenewal <= 7);
    const high = alerts.filter(a => a.daysUntilRenewal > 7 && a.daysUntilRenewal <= 14);
    const medium = alerts.filter(a => a.daysUntilRenewal > 14);
    
    // Build email content
    let emailContent = '<h2>Pet Wash™ Utility Renewal Alert</h2>';
    
    if (critical.length > 0) {
      emailContent += '<h3>🔴 Critical (Expires within 7 days)</h3><ul>';
      for (const alert of critical) {
        emailContent += `<li><strong>${alert.serialNumber}</strong> - ${alert.utilityType} (${alert.provider}) - ${alert.daysUntilRenewal} days</li>`;
      }
      emailContent += '</ul>';
    }
    
    if (high.length > 0) {
      emailContent += '<h3>🟠 High Priority (Expires within 14 days)</h3><ul>';
      for (const alert of high) {
        emailContent += `<li><strong>${alert.serialNumber}</strong> - ${alert.utilityType} (${alert.provider}) - ${alert.daysUntilRenewal} days</li>`;
      }
      emailContent += '</ul>';
    }
    
    if (medium.length > 0) {
      emailContent += '<h3>🟡 Medium Priority (Expires within 30 days)</h3><ul>';
      for (const alert of medium) {
        emailContent += `<li><strong>${alert.serialNumber}</strong> - ${alert.utilityType} (${alert.provider}) - ${alert.daysUntilRenewal} days</li>`;
      }
      emailContent += '</ul>';
    }
    
    // Send email
    await EmailService.send({
      to: 'Support@PetWash.co.il',
      subject: `[Pet Wash] Utility Renewal Alert — ${alerts.length} Upcoming Renewal(s)`,
      html: emailContent,
    });
    
    // Send Slack notification
    await sendAlert({
      type: 'utility_renewal_alert',
      severity: critical.length > 0 ? 'critical' : 'warning',
      message: `Utility Renewal Alert: ${alerts.length} upcoming renewals`,
      details: `⚠️ *Utility Renewal Alert*\n${critical.length} critical, ${high.length} high, ${medium.length} medium priority renewals.\nCheck admin panel for details.`
    });
    
    logger.info('[Stations] Renewal notifications sent');
  } catch (error) {
    logger.error('[Stations] Error sending renewal notifications', error);
  }
}

/**
 * Sync stations data to Google Sheets (placeholder)
 * Runs daily at 07:30 Israel time
 */
export async function syncStationsToGoogleSheets(): Promise<void> {
  try {
    logger.info('[Stations] Google Sheets sync started...');
    
    // TODO: Implement Google Sheets sync with googleapis
    // Will sync 3 tabs: Stations, Inventory, Alerts
    
    logger.warn('[Stations] Google Sheets sync not yet implemented');
  } catch (error) {
    logger.error('[Stations] Error syncing to Google Sheets', error);
  }
}
