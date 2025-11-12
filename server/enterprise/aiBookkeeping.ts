/**
 * AI-Powered Bookkeeping System
 * OCR + Gemini 2.5 Flash for Automatic Expense Classification
 */

import { GoogleGenerativeAI } from '@google/genai';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { db as firestoreDb } from '../lib/firebase-admin';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const visionClient = new ImageAnnotatorClient({
  credentials: process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined
});

interface ReceiptData {
  category: string;
  amount: number;
  vendor: string;
  date?: string;
  vatAmount?: number;
  confidence: number;
}

/**
 * Extract text from receipt image using Google Cloud Vision OCR
 */
async function extractTextFromReceipt(imageUrl: string): Promise<string> {
  try {
    const [result] = await visionClient.textDetection(imageUrl);
    const detections = result.textAnnotations;
    
    if (!detections || detections.length === 0) {
      throw new Error('No text detected in image');
    }
    
    // First annotation contains full text
    const fullText = detections[0].description || '';
    
    logger.info('[AIBookkeeping] OCR extraction successful', {
      textLength: fullText.length,
      imageUrl: imageUrl.substring(0, 50) + '...'
    });
    
    return fullText;
    
  } catch (error: any) {
    logger.error('[AIBookkeeping] OCR extraction failed:', error);
    throw new Error(`OCR failed: ${error.message}`);
  }
}

/**
 * Classify expense using Gemini AI
 * Returns structured expense data
 */
async function classifyExpenseWithAI(receiptText: string): Promise<ReceiptData> {
  try {
    const model = ai.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });
    
    const prompt = `You are a professional Israeli bookkeeper for PetWash™ franchise.

Analyze the following receipt text and extract expense information.

Receipt Text:
"""
${receiptText}
"""

Return a JSON object with these fields:
{
  "category": "expense category code",
  "amount": number (total amount in ILS),
  "vendor": "vendor name",
  "date": "YYYY-MM-DD format or null if not found",
  "vatAmount": number (VAT amount in ILS if found, or null),
  "confidence": number (0-1, your confidence in this classification)
}

Valid category codes for PetWash franchise:
- "shampoo_inventory" - Pet shampoos, conditioners, grooming products
- "fuel_expense" - Gasoline, diesel for service vehicles
- "food_supplies" - Dog treats, pet food for vending machines
- "cleaning_supplies" - Detergents, disinfectants, cleaning tools
- "maintenance_parts" - Station repairs, equipment parts
- "office_supplies" - Paper, pens, administrative items
- "utilities" - Electricity, water, internet bills
- "rent" - Lease payments for station locations
- "marketing" - Advertising, promotional materials
- "professional_services" - Accounting, legal fees
- "insurance" - Business insurance premiums
- "other" - Uncategorized expenses

Israeli Receipt Patterns:
- Look for "מע״מ" (VAT) amounts
- Total amount often marked as "סה״כ" or "Total"
- Date format: DD/MM/YYYY or DD.MM.YYYY
- Currency: ₪ or ILS or שקלים

Be conservative with classification. If unsure, use "other" and set low confidence.`;
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    const expenseData: ReceiptData = JSON.parse(text);
    
    logger.info('[AIBookkeeping] AI classification successful', {
      category: expenseData.category,
      amount: expenseData.amount,
      confidence: expenseData.confidence
    });
    
    return expenseData;
    
  } catch (error: any) {
    logger.error('[AIBookkeeping] AI classification failed:', error);
    throw new Error(`AI classification failed: ${error.message}`);
  }
}

/**
 * Process receipt for bookkeeping
 * Firestore trigger function (adapted for background processing)
 */
export async function processReceiptForBookkeeping(
  receiptId: string,
  receiptData: any
): Promise<void> {
  try {
    const fileUrl = receiptData.storageUrl;
    const franchiseId = receiptData.franchiseId;
    const uploadedBy = receiptData.uploadedBy;
    
    logger.info('[AIBookkeeping] Processing receipt', { receiptId, franchiseId });
    
    // 1. Extract text from receipt using OCR
    const fullText = await extractTextFromReceipt(fileUrl);
    
    // 2. Classify expense using AI
    const expenseData = await classifyExpenseWithAI(fullText);
    
    // 3. Save structured expense data to Firestore
    const expenseDoc = {
      franchiseId,
      uploadedBy,
      receiptId,
      receiptUrl: fileUrl,
      category: expenseData.category,
      amount: expenseData.amount,
      vatAmount: expenseData.vatAmount || null,
      vendor: expenseData.vendor,
      date: expenseData.date ? new Date(expenseData.date) : new Date(),
      extractedText: fullText.substring(0, 1000), // Store first 1000 chars
      aiConfidence: expenseData.confidence,
      status: expenseData.confidence > 0.7 ? 'auto_classified' : 'review_required',
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      reconciled: false,
      taxYear: new Date().getFullYear(),
    };
    
    await firestoreDb.collection('expenses').add(expenseDoc);
    
    // 4. Update receipt status
    await firestoreDb.collection('receipts_raw').doc(receiptId).update({
      status: 'processed',
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      expenseCategory: expenseData.category,
      confidence: expenseData.confidence
    });
    
    logger.info('[AIBookkeeping] Receipt processed successfully', {
      receiptId,
      category: expenseData.category,
      amount: expenseData.amount,
      status: expenseDoc.status
    });
    
  } catch (error: any) {
    logger.error('[AIBookkeeping] Receipt processing failed:', error);
    
    // Mark receipt as failed
    await firestoreDb.collection('receipts_raw').doc(receiptId).update({
      status: 'failed',
      error: error.message,
      failedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    throw error;
  }
}

/**
 * Reprocess failed receipts (manual trigger)
 */
export async function reprocessFailedReceipts(franchiseId?: string): Promise<number> {
  try {
    let query: FirebaseFirestore.Query = firestoreDb
      .collection('receipts_raw')
      .where('status', '==', 'failed');
    
    if (franchiseId) {
      query = query.where('franchiseId', '==', franchiseId);
    }
    
    const snapshot = await query.limit(50).get(); // Process 50 at a time
    
    let processed = 0;
    
    for (const doc of snapshot.docs) {
      try {
        await processReceiptForBookkeeping(doc.id, doc.data());
        processed++;
      } catch (error: any) {
        logger.warn(`[AIBookkeeping] Failed to reprocess ${doc.id}:`, error.message);
      }
    }
    
    logger.info(`[AIBookkeeping] Reprocessed ${processed} failed receipts`);
    
    return processed;
    
  } catch (error: any) {
    logger.error('[AIBookkeeping] Reprocess failed:', error);
    throw error;
  }
}

/**
 * Get expense summary for tax reporting
 */
export async function getExpenseSummary(
  franchiseId: string,
  startDate: Date,
  endDate: Date
): Promise<Record<string, number>> {
  try {
    const snapshot = await firestoreDb
      .collection('expenses')
      .where('franchiseId', '==', franchiseId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
    
    const summary: Record<string, number> = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const category = data.category;
      const amount = data.amount || 0;
      
      summary[category] = (summary[category] || 0) + amount;
    });
    
    logger.info('[AIBookkeeping] Expense summary generated', {
      franchiseId,
      categories: Object.keys(summary).length,
      total: Object.values(summary).reduce((a, b) => a + b, 0)
    });
    
    return summary;
    
  } catch (error: any) {
    logger.error('[AIBookkeeping] Summary generation failed:', error);
    throw error;
  }
}
