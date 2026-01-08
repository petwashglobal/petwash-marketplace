import { google } from 'googleapis';
import { db } from '../db';
import { providerIntakeQueue, providerInviteCodes } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { logger } from '../lib/logger';

/**
 * Provider Intake Service
 * Syncs Google Forms responses from Google Sheets into the intake queue
 * Supports management-assisted approval workflow
 */

interface GoogleFormRow {
  timestamp: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  providerType: string;
  city?: string;
  yearsExperience?: number;
  hasOwnTransport?: boolean;
  hasPetFirstAid?: boolean;
  hasInsurance?: boolean;
  availabilityNotes?: string;
  preferredWorkingDays?: string;
  preferredHours?: string;
  aboutMe?: string;
  whyJoinPetWash?: string;
  referralSource?: string;
  resumeUrl?: string;
  linkedInUrl?: string;
}

interface SyncResult {
  totalRows: number;
  newRecords: number;
  skippedDuplicates: number;
  errors: string[];
}

export class ProviderIntakeService {
  private sheets: any;
  private drive: any;
  
  constructor() {
    this.initializeGoogleClients();
  }
  
  private async initializeGoogleClients() {
    try {
      const auth = new google.auth.GoogleAuth({
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/drive.readonly'
        ]
      });
      
      const authClient = await auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: authClient as any });
      this.drive = google.drive({ version: 'v3', auth: authClient as any });
      
      logger.info('[ProviderIntake] Google Sheets API initialized');
    } catch (error: any) {
      logger.warn('[ProviderIntake] Google API not configured:', error.message);
    }
  }
  
  /**
   * Sync responses from a Google Sheet into the intake queue
   * 
   * Expected Sheet Columns (A-S):
   * A: Timestamp
   * B: Email
   * C: First Name
   * D: Last Name
   * E: Phone Number
   * F: Provider Type (walker/sitter/driver/groomer/trainer/station_operator)
   * G: City
   * H: Years Experience
   * I: Own Transport (Yes/No)
   * J: Pet First Aid (Yes/No)
   * K: Has Insurance (Yes/No)
   * L: Availability Notes
   * M: Preferred Working Days
   * N: Preferred Hours
   * O: About Me
   * P: Why Join Pet Wash
   * Q: Referral Source
   * R: Resume URL
   * S: LinkedIn URL
   */
  async syncFromGoogleSheet(sheetId: string, sheetName: string = 'Form Responses 1'): Promise<SyncResult> {
    const result: SyncResult = {
      totalRows: 0,
      newRecords: 0,
      skippedDuplicates: 0,
      errors: []
    };
    
    if (!this.sheets) {
      throw new Error('Google Sheets API not initialized. Check service account credentials.');
    }
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A2:S`, // Skip header row
      });
      
      const rows = response.data.values || [];
      result.totalRows = rows.length;
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // Account for header row
        
        try {
          const formData = this.parseFormRow(row);
          
          // Check if already synced (by email + provider type combination)
          const existing = await db
            .select()
            .from(providerIntakeQueue)
            .where(
              and(
                eq(providerIntakeQueue.email, formData.email),
                eq(providerIntakeQueue.providerType, formData.providerType),
                eq(providerIntakeQueue.googleSheetRowNumber, rowNumber)
              )
            )
            .limit(1);
          
          if (existing.length > 0) {
            result.skippedDuplicates++;
            continue;
          }
          
          // Generate intake ID
          const year = new Date().getFullYear();
          const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
          const intakeId = `INT-${year}-${randomNum}`;
          
          // Insert into queue
          await db.insert(providerIntakeQueue).values({
            intakeId,
            googleFormResponseId: `${sheetId}_${rowNumber}`,
            googleSheetRowNumber: rowNumber,
            syncedFromSheetId: sheetId,
            syncedAt: new Date(),
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            phoneNumber: formData.phoneNumber,
            providerType: formData.providerType.toLowerCase(),
            city: formData.city,
            country: 'IL', // Default to Israel
            yearsExperience: formData.yearsExperience,
            hasOwnTransport: formData.hasOwnTransport,
            hasPetFirstAid: formData.hasPetFirstAid,
            hasInsurance: formData.hasInsurance,
            availabilityNotes: formData.availabilityNotes,
            preferredWorkingDays: formData.preferredWorkingDays?.split(',').map(d => d.trim()) || [],
            preferredHours: formData.preferredHours,
            aboutMe: formData.aboutMe,
            whyJoinPetWash: formData.whyJoinPetWash,
            referralSource: formData.referralSource,
            resumeUrl: formData.resumeUrl,
            linkedInUrl: formData.linkedInUrl,
            status: 'new'
          });
          
          result.newRecords++;
          
          logger.info('[ProviderIntake] Synced new application:', {
            intakeId,
            email: formData.email,
            providerType: formData.providerType
          });
          
        } catch (rowError: any) {
          result.errors.push(`Row ${rowNumber}: ${rowError.message}`);
          logger.error('[ProviderIntake] Error processing row:', { rowNumber, error: rowError.message });
        }
      }
      
      logger.info('[ProviderIntake] Sync completed:', result);
      return result;
      
    } catch (error: any) {
      logger.error('[ProviderIntake] Sync failed:', error);
      throw new Error(`Failed to sync from Google Sheet: ${error.message}`);
    }
  }
  
  private parseFormRow(row: string[]): GoogleFormRow {
    const parseYesNo = (value?: string): boolean => {
      if (!value) return false;
      return ['yes', 'כן', 'true', '1'].includes(value.toLowerCase());
    };
    
    return {
      timestamp: row[0] || '',
      email: row[1]?.trim() || '',
      firstName: row[2]?.trim() || '',
      lastName: row[3]?.trim() || '',
      phoneNumber: row[4]?.trim() || '',
      providerType: row[5]?.trim() || 'walker',
      city: row[6]?.trim(),
      yearsExperience: row[7] ? parseInt(row[7]) : undefined,
      hasOwnTransport: parseYesNo(row[8]),
      hasPetFirstAid: parseYesNo(row[9]),
      hasInsurance: parseYesNo(row[10]),
      availabilityNotes: row[11]?.trim(),
      preferredWorkingDays: row[12]?.trim(),
      preferredHours: row[13]?.trim(),
      aboutMe: row[14]?.trim(),
      whyJoinPetWash: row[15]?.trim(),
      referralSource: row[16]?.trim(),
      resumeUrl: row[17]?.trim(),
      linkedInUrl: row[18]?.trim(),
    };
  }
  
  /**
   * Generate invite code for approved applicant and send via email
   */
  async approveAndInvite(intakeId: string, adminId: string, sendVia: 'email' | 'whatsapp' | 'sms' = 'email'): Promise<{ inviteCode: string; success: boolean }> {
    // Get the intake record
    const [intake] = await db
      .select()
      .from(providerIntakeQueue)
      .where(eq(providerIntakeQueue.intakeId, intakeId))
      .limit(1);
    
    if (!intake) {
      throw new Error('Intake record not found');
    }
    
    if (intake.status === 'invited' || intake.status === 'converted') {
      throw new Error('Applicant has already been invited or converted');
    }
    
    // Generate invite code
    const codePrefix = intake.providerType.toUpperCase().slice(0, 4);
    const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const inviteCode = `${codePrefix}-${randomCode}`;
    
    // Create invite code record
    await db.insert(providerInviteCodes).values({
      inviteCode,
      providerType: intake.providerType,
      createdByAdminId: adminId,
      maxUses: 1,
      currentUses: 0,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      isActive: true,
      campaignName: 'google_form_intake',
      notes: `Generated for intake ${intakeId} - ${intake.firstName} ${intake.lastName}`
    });
    
    // Update intake record
    await db
      .update(providerIntakeQueue)
      .set({
        status: 'invited',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        generatedInviteCode: inviteCode,
        inviteSentAt: new Date(),
        inviteSentVia: sendVia,
        updatedAt: new Date()
      })
      .where(eq(providerIntakeQueue.intakeId, intakeId));
    
    // TODO: Send invite email/SMS/WhatsApp with link
    // The invite code will be used when they visit the onboarding page
    
    logger.info('[ProviderIntake] Approved and invited applicant:', {
      intakeId,
      inviteCode,
      email: intake.email,
      sendVia
    });
    
    return { inviteCode, success: true };
  }
  
  /**
   * Reject an applicant with reason
   */
  async rejectApplicant(intakeId: string, adminId: string, reason: string): Promise<void> {
    await db
      .update(providerIntakeQueue)
      .set({
        status: 'rejected',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date()
      })
      .where(eq(providerIntakeQueue.intakeId, intakeId));
    
    logger.info('[ProviderIntake] Rejected applicant:', { intakeId, reason });
    
    // TODO: Send rejection email if desired
  }
  
  /**
   * Get all intake records with optional status filter
   */
  async getIntakeQueue(status?: string): Promise<any[]> {
    let query = db.select().from(providerIntakeQueue);
    
    if (status) {
      query = query.where(eq(providerIntakeQueue.status, status)) as any;
    }
    
    return await query.orderBy(providerIntakeQueue.createdAt);
  }
  
  /**
   * Get Google Form URL for the specific provider type
   * These forms should be created in Google Forms and linked here
   */
  getGoogleFormUrl(providerType: string): string {
    // These are placeholder URLs - user needs to create actual Google Forms
    const formUrls: Record<string, string> = {
      walker: process.env.GOOGLE_FORM_WALKER || 'https://forms.gle/your-walker-form',
      sitter: process.env.GOOGLE_FORM_SITTER || 'https://forms.gle/your-sitter-form',
      driver: process.env.GOOGLE_FORM_DRIVER || 'https://forms.gle/your-driver-form',
      groomer: process.env.GOOGLE_FORM_GROOMER || 'https://forms.gle/your-groomer-form',
      trainer: process.env.GOOGLE_FORM_TRAINER || 'https://forms.gle/your-trainer-form',
      station_operator: process.env.GOOGLE_FORM_STATION || 'https://forms.gle/your-station-form',
      general: process.env.GOOGLE_FORM_GENERAL || 'https://forms.gle/your-general-form'
    };
    
    return formUrls[providerType] || formUrls.general;
  }
}

export const providerIntakeService = new ProviderIntakeService();
