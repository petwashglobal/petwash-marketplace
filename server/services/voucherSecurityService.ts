/**
 * PetWash™ Voucher Security Service (Server-Side Only)
 * ES256 JWS Cryptographic Signing & Verification
 * 
 * CRITICAL: This file MUST stay server-side only
 * Never import this into frontend/client code
 */

import { SignJWT, importPKCS8, importSPKI, jwtVerify } from 'jose';
import crypto from 'crypto';
import type { PetWashVoucher2025 } from '../../shared/petwashVoucher2025Types';

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

// Test function to verify keys are working
export async function testKeyPair(): Promise<boolean> {
  try {
    console.log('[VoucherSecurity] Testing ES256 key pair...');
    console.log('[VoucherSecurity] Private key length:', PRIVATE_KEY_PEM.length);
    console.log('[VoucherSecurity] Public key length:', PUBLIC_KEY_PEM.length);
    
    const privateKey = await getPrivateKey();
    const publicKey = await getPublicKey();
    
    // Try signing a test payload
    const testPayload = { test: "data", timestamp: Date.now() };
    const testJwt = await new SignJWT(testPayload)
      .setProtectedHeader({ alg: "ES256" })
      .sign(privateKey);
    
    console.log('[VoucherSecurity] Test signature created:', testJwt.substring(0, 50) + '...');
    
    // Try verifying it
    const verified = await jwtVerify(testJwt, publicKey);
    console.log('[VoucherSecurity] Test signature verified:', verified.payload);
    
    console.log('[VoucherSecurity] ✅ ES256 key pair test passed');
    return true;
  } catch (error: any) {
    console.error('[VoucherSecurity] ❌ ES256 key pair test failed:', error.message);
    console.error('[VoucherSecurity] Error stack:', error.stack);
    return false;
  }
}
