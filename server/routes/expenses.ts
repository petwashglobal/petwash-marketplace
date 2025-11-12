import { Router, type Request, Response } from "express";
import { db } from "../db";
import { expenses, taxRateHistory, type Expense, type InsertExpense } from "../../shared/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { taxRateService } from "../services/taxRateService";
import { expensePolicyService } from "../services/expensePolicyService";
import { receiptOCRService } from "../services/ReceiptOCRService";
import { z } from "zod";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/config/tax-rates", async (req: Request, res: Response) => {
  try {
    const asOfDateStr = req.query.asOfDate as string | undefined;
    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : undefined;

    const rates = await taxRateService.getCurrentTaxRates(asOfDate);

    res.json({
      success: true,
      data: rates,
      queriedAt: asOfDate || new Date(),
    });
  } catch (error: any) {
    console.error("Error fetching tax rates:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * OCR Smart-Fill Endpoint
 * Camera-First UI/UX Mandate: Extract receipt data automatically
 */
router.post("/expenses/ocr-receipt", upload.single('receipt'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No receipt image provided",
      });
    }

    // Validate image
    const validation = await receiptOCRService.validateReceiptImage(req.file.buffer);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.message || "Invalid receipt image",
      });
    }

    // Extract receipt data using OCR
    const receiptData = await receiptOCRService.extractReceiptData(req.file.buffer);

    res.json({
      success: true,
      data: {
        date: receiptData.date,
        amount: receiptData.totalAmount,
        vendorName: receiptData.vendorName,
        taxId: receiptData.taxId,
        rawText: receiptData.rawText,
        confidence: receiptData.confidence,
      },
      message: "✅ קבלה נסרקה בהצלחה / Receipt scanned successfully",
    });
  } catch (error: any) {
    console.error("Error processing receipt OCR:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process receipt",
    });
  }
});

router.post("/expenses", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const expenseData = req.body;

    const category = expenseData.category?.toLowerCase() || 'other';
    const expenseDate = new Date(expenseData.expenseDate);
    const totalAmount = parseFloat(expenseData.totalAmountILS);

    const vatInfo = await taxRateService.getVATRateByExpenseCategory(category, expenseDate);
    const { netAmount, vatAmount } = taxRateService.calculateVATAmounts(totalAmount, vatInfo.rate);

    const expenseToCreate: Partial<Expense> = {
      employeeId: user.id,
      employeeName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      employeeEmail: user.email,
      businessId: expenseData.businessId || 'petwash-ltd',
      departmentId: expenseData.departmentId,
      expenseDate: expenseData.expenseDate,
      reportPeriod: expenseDate.toISOString().slice(0, 7),
      totalAmountILS: totalAmount.toString(),
      netAmountILS: netAmount.toString(),
      vatAmountILS: vatAmount.toString(),
      vatRateApplied: vatInfo.rate.toString(),
      vatExemptionReason: vatInfo.exemptionReason,
      category: expenseData.category,
      subcategory: expenseData.subcategory,
      description: expenseData.description,
      receiptImageUrls: expenseData.receiptImageUrls || [],
      receiptOcrText: expenseData.receiptOcrText,
      receiptVendorName: expenseData.receiptVendorName,
      receiptVendorTaxId: expenseData.receiptVendorTaxId,
      mileageKm: expenseData.mileageKm,
      mileageRatePerKm: expenseData.mileageRatePerKm,
      locationName: expenseData.locationName,
      locationCoordinates: expenseData.locationCoordinates,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };

    const validation = await expensePolicyService.validateExpense(expenseToCreate);

    const CEO_EMAIL = 'nirhadad1@gmail.com';
    const isCEO = user.email.toLowerCase() === CEO_EMAIL.toLowerCase();
    
    const finalStatus = isCEO 
      ? (validation.isValid ? 'approved' : 'draft')
      : (validation.isValid ? 'pending' : 'draft');
    
    const approverId = isCEO ? user.id : 'CEO_DEFAULT';
    const approverName = isCEO ? null : 'Nir Hadad (CEO)';
    
    const newExpense = await db.insert(expenses).values({
      ...expenseToCreate,
      status: finalStatus,
      policyViolations: validation.violations,
      policyStatus: validation.policyStatus,
      approverId: approverId,
      approverName: approverName,
      submittedAt: validation.isValid ? new Date() : null,
      approvedAt: isCEO && validation.isValid ? new Date() : null,
    } as any).returning();

    res.status(201).json({
      success: true,
      data: newExpense[0],
      validation: {
        isValid: validation.isValid,
        violations: validation.violations,
        policyStatus: validation.policyStatus,
      },
    });
  } catch (error: any) {
    console.error("Error creating expense:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/expenses", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const status = req.query.status as string | undefined;
    const reportPeriod = req.query.reportPeriod as string | undefined;

    let query = db.select().from(expenses).where(eq(expenses.employeeId, user.id));

    if (status) {
      query = query.where(and(
        eq(expenses.employeeId, user.id),
        eq(expenses.status, status)
      ));
    }

    if (reportPeriod) {
      query = query.where(and(
        eq(expenses.employeeId, user.id),
        eq(expenses.reportPeriod, reportPeriod)
      ));
    }

    const userExpenses = await query.orderBy(desc(expenses.createdAt));

    res.json({
      success: true,
      data: userExpenses,
    });
  } catch (error: any) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/expenses/pending-approval", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const CEO_EMAIL = 'nirhadad1@gmail.com';
    const isCEO = user.email.toLowerCase() === CEO_EMAIL.toLowerCase();
    
    const whereConditions = isCEO 
      ? and(
          eq(expenses.status, 'pending'),
          or(
            eq(expenses.approverId, user.id),
            eq(expenses.approverId, 'CEO_DEFAULT')
          )
        )
      : and(
          eq(expenses.status, 'pending'),
          eq(expenses.approverId, user.id)
        );

    const pendingExpenses = await db
      .select()
      .from(expenses)
      .where(whereConditions)
      .orderBy(desc(expenses.submittedAt));

    res.json({
      success: true,
      data: pendingExpenses,
    });
  } catch (error: any) {
    console.error("Error fetching pending approvals:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.patch("/expenses/:id/approve", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const expenseId = parseInt(req.params.id);

    const expense = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);

    if (expense.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Expense not found",
      });
    }

    const CEO_EMAIL = 'nirhadad1@gmail.com';
    const isCEO = user.email.toLowerCase() === CEO_EMAIL.toLowerCase();
    const canApprove = expense[0].approverId === user.id || (isCEO && expense[0].approverId === 'CEO_DEFAULT');
    
    if (!canApprove) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to approve this expense",
      });
    }

    const updated = await db
      .update(expenses)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        approverName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        lastModifiedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId))
      .returning();

    res.json({
      success: true,
      data: updated[0],
    });
  } catch (error: any) {
    console.error("Error approving expense:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.patch("/expenses/:id/reject", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const expenseId = parseInt(req.params.id);
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        error: "Rejection reason required",
      });
    }

    const expense = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);

    if (expense.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Expense not found",
      });
    }

    const CEO_EMAIL = 'nirhadad1@gmail.com';
    const isCEO = user.email.toLowerCase() === CEO_EMAIL.toLowerCase();
    const canReject = expense[0].approverId === user.id || (isCEO && expense[0].approverId === 'CEO_DEFAULT');
    
    if (!canReject) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to reject this expense",
      });
    }

    const updated = await db
      .update(expenses)
      .set({
        status: 'rejected',
        rejectionReason,
        approverName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        lastModifiedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId))
      .returning();

    res.json({
      success: true,
      data: updated[0],
    });
  } catch (error: any) {
    console.error("Error rejecting expense:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/expenses/seed-tax-rates", async (req: Request, res: Response) => {
  try {
    await taxRateService.seedInitialTaxRates();
    
    res.json({
      success: true,
      message: "Tax rates seeded successfully",
    });
  } catch (error: any) {
    console.error("Error seeding tax rates:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
