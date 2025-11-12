import { db as firestore } from './lib/firebase-admin';
import { FIRESTORE_PATHS } from '@shared/firestore-schema';
import { logger } from './lib/logger';
import { EmailService } from './emailService';

// HTML escape utility to prevent injection
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface PetVaccineInfo {
  petId: string;
  petName: string;
  uid: string;
  ownerEmail: string;
  ownerName: string;
  vaccineType: 'rabies' | 'dhpp' | 'lepto';
  nextVaccineDate: string;
  reminderEnabled: boolean;
}

interface VaccineReminderToSend {
  uid: string;
  pets: Array<{
    petId: string;
    petName: string;
    vaccineType: 'rabies' | 'dhpp' | 'lepto';
    vaccineDate: string;
  }>;
}

/**
 * Check if reminder was already sent for this pet/vaccine in the last 14 days
 */
async function wasReminderRecentlySent(petId: string, vaccineType: string, vaccineDate: string): Promise<boolean> {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  
  const logRef = await firestore.collection('vaccineReminderLog')
    .where('petId', '==', petId)
    .where('vaccineType', '==', vaccineType)
    .where('vaccineDate', '==', vaccineDate)
    .where('sentAt', '>=', fourteenDaysAgo)
    .limit(1)
    .get();
  
  return !logRef.empty;
}

/**
 * Log sent reminder to prevent duplicates
 */
async function logSentReminder(petId: string, petName: string, uid: string, vaccineType: string, vaccineDate: string): Promise<void> {
  await firestore.collection('vaccineReminderLog').add({
    petId,
    petName,
    uid,
    vaccineType,
    vaccineDate,
    sentAt: new Date(),
    reminderType: '7-day-advance',
  });
}

/**
 * Daily vaccine reminder cron job
 * Checks for pets with vaccines due in 7 days and sends reminders
 * De-duplicates and consolidates multi-pet households
 */
export async function processVaccineReminders(): Promise<{
  remindersChecked: number;
  remindersSent: number;
  errors: number;
}> {
  // Generate correlation ID for tracking
  const correlationId = `REM-${Date.now()}`;
  
  logger.info(`🐕 Starting daily vaccine reminder process with de-duplication... [${correlationId}]`);
  
  try {
    const today = new Date();
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);
    
    const targetDateStr = sevenDaysFromNow.toISOString().slice(0, 10); // YYYY-MM-DD
    
    logger.info(`[${correlationId}] Checking for vaccine due dates: ${targetDateStr}`);
    
    let remindersChecked = 0;
    let errors = 0;
    
    // Query all pets
    const petsSnapshot = await firestore.collectionGroup('pets')
      .where('deletedAt', '==', null)
      .get();
    
    logger.info(`[${correlationId}] Found ${petsSnapshot.size} total pets to check`);
    
    // Group reminders by uid (owner) for consolidation
    const remindersByOwner = new Map<string, VaccineReminderToSend>();
    let duplicatesSkipped = 0; // Track actual de-duplication count
    
    for (const petDoc of petsSnapshot.docs) {
      try {
        const petData = petDoc.data();
        const petId = petDoc.id;
        const uid = petData.uid;
        
        // Skip if reminders are disabled
        if (petData.reminderEnabled === false) {
          continue;
        }
        
        remindersChecked++;
        
        // Check each vaccine type
        const vaccineDates = petData.vaccineDates || {};
        const vaccineTypes: Array<'rabies' | 'dhpp' | 'lepto'> = ['rabies', 'dhpp', 'lepto'];
        
        for (const vaccineType of vaccineTypes) {
          const nextDate = vaccineDates[vaccineType];
          
          // Validate date format and skip invalid/missing dates
          if (!nextDate || typeof nextDate !== 'string') continue;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
            logger.warn(`Invalid vaccine date format for pet ${petId}: ${nextDate}`);
            continue;
          }
          
          // Check if vaccine is due in exactly 7 days (and not in the past)
          const vaccineDate = new Date(nextDate);
          if (isNaN(vaccineDate.getTime()) || vaccineDate < today) {
            logger.warn(`Past or invalid vaccine date for pet ${petId}: ${nextDate}`);
            continue;
          }
          
          if (nextDate === targetDateStr) {
            // De-duplication check
            const alreadySent = await wasReminderRecentlySent(petId, vaccineType, nextDate);
            if (alreadySent) {
              duplicatesSkipped++;
              logger.info(`[${correlationId}] ⏭️ Skipping duplicate: ${petData.name} - ${vaccineType} (already sent in last 14 days)`);
              continue;
            }
            
            logger.info(`[${correlationId}] ✨ Vaccine reminder needed: ${petData.name} (${uid}) - ${vaccineType} due on ${nextDate}`);
            
            // Group by owner for consolidation
            if (!remindersByOwner.has(uid)) {
              remindersByOwner.set(uid, { uid, pets: [] });
            }
            
            remindersByOwner.get(uid)!.pets.push({
              petId,
              petName: petData.name,
              vaccineType,
              vaccineDate: nextDate,
            });
          }
        }
      } catch (petError) {
        errors++;
        logger.error(`[${correlationId}] Error processing pet ${petDoc.id}:`, petError);
      }
    }
    
    // Check if any reminders to send
    if (remindersByOwner.size === 0) {
      logger.info(`[${correlationId}] ✅ No vaccine reminders needed today`);
      return {
        remindersChecked,
        remindersSent: 0,
        errors, // Return actual error count from pet processing
      };
    }
    
    // Send consolidated reminders
    let remindersSent = 0;
    
    for (const [uid, reminder] of remindersByOwner) {
      try {
        // Safety: Limit to 50 pets per owner to prevent email/system overload
        if (reminder.pets.length > 50) {
          logger.warn(`[${correlationId}] Owner ${uid} has ${reminder.pets.length} pets due for vaccines - capping at 50`);
          reminder.pets = reminder.pets.slice(0, 50);
        }
        
        // Get user profile
        const userProfileDoc = await firestore.doc(`userProfiles/${uid}`).get();
        
        if (!userProfileDoc.exists) {
          logger.warn(`User profile not found for ${uid}`);
          continue;
        }
        
        const userProfile = userProfileDoc.data();
        const locale = (userProfile?.preferredLanguage as 'he' | 'en') || 'en';
        
        // Create consolidated inbox message
        const messageTitle = locale === 'he'
          ? reminder.pets.length > 1 
            ? `תזכורות חיסונים - ${reminder.pets.length} חיות מחמד`
            : `תזכורת חיסון - ${reminder.pets[0].petName}`
          : reminder.pets.length > 1
            ? `Vaccine Reminders - ${reminder.pets.length} pets`
            : `Vaccine Reminder - ${reminder.pets[0].petName}`;
        
        const messageBody = locale === 'he'
          ? `<p>שלום ${escapeHtml(userProfile?.firstName || '')},</p>
             <p>זוהי תזכורת ידידותית לחיסונים הבאים שיגיעו בעוד 7 ימים:</p>
             <ul>${reminder.pets.map((p: { petName: string; vaccineType: string; vaccineDate: string }) => `<li><strong>${escapeHtml(p.petName)}:</strong> ${getVaccineNameHe(p.vaccineType)} (${formatDateHe(p.vaccineDate)})</li>`).join('')}</ul>
             <p>אנא וודא שאתה מזמין תורים עם הווטרינר שלך.</p>`
          : `<p>Hi ${escapeHtml(userProfile?.firstName || '')},</p>
             <p>This is a friendly reminder for the following vaccines due in 7 days:</p>
             <ul>${reminder.pets.map((p: { petName: string; vaccineType: string; vaccineDate: string }) => `<li><strong>${escapeHtml(p.petName)}:</strong> ${getVaccineNameEn(p.vaccineType)} (${formatDateEn(p.vaccineDate)})</li>`).join('')}</ul>
             <p>Please make sure to schedule appointments with your vet.</p>`;
        
        const messageRef = firestore.collection(FIRESTORE_PATHS.USER_INBOX(uid)).doc();
        await messageRef.set({
          title: messageTitle,
          bodyHtml: messageBody,
          type: 'reminder',
          ctaText: locale === 'he' ? 'נהל/י את החיות שלי' : 'Manage Pets',
          ctaUrl: '/pets',
          createdAt: new Date(),
          readAt: null,
          locale,
          priority: 1,
          attachments: [],
          meta: {
            reminderType: 'vaccine',
            petCount: reminder.pets.length,
            pets: reminder.pets.map((p: { petId: string; petName: string; vaccineType: string; vaccineDate: string }) => ({
              petId: p.petId,
              petName: p.petName,
              vaccineType: p.vaccineType,
              vaccineDate: p.vaccineDate,
            })),
          },
        });
        
        // Send email (consolidated for multi-pet)
        let emailSent = false;
        if (userProfile?.email) {
          try {
            await EmailService.sendVaccineReminder({
              to: userProfile.email,
              locale,
              petName: reminder.pets[0].petName,
              vaccineName: locale === 'he' ? getVaccineNameHe(reminder.pets[0].vaccineType) : getVaccineNameEn(reminder.pets[0].vaccineType),
              dueDateISO: reminder.pets[0].vaccineDate,
              managePetsUrl: 'https://petwash.co.il/pets',
              petId: reminder.pets[0].petId,
              // Pass all pets for consolidated display
              allPets: reminder.pets.length > 1 ? reminder.pets : undefined,
            });
            logger.info(`[${correlationId}] ✉️ Vaccine reminder email sent to ${userProfile.email}`);
            emailSent = true;
          } catch (emailError) {
            logger.error(`[${correlationId}] Failed to send vaccine reminder email to ${userProfile.email}`, emailError);
            errors++;
          }
        } else {
          logger.warn(`[${correlationId}] No email address for user ${uid} - skipping email`);
        }
        
        // CRITICAL: Only log as sent if email was actually delivered
        if (emailSent) {
          for (const pet of reminder.pets) {
            await logSentReminder(pet.petId, pet.petName, uid, pet.vaccineType, pet.vaccineDate);
          }
        }
        
        remindersSent++;
        logger.info(`[${correlationId}] ✅ Consolidated reminder sent to ${uid}: ${reminder.pets.length} pet(s)`);
      } catch (ownerError) {
        errors++;
        logger.error(`[${correlationId}] Error sending reminder to ${uid}:`, ownerError);
      }
    }
    
    logger.info(`[${correlationId}] 🎉 Vaccine reminder process completed: ${remindersSent} reminders sent (${remindersByOwner.size} owners), ${errors} errors`);
    logger.info(`[${correlationId}] Stats: petsEvaluated=${petsSnapshot.size}, remindersSent=${remindersSent}, emailsSent=${remindersSent}, duplicatesSkipped=${duplicatesSkipped}`);
    
    return {
      remindersChecked,
      remindersSent,
      errors,
    };
  } catch (error) {
    logger.error(`[${correlationId}] ❌ Fatal error in vaccine reminder process:`, error);
    throw error;
  }
}

function getVaccineNameEn(type: string): string {
  const names: Record<string, string> = {
    rabies: 'Rabies',
    dhpp: 'DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)',
    lepto: 'Leptospirosis',
  };
  return names[type] || type;
}

function getVaccineNameHe(type: string): string {
  const names: Record<string, string> = {
    rabies: 'כלבת',
    dhpp: 'DHPP (דיסטמפר, הפטיטיס, פרבו, פאראאינפלואנזה)',
    lepto: 'לפטוספירוזיס',
  };
  return names[type] || type;
}

function formatDateEn(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function formatDateHe(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

export default {
  processVaccineReminders,
};
