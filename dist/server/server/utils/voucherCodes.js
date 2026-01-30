import crypto from 'crypto';
const VOUCHER_SALT = process.env.VOUCHER_SALT || '';
if (!VOUCHER_SALT && process.env.NODE_ENV === 'production') {
    throw new Error('VOUCHER_SALT must be set in production');
}
export function generateSecureCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segments = 4;
    const segmentLength = 4;
    const code = Array.from({ length: segments }, () => {
        let segment = '';
        for (let i = 0; i < segmentLength; i++) {
            const randomIndex = crypto.randomInt(0, chars.length);
            segment += chars[randomIndex];
        }
        return segment;
    }).join('-');
    return `PW-${code}`;
}
export function hashVoucherCode(code) {
    return crypto
        .createHash('sha256')
        .update(`${VOUCHER_SALT}${code}`)
        .digest('hex');
}
export function getLast4(code) {
    const cleanCode = code.replace(/-/g, '');
    return cleanCode.slice(-4);
}
export function validateCodeFormat(code) {
    const pattern = /^PW-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
    return pattern.test(code);
}
export function maskCode(code) {
    const last4 = getLast4(code);
    return `PW-****-****-****-${last4}`;
}
