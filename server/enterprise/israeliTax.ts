/**
 * Israeli Tax Authority Direct API Integration
 * UPDATED: Now uses direct ITA OAuth2 API instead of legacy RASA
 * Invoice Allocation Number Generation
 * רשות המיסים - מערכת דיווח והקצאת מספרי אישור
 * 
 * @deprecated RASA API endpoints - Replaced with IsraeliTaxAPIService (OAuth2)
 * @see IsraeliTaxAPIService for new direct ITA integration
 * @see ITA_API_REGISTRATION_GUIDE.md for setup instructions
 */

import axios from 'axios';
import type { Request, Response } from 'express';
import { db as firestoreDb } from '../lib/firebase-admin';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import IsraeliTaxAPIService from '../services/IsraeliTaxAPIService';
import ElectronicInvoicingService from '../services/ElectronicInvoicingService';

// LEGACY RASA ENDPOINTS - KEPT FOR BACKWARDS COMPATIBILITY
const RASA_API_ENDPOINT = process.env.RASA_API_ENDPOINT || 'https://api.taxes.gov.il/shaam/production/Invoices';
const SUPPLIER_API_KEY = process.env.RASA_SUPPLIER_API_KEY;
const COMPANY_ID = '517145033'; // PetWash Ltd. Company ID
const VAT_RATE = parseFloat(process.env.VAT_RATE || '0.18'); // 18% VAT in Israel

interface InvoiceData {
  invoiceNumber: string;
  invoiceId: string;
  amountBeforeVAT: number;
  vatAmount: number;
  totalAmount: number;
  customerDetails: {
    name: string;
    id?: string; // Israeli ID or company number
    address?: string;
  };
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

/**
 * Generate Israeli Tax Invoice - NOW USES DIRECT ITA OAuth2 API
 * @deprecated Legacy RASA API kept for backwards compatibility
 * 
 * NEW FLOW:
 * 1. Check if new ITA API is configured (ITA_CLIENT_ID exists)
 * 2. If YES: Use IsraeliTaxAPIService (OAuth2 direct submission)
 * 3. If NO: Fall back to legacy RASA API (if RASA_SUPPLIER_API_KEY exists)
 * 4. If NEITHER: Simulation mode
 */
export async function generateTaxInvoice(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const data: InvoiceData = req.body;
    
    // Validate required fields
    if (!data.invoiceId || !data.amountBeforeVAT) {
      res.status(400).json({ 
        error: 'Missing required fields',
        required: ['invoiceId', 'amountBeforeVAT']
      });
      return;
    }
    
    // Security check - admin or finance only
    const isAdmin = req.session.adminId || req.adminUser;
    const isFinance = req.firebaseUser?.uid && 
                      (await checkFinanceRole(req.firebaseUser.uid));
    
    if (!isAdmin && !isFinance) {
      res.status(403).json({ error: 'Finance role required' });
      return;
    }
    
    logger.info('[IsraeliTax] Generating tax invoice', {
      invoiceId: data.invoiceId,
      amount: data.totalAmount,
      useNewAPI: IsraeliTaxAPIService.isConfigured()
    });
    
    // === NEW: Direct ITA OAuth2 API ===
    if (IsraeliTaxAPIService.isConfigured()) {
      logger.info('[IsraeliTax] ✅ Using new Direct ITA OAuth2 API');
      
      const invoicePayload = {
        invoiceNumber: data.invoiceNumber,
        invoiceDate: new Date().toISOString(),
        customerTaxId: data.customerDetails.id || '',
        customerName: data.customerDetails.name,
        totalAmount: data.totalAmount,
        vatAmount: data.vatAmount,
        amountBeforeVAT: data.amountBeforeVAT,
        lineItems: data.lineItems?.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          vatRate: VAT_RATE,
        })) || [],
        invoiceType: data.customerDetails.id ? 'B2B' : 'B2C',
        currency: 'ILS',
      };

      // Check if this is a B2B transaction requiring electronic invoicing
      const isB2B = !!data.customerDetails.id;
      const requiresElectronicInvoicing = isB2B && data.totalAmount >= 25000;
      
      let electronicInvoiceId: number | undefined;
      let itaReferenceNumber: string | undefined;
      
      // Create electronic invoice record if required
      // ElectronicInvoicingService.createInvoice() will auto-submit to ITA if threshold is met
      if (requiresElectronicInvoicing) {
        logger.info('[IsraeliTax] B2B transaction ≥₪25,000 - creating electronic invoice (auto-submits to ITA)', {
          amount: data.totalAmount
        });
        
        const electronicInvoice = await ElectronicInvoicingService.createInvoice({
          invoiceNumber: data.invoiceNumber,
          invoiceDate: new Date().toISOString(),
          customerTaxId: data.customerDetails.id!,
          customerName: data.customerDetails.name,
          totalAmount: data.totalAmount,
          vatAmount: data.vatAmount,
          amountBeforeVAT: data.amountBeforeVAT,
          lineItems: data.lineItems?.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            vatRate: VAT_RATE,
          })) || [],
          serviceType: 'pet_wash',
          currency: 'ILS',
        });
        
        electronicInvoiceId = electronicInvoice.id;
        
        // Re-fetch invoice to get updated ITA submission status and reference number
        // (createInvoice auto-submits to ITA and updates the record)
        const updatedInvoice = await ElectronicInvoicingService.getInvoiceStatus(electronicInvoice.invoiceId);
        itaReferenceNumber = updatedInvoice.itaReferenceNumber || undefined;
        
        // Update Firestore for legacy compatibility
        await firestoreDb.collection('invoices').doc(data.invoiceId).update({
          itaReferenceNumber: itaReferenceNumber || null,
          status: updatedInvoice.itaSubmissionStatus === 'submitted' || updatedInvoice.itaSubmissionStatus === 'accepted' ? 'APPROVED' : 'PENDING',
          itaResponse: updatedInvoice.itaSubmissionStatus,
          submittedVia: 'ITA_OAUTH2_API',
          electronicInvoiceId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        logger.info('[IsraeliTax] ✅ Electronic invoice created and submitted', {
          invoiceId: data.invoiceId,
          electronicInvoiceId,
          itaReference: itaReferenceNumber,
          status: updatedInvoice.itaSubmissionStatus
        });
        
        res.status(200).json({
          success: true,
          allocationNumber: itaReferenceNumber,
          submissionMethod: 'ITA_OAUTH2_API',
          itaReference: itaReferenceNumber,
          electronicInvoiceId,
          requiresElectronicInvoicing: true
        });
        return;
      }
      
      // For non-electronic invoicing (B2C or B2B <₪25,000), submit directly to ITA
      const result = await IsraeliTaxAPIService.submitInvoice(invoicePayload as any);
      
      if (result.success) {
        // Update Firestore (legacy compatibility)
        await firestoreDb.collection('invoices').doc(data.invoiceId).update({
          itaReferenceNumber: result.itaReferenceNumber,
          status: 'APPROVED',
          itaResponse: result,
          submittedVia: 'ITA_OAUTH2_API',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        logger.info('[IsraeliTax] ✅ Direct ITA submission successful', {
          invoiceId: data.invoiceId,
          itaReference: result.itaReferenceNumber
        });
        
        res.status(200).json({
          success: true,
          allocationNumber: result.itaReferenceNumber,
          submissionMethod: 'ITA_OAUTH2_API',
          itaReference: result.itaReferenceNumber
        });
        return;
      } else {
        throw new Error(result.errorMessage || 'ITA API submission failed');
      }
    }
    
    // === LEGACY: RASA API (Fallback) ===
    logger.warn('[IsraeliTax] ⚠️ New ITA API not configured - using legacy RASA API');
    
    const invoicePayload = {
      Invoice_Id: data.invoiceNumber,
      Supplier_Id: COMPANY_ID,
      Invoice_Date: new Date().toISOString().split('T')[0],
      Invoice_Total: data.amountBeforeVAT,
      Invoice_VAT: data.vatAmount,
      Invoice_Total_With_VAT: data.totalAmount,
      Customer_Name: data.customerDetails.name,
      Customer_Id: data.customerDetails.id,
      Customer_Address: data.customerDetails.address,
      Line_Items: data.lineItems?.map(item => ({
        Description: item.description,
        Quantity: item.quantity,
        Unit_Price: item.unitPrice,
        Total_Price: item.totalPrice
      })),
      Currency: 'ILS'
    };
    
    if (!SUPPLIER_API_KEY) {
      logger.warn('[IsraeliTax] RASA_SUPPLIER_API_KEY not configured - simulation mode');
      logger.warn('[IsraeliTax] 📖 See ITA_API_REGISTRATION_GUIDE.md to set up new ITA OAuth2 API');
      
      const mockAllocationNumber = `MOCK-${Date.now()}`;
      
      await firestoreDb.collection('invoices').doc(data.invoiceId).update({
        rasaAllocationNumber: mockAllocationNumber,
        status: 'APPROVED_SIMULATION',
        submittedVia: 'SIMULATION',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      res.status(200).json({
        success: true,
        allocationNumber: mockAllocationNumber,
        simulation: true,
        submissionMethod: 'SIMULATION',
        note: 'Configure ITA_CLIENT_ID and ITA_CLIENT_SECRET for real submissions'
      });
      return;
    }
    
    const response = await axios.post(RASA_API_ENDPOINT, invoicePayload, {
      headers: {
        'Authorization': `Bearer ${SUPPLIER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const allocationNumber = response.data.Allocation_Number;
    
    if (!allocationNumber) {
      throw new Error('No allocation number received from RASA');
    }
    
    await firestoreDb.collection('invoices').doc(data.invoiceId).update({
      rasaAllocationNumber: allocationNumber,
      status: 'APPROVED',
      rasaResponse: response.data,
      submittedVia: 'LEGACY_RASA_API',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info('[IsraeliTax] Tax invoice approved (legacy RASA)', {
      invoiceId: data.invoiceId,
      allocationNumber
    });
    
    res.status(200).json({
      success: true,
      allocationNumber,
      submissionMethod: 'LEGACY_RASA_API'
    });
    
  } catch (error: any) {
    logger.error('[IsraeliTax] Invoice submission error:', error);
    
    if (req.body.invoiceId) {
      await firestoreDb.collection('invoices').doc(req.body.invoiceId).update({
        status: 'SUBMISSION_FAILED',
        submissionError: error.message,
        failedAt: admin.firestore.FieldValue.serverTimestamp()
      }).catch(err => {
        logger.error('[IsraeliTax] Failed to update invoice status:', err);
      });
    }
    
    res.status(500).json({
      error: 'Failed to get Allocation Number',
      details: error.response?.data || error.message
    });
  }
}

/**
 * Calculate VAT for invoice
 */
export function calculateVAT(amountBeforeVAT: number): {
  vatAmount: number;
  totalAmount: number;
} {
  const vatAmount = Math.round(amountBeforeVAT * VAT_RATE * 100) / 100;
  const totalAmount = Math.round((amountBeforeVAT + vatAmount) * 100) / 100;
  
  return { vatAmount, totalAmount };
}

/**
 * Check if user has finance role
 */
async function checkFinanceRole(uid: string): Promise<boolean> {
  try {
    const userDoc = await firestoreDb.collection('users').doc(uid).get();
    const role = userDoc.data()?.role;
    return role === 'finance' || role === 'admin';
  } catch (error) {
    logger.error('[IsraeliTax] Role check failed:', error);
    return false;
  }
}

/**
 * Get invoice status from RASA (check if approved)
 */
export async function checkInvoiceStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { allocationNumber } = req.query;
    
    if (!allocationNumber) {
      res.status(400).json({ error: 'Missing allocationNumber parameter' });
      return;
    }
    
    if (!SUPPLIER_API_KEY) {
      res.status(200).json({
        status: 'SIMULATION',
        message: 'RASA integration not configured'
      });
      return;
    }
    
    // Query RASA for invoice status
    const response = await axios.get(
      `${RASA_API_ENDPOINT}/${allocationNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${SUPPLIER_API_KEY}`
        },
        timeout: 15000
      }
    );
    
    logger.info('[IsraeliTax] Invoice status checked', {
      allocationNumber,
      status: response.data.status
    });
    
    res.status(200).json(response.data);
    
  } catch (error: any) {
    logger.error('[IsraeliTax] Status check error:', error);
    res.status(500).json({
      error: 'Failed to check invoice status',
      details: error.message
    });
  }
}

/**
 * Generate year-end tax report
 */
export async function generateYearEndTaxReport(
  year: number
): Promise<{
  totalRevenue: number;
  totalVAT: number;
  invoiceCount: number;
  approvedCount: number;
  failedCount: number;
}> {
  try {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);
    
    const snapshot = await firestoreDb
      .collection('invoices')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate)
      .get();
    
    let totalRevenue = 0;
    let totalVAT = 0;
    let approvedCount = 0;
    let failedCount = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      if (data.status === 'APPROVED') {
        totalRevenue += data.amountBeforeVAT || 0;
        totalVAT += data.vatAmount || 0;
        approvedCount++;
      } else if (data.status === 'RASA_FAILED') {
        failedCount++;
      }
    });
    
    const report = {
      totalRevenue,
      totalVAT,
      invoiceCount: snapshot.size,
      approvedCount,
      failedCount
    };
    
    logger.info('[IsraeliTax] Year-end tax report generated', {
      year,
      ...report
    });
    
    return report;
    
  } catch (error: any) {
    logger.error('[IsraeliTax] Report generation failed:', error);
    throw error;
  }
}
