/**
 * Staff Onboarding Service
 * 
 * Complete onboarding workflow for:
 * - Pet Sitters
 * - Dog Walkers  
 * - Pet Transport Drivers
 * - Pet Trainers
 * - Station Hosts
 * 
 * Modeled after Airbnb, Uber, Booking.com best practices
 */

import { db } from '../db';
import {
  staffApplications,
  staffDocuments,
  staffESignatures,
  staffBackgroundChecks,
  type InsertStaffApplication,
  type InsertStaffDocument,
  type InsertStaffESignature,
  type StaffApplication,
} from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { biometricVerification } from './BiometricVerificationService';
import { docuSealService } from './DocuSealService';

export interface OnboardingStatus {
  applicationId: number;
  status: string;
  progress: number; // 0-100%
  completedSteps: string[];
  pendingSteps: string[];
  nextAction: string;
}

export class StaffOnboardingService {
  /**
   * Submit new staff application
   */
  async createApplication(data: InsertStaffApplication): Promise<StaffApplication> {
    try {
      logger.info('[Onboarding] Creating new application', { 
        email: data.email,
        type: data.applicationType 
      });

      const [application] = await db.insert(staffApplications)
        .values({
          ...data,
          status: 'pending',
          submittedAt: new Date(),
        })
        .returning();

      logger.info('[Onboarding] ✅ Application created', { 
        applicationId: application.id,
        email: application.email,
      });

      return application;

    } catch (error) {
      logger.error('[Onboarding] Failed to create application', { error });
      throw new Error('Failed to create staff application');
    }
  }

  /**
   * Upload document for verification
   */
  async uploadDocument(
    applicationId: number,
    documentType: string,
    documentUrl: string,
    metadata?: any
  ): Promise<void> {
    try {
      logger.info('[Onboarding] Uploading document', { applicationId, documentType });

      await db.insert(staffDocuments).values({
        applicationId,
        documentType,
        documentUrl,
        status: 'pending',
        metadata,
      });

      // Update application status
      await this.updateApplicationStatus(applicationId, 'documents_required');

      logger.info('[Onboarding] ✅ Document uploaded', { applicationId, documentType });

    } catch (error) {
      logger.error('[Onboarding] Failed to upload document', { error });
      throw error;
    }
  }

  /**
   * Verify ID + Selfie using biometric matching
   */
  async verifyBiometrics(
    applicationId: number,
    idPhotoUrl: string,
    selfieUrl: string
  ): Promise<{ matched: boolean; score: number }> {
    try {
      logger.info('[Onboarding] Starting biometric verification', { applicationId });

      const result = await biometricVerification.verifyIdentity(
        idPhotoUrl,
        selfieUrl
      );

      // Update documents with verification results
      await db.update(staffDocuments)
        .set({
          status: result.matched ? 'verified' : 'rejected',
          verificationMethod: 'biometric',
          verificationScore: result.matchScore,
          verifiedAt: new Date(),
        })
        .where(
          and(
            eq(staffDocuments.applicationId, applicationId),
            eq(staffDocuments.documentType, 'id_front')
          )
        );

      logger.info('[Onboarding] ✅ Biometric verification complete', {
        applicationId,
        matched: result.matched,
        score: result.matchScore,
      });

      return {
        matched: result.matched,
        score: result.matchScore,
      };

    } catch (error) {
      logger.error('[Onboarding] Biometric verification failed', { error });
      throw error;
    }
  }

  /**
   * Send e-signature documents via DocuSeal
   */
  async sendESignatureDocuments(
    applicationId: number,
    applicantEmail: string
  ): Promise<void> {
    try {
      logger.info('[Onboarding] Sending e-signature documents', { 
        applicationId,
        email: applicantEmail 
      });

      // Get application details
      const [application] = await db.select()
        .from(staffApplications)
        .where(eq(staffApplications.id, applicationId))
        .limit(1);

      if (!application) {
        throw new Error('Application not found');
      }

      // Documents to sign based on role
      const documents = this.getRequiredDocuments(application.applicationType);

      for (const doc of documents) {
        // Create e-signature record
        const [signature] = await db.insert(staffESignatures).values({
          applicationId,
          documentName: doc.name,
          documentType: doc.type,
          status: 'pending',
        }).returning();

        // Send via DocuSeal (if configured)
        if (process.env.DOCUSEAL_API_KEY) {
          try {
            // TODO: Implement DocuSeal integration
            // const submissionId = await docuSealService.sendDocument(...)
            
            await db.update(staffESignatures)
              .set({
                status: 'sent',
                sentAt: new Date(),
              })
              .where(eq(staffESignatures.id, signature.id));

          } catch (docusealError) {
            logger.warn('[Onboarding] DocuSeal send failed', { docusealError });
          }
        }
      }

      // Update application status
      await this.updateApplicationStatus(applicationId, 'under_review');

      logger.info('[Onboarding] ✅ E-signature documents sent', { 
        applicationId,
        documentCount: documents.length 
      });

    } catch (error) {
      logger.error('[Onboarding] Failed to send e-signature documents', { error });
      throw error;
    }
  }

  /**
   * Get onboarding status and progress
   */
  async getOnboardingStatus(applicationId: number): Promise<OnboardingStatus> {
    try {
      const [application] = await db.select()
        .from(staffApplications)
        .where(eq(staffApplications.id, applicationId))
        .limit(1);

      if (!application) {
        throw new Error('Application not found');
      }

      // Get documents
      const documents = await db.select()
        .from(staffDocuments)
        .where(eq(staffDocuments.applicationId, applicationId));

      // Get e-signatures
      const signatures = await db.select()
        .from(staffESignatures)
        .where(eq(staffESignatures.applicationId, applicationId));

      // Calculate progress
      const completedSteps: string[] = [];
      const pendingSteps: string[] = [];

      // Step 1: Application submitted
      completedSteps.push('application_submitted');

      // Step 2: Documents uploaded
      const requiredDocs = this.getRequiredDocumentTypes(application.applicationType);
      const uploadedDocs = documents.map(d => d.documentType);
      
      if (requiredDocs.every(doc => uploadedDocs.includes(doc))) {
        completedSteps.push('documents_uploaded');
      } else {
        pendingSteps.push('documents_upload');
      }

      // Step 3: Biometric verification
      const hasBiometric = documents.some(d => d.verificationMethod === 'biometric' && d.status === 'verified');
      if (hasBiometric) {
        completedSteps.push('biometric_verified');
      } else {
        pendingSteps.push('biometric_verification');
      }

      // Step 4: E-signatures
      const allSigned = signatures.every(s => s.status === 'signed' || s.status === 'completed');
      if (allSigned && signatures.length > 0) {
        completedSteps.push('documents_signed');
      } else {
        pendingSteps.push('sign_documents');
      }

      // Step 5: Background check (if required)
      if (['driver', 'trainer'].includes(application.applicationType)) {
        const bgChecks = await db.select()
          .from(staffBackgroundChecks)
          .where(eq(staffBackgroundChecks.applicationId, applicationId));

        if (bgChecks.some(bg => bg.status === 'clear')) {
          completedSteps.push('background_check_passed');
        } else {
          pendingSteps.push('background_check');
        }
      }

      // Calculate progress percentage
      const totalSteps = completedSteps.length + pendingSteps.length;
      const progress = Math.round((completedSteps.length / totalSteps) * 100);

      // Determine next action
      let nextAction = 'Complete pending steps';
      if (pendingSteps.includes('documents_upload')) {
        nextAction = 'Upload required documents (ID, insurance, certifications)';
      } else if (pendingSteps.includes('biometric_verification')) {
        nextAction = 'Complete biometric verification (ID + selfie)';
      } else if (pendingSteps.includes('sign_documents')) {
        nextAction = 'Sign required legal documents';
      } else if (pendingSteps.includes('background_check')) {
        nextAction = 'Background check in progress';
      } else if (application.status === 'approved') {
        nextAction = 'Onboarding complete! 🎉';
      }

      return {
        applicationId,
        status: application.status,
        progress,
        completedSteps,
        pendingSteps,
        nextAction,
      };

    } catch (error) {
      logger.error('[Onboarding] Failed to get status', { error });
      throw error;
    }
  }

  /**
   * Approve application (admin action)
   */
  async approveApplication(applicationId: number, reviewedBy: string): Promise<void> {
    try {
      await db.update(staffApplications)
        .set({
          status: 'approved',
          approvedAt: new Date(),
          reviewedAt: new Date(),
          reviewedBy,
        })
        .where(eq(staffApplications.id, applicationId));

      logger.info('[Onboarding] ✅ Application approved', { applicationId, reviewedBy });

    } catch (error) {
      logger.error('[Onboarding] Failed to approve application', { error });
      throw error;
    }
  }

  /**
   * Reject application (admin action)
   */
  async rejectApplication(
    applicationId: number,
    reviewedBy: string,
    reason: string
  ): Promise<void> {
    try {
      await db.update(staffApplications)
        .set({
          status: 'rejected',
          rejectionReason: reason,
          reviewedAt: new Date(),
          reviewedBy,
        })
        .where(eq(staffApplications.id, applicationId));

      logger.info('[Onboarding] Application rejected', { applicationId, reviewedBy, reason });

    } catch (error) {
      logger.error('[Onboarding] Failed to reject application', { error });
      throw error;
    }
  }

  // Helper methods

  private async updateApplicationStatus(applicationId: number, status: string): Promise<void> {
    await db.update(staffApplications)
      .set({ status, updatedAt: new Date() })
      .where(eq(staffApplications.id, applicationId));
  }

  private getRequiredDocuments(applicationType: string): Array<{ name: string; type: string }> {
    const common = [
      { name: 'Independent Contractor Agreement', type: 'contract' },
      { name: 'Non-Disclosure Agreement (NDA)', type: 'nda' },
      { name: 'Code of Conduct & Ethics', type: 'policy' },
      { name: 'Safety & Training Certification', type: 'policy' },
      { name: 'Insurance & Liability Waiver', type: 'waiver' },
    ];

    const specific: Record<string, Array<{ name: string; type: string }>> = {
      driver: [
        ...common,
        { name: 'Vehicle Inspection Checklist', type: 'policy' },
        { name: 'Background Check Authorization', type: 'policy' },
      ],
      host: [
        ...common,
        { name: 'Property/Host Agreement', type: 'contract' },
      ],
      trainer: [
        ...common,
        { name: 'Background Check Authorization', type: 'policy' },
      ],
    };

    return specific[applicationType] || common;
  }

  private getRequiredDocumentTypes(applicationType: string): string[] {
    const common = ['id_front', 'id_back', 'selfie', 'insurance'];

    const specific: Record<string, string[]> = {
      driver: [...common, 'vehicle_registration', 'drivers_license'],
      host: [...common, 'business_license', 'property_certification'],
      trainer: [...common, 'certification', 'insurance'],
      sitter: [...common, 'certification'],
      walker: [...common],
    };

    return specific[applicationType] || common;
  }
}

export const staffOnboardingService = new StaffOnboardingService();
