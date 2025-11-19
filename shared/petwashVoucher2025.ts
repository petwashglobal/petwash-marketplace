/**
 * PetWash™ Voucher System 2025 - SECURE
 * 7-Star Luxury Digital Vouchers with ES256 JWS Signing
 */

import crypto from "crypto";
import { importPKCS8, importSPKI, SignJWT, jwtVerify, type JWTPayload } from "jose";

export type VoucherType = "egift" | "package_single" | "package_multi";
export type ValueType = "currency" | "washes";
export type RedeemMethod = "app" | "station" | "qr";
export type CardTheme = "neo_black_platinum" | "neo_emerald" | "neo_silver";

export interface PetWashVoucher2025 {
  voucher_id: string;
  public_code: string;
  type: VoucherType;
  visual: {
    tier: "7star_metal";
    card_theme: CardTheme;
    animated_highlight: boolean;
    highres_svg_url: string;
  };
  rules: {
    value_type: ValueType;
    value_original: number | null;
    value_remaining: number | null;
    washes_original: number | null;
    washes_remaining: number | null;
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
  security: {
    qr_url: string;
    sha256: string;
    signed_jws: string;
  };
  usage: {
    last_used: string | null;
    history: {
      used_at: string;
      station_id: string;
      location_label: string;
      method: RedeemMethod;
    }[];
    redeem_method: RedeemMethod;
  };
}

/* ---------------------------------------------------------
   VOUCHER ID & CODE GENERATION
--------------------------------------------------------- */

export function generateVoucherId(): string {
  const raw = crypto.randomBytes(8).toString("hex").toUpperCase();
  return `PWV-2025-${raw}`;
}

export function generatePublicCode(): string {
  const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
  const a = raw.slice(0, 4);
  const b = raw.slice(4, 8);
  const c = raw.slice(8, 12);
  return `PW-${a}-${b}-${c}`;
}

/* ---------------------------------------------------------
   ES256 JWS SECURITY
--------------------------------------------------------- */

export const VOUCHER_JWS_ISSUER = "petwash.vouchers.2025";
export const VOUCHER_JWS_AUDIENCE = "petwash.stations.api";
export const VOUCHER_JWS_KID = "petwash-voucher-es256-2025";

const PRIVATE_KEY_PEM = process.env.VOUCHER_ES256_PRIVATE_KEY_PEM || "";
const PUBLIC_KEY_PEM = process.env.VOUCHER_ES256_PUBLIC_KEY_PEM || "";

if (!PRIVATE_KEY_PEM || !PUBLIC_KEY_PEM) {
  console.warn("[VoucherSecurity] ES256 keys not set. Signing will fail at runtime.");
}

export interface VoucherJwsPayload extends JWTPayload {
  vid: string;  // voucher_id
  pcode: string;  // public_code
  hash: string;  // sha256
  type: string;  // voucher type
  uid: string;  // user_id
}

async function getPrivateKey() {
  if (!PRIVATE_KEY_PEM) throw new Error("Missing VOUCHER_ES256_PRIVATE_KEY_PEM");
  return importPKCS8(PRIVATE_KEY_PEM, "ES256");
}

async function getPublicKey() {
  if (!PUBLIC_KEY_PEM) throw new Error("Missing VOUCHER_ES256_PUBLIC_KEY_PEM");
  return importSPKI(PUBLIC_KEY_PEM, "ES256");
}

export function voucherSha256(voucher: unknown): string {
  const buf = Buffer.from(JSON.stringify(voucher), "utf8");
  return crypto.createHash("sha256").update(buf).digest("hex");
}

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

export async function verifyVoucherJws(jws: string): Promise<VoucherJwsPayload> {
  const publicKey = await getPublicKey();
  const result = await jwtVerify(jws, publicKey, {
    issuer: VOUCHER_JWS_ISSUER,
    audience: VOUCHER_JWS_AUDIENCE
  });
  return result.payload as VoucherJwsPayload;
}

export async function signFullVoucher(
  voucher: PetWashVoucher2025
): Promise<{ hash: string; jws: string }> {
  const hash = voucherSha256(voucher);
  const jws = await signVoucherJws({
    voucher_id: voucher.voucher_id,
    public_code: voucher.public_code,
    type: voucher.type,
    user_id: voucher.owner.user_id,
    hash
  });
  return { hash, jws };
}

/* ---------------------------------------------------------
   BUILD VOUCHER (WITH SIGNING)
--------------------------------------------------------- */

export async function buildBaseVoucher(params: {
  type: VoucherType;
  value_type: ValueType;
  value: number;
  washes: number;
  currency?: string;
  expires_at?: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  created_in_app: string;
  theme?: CardTheme;
  animated_highlight?: boolean;
}): Promise<PetWashVoucher2025> {
  const voucher_id = generateVoucherId();
  const public_code = generatePublicCode();
  const theme = params.theme || "neo_black_platinum";
  const animated = params.animated_highlight ?? true;
  const baseUrl = "https://cdn.petwash.co.il";
  const highres_svg_url = `${baseUrl}/vouchers/${public_code}.svg`;
  const qr_url = `${baseUrl}/qr/${public_code}.svg`;

  const isCurrency = params.value_type === "currency";

  const voucher: PetWashVoucher2025 = {
    voucher_id,
    public_code,
    type: params.type,
    visual: {
      tier: "7star_metal",
      card_theme: theme,
      animated_highlight: animated,
      highres_svg_url
    },
    rules: {
      value_type: params.value_type,
      value_original: isCurrency ? params.value : null,
      value_remaining: isCurrency ? params.value : null,
      washes_original: isCurrency ? null : params.washes,
      washes_remaining: isCurrency ? null : params.washes,
      currency: isCurrency ? params.currency || "ILS" : null,
      expires_at: params.expires_at || null,
      transferable: true
    },
    owner: {
      user_id: params.owner_id,
      name: params.owner_name,
      email: params.owner_email,
      created_in_app: params.created_in_app
    },
    security: {
      qr_url,
      sha256: "",
      signed_jws: ""
    },
    usage: {
      last_used: null,
      history: [],
      redeem_method: "app"
    }
  };

  // Sign voucher with ES256 JWS
  try {
    const { hash, jws } = await signFullVoucher(voucher);
    voucher.security.sha256 = hash;
    voucher.security.signed_jws = jws;
  } catch (error) {
    console.error("[VoucherSecurity] Failed to sign voucher:", error);
    // Fallback to just SHA256 if signing fails
    voucher.security.sha256 = voucherSha256(voucher);
    voucher.security.signed_jws = "";
  }

  return voucher;
}

/* ---------------------------------------------------------
   REDEMPTION FUNCTIONS
--------------------------------------------------------- */

export function redeemOneWash(
  voucher: PetWashVoucher2025,
  station: { station_id: string; location_label: string },
  method: RedeemMethod
): PetWashVoucher2025 {
  const nowIso = new Date().toISOString();
  
  if (voucher.rules.value_type === "washes") {
    if (voucher.rules.washes_remaining === null || voucher.rules.washes_remaining <= 0) {
      throw new Error("No washes remaining");
    }
    voucher.rules.washes_remaining = voucher.rules.washes_remaining - 1;
  } else if (voucher.rules.value_type === "currency") {
    throw new Error("Currency mode should be redeemed by amount, not by fixed wash");
  }
  
  voucher.usage.last_used = nowIso;
  voucher.usage.history.push({
    used_at: nowIso,
    station_id: station.station_id,
    location_label: station.location_label,
    method
  });
  
  return voucher;
}

export function redeemAmount(
  voucher: PetWashVoucher2025,
  amount: number,
  station: { station_id: string; location_label: string },
  method: RedeemMethod
): PetWashVoucher2025 {
  const nowIso = new Date().toISOString();
  
  if (voucher.rules.value_type !== "currency") {
    throw new Error("Voucher is not currency mode");
  }
  if (voucher.rules.value_remaining === null || voucher.rules.value_remaining <= 0) {
    throw new Error("No value remaining");
  }
  if (voucher.rules.value_remaining < amount) {
    throw new Error("Insufficient value remaining");
  }
  
  voucher.rules.value_remaining = voucher.rules.value_remaining - amount;
  voucher.usage.last_used = nowIso;
  voucher.usage.history.push({
    used_at: nowIso,
    station_id: station.station_id,
    location_label: station.location_label,
    method
  });
  
  return voucher;
}

/* ---------------------------------------------------------
   EXAMPLES
--------------------------------------------------------- */

export async function exampleEgiftVoucher(): Promise<PetWashVoucher2025> {
  return buildBaseVoucher({
    type: "egift",
    value_type: "currency",
    value: 200,
    washes: 0,
    currency: "ILS",
    expires_at: "2027-12-20T00:00:00Z",
    owner_id: "user_001",
    owner_name: "Pet Wash E-gift",
    owner_email: "support@petwash.co.il",
    created_in_app: "PetWash Hub 1.0.0",
    theme: "neo_emerald",
    animated_highlight: true
  });
}

export async function exampleMultiWashVoucher(): Promise<PetWashVoucher2025> {
  return buildBaseVoucher({
    type: "package_multi",
    value_type: "washes",
    value: 0,
    washes: 10,
    expires_at: "2027-12-20T00:00:00Z",
    owner_id: "user_002",
    owner_name: "Pet Wash Package",
    owner_email: "support@petwash.co.il",
    created_in_app: "PetWash Hub 1.0.0",
    theme: "neo_black_platinum",
    animated_highlight: true
  });
}
