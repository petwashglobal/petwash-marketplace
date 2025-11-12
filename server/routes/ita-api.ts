import { Router } from 'express';
import { logger } from '../lib/logger';
import IsraeliTaxAPIService from '../services/IsraeliTaxAPIService';
import ElectronicInvoicingService from '../services/ElectronicInvoicingService';
import ITAComplianceMonitoringService from '../services/ITAComplianceMonitoringService';
import { db } from '../db';
import { electronicInvoices } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

const router = Router();

const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required').optional(),
  invoiceDate: z.string().min(1, 'Invoice date is required').optional(),
  customerTaxId: z.string().min(1, 'Customer tax ID is required').optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  totalAmount: z.number().positive('Total amount must be positive'),
  vatAmount: z.number().nonnegative('VAT amount must be non-negative').optional(),
  amountBeforeVAT: z.number().positive('Amount before VAT must be positive').optional(),
  vatRate: z.number().min(0).max(1).optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1, 'Line item description is required'),
    quantity: z.number().positive('Quantity must be positive'),
    unitPrice: z.number().nonnegative('Unit price must be non-negative'),
    totalPrice: z.number().nonnegative('Total price must be non-negative').optional(),
    vatRate: z.number().min(0).max(1, 'VAT rate must be between 0 and 1').optional(),
  })).min(1, 'At least one line item is required'),
  serviceType: z.enum(['k9000_wash', 'sitter_suite', 'walk_my_pet', 'pettrek_transport', 'pet_wash', 'other']),
  transactionId: z.string().optional(),
  paymentMethod: z.string().optional(),
  createdBy: z.string().optional(),
  currency: z.string().default('ILS'),
});

router.get('/config', async (req, res) => {
  try {
    const config = IsraeliTaxAPIService.getConfiguration();
    
    res.json({
      configured: config.configured,
      apiProvider: config.configured ? 'ITA_OAUTH2_DIRECT' : 'NOT_CONFIGURED',
      endpoints: {
        tokenUrl: config.tokenUrl,
        apiBaseUrl: config.apiBaseUrl,
      },
      scope: config.scope,
      note: config.configured 
        ? 'Direct ITA API is configured and ready'
        : 'See ITA_API_REGISTRATION_GUIDE.md to configure ITA OAuth2 credentials',
    });
  } catch (error: any) {
    logger.error('[ITA API] Config check failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/invoices/create', async (req, res) => {
  try {
    const validationResult = createInvoiceSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      logger.warn('[ITA API] Invoice validation failed', { 
        error: validationError.message,
        details: validationResult.error.errors 
      });
      
      res.status(400).json({ 
        error: 'Validation failed',
        message: validationError.message,
        details: validationResult.error.errors,
      });
      return;
    }
    
    const invoice = await ElectronicInvoicingService.createInvoice(validationResult.data);
    
    res.status(201).json({
      success: true,
      invoice,
      message: invoice.itaSubmissionStatus === 'submitted' 
        ? 'Invoice created and submitted to ITA' 
        : 'Invoice created',
    });
  } catch (error: any) {
    logger.error('[ITA API] Invoice creation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/invoices/:id/submit', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    
    const result = await ElectronicInvoicingService.submitToITA(invoiceId);
    
    res.json({
      success: result.success,
      result,
    });
  } catch (error: any) {
    logger.error('[ITA API] Invoice submission failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/invoices/:invoiceId/status', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    const invoice = await ElectronicInvoicingService.getInvoiceStatus(invoiceId);
    
    res.json({
      success: true,
      invoice,
    });
  } catch (error: any) {
    logger.error('[ITA API] Status check failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/invoices/retry-failed', async (req, res) => {
  try {
    const results = await ElectronicInvoicingService.retryFailedSubmissions();
    
    res.json({
      success: true,
      results,
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });
  } catch (error: any) {
    logger.error('[ITA API] Retry failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/compliance/report', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const report = await ElectronicInvoicingService.generateComplianceReport(start, end);
    
    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    logger.error('[ITA API] Compliance report failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/invoices', async (req, res) => {
  try {
    const { status, serviceType, limit = '50' } = req.query;
    
    let query = db.select().from(electronicInvoices);
    
    if (status) {
      query = query.where(eq(electronicInvoices.itaSubmissionStatus, status as string)) as any;
    }
    
    const invoices = await query.limit(parseInt(limit as string));
    
    res.json({
      success: true,
      invoices,
      count: invoices.length,
    });
  } catch (error: any) {
    logger.error('[ITA API] Invoice list failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const allInvoices = await db.select().from(electronicInvoices);
    
    const stats = {
      total: allInvoices.length,
      byStatus: {
        pending: allInvoices.filter(i => i.itaSubmissionStatus === 'pending').length,
        submitted: allInvoices.filter(i => i.itaSubmissionStatus === 'submitted').length,
        accepted: allInvoices.filter(i => i.itaSubmissionStatus === 'accepted').length,
        rejected: allInvoices.filter(i => i.itaSubmissionStatus === 'rejected').length,
        error: allInvoices.filter(i => i.itaSubmissionStatus === 'error').length,
        not_required: allInvoices.filter(i => i.itaSubmissionStatus === 'not_required').length,
      },
      byType: {
        B2B: allInvoices.filter(i => i.invoiceType === 'B2B').length,
        B2C: allInvoices.filter(i => i.invoiceType === 'B2C').length,
      },
      byService: {
        k9000_wash: allInvoices.filter(i => i.serviceType === 'k9000_wash').length,
        sitter_suite: allInvoices.filter(i => i.serviceType === 'sitter_suite').length,
        walk_my_pet: allInvoices.filter(i => i.serviceType === 'walk_my_pet').length,
        pettrek_transport: allInvoices.filter(i => i.serviceType === 'pettrek_transport').length,
      },
      compliance: {
        requiresElectronic: allInvoices.filter(i => i.requiresElectronicInvoicing).length,
        compliant: allInvoices.filter(i => i.complianceStatus === 'compliant').length,
        warnings: allInvoices.filter(i => i.complianceStatus === 'warning').length,
        nonCompliant: allInvoices.filter(i => i.complianceStatus === 'non_compliant').length,
      },
      totalRevenue: allInvoices.reduce((sum, i) => sum + parseFloat(i.totalAmount), 0).toFixed(2),
      totalVAT: allInvoices.reduce((sum, i) => sum + parseFloat(i.vatAmount), 0).toFixed(2),
    };
    
    res.json({
      success: true,
      stats,
      itaConfigured: IsraeliTaxAPIService.isConfigured(),
    });
  } catch (error: any) {
    logger.error('[ITA API] Statistics failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/compliance/check', async (req, res) => {
  try {
    const updates = await ITAComplianceMonitoringService.checkForUpdates();
    
    res.json({
      success: true,
      updates,
      count: updates.length,
      hasActionRequired: updates.some(u => u.actionRequired),
      criticalCount: updates.filter(u => u.severity === 'critical').length,
    });
  } catch (error: any) {
    logger.error('[ITA API] Compliance check failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/compliance/report-full', async (req, res) => {
  try {
    const report = await ITAComplianceMonitoringService.generateComplianceReport();
    
    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    logger.error('[ITA API] Compliance report generation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/compliance/regulations', async (req, res) => {
  try {
    const regulations = ITAComplianceMonitoringService.getKnownRegulations();
    
    res.json({
      success: true,
      regulations,
    });
  } catch (error: any) {
    logger.error('[ITA API] Regulations fetch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/compliance/reset-circuit-breaker', async (req, res) => {
  try {
    ITAComplianceMonitoringService.resetCircuitBreaker();
    
    res.json({
      success: true,
      message: 'Circuit breaker has been manually reset',
    });
  } catch (error: any) {
    logger.error('[ITA API] Circuit breaker reset failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
