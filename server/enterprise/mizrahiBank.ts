/**
 * Mizrahi-Tefahot Bank Integration
 * Automated Transaction Fetching and Reconciliation
 * מזרחי-טפחות - אינטגרציה בנקאית
 */

import axios from 'axios';
import type { Request, Response } from 'express';
import { db as firestoreDb } from '../lib/firebase-admin';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';

const AGGREGATOR_URL = process.env.BANK_AGGREGATOR_URL || 'https://api.your-aggregator.com/mizrahi/transactions';
const AGGREGATOR_TOKEN = process.env.BANK_AGGREGATOR_SECRET_KEY;
const MIZRAHI_ACCOUNT_ID = process.env.MIZRAHI_ACCOUNT_ID;

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance: number;
  type: 'debit' | 'credit';
  reference?: string;
  category?: string;
}

/**
 * Fetch Mizrahi Bank account transactions
 * Cloud Function callable (adapted for Express)
 */
export async function fetchMizrahiAccountData(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { lastPullDate } = req.body;
    
    // Security Check - Only admin/finance can pull bank data
    const isAdmin = req.session.adminId || req.adminUser;
    const isFinance = req.firebaseUser?.uid && 
                      (await checkFinanceRole(req.firebaseUser.uid));
    
    if (!isAdmin && !isFinance) {
      res.status(403).json({
        error: 'permission-denied',
        message: 'Only finance roles can pull bank data.'
      });
      return;
    }
    
    if (!AGGREGATOR_TOKEN || !MIZRAHI_ACCOUNT_ID) {
      logger.warn('[MizrahiBank] Bank integration not configured');
      res.status(200).json({
        success: false,
        simulation: true,
        message: 'Bank integration not configured - simulation mode'
      });
      return;
    }
    
    logger.info('[MizrahiBank] Fetching transactions', {
      from: lastPullDate || 'beginning',
      account: MIZRAHI_ACCOUNT_ID
    });
    
    // Call aggregator API to fetch transactions
    const response = await axios.get(AGGREGATOR_URL, {
      headers: {
        'Authorization': `Bearer ${AGGREGATOR_TOKEN}`,
        'x-bank-account-id': MIZRAHI_ACCOUNT_ID
      },
      params: {
        from_date: lastPullDate || getDefaultStartDate(),
        format: 'json'
      },
      timeout: 60000 // 60 second timeout
    });
    
    const transactions: BankTransaction[] = response.data.transactions;
    
    if (!transactions || transactions.length === 0) {
      logger.info('[MizrahiBank] No new transactions found');
      res.status(200).json({
        success: true,
        count: 0,
        message: 'No new transactions'
      });
      return;
    }
    
    // Save/reconcile transactions in Firestore
    const batch = firestoreDb.batch();
    
    transactions.forEach(tx => {
      const txRef = firestoreDb.collection('bank_transactions').doc(tx.id);
      batch.set(txRef, {
        transactionId: tx.id,
        date: new Date(tx.date),
        description: tx.description,
        amount: tx.amount,
        balance: tx.balance,
        type: tx.type,
        reference: tx.reference || null,
        category: tx.category || 'uncategorized',
        reconciled: false,
        aiClassified: false,
        source: 'mizrahi_bank',
        importedAt: admin.firestore.FieldValue.serverTimestamp(),
        importedBy: req.firebaseUser?.uid || req.session.adminId
      }, { merge: true });
    });
    
    await batch.commit();
    
    logger.info('[MizrahiBank] Transactions saved', {
      count: transactions.length
    });
    
    // Update last pull date
    await firestoreDb.collection('config').doc('bank_sync').set({
      lastPullDate: new Date().toISOString(),
      lastPullCount: transactions.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Trigger AI classification for new transactions
    // This runs asynchronously in the background
    classifyNewTransactions(transactions.length).catch(err => {
      logger.error('[MizrahiBank] AI classification trigger failed:', err);
    });
    
    res.status(200).json({
      success: true,
      count: transactions.length,
      message: `Successfully pulled ${transactions.length} transactions from Mizrahi Bank`
    });
    
  } catch (error: any) {
    logger.error('[MizrahiBank] Integration error:', error);
    res.status(500).json({
      error: 'unavailable',
      message: 'Bank service integration failed',
      details: error.response?.data || error.message
    });
  }
}

/**
 * Classify new bank transactions using AI
 */
async function classifyNewTransactions(count: number): Promise<void> {
  try {
    logger.info('[MizrahiBank] Starting AI classification for transactions', { count });
    
    // Get unclassified transactions
    const snapshot = await firestoreDb
      .collection('bank_transactions')
      .where('aiClassified', '==', false)
      .limit(count)
      .get();
    
    for (const doc of snapshot.docs) {
      const txData = doc.data();
      
      // Use AI to classify transaction based on description
      const category = await classifyTransactionDescription(
        txData.description,
        txData.amount,
        txData.type
      );
      
      // Update transaction with AI classification
      await doc.ref.update({
        category,
        aiClassified: true,
        classifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    logger.info('[MizrahiBank] AI classification complete', {
      classified: snapshot.size
    });
    
  } catch (error: any) {
    logger.error('[MizrahiBank] AI classification failed:', error);
  }
}

/**
 * AI-powered transaction classification
 */
async function classifyTransactionDescription(
  description: string,
  amount: number,
  type: string
): Promise<string> {
  // Simple rule-based classification
  // Can be enhanced with Gemini AI for better accuracy
  
  const lowerDesc = description.toLowerCase();
  
  if (lowerDesc.includes('משכורת') || lowerDesc.includes('salary')) {
    return 'salary_payment';
  } else if (lowerDesc.includes('חשמל') || lowerDesc.includes('electricity')) {
    return 'utilities_electricity';
  } else if (lowerDesc.includes('מים') || lowerDesc.includes('water')) {
    return 'utilities_water';
  } else if (lowerDesc.includes('דלק') || lowerDesc.includes('fuel') || lowerDesc.includes('gas')) {
    return 'fuel_expense';
  } else if (lowerDesc.includes('שכירות') || lowerDesc.includes('rent')) {
    return 'rent';
  } else if (lowerDesc.includes('ביטוח') || lowerDesc.includes('insurance')) {
    return 'insurance';
  } else if (type === 'credit' && amount > 1000) {
    return 'customer_payment';
  } else if (type === 'debit') {
    return 'business_expense';
  } else {
    return 'uncategorized';
  }
}

/**
 * Get default start date (30 days ago)
 */
function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

/**
 * Check finance role
 */
async function checkFinanceRole(uid: string): Promise<boolean> {
  try {
    const userDoc = await firestoreDb.collection('users').doc(uid).get();
    const role = userDoc.data()?.role;
    return role === 'finance' || role === 'admin';
  } catch (error) {
    return false;
  }
}

/**
 * Reconcile bank transaction with expense
 */
export async function reconcileTransaction(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { transactionId, expenseId } = req.body;
    
    if (!transactionId || !expenseId) {
      res.status(400).json({ error: 'Missing transactionId or expenseId' });
      return;
    }
    
    // Security check
    const isAdmin = req.session.adminId || req.adminUser;
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    
    // Update both records
    await firestoreDb.collection('bank_transactions').doc(transactionId).update({
      reconciled: true,
      matchedExpenseId: expenseId,
      reconciledAt: admin.firestore.FieldValue.serverTimestamp(),
      reconciledBy: req.session.adminId
    });
    
    await firestoreDb.collection('expenses').doc(expenseId).update({
      reconciled: true,
      matchedTransactionId: transactionId,
      reconciledAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info('[MizrahiBank] Transaction reconciled', {
      transactionId,
      expenseId
    });
    
    res.status(200).json({
      success: true,
      message: 'Transaction reconciled successfully'
    });
    
  } catch (error: any) {
    logger.error('[MizrahiBank] Reconciliation failed:', error);
    res.status(500).json({
      error: 'Reconciliation failed',
      details: error.message
    });
  }
}

/**
 * Get reconciliation report
 */
export async function getReconciliationReport(
  startDate: Date,
  endDate: Date
): Promise<{
  totalTransactions: number;
  reconciledCount: number;
  unreconciledCount: number;
  reconciledAmount: number;
  unreconciledAmount: number;
}> {
  try {
    const snapshot = await firestoreDb
      .collection('bank_transactions')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
    
    let reconciledCount = 0;
    let reconciledAmount = 0;
    let unreconciledAmount = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      if (data.reconciled) {
        reconciledCount++;
        reconciledAmount += Math.abs(data.amount || 0);
      } else {
        unreconciledAmount += Math.abs(data.amount || 0);
      }
    });
    
    return {
      totalTransactions: snapshot.size,
      reconciledCount,
      unreconciledCount: snapshot.size - reconciledCount,
      reconciledAmount,
      unreconciledAmount
    };
    
  } catch (error: any) {
    logger.error('[MizrahiBank] Report generation failed:', error);
    throw error;
  }
}
