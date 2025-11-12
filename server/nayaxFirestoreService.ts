import { db } from './lib/firebase-admin';
import crypto from 'crypto';
import { logger } from './lib/logger';
import { nanoid } from 'nanoid';
import { redactPaymentPayload } from './lib/redaction';

// =====================================
// TYPES & INTERFACES
// =====================================

export interface NayaxTransaction {
  id: string;
  uid: string; // Firebase Auth user ID
  packageId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'declined' | 'failed';
  type?: 'payment' | 'voucher_redemption' | 'egift_redemption' | 'loyalty_discount';
  paymentMethod?: 'card' | 'apple_pay' | 'google_pay' | 'qr_voucher' | 'qr_egift' | 'qr_loyalty';
  terminalId?: string;
  stationId?: string; // K9000 station identifier (e.g., 'IL-001')
  nayaxTransactionId?: string;
  voucherId?: string; // Reference to voucher/egift used
  merchantFee?: number; // Nayax commission (extracted from API or calculated)
  vatRateUsed?: number; // VAT rate at transaction time (for audit compliance)
  vatAmount?: number; // VAT amount calculated at transaction time
  merchantFeeRateUsed?: number; // Merchant fee rate at transaction time (for audit compliance)
  netBeforeFees?: number; // Net amount before merchant fees
  netAfterFees?: number; // Final net amount after merchant fees
  discountApplied?: number; // For loyalty discounts
  discountType?: 'loyalty_general' | 'loyalty_senior' | 'loyalty_disabled';
  userEmail?: string; // For reporting
  createdAt: Date;
  updatedAt: Date;
  metadata?: any;
}

export interface NayaxVoucher {
  id: string;
  transactionId: string;
  uid: string; // Firebase Auth user ID
  packageId: string;
  voucherType: 'single_use' | 'egift' | 'loyalty_discount'; // K9000: Type of voucher
  qrToken: string; // HMAC-signed token
  status: 'active' | 'redeemed' | 'expired' | 'cancelled';
  
  // Single-use voucher fields
  washCount?: number;
  washesRemaining?: number;
  
  // E-gift balance fields (multi-use)
  balanceILS?: number; // Current balance in ILS
  originalBalanceILS?: number; // Original purchase amount
  
  // Loyalty discount fields
  discountType?: 'loyalty_general' | 'loyalty_senior' | 'loyalty_disabled';
  discountRate?: number; // e.g., 0.05 for 5%, 0.10 for 10%
  memberTier?: string; // 'new', 'silver', 'gold', 'platinum', 'diamond' (NEW 5-TIER SYSTEM)
  
  // Station binding (optional policy)
  boundStationId?: string; // If set, can only redeem at this station
  allowAnyStation?: boolean; // Override for admin flexibility
  
  // Redemption tracking
  terminalId?: string; // Where it was last redeemed
  redeemedAt?: Date; // Last redemption date
  redemptionHistory?: Array<{
    amount: number;
    terminalId: string;
    stationId: string;
    timestamp: Date;
  }>;
  
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

export interface NayaxWebhookEvent {
  eventId: string;
  eventType: string;
  transactionId?: string;
  terminalId?: string;
  payload: any;
  processed: boolean;
  createdAt: Date;
}

export interface NayaxTerminal {
  id: string;
  name: string;
  location: string;
  apiKey: string; // For station authentication
  isActive: boolean;
  lastPingAt?: Date;
  createdAt: Date;
}

// =====================================
// CONSTANTS
// =====================================

const VOUCHER_SALT = process.env.VOUCHER_SALT || 'pet-wash-nayax-voucher-secret-2025';
const NAYAX_API_KEY = process.env.NAYAX_API_KEY || 'mock-api-key';
const NAYAX_SECRET = process.env.NAYAX_SECRET || 'mock-secret';
const NAYAX_MERCHANT_ID = process.env.NAYAX_MERCHANT_ID || 'mock-merchant-id';
const NAYAX_BASE_URL = process.env.NAYAX_BASE_URL || 'https://api.nayax.com';
const WEBHOOK_SECRET = process.env.NAYAX_WEBHOOK_SECRET || 'mock-webhook-secret';

// Merchant Fee and VAT Configuration (live from environment)
const NAYAX_MERCHANT_FEE_RATE = parseFloat(process.env.NAYAX_MERCHANT_FEE_RATE || '0.055'); // 5.5% default
const VAT_RATE = parseFloat(process.env.VAT_RATE || '0.18'); // Israeli VAT rate (18% as of Jan 2025)

// K9000 Configuration
const PAYMENTS_PROVIDER = process.env.PAYMENTS_PROVIDER || 'NAYAX';
const K9000_WASH_PRICE = parseFloat(process.env.K9000_WASH_PRICE || '50'); // Default wash price in ILS

// K9000 Station Keys (JSON config) - MUST be set in production
if (!process.env.STATION_KEYS) {
  logger.error('CRITICAL: STATION_KEYS environment variable not set - station authentication will fail');
  throw new Error('STATION_KEYS environment variable is required for K9000 station authentication');
}
const STATION_KEYS: Record<string, string> = JSON.parse(process.env.STATION_KEYS);

// Loyalty discount rates
export const LOYALTY_DISCOUNT_RATES = {
  general: 0.05, // 5% for regular members
  senior: 0.10,  // 10% for senior citizens
  disabled: 0.10 // 10% for disabled persons
} as const;

/**
 * Calculate merchant fee from gross amount
 * @param grossAmount - Total amount charged to customer
 * @param apiProvidedFee - Optional fee from Nayax API response
 * @returns Merchant fee amount
 */
export function calculateMerchantFee(grossAmount: number, apiProvidedFee?: number): number {
  // Use API-provided fee if available, otherwise calculate using rate
  if (apiProvidedFee !== undefined && apiProvidedFee !== null) {
    return apiProvidedFee;
  }
  return grossAmount * NAYAX_MERCHANT_FEE_RATE;
}

/**
 * Calculate VAT breakdown with merchant fees
 * @param grossAmount - Total amount charged to customer
 * @param merchantFee - Nayax merchant fee
 * @returns Object with all financial breakdowns
 */
export function calculateFinancialBreakdown(grossAmount: number, merchantFee: number) {
  const netBeforeFees = grossAmount / (1 + VAT_RATE); // Net revenue before merchant fees
  const vat = grossAmount - netBeforeFees; // VAT amount (18% as of Jan 1, 2025)
  const netAfterFees = netBeforeFees - merchantFee; // Final net to Pet Wash Ltd
  
  return {
    grossAmount,
    vat,
    vatRate: VAT_RATE,
    netBeforeFees,
    merchantFee,
    netAfterFees
  };
}

// =====================================
// TRANSACTION MANAGEMENT
// =====================================

export async function createNayaxTransaction(data: {
  uid: string;
  packageId: string;
  amount: number;
  currency: string;
  customerEmail: string;
}): Promise<{ transaction: NayaxTransaction; paymentUrl: string; qrData?: string }> {
  try {
    const transactionId = nanoid();
    
    const transaction: NayaxTransaction = {
      id: transactionId,
      uid: data.uid,
      packageId: data.packageId,
      amount: data.amount,
      currency: data.currency,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        customerEmail: data.customerEmail
      }
    };

    // Store in Firestore
    await db.collection('nayax_transactions').doc(transactionId).set({
      ...transaction,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString()
    });

    // Mock Nayax API call (replace with real API when credentials available)
    const paymentUrl = `${NAYAX_BASE_URL}/payment?merchantId=${NAYAX_MERCHANT_ID}&transactionId=${transactionId}&amount=${data.amount}&currency=${data.currency}`;

    logger.info('Nayax transaction created', { transactionId });

    return {
      transaction,
      paymentUrl,
      qrData: undefined // QR created after payment approval
    };
  } catch (error) {
    logger.error('Error creating Nayax transaction', error);
    throw error;
  }
}

export async function updateTransactionStatus(
  transactionId: string,
  status: NayaxTransaction['status'],
  nayaxTransactionId?: string,
  merchantFee?: number
): Promise<void> {
  try {
    const updates: any = {
      status,
      updatedAt: new Date().toISOString()
    };

    if (nayaxTransactionId) {
      updates.nayaxTransactionId = nayaxTransactionId;
    }

    // Get current transaction to check if rates already exist
    const doc = await db.collection('nayax_transactions').doc(transactionId).get();
    if (!doc.exists) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    const txData = doc.data();
    const grossAmount = txData?.amount || 0;

    // CRITICAL: Preserve historical immutability - if ANY rate exists, preserve ALL
    const hasVatRate = txData?.vatRateUsed !== undefined && txData?.vatRateUsed !== null;
    const hasMerchantFeeRate = txData?.merchantFeeRateUsed !== undefined && txData?.merchantFeeRateUsed !== null;
    const hasAnyRateMetadata = hasVatRate || hasMerchantFeeRate;
    
    if (!hasAnyRateMetadata && grossAmount > 0) {
      // First-time calculation ONLY - no existing rate metadata
      const finalMerchantFee = merchantFee !== undefined && merchantFee !== null 
        ? merchantFee 
        : grossAmount * NAYAX_MERCHANT_FEE_RATE;
      
      const netBeforeFees = grossAmount / (1 + VAT_RATE);
      const vatAmount = grossAmount - netBeforeFees;
      const netAfterFees = netBeforeFees - finalMerchantFee;

      // Set ALL fields together (first and only time)
      updates.merchantFee = finalMerchantFee;
      updates.vatRateUsed = VAT_RATE;
      updates.vatAmount = vatAmount;
      updates.merchantFeeRateUsed = NAYAX_MERCHANT_FEE_RATE;
      updates.netBeforeFees = netBeforeFees;
      updates.netAfterFees = netAfterFees;

      logger.info('Transaction financial breakdown calculated (first time only)', { 
        transactionId, 
        grossAmount,
        vatRate: VAT_RATE,
        vatAmount,
        merchantFeeRate: NAYAX_MERCHANT_FEE_RATE,
        merchantFee: finalMerchantFee,
        netAfterFees
      });
    } else if (hasAnyRateMetadata) {
      // ANY rate metadata exists - ABSOLUTE IMMUTABILITY
      // NEVER touch: merchantFee, vatRateUsed, vatAmount, merchantFeeRateUsed, netBeforeFees, netAfterFees
      // Only status and nayaxTransactionId can be updated
      logger.info('Transaction has rate metadata - ABSOLUTE immutability enforced', { 
        transactionId, 
        hasVatRate,
        hasMerchantFeeRate,
        existingVatRate: txData.vatRateUsed,
        existingMerchantFeeRate: txData.merchantFeeRateUsed,
        statusUpdate: status,
        compliance: 'HISTORICAL_RATES_PRESERVED'
      });
      
      // Partial metadata detection for manual review
      if (hasVatRate !== hasMerchantFeeRate) {
        logger.warn('PARTIAL METADATA DETECTED - requires manual review', {
          transactionId,
          hasVatRate,
          hasMerchantFeeRate,
          action: 'preserved_existing_skipped_recalculation'
        });
      }
    }

    await db.collection('nayax_transactions').doc(transactionId).update(updates);
    
    logger.info('Transaction status updated', { transactionId, status, ratesPreserved: hasAnyRateMetadata });
  } catch (error) {
    logger.error('Error updating transaction status', error);
    throw error;
  }
}

export async function getTransaction(transactionId: string): Promise<NayaxTransaction | null> {
  try {
    const doc = await db.collection('nayax_transactions').doc(transactionId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    if (!data) return null;

    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    } as NayaxTransaction;
  } catch (error) {
    logger.error('Error getting transaction', error);
    return null;
  }
}

// =====================================
// VOUCHER MANAGEMENT
// =====================================

function generateQRToken(voucherId: string): string {
  const timestamp = Date.now();
  const payload = `${voucherId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', VOUCHER_SALT)
    .update(payload)
    .digest('hex');
  
  return `${voucherId}:${timestamp}:${signature}`;
}

function verifyQRToken(token: string): { valid: boolean; voucherId?: string } {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) {
      return { valid: false };
    }

    const [voucherId, timestamp, signature] = parts;
    const payload = `${voucherId}:${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', VOUCHER_SALT)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false };
    }

    // Check if token is too old (24 hours)
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 24 * 60 * 60 * 1000) {
      return { valid: false };
    }

    return { valid: true, voucherId };
  } catch (error) {
    logger.error('Error verifying QR token', error);
    return { valid: false };
  }
}

export async function createVoucher(data: {
  transactionId: string;
  uid: string;
  packageId: string;
  washCount: number;
}): Promise<NayaxVoucher> {
  try {
    const voucherId = nanoid();
    const qrToken = generateQRToken(voucherId);

    const voucher: NayaxVoucher = {
      id: voucherId,
      transactionId: data.transactionId,
      uid: data.uid,
      packageId: data.packageId,
      qrToken,
      status: 'active',
      washCount: data.washCount,
      washesRemaining: data.washCount,
      createdAt: new Date()
    };

    await db.collection('nayax_vouchers').doc(voucherId).set({
      ...voucher,
      createdAt: voucher.createdAt.toISOString()
    });

    logger.info('Voucher created', { voucherId, uid: data.uid });

    return voucher;
  } catch (error) {
    logger.error('Error creating voucher', error);
    throw error;
  }
}

export async function getVoucherByToken(token: string): Promise<NayaxVoucher | null> {
  try {
    const verification = verifyQRToken(token);
    if (!verification.valid || !verification.voucherId) {
      return null;
    }

    const doc = await db.collection('nayax_vouchers').doc(verification.voucherId).get();
    
    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) return null;

    return {
      ...data,
      createdAt: new Date(data.createdAt),
      redeemedAt: data.redeemedAt ? new Date(data.redeemedAt) : undefined,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined
    } as NayaxVoucher;
  } catch (error) {
    logger.error('Error getting voucher by token', error);
    return null;
  }
}

export async function redeemVoucher(
  voucherId: string,
  terminalId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const doc = await db.collection('nayax_vouchers').doc(voucherId).get();
    
    if (!doc.exists) {
      return { success: false, message: 'Voucher not found' };
    }

    const voucher = doc.data() as any;

    if (voucher.status !== 'active') {
      return { success: false, message: `Voucher is ${voucher.status}` };
    }

    if (voucher.washesRemaining <= 0) {
      return { success: false, message: 'No washes remaining' };
    }

    // Decrease wash count or mark as redeemed
    const updates: any = {
      washesRemaining: voucher.washesRemaining - 1,
      terminalId,
      updatedAt: new Date().toISOString()
    };

    if (updates.washesRemaining === 0) {
      updates.status = 'redeemed';
      updates.redeemedAt = new Date().toISOString();
    }

    await db.collection('nayax_vouchers').doc(voucherId).update(updates);

    logger.info('Voucher redeemed', { voucherId, washesRemaining: updates.washesRemaining });

    return { success: true };
  } catch (error) {
    logger.error('Error redeeming voucher', error);
    return { success: false, message: 'Redemption failed' };
  }
}

export async function getUserVouchers(uid: string): Promise<NayaxVoucher[]> {
  try {
    const snapshot = await db
      .collection('nayax_vouchers')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        redeemedAt: data.redeemedAt ? new Date(data.redeemedAt) : undefined,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined
      } as NayaxVoucher;
    });
  } catch (error) {
    logger.error('Error getting user vouchers', error);
    return [];
  }
}

// =====================================
// WEBHOOK EVENT HANDLING
// =====================================

export async function logWebhookEvent(eventData: {
  eventId: string;
  eventType: string;
  transactionId?: string;
  terminalId?: string;
  payload: any;
}): Promise<void> {
  try {
    // Check for duplicate (idempotency)
    const existing = await db.collection('nayax_webhook_events').doc(eventData.eventId).get();
    if (existing.exists) {
      logger.info('Duplicate webhook event ignored', { eventId: eventData.eventId });
      return;
    }

    const event: NayaxWebhookEvent = {
      ...eventData,
      processed: false,
      createdAt: new Date()
    };

    await db.collection('nayax_webhook_events').doc(eventData.eventId).set({
      ...event,
      createdAt: event.createdAt.toISOString()
    });

    // Log with redacted payload (no PAN/CVV)
    logger.info('Webhook event logged', { 
      eventId: eventData.eventId, 
      eventType: eventData.eventType,
      payload: redactPaymentPayload(eventData.payload)
    });
  } catch (error) {
    logger.error('Error logging webhook event', error);
    throw error;
  }
}

export async function markEventProcessed(eventId: string): Promise<void> {
  try {
    await db.collection('nayax_webhook_events').doc(eventId).update({
      processed: true,
      processedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error marking event as processed', error);
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// =====================================
// TERMINAL MANAGEMENT
// =====================================

export async function validateStationKey(apiKey: string): Promise<NayaxTerminal | null> {
  try {
    const snapshot = await db
      .collection('nayax_terminals')
      .where('apiKey', '==', apiKey)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const data = snapshot.docs[0].data();
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      lastPingAt: data.lastPingAt ? new Date(data.lastPingAt) : undefined
    } as NayaxTerminal;
  } catch (error) {
    logger.error('Error validating station key', error);
    return null;
  }
}

export async function updateTerminalPing(terminalId: string): Promise<void> {
  try {
    await db.collection('nayax_terminals').doc(terminalId).update({
      lastPingAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error updating terminal ping', error);
  }
}

// =====================================
// ADMIN: TRANSACTION QUERIES
// =====================================

export interface AdminTransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  station?: string;
  user?: string;
  type?: string;
  status?: string;
}

export async function getAdminTransactions(filters: AdminTransactionFilters = {}): Promise<any[]> {
  try {
    // Fetch all transactions (ordered by creation date, limited to 500 most recent)
    // Use client-side filtering to avoid Firestore composite index requirements
    const query = db.collection('nayax_transactions')
      .orderBy('createdAt', 'desc')
      .limit(500);

    const snapshot = await query.get();

    const transactions = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      // Map backend "approved" status to frontend "completed" for consistency
      let status = data.status;
      if (status === 'approved') {
        status = 'completed';
      }
      
      return {
        id: doc.id,
        uid: data.uid,
        userEmail: data.metadata?.customerEmail,
        stationId: data.metadata?.stationId || data.terminalId,
        terminalId: data.terminalId,
        type: data.type || 'payment', // Use type from data or default to payment
        amount: data.amount,
        currency: data.currency,
        voucherId: data.metadata?.voucherId,
        status: status,
        errorCode: data.metadata?.errorCode,
        errorMessage: data.metadata?.errorMessage,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        rawPayload: redactPaymentPayload(data.metadata || {})
      };
    });

    // Apply all filters client-side
    let filtered = transactions;
    
    // Date filters
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(t => new Date(t.createdAt) >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.createdAt) <= toDate);
    }

    // Status filter (already mapped to frontend values, so direct comparison works)
    if (filters.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    // User filter (search by UID or email)
    if (filters.user) {
      const userLower = filters.user.toLowerCase();
      filtered = filtered.filter(t => 
        (t.uid?.toLowerCase() ?? '').includes(userLower) || 
        (t.userEmail?.toLowerCase() ?? '').includes(userLower)
      );
    }

    // Station filter
    if (filters.station) {
      filtered = filtered.filter(t => 
        t.stationId?.includes(filters.station) || 
        t.terminalId?.includes(filters.station)
      );
    }

    // Type filter
    if (filters.type) {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    return filtered.slice(0, 100); // Return max 100 results
  } catch (error) {
    logger.error('Error fetching admin transactions', error);
    return [];
  }
}

// =====================================
// K9000 STATION CONTROL API
// =====================================

export interface K9000SessionRequest {
  deviceId: string;
  stationId: string;
  terminalId: string;
  amount?: number; // For paid sessions (loyalty discount or card payment)
  voucherCode?: string; // For voucher/egift redemption
  qrToken?: string; // For QR-based redemption
}

export interface K9000SessionResponse {
  success: boolean;
  sessionId: string;
  message: string;
  amountCharged: number;
  voucherInfo?: {
    type: string;
    remainingBalance?: number;
    washesRemaining?: number;
  };
}

/**
 * K9000: Start a wash session at the station
 * Supports: card payment, voucher redemption, e-gift deduction, loyalty discount
 */
export async function startK9000Session(request: K9000SessionRequest): Promise<K9000SessionResponse> {
  try {
    const sessionId = nanoid(16);
    const now = new Date().toISOString();
    
    logger.info('[K9000] Starting session', { 
      deviceId: request.deviceId, 
      stationId: request.stationId,
      hasAmount: !!request.amount,
      hasVoucher: !!request.voucherCode,
      hasQR: !!request.qrToken
    });

    // Scenario 1: QR Token (voucher, e-gift, or loyalty)
    if (request.qrToken) {
      const voucher = await getVoucherByToken(request.qrToken);
      
      if (!voucher) {
        return {
          success: false,
          sessionId,
          message: 'Invalid or expired QR code',
          amountCharged: 0
        };
      }

      // Check station binding
      if (voucher.boundStationId && voucher.boundStationId !== request.stationId && !voucher.allowAnyStation) {
        logger.warn('[K9000] Station binding violation', {
          voucherId: voucher.id,
          boundStation: voucher.boundStationId,
          attemptedStation: request.stationId
        });
        return {
          success: false,
          sessionId,
          message: `This QR code can only be used at station ${voucher.boundStationId}`,
          amountCharged: 0
        };
      }

      // Handle different voucher types
      switch (voucher.voucherType) {
        case 'single_use':
          if (voucher.washesRemaining && voucher.washesRemaining > 0) {
            // Decrement wash count
            const newRemaining = voucher.washesRemaining - 1;
            await db.collection('nayax_vouchers').doc(voucher.id).update({
              washesRemaining: newRemaining,
              status: newRemaining === 0 ? 'redeemed' : 'active',
              redeemedAt: newRemaining === 0 ? now : voucher.redeemedAt,
              lastUsedAt: now,
              terminalId: request.terminalId
            });

            // Create transaction record
            await db.collection('nayax_transactions').add({
              id: sessionId,
              uid: voucher.uid,
              packageId: voucher.packageId,
              type: 'voucher_redemption',
              paymentMethod: 'qr_voucher',
              amount: 0, // Prepaid
              currency: 'ILS',
              status: 'approved',
              voucherId: voucher.id,
              stationId: request.stationId,
              terminalId: request.terminalId,
              createdAt: now,
              updatedAt: now
            });

            return {
              success: true,
              sessionId,
              message: 'Voucher redeemed successfully',
              amountCharged: 0,
              voucherInfo: {
                type: 'single_use',
                washesRemaining: newRemaining
              }
            };
          } else {
            return {
              success: false,
              sessionId,
              message: 'Voucher has no washes remaining',
              amountCharged: 0
            };
          }

        case 'egift':
          if (!voucher.balanceILS || voucher.balanceILS <= 0) {
            return {
              success: false,
              sessionId,
              message: 'E-gift balance is zero',
              amountCharged: 0
            };
          }

          // Deduct wash price from balance
          const deductionAmount = Math.min(K9000_WASH_PRICE, voucher.balanceILS);
          const newBalance = voucher.balanceILS - deductionAmount;

          await db.collection('nayax_vouchers').doc(voucher.id).update({
            balanceILS: newBalance,
            status: newBalance === 0 ? 'redeemed' : 'active',
            redeemedAt: newBalance === 0 ? now : voucher.redeemedAt,
            lastUsedAt: now,
            terminalId: request.terminalId,
            redemptionHistory: [
              ...(voucher.redemptionHistory || []),
              {
                amount: deductionAmount,
                terminalId: request.terminalId,
                stationId: request.stationId,
                timestamp: new Date(now)
              }
            ]
          });

          // Create transaction record
          await db.collection('nayax_transactions').add({
            id: sessionId,
            uid: voucher.uid,
            packageId: voucher.packageId,
            type: 'egift_redemption',
            paymentMethod: 'qr_egift',
            amount: deductionAmount,
            currency: 'ILS',
            status: 'approved',
            voucherId: voucher.id,
            stationId: request.stationId,
            terminalId: request.terminalId,
            createdAt: now,
            updatedAt: now
          });

          // TODO: Send email with remaining balance
          logger.info('[K9000] E-gift balance email queued', {
            uid: voucher.uid,
            remainingBalance: newBalance
          });

          return {
            success: true,
            sessionId,
            message: `E-gift redeemed: ₪${deductionAmount.toFixed(2)} deducted`,
            amountCharged: 0, // No actual charge, using prepaid balance
            voucherInfo: {
              type: 'egift',
              remainingBalance: newBalance
            }
          };

        case 'loyalty_discount':
          if (!voucher.discountRate || !request.amount) {
            return {
              success: false,
              sessionId,
              message: 'Invalid loyalty discount configuration',
              amountCharged: 0
            };
          }

          // Calculate discounted amount
          const discount = request.amount * voucher.discountRate;
          const discountedAmount = request.amount - discount;

          // Mark loyalty voucher as used
          await db.collection('nayax_vouchers').doc(voucher.id).update({
            lastUsedAt: now,
            terminalId: request.terminalId
          });

          // Create transaction record (will need actual payment at terminal)
          await db.collection('nayax_transactions').add({
            id: sessionId,
            uid: voucher.uid,
            packageId: voucher.packageId,
            type: 'loyalty_discount',
            paymentMethod: 'qr_loyalty',
            amount: discountedAmount,
            currency: 'ILS',
            status: 'pending', // Awaiting payment at terminal
            voucherId: voucher.id,
            discountApplied: discount,
            discountType: voucher.discountType,
            stationId: request.stationId,
            terminalId: request.terminalId,
            createdAt: now,
            updatedAt: now
          });

          return {
            success: true,
            sessionId,
            message: `Loyalty discount applied: ${(voucher.discountRate * 100).toFixed(0)}% off`,
            amountCharged: discountedAmount,
            voucherInfo: {
              type: 'loyalty_discount'
            }
          };

        default:
          return {
            success: false,
            sessionId,
            message: 'Unknown voucher type',
            amountCharged: 0
          };
      }
    }

    // Scenario 2: Direct payment (card/Apple Pay at terminal)
    if (request.amount && request.amount > 0) {
      // Create pending transaction (will be confirmed by webhook)
      await db.collection('nayax_transactions').add({
        id: sessionId,
        uid: 'anonymous', // Updated when webhook arrives
        packageId: 'on-demand',
        type: 'payment',
        amount: request.amount,
        currency: 'ILS',
        status: 'pending',
        stationId: request.stationId,
        terminalId: request.terminalId,
        createdAt: now,
        updatedAt: now
      });

      return {
        success: true,
        sessionId,
        message: 'Session started - awaiting payment',
        amountCharged: request.amount
      };
    }

    return {
      success: false,
      sessionId,
      message: 'No valid payment method or voucher provided',
      amountCharged: 0
    };

  } catch (error) {
    logger.error('[K9000] Error starting session', error);
    throw error;
  }
}

/**
 * K9000: End a wash session
 * Reconciles payment status and updates transaction
 */
export async function endK9000Session(sessionId: string, status: 'completed' | 'failed', metadata?: any): Promise<void> {
  try {
    const txRef = db.collection('nayax_transactions').doc(sessionId);
    const txDoc = await txRef.get();
    
    if (!txDoc.exists) {
      logger.warn('[K9000] Session not found for endSession', { sessionId });
      return;
    }

    const tx = txDoc.data();
    const now = new Date().toISOString();

    // Update transaction status
    await txRef.update({
      status: status === 'completed' ? 'approved' : 'failed',
      updatedAt: now,
      metadata: {
        ...tx.metadata,
        ...metadata,
        sessionEndedAt: now
      }
    });

    logger.info('[K9000] Session ended', { 
      sessionId, 
      status,
      type: tx.type,
      amount: tx.amount 
    });

  } catch (error) {
    logger.error('[K9000] Error ending session', error);
    throw error;
  }
}

// =====================================
// SMART STATION MONITORING
// =====================================

export interface StationStatus {
  stationId: string;
  status: 'online' | 'offline' | 'idle' | 'fault';
  lastHeartbeat?: string;
  lastPing?: string;
  lastTransaction?: string;
  consecutiveFailedPings: number;
  uptime?: {
    totalMinutes: number;
    lastCalculated: string;
    daily?: number;
    weekly?: number;
  };
  activeAlerts: number;
}

export interface ECUFault {
  id?: string;
  stationId: string;
  timestamp: string;
  code: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface StationAlert {
  id?: string;
  stationId: string;
  type: 'offline' | 'webhook_failure' | 'ecu_fault' | 'maintenance';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  active: boolean;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedAt?: string;
  autoResolved: boolean;
  createdAt: string;
  updatedAt: string;
  emailSent: boolean;
  emailSentAt?: string;
}

/**
 * Record station heartbeat signal
 */
export async function recordStationHeartbeat(stationId: string, metadata?: any): Promise<void> {
  try {
    const now = new Date().toISOString();
    const terminalRef = db.collection('nayax_terminals').doc(stationId);
    const terminalDoc = await terminalRef.get();

    if (!terminalDoc.exists) {
      logger.warn('[Monitoring] Station not found for heartbeat', { stationId });
      return;
    }

    const currentData = terminalDoc.data();
    const wasOffline = currentData?.status === 'offline';

    // Update terminal with heartbeat
    await terminalRef.update({
      lastHeartbeat: now,
      status: 'online',
      consecutiveFailedPings: 0
    });

    // If station was offline, auto-resolve offline alert
    if (wasOffline) {
      await autoResolveAlerts(stationId, 'offline');
      logger.info('[Monitoring] Station recovered from offline', { stationId });
    }

    logger.info('[Monitoring] Heartbeat recorded', { stationId });
  } catch (error) {
    logger.error('[Monitoring] Error recording heartbeat', error);
  }
}

/**
 * Check for offline stations (no heartbeat for 15 minutes)
 */
export async function checkOfflineStations(): Promise<void> {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    const snapshot = await db
      .collection('nayax_terminals')
      .where('isActive', '==', true)
      .where('status', 'in', ['online', 'idle'])
      .get();

    for (const doc of snapshot.docs) {
      const terminal = doc.data();
      const lastHeartbeat = terminal.lastHeartbeat || terminal.createdAt;

      if (lastHeartbeat < fifteenMinutesAgo) {
        // Mark as offline
        await db.collection('nayax_terminals').doc(doc.id).update({
          status: 'offline'
        });

        // Create alert
        await createStationAlert({
          stationId: doc.id,
          type: 'offline',
          severity: 'critical',
          message: `Station ${doc.id} (${terminal.name}) has been offline for 15 minutes`,
          active: true,
          acknowledged: false,
          resolved: false,
          autoResolved: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          emailSent: false
        });

        logger.warn('[Monitoring] Station marked offline', { 
          stationId: doc.id, 
          lastHeartbeat 
        });
      }
    }
  } catch (error) {
    logger.error('[Monitoring] Error checking offline stations', error);
  }
}

/**
 * Ping station for connectivity check
 */
export async function pingStation(stationId: string): Promise<{ success: boolean; latency?: number }> {
  try {
    const terminalRef = db.collection('nayax_terminals').doc(stationId);
    const terminalDoc = await terminalRef.get();

    if (!terminalDoc.exists) {
      return { success: false };
    }

    const now = new Date().toISOString();
    const startTime = Date.now();

    // Update last ping time
    await terminalRef.update({
      lastPing: now,
      consecutiveFailedPings: 0
    });

    const latency = Date.now() - startTime;

    logger.info('[Monitoring] Station ping successful', { stationId, latency });
    return { success: true, latency };
  } catch (error) {
    logger.error('[Monitoring] Station ping failed', { stationId, error });
    
    // Increment failed ping counter
    const terminalRef = db.collection('nayax_terminals').doc(stationId);
    const terminalDoc = await terminalRef.get();
    
    if (terminalDoc.exists) {
      const currentFailed = terminalDoc.data()?.consecutiveFailedPings || 0;
      await terminalRef.update({
        consecutiveFailedPings: currentFailed + 1
      });

      // If 3 consecutive failures, create alert
      if (currentFailed + 1 >= 3) {
        await createStationAlert({
          stationId,
          type: 'offline',
          severity: 'critical',
          message: `Station ${stationId} failed 3 consecutive ping attempts`,
          active: true,
          acknowledged: false,
          resolved: false,
          autoResolved: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          emailSent: false
        });
      }
    }

    return { success: false };
  }
}

/**
 * Create station alert
 */
export async function createStationAlert(alert: Omit<StationAlert, 'id'>): Promise<string> {
  try {
    // Check if similar active alert already exists (prevent duplicates)
    const existingSnapshot = await db
      .collection('station_alerts')
      .where('stationId', '==', alert.stationId)
      .where('type', '==', alert.type)
      .where('active', '==', true)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      logger.info('[Monitoring] Alert already exists', { 
        stationId: alert.stationId, 
        type: alert.type 
      });
      return existingSnapshot.docs[0].id;
    }

    const docRef = await db.collection('station_alerts').add(alert);
    logger.info('[Monitoring] Alert created', { alertId: docRef.id, ...alert });

    // Send email notification if critical
    if (alert.severity === 'critical' && !alert.emailSent) {
      await sendAlertEmail(docRef.id, alert);
    }

    return docRef.id;
  } catch (error) {
    logger.error('[Monitoring] Error creating alert', error);
    throw error;
  }
}

/**
 * Send alert email via SendGrid
 */
async function sendAlertEmail(alertId: string, alert: Omit<StationAlert, 'id'>): Promise<void> {
  try {
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY!);

    const emailContent = {
      to: 'Support@PetWash.co.il',
      from: 'noreply@petwash.co.il',
      subject: `🚨 Station Alert: ${alert.stationId} ${alert.type.toUpperCase()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">⚠️ STATION ALERT</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; background: #f3f4f6;"><strong>Station:</strong></td>
              <td style="padding: 8px;">${alert.stationId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f3f4f6;"><strong>Type:</strong></td>
              <td style="padding: 8px;">${alert.type.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f3f4f6;"><strong>Severity:</strong></td>
              <td style="padding: 8px;">${alert.severity.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f3f4f6;"><strong>Message:</strong></td>
              <td style="padding: 8px;">${alert.message}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f3f4f6;"><strong>Time:</strong></td>
              <td style="padding: 8px;">${new Date(alert.createdAt).toLocaleString('en-IL', { timeZone: 'Asia/Jerusalem' })}</td>
            </tr>
          </table>

          <h3>Action Required:</h3>
          <ul>
            <li>Check physical station connectivity</li>
            <li>Verify Nayax terminal is powered on</li>
            <li>Check network connection</li>
          </ul>

          <p>
            <a href="https://petwash.co.il/admin/stations?id=${alert.stationId}" 
               style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Station Details
            </a>
          </p>

          <hr style="margin: 20px 0;" />
          <p style="color: #6b7280; font-size: 12px;">
            Pet Wash™ Smart Monitoring System
          </p>
        </div>
      `
    };

    await sgMail.default.send(emailContent);

    // Mark email as sent
    await db.collection('station_alerts').doc(alertId).update({
      emailSent: true,
      emailSentAt: new Date().toISOString()
    });

    logger.info('[Monitoring] Alert email sent', { alertId, to: 'Support@PetWash.co.il' });
  } catch (error) {
    logger.error('[Monitoring] Error sending alert email', error);
  }
}

/**
 * Auto-resolve alerts when condition clears
 */
export async function autoResolveAlerts(stationId: string, type: StationAlert['type']): Promise<void> {
  try {
    const snapshot = await db
      .collection('station_alerts')
      .where('stationId', '==', stationId)
      .where('type', '==', type)
      .where('active', '==', true)
      .get();

    const now = new Date().toISOString();

    for (const doc of snapshot.docs) {
      await doc.ref.update({
        active: false,
        resolved: true,
        autoResolved: true,
        resolvedAt: now,
        updatedAt: now
      });
    }

    if (!snapshot.empty) {
      logger.info('[Monitoring] Auto-resolved alerts', { 
        stationId, 
        type, 
        count: snapshot.size 
      });
    }
  } catch (error) {
    logger.error('[Monitoring] Error auto-resolving alerts', error);
  }
}

/**
 * Acknowledge alert (admin action)
 */
export async function acknowledgeAlert(alertId: string, adminUid: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    await db.collection('station_alerts').doc(alertId).update({
      acknowledged: true,
      acknowledgedBy: adminUid,
      acknowledgedAt: now,
      updatedAt: now
    });

    logger.info('[Monitoring] Alert acknowledged', { alertId, adminUid });
  } catch (error) {
    logger.error('[Monitoring] Error acknowledging alert', error);
    throw error;
  }
}

/**
 * Log ECU fault
 */
export async function logECUFault(fault: Omit<ECUFault, 'id' | 'createdAt'>): Promise<string> {
  try {
    const now = new Date().toISOString();
    const faultData = {
      ...fault,
      createdAt: now
    };

    const docRef = await db.collection('ecu_faults').add(faultData);

    // Update station status to 'fault'
    await db.collection('nayax_terminals').doc(fault.stationId).update({
      status: 'fault'
    });

    // Create alert
    await createStationAlert({
      stationId: fault.stationId,
      type: 'ecu_fault',
      severity: fault.severity,
      message: `${fault.description} (Code: ${fault.code})`,
      active: true,
      acknowledged: false,
      resolved: false,
      autoResolved: false,
      createdAt: now,
      updatedAt: now,
      emailSent: false
    });

    logger.warn('[Monitoring] ECU fault logged', { faultId: docRef.id, ...fault });
    return docRef.id;
  } catch (error) {
    logger.error('[Monitoring] Error logging ECU fault', error);
    throw error;
  }
}

/**
 * Resolve ECU fault
 */
export async function resolveECUFault(faultId: string, adminUid: string, notes?: string): Promise<void> {
  try {
    const now = new Date().toISOString();

    const faultDoc = await db.collection('ecu_faults').doc(faultId).get();
    if (!faultDoc.exists) {
      throw new Error('Fault not found');
    }

    const fault = faultDoc.data() as ECUFault;

    await db.collection('ecu_faults').doc(faultId).update({
      resolved: true,
      resolvedAt: now,
      resolvedBy: adminUid,
      notes: notes || ''
    });

    // Check if any other active faults for this station
    const activeFaultsSnapshot = await db
      .collection('ecu_faults')
      .where('stationId', '==', fault.stationId)
      .where('resolved', '==', false)
      .get();

    // If no more active faults, update station status back to online
    if (activeFaultsSnapshot.empty) {
      await db.collection('nayax_terminals').doc(fault.stationId).update({
        status: 'online'
      });

      // Auto-resolve related alert
      await autoResolveAlerts(fault.stationId, 'ecu_fault');
    }

    logger.info('[Monitoring] ECU fault resolved', { faultId, adminUid });
  } catch (error) {
    logger.error('[Monitoring] Error resolving fault', error);
    throw error;
  }
}

/**
 * Get station status
 */
export async function getStationStatus(stationId: string): Promise<StationStatus | null> {
  try {
    const terminalDoc = await db.collection('nayax_terminals').doc(stationId).get();
    
    if (!terminalDoc.exists) {
      return null;
    }

    const data = terminalDoc.data();

    // Count active alerts
    const alertsSnapshot = await db
      .collection('station_alerts')
      .where('stationId', '==', stationId)
      .where('active', '==', true)
      .get();

    return {
      stationId,
      status: data?.status || 'offline',
      lastHeartbeat: data?.lastHeartbeat,
      lastPing: data?.lastPing,
      lastTransaction: data?.lastTransaction,
      consecutiveFailedPings: data?.consecutiveFailedPings || 0,
      uptime: data?.uptime,
      activeAlerts: alertsSnapshot.size
    };
  } catch (error) {
    logger.error('[Monitoring] Error getting station status', error);
    return null;
  }
}

/**
 * Get all active alerts
 */
export async function getActiveAlerts(stationId?: string): Promise<StationAlert[]> {
  try {
    let query = db.collection('station_alerts').where('active', '==', true);
    
    if (stationId) {
      query = query.where('stationId', '==', stationId);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as StationAlert));
  } catch (error) {
    logger.error('[Monitoring] Error getting active alerts', error);
    return [];
  }
}

/**
 * Get fault log for station
 */
export async function getStationFaults(stationId: string, resolvedFilter?: boolean): Promise<ECUFault[]> {
  try {
    let query = db.collection('ecu_faults').where('stationId', '==', stationId);
    
    if (resolvedFilter !== undefined) {
      query = query.where('resolved', '==', resolvedFilter);
    }

    const snapshot = await query.orderBy('timestamp', 'desc').get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ECUFault));
  } catch (error) {
    logger.error('[Monitoring] Error getting station faults', error);
    return [];
  }
}

/**
 * Simulate random ECU fault (for testing)
 */
export async function simulateRandomFault(stationId: string): Promise<string> {
  const faultCodes = [
    { code: 'E001', description: 'Water pump failure', severity: 'critical' as const },
    { code: 'E002', description: 'Soap dispenser malfunction', severity: 'warning' as const },
    { code: 'E003', description: 'Dryer fan motor failure', severity: 'critical' as const },
    { code: 'E004', description: 'Door sensor error', severity: 'warning' as const },
    { code: 'E005', description: 'Temperature sensor out of range', severity: 'info' as const }
  ];

  const randomFault = faultCodes[Math.floor(Math.random() * faultCodes.length)];

  return await logECUFault({
    stationId,
    timestamp: new Date().toISOString(),
    ...randomFault,
    resolved: false
  });
}
