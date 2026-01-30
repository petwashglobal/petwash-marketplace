/**
 * Anti-Bypass Detection System
 * Prevents users from exchanging contact information outside the platform
 * Protects PetWash broker model and ensures all payments go through platform
 */
// Phone number patterns (Israeli and international)
const PHONE_PATTERNS = [
    /(?:\+972|972|0)[\s.-]?(?:5[0-9]|7[0-9])[\s.-]?\d{3}[\s.-]?\d{4}/gi, // Israeli mobile
    /(?:\+972|972|0)[\s.-]?[2-9][\s.-]?\d{7}/gi, // Israeli landline
    /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/gi, // International
    /zero five|אפס חמש|0-5|05-/gi, // Hebrew/English phone hints
];
// Email patterns
const EMAIL_PATTERNS = [
    /[\w.+-]+@[\w-]+\.[\w.-]+/gi, // Standard email
    /[\w.+-]+\s*(?:at|@|ש?תרוקע|אט)\s*[\w-]+\s*(?:dot|\.|\s*נקודה)\s*[\w.-]+/gi, // Obfuscated
    /gmail|yahoo|hotmail|outlook|walla|bezeq/gi, // Email service mentions
];
// Social media / messaging apps
const SOCIAL_PATTERNS = [
    /whatsapp|ווטסאפ|וואטסאפ|wa\.me/gi,
    /telegram|טלגרם|t\.me/gi,
    /instagram|אינסטגרם|insta/gi,
    /facebook|פייסבוק|fb\.com/gi,
    /tiktok|טיקטוק/gi,
    /snapchat|סנאפצ/gi,
    /viber|ויבר/gi,
    /signal|סיגנל/gi,
];
// Payment bypass attempts
const PAYMENT_BYPASS_PATTERNS = [
    /ביט|bit|paybox|פייבוקס/gi,
    /cash|מזומן|העבר כסף|transfer money/gi,
    /paypal|פייפאל/gi,
    /venmo|zelle/gi,
    /direct payment|תשלום ישיר|outside the app|מחוץ לאפליקציה/gi,
];
// Address hints (trying to meet without booking)
const ADDRESS_PATTERNS = [
    /בוא ל|come to|meet at|נפגש ב|address is|הכתובת היא/gi,
];
function detectPatterns(content) {
    const patterns = [];
    const positions = [];
    // Check phone patterns
    PHONE_PATTERNS.forEach(pattern => {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
            if (match.index !== undefined) {
                patterns.push('phone_number');
                positions.push({ start: match.index, end: match.index + match[0].length, type: 'phone' });
            }
        }
    });
    // Check email patterns
    EMAIL_PATTERNS.forEach(pattern => {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
            if (match.index !== undefined) {
                patterns.push('email');
                positions.push({ start: match.index, end: match.index + match[0].length, type: 'email' });
            }
        }
    });
    // Check social patterns
    SOCIAL_PATTERNS.forEach(pattern => {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
            if (match.index !== undefined) {
                const patternName = pattern.source.split('|')[0].toLowerCase();
                patterns.push(patternName);
                positions.push({ start: match.index, end: match.index + match[0].length, type: 'social' });
            }
        }
    });
    // Check payment bypass
    PAYMENT_BYPASS_PATTERNS.forEach(pattern => {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
            if (match.index !== undefined) {
                patterns.push('payment_bypass');
                positions.push({ start: match.index, end: match.index + match[0].length, type: 'payment' });
            }
        }
    });
    return { patterns: [...new Set(patterns)], positions };
}
function redactContent(content, positions) {
    if (positions.length === 0)
        return content;
    // Sort positions by start index (descending) to replace from end
    const sortedPositions = [...positions].sort((a, b) => b.start - a.start);
    let redacted = content;
    for (const pos of sortedPositions) {
        const replacement = `[${pos.type === 'phone' ? 'מספר טלפון' :
            pos.type === 'email' ? 'כתובת אימייל' :
                pos.type === 'social' ? 'רשת חברתית' :
                    'מידע מוסתר'}]`;
        redacted = redacted.slice(0, pos.start) + replacement + redacted.slice(pos.end);
    }
    return redacted;
}
function calculateSeverity(patterns) {
    if (patterns.length === 0)
        return 'none';
    // High severity: direct payment bypass or explicit contact sharing
    if (patterns.includes('payment_bypass'))
        return 'high';
    if (patterns.includes('phone_number') && patterns.includes('whatsapp'))
        return 'high';
    // Medium severity: phone or email
    if (patterns.includes('phone_number') || patterns.includes('email'))
        return 'medium';
    // Low severity: social media mentions
    return 'low';
}
/**
 * Scan message content for bypass attempts
 * Returns detection result with suspicious patterns and redacted content
 */
export function scanForBypass(content) {
    const { patterns, positions } = detectPatterns(content);
    const redactedContent = redactContent(content, positions);
    const severity = calculateSeverity(patterns);
    return {
        isSuspicious: patterns.length > 0,
        patterns,
        redactedContent,
        severity,
    };
}
/**
 * Get warning message for bypass attempt
 */
export function getBypassWarningMessage(patterns, isProvider) {
    const baseMessage = isProvider
        ? 'שיתוף פרטי קשר מחוץ לפלטפורמה אסור ומפר את תנאי השימוש.'
        : 'לבטיחותך, כל התקשורת חייבת להיות דרך הפלטפורמה.';
    return `⚠️ ${baseMessage} הודעות המכילות מספרי טלפון, אימייל או קישורים לרשתות חברתיות יחסמו.`;
}
/**
 * Determine action based on bypass count
 */
export function getBypassAction(attemptCount) {
    if (attemptCount >= 3)
        return 'suspend';
    if (attemptCount >= 1)
        return 'block';
    return 'warn';
}
export const antiBypass = {
    scanForBypass,
    getBypassWarningMessage,
    getBypassAction,
};
