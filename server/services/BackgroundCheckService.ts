import { db } from '../db';
import { providerApplicants, providerBackgroundChecks } from '@shared/schema-enterprise';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

export type BackgroundCheckType = 
  | 'criminal_records'
  | 'identity_verification'
  | 'reference_check'
  | 'driving_record'
  | 'insurance_verification';

export type BackgroundCheckStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type CheckResultStatus = 'clear' | 'flagged' | 'inconclusive' | null;

interface BackgroundCheckRecord {
  checkType: BackgroundCheckType;
  status: BackgroundCheckStatus;
  result: CheckResultStatus;
  notes: string;
  vendorReference?: string;
  completedAt?: Date;
}

export class BackgroundCheckService {
  private static readonly VENDOR_API_URL = process.env.BACKGROUND_CHECK_API_URL;
  private static readonly VENDOR_API_KEY = process.env.BACKGROUND_CHECK_API_KEY;

  static async initiateCheck(
    applicantId: number,
    checkType: BackgroundCheckType
  ): Promise<{ success: boolean; checkId?: number; error?: string }> {
    try {
      const [applicant] = await db.select()
        .from(providerApplicants)
        .where(eq(providerApplicants.id, applicantId))
        .limit(1);

      if (!applicant) {
        return { success: false, error: 'Applicant not found' };
      }

      if (this.VENDOR_API_URL && this.VENDOR_API_KEY) {
        return await this.initiateRealCheck(applicant, checkType);
      } else {
        return await this.initiateMockCheck(applicantId, checkType);
      }
    } catch (error) {
      logger.error('[BackgroundCheck] Failed to initiate check', error, { applicantId, checkType });
      return { success: false, error: 'Failed to initiate background check' };
    }
  }

  private static async initiateRealCheck(
    applicant: typeof providerApplicants.$inferSelect,
    checkType: BackgroundCheckType
  ): Promise<{ success: boolean; checkId?: number; error?: string }> {
    logger.info('[BackgroundCheck] Real vendor integration not implemented');
    return await this.initiateMockCheck(applicant.id, checkType);
  }

  private static async initiateMockCheck(
    applicantId: number,
    checkType: BackgroundCheckType
  ): Promise<{ success: boolean; checkId?: number; error?: string }> {
    logger.info('[BackgroundCheck] Using mock/demo mode for background check', { applicantId, checkType });

    const [check] = await db.insert(providerBackgroundChecks)
      .values({
        applicantId,
        checkType,
        status: 'in_progress',
        vendorName: 'mock-vendor',
        vendorReference: `MOCK-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        initiatedAt: new Date(),
        initiatedByUid: 'system',
        metadata: { mode: 'mock', initiatedAt: new Date().toISOString() }
      })
      .returning();

    setTimeout(async () => {
      try {
        await this.completeMockCheck(check.id, 'clear');
        logger.info('[BackgroundCheck] Mock check completed', { checkId: check.id });
      } catch (error) {
        logger.error('[BackgroundCheck] Failed to complete mock check', error, { checkId: check.id });
      }
    }, 5000);

    return { success: true, checkId: check.id };
  }

  private static async completeMockCheck(
    checkId: number,
    result: 'clear' | 'flagged' | 'inconclusive'
  ): Promise<void> {
    await db.update(providerBackgroundChecks)
      .set({
        status: 'completed',
        resultStatus: result,
        resultSummary: result === 'clear' 
          ? 'No issues found. Applicant cleared.'
          : result === 'flagged'
          ? 'Issues found - manual review required.'
          : 'Unable to complete verification.',
        completedAt: new Date(),
        rawResponse: JSON.stringify({ mockResult: true, result })
      })
      .where(eq(providerBackgroundChecks.id, checkId));
  }

  static async getCheckStatus(checkId: number): Promise<BackgroundCheckRecord | null> {
    const [check] = await db.select()
      .from(providerBackgroundChecks)
      .where(eq(providerBackgroundChecks.id, checkId))
      .limit(1);

    if (!check) return null;

    return {
      checkType: check.checkType as BackgroundCheckType,
      status: check.status as BackgroundCheckStatus,
      result: check.resultStatus as CheckResultStatus,
      notes: check.resultSummary || '',
      vendorReference: check.vendorReference || undefined,
      completedAt: check.completedAt || undefined
    };
  }

  static async getAllChecksForApplicant(applicantId: number): Promise<BackgroundCheckRecord[]> {
    const checks = await db.select()
      .from(providerBackgroundChecks)
      .where(eq(providerBackgroundChecks.applicantId, applicantId));

    return checks.map(check => ({
      checkType: check.checkType as BackgroundCheckType,
      status: check.status as BackgroundCheckStatus,
      result: check.resultStatus as CheckResultStatus,
      notes: check.resultSummary || '',
      vendorReference: check.vendorReference || undefined,
      completedAt: check.completedAt || undefined
    }));
  }

  static async areAllChecksClear(applicantId: number): Promise<boolean> {
    const checks = await this.getAllChecksForApplicant(applicantId);
    
    if (checks.length === 0) return false;
    
    const allCompleted = checks.every(c => c.status === 'completed');
    const allClear = checks.every(c => c.result === 'clear');
    
    return allCompleted && allClear;
  }

  static async initiateStandardChecks(applicantId: number): Promise<{ success: boolean; checkIds: number[] }> {
    const standardChecks: BackgroundCheckType[] = [
      'criminal_records',
      'identity_verification'
    ];

    const [applicant] = await db.select()
      .from(providerApplicants)
      .where(eq(providerApplicants.id, applicantId))
      .limit(1);

    if (!applicant) {
      return { success: false, checkIds: [] };
    }

    if (applicant.serviceTypes.includes('pet_transport') || 
        applicant.serviceTypes.includes('dog_walking')) {
      standardChecks.push('driving_record');
    }

    const checkIds: number[] = [];
    
    for (const checkType of standardChecks) {
      const result = await this.initiateCheck(applicantId, checkType);
      if (result.success && result.checkId) {
        checkIds.push(result.checkId);
      }
    }

    logger.info('[BackgroundCheck] Standard checks initiated', { 
      applicantId, 
      checkCount: checkIds.length,
      checkTypes: standardChecks 
    });

    return { success: checkIds.length > 0, checkIds };
  }
}
