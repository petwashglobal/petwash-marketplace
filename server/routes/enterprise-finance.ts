import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../adminAuth";
import {
  insertAccountsPayableSchema,
  insertAccountsReceivableSchema,
  insertGeneralLedgerSchema,
  insertTaxReturnSchema,
  insertTaxPaymentSchema,
  insertTaxAuditLogSchema,
} from "@shared/schema-finance";
import TaxComplianceService from "../services/TaxComplianceService";

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// =================== ACCOUNTS PAYABLE ROUTES ===================

router.get("/accounts-payable", async (_req, res, next) => {
  try {
    const payables = await storage.getAllAccountsPayable();
    res.json(payables);
  } catch (error) {
    next(error);
  }
});

router.get("/accounts-payable/overdue", async (_req, res, next) => {
  try {
    const overdue = await storage.getOverduePayables();
    res.json(overdue);
  } catch (error) {
    next(error);
  }
});

router.get("/accounts-payable/supplier/:supplierId", async (req, res, next) => {
  try {
    const supplierId = parseInt(req.params.supplierId);
    const payables = await storage.getPayablesBySupplier(supplierId);
    res.json(payables);
  } catch (error) {
    next(error);
  }
});

router.get("/accounts-payable/status/:status", async (req, res, next) => {
  try {
    const payables = await storage.getPayablesByStatus(req.params.status);
    res.json(payables);
  } catch (error) {
    next(error);
  }
});

router.get("/accounts-payable/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const payable = await storage.getAccountsPayableById(id);
    if (!payable) {
      return res.status(404).json({ error: "Accounts payable not found" });
    }
    res.json(payable);
  } catch (error) {
    next(error);
  }
});

router.post("/accounts-payable", async (req, res, next) => {
  try {
    const data = insertAccountsPayableSchema.parse(req.body);
    const payable = await storage.createAccountsPayable(data);
    res.status(201).json(payable);
  } catch (error) {
    next(error);
  }
});

router.patch("/accounts-payable/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const payable = await storage.updateAccountsPayable(id, req.body);
    res.json(payable);
  } catch (error) {
    next(error);
  }
});

router.delete("/accounts-payable/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteAccountsPayable(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/accounts-payable/:id/pay", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({
      paymentDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
      paymentMethod: z.string(),
      paymentReference: z.string().optional(),
    });
    const { paymentDate, paymentMethod, paymentReference } = schema.parse(req.body);
    const payable = await storage.markPayableAsPaid(id, paymentDate, paymentMethod, paymentReference);
    res.json(payable);
  } catch (error) {
    next(error);
  }
});

// =================== ACCOUNTS RECEIVABLE ROUTES ===================

router.get("/accounts-receivable", async (_req, res, next) => {
  try {
    const receivables = await storage.getAllAccountsReceivable();
    res.json(receivables);
  } catch (error) {
    next(error);
  }
});

router.get("/accounts-receivable/overdue", async (_req, res, next) => {
  try {
    const overdue = await storage.getOverdueReceivables();
    res.json(overdue);
  } catch (error) {
    next(error);
  }
});

router.get("/accounts-receivable/customer/:customerId", async (req, res, next) => {
  try {
    const receivables = await storage.getReceivablesByCustomer(req.params.customerId);
    res.json(receivables);
  } catch (error) {
    next(error);
  }
});

router.get("/accounts-receivable/status/:status", async (req, res, next) => {
  try {
    const receivables = await storage.getReceivablesByStatus(req.params.status);
    res.json(receivables);
  } catch (error) {
    next(error);
  }
});

router.get("/accounts-receivable/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const receivable = await storage.getAccountsReceivableById(id);
    if (!receivable) {
      return res.status(404).json({ error: "Accounts receivable not found" });
    }
    res.json(receivable);
  } catch (error) {
    next(error);
  }
});

router.post("/accounts-receivable", async (req, res, next) => {
  try {
    const data = insertAccountsReceivableSchema.parse(req.body);
    const receivable = await storage.createAccountsReceivable(data);
    res.status(201).json(receivable);
  } catch (error) {
    next(error);
  }
});

router.patch("/accounts-receivable/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const receivable = await storage.updateAccountsReceivable(id, req.body);
    res.json(receivable);
  } catch (error) {
    next(error);
  }
});

router.delete("/accounts-receivable/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteAccountsReceivable(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/accounts-receivable/:id/payment", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({
      amount: z.number(),
      paymentDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
      paymentMethod: z.string(),
    });
    const { amount, paymentDate, paymentMethod } = schema.parse(req.body);
    const receivable = await storage.recordReceivablePayment(id, amount, paymentDate, paymentMethod);
    res.json(receivable);
  } catch (error) {
    next(error);
  }
});

// =================== GENERAL LEDGER ROUTES ===================

router.get("/general-ledger", async (_req, res, next) => {
  try {
    const entries = await storage.getAllGeneralLedgerEntries();
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

router.get("/general-ledger/account/:accountCode", async (req, res, next) => {
  try {
    const entries = await storage.getEntriesByAccount(req.params.accountCode);
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

router.get("/general-ledger/fiscal/:year/:period", async (req, res, next) => {
  try {
    const year = parseInt(req.params.year);
    const period = parseInt(req.params.period);
    const entries = await storage.getEntriesByFiscalPeriod(year, period);
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

router.get("/general-ledger/trial-balance/:year/:period", async (req, res, next) => {
  try {
    const year = parseInt(req.params.year);
    const period = parseInt(req.params.period);
    const balance = await storage.getTrialBalance(year, period);
    res.json(balance);
  } catch (error) {
    next(error);
  }
});

router.get("/general-ledger/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const entry = await storage.getGeneralLedgerById(id);
    if (!entry) {
      return res.status(404).json({ error: "General ledger entry not found" });
    }
    res.json(entry);
  } catch (error) {
    next(error);
  }
});

router.post("/general-ledger", async (req, res, next) => {
  try {
    const data = insertGeneralLedgerSchema.parse(req.body);
    const entry = await storage.createGeneralLedgerEntry(data);
    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

router.post("/general-ledger/:id/reconcile", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const entry = await storage.reconcileEntry(id);
    res.json(entry);
  } catch (error) {
    next(error);
  }
});

// =================== TAX COMPLIANCE ROUTES ===================

router.get("/tax-returns", async (_req, res, next) => {
  try {
    const returns = await storage.getAllTaxReturns();
    res.json(returns);
  } catch (error) {
    next(error);
  }
});

router.get("/tax-returns/period/:year/:period", async (req, res, next) => {
  try {
    const year = parseInt(req.params.year);
    const period = req.params.period;
    const returns = await storage.getTaxReturnsByPeriod(year, period);
    res.json(returns);
  } catch (error) {
    next(error);
  }
});

router.get("/tax-returns/status/:status", async (req, res, next) => {
  try {
    const returns = await storage.getTaxReturnsByStatus(req.params.status);
    res.json(returns);
  } catch (error) {
    next(error);
  }
});

router.get("/tax-returns/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const taxReturn = await storage.getTaxReturnById(id);
    if (!taxReturn) {
      return res.status(404).json({ error: "Tax return not found" });
    }
    res.json(taxReturn);
  } catch (error) {
    next(error);
  }
});

router.post("/tax-returns", async (req, res, next) => {
  try {
    const data = insertTaxReturnSchema.parse(req.body);
    
    // Get user info for audit trail
    const userId = req.adminUser?.id || req.session?.adminId || 'system';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || null;
    const userAgent = req.headers['user-agent'] || null;
    
    // Create tax return with VAT calculation and audit trail
    const result = await TaxComplianceService.createTaxReturn(
      data,
      userId.toString(),
      ipAddress,
      userAgent
    );
    
    // Save to database
    const taxReturn = await storage.createTaxReturn(result.taxReturn);
    
    // Create audit log entry
    await storage.createTaxAuditLog({
      entityType: 'tax_return',
      entityId: taxReturn.id!,
      action: 'created',
      userId: userId.toString(),
      previousValue: null,
      newValue: JSON.stringify(taxReturn),
      timestamp: new Date(),
      auditHash: result.auditHash,
      ipAddress,
      userAgent,
    });
    
    res.status(201).json({
      ...taxReturn,
      auditId: result.auditId,
      auditHash: result.auditHash,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/tax-returns/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const taxReturn = await storage.updateTaxReturn(id, req.body);
    res.json(taxReturn);
  } catch (error) {
    next(error);
  }
});

router.post("/tax-returns/:id/submit", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { submittedBy } = req.body;
    
    // Get tax return details
    const taxReturn = await storage.getTaxReturnById(id);
    if (!taxReturn) {
      return res.status(404).json({ error: "Tax return not found" });
    }
    
    // Get user info for audit trail
    const userId = submittedBy || req.adminUser?.id || req.session?.adminId || 'system';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || null;
    const userAgent = req.headers['user-agent'] || null;
    
    // Submit to ITA via TaxComplianceService
    const submissionResult = await TaxComplianceService.submitTaxReturn(
      taxReturn,
      userId.toString(),
      ipAddress,
      userAgent
    );
    
    // Update tax return status
    const updatedTaxReturn = await storage.updateTaxReturn(id, {
      status: submissionResult.success ? 'submitted' : 'pending',
      submittedAt: new Date(),
      submittedBy: userId.toString(),
      itaReferenceNumber: submissionResult.itaReference,
    });
    
    // Create audit log entry
    await storage.createTaxAuditLog({
      entityType: 'tax_return',
      entityId: id,
      action: submissionResult.success ? 'submitted_to_ita' : 'submission_failed',
      userId: userId.toString(),
      previousValue: JSON.stringify({ status: taxReturn.status }),
      newValue: JSON.stringify({ 
        status: updatedTaxReturn.status,
        itaReference: submissionResult.itaReference 
      }),
      timestamp: new Date(),
      auditHash: null,
      ipAddress,
      userAgent,
    });
    
    res.json({
      ...updatedTaxReturn,
      submissionResult,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/tax-payments", async (_req, res, next) => {
  try {
    const payments = await storage.getAllTaxPayments();
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

router.get("/tax-payments/return/:taxReturnId", async (req, res, next) => {
  try {
    const taxReturnId = parseInt(req.params.taxReturnId);
    const payments = await storage.getTaxPaymentsByReturn(taxReturnId);
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

router.get("/tax-payments/date-range", async (req, res, next) => {
  try {
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);
    const payments = await storage.getTaxPaymentsByDateRange(startDate, endDate);
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

router.get("/tax-payments/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const payment = await storage.getTaxPaymentById(id);
    if (!payment) {
      return res.status(404).json({ error: "Tax payment not found" });
    }
    res.json(payment);
  } catch (error) {
    next(error);
  }
});

router.post("/tax-payments", async (req, res, next) => {
  try {
    const data = insertTaxPaymentSchema.parse(req.body);
    
    // Get user info for audit trail
    const userId = req.adminUser?.id || req.session?.adminId || 'system';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || null;
    const userAgent = req.headers['user-agent'] || null;
    
    // Record payment with audit trail
    const result = await TaxComplianceService.recordTaxPayment(
      data,
      userId.toString(),
      ipAddress,
      userAgent
    );
    
    // Save to database
    const payment = await storage.createTaxPayment(result.payment);
    
    // Create audit log entry
    await storage.createTaxAuditLog({
      entityType: 'tax_payment',
      entityId: payment.id!,
      action: 'created',
      userId: userId.toString(),
      previousValue: null,
      newValue: JSON.stringify(payment),
      timestamp: new Date(),
      auditHash: result.auditHash,
      ipAddress,
      userAgent,
    });
    
    res.status(201).json({
      ...payment,
      auditId: result.auditId,
      auditHash: result.auditHash,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/tax-audit-logs", async (_req, res, next) => {
  try {
    const logs = await storage.getAllTaxAuditLogs();
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

router.get("/tax-audit-logs/entity/:entityType/:entityId", async (req, res, next) => {
  try {
    const entityType = req.params.entityType;
    const entityId = parseInt(req.params.entityId);
    const logs = await storage.getTaxAuditLogsByEntity(entityType, entityId);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

router.get("/tax-audit-logs/user/:userId", async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const logs = await storage.getTaxAuditLogsByUser(userId);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

router.get("/tax-audit-logs/date-range", async (req, res, next) => {
  try {
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);
    const logs = await storage.getTaxAuditLogsByDateRange(startDate, endDate);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

router.get("/tax-audit-logs/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const log = await storage.getTaxAuditLogById(id);
    if (!log) {
      return res.status(404).json({ error: "Tax audit log not found" });
    }
    res.json(log);
  } catch (error) {
    next(error);
  }
});

router.post("/tax-audit-logs", async (req, res, next) => {
  try {
    const data = insertTaxAuditLogSchema.parse(req.body);
    const log = await storage.createTaxAuditLog(data);
    res.status(201).json(log);
  } catch (error) {
    next(error);
  }
});

export default router;
