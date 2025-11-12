import cron from 'node-cron';
import { storage } from './storage';
import { EmailService } from './emailService';
import { SmsService } from './smsService';
import { db } from './lib/firebase-admin';
import EscrowService from './services/EscrowService';
import { createBirthdayVoucher, hasBirthdayVoucherThisYear } from './birthdayVoucher';
import { processVaccineReminders } from './vaccineReminder';
import { RevenueReportService } from './revenueReportService';
import { logger } from './lib/logger';
import { recordCronExecution, runDataIntegrityChecks } from './monitoring';
import { AuditLedgerService } from './services/AuditLedgerService';
import { IsraeliVATReclaimService } from './services/IsraeliVATReclaimService';
import { WalletTelemetryService } from './services/WalletTelemetryService';
import { GeminiUpdateAdvisor } from './services/GeminiUpdateAdvisor';
import { startAutoVoidCron } from './cron/auto-void-expired-payments';

export class BackgroundJobProcessor {
  private static jobLocks = new Map<string, boolean>(); // Per-task locking
  private static retryDelays = [1000, 5000, 15000, 60000]; // 1s, 5s, 15s, 1m

  /**
   * Acquire lock for a specific job - prevents overlapping executions
   */
  private static async acquireLock(jobName: string): Promise<boolean> {
    if (this.jobLocks.get(jobName)) {
      logger.warn(`[BackgroundJobs] Job "${jobName}" already running - skipping execution`);
      return false;
    }
    this.jobLocks.set(jobName, true);
    return true;
  }

  /**
   * Release lock for a specific job
   */
  private static releaseLock(jobName: string): void {
    this.jobLocks.set(jobName, false);
  }

  /**
   * Start the background job scheduler
   */
  static start(): void {
    logger.info('Starting background job processor...');

    // Start auto-void cron for expired payment authorizations (every 5 minutes)
    startAutoVoidCron();

    // Process appointment reminders every minute
    cron.schedule('* * * * *', async () => {
      if (await this.acquireLock('appointmentReminders')) {
        try {
          await this.processAppointmentReminders();
        } finally {
          this.releaseLock('appointmentReminders');
        }
      }
    });

    // Check for birthdays daily at 8 AM Israel time
    // Use timezone-aware scheduling to ensure consistent local time
    cron.schedule('0 8 * * *', async () => {
      if (await this.acquireLock('birthdayDiscounts')) {
        try {
          await this.processBirthdayDiscounts();
        } finally {
          this.releaseLock('birthdayDiscounts');
        }
      }
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Vaccine reminders daily at 9 AM Israel time (7 days before due date)
    cron.schedule('0 9 * * *', async () => {
      if (await this.acquireLock('vaccineReminders')) {
        try {
          await this.processVaccineReminders();
        } finally {
          this.releaseLock('vaccineReminders');
        }
      }
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Clean up old logs every hour
    cron.schedule('0 * * * *', async () => {
      await this.cleanupOldLogs();
    });

    // Daily Firestore backup at midnight Israel time
    cron.schedule('0 0 * * *', async () => {
      await this.performDailyBackup();
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Daily revenue report at 9 AM Israel time
    cron.schedule('0 9 * * *', async () => {
      await this.generateDailyRevenueReport();
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Monthly revenue report on 1st of each month at 10 AM Israel time
    cron.schedule('0 10 1 * *', async () => {
      await this.generateMonthlyRevenueReport();
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Monthly VAT declaration (מע״מ) - ENABLED
    // Automatically calculates Output VAT - Input VAT and determines refund eligibility
    // Runs on 1st of each month at 10:30 AM Israel time
    cron.schedule('30 10 1 * *', async () => {
      if (await this.acquireLock('monthlyVATDeclaration')) {
        try {
          await this.generateMonthlyVATDeclaration();
        } finally {
          this.releaseLock('monthlyVATDeclaration');
        }
      }
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Yearly revenue report on January 1st at 11 AM Israel time
    cron.schedule('0 11 1 1 *', async () => {
      await this.generateYearlyRevenueReport();
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Weekly data integrity check on Sunday at midnight Israel time
    cron.schedule('0 0 * * 0', async () => {
      await this.runDataIntegrityCheck();
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Daily observances check at 10 AM Israel time
    cron.schedule('0 10 * * *', async () => {
      await this.processObservances();
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Nayax monitoring DISABLED (configure NAYAX_API_KEY to enable)


    // Smart Monitoring: Update all station statuses every 5 minutes (CORRECTED SPEC)
    // Rules: maintenance > fault > offline(heartbeat>30min) > warning_low_activity > idle > online
    // CRITICAL: Offline is ONLY when heartbeats stop, NOT when transactions stop!
    cron.schedule('*/5 * * * *', async () => {
      if (await this.acquireLock('stationMonitoring')) {
        try {
          const { updateAllStationStatuses, updateAllStationUptime } = await import('./stationsService');
          await updateAllStationStatuses(); // Apply 5-state machine (heartbeat-based)
          await updateAllStationUptime();   // Calculate daily/weekly uptime %
        } catch (error) {
          // Silently handle Firestore errors in background jobs
          logger.debug('[Stations] Status update skipped', { error: error instanceof Error ? error.message : 'Unknown error' });
        } finally {
          this.releaseLock('stationMonitoring');
        }
      }
    });

    // Smart Monitoring: Send reminder emails for offline stations (every hour)
    // Two-tier alerting: First email on offline, then reminders every 6 hours
    cron.schedule('0 * * * *', async () => {
      try {
        const { sendOfflineReminderEmails } = await import('./stationsService');
        await sendOfflineReminderEmails(); // Reminder emails for long-offline stations
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorName = error instanceof Error ? error.constructor.name : 'UnknownError';
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        logger.error('[Stations] Send reminder emails error:', {
          errorName,
          errorMessage,
          errorStack
        });
      }
    });

    // Stations: Low stock alerts at 07:10 Israel time
    cron.schedule('10 7 * * *', async () => {
      try {
        const { checkLowStockAlerts } = await import('./lib/stationsAlertService');
        await checkLowStockAlerts();
      } catch (error) {
        logger.debug('[Stations] Low stock check skipped', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Stations: Utility renewal alerts at 07:20 Israel time
    cron.schedule('20 7 * * *', async () => {
      try {
        const { checkUtilityRenewalAlerts } = await import('./lib/stationsAlertService');
        await checkUtilityRenewalAlerts();
      } catch (error) {
        logger.debug('[Stations] Utility renewal check skipped', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Stations: Google Sheets sync at 07:30 Israel time
    cron.schedule('30 7 * * *', async () => {
      try {
        const { syncStationsToGoogleSheets } = await import('./lib/stationsAlertService');
        await syncStationsToGoogleSheets();
      } catch (error) {
        logger.debug('[Stations] Google Sheets sync skipped', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Weather Notifications: Smart weather alerts for dog walkers, drivers, and wash users
    // Runs every 2 hours with 4-hour user cooldown (not too many notifications!)
    cron.schedule('0 */2 * * *', async () => {
      if (await this.acquireLock('weatherNotifications')) {
        try {
          await this.processWeatherNotifications();
        } catch (error) {
          logger.error('[WeatherNotifications] Failed to process weather notifications', { 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        } finally {
          this.releaseLock('weatherNotifications');
        }
      }
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // GCS Backup: Weekly code backup on Sunday at 2 AM Israel time
    cron.schedule('0 2 * * 0', async () => {
      await this.performWeeklyCodeBackup();
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // GCS Backup: Daily Firestore export to GCS at 1 AM Israel time
    cron.schedule('0 1 * * *', async () => {
      await this.performFirestoreExport();
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Legal Compliance: Check for overdue reviews daily at 8 AM Israel time
    cron.schedule('0 8 * * *', async () => {
      await this.checkLegalCompliance();
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Israeli Government Compliance: Check tax, banking, and regulatory compliance daily at 9 AM Israel time
    cron.schedule('0 9 * * *', async () => {
      await this.checkIsraeliCompliance();
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Security Updates: Check npm, browsers, SSL, and platform security daily at 3 AM Israel time
    cron.schedule('0 3 * * *', async () => {
      await this.checkSecurityUpdates();
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Dependency Updates: Run npm audit weekly on Monday at 4 AM Israel time
    cron.schedule('0 4 * * 1', async () => {
      await this.runDependencyAudit();
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Security Monitoring Cleanup: 7-year data retention cleanup daily at 3 AM Israel time
    cron.schedule('0 3 * * *', async () => {
      if (await this.acquireLock('monitoringCleanup')) {
        try {
          await this.cleanupMonitoringData();
        } finally {
          this.releaseLock('monitoringCleanup');
        }
      }
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Blockchain Audit: Daily Merkle snapshot at 2 AM Israel time
    cron.schedule('0 2 * * *', async () => {
      if (await this.acquireLock('merkleSnapshot')) {
        try {
          logger.info('[Blockchain] Starting daily Merkle snapshot...');
          const result = await AuditLedgerService.createDailySnapshot();
          if (result.success) {
            logger.info('[Blockchain] Merkle snapshot created', {
              date: result.snapshotDate,
              merkleRoot: result.merkleRoot,
              recordCount: result.recordCount,
            });
          } else {
            logger.error('[Blockchain] Merkle snapshot failed', { error: result.error });
          }
        } catch (error) {
          logger.error('[Blockchain] Merkle snapshot error', error);
        } finally {
          this.releaseLock('merkleSnapshot');
        }
      }
    }, {
      timezone: 'Asia/Jerusalem'
    });

    // Wallet Telemetry: Abandonment detection every 2 minutes
    cron.schedule('*/2 * * * *', async () => {
      if (await this.acquireLock('walletTelemetryAbandonment')) {
        try {
          await this.processWalletTelemetryAbandonment();
        } finally {
          this.releaseLock('walletTelemetryAbandonment');
        }
      }
    });

    // Escrow Auto-Release: Check and release expired holds every hour
    cron.schedule('0 * * * *', async () => {
      if (await this.acquireLock('escrowAutoRelease')) {
        try {
          await this.autoReleaseExpiredEscrow();
        } finally {
          this.releaseLock('escrowAutoRelease');
        }
      }
    });

    logger.info('Background job processor started');
    logger.info('Appointment reminders: Every minute');
    logger.info('Birthday discounts: Daily at 8 AM Israel time');
    logger.info('Vaccine reminders: Daily at 9 AM Israel time');
    logger.info('Observances check: Daily at 10 AM Israel time');
    logger.info('Log cleanup: Hourly');
    logger.info('Firestore backup (legacy): Daily at midnight Israel time');
    logger.info('Revenue reports: Daily (9 AM), Monthly (1st @ 10 AM), Yearly (Jan 1 @ 11 AM) Israel time');
    logger.info('Data integrity check: Weekly on Sunday at midnight Israel time');
    logger.info('Nayax monitoring: Pending transactions (every 5min), Inactive stations (hourly)');
    logger.info('Nayax daily report: Daily at 7 AM Israel time');
    logger.info('Smart Monitoring: 5-state machine (every 5min), Offline reminders (hourly, 6hr cadence)');
    logger.info('Stations Management: Low stock (7:10 AM), Utility renewals (7:20 AM), Google Sheets sync (7:30 AM) Israel time');
    logger.info('Weather Notifications: Smart alerts for walkers/drivers/wash users every 2 hours (4hr user cooldown)');
    logger.info('GCS Backups: Code (Sun 2AM), Firestore export (Daily 1AM) Israel time');
    logger.info('Escrow Auto-Release: Hourly check for expired 72-hour holds');
    logger.info('Legal Compliance: Daily review check at 8 AM Israel time');
    logger.info('Israeli Compliance: Tax, banking, regulatory checks daily at 9 AM Israel time');
    logger.info('Security Updates: NPM, browsers, SSL, platform checks daily at 3 AM Israel time');
    logger.info('Dependency Audit: Weekly npm audit on Monday at 4 AM Israel time');
    logger.info('Security Monitoring Cleanup: 7-year data retention cleanup daily at 3 AM Israel time');
    logger.info('Blockchain Audit: Daily Merkle snapshot at 2 AM Israel time');
    logger.info('Wallet Telemetry: Abandonment detection every 2 minutes');
  }

  /**
   * Process due appointment reminders
   */
  private static async processAppointmentReminders(): Promise<void> {
    try {
      // Get all due reminders (pending reminders that need to be sent)
      const dueReminders = await storage.getPendingReminders();
      
      if (dueReminders.length === 0) {
        return;
      }

      logger.info(`Processing ${dueReminders.length} due appointment reminders`);

      for (const reminder of dueReminders) {
        await this.processReminderWithRetry(reminder.id);
      }

    } catch (error) {
      logger.error('Error processing appointment reminders', error);
    }
  }

  /**
   * Process individual reminder with retry logic
   */
  private static async processReminderWithRetry(reminderId: number): Promise<void> {
    try {
      const reminder = await storage.getAppointmentReminder(reminderId);
      if (!reminder || reminder.isCancelled) {
        return;
      }

      // Check if we've exceeded max retries
      if ((reminder.retryCount || 0) >= (reminder.maxRetries || 3)) {
        await storage.updateAppointmentReminder(reminderId, {
          status: 'failed',
          lastError: 'Maximum retry attempts exceeded'
        });
        return;
      }

      // Get customer/user data
      let customerData;
      if (reminder.customerId) {
        customerData = await storage.getCustomer(reminder.customerId);
      } else if (reminder.userId) {
        customerData = await storage.getUser(reminder.userId);
      }

      if (!customerData) {
        await storage.updateAppointmentReminder(reminderId, {
          status: 'failed',
          lastError: 'Customer/user data not found'
        });
        return;
      }

      // Prepare appointment data
      const serviceDetails = reminder.serviceDetails as any;
      const appointmentData = {
        appointmentDate: reminder.appointmentDate,
        appointmentType: reminder.appointmentType,
        serviceType: serviceDetails?.serviceType || 'Pet Wash Service',
        location: serviceDetails?.location || 'Pet Wash™ Station',
        bookingReference: reminder.bookingReference
      };

      let emailSuccess = true;
      let smsSuccess = true;

      // Send email reminder if needed
      if (reminder.reminderType === 'email' || reminder.reminderType === 'both') {
        if (!reminder.emailSent) {
          emailSuccess = await EmailService.sendAppointmentReminder({
            reminderId,
            customerData,
            appointmentData,
            dryRun: false
          });
        }
      }

      // Send SMS reminder if needed
      if (reminder.reminderType === 'sms' || reminder.reminderType === 'both') {
        if (!reminder.smsSent) {
          smsSuccess = await SmsService.sendAppointmentReminder({
            reminderId: String(reminderId),
            customerData,
            appointmentData,
            dryRun: false
          });
        }
      }

      // Update reminder status based on results
      const updates: any = {};
      
      if (emailSuccess && smsSuccess) {
        updates.status = 'sent';
      } else if (!emailSuccess || !smsSuccess) {
        updates.retryCount = (reminder.retryCount || 0) + 1;
        updates.lastError = `Email: ${emailSuccess ? 'success' : 'failed'}, SMS: ${smsSuccess ? 'success' : 'failed'}`;
        
        // Schedule retry with exponential backoff
        const retryDelay = this.retryDelays[Math.min(updates.retryCount - 1, this.retryDelays.length - 1)];
        updates.scheduledSendTime = new Date(Date.now() + retryDelay);
        
        if (updates.retryCount >= (reminder.maxRetries || 3)) {
          updates.status = 'failed';
        }
      }

      await storage.updateAppointmentReminder(reminderId, updates);
      
      // Log the processing (note: storage.logCommunicationActivity may not be implemented)
      // TODO: Implement logCommunicationActivity in storage interface if needed
      logger.info('Appointment reminder processed', {
        reminderId,
        bookingReference: reminder.bookingReference,
        emailSuccess,
        smsSuccess,
        retryCount: updates.retryCount || 0
      });

    } catch (error) {
      logger.error(`Error processing reminder ${reminderId}:`, error);
      
      // Update with error and increment retry count
      await storage.updateAppointmentReminder(reminderId, {
        retryCount: ((await storage.getAppointmentReminder(reminderId))?.retryCount || 0) + 1,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        scheduledSendTime: new Date(Date.now() + 60000) // Retry in 1 minute
      });
    }
  }

  /**
   * Process birthday discounts (check for birthdays and send emails)
   */
  private static async processBirthdayDiscounts(): Promise<void> {
    const jobName = 'Birthday Coupon Job';
    try {
      logger.info('Checking for birthdays...');
      
      const today = new Date();
      const todayMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
      const todayDay = today.getDate();
      const currentYear = today.getFullYear();
      
      // Query Firestore for users with birthdays today
      // We need to get all users and filter by birthday because Firestore doesn't support
      // querying on extracted date parts directly
      const usersSnapshot = await db.collection('users').get();
      
      let birthdaysFound = 0;
      let emailsSent = 0;
      let errors = 0;
      
      for (const userDoc of usersSnapshot.docs) {
        try {
          const uid = userDoc.id;
          
          // Get user profile with date of birth
          const profileDoc = await db
            .collection('users')
            .doc(uid)
            .collection('profile')
            .doc('data')
            .get();
          
          if (!profileDoc.exists) {
            continue;
          }
          
          const profileData = profileDoc.data();
          const dobString = profileData?.dateOfBirth || profileData?.dob;
          
          if (!dobString) {
            continue;
          }
          
          // Parse date of birth (YYYY-MM-DD string) without timezone conversion
          const dobMatch = dobString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (!dobMatch) {
            continue; // Invalid format, skip
          }
          
          const birthMonth = parseInt(dobMatch[2], 10); // Already 1-12
          const birthDay = parseInt(dobMatch[3], 10);
          
          // Check if today is the birthday
          if (birthMonth === todayMonth && birthDay === todayDay) {
            birthdaysFound++;
            logger.info(`Birthday found: ${profileData?.email || uid} (${profileData?.petName || 'Pet'})`);
            
            // Check if voucher already issued this year
            // Note: This will throw on Firestore errors to prevent duplicate issuance
            let hasVoucher;
            try {
              hasVoucher = await hasBirthdayVoucherThisYear(uid, currentYear);
            } catch (checkError) {
              errors++;
              logger.error(`Failed to check voucher status for ${uid}, skipping to prevent duplicates:`, checkError);
              continue; // Skip this user if we can't verify voucher status
            }
            
            if (hasVoucher) {
              logger.info(`⏭Birthday voucher already issued for ${uid} in ${currentYear}`);
              continue;
            }
            
            // Create birthday voucher
            const voucher = await createBirthdayVoucher(
              uid,
              profileData?.email || '',
              currentYear,
              profileData?.petName || profileData?.dogName
            );
            
            // Send birthday email
            const emailSent = await EmailService.sendBirthdayDiscount({
              email: profileData?.email || '',
              firstName: profileData?.firstName || profileData?.name,
              dogName: profileData?.petName || profileData?.dogName,
              voucherCode: voucher.code,
              expiresAt: voucher.expiresAt,
              language: profileData?.language || 'he'
            });
            
            if (emailSent) {
              emailsSent++;
              logger.info(`Birthday email sent to ${profileData?.email}: ${voucher.code}`);
              
              // Mark voucher as issued in user profile
              await db
                .collection('users')
                .doc(uid)
                .collection('profile')
                .doc('data')
                .update({
                  lastBirthdayVoucherYear: currentYear,
                  lastBirthdayVoucherCode: voucher.code,
                  lastBirthdayVoucherSent: new Date().toISOString()
                });
            } else {
              errors++;
              logger.error(`Failed to send birthday email to ${profileData?.email}`);
            }
          }
        } catch (error) {
          errors++;
          logger.error('Error processing birthday for user', { error, userId: userDoc.id });
        }
      }
      
      logger.info(`Birthday processing complete: ${birthdaysFound} birthdays found, ${emailsSent} emails sent, ${errors} errors`);
      
      // Record successful execution (even if some emails failed)
      await recordCronExecution(jobName, true);
      
    } catch (error) {
      logger.error('Error processing birthday discounts', error);
      // Record failure
      await recordCronExecution(
        jobName, 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Run weekly data integrity checks
   */
  private static async runDataIntegrityCheck(): Promise<void> {
    const jobName = 'Data Integrity Check';
    try {
      logger.info('Starting data integrity check...');
      const result = await runDataIntegrityChecks();
      logger.info(`Data integrity check complete: ${result.overallStatus}`, {
        checks: result.checks.length,
        passed: result.checks.filter(c => c.passed).length,
        failed: result.checks.filter(c => !c.passed).length
      });
      
      // Record execution (success if no critical issues)
      await recordCronExecution(
        jobName, 
        result.overallStatus !== 'critical',
        result.overallStatus === 'critical' 
          ? `Critical issues found: ${result.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`
          : undefined
      );
    } catch (error) {
      logger.error('Error running data integrity check', error);
      // Record failure
      await recordCronExecution(
        jobName, 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Process daily observances (pet holidays & events)
   */
  private static async processObservances(): Promise<void> {
    const jobName = 'Observances Processing';
    try {
      logger.info('Starting observances processing...');
      const { processAllObservances } = await import('./observanceEvaluator');
      const result = await processAllObservances();
      logger.info(`Observances processing complete: ${result.totalSent} sent, ${result.totalErrors} errors, ${result.totalSkipped} skipped`);
      
      // Record successful execution
      await recordCronExecution(jobName, true);
    } catch (error) {
      logger.error('Error processing observances', error);
      // Record failure
      await recordCronExecution(
        jobName, 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Process vaccine reminders (7 days before due date)
   */
  private static async processVaccineReminders(): Promise<void> {
    const jobName = 'Vaccine Reminder Job';
    try {
      logger.info('Starting vaccine reminder process...');
      const result = await processVaccineReminders();
      logger.info(`Vaccine reminders complete: ${result.remindersSent} sent, ${result.errors} errors`);
      
      // Record successful execution
      await recordCronExecution(jobName, true);
    } catch (error) {
      logger.error('Error processing vaccine reminders', error);
      // Record failure
      await recordCronExecution(
        jobName, 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Clean up old communication logs and activities
   */
  private static async cleanupOldLogs(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Note: In a real implementation, you'd add cleanup methods to storage
      // This is a placeholder for log cleanup logic
      logger.info('Cleaning up logs older than 30 days...');
      
      // TODO: Implement log cleanup methods in storage
      // await storage.cleanupOldCommunicationLogs(thirtyDaysAgo);
      // await storage.cleanupOldAdminActivityLogs(thirtyDaysAgo);
      
    } catch (error) {
      logger.error('Error cleaning up old logs', error);
    }
  }

  /**
   * Perform daily Firestore backup - each collection stored in separate documents
   */
  private static async performDailyBackup(): Promise<void> {
    // Hoist backupId/backupRef outside try/catch for proper error handling
    const timestamp = new Date().toISOString();
    const backupId = `${new Date().toISOString().split('T')[0]}_${Date.now()}`;
    const backupRef = db.collection('system_backups').doc(backupId);
    
    try {
      logger.info('Starting daily Firestore backup...');
      
      // Create backup metadata document
      await backupRef.set({
        timestamp,
        backupId,
        status: 'in_progress',
        collections: [],
        startedAt: new Date().toISOString(),
        version: '2.0'
      });
      
      const collectionNames: string[] = [];
      const errors: string[] = [];
      let totalDocuments = 0;
      
      // Backup user profiles - each user in separate document to avoid size limit
      try {
        const usersSnapshot = await db.collection('users').get();
        const userChunks: any[][] = [];
        const CHUNK_SIZE = 50; // 50 users per document to stay under 1 MiB
        
        for (let i = 0; i < usersSnapshot.docs.length; i += CHUNK_SIZE) {
          const chunk = usersSnapshot.docs.slice(i, i + CHUNK_SIZE);
          const users: any[] = [];
          
          for (const userDoc of chunk) {
            const uid = userDoc.id;
            const userData = userDoc.data();
            
            // Get profile subcollection
            const profileDoc = await db
              .collection('users')
              .doc(uid)
              .collection('profile')
              .doc('data')
              .get();
            
            users.push({
              uid,
              ...userData,
              profile: profileDoc.exists ? profileDoc.data() : null
            });
          }
          
          userChunks.push(users);
        }
        
        // Save each chunk as separate document
        for (let i = 0; i < userChunks.length; i++) {
          await backupRef
            .collection('collections')
            .doc(`users_chunk_${i}`)
            .set({
              collection: 'users',
              chunkIndex: i,
              totalChunks: userChunks.length,
              data: userChunks[i],
              count: userChunks[i].length,
              timestamp
            });
        }
        
        totalDocuments += usersSnapshot.docs.length;
        collectionNames.push('users');
        logger.info(`Backed up ${usersSnapshot.docs.length} user profiles (${userChunks.length} chunks)`);
      } catch (error) {
        const errorMsg = `Users backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
      
      // Backup KYC documents metadata
      try {
        const kycSnapshot = await db.collection('kyc').get();
        const kyc = kycSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        await backupRef.collection('collections').doc('kyc').set({
          collection: 'kyc',
          data: kyc,
          count: kyc.length,
          timestamp
        });
        
        totalDocuments += kyc.length;
        collectionNames.push('kyc');
        logger.info(`Backed up ${kyc.length} KYC records`);
      } catch (error) {
        const errorMsg = `KYC backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
      
      // Backup birthday vouchers
      try {
        const vouchersSnapshot = await db.collection('birthday_vouchers').get();
        const vouchers = vouchersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        await backupRef.collection('collections').doc('birthday_vouchers').set({
          collection: 'birthday_vouchers',
          data: vouchers,
          count: vouchers.length,
          timestamp
        });
        
        totalDocuments += vouchers.length;
        collectionNames.push('birthday_vouchers');
        logger.info(`Backed up ${vouchers.length} birthday vouchers`);
      } catch (error) {
        const errorMsg = `Vouchers backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
      
      // Backup CRM email templates
      try {
        const templatesSnapshot = await db.collection('crm_email_templates').get();
        const templates = templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        await backupRef.collection('collections').doc('crm_email_templates').set({
          collection: 'crm_email_templates',
          data: templates,
          count: templates.length,
          timestamp
        });
        
        totalDocuments += templates.length;
        collectionNames.push('crm_email_templates');
        logger.info(`Backed up ${templates.length} email templates`);
      } catch (error) {
        const errorMsg = `Templates backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
      
      // Backup Nayax transactions
      try {
        const nayaxTransSnapshot = await db.collection('nayax_transactions').get();
        const nayaxTrans = nayaxTransSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        await backupRef.collection('collections').doc('nayax_transactions').set({
          collection: 'nayax_transactions',
          data: nayaxTrans,
          count: nayaxTrans.length,
          timestamp
        });
        
        totalDocuments += nayaxTrans.length;
        collectionNames.push('nayax_transactions');
        logger.info(`Backed up ${nayaxTrans.length} Nayax transactions`);
      } catch (error) {
        const errorMsg = `Nayax transactions backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
      
      // Backup Nayax vouchers
      try {
        const nayaxVouchersSnapshot = await db.collection('nayax_vouchers').get();
        const nayaxVouchers = nayaxVouchersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        await backupRef.collection('collections').doc('nayax_vouchers').set({
          collection: 'nayax_vouchers',
          data: nayaxVouchers,
          count: nayaxVouchers.length,
          timestamp
        });
        
        totalDocuments += nayaxVouchers.length;
        collectionNames.push('nayax_vouchers');
        logger.info(`Backed up ${nayaxVouchers.length} Nayax vouchers`);
      } catch (error) {
        const errorMsg = `Nayax vouchers backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
      
      // Backup Nayax webhook events
      try {
        const nayaxWebhooksSnapshot = await db.collection('nayax_webhook_events').get();
        const nayaxWebhooks = nayaxWebhooksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        await backupRef.collection('collections').doc('nayax_webhook_events').set({
          collection: 'nayax_webhook_events',
          data: nayaxWebhooks,
          count: nayaxWebhooks.length,
          timestamp
        });
        
        totalDocuments += nayaxWebhooks.length;
        collectionNames.push('nayax_webhook_events');
        logger.info(`Backed up ${nayaxWebhooks.length} Nayax webhook events`);
      } catch (error) {
        const errorMsg = `Nayax webhook events backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
      
      // Backup Nayax terminals
      try {
        const nayaxTerminalsSnapshot = await db.collection('nayax_terminals').get();
        const nayaxTerminals = nayaxTerminalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        await backupRef.collection('collections').doc('nayax_terminals').set({
          collection: 'nayax_terminals',
          data: nayaxTerminals,
          count: nayaxTerminals.length,
          timestamp
        });
        
        totalDocuments += nayaxTerminals.length;
        collectionNames.push('nayax_terminals');
        logger.info(`Backed up ${nayaxTerminals.length} Nayax terminals`);
      } catch (error) {
        const errorMsg = `Nayax terminals backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
      
      // Determine final status based on errors
      if (errors.length > 0) {
        // Partial or complete failure
        await backupRef.update({
          status: collectionNames.length > 0 ? 'partial' : 'failed',
          collections: collectionNames,
          totalDocuments,
          errors,
          errorCount: errors.length,
          completedAt: new Date().toISOString()
        });
        logger.info(`️ Backup completed with ${errors.length} error(s): ${backupId}`);
      } else {
        // Complete success
        await backupRef.update({
          status: 'completed',
          collections: collectionNames,
          totalDocuments,
          completedAt: new Date().toISOString()
        });
      }
      
      logger.info(`Daily backup completed: ${backupId} (${totalDocuments} documents)`);
      
      // Clean up backups older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffTimestamp = thirtyDaysAgo.toISOString();
      
      const oldBackupsSnapshot = await db
        .collection('system_backups')
        .where('timestamp', '<', cutoffTimestamp)
        .get();
      
      let deletedCount = 0;
      for (const doc of oldBackupsSnapshot.docs) {
        // Delete backup and all subcollections
        const collectionsSnapshot = await doc.ref.collection('collections').get();
        for (const collDoc of collectionsSnapshot.docs) {
          await collDoc.ref.delete();
        }
        await doc.ref.delete();
        deletedCount++;
      }
      
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old backups (>30 days)`);
      }
      
      logger.info('Daily backup completed successfully');
      
    } catch (error) {
      logger.error('Error performing daily backup', error);
      
      // Mark backup as failed using the SAME backupRef from try block
      try {
        await backupRef.update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date().toISOString()
        });
        logger.info(`Backup ${backupId} marked as failed`);
      } catch (updateError) {
        logger.error('Failed to update backup status', updateError);
        // Last resort: create a new error document
        try {
          await db.collection('system_backups').doc(`${backupId}_error`).set({
            originalBackupId: backupId,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: new Date().toISOString(),
            note: 'Original backup document could not be updated'
          });
        } catch (finalError) {
          logger.error('Critical: Could not record backup failure', finalError);
        }
      }
    }
  }

  /**
   * Process manual reminder trigger (for testing/manual execution)
   */
  static async triggerReminderProcess(): Promise<{ processed: number; errors: number }> {
    const dueReminders = await storage.getPendingReminders();
    let processed = 0;
    let errors = 0;

    for (const reminder of dueReminders) {
      try {
        await this.processReminderWithRetry(reminder.id);
        processed++;
      } catch (error) {
        errors++;
        logger.error(`Failed to process reminder ${reminder.id}:`, error);
      }
    }

    return { processed, errors };
  }

  /**
   * Get processing status and stats
   */
  static async getStatus(): Promise<{
    pendingReminders: number;
    nextScheduledRun: string;
  }> {
    const dueReminders = await storage.getPendingReminders();
    
    return {
      pendingReminders: dueReminders.length,
      nextScheduledRun: new Date(Date.now() + 60000).toISOString() // Next minute
    };
  }

  /**
   * Manual trigger for birthday processing (for testing)
   */
  static async triggerBirthdayProcess(): Promise<{ 
    birthdaysFound: number; 
    emailsSent: number; 
    errors: number;
  }> {
    logger.info('Manual birthday process triggered...');
    await this.processBirthdayDiscounts();
    
    // Return summary (would need to modify processBirthdayDiscounts to return data)
    return {
      birthdaysFound: 0,
      emailsSent: 0,
      errors: 0
    };
  }

  /**
   * Manual trigger for backup (for testing/immediate backup)
   */
  static async triggerBackup(): Promise<{ 
    success: boolean; 
    timestamp: string;
    message: string;
  }> {
    try {
      logger.info('Manual backup triggered...');
      await this.performDailyBackup();
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        message: 'Backup completed successfully'
      };
    } catch (error) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test reminder sending without actually sending
   */
  static async testReminder(reminderId: number): Promise<{
    emailResult?: any;
    smsResult?: any;
    customerData?: any;
    appointmentData?: any;
  }> {
    const reminder = await storage.getAppointmentReminder(reminderId);
    if (!reminder) {
      throw new Error('Reminder not found');
    }

    // Get customer/user data
    let customerData;
    if (reminder.customerId) {
      customerData = await storage.getCustomer(reminder.customerId);
    } else if (reminder.userId) {
      customerData = await storage.getUser(reminder.userId);
    }

    if (!customerData) {
      throw new Error('Customer/user data not found');
    }

    // Prepare appointment data
    const serviceDetails = reminder.serviceDetails as any;
    const appointmentData = {
      appointmentDate: reminder.appointmentDate,
      appointmentType: reminder.appointmentType,
      serviceType: serviceDetails?.serviceType || 'Pet Wash Service',
      location: serviceDetails?.location || 'Pet Wash™ Station',
      bookingReference: reminder.bookingReference
    };

    const results: any = { customerData, appointmentData };

    // Test email reminder
    if (reminder.reminderType === 'email' || reminder.reminderType === 'both') {
      results.emailResult = await EmailService.sendAppointmentReminder({
        reminderId,
        customerData,
        appointmentData,
        dryRun: true // Test mode
      });
    }

    // Test SMS reminder
    if (reminder.reminderType === 'sms' || reminder.reminderType === 'both') {
      results.smsResult = await SmsService.sendAppointmentReminder({
        reminderId: String(reminderId),
        customerData,
        appointmentData,
        dryRun: true // Test mode
      });
    }

    return results;
  }

  /**
   * Generate and send daily revenue report
   */
  private static async generateDailyRevenueReport(): Promise<void> {
    try {
      logger.info('Generating daily revenue report...');
      
      // Get yesterday's data (report runs at 9 AM for previous day)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const period = RevenueReportService.getReportPeriod('daily', yesterday);
      const data = await RevenueReportService.generateRevenueData(period);
      
      // Generate reports
      const excelBuffer = await RevenueReportService.generateExcelReport(period, data);
      const pdfBuffer = await RevenueReportService.generatePDFReport(period, data);
      const csvContent = await RevenueReportService.generateCSVReport(period, data);
      
      // Save to disk
      const paths = await RevenueReportService.saveReports(period, excelBuffer, pdfBuffer, csvContent);
      logger.info('Daily reports saved:', paths);
      
      // Send via email
      const periodStr = period.startDate.toLocaleDateString('he-IL');
      await EmailService.sendRevenueReport(
        'daily',
        periodStr,
        excelBuffer,
        pdfBuffer,
        csvContent,
        { totalRevenue: data.totalRevenue, totalTransactions: data.totalTransactions }
      );
      
      logger.info(`Daily revenue report completed for ${periodStr}`);
    } catch (error) {
      logger.error('Failed to generate daily revenue report', error);
    }
  }

  /**
   * Generate and send monthly revenue report
   */
  private static async generateMonthlyRevenueReport(): Promise<void> {
    try {
      logger.info('Generating monthly revenue report...');
      
      // Get last month's data
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      
      const period = RevenueReportService.getReportPeriod('monthly', lastMonth);
      const data = await RevenueReportService.generateRevenueData(period);
      
      // Generate reports
      const excelBuffer = await RevenueReportService.generateExcelReport(period, data);
      const pdfBuffer = await RevenueReportService.generatePDFReport(period, data);
      const csvContent = await RevenueReportService.generateCSVReport(period, data);
      
      // Save to disk
      const paths = await RevenueReportService.saveReports(period, excelBuffer, pdfBuffer, csvContent);
      logger.info('Monthly reports saved:', paths);
      
      // Send via email
      const periodStr = `${lastMonth.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}`;
      await EmailService.sendRevenueReport(
        'monthly',
        periodStr,
        excelBuffer,
        pdfBuffer,
        csvContent,
        { totalRevenue: data.totalRevenue, totalTransactions: data.totalTransactions }
      );
      
      logger.info(`Monthly revenue report completed for ${periodStr}`);
    } catch (error) {
      logger.error('Failed to generate monthly revenue report', error);
    }
  }

  /**
   * Generate and send yearly revenue report
   */
  private static async generateYearlyRevenueReport(): Promise<void> {
    try {
      logger.info('Generating yearly revenue report...');
      
      // Get last year's data
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      
      const period = RevenueReportService.getReportPeriod('yearly', lastYear);
      const data = await RevenueReportService.generateRevenueData(period);
      
      // Generate reports
      const excelBuffer = await RevenueReportService.generateExcelReport(period, data);
      const pdfBuffer = await RevenueReportService.generatePDFReport(period, data);
      const csvContent = await RevenueReportService.generateCSVReport(period, data);
      
      // Save to disk
      const paths = await RevenueReportService.saveReports(period, excelBuffer, pdfBuffer, csvContent);
      logger.info('Yearly reports saved:', paths);
      
      // Send via email
      const periodStr = String(lastYear.getFullYear());
      await EmailService.sendRevenueReport(
        'yearly',
        periodStr,
        excelBuffer,
        pdfBuffer,
        csvContent,
        { totalRevenue: data.totalRevenue, totalTransactions: data.totalTransactions }
      );
      
      logger.info(`Yearly revenue report completed for ${periodStr}`);
    } catch (error) {
      logger.error('Failed to generate yearly revenue report', error);
    }
  }

  /**
   * Generate monthly VAT declaration (מע״מ) automatically
   * Calculates: Output VAT (from sales) - Input VAT (from expenses)
   * Determines: Payment due or refund eligible
   */
  private static async generateMonthlyVATDeclaration(): Promise<void> {
    try {
      logger.info('[VAT Reclaim] Generating automatic monthly VAT declaration...');
      
      // Get previous month
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = previousMonth.getFullYear();
      const month = previousMonth.getMonth() + 1;
      
      logger.info(`[VAT Reclaim] Processing ${year}-${month.toString().padStart(2, '0')}`);
      
      // Generate VAT declaration using reclaim service
      const declarationId = await IsraeliVATReclaimService.generateMonthlyDeclaration(year, month);
      
      // Get the created declaration to log details
      const { db: pgDb } = await import('./db');
      const { israeliVatDeclarations } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const [declaration] = await pgDb.select()
        .from(israeliVatDeclarations)
        .where(eq(israeliVatDeclarations.id, declarationId));
      
      // Log results
      const netVAT = declaration.netVatPosition;
      const outputVAT = declaration.outputVat;
      const inputVAT = declaration.inputVat;
      
      if (netVAT > 0) {
        logger.info(`[VAT Reclaim] ✅ Declaration generated: ${declaration.declarationId}`);
        logger.info(`[VAT Reclaim] 💳 Payment due to tax authority: ₪${declaration.vatToPay}`);
      } else if (netVAT < 0) {
        logger.info(`[VAT Reclaim] ✅ Declaration generated: ${declaration.declarationId}`);
        logger.info(`[VAT Reclaim] 💰 Refund eligible from tax authority: ₪${declaration.vatToReclaim}`);
      } else {
        logger.info(`[VAT Reclaim] ✅ Declaration generated: ${declaration.declarationId}`);
        logger.info(`[VAT Reclaim] ⚖️ VAT position balanced - no payment or refund`);
      }
      
      logger.info(`[VAT Reclaim] 📊 Output VAT (collected): ₪${outputVAT} | Input VAT (paid): ₪${inputVAT}`);
      
      // Send notification to CEO/CFO
      try {
        await EmailService.sendVATDeclarationNotification({
          declarationId: declaration.declarationId,
          year,
          month,
          outputVAT: parseFloat(outputVAT),
          inputVAT: parseFloat(inputVAT),
          netVAT: parseFloat(netVAT),
          status: netVAT > 0 ? 'payment_due' : netVAT < 0 ? 'refund_due' : 'balanced'
        });
        logger.info('[VAT Reclaim] 📧 CEO/CFO notification sent successfully');
      } catch (notificationError) {
        logger.error('[VAT Reclaim] Failed to send CEO/CFO notification:', notificationError);
        // Don't throw - declaration was created successfully
      }
      
    } catch (error) {
      logger.error('[VAT Reclaim] Error generating monthly VAT declaration:', error);
    }
  }

  /**
   * Manual report generation (for admin use)
   */
  static async generateManualReport(
    type: 'daily' | 'monthly' | 'yearly',
    referenceDate?: Date
  ): Promise<{ excelPath: string; pdfPath: string; csvPath: string }> {
    const period = RevenueReportService.getReportPeriod(type, referenceDate);
    const data = await RevenueReportService.generateRevenueData(period);
    
    const excelBuffer = await RevenueReportService.generateExcelReport(period, data);
    const pdfBuffer = await RevenueReportService.generatePDFReport(period, data);
    const csvContent = await RevenueReportService.generateCSVReport(period, data);
    
    const paths = await RevenueReportService.saveReports(period, excelBuffer, pdfBuffer, csvContent);
    
    // Send via email
    const periodStr = type === 'yearly' 
      ? String(period.startDate.getFullYear())
      : period.startDate.toLocaleDateString('he-IL');
    
    await EmailService.sendRevenueReport(
      type,
      periodStr,
      excelBuffer,
      pdfBuffer,
      csvContent,
      { totalRevenue: data.totalRevenue, totalTransactions: data.totalTransactions }
    );
    
    return paths;
  }

  /**
   * Perform weekly code backup to Google Cloud Storage
   */
  private static async performWeeklyCodeBackup(): Promise<void> {
    try {
      const { performWeeklyCodeBackup, isGcsConfigured } = await import('./services/gcsBackupService');
      
      if (!isGcsConfigured()) {
        logger.warn('[GCS] Code backup skipped: GCS not configured');
        return;
      }
      
      logger.info('[GCS] Starting weekly code backup...');
      const result = await performWeeklyCodeBackup();
      
      if (result.success) {
        logger.info(`[GCS] ✅ Code backup complete: ${result.backupFile} (${result.size})`);
        logger.info(`[GCS] URL: ${result.gcsUrl}`);
      } else {
        logger.error(`[GCS] ❌ Code backup failed: ${result.error}`);
      }
    } catch (error) {
      logger.error('[GCS] Error in weekly code backup:', error);
    }
  }

  /**
   * Perform daily Firestore export to Google Cloud Storage
   */
  private static async performFirestoreExport(): Promise<void> {
    try {
      const { performFirestoreExport, isGcsConfigured } = await import('./services/gcsBackupService');
      
      if (!isGcsConfigured()) {
        logger.warn('[GCS] Firestore export skipped: GCS not configured');
        return;
      }
      
      logger.info('[GCS] Starting Firestore export...');
      const result = await performFirestoreExport();
      
      if (result.success) {
        logger.info(`[GCS] ✅ Firestore export complete: ${result.collections} collections, ${result.totalDocs} docs`);
        logger.info(`[GCS] Path: ${result.gcsPath}`);
      } else {
        logger.error(`[GCS] ❌ Firestore export failed: ${result.error}`);
      }
    } catch (error) {
      logger.error('[GCS] Error in Firestore export:', error);
    }
  }

  /**
   * Check for overdue legal compliance reviews and send reminders
   */
  private static async checkLegalCompliance(): Promise<void> {
    try {
      const { legalComplianceReviews } = await import('@shared/schema');
      const { db } = await import('./db');
      const { desc, or, lt, eq, and, gte, isNull } = await import('drizzle-orm');

      const now = new Date();
      const reminderThreshold60Days = new Date();
      reminderThreshold60Days.setDate(reminderThreshold60Days.getDate() + 60);

      logger.info('[Legal Compliance] Starting daily compliance review check...');

      // Find all reviews that are:
      // 1. Overdue (next_review_due < now) AND status != 'completed'
      // 2. OR due within 60 days AND haven't been reminded in the last 30 days
      const reviewsNeedingAttention = await db.select()
        .from(legalComplianceReviews)
        .where(
          and(
            or(
              // Overdue reviews
              and(
                lt(legalComplianceReviews.nextReviewDue, now),
                eq(legalComplianceReviews.reviewStatus, 'pending')
              ),
              // Reviews due within 60 days that haven't been reminded recently
              and(
                gte(legalComplianceReviews.nextReviewDue, now),
                lt(legalComplianceReviews.nextReviewDue, reminderThreshold60Days),
                or(
                  isNull(legalComplianceReviews.reminderSentAt),
                  lt(legalComplianceReviews.reminderSentAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // 30 days ago
                )
              )
            )
          )
        )
        .orderBy(desc(legalComplianceReviews.nextReviewDue));

      if (reviewsNeedingAttention.length === 0) {
        logger.info('[Legal Compliance] ✅ All compliance reviews are up to date');
        return;
      }

      logger.info(`[Legal Compliance] Found ${reviewsNeedingAttention.length} review(s) requiring attention`);

      // Send reminder emails for each review
      for (const review of reviewsNeedingAttention) {
        const daysUntilDue = Math.ceil((new Date(review.nextReviewDue).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        const emailSent = await EmailService.sendLegalComplianceReminder({
          documentType: review.documentType,
          nextReviewDue: review.nextReviewDue,
          daysUntilDue,
          lastReviewDate: review.reviewDate,
          adminEmail: 'legal@petwash.co.il', // TODO: Get from env or config
        });

        if (emailSent) {
          // Update reminder timestamp and count
          await db.update(legalComplianceReviews)
            .set({
              reminderSentAt: new Date(),
              reminderCount: (review.reminderCount || 0) + 1,
              reviewStatus: daysUntilDue < 0 ? 'overdue' : review.reviewStatus,
            })
            .where(eq(legalComplianceReviews.id, review.id));

          logger.info(`[Legal Compliance] ✉️ Reminder sent for ${review.documentType} (${daysUntilDue} days until due)`);
        } else {
          logger.error(`[Legal Compliance] ❌ Failed to send reminder for ${review.documentType}`);
        }
      }

      logger.info(`[Legal Compliance] ✅ Compliance check complete: ${reviewsNeedingAttention.length} reminder(s) sent`);
    } catch (error) {
      logger.error('[Legal Compliance] Error in compliance check:', error);
    }
  }

  /**
   * Check Israeli government compliance (tax, banking, regulatory)
   */
  private static async checkIsraeliCompliance(): Promise<void> {
    try {
      logger.info('[Israeli Compliance] Running comprehensive compliance check...');
      
      const { IsraeliComplianceMonitor } = await import('./israeliComplianceMonitor');
      const alerts = await IsraeliComplianceMonitor.checkAllCompliance();
      
      if (alerts.length === 0) {
        logger.info('[Israeli Compliance] ✅ All compliance requirements met');
      } else {
        logger.warn(`[Israeli Compliance] ⚠️ Found ${alerts.length} compliance alert(s)`);
      }
    } catch (error) {
      logger.error('[Israeli Compliance] Error in compliance check:', error);
    }
  }

  /**
   * Check security updates (npm, browsers, SSL, platform)
   */
  private static async checkSecurityUpdates(): Promise<void> {
    try {
      logger.info('[Security Updates] 🤖 Running Gemini AI-powered update analysis...');
      
      await GeminiUpdateAdvisor.analyzeUpdates();
      
      logger.info('[Security Updates] ✅ Gemini analysis complete - check your email for recommendations');
    } catch (error) {
      logger.error('[Security Updates] Error in Gemini analysis:', error);
    }
  }

  /**
   * Run npm dependency audit
   */
  private static async runDependencyAudit(): Promise<void> {
    try {
      logger.info('[Dependency Audit] Running weekly npm audit...');
      
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Run npm audit
      const { stdout } = await execAsync('npm audit --json || true');
      const auditResults = JSON.parse(stdout);
      
      const vulnerabilities = auditResults.metadata?.vulnerabilities || {};
      const total = Object.values(vulnerabilities).reduce((sum: number, count: any) => sum + count, 0);
      
      if (total > 0) {
        logger.warn(`[Dependency Audit] ⚠️ Found ${total} vulnerabilities: ${vulnerabilities.critical || 0} critical, ${vulnerabilities.high || 0} high, ${vulnerabilities.moderate || 0} moderate, ${vulnerabilities.low || 0} low`);
      } else {
        logger.info('[Dependency Audit] ✅ No vulnerabilities found');
      }
    } catch (error) {
      logger.error('[Dependency Audit] Error running npm audit:', error);
    }
  }

  /**
   * Cleanup old monitoring data (7-year retention for Israeli Privacy Law compliance)
   */
  private static async cleanupMonitoringData(): Promise<void> {
    try {
      logger.info('[Monitoring Cleanup] Starting 7-year data retention cleanup...');
      
      const { biometricSecurityMonitor } = await import('./services/BiometricSecurityMonitor');
      const { loyaltyActivityMonitor } = await import('./services/LoyaltyActivityMonitor');
      const { oauthCertificateMonitor } = await import('./services/OAuthCertificateMonitor');
      const { notificationConsentManager } = await import('./services/NotificationConsentManager');
      
      await Promise.all([
        biometricSecurityMonitor.cleanupOldData(),
        loyaltyActivityMonitor.cleanupOldData(),
        oauthCertificateMonitor.cleanupOldData(),
        notificationConsentManager.cleanupOldData(),
      ]);
      
      logger.info('[Monitoring Cleanup] ✅ Cleanup complete - all services processed (2555-day retention)');
    } catch (error) {
      logger.error('[Monitoring Cleanup] Error during cleanup:', error);
      recordCronExecution('Monitoring Data Cleanup', 'failure', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Process wallet telemetry abandonment detection
   * Marks sessions as abandoned if no success signal after 60 seconds
   */
  private static async processWalletTelemetryAbandonment(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - 60 * 1000); // 60 seconds ago
      
      // Query Firestore for pending/likely sessions older than 60s
      // Note: This query requires a composite index. If index doesn't exist, we gracefully skip.
      let snapshot;
      try {
        snapshot = await db.collection('wallet_telemetry')
          .where('createdAt', '<', cutoffTime)
          .where('status', 'in', ['pending', 'likely_failed'])
          .limit(100)
          .get();
      } catch (indexError: any) {
        if (indexError.message?.includes('requires an index')) {
          logger.warn('[WalletTelemetry] Composite index not configured - skipping abandonment detection. Create index at: https://console.firebase.google.com/project/signinpetwash/firestore/indexes');
          return; // Gracefully skip instead of crashing
        }
        throw indexError; // Re-throw other errors
      }

      if (snapshot.empty) {
        return;
      }

      let updated = 0;
      const batch = db.batch();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // If confidence < 50 and no activity for 60s -> mark abandoned
        if (data.confidenceScore < 50) {
          batch.update(doc.ref, {
            status: 'abandoned',
            inferredSuccess: false,
            updatedAt: new Date()
          });
          updated++;
        }
      });

      if (updated > 0) {
        await batch.commit();
        logger.info(`[WalletTelemetry] Marked ${updated} sessions as abandoned`);
      }

    } catch (error) {
      logger.error('[WalletTelemetry] Error processing abandonment:', error);
    }
  }

  /**
   * Auto-release expired escrow holds
   * Releases payments after 72-hour hold period for Sitter Suite bookings
   */
  private static async autoReleaseExpiredEscrow(): Promise<void> {
    try {
      logger.info('[Escrow] Checking for expired holds...');
      const releasedCount = await EscrowService.autoReleaseExpiredHolds();
      
      if (releasedCount > 0) {
        logger.info(`[Escrow] ✅ Auto-released ${releasedCount} expired escrow payments`);
        recordCronExecution('Escrow Auto-Release', 'success', { releasedCount });
      }
    } catch (error) {
      logger.error('[Escrow] Error during auto-release:', error);
      recordCronExecution('Escrow Auto-Release', 'failure', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Process weather notifications for dog walkers, drivers, and pet wash users
   * Smart alerts with 4-hour user cooldown to prevent notification spam
   * Runs every 2 hours via cron job
   */
  private static async processWeatherNotifications(): Promise<void> {
    try {
      logger.info('[WeatherNotifications] Processing weather alerts...');
      
      const { weatherNotificationService } = await import('./services/weatherNotifications');
      const result = await weatherNotificationService.processWeatherNotifications();
      
      if (result.success) {
        logger.info(`[WeatherNotifications] ✅ Processed ${result.notificationsSent} notifications`, {
          walkers: result.breakdown?.walkers || 0,
          drivers: result.breakdown?.drivers || 0,
          washUsers: result.breakdown?.washUsers || 0,
          skippedCooldown: result.breakdown?.skippedCooldown || 0
        });
        recordCronExecution('Weather Notifications', 'success', { 
          notificationsSent: result.notificationsSent,
          breakdown: result.breakdown 
        });
      } else {
        logger.warn('[WeatherNotifications] No notifications sent');
        recordCronExecution('Weather Notifications', 'success', { notificationsSent: 0 });
      }
    } catch (error) {
      logger.error('[WeatherNotifications] Error processing notifications:', error);
      recordCronExecution('Weather Notifications', 'failure', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}