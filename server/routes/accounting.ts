import crypto from 'crypto';
import { Router, Request, Response } from "express";
import { db } from "../db";
import { z } from "zod";
import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';
import { 
  israeliExpenses, 
  israeliVatDeclarations,
  israeliIncomeTaxDeclarations,
  israeliNationalInsuranceDeclarations,
  israeliMonthlyFinancialPackages,
  transactionRecords,
  taxInvoices,
  employeeHierarchy,
  insertIsraeliExpenseSchema,
  insertIsraeliVatDeclarationSchema,
  insertIsraeliIncomeTaxDeclarationSchema,
  insertIsraeliNationalInsuranceDeclarationSchema,
  insertIsraeliMonthlyFinancialPackageSchema
} from "@shared/schema";
import { eq, and, gte, lt, lte, desc, sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { logger } from "../lib/logger";
import { IsraeliVATReclaimService } from "../services/IsraeliVATReclaimService";
import { recordExpenseSubmission, recordExpenseApproval } from "../utils/auditSignature";

const router = Router();

// Type for authenticated user
interface AuthenticatedUser {
  uid: string;
  email: string;
}

// =================== EMPLOYEE EXPENSE SUBMISSION (AUTHENTICATED ROUTE) ===================
// POST /api/accounting/expenses/employee-submit - Employee expense submission
router.post("/expenses/employee-submit", async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    
    if (!user) {
      return res.status(401).json({ error: "Unauthorized - Please log in" });
    }
    
    const {
      category,
      subcategory,
      description,
      vendor,
      amountBeforeVat,
      vatAmount,
      totalAmount,
      paymentMethod,
      receiptNumber,
      invoiceNumber,
      notes,
      taxMonth,
      taxYear,
    } = req.body;
    
    // Check employee hierarchy for auto-approval (CEO only)
    const [hierarchy] = await db
      .select()
      .from(employeeHierarchy)
      .where(eq(employeeHierarchy.employeeId, user.uid))
      .limit(1);
    
    // Generate expense ID
    const now = new Date();
    const expenseId = `EXP-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${crypto.randomInt(0, 10000).toString().padStart(4, '0')}`;
    
    // Determine initial status and approval
    const isAutoApproved = hierarchy?.autoApprove === true;
    const initialStatus = isAutoApproved ? "approved" : "pending";
    
    // Create expense record
    const [expense] = await db.insert(israeliExpenses).values({
      expenseId,
      category,
      subcategory: subcategory || null,
      description,
      vendor,
      amountBeforeVat: String(amountBeforeVat),
      vatAmount: vatAmount ? String(vatAmount) : "0",
      totalAmount: String(totalAmount),
      vatRate: String(ISRAEL_VAT_RATE),
      paymentMethod,
      receiptNumber: receiptNumber || null,
      invoiceNumber: invoiceNumber || null,
      receiptUrl: null,
      isDeductible: true,
      deductionPercentage: 100,
      taxYear: parseInt(taxYear),
      taxMonth: parseInt(taxMonth),
      status: initialStatus,
      approvedBy: isAutoApproved ? user.uid : null,
      approvedAt: isAutoApproved ? new Date() : null,
      rejectionReason: null,
      notes: notes || null,
      attachments: [],
      createdBy: user.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    // === CRYPTOGRAPHIC AUDIT SIGNATURE (7-year retention compliance) ===
    await recordExpenseSubmission({
      employeeId: user.uid,
      expenseId: expense.expenseId,
      category,
      amount: totalAmount,
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });
    
    // Send WhatsApp notification to supervisor (preferred) or email as fallback
    if (!isAutoApproved && hierarchy?.supervisorId) {
      try {
        // Get supervisor info
        const [supervisor] = await db
          .select()
          .from(employeeHierarchy)
          .where(eq(employeeHierarchy.employeeId, hierarchy.supervisorId))
          .limit(1);
        
        // Get current employee info for notifications
        const [employeeHierarchyInfo] = await db
          .select()
          .from(employeeHierarchy)
          .where(eq(employeeHierarchy.employeeId, user.uid))
          .limit(1);
        
        if (supervisor) {
          // Try WhatsApp first (preferred method)
          if (supervisor.whatsappPhone) {
            const { WhatsAppService } = await import('../services/WhatsAppService');
            await WhatsAppService.sendExpenseApprovalNotification({
              supervisorPhone: supervisor.whatsappPhone,
              employeeName: employeeHierarchyInfo?.position || user.email,
              expenseId: expense.expenseId,
              amount: parseFloat(totalAmount),
              category,
              description,
              language: supervisor.preferredLanguage as 'he' | 'en' || 'he',
            });
            logger.info('[Employee Expense] WhatsApp notification sent to supervisor');
          } else {
            // Fallback to email if WhatsApp not configured
            const { adminUsers } = await import('@shared/schema');
            const [supervisorUser] = await db
              .select()
              .from(adminUsers)
              .where(eq(adminUsers.id, hierarchy.supervisorId))
              .limit(1);
            
            if (supervisorUser) {
              const { EmailService } = await import('../emailService');
              await EmailService.sendEmployeeExpenseNotification({
                expenseId: expense.expenseId,
                employeeEmail: user.email,
                category,
                description,
                totalAmount: parseFloat(totalAmount),
                vendor,
                supervisorEmail: supervisorUser.email,
              });
              logger.info('[Employee Expense] Email notification sent to supervisor (WhatsApp not configured)');
            }
          }
        }
      } catch (notificationError) {
        logger.error('[Employee Expense] Notification failed:', notificationError);
        // Don't fail the request if notification fails
      }
    }
    
    logger.info('[Employee Expense] Expense submitted successfully (with audit signature)', {
      expenseId: expense.expenseId,
      employeeEmail: user.email,
      category,
      amount: totalAmount,
    });
    
    res.json({
      success: true,
      message: "Expense submitted successfully",
      expense,
    });
  } catch (error) {
    logger.error('[Employee Expense] Submission error:', error);
    res.status(500).json({ error: "Failed to submit expense" });
  }
});

// GET /api/accounting/expenses/my-expenses - Get employee's expense history
router.get("/expenses/my-expenses", async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    
    if (!user) {
      return res.status(401).json({ error: "Unauthorized - Please log in" });
    }
    
    // Fetch all expenses for this employee
    const expenses = await db
      .select()
      .from(israeliExpenses)
      .where(eq(israeliExpenses.createdBy, user.uid))
      .orderBy(desc(israeliExpenses.createdAt));
    
    res.json({ expenses });
  } catch (error) {
    logger.error('[Employee Expense] Failed to fetch expenses:', error);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

// RBAC: Only CEO and CFO can access accounting endpoints
const financialAuth = async (req: Request, res: Response, next: Function) => {
  try {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // STRICTLY CEO and National Operations Director corporate emails only - as per spec
    const financialManagement = [
      'nir.h@petwash.co.il',      // CEO - ONLY corporate email
      'ido.s@petwash.co.il'        // National Operations Director (Ido Shakarzi) - ONLY corporate email
    ];
    
    if (!financialManagement.includes(user.email?.toLowerCase())) {
      logger.warn("[Financial API] Unauthorized access attempt", { 
        email: user.email,
        ip: req.ip,
        endpoint: req.path
      });
      return res.status(403).json({ 
        error: "Access denied",
        message: "Only CEO and National Operations Director can access financial data" 
      });
    }
    
    logger.info("[Financial API] Authorized access", { 
      email: user.email,
      endpoint: req.path
    });
    
    next();
  } catch (error) {
    logger.error("[Financial API] Auth error", error);
    res.status(500).json({ error: "Authentication error" });
  }
};

// Apply financial auth to all routes
router.use(financialAuth);

// =================== EXPENSES MANAGEMENT ===================

// GET /api/accounting/expenses - Get all expenses with filtering
router.get("/expenses", async (req: Request, res: Response) => {
  try {
    const { year, month, category, status } = req.query;
    
    let query = db.select().from(israeliExpenses);
    
    const conditions = [];
    if (year) conditions.push(eq(israeliExpenses.taxYear, Number(year)));
    if (month) conditions.push(eq(israeliExpenses.taxMonth, Number(month)));
    if (category) conditions.push(eq(israeliExpenses.category, String(category)));
    if (status) conditions.push(eq(israeliExpenses.status, String(status)));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const expenses = await query.orderBy(desc(israeliExpenses.createdAt));
    
    res.json(expenses);
  } catch (error) {
    logger.error("[Accounting API] Error fetching expenses", error);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

// POST /api/accounting/expenses - Create new expense
router.post("/expenses", async (req: Request, res: Response) => {
  try {
    const validation = insertIsraeliExpenseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors
      });
    }
    
    const validatedData = validation.data;
    const user = (req as Request & { user: AuthenticatedUser }).user;
    
    // Generate expense ID
    const expenseId = `EXP-${validatedData.taxYear}-${String(validatedData.taxMonth).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;
    
    const [expense] = await db.insert(israeliExpenses).values({
      ...validatedData,
      expenseId,
      createdBy: user.uid
    }).returning();
    
    logger.info("[Accounting] New expense created", { expenseId, amount: expense.totalAmount });
    
    res.status(201).json(expense);
  } catch (error) {
    logger.error("[Accounting API] Error creating expense", error);
    const message = error instanceof Error ? error.message : "Failed to create expense";
    res.status(400).json({ error: message });
  }
});

// PATCH /api/accounting/expenses/:id/approve - Approve expense
router.patch("/expenses/:id/approve", async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { user: AuthenticatedUser }).user;
    const { id } = req.params;
    
    const [expense] = await db.update(israeliExpenses)
      .set({
        status: 'approved',
        approvedBy: user.uid,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(israeliExpenses.id, Number(id)))
      .returning();
    
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }
    
    logger.info("[Accounting] Expense approved", { expenseId: expense.expenseId });
    
    res.json(expense);
  } catch (error) {
    logger.error("[Accounting API] Error approving expense", error);
    res.status(500).json({ error: "Failed to approve expense" });
  }
});

// =================== VAT DECLARATIONS (מע"מ) ===================

// GET /api/accounting/vat/declarations - Get VAT declarations
router.get("/vat/declarations", async (req: Request, res: Response) => {
  try {
    const { year, status } = req.query;
    
    let query = db.select().from(israeliVatDeclarations);
    
    const conditions = [];
    if (year) conditions.push(eq(israeliVatDeclarations.taxYear, Number(year)));
    if (status) conditions.push(eq(israeliVatDeclarations.status, String(status)));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const declarations = await query.orderBy(
      desc(israeliVatDeclarations.taxYear),
      desc(israeliVatDeclarations.taxMonth)
    );
    
    res.json(declarations);
  } catch (error) {
    logger.error("[Accounting API] Error fetching VAT declarations", error);
    res.status(500).json({ error: "Failed to fetch VAT declarations" });
  }
});

// POST /api/accounting/vat/calculate - Calculate monthly VAT (Output VAT - Input VAT)
router.post("/vat/calculate", async (req: Request, res: Response) => {
  try {
    const { year, month } = req.body;
    
    if (!year || !month) {
      return res.status(400).json({ error: "Year and month are required" });
    }
    
    // Calculate VAT using new reclaim service
    const vatCalculation = await IsraeliVATReclaimService.calculateMonthlyVAT(year, month);
    
    logger.info("[VAT Reclaim] Calculation requested", {
      year,
      month,
      netVAT: vatCalculation.netVAT.amount,
      status: vatCalculation.netVAT.status
    });
    
    res.json(vatCalculation);
  } catch (error) {
    logger.error("[VAT Reclaim] Calculation error", error);
    const message = error instanceof Error ? error.message : "Failed to calculate VAT";
    res.status(500).json({ error: message });
  }
});

// POST /api/accounting/vat/generate - Generate monthly VAT declaration with automatic reclaim
router.post("/vat/generate", async (req: Request, res: Response) => {
  try {
    const { year, month } = req.body;
    
    if (!year || !month) {
      return res.status(400).json({ error: "Year and month are required" });
    }
    
    // Generate declaration using new reclaim service
    const declarationId = await IsraeliVATReclaimService.generateMonthlyDeclaration(year, month);
    
    // Fetch the created declaration
    const [declaration] = await db.select()
      .from(israeliVatDeclarations)
      .where(eq(israeliVatDeclarations.id, declarationId));
    
    logger.info("[VAT Reclaim] Declaration generated", {
      declarationId: declaration.declarationId,
      netVAT: declaration.netVatPosition
    });
    
    res.status(201).json(declaration);
  } catch (error) {
    logger.error("[VAT Reclaim] Generation error", error);
    const message = error instanceof Error ? error.message : "Failed to generate VAT declaration";
    res.status(400).json({ error: message });
  }
});

// GET /api/accounting/vat/report/:year/:month - Get VAT report HTML
router.get("/vat/report/:year/:month", async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    
    // Calculate VAT
    const vatCalculation = await IsraeliVATReclaimService.calculateMonthlyVAT(year, month);
    
    // Generate HTML report
    const html = IsraeliVATReclaimService.generateVATReportHTML(vatCalculation);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    logger.error("[VAT Reclaim] Report generation error", error);
    const message = error instanceof Error ? error.message : "Failed to generate VAT report";
    res.status(500).json({ error: message });
  }
});

// =================== INCOME TAX DECLARATIONS (מס הכנסה) ===================

// POST /api/accounting/income-tax/generate - Generate monthly income tax declaration
router.post("/income-tax/generate", async (req: Request, res: Response) => {
  try {
    const { year, month } = req.body;
    const user = (req as Request & { user: AuthenticatedUser }).user;
    
    if (!year || !month) {
      return res.status(400).json({ error: "Year and month are required" });
    }
    
    // Calculate period dates
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    
    // Get all transactions (revenue)
    const transactions = await db.select().from(transactionRecords)
      .where(and(
        gte(transactionRecords.timestamp, periodStart),
        lte(transactionRecords.timestamp, periodEnd)
      ));
    
    // Get all approved deductible expenses
    const expenses = await db.select().from(israeliExpenses)
      .where(and(
        eq(israeliExpenses.taxYear, year),
        eq(israeliExpenses.taxMonth, month),
        eq(israeliExpenses.status, 'approved'),
        eq(israeliExpenses.isDeductible, true)
      ));
    
    // Calculate totals
    const grossIncome = transactions.reduce((sum: number, t) => sum + Number(t.totalAmount || 0), 0);
    const netIncome = transactions.reduce((sum: number, t) => sum + Number(t.subtotal || 0), 0);
    
    // Categorize expenses
    const salaryExpenses = expenses
      .filter((e) => e.category === 'salaries')
      .reduce((sum: number, e) => sum + (Number(e.totalAmount || 0) * (e.deductionPercentage || 100) / 100), 0);
    
    const operatingExpenses = expenses
      .filter((e) => !['salaries', 'equipment'].includes(e.category || ''))
      .reduce((sum: number, e) => sum + (Number(e.totalAmount || 0) * (e.deductionPercentage || 100) / 100), 0);
    
    const totalDeductible = salaryExpenses + operatingExpenses;
    const taxableIncome = netIncome - totalDeductible;
    
    // Simple tax estimate (Israeli corporate tax ~23%)
    const estimatedTax = taxableIncome * 0.23;
    
    // Generate declaration ID
    const declarationId = `INCOME-${year}-${String(month).padStart(2, '0')}`;
    
    // Check if exists
    const existing = await db.select().from(israeliIncomeTaxDeclarations)
      .where(eq(israeliIncomeTaxDeclarations.declarationId, declarationId));
    
    if (existing.length > 0) {
      return res.status(409).json({ 
        error: "Declaration already exists",
        declaration: existing[0]
      });
    }
    
    // Create declaration
    const [declaration] = await db.insert(israeliIncomeTaxDeclarations).values({
      declarationId,
      taxYear: year,
      taxMonth: month,
      periodStart,
      periodEnd,
      grossIncome: grossIncome.toFixed(2),
      netIncome: netIncome.toFixed(2),
      totalDeductibleExpenses: totalDeductible.toFixed(2),
      salaryExpenses: salaryExpenses.toFixed(2),
      operatingExpenses: operatingExpenses.toFixed(2),
      depreciation: '0',
      otherDeductions: '0',
      taxableIncome: taxableIncome.toFixed(2),
      estimatedTax: estimatedTax.toFixed(2),
      preparedBy: user.uid,
      status: 'draft'
    }).returning();
    
    logger.info("[Accounting] Income tax declaration generated", { 
      declarationId,
      taxableIncome: taxableIncome.toFixed(2)
    });
    
    res.status(201).json(declaration);
  } catch (error) {
    logger.error("[Accounting API] Error generating income tax declaration", error);
    const message = error instanceof Error ? error.message : "Failed to generate declaration";
    res.status(400).json({ error: message });
  }
});

// =================== NATIONAL INSURANCE (ביטוח לאומי) ===================

// POST /api/accounting/national-insurance/generate
router.post("/national-insurance/generate", async (req: Request, res: Response) => {
  try {
    const { year, month, ownerIncome, totalEmployees, totalGrossSalary } = req.body;
    const user = (req as Request & { user: AuthenticatedUser }).user;
    
    if (!year || !month) {
      return res.status(400).json({ error: "Year and month are required" });
    }
    
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    
    // Calculate contributions (Israeli rates ~7% employer, ~12% employee)
    const employerRate = 0.0745; // 7.45% average
    const employeeRate = 0.12;   // 12% average
    
    const empContribution = (totalGrossSalary || 0) * employerRate;
    const empeeContribution = (totalGrossSalary || 0) * employeeRate;
    const ownerContrib = (ownerIncome || 0) * 0.177; // Self-employed rate ~17.7%
    
    const totalContrib = empContribution + empeeContribution + ownerContrib;
    
    const declarationId = `BTLMI-${year}-${String(month).padStart(2, '0')}`;
    
    // Check if exists
    const existing = await db.select().from(israeliNationalInsuranceDeclarations)
      .where(eq(israeliNationalInsuranceDeclarations.declarationId, declarationId));
    
    if (existing.length > 0) {
      return res.status(409).json({ 
        error: "Declaration already exists",
        declaration: existing[0]
      });
    }
    
    const [declaration] = await db.insert(israeliNationalInsuranceDeclarations).values({
      declarationId,
      taxYear: year,
      taxMonth: month,
      periodStart,
      periodEnd,
      totalEmployees: totalEmployees || 0,
      totalGrossSalary: (totalGrossSalary || 0).toFixed(2),
      employerContribution: empContribution.toFixed(2),
      employeeContribution: empeeContribution.toFixed(2),
      totalContribution: totalContrib.toFixed(2),
      ownerIncome: (ownerIncome || 0).toFixed(2),
      ownerContribution: ownerContrib.toFixed(2),
      preparedBy: user.uid,
      status: 'draft'
    }).returning();
    
    logger.info("[Accounting] National Insurance declaration generated", { 
      declarationId,
      totalContribution: totalContrib.toFixed(2)
    });
    
    res.status(201).json(declaration);
  } catch (error) {
    logger.error("[Accounting API] Error generating National Insurance declaration", error);
    const message = error instanceof Error ? error.message : "Failed to generate declaration";
    res.status(400).json({ error: message });
  }
});

// =================== COMPLETE MONTHLY PACKAGE ===================

// POST /api/accounting/monthly-package/generate - Generate complete package for accountant
router.post("/monthly-package/generate", async (req: Request, res: Response) => {
  try {
    const { year, month, accountantEmail } = req.body;
    const user = (req as Request & { user: AuthenticatedUser }).user;
    
    if (!year || !month) {
      return res.status(400).json({ error: "Year and month are required" });
    }
    
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    
    // Get all three declarations
    const vatDeclarationId = `VAT-${year}-${String(month).padStart(2, '0')}`;
    const incomeTaxDeclarationId = `INCOME-${year}-${String(month).padStart(2, '0')}`;
    const nationalInsuranceDeclarationId = `BTLMI-${year}-${String(month).padStart(2, '0')}`;
    
    const [vatDecl] = await db.select().from(israeliVatDeclarations)
      .where(eq(israeliVatDeclarations.declarationId, vatDeclarationId));
    
    const [incomeTaxDecl] = await db.select().from(israeliIncomeTaxDeclarations)
      .where(eq(israeliIncomeTaxDeclarations.declarationId, incomeTaxDeclarationId));
    
    const [nationalInsuranceDecl] = await db.select().from(israeliNationalInsuranceDeclarations)
      .where(eq(israeliNationalInsuranceDeclarations.declarationId, nationalInsuranceDeclarationId));
    
    if (!vatDecl || !incomeTaxDecl || !nationalInsuranceDecl) {
      return res.status(400).json({ 
        error: "All declarations must be generated first",
        missing: {
          vat: !vatDecl,
          incomeTax: !incomeTaxDecl,
          nationalInsurance: !nationalInsuranceDecl
        }
      });
    }
    
    // Calculate summary
    const totalRevenue = Number(vatDecl.totalRevenue);
    const totalExpenses = Number(vatDecl.totalExpenses);
    const netProfit = totalRevenue - totalExpenses;
    
    const packageId = `FIN-PKG-${year}-${String(month).padStart(2, '0')}`;
    
    // Check if exists
    const existing = await db.select().from(israeliMonthlyFinancialPackages)
      .where(eq(israeliMonthlyFinancialPackages.packageId, packageId));
    
    if (existing.length > 0) {
      return res.status(409).json({ 
        error: "Package already exists",
        package: existing[0]
      });
    }
    
    // Create package
    const [financialPackage] = await db.insert(israeliMonthlyFinancialPackages).values({
      packageId,
      taxYear: year,
      taxMonth: month,
      periodStart,
      periodEnd,
      vatDeclarationId,
      incomeTaxDeclarationId,
      nationalInsuranceDeclarationId,
      totalRevenue: totalRevenue.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      netProfit: netProfit.toFixed(2),
      status: 'ready_for_review',
      accountantEmail: accountantEmail || null,
      preparedBy: user.uid
    }).returning();
    
    logger.info("[Accounting] Monthly financial package created", { 
      packageId,
      netProfit: netProfit.toFixed(2)
    });
    
    res.status(201).json(financialPackage);
  } catch (error) {
    logger.error("[Accounting API] Error generating monthly package", error);
    const message = error instanceof Error ? error.message : "Failed to generate package";
    res.status(400).json({ error: message });
  }
});

// GET /api/accounting/monthly-package/:packageId/export - Export package as Excel
router.get("/monthly-package/:packageId/export", async (req: Request, res: Response) => {
  try {
    const { packageId } = req.params;
    
    // Get package with all declarations
    const [financialPackage] = await db.select().from(israeliMonthlyFinancialPackages)
      .where(eq(israeliMonthlyFinancialPackages.packageId, packageId));
    
    if (!financialPackage) {
      return res.status(404).json({ error: "Package not found" });
    }
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '⁦Pet Wash™⁩ Accounting System';
    workbook.created = new Date();
    
    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Item', key: 'item', width: 30 },
      { header: 'Amount (₪)', key: 'amount', width: 20 }
    ];
    
    summarySheet.addRows([
      { item: 'Total Revenue', amount: financialPackage.totalRevenue },
      { item: 'Total Expenses', amount: financialPackage.totalExpenses },
      { item: 'Net Profit/Loss', amount: financialPackage.netProfit },
    ]);
    
    // VAT sheet
    const vatSheet = workbook.addWorksheet('VAT (מע"מ)');
    // ... add VAT details
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${packageId}.xlsx"`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
    
    logger.info("[Accounting] Package exported", { packageId });
  } catch (error) {
    logger.error("[Accounting API] Error exporting package", error);
    res.status(500).json({ error: "Failed to export package" });
  }
});

// =================== DASHBOARD SUMMARY ===================

// GET /api/accounting/dashboard - Get financial overview
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // Get current month's data
    const [currentVatDecl] = await db.select().from(israeliVatDeclarations)
      .where(and(
        eq(israeliVatDeclarations.taxYear, currentYear),
        eq(israeliVatDeclarations.taxMonth, currentMonth)
      ));
    
    // Get pending expenses
    const pendingExpenses = await db.select().from(israeliExpenses)
      .where(eq(israeliExpenses.status, 'pending'));
    
    // Get year-to-date summary
    const ytdTransactions = await db.select({
      totalRevenue: sql<number>`SUM(${transactionRecords.totalAmount})`,
      totalVat: sql<number>`SUM(${transactionRecords.vatAmount})`,
      count: sql<number>`COUNT(*)`
    }).from(transactionRecords)
      .where(gte(transactionRecords.timestamp, new Date(currentYear, 0, 1)));
    
    res.json({
      currentMonth: {
        year: currentYear,
        month: currentMonth,
        vatDeclaration: currentVatDecl || null
      },
      pendingExpensesCount: pendingExpenses.length,
      yearToDate: ytdTransactions[0]
    });
  } catch (error) {
    logger.error("[Accounting API] Error fetching dashboard", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

// =================== EMAIL SAMPLE TRIGGERS (CEO/CFO ONLY) ===================
// POST /api/accounting/email/send-blank-form - Send blank expense form draft (Nir & Ido)
router.post("/email/send-blank-form", async (req: Request, res: Response) => {
  try {
    const { EmailService } = await import('../emailService');
    await EmailService.sendBlankExpenseFormDraft();
    logger.info('[Email] Blank expense form draft sent successfully');
    res.json({ success: true, message: "Blank expense form draft sent to Nir and Ido" });
  } catch (error) {
    logger.error("[Email] Error sending blank form:", error);
    res.status(500).json({ error: "Failed to send blank form" });
  }
});

// POST /api/accounting/email/send-sample-vat - Send sample VAT submission (Nir & Ido)
router.post("/email/send-sample-vat", async (req: Request, res: Response) => {
  try {
    const { EmailService } = await import('../emailService');
    await EmailService.sendSampleVATSubmissionTaxAuthority();
    logger.info('[Email] Sample VAT submission sent successfully');
    res.json({ success: true, message: "Sample VAT submission sent to Nir and Ido" });
  } catch (error) {
    logger.error("[Email] Error sending sample VAT:", error);
    res.status(500).json({ error: "Failed to send sample VAT" });
  }
});

// POST /api/accounting/email/send-loyalty-enrollment - Send Prestige Loyalty enrollment confirmation
router.post("/email/send-loyalty-enrollment", async (req: Request, res: Response) => {
  try {
    const loyaltyEmailSchema = z.object({
      email: z.string().email(),
      firstName: z.string().min(1),
      tier: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']).optional().default('bronze'),
      points: z.number().int().min(0).optional().default(100),
      language: z.enum(['he', 'en']).optional().default('he'),
    });
    const data = loyaltyEmailSchema.parse(req.body);
    const { sendLoyaltyEnrollmentConfirmation } = await import('../email/luxury-email-service');
    const sent = await sendLoyaltyEnrollmentConfirmation(
      data.email,
      data.firstName,
      data.tier,
      data.points,
      data.language
    );
    logger.info('[Email] Loyalty enrollment confirmation sent', { email: data.email, firstName: data.firstName, tier: data.tier });
    res.json({ success: sent, message: sent ? "Loyalty enrollment email sent" : "Email sending failed (check SendGrid config)" });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    logger.error("[Email] Error sending loyalty enrollment:", error);
    res.status(500).json({ error: "Failed to send loyalty enrollment email" });
  }
});

// POST /api/accounting/email/send-egift-purchase - Send E-Gift purchase confirmation to buyer
router.post("/email/send-egift-purchase", async (req: Request, res: Response) => {
  try {
    const egiftEmailSchema = z.object({
      buyerEmail: z.string().email(),
      buyerName: z.string().min(1),
      recipientName: z.string().min(1),
      giftValue: z.number().min(50).max(10000).optional().default(200),
      personalMessage: z.string().max(500).optional(),
      language: z.enum(['he', 'en']).optional().default('he'),
      seasonalTheme: z.enum(['general', 'black_friday', 'valentines', 'christmas', 'hannukah', 'purim']).optional().default('general'),
    });
    const data = egiftEmailSchema.parse(req.body);
    const { generateEGiftPurchaseConfirmation } = await import('../email/templates/egift-purchase-confirmation-2026');
    const { sendLuxuryEmail } = await import('../email/luxury-email-service');
    const crypto = await import('crypto');
    const voucherId = `PWV-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const transactionHash = crypto.createHash('sha256').update(`${voucherId}|${Date.now()}`).digest('hex');
    const { subject, html } = generateEGiftPurchaseConfirmation({
      buyerName: data.buyerName,
      buyerEmail: data.buyerEmail,
      recipientName: data.recipientName,
      giftValue: data.giftValue,
      currency: 'ILS',
      voucherId,
      transactionHash,
      personalMessage: data.personalMessage,
      deliveryMethod: 'email',
      seasonalTheme: data.seasonalTheme,
      language: data.language,
    });
    const sent = await sendLuxuryEmail({ to: data.buyerEmail, subject, html });
    logger.info('[Email] E-Gift purchase confirmation sent', { buyerEmail: data.buyerEmail, buyerName: data.buyerName, recipientName: data.recipientName, giftValue: data.giftValue });
    res.json({ success: sent, message: sent ? "E-Gift purchase confirmation email sent" : "Email sending failed (check SendGrid config)", voucherId });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    logger.error("[Email] Error sending e-gift purchase confirmation:", error);
    res.status(500).json({ error: "Failed to send e-gift purchase confirmation email" });
  }
});

// GET /api/accounting/financial-overview - Comprehensive financial overview with transactions, cash flow, income, costs
router.get("/financial-overview", async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || 0;

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const monthStart = month > 0 ? new Date(year, month - 1, 1) : yearStart;
    const monthEnd = month > 0 ? new Date(year, month, 1) : yearEnd;

    const [recentTransactions, monthlyRevenue, monthlyExpenses, ytdSummary, expensesByCategory] = await Promise.all([
      db.select().from(transactionRecords)
        .where(and(
          gte(transactionRecords.timestamp, monthStart),
          lt(transactionRecords.timestamp, monthEnd)
        ))
        .orderBy(desc(transactionRecords.timestamp))
        .limit(100),

      db.select({
        month: sql<number>`EXTRACT(MONTH FROM ${transactionRecords.timestamp})`,
        revenue: sql<number>`COALESCE(SUM(CAST(${transactionRecords.totalAmount} AS NUMERIC)), 0)`,
        vat: sql<number>`COALESCE(SUM(CAST(${transactionRecords.vatAmount} AS NUMERIC)), 0)`,
        fees: sql<number>`COALESCE(SUM(CAST(${transactionRecords.processingFee} AS NUMERIC)), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(transactionRecords)
        .where(gte(transactionRecords.timestamp, yearStart))
        .groupBy(sql`EXTRACT(MONTH FROM ${transactionRecords.timestamp})`)
        .orderBy(sql`EXTRACT(MONTH FROM ${transactionRecords.timestamp})`),

      db.select({
        month: sql<number>`EXTRACT(MONTH FROM ${israeliExpenses.createdAt})`,
        total: sql<number>`COALESCE(SUM(CAST(${israeliExpenses.totalAmount} AS NUMERIC)), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(israeliExpenses)
        .where(and(
          gte(israeliExpenses.createdAt, yearStart),
          eq(israeliExpenses.status, 'approved')
        ))
        .groupBy(sql`EXTRACT(MONTH FROM ${israeliExpenses.createdAt})`)
        .orderBy(sql`EXTRACT(MONTH FROM ${israeliExpenses.createdAt})`),

      db.select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${transactionRecords.totalAmount} AS NUMERIC)), 0)`,
        totalVat: sql<number>`COALESCE(SUM(CAST(${transactionRecords.vatAmount} AS NUMERIC)), 0)`,
        totalFees: sql<number>`COALESCE(SUM(CAST(${transactionRecords.processingFee} AS NUMERIC)), 0)`,
        txCount: sql<number>`COUNT(*)`,
      }).from(transactionRecords)
        .where(gte(transactionRecords.timestamp, yearStart)),

      db.select({
        category: israeliExpenses.category,
        total: sql<number>`COALESCE(SUM(CAST(${israeliExpenses.totalAmount} AS NUMERIC)), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(israeliExpenses)
        .where(and(
          gte(israeliExpenses.createdAt, yearStart),
          eq(israeliExpenses.status, 'approved')
        ))
        .groupBy(israeliExpenses.category),
    ]);

    const totalExpenses = expensesByCategory.reduce((sum, c) => sum + Number(c.total || 0), 0);
    const totalRevenue = Number(ytdSummary[0]?.totalRevenue || 0);
    const totalVat = Number(ytdSummary[0]?.totalVat || 0);
    const totalFees = Number(ytdSummary[0]?.totalFees || 0);
    const netIncome = totalRevenue - totalVat - totalFees - totalExpenses;

    const cashFlow = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const rev = monthlyRevenue.find(r => Number(r.month) === m);
      const exp = monthlyExpenses.find(e => Number(e.month) === m);
      const income = Number(rev?.revenue || 0);
      const costs = Number(exp?.total || 0) + Number(rev?.fees || 0);
      return {
        month: m,
        monthName: new Date(year, i).toLocaleString('en-US', { month: 'short' }),
        income,
        costs,
        net: income - costs,
        transactionCount: Number(rev?.count || 0),
      };
    });

    res.json({
      year,
      transactions: recentTransactions,
      cashFlow,
      income: {
        totalRevenue,
        totalVat,
        totalFees,
        netIncome,
        transactionCount: Number(ytdSummary[0]?.txCount || 0),
      },
      runningCosts: {
        totalExpenses,
        byCategory: expensesByCategory.map(c => ({
          category: c.category,
          total: Number(c.total),
          count: Number(c.count),
        })),
      },
    });
  } catch (error) {
    logger.error("[Accounting API] Error fetching financial overview", error);
    res.status(500).json({ error: "Failed to fetch financial overview" });
  }
});

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const [revenueRows] = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CAST(final_amount AS DECIMAL)), 0) as total_revenue,
        COALESCE(SUM(CAST(platform_fee AS DECIMAL)), 0) as platform_fees,
        COALESCE(SUM(CAST(provider_payout AS DECIMAL)), 0) as provider_payouts
      FROM transaction_records
      WHERE created_at >= ${startDate} AND created_at <= ${endDate}
        AND status = 'completed'
    `).catch(() => [{ total_revenue: 0, platform_fees: 0, provider_payouts: 0 }]);

    const [escrowRows] = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(escrow_amount AS DECIMAL)), 0) as escrow_held
      FROM transaction_records
      WHERE status = 'escrow_held'
    `).catch(() => [{ escrow_held: 0 }]);

    const [vatRows] = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(vat_amount AS DECIMAL)), 0) as total_vat
      FROM transaction_records
      WHERE created_at >= ${startDate} AND created_at <= ${endDate}
    `).catch(() => [{ total_vat: 0 }]);

    const revenue: any = Array.isArray(revenueRows) ? revenueRows[0] : revenueRows;
    const escrow: any = Array.isArray(escrowRows) ? escrowRows[0] : escrowRows;
    const vat: any = Array.isArray(vatRows) ? vatRows[0] : vatRows;

    res.json({
      success: true,
      data: {
        metrics: {
          totalRevenue: { amount: Number(revenue?.total_revenue || 0), currency: 'ILS' },
          platformFees: { amount: Number(revenue?.platform_fees || 0), currency: 'ILS' },
          providerPayouts: { amount: Number(revenue?.provider_payouts || 0), currency: 'ILS' },
          escrowHeld: { amount: Number(escrow?.escrow_held || 0), currency: 'ILS' },
        },
        taxes: {
          vatCollected: { amount: Number(vat?.total_vat || 0), rate: 0.18 },
          period: `${year}-${String(month).padStart(2, '0')}`,
        },
        complianceStatus: {
          vatFiled: false,
          incomeTaxFiled: false,
          nationalInsuranceFiled: false,
          lastUpdated: new Date().toISOString(),
        },
      },
      period: { year, month },
    });
  } catch (error) {
    logger.error("[Accounting API] Error fetching summary", error);
    res.status(500).json({ error: "Failed to fetch accounting summary" });
  }
});

router.post("/export/transactions", async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      exportedCount: 0,
      spreadsheetUrl: null,
      message: "Transaction export queued — Google Sheets integration required",
    });
  } catch (error) {
    res.status(500).json({ error: "Export failed" });
  }
});

router.post("/export/compliance", async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      exportedCount: 0,
      spreadsheetUrl: null,
      message: "Compliance report export queued — Google Sheets integration required",
    });
  } catch (error) {
    res.status(500).json({ error: "Export failed" });
  }
});

router.post("/export/escrow", async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      exportedCount: 0,
      spreadsheetUrl: null,
      message: "Escrow status export queued — Google Sheets integration required",
    });
  } catch (error) {
    res.status(500).json({ error: "Export failed" });
  }
});

export default router;
