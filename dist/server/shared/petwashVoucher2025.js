/**
 * PetWash™ Voucher System 2025 - SECURE
 * 7-Star Luxury Digital Vouchers with ES256 JWS Signing
 */
import crypto from "crypto";
import { importPKCS8, importSPKI, SignJWT, jwtVerify } from "jose";
/* ---------------------------------------------------------
   VOUCHER ID & CODE GENERATION
--------------------------------------------------------- */
export function generateVoucherId() {
    const raw = crypto.randomBytes(8).toString("hex").toUpperCase();
    return `PWV-2025-${raw}`;
}
export function generatePublicCode() {
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
function extractImmutableFields(voucher) {
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
    if (!PRIVATE_KEY_PEM)
        throw new Error("Missing VOUCHER_ES256_PRIVATE_KEY_PEM");
    return importPKCS8(PRIVATE_KEY_PEM, "ES256");
}
async function getPublicKey() {
    if (!PUBLIC_KEY_PEM)
        throw new Error("Missing VOUCHER_ES256_PUBLIC_KEY_PEM");
    return importSPKI(PUBLIC_KEY_PEM, "ES256");
}
/**
 * Computes SHA256 hash of IMMUTABLE voucher fields only
 * This hash never changes even after redemptions
 */
export function voucherSha256(voucher) {
    const immutable = extractImmutableFields(voucher);
    const buf = Buffer.from(JSON.stringify(immutable), "utf8");
    return crypto.createHash("sha256").update(buf).digest("hex");
}
export async function signVoucherJws(params) {
    const privateKey = await getPrivateKey();
    const payload = {
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
export async function verifyVoucherJws(jws) {
    const publicKey = await getPublicKey();
    const result = await jwtVerify(jws, publicKey, {
        issuer: VOUCHER_JWS_ISSUER,
        audience: VOUCHER_JWS_AUDIENCE
    });
    return result.payload;
}
export async function signFullVoucher(voucher) {
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
export async function buildBaseVoucher(params) {
    const voucher_id = generateVoucherId();
    const public_code = generatePublicCode();
    const theme = params.theme || "neo_black_platinum";
    const animated = params.animated_highlight ?? true;
    const baseUrl = "https://cdn.petwash.co.il";
    const highres_svg_url = `${baseUrl}/vouchers/${public_code}.svg`;
    const qr_url = `${baseUrl}/qr/${public_code}.svg`;
    const isCurrency = params.value_type === "currency";
    const voucher = {
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
    // Sign voucher with ES256 JWS (hash of IMMUTABLE fields only)
    try {
        const { hash, jws } = await signFullVoucher(voucher);
        voucher.security.sha256 = hash;
        voucher.security.signed_jws = jws;
    }
    catch (error) {
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
export function redeemOneWash(voucher, station, method) {
    const nowIso = new Date().toISOString();
    if (voucher.rules.value_type === "washes") {
        if (voucher.rules.washes_remaining === null || voucher.rules.washes_remaining <= 0) {
            throw new Error("No washes remaining");
        }
        voucher.rules.washes_remaining = voucher.rules.washes_remaining - 1;
    }
    else if (voucher.rules.value_type === "currency") {
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
export function redeemAmount(voucher, amount, station, method) {
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
export async function exampleEgiftVoucher() {
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
export async function exampleMultiWashVoucher() {
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
