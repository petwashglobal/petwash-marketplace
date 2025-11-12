import { Router, Request, Response } from "express";
import { db } from "../db";
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
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
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
    const expenseId = `EXP-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    
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
      vatRate: "0.18",
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
    workbook.creator = 'Pet Wash™ Accounting System';
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

export default router;
