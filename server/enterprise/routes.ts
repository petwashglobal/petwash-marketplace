/**
 * Enterprise Feature Routes
 * All advanced enterprise endpoints
 */

import type { Express } from 'express';
import { deleteUserData, exportUserData } from './userDeletion';
import { handleWhatsAppWebhook } from './whatsappWebhook';
import { generateTaxInvoice, checkInvoiceStatus } from './israeliTax';
import { fetchMizrahiAccountData, reconcileTransaction } from './mizrahiBank';
import { triggerMonthlyInvoicing } from './monthlyInvoicing';
import { adminLimiter } from '../middleware/rateLimiter';
import { requireAdmin, requireAuthenticatedRole } from '../adminAuth';
import { logger } from '../lib/logger';
import enterpriseCorporateRoutes from '../routes/enterprise-corporate';
import enterpriseHrRoutes from '../routes/enterprise-hr';
import enterpriseSalesRoutes from '../routes/enterprise-sales';
import enterpriseSalesCrmRoutes from '../routes/enterprise-sales-crm';
import enterpriseOperationsRoutes from '../routes/enterprise-operations';
import enterpriseLogisticsRoutes from '../routes/enterprise-logistics';
import enterpriseFinanceRoutes from '../routes/enterprise-finance';
import contractsRoutes from '../routes/contracts';

export function registerEnterpriseRoutes(app: Express): void {
  logger.info('[Enterprise] Registering enterprise routes');
  
  // ============================================
  // USER DATA DELETION (GDPR Compliance)
  // ============================================
  
  /**
   * Delete user data (Right to Erasure)
   * POST /api/enterprise/user/delete
   * CRITICAL: Admin authentication required for data erasure
   */
  app.post(
    '/api/enterprise/user/delete',
    adminLimiter,
    requireAdmin,
    deleteUserData
  );
  
  /**
   * Export user data (Right to Access)
   * GET /api/enterprise/user/export?uid=xxx
   * CRITICAL: Admin authentication required for data export
   */
  app.get(
    '/api/enterprise/user/export',
    adminLimiter,
    requireAdmin,
    exportUserData
  );
  
  // ============================================
  // ENTERPRISE INTEGRATIONS - ALL ACTIVE
  // Graceful fallbacks if credentials not configured
  // ============================================
  
  // WHATSAPP BUSINESS INTEGRATION
  app.get('/api/webhooks/whatsapp', handleWhatsAppWebhook);
  app.post('/api/webhooks/whatsapp', handleWhatsAppWebhook);
  
  // ISRAELI TAX (ITA) INTEGRATION  
  app.post('/api/enterprise/tax/invoice', adminLimiter, requireAdmin, generateTaxInvoice);
  app.get('/api/enterprise/tax/invoice/status', adminLimiter, requireAdmin, checkInvoiceStatus);
  
  // MIZRAHI BANK INTEGRATION
  // Finance team can fetch bank data, admins can reconcile transactions
  app.post('/api/enterprise/bank/fetch', adminLimiter, requireAuthenticatedRole(['admin', 'finance']), fetchMizrahiAccountData);
  app.post('/api/enterprise/bank/reconcile', adminLimiter, requireAdmin, reconcileTransaction);
  
  // MONTHLY INVOICING
  app.post('/api/enterprise/invoicing/trigger', adminLimiter, requireAdmin, triggerMonthlyInvoicing);
  
  // AI BOOKKEEPING: Handled via Firestore triggers (no API endpoints needed)
  
  // ============================================
  // CORPORATE, HR, SALES, OPERATIONS, LOGISTICS & FINANCE SYSTEMS
  // ============================================
  app.use('/api/enterprise/corporate', enterpriseCorporateRoutes);
  app.use('/api/enterprise/hr', enterpriseHrRoutes);
  app.use('/api/enterprise/sales', enterpriseSalesRoutes);
  app.use('/api/enterprise/sales/crm', enterpriseSalesCrmRoutes);
  app.use('/api/enterprise/operations', enterpriseOperationsRoutes);
  app.use('/api/enterprise/logistics', enterpriseLogisticsRoutes);
  app.use('/api/enterprise/finance', enterpriseFinanceRoutes);
  app.use('/api/enterprise/contracts', contractsRoutes);
  
  logger.info('[Enterprise] Enterprise routes registered successfully');
  logger.info('[Enterprise] Available endpoints:');
  logger.info('   - POST /api/enterprise/user/delete (GDPR data deletion) [ACTIVE]');
  logger.info('   - GET  /api/enterprise/user/export (GDPR data export) [ACTIVE]');
  logger.info('   - GET/POST /api/webhooks/whatsapp (WhatsApp Business webhook) [ACTIVE]');
  logger.info('   - POST /api/enterprise/tax/invoice (Israeli Tax ITA integration) [ACTIVE]');
  logger.info('   - GET /api/enterprise/tax/invoice/status (Tax invoice status) [ACTIVE]');
  logger.info('   - POST /api/enterprise/bank/fetch (Mizrahi Bank sync) [ACTIVE]');
  logger.info('   - POST /api/enterprise/bank/reconcile (Bank reconciliation) [ACTIVE]');
  logger.info('   - POST /api/enterprise/invoicing/trigger (Monthly invoicing) [ACTIVE]');
  logger.info('   - /api/enterprise/corporate/* (JV Partners, Suppliers, Station Registry) [ACTIVE]');
  logger.info('   - /api/enterprise/hr/* (Employees, Payroll, Time Tracking, Performance Reviews, Recruitment) [ACTIVE]');
  logger.info('   - /api/enterprise/sales/* (Leads, Opportunities, CRM: Communications, Deal Stages, Tasks, Activities) [ACTIVE]');
  logger.info('   - /api/enterprise/operations/* (Tasks, Incidents, SLA Tracking) [ACTIVE]');
  logger.info('   - /api/enterprise/logistics/* (Warehouses, Inventory, Fulfillment Orders) [ACTIVE]');
  logger.info('   - /api/enterprise/finance/* (Accounts Payable, Accounts Receivable, General Ledger) [ACTIVE]');
  logger.info('   - /api/enterprise/contracts/* (Contract Generation, Offer Letters, Contractor Agreements, DocuSeal Integration) [ACTIVE]');
  logger.info('   - ✅ ALL ENTERPRISE SERVICES ACTIVE (graceful fallbacks if credentials missing)');
}
