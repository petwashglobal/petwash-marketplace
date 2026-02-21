/**
 * ⁦PetWash™⁩ Voucher Security Service (Server-Side Only)
 * ES256 JWS Cryptographic Signing & Verification + Ledger-Based Balance Reconciliation
 * 
 * CRITICAL: This file MUST stay server-side only
 * Never import this into frontend/client code
 */

import { SignJWT, importPKCS8, importSPKI, jwtVerify } from 'jose';
import crypto from 'crypto';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import { voucherUsageLedger, petWashVouchers2025 } from '../../shared/schema';
import type { PetWashVoucher2025 } from '../../shared/petwashVoucher2025Types';
import { logger } from '../lib/logger';

// Load keys from environment with comprehensive newline handling
function loadPemKey(envVar: string | undefined): string {
  if (!envVar) return '';
  
  // Handle multiple newline encodings
  let key = envVar;
  
  // Replace literal \n with actual newlines
  key = key.replace(/\\n/g, '\n');
  
  // Remove any extra whitespace from start/end
  key = key.trim();
  
  // Ensure proper PEM format with newlines
  if (!key.includes('\n') && key.includes('-----BEGIN')) {
    // If key is on one line, split it properly
    key = key
      .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
      .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
      .replace('-----BEGIN PUBLIC KEY-----', '-----BEGIN PUBLIC KEY-----\n')
      .replace('-----END PUBLIC KEY-----', '\n-----END PUBLIC KEY-----');
  }
  
  return key;
}

const PRIVATE_KEY_PEM = loadPemKey(process.env.VOUCHER_ES256_PRIVATE_KEY_PEM);
const PUBLIC_KEY_PEM = loadPemKey(process.env.VOUCHER_ES256_PUBLIC_KEY_PEM);

const VOUCHER_JWS_ISSUER = "petwash.vouchers.2025";
const VOUCHER_JWS_AUDIENCE = "petwash.stations.api";
const VOUCHER_JWS_KID = "petwash-voucher-es256-2025";

interface VoucherJwsPayload {
  iss: string;
  aud: string;
  vid: string;  // voucher_id
  pcode: string; // public_code
  hash: string;  // SHA256 of immutable fields
  type: string;  // voucher type
  uid: string;   // user_id
  iat: number;   // issued at
}

interface VoucherImmutableFields {
  voucher_id: string;
  public_code: string;
  type: string;
  visual: {
    tier: string;
    card_theme: string;
    animated_highlight: boolean;
    highres_svg_url: string | null;
  };
  rules: {
    value_type: string;
    value_original: number;
    washes_original: number | null;
    currency: string | null;
    expires_at: string | null;
    transferable: boolean;
  };
  owner: {
    user_id: string;
    name: string;
    email: string;
    created_in_app: string;
  };
}

function extractImmutableFields(voucher: PetWashVoucher2025): VoucherImmutableFields {
  return {
    voucher_id: voucher.voucher_id,
    public_code: voucher.public_code,
    type: voucher.type,
    visual: {
      tier: voucher.visual.tier,
      card_theme: voucher.visual.card_theme,
      animated_highlight: voucher.visual.animated_highlight,
      highres_svg_url: voucher.visual.highres_svg_url
    },
    rules: {
      value_type: voucher.rules.value_type,
      value_original: voucher.rules.value_original,
      washes_original: voucher.rules.washes_original,
      currency: voucher.rules.currency,
      expires_at: voucher.rules.expires_at,
      transferable: voucher.rules.transferable
    },
    owner: {
      user_id: voucher.owner.user_id,
      name: voucher.owner.name,
      email: voucher.owner.email,
      created_in_app: voucher.owner.created_in_app
    }
  };
}

async function getPrivateKey() {
  if (!PRIVATE_KEY_PEM) {
    throw new Error("Missing VOUCHER_ES256_PRIVATE_KEY_PEM environment variable");
  }
  try {
    // Try direct import first
    return await importPKCS8(PRIVATE_KEY_PEM, "ES256");
  } catch (error: any) {
    console.error('[VoucherSecurity] Private key import error:', error.message);
    console.error('[VoucherSecurity] Key preview (first 100 chars):', PRIVATE_KEY_PEM.substring(0, 100));
    throw new Error(`Failed to import ES256 private key: ${error.message}`);
  }
}

async function getPublicKey() {
  if (!PUBLIC_KEY_PEM) {
    throw new Error("Missing VOUCHER_ES256_PUBLIC_KEY_PEM environment variable");
  }
  try {
    return await importSPKI(PUBLIC_KEY_PEM, "ES256");
  } catch (error: any) {
    console.error('[VoucherSecurity] Public key import error:', error.message);
    console.error('[VoucherSecurity] Key preview (first 100 chars):', PUBLIC_KEY_PEM.substring(0, 100));
    throw new Error(`Failed to import ES256 public key: ${error.message}`);
  }
}

/**
 * Computes SHA256 hash of IMMUTABLE voucher fields only
 * This hash never changes even after redemptions
 */
export function voucherSha256(voucher: PetWashVoucher2025): string {
  const immutable = extractImmutableFields(voucher);
  const buf = Buffer.from(JSON.stringify(immutable), "utf8");
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * Signs voucher with ES256 JWS
 * Returns cryptographic signature string
 */
export async function signVoucherJws(params: {
  voucher_id: string;
  public_code: string;
  hash: string;
  type: string;
  user_id: string;
}): Promise<string> {
  const privateKey = await getPrivateKey();

  const payload: VoucherJwsPayload = {
    iss: VOUCHER_JWS_ISSUER,
    aud: VOUCHER_JWS_AUDIENCE,
    vid: params.voucher_id,
    pcode: params.public_code,
    hash: params.hash,
    type: params.type,
    uid: params.user_id,
    iat: Math.floor(Date.now() / 1000)
  };

  const jws = await new SignJWT(payload)
    .setProtectedHeader({ alg: "ES256", kid: VOUCHER_JWS_KID, typ: "JWT" })
    .sign(privateKey);

  return jws;
}

/**
 * Verifies ES256 JWS signature
 * Returns decrypted payload if valid, throws if invalid
 */
export async function verifyVoucherJws(jws: string): Promise<VoucherJwsPayload> {
  const publicKey = await getPublicKey();
  
  const { payload } = await jwtVerify(jws, publicKey, {
    issuer: VOUCHER_JWS_ISSUER,
    audience: VOUCHER_JWS_AUDIENCE
  });

  return payload as unknown as VoucherJwsPayload;
}

/**
 * Sign complete voucher with JWS + SHA256
 * This is the main function to call when creating vouchers
 */
export async function signFullVoucher(voucher: PetWashVoucher2025): Promise<PetWashVoucher2025> {
  // Generate SHA256 hash of immutable fields
  const hash = voucherSha256(voucher);
  
  // Sign with ES256 JWS
  const signature = await signVoucherJws({
    voucher_id: voucher.voucher_id,
    public_code: voucher.public_code,
    hash,
    type: voucher.type,
    user_id: voucher.owner.user_id
  });

  return {
    ...voucher,
    security: {
      ...voucher.security,
      signature_jws: signature,
      hash_sha256: hash,
      signed_at: new Date().toISOString()
    }
  };
}

/**
 * Verify voucher integrity
 * Checks both signature and hash
 */
export async function verifyVoucherIntegrity(voucher: PetWashVoucher2025): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    // Check signature exists
    if (!voucher.security.signature_jws) {
      errors.push("Missing ES256 signature");
      return { valid: false, errors };
    }

    // Verify JWS signature
    const payload = await verifyVoucherJws(voucher.security.signature_jws);
    
    // Verify voucher ID matches
    if (payload.vid !== voucher.voucher_id) {
      errors.push("Voucher ID mismatch in signature");
    }

    // Verify hash
    const currentHash = voucherSha256(voucher);
    if (payload.hash !== currentHash) {
      errors.push("Hash mismatch - immutable fields were tampered");
    }

    if (voucher.security.hash_sha256 && voucher.security.hash_sha256 !== currentHash) {
      errors.push("Stored hash mismatch");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  } catch (error: any) {
    errors.push(`Signature verification failed: ${error.message}`);
    return { valid: false, errors };
  }
}

/**
 * Ledger-Based Balance Verification & Reconciliation
 * Validates value_remaining against append-only tamper-evident ledger
 */

export interface LedgerVerificationResult {
  valid: boolean;
  errors: string[];
  ledgerBalance: {
    valueRemaining: number;
    washesRemaining: number;
    totalUsed: number;
    washesUsed: number;
  } | null;
  autoRepaired: boolean;
}

/**
 * Verify ledger chain integrity
 * Each entry's prevEntryHash must match the previous entry's entryHash
 */
export async function verifyLedgerChain(voucherId: string): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  
  try {
    // Get all ledger entries for this voucher, ordered by sequence number
    const entries = await db
      .select()
      .from(voucherUsageLedger)
      .where(eq(voucherUsageLedger.voucherId, voucherId))
      .orderBy(voucherUsageLedger.seqNo);
    
    if (entries.length === 0) {
      // No ledger entries yet (new voucher)
      return { valid: true, errors: [] };
    }
    
    // Genesis entry (seq 0) should have null prevEntryHash
    if (entries[0].seqNo !== 0) {
      errors.push("Missing genesis entry (seq 0)");
    }
    
    if (entries[0].prevEntryHash !== null) {
      errors.push("Genesis entry has non-null prevEntryHash");
    }
    
    // Verify chain: each entry's prevEntryHash matches previous entry's entryHash
    for (let i = 1; i < entries.length; i++) {
      const current = entries[i];
      const previous = entries[i - 1];
      
      if (current.seqNo !== previous.seqNo + 1) {
        errors.push(`Sequence gap: expected seq ${previous.seqNo + 1}, got ${current.seqNo}`);
      }
      
      if (current.prevEntryHash !== previous.entryHash) {
        errors.push(`Chain break at seq ${current.seqNo}: prevEntryHash mismatch`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  } catch (error: any) {
    errors.push(`Ledger verification error: ${error.message}`);
    return { valid: false, errors };
  }
}

/**
 * Calculate balance from ledger (source of truth)
 * Returns cumulative usage and remaining balance
 */
export async function calculateLedgerBalance(voucherId: string): Promise<{
  valueOriginal: number;
  washesOriginal: number | null;
  valueRemaining: number;
  washesRemaining: number | null;
  cumulativeValueUsed: number;
  cumulativeWashesUsed: number;
}> {
  // Get voucher original values
  const voucher = await db
    .select()
    .from(petWashVouchers2025)
    .where(eq(petWashVouchers2025.id, voucherId))
    .limit(1);
  
  if (voucher.length === 0) {
    throw new Error(`Voucher not found: ${voucherId}`);
  }
  
  const valueOriginal = parseFloat(voucher[0].valueOriginal || '0');
  const washesOriginal = voucher[0].washesOriginal;
  
  // Get latest ledger entry (has cumulative totals)
  const latestEntry = await db
    .select()
    .from(voucherUsageLedger)
    .where(eq(voucherUsageLedger.voucherId, voucherId))
    .orderBy(desc(voucherUsageLedger.seqNo))
    .limit(1);
  
  if (latestEntry.length === 0) {
    // No usage yet
    return {
      valueOriginal,
      washesOriginal,
      valueRemaining: valueOriginal,
      washesRemaining: washesOriginal,
      cumulativeValueUsed: 0,
      cumulativeWashesUsed: 0
    };
  }
  
  const cumulativeValueUsed = parseFloat(latestEntry[0].cumulativeValueUsed || '0');
  const cumulativeWashesUsed = latestEntry[0].cumulativeWashesUsed || 0;
  
  return {
    valueOriginal,
    washesOriginal,
    valueRemaining: valueOriginal - cumulativeValueUsed,
    washesRemaining: washesOriginal ? washesOriginal - cumulativeWashesUsed : null,
    cumulativeValueUsed,
    cumulativeWashesUsed
  };
}

/**
 * Verify voucher balance against ledger
 * Auto-repairs value_remaining if it doesn't match ledger
 */
export async function verifyAndRepairBalance(voucherId: string): Promise<LedgerVerificationResult> {
  const errors: string[] = [];
  let autoRepaired = false;
  
  try {
    // Step 1: Verify ledger chain integrity
    const chainVerification = await verifyLedgerChain(voucherId);
    if (!chainVerification.valid) {
      errors.push(...chainVerification.errors);
      return {
        valid: false,
        errors,
        ledgerBalance: null,
        autoRepaired: false
      };
    }
    
    // Step 2: Calculate true balance from ledger
    const ledgerBalance = await calculateLedgerBalance(voucherId);
    
    // Step 3: Get current voucher balance
    const voucher = await db
      .select()
      .from(petWashVouchers2025)
      .where(eq(petWashVouchers2025.id, voucherId))
      .limit(1);
    
    if (voucher.length === 0) {
      errors.push("Voucher not found");
      return {
        valid: false,
        errors,
        ledgerBalance: null,
        autoRepaired: false
      };
    }
    
    const currentValueRemaining = parseFloat(voucher[0].valueRemaining || '0');
    const currentWashesRemaining = voucher[0].washesRemaining;
    
    // Step 4: Compare and repair if needed
    const valueDiscrepancy = Math.abs(currentValueRemaining - ledgerBalance.valueRemaining);
    const washesDiscrepancy = currentWashesRemaining !== null && ledgerBalance.washesRemaining !== null
      ? Math.abs(currentWashesRemaining - ledgerBalance.washesRemaining)
      : 0;
    
    if (valueDiscrepancy > 0.01 || washesDiscrepancy > 0) {
      // Discrepancy detected - auto-repair from ledger
      await db
        .update(petWashVouchers2025)
        .set({
          valueRemaining: ledgerBalance.valueRemaining.toFixed(2),
          washesRemaining: ledgerBalance.washesRemaining,
          updatedAt: new Date()
        })
        .where(eq(petWashVouchers2025.id, voucherId));
      
      autoRepaired = true;
      errors.push(
        `Balance mismatch detected and auto-repaired: ` +
        `Value: ${currentValueRemaining} → ${ledgerBalance.valueRemaining.toFixed(2)}, ` +
        `Washes: ${currentWashesRemaining} → ${ledgerBalance.washesRemaining}`
      );
    }
    
    return {
      valid: true, // Valid because we auto-repaired
      errors, // Contains repair log if any
      ledgerBalance: {
        valueRemaining: ledgerBalance.valueRemaining,
        washesRemaining: ledgerBalance.washesRemaining || 0,
        totalUsed: ledgerBalance.cumulativeValueUsed,
        washesUsed: ledgerBalance.cumulativeWashesUsed
      },
      autoRepaired
    };
  } catch (error: any) {
    errors.push(`Balance verification error: ${error.message}`);
    return {
      valid: false,
      errors,
      ledgerBalance: null,
      autoRepaired: false
    };
  }
}

// Test function to verify keys are working
export async function testKeyPair(): Promise<boolean> {
  try {
    logger.info('[VoucherSecurity] Testing ES256 key pair...');
    logger.info('[VoucherSecurity] Private key configured:', PRIVATE_KEY_PEM.length > 0);
    logger.info('[VoucherSecurity] Public key configured:', PUBLIC_KEY_PEM.length > 0);
    
    const privateKey = await getPrivateKey();
    const publicKey = await getPublicKey();
    
    const testPayload = { test: "data", timestamp: Date.now() };
    const testJwt = await new SignJWT(testPayload)
      .setProtectedHeader({ alg: "ES256" })
      .sign(privateKey);
    
    await jwtVerify(testJwt, publicKey);
    
    logger.info('[VoucherSecurity] ✅ ES256 key pair test passed');
    return true;
  } catch (error: any) {
    logger.error('[VoucherSecurity] ❌ ES256 key pair test failed:', error.message);
    return false;
  }
}
