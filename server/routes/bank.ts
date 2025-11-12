import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  bankAccounts,
  bankTransactions,
  bankImportBatches,
  bankReconciliations,
  bankReconciliationSummary,
  adminUsers,
  transactionRecords,
  taxInvoices
} from "@shared/schema";
import { eq, and, gte, lte, desc, asc, sql, count, sum } from "drizzle-orm";
import ExcelJS from "exceljs";
import { logger } from "../lib/logger";
import { nanoid } from "nanoid";

const router = Router();

// Type for authenticated user
interface AuthenticatedUser {
  uid: string;
  email: string;
}

// RBAC: Only CEO and CFO can access bank endpoints
const financialAuth = async (req: Request, res: Response, next: Function) => {
  try {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // STRICTLY CEO and CFO corporate emails only
    const financialManagement = [
      'nir.h@petwash.co.il',      // CEO
      'ido.s@petwash.co.il'        // CFO/National Operations Director
    ];
    
    if (!financialManagement.includes(user.email?.toLowerCase())) {
      logger.warn("[Bank API] Unauthorized access attempt", { 
        email: user.email,
        ip: req.ip,
        endpoint: req.path
      });
      return res.status(403).json({ 
        error: "Access denied",
        message: "Only CEO and CFO can access bank data" 
      });
    }
    
    logger.info("[Bank API] Authorized access", { 
      email: user.email,
      endpoint: req.path
    });
    
    next();
  } catch (error) {
    logger.error("[Bank API] Auth error", error);
    res.status(500).json({ error: "Authentication error" });
  }
};

// Apply financial auth to all routes
router.use(financialAuth);

// =================== BANK ACCOUNTS MANAGEMENT ===================

// GET /api/bank/accounts - Get all bank accounts
router.get("/accounts", async (req: Request, res: Response) => {
  try {
    const accounts = await db.select().from(bankAccounts).orderBy(desc(bankAccounts.createdAt));
    
    logger.info("[Bank API] Retrieved bank accounts", { count: accounts.length });
    res.json(accounts);
  } catch (error) {
    logger.error("[Bank API] Error fetching accounts", error);
    res.status(500).json({ error: "Failed to fetch bank accounts" });
  }
});

// GET /api/bank/accounts/:id - Get single bank account
router.get("/accounts/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const account = await db.select().from(bankAccounts).where(eq(bankAccounts.id, parseInt(id)));
    
    if (account.length === 0) {
      return res.status(404).json({ error: "Bank account not found" });
    }
    
    res.json(account[0]);
  } catch (error) {
    logger.error("[Bank API] Error fetching account", error);
    res.status(500).json({ error: "Failed to fetch bank account" });
  }
});

// POST /api/bank/accounts - Create new bank account
router.post("/accounts", async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    const accountData = req.body;
    
    const [newAccount] = await db.insert(bankAccounts).values(accountData).returning();
    
    logger.info("[Bank API] Created bank account", { 
      accountId: newAccount.id,
      accountNumber: newAccount.accountNumber,
      createdBy: user?.email
    });
    
    res.status(201).json(newAccount);
  } catch (error) {
    logger.error("[Bank API] Error creating account", error);
    res.status(500).json({ error: "Failed to create bank account" });
  }
});

// PATCH /api/bank/accounts/:id - Update bank account
router.patch("/accounts/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const [updatedAccount] = await db
      .update(bankAccounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bankAccounts.id, parseInt(id)))
      .returning();
    
    if (!updatedAccount) {
      return res.status(404).json({ error: "Bank account not found" });
    }
    
    logger.info("[Bank API] Updated bank account", { accountId: id });
    res.json(updatedAccount);
  } catch (error) {
    logger.error("[Bank API] Error updating account", error);
    res.status(500).json({ error: "Failed to update bank account" });
  }
});

// =================== BANK TRANSACTIONS ===================

// GET /api/bank/transactions - Get bank transactions with filtering
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const { accountId, startDate, endDate, status, limit } = req.query;
    
    const conditions = [];
    if (accountId) conditions.push(eq(bankTransactions.accountId, parseInt(accountId as string)));
    if (startDate) conditions.push(sql`${bankTransactions.transactionDate} >= ${startDate as string}`);
    if (endDate) conditions.push(sql`${bankTransactions.transactionDate} <= ${endDate as string}`);
    if (status) conditions.push(eq(bankTransactions.reconciliationStatus, status as string));
    
    let queryBuilder = db.select().from(bankTransactions);
    
    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions));
    }
    
    const transactions = await queryBuilder
      .orderBy(desc(bankTransactions.transactionDate))
      .limit(limit ? parseInt(limit as string) : 100);
    
    logger.info("[Bank API] Retrieved transactions", { count: transactions.length });
    res.json(transactions);
  } catch (error) {
    logger.error("[Bank API] Error fetching transactions", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// GET /api/bank/transactions/summary - Get transaction summary statistics
router.get("/transactions/summary", async (req: Request, res: Response) => {
  try {
    const { accountId, year, month } = req.query;
    
    const conditions = [];
    if (accountId) conditions.push(eq(bankTransactions.accountId, parseInt(accountId as string)));
    
    // Date range filtering
    if (year && month) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(parseInt(year as string), parseInt(month as string), 0).toISOString().split('T')[0];
      conditions.push(sql`${bankTransactions.transactionDate} >= ${startDate}`);
      conditions.push(sql`${bankTransactions.transactionDate} <= ${endDate}`);
    }
    
    const summary = await db
      .select({
        totalTransactions: count(),
        totalDebits: sum(bankTransactions.debitAmount),
        totalCredits: sum(bankTransactions.creditAmount),
        unmatchedCount: sql<number>`COUNT(CASE WHEN ${bankTransactions.reconciliationStatus} = 'unmatched' THEN 1 END)`,
        matchedCount: sql<number>`COUNT(CASE WHEN ${bankTransactions.reconciliationStatus} = 'matched' THEN 1 END)`,
      })
      .from(bankTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    res.json(summary[0]);
  } catch (error) {
    logger.error("[Bank API] Error fetching transaction summary", error);
    res.status(500).json({ error: "Failed to fetch transaction summary" });
  }
});

// =================== BANK IMPORT ===================

// POST /api/bank/import/csv - Import transactions from CSV
router.post("/import/csv", async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    const { accountId, fileName, fileSize, transactions } = req.body;
    
    if (!accountId || !fileName || !transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: "Missing required fields: accountId, fileName, transactions" });
    }
    
    // Create import batch
    const batchId = `IMP-${nanoid(10)}`;
    const [batch] = await db.insert(bankImportBatches).values({
      batchId,
      accountId: parseInt(accountId),
      fileName,
      fileType: 'csv',
      fileSize: fileSize || 0,
      totalTransactions: transactions.length,
      status: 'processing',
      importedBy: user?.uid || 'system',
    }).returning();
    
    let successCount = 0;
    let failedCount = 0;
    let duplicatesCount = 0;
    const errors: any[] = [];
    
    for (const txn of transactions) {
      try {
        // Check for duplicates (same account, date, amount, description)
        const existing = await db.select().from(bankTransactions).where(
          and(
            eq(bankTransactions.accountId, parseInt(accountId)),
            sql`${bankTransactions.transactionDate} = ${txn.transactionDate}`,
            eq(bankTransactions.description, txn.description),
            eq(bankTransactions.debitAmount, txn.debitAmount || "0"),
            eq(bankTransactions.creditAmount, txn.creditAmount || "0")
          )
        );
        
        if (existing.length > 0) {
          duplicatesCount++;
          continue;
        }
        
        // Insert transaction
        await db.insert(bankTransactions).values({
          accountId: parseInt(accountId),
          transactionDate: txn.transactionDate,
          valueDate: txn.valueDate || null,
          description: txn.description,
          descriptionHe: txn.descriptionHe || null,
          referenceNumber: txn.referenceNumber || null,
          debitAmount: txn.debitAmount || "0",
          creditAmount: txn.creditAmount || "0",
          balance: txn.balance || null,
          currency: txn.currency || 'ILS',
          category: txn.category || null,
          subcategory: txn.subcategory || null,
          reconciliationStatus: 'unmatched',
          importBatchId: batchId,
          importedBy: user?.uid || 'system',
        });
        
        successCount++;
      } catch (err) {
        failedCount++;
        errors.push({ transaction: txn, error: String(err) });
        logger.error("[Bank Import] Transaction import failed", { txn, error: err });
      }
    }
    
    // Update batch status
    await db.update(bankImportBatches)
      .set({
        successfulImports: successCount,
        failedImports: failedCount,
        duplicatesSkipped: duplicatesCount,
        status: failedCount > 0 ? 'completed_with_errors' : 'completed',
        errorLog: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt: new Date(),
      })
      .where(eq(bankImportBatches.id, batch.id));
    
    logger.info("[Bank Import] CSV import completed", { 
      batchId,
      successCount,
      failedCount,
      duplicatesCount
    });
    
    res.json({
      batchId,
      successCount,
      failedCount,
      duplicatesCount,
      totalProcessed: transactions.length,
    });
  } catch (error) {
    logger.error("[Bank Import] CSV import error", error);
    res.status(500).json({ error: "Failed to import CSV" });
  }
});

// GET /api/bank/import/batches - Get import history
router.get("/import/batches", async (req: Request, res: Response) => {
  try {
    const { accountId, limit } = req.query;
    
    let queryBuilder = db.select().from(bankImportBatches);
    
    if (accountId) {
      queryBuilder = queryBuilder.where(eq(bankImportBatches.accountId, parseInt(accountId as string)));
    }
    
    const batches = await queryBuilder
      .orderBy(desc(bankImportBatches.importedAt))
      .limit(limit ? parseInt(limit as string) : 50);
    
    res.json(batches);
  } catch (error) {
    logger.error("[Bank API] Error fetching import batches", error);
    res.status(500).json({ error: "Failed to fetch import batches" });
  }
});

// =================== BANK RECONCILIATION ===================

// POST /api/bank/reconcile/auto - Auto-match transactions
router.post("/reconcile/auto", async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    const { accountId, startDate, endDate } = req.body;
    
    if (!accountId) {
      return res.status(400).json({ error: "Missing required field: accountId" });
    }
    
    // Get unmatched bank transactions
    const conditions = [
      eq(bankTransactions.accountId, parseInt(accountId)),
      eq(bankTransactions.reconciliationStatus, 'unmatched'),
    ];
    
    if (startDate) conditions.push(sql`${bankTransactions.transactionDate} >= ${startDate}`);
    if (endDate) conditions.push(sql`${bankTransactions.transactionDate} <= ${endDate}`);
    
    const unmatchedTxns = await db.select().from(bankTransactions).where(and(...conditions));
    
    let matchedCount = 0;
    const matches: any[] = [];
    
    for (const txn of unmatchedTxns) {
      // Try to match with transaction_records (station washes)
      const amount = parseFloat(txn.creditAmount as string) || 0;
      if (amount > 0) {
        // Look for matching station transactions (+/- 1 day, exact amount)
        const startMatch = new Date(txn.transactionDate);
        startMatch.setDate(startMatch.getDate() - 1);
        const endMatch = new Date(txn.transactionDate);
        endMatch.setDate(endMatch.getDate() + 1);
        
        const potentialMatches = await db
          .select()
          .from(transactionRecords)
          .where(
            and(
              sql`${transactionRecords.timestamp} >= ${startMatch.toISOString()}`,
              sql`${transactionRecords.timestamp} <= ${endMatch.toISOString()}`,
              eq(transactionRecords.totalAmount, amount.toString())
            )
          )
          .limit(1);
        
        if (potentialMatches.length > 0) {
          const match = potentialMatches[0];
          const confidence = 95; // High confidence for exact amount match
          
          // Store the ID for reconciliation - transaction_records uses varchar(id)
          const matchIdStr = match.id; // Already a string from schema
          
          // Create reconciliation record
          await db.insert(bankReconciliations).values({
            reconciliationId: `REC-${nanoid(10)}`,
            bankTransactionId: txn.id,
            matchedEntityId: parseInt(matchIdStr) || 0, // Convert to integer for reconciliation table
            matchedEntityType: 'transaction_record',
            matchType: 'auto_exact',
            matchConfidence: confidence,
            bankAmount: amount.toString(),
            entityAmount: match.totalAmount,
            discrepancy: "0",
            status: 'matched',
            matchedBy: user?.uid || 'system',
          });
          
          // Update bank transaction status
          await db
            .update(bankTransactions)
            .set({
              reconciliationStatus: 'matched',
              matchedTransactionId: parseInt(matchIdStr) || 0,
              matchedEntityType: 'transaction_record',
              matchConfidence: confidence,
            })
            .where(eq(bankTransactions.id, txn.id));
          
          matchedCount++;
          matches.push({
            bankTransactionId: txn.id,
            matchedEntityId: match.id,
            confidence,
          });
        }
      }
    }
    
    logger.info("[Bank Reconciliation] Auto-match completed", { 
      accountId,
      unmatchedCount: unmatchedTxns.length,
      matchedCount
    });
    
    res.json({
      processed: unmatchedTxns.length,
      matched: matchedCount,
      matches,
    });
  } catch (error) {
    logger.error("[Bank Reconciliation] Auto-match error", error);
    res.status(500).json({ error: "Failed to auto-match transactions" });
  }
});

// POST /api/bank/reconcile/manual - Manual match
router.post("/reconcile/manual", async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    const { bankTransactionId, matchedEntityId, matchedEntityType, notes } = req.body;
    
    if (!bankTransactionId || !matchedEntityId || !matchedEntityType) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Get bank transaction
    const [bankTxn] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, parseInt(bankTransactionId)));
    if (!bankTxn) {
      return res.status(404).json({ error: "Bank transaction not found" });
    }
    
    // Get entity amount based on type
    let entityAmount = "0";
    if (matchedEntityType === 'transaction_record') {
      // transaction_records uses varchar(id), not integer
      const [entity] = await db.select().from(transactionRecords).where(eq(transactionRecords.id, matchedEntityId.toString()));
      entityAmount = entity?.totalAmount || "0";
    } else if (matchedEntityType === 'tax_invoice') {
      const [entity] = await db.select().from(taxInvoices).where(eq(taxInvoices.id, parseInt(matchedEntityId)));
      entityAmount = entity?.totalAmount || "0";
    }
    
    const bankAmount = parseFloat(bankTxn.creditAmount as string) || parseFloat(bankTxn.debitAmount as string) || 0;
    const discrepancy = Math.abs(bankAmount - parseFloat(entityAmount));
    
    // Create reconciliation
    const [reconciliation] = await db.insert(bankReconciliations).values({
      reconciliationId: `REC-${nanoid(10)}`,
      bankTransactionId: parseInt(bankTransactionId),
      matchedEntityId: parseInt(matchedEntityId), // Reconciliation table uses integer
      matchedEntityType,
      matchType: 'manual',
      matchConfidence: 100,
      bankAmount: bankAmount.toString(),
      entityAmount,
      discrepancy: discrepancy.toString(),
      discrepancyReason: notes || null,
      status: discrepancy > 0.01 ? 'pending_approval' : 'matched',
      matchedBy: user?.uid || 'system',
      notes: notes || null,
    }).returning();
    
    // Update bank transaction
    await db
      .update(bankTransactions)
      .set({
        reconciliationStatus: 'matched',
        matchedTransactionId: parseInt(matchedEntityId),
        matchedEntityType,
        matchConfidence: 100,
        notes: notes || null,
      })
      .where(eq(bankTransactions.id, parseInt(bankTransactionId)));
    
    logger.info("[Bank Reconciliation] Manual match created", { 
      bankTransactionId,
      matchedEntityId,
      matchedEntityType,
      discrepancy
    });
    
    res.json(reconciliation);
  } catch (error) {
    logger.error("[Bank Reconciliation] Manual match error", error);
    res.status(500).json({ error: "Failed to create manual match" });
  }
});

// GET /api/bank/reconciliation/summary - Get reconciliation summary by period
router.get("/reconciliation/summary", async (req: Request, res: Response) => {
  try {
    const { accountId, year, month } = req.query;
    
    if (!accountId || !year || !month) {
      return res.status(400).json({ error: "Missing required parameters: accountId, year, month" });
    }
    
    const summary = await db
      .select()
      .from(bankReconciliationSummary)
      .where(
        and(
          eq(bankReconciliationSummary.accountId, parseInt(accountId as string)),
          eq(bankReconciliationSummary.year, parseInt(year as string)),
          eq(bankReconciliationSummary.month, parseInt(month as string))
        )
      );
    
    res.json(summary[0] || null);
  } catch (error) {
    logger.error("[Bank API] Error fetching reconciliation summary", error);
    res.status(500).json({ error: "Failed to fetch reconciliation summary" });
  }
});

// POST /api/bank/reconciliation/summary - Generate monthly reconciliation summary
router.post("/reconciliation/summary", async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    const { accountId, year, month } = req.body;
    
    if (!accountId || !year || !month) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Calculate period dates
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    
    // Get transactions for the period
    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];
    
    const transactions = await db
      .select()
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.accountId, parseInt(accountId)),
          sql`${bankTransactions.transactionDate} >= ${periodStartStr}`,
          sql`${bankTransactions.transactionDate} <= ${periodEndStr}`
        )
      );
    
    // Calculate summary stats
    const totalDebits = transactions.reduce((sum, t) => sum + (parseFloat(t.debitAmount as string) || 0), 0);
    const totalCredits = transactions.reduce((sum, t) => sum + (parseFloat(t.creditAmount as string) || 0), 0);
    const matchedCount = transactions.filter(t => t.reconciliationStatus === 'matched').length;
    const unmatchedCount = transactions.filter(t => t.reconciliationStatus === 'unmatched').length;
    const matchRate = transactions.length > 0 ? (matchedCount / transactions.length) * 100 : 0;
    
    // Get opening and closing balances
    const sortedTxns = transactions.sort((a, b) => 
      new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );
    const openingBalance = sortedTxns.length > 0 ? parseFloat(sortedTxns[0].balance as string) || 0 : 0;
    const closingBalance = sortedTxns.length > 0 
      ? parseFloat(sortedTxns[sortedTxns.length - 1].balance as string) || 0 
      : 0;
    
    // Create or update summary
    const [summary] = await db
      .insert(bankReconciliationSummary)
      .values({
        accountId: parseInt(accountId),
        year,
        month,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        openingBalance: openingBalance.toString(),
        closingBalance: closingBalance.toString(),
        totalDebits: totalDebits.toString(),
        totalCredits: totalCredits.toString(),
        totalTransactions: transactions.length,
        matchedTransactions: matchedCount,
        unmatchedTransactions: unmatchedCount,
        matchRate: matchRate.toFixed(2),
        totalDiscrepancies: "0", // Calculate from reconciliations if needed
        unreconciledAmount: "0", // Fixed: was unreconciled_amount
        status: matchRate === 100 ? 'completed' : 'in_progress',
        completedBy: user?.uid || null,
        completedAt: matchRate === 100 ? new Date() : null,
      })
      .returning();
    
    logger.info("[Bank Reconciliation] Summary generated", { 
      accountId,
      year,
      month,
      matchRate
    });
    
    res.json(summary);
  } catch (error) {
    logger.error("[Bank Reconciliation] Summary generation error", error);
    res.status(500).json({ error: "Failed to generate reconciliation summary" });
  }
});

// =================== EXPORT REPORTS ===================

// GET /api/bank/export/excel - Export transactions to Excel
router.get("/export/excel", async (req: Request, res: Response) => {
  try {
    const { accountId, year, month } = req.query;
    
    if (!accountId || !year || !month) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    // Get account info
    const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, parseInt(accountId as string)));
    
    // Get transactions
    const periodStart = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
    const periodEnd = new Date(parseInt(year as string), parseInt(month as string), 0);
    
    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];
    
    const transactions = await db
      .select()
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.accountId, parseInt(accountId as string)),
          sql`${bankTransactions.transactionDate} >= ${periodStartStr}`,
          sql`${bankTransactions.transactionDate} <= ${periodEndStr}`
        )
      )
      .orderBy(asc(bankTransactions.transactionDate));
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bank Transactions');
    
    // Add header
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Reference', key: 'reference', width: 15 },
      { header: 'Debit', key: 'debit', width: 12 },
      { header: 'Credit', key: 'credit', width: 12 },
      { header: 'Balance', key: 'balance', width: 12 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    
    // Add data
    transactions.forEach(txn => {
      worksheet.addRow({
        date: new Date(txn.transactionDate).toLocaleDateString('he-IL'),
        description: txn.description,
        reference: txn.referenceNumber || '',
        debit: parseFloat(txn.debitAmount as string) || '',
        credit: parseFloat(txn.creditAmount as string) || '',
        balance: parseFloat(txn.balance as string) || '',
        category: txn.category || '',
        status: txn.reconciliationStatus,
      });
    });
    
    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Generate file
    const buffer = await workbook.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bank-transactions-${year}-${month}.xlsx"`);
    res.send(buffer);
    
    logger.info("[Bank Export] Excel report generated", { accountId, year, month });
  } catch (error) {
    logger.error("[Bank Export] Excel export error", error);
    res.status(500).json({ error: "Failed to generate Excel report" });
  }
});

export default router;
