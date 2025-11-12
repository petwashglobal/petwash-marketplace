/**
 * Staff Onboarding & Fraud Prevention API Routes
 * 
 * Endpoints for:
 * - Staff applications
 * - Document uploads
 * - E-signatures
 * - Expense submission with fraud detection
 * - Logbook tracking
 * - Franchise prepayment enforcement
 */

import type { Express } from "express";
import { db } from '../db';
import { requireAuth } from '../customAuth';
import { requireAdmin } from '../adminAuth';
import {
  staffApplications,
  staffDocuments,
  staffESignatures,
  staffExpenses,
  staffLogbook,
  franchiseOrders,
  insertStaffApplicationSchema,
  insertStaffExpenseSchema,
  insertStaffLogbookSchema,
  insertFranchiseOrderSchema,
} from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { staffOnboardingService } from '../services/StaffOnboardingService';
import { receiptFraudDetection } from '../services/ReceiptFraudDetection';

export function registerStaffOnboardingRoutes(app: Express) {
  
  // =================== STAFF APPLICATIONS ===================
  
  /**
   * POST /api/staff/applications
   * Submit new staff application
   */
  app.post('/api/staff/applications', async (req, res) => {
    try {
      const data = insertStaffApplicationSchema.parse(req.body);
      const application = await staffOnboardingService.createApplication(data);
      
      res.json({
        success: true,
        application,
        message: 'Application submitted successfully! Check your email for next steps.',
      });
    } catch (error: any) {
      logger.error('[API] Failed to create application', { error });
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to submit application',
      });
    }
  });

  /**
   * GET /api/staff/applications/:id
   * Get application details (authenticated - owner or admin only)
   */
  app.get('/api/staff/applications/:id', requireAuth, async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      const userId = (req as any).user?.uid || (req as any).user?.id;
      const isAdmin = (req as any).user?.isAdmin || false;
      
      const [application] = await db.select()
        .from(staffApplications)
        .where(eq(staffApplications.id, applicationId))
        .limit(1);

      if (!application) {
        return res.status(404).json({
          success: false,
          error: 'Application not found',
        });
      }

      // Authorization: User must own the application OR be an admin
      if (!isAdmin && application.userId !== userId && application.email !== (req as any).user?.email) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized - you can only view your own applications',
        });
      }

      res.json({
        success: true,
        application,
      });
    } catch (error: any) {
      logger.error('[API] Failed to get application', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve application',
      });
    }
  });

  /**
   * GET /api/staff/applications/:id/status
   * Get onboarding progress and status (authenticated)
   */
  app.get('/api/staff/applications/:id/status', requireAuth, async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      const userId = (req as any).user?.uid || (req as any).user?.id;
      const isAdmin = (req as any).user?.isAdmin || false;
      
      // Verify ownership before revealing status
      const [application] = await db.select()
        .from(staffApplications)
        .where(eq(staffApplications.id, applicationId))
        .limit(1);

      if (!application) {
        return res.status(404).json({
          success: false,
          error: 'Application not found',
        });
      }

      // Authorization: User must own the application OR be an admin
      if (!isAdmin && application.userId !== userId && application.email !== (req as any).user?.email) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized - you can only view your own applications',
        });
      }
      
      const status = await staffOnboardingService.getOnboardingStatus(applicationId);
      
      res.json({
        success: true,
        status,
      });
    } catch (error: any) {
      logger.error('[API] Failed to get onboarding status', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve onboarding status',
      });
    }
  });

  /**
   * POST /api/staff/applications/:id/documents
   * Upload document for verification (authenticated - owner or admin only)
   */
  app.post('/api/staff/applications/:id/documents', requireAuth, async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      const userId = (req as any).user?.uid || (req as any).user?.id;
      const isAdmin = (req as any).user?.isAdmin || false;
      const { documentType, documentUrl, metadata } = req.body;

      if (!documentType || !documentUrl) {
        return res.status(400).json({
          success: false,
          error: 'documentType and documentUrl are required',
        });
      }

      // Verify ownership
      const [application] = await db.select()
        .from(staffApplications)
        .where(eq(staffApplications.id, applicationId))
        .limit(1);

      if (!application) {
        return res.status(404).json({
          success: false,
          error: 'Application not found',
        });
      }

      // Authorization: User must own the application OR be an admin
      if (!isAdmin && application.userId !== userId && application.email !== (req as any).user?.email) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized - you can only upload documents for your own application',
        });
      }

      await staffOnboardingService.uploadDocument(
        applicationId,
        documentType,
        documentUrl,
        metadata
      );

      res.json({
        success: true,
        message: 'Document uploaded successfully',
      });
    } catch (error: any) {
      logger.error('[API] Failed to upload document', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to upload document',
      });
    }
  });

  /**
   * POST /api/staff/applications/:id/verify-biometrics
   * Verify ID + Selfie match (authenticated - owner or admin only)
   */
  app.post('/api/staff/applications/:id/verify-biometrics', requireAuth, async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      const userId = (req as any).user?.uid || (req as any).user?.id;
      const isAdmin = (req as any).user?.isAdmin || false;
      const { idPhotoUrl, selfieUrl } = req.body;

      if (!idPhotoUrl || !selfieUrl) {
        return res.status(400).json({
          success: false,
          error: 'idPhotoUrl and selfieUrl are required',
        });
      }

      // Verify ownership
      const [application] = await db.select()
        .from(staffApplications)
        .where(eq(staffApplications.id, applicationId))
        .limit(1);

      if (!application) {
        return res.status(404).json({
          success: false,
          error: 'Application not found',
        });
      }

      // Authorization: User must own the application OR be an admin
      if (!isAdmin && application.userId !== userId && application.email !== (req as any).user?.email) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized - you can only verify biometrics for your own application',
        });
      }

      const result = await staffOnboardingService.verifyBiometrics(
        applicationId,
        idPhotoUrl,
        selfieUrl
      );

      res.json({
        success: true,
        biometricVerification: result,
        message: result.matched 
          ? '✅ Biometric verification successful!' 
          : '❌ Biometric verification failed - photos do not match',
      });
    } catch (error: any) {
      logger.error('[API] Biometric verification failed', { error });
      res.status(500).json({
        success: false,
        error: 'Biometric verification failed',
      });
    }
  });

  /**
   * POST /api/staff/applications/:id/send-esignature
   * Send e-signature documents (authenticated - owner or admin only)
   */
  app.post('/api/staff/applications/:id/send-esignature', requireAuth, async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      const userId = (req as any).user?.uid || (req as any).user?.id;
      const isAdmin = (req as any).user?.isAdmin || false;
      const { email } = req.body;

      // Verify ownership
      const [application] = await db.select()
        .from(staffApplications)
        .where(eq(staffApplications.id, applicationId))
        .limit(1);

      if (!application) {
        return res.status(404).json({
          success: false,
          error: 'Application not found',
        });
      }

      // Authorization: User must own the application OR be an admin
      if (!isAdmin && application.userId !== userId && application.email !== (req as any).user?.email) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized - you can only request e-signatures for your own application',
        });
      }

      await staffOnboardingService.sendESignatureDocuments(applicationId, email);

      res.json({
        success: true,
        message: 'E-signature documents sent to your email',
      });
    } catch (error: any) {
      logger.error('[API] Failed to send e-signature documents', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to send e-signature documents',
      });
    }
  });

  /**
   * GET /api/staff/applications
   * List all applications (admin only)
   */
  app.get('/api/staff/applications', requireAdmin, async (req, res) => {
    try {
      const { status, type } = req.query;
      
      let query = db.select().from(staffApplications);
      
      if (status) {
        query = query.where(eq(staffApplications.status, status as string)) as any;
      }
      
      if (type) {
        query = query.where(eq(staffApplications.applicationType, type as string)) as any;
      }
      
      const applications = await query.orderBy(desc(staffApplications.submittedAt));

      res.json({
        success: true,
        applications,
      });
    } catch (error: any) {
      logger.error('[API] Failed to list applications', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to list applications',
      });
    }
  });

  /**
   * POST /api/staff/applications/:id/approve
   * Approve application (admin only)
   */
  app.post('/api/staff/applications/:id/approve', requireAdmin, async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      const { reviewedBy } = req.body;

      await staffOnboardingService.approveApplication(applicationId, reviewedBy);

      res.json({
        success: true,
        message: 'Application approved successfully',
      });
    } catch (error: any) {
      logger.error('[API] Failed to approve application', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to approve application',
      });
    }
  });

  /**
   * POST /api/staff/applications/:id/reject
   * Reject application (admin only)
   */
  app.post('/api/staff/applications/:id/reject', requireAdmin, async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      const { reviewedBy, reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required',
        });
      }

      await staffOnboardingService.rejectApplication(applicationId, reviewedBy, reason);

      res.json({
        success: true,
        message: 'Application rejected',
      });
    } catch (error: any) {
      logger.error('[API] Failed to reject application', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to reject application',
      });
    }
  });

  // =================== FRAUD PREVENTION - EXPENSES ===================

  /**
   * POST /api/staff/expenses
   * Submit expense with receipt fraud detection (authenticated)
   */
  app.post('/api/staff/expenses', requireAuth, async (req, res) => {
    try {
      const data = insertStaffExpenseSchema.parse(req.body);
      
      logger.info('[API] Processing expense submission', {
        employeeId: data.employeeId,
        amount: data.amount,
        hasReceipt: !!data.receiptUrl,
      });

      let fraudAnalysis = null;

      // Run fraud detection if receipt provided
      if (data.receiptUrl) {
        logger.info('[API] Running fraud detection on receipt');
        
        fraudAnalysis = await receiptFraudDetection.analyzeReceipt(
          data.receiptUrl,
          data.employeeId,
          parseFloat(data.amount.toString())
        );

        logger.info('[API] Fraud analysis complete', {
          fraudScore: fraudAnalysis.fraudScore,
          isLegitimate: fraudAnalysis.isLegitimate,
          flagCount: fraudAnalysis.flags.length,
        });
      }

      // Insert expense with fraud analysis
      const [expense] = await db.insert(staffExpenses).values({
        ...data,
        receiptOcrData: fraudAnalysis?.ocrData,
        geminiValidation: fraudAnalysis ? {
          analysis: fraudAnalysis.analysis,
          confidence: fraudAnalysis.confidence,
        } : null,
        fraudScore: fraudAnalysis?.fraudScore.toString(),
        fraudFlags: fraudAnalysis?.flags || [],
        receiptVerificationStatus: fraudAnalysis
          ? (fraudAnalysis.isLegitimate ? 'verified' : 'suspicious')
          : 'pending',
        duplicateCheckHash: fraudAnalysis?.duplicateHash,
        status: fraudAnalysis && !fraudAnalysis.isLegitimate ? 'pending' : 'pending', // All require manager approval
      }).returning();

      res.json({
        success: true,
        expense,
        fraudAnalysis: fraudAnalysis ? {
          fraudScore: fraudAnalysis.fraudScore,
          isLegitimate: fraudAnalysis.isLegitimate,
          warnings: fraudAnalysis.warnings,
        } : null,
        message: fraudAnalysis && !fraudAnalysis.isLegitimate
          ? '⚠️ Receipt flagged for review - requires manager approval'
          : 'Expense submitted successfully',
      });
    } catch (error: any) {
      logger.error('[API] Failed to submit expense', { error });
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to submit expense',
      });
    }
  });

  /**
   * GET /api/staff/expenses
   * List expenses (admin only - with optional filters)
   */
  app.get('/api/staff/expenses', requireAdmin, async (req, res) => {
    try {
      const { employeeId, status, verificationStatus } = req.query;
      
      let query = db.select().from(staffExpenses);
      
      if (employeeId) {
        query = query.where(eq(staffExpenses.employeeId, employeeId as string)) as any;
      }
      
      if (status) {
        query = query.where(eq(staffExpenses.status, status as string)) as any;
      }
      
      if (verificationStatus) {
        query = query.where(eq(staffExpenses.receiptVerificationStatus, verificationStatus as string)) as any;
      }
      
      const expenses = await query.orderBy(desc(staffExpenses.submittedAt));

      res.json({
        success: true,
        expenses,
      });
    } catch (error: any) {
      logger.error('[API] Failed to list expenses', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to list expenses',
      });
    }
  });

  /**
   * POST /api/staff/expenses/:id/approve
   * Approve expense (admin only)
   */
  app.post('/api/staff/expenses/:id/approve', requireAdmin, async (req, res) => {
    try {
      const expenseId = parseInt(req.params.id);
      const { approvedBy } = req.body;

      await db.update(staffExpenses)
        .set({
          status: 'approved',
          approvedAt: new Date(),
          approvedBy,
          updatedAt: new Date(),
        })
        .where(eq(staffExpenses.id, expenseId));

      logger.info('[API] Expense approved', { expenseId, approvedBy });

      res.json({
        success: true,
        message: 'Expense approved successfully',
      });
    } catch (error: any) {
      logger.error('[API] Failed to approve expense', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to approve expense',
      });
    }
  });

  /**
   * POST /api/staff/expenses/:id/reject
   * Reject expense (admin only)
   */
  app.post('/api/staff/expenses/:id/reject', requireAdmin, async (req, res) => {
    try {
      const expenseId = parseInt(req.params.id);
      const { approvedBy, reason } = req.body;

      await db.update(staffExpenses)
        .set({
          status: 'rejected',
          rejectionReason: reason,
          approvedBy,
          updatedAt: new Date(),
        })
        .where(eq(staffExpenses.id, expenseId));

      logger.info('[API] Expense rejected', { expenseId, approvedBy, reason });

      res.json({
        success: true,
        message: 'Expense rejected',
      });
    } catch (error: any) {
      logger.error('[API] Failed to reject expense', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to reject expense',
      });
    }
  });

  // =================== GPS-VERIFIED LOGBOOK ===================

  /**
   * POST /api/staff/logbook
   * Submit logbook entry with GPS verification (authenticated)
   */
  app.post('/api/staff/logbook', requireAuth, async (req, res) => {
    try {
      const data = insertStaffLogbookSchema.parse(req.body);
      
      // Verify GPS if locations provided
      let gpsVerified = false;
      let gpsNotes = '';
      
      if (data.startLocation && data.endLocation) {
        // Simple distance check (could be enhanced with geofencing)
        const distance = calculateDistance(
          data.startLocation as any,
          data.endLocation as any
        );
        
        gpsVerified = distance > 10; // At least 10 meters movement
        gpsNotes = `Distance traveled: ${Math.round(distance)}m`;
      }

      const [entry] = await db.insert(staffLogbook).values({
        ...data,
        gpsVerified,
        gpsVerificationNotes: gpsNotes,
      }).returning();

      res.json({
        success: true,
        logbookEntry: entry,
        message: 'Logbook entry recorded',
      });
    } catch (error: any) {
      logger.error('[API] Failed to submit logbook entry', { error });
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to submit logbook entry',
      });
    }
  });

  /**
   * GET /api/staff/logbook
   * List logbook entries (admin only)
   */
  app.get('/api/staff/logbook', requireAdmin, async (req, res) => {
    try {
      const { employeeId, status } = req.query;
      
      let query = db.select().from(staffLogbook);
      
      if (employeeId) {
        query = query.where(eq(staffLogbook.employeeId, employeeId as string)) as any;
      }
      
      if (status) {
        query = query.where(eq(staffLogbook.status, status as string)) as any;
      }
      
      const entries = await query.orderBy(desc(staffLogbook.startTime));

      res.json({
        success: true,
        logbook: entries,
      });
    } catch (error: any) {
      logger.error('[API] Failed to list logbook entries', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to list logbook entries',
      });
    }
  });

  // =================== FRANCHISE PREPAYMENT ENFORCEMENT ===================

  /**
   * POST /api/franchise/orders
   * Create franchise order - REQUIRES PREPAYMENT (authenticated)
   */
  app.post('/api/franchise/orders', requireAuth, async (req, res) => {
    try {
      const data = insertFranchiseOrderSchema.parse(req.body);
      
      // Create order with payment_required status
      const [order] = await db.insert(franchiseOrders).values({
        ...data,
        paymentStatus: 'payment_required',
        orderStatus: 'pending_payment',
      }).returning();

      logger.info('[API] Franchise order created - payment required', {
        orderId: order.id,
        franchiseId: order.franchiseId,
        amount: order.totalAmount,
      });

      res.json({
        success: true,
        order,
        message: '⚠️ Payment required before order can be processed',
        paymentRequired: true,
      });
    } catch (error: any) {
      logger.error('[API] Failed to create franchise order', { error });
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create order',
      });
    }
  });

  /**
   * POST /api/franchise/orders/:id/confirm-payment
   * Confirm payment received for franchise order (admin only)
   */
  app.post('/api/franchise/orders/:id/confirm-payment', requireAdmin, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { paymentMethod, paymentReference } = req.body;

      // Update order to paid status
      await db.update(franchiseOrders)
        .set({
          paymentStatus: 'paid',
          orderStatus: 'processing',
          paymentMethod,
          paymentReference,
          paidAt: new Date(),
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(franchiseOrders.id, orderId));

      logger.info('[API] ✅ Franchise payment confirmed - order processing', {
        orderId,
        paymentMethod,
      });

      res.json({
        success: true,
        message: '✅ Payment confirmed - order is now being processed',
      });
    } catch (error: any) {
      logger.error('[API] Failed to confirm payment', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to confirm payment',
      });
    }
  });

  /**
   * GET /api/franchise/orders
   * List franchise orders (admin only)
   */
  app.get('/api/franchise/orders', requireAdmin, async (req, res) => {
    try {
      const { franchiseId, paymentStatus, orderStatus } = req.query;
      
      let query = db.select().from(franchiseOrders);
      
      if (franchiseId) {
        query = query.where(eq(franchiseOrders.franchiseId, parseInt(franchiseId as string))) as any;
      }
      
      if (paymentStatus) {
        query = query.where(eq(franchiseOrders.paymentStatus, paymentStatus as string)) as any;
      }
      
      if (orderStatus) {
        query = query.where(eq(franchiseOrders.orderStatus, orderStatus as string)) as any;
      }
      
      const orders = await query.orderBy(desc(franchiseOrders.createdAt));

      res.json({
        success: true,
        orders,
      });
    } catch (error: any) {
      logger.error('[API] Failed to list franchise orders', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to list orders',
      });
    }
  });
}

// Helper function to calculate distance between GPS points
function calculateDistance(
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number }
): number {
  const R = 6371000; // Earth radius in meters
  const lat1 = point1.latitude * Math.PI / 180;
  const lat2 = point2.latitude * Math.PI / 180;
  const deltaLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const deltaLon = (point2.longitude - point1.longitude) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}
