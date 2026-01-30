/**
 * PII/PAN Redaction Utilities
 * Ensures sensitive data is not logged or exposed
 */
/**
 * Redact Primary Account Number (PAN) - credit card numbers
 * Shows only last 4 digits
 */
export function redactPAN(cardNumber) {
    if (!cardNumber)
        return '****';
    // Remove all non-digits
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 4) {
        return '****';
    }
    // Show only last 4 digits
    const lastFour = digits.slice(-4);
    return `****${lastFour}`;
}
/**
 * Redact email address
 * Shows only first 2 characters and domain
 */
export function redactEmail(email) {
    if (!email)
        return '[redacted]';
    const parts = email.split('@');
    if (parts.length !== 2)
        return '[redacted]';
    const [local, domain] = parts;
    const redactedLocal = local.length > 2
        ? `${local.substring(0, 2)}***`
        : '**';
    return `${redactedLocal}@${domain}`;
}
/**
 * Redact phone number
 * Shows only last 3 digits
 */
export function redactPhone(phone) {
    if (!phone)
        return '[redacted]';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 3)
        return '***';
    const lastThree = digits.slice(-3);
    return `***${lastThree}`;
}
/**
 * Redact payment payload for logging
 * Removes sensitive financial data
 */
export function redactPaymentPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return payload;
    }
    const redacted = { ...payload };
    // Common PAN field names
    const panFields = [
        'cardNumber',
        'card_number',
        'pan',
        'primary_account_number',
        'accountNumber',
        'account_number'
    ];
    // Common CVV field names
    const cvvFields = [
        'cvv',
        'cvc',
        'securityCode',
        'security_code'
    ];
    // Redact PAN fields
    panFields.forEach(field => {
        if (redacted[field]) {
            redacted[field] = redactPAN(redacted[field]);
        }
    });
    // Completely remove CVV fields
    cvvFields.forEach(field => {
        if (redacted[field]) {
            redacted[field] = '***';
        }
    });
    // Redact nested objects
    Object.keys(redacted).forEach(key => {
        if (typeof redacted[key] === 'object' && redacted[key] !== null) {
            redacted[key] = redactPaymentPayload(redacted[key]);
        }
    });
    return redacted;
}
export function calculateVAT(grossAmount) {
    const VAT_RATE = parseFloat(process.env.VAT_RATE || '0.18'); // Israeli VAT rate from env
    // Gross = Net + VAT
    // Gross = Net * (1 + VAT_RATE)
    // Net = Gross / (1 + VAT_RATE)
    const netAmount = grossAmount / (1 + VAT_RATE);
    const vatAmount = grossAmount - netAmount;
    return {
        grossAmount: Number(grossAmount.toFixed(2)),
        vatRate: VAT_RATE,
        vatAmount: Number(vatAmount.toFixed(2)),
        netAmount: Number(netAmount.toFixed(2))
    };
}
/**
 * Format VAT fields for export (CSV/Excel)
 */
export function formatVATForExport(grossAmount) {
    const vat = calculateVAT(grossAmount);
    return {
        'Gross Amount (ILS)': vat.grossAmount,
        'VAT Rate (%)': vat.vatRate * 100,
        'VAT Amount (ILS)': vat.vatAmount,
        'Net Amount (ILS)': vat.netAmount
    };
}
