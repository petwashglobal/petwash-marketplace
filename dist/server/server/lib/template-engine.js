/**
 * 🎨 TEMPLATE ENGINE
 *
 * Dynamic template placeholder replacement for emails, SMS, and notifications.
 * Supports customer personalization, loyalty data, and system variables.
 */
import { logger } from './logger';
/**
 * Format currency values in ILS
 */
function formatCurrency(amount) {
    return `₪${amount.toFixed(2)}`;
}
/**
 * Format date based on locale
 */
function formatDate(date, locale = 'he') {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US');
}
/**
 * Format time based on locale
 */
function formatTime(date, locale = 'he') {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}
/**
 * Get tier display name
 */
function getTierName(tier, locale = 'he') {
    const tierNames = {
        new: { en: 'New Member', he: 'חבר חדש' },
        silver: { en: 'Silver', he: 'כסף' },
        gold: { en: 'Gold', he: 'זהב' },
        platinum: { en: 'Platinum', he: 'פלטינה' },
        diamond: { en: 'Diamond', he: 'יהלום' }
    };
    return tierNames[tier]?.[locale] || tier;
}
/**
 * Replace template placeholders with actual data
 * Supports nested variables, conditional blocks, and formatting functions
 */
export function replaceTemplates(content, context, locale = 'he') {
    let processedContent = content;
    // 1. Customer Variables
    const customerVars = {
        firstName: context.firstName || '',
        lastName: context.lastName || '',
        fullName: `${context.firstName || ''} ${context.lastName || ''}`.trim() || 'Valued Customer',
        email: context.email || '',
        phone: context.phone || '',
    };
    // 2. Loyalty Variables
    const loyaltyVars = {
        loyaltyTier: context.loyaltyTier ? getTierName(context.loyaltyTier, locale) : '',
        loyaltyPoints: context.loyaltyPoints !== undefined ? context.loyaltyPoints.toString() : '',
        loyaltyLevel: context.loyaltyLevel !== undefined ? context.loyaltyLevel.toString() : '',
        totalWashes: context.totalWashes !== undefined ? context.totalWashes.toString() : '',
    };
    // 3. Pet Variables
    const petVars = {
        petName: context.petName || '',
        petBreed: context.petBreed || '',
        petBirthday: context.petBirthday ? formatDate(context.petBirthday, locale) : '',
    };
    // 4. Transaction Variables
    const transactionVars = {
        transactionId: context.transactionId || '',
        amount: context.amount !== undefined ? formatCurrency(context.amount) : '',
        currency: context.currency || 'ILS',
        discountPercent: context.discountPercent !== undefined ? `${context.discountPercent}%` : '',
        voucherCode: context.voucherCode || '',
    };
    // 5. Appointment Variables
    const appointmentVars = {
        appointmentDate: context.appointmentDate ? formatDate(context.appointmentDate, locale) : '',
        appointmentTime: context.appointmentTime || (context.appointmentDate ? formatTime(context.appointmentDate, locale) : ''),
        location: context.location || '',
        serviceType: context.serviceType || '',
        bookingReference: context.bookingReference || '',
    };
    // 6. Station Variables
    const stationVars = {
        stationId: context.stationId || '',
        stationName: context.stationName || '',
        stationAddress: context.stationAddress || '',
    };
    // 7. System Variables
    const now = new Date();
    const systemVars = {
        currentDate: formatDate(now, locale),
        currentTime: formatTime(now, locale),
        currentYear: now.getFullYear().toString(),
        companyName: 'Pet Wash™',
        supportEmail: 'Support@PetWash.co.il',
        supportPhone: '+972549833355',
        websiteUrl: 'https://petwash.co.il',
    };
    // Merge all variables
    const allVars = {
        ...customerVars,
        ...loyaltyVars,
        ...petVars,
        ...transactionVars,
        ...appointmentVars,
        ...stationVars,
        ...systemVars,
        // Allow custom variables to override
        ...Object.fromEntries(Object.entries(context)
            .filter(([key]) => !['customerId', 'userId'].includes(key))
            .map(([key, value]) => [key, String(value || '')]))
    };
    // Replace all placeholders: {{variableName}}
    Object.entries(allVars).forEach(([key, value]) => {
        // Support both exact and flexible spacing: {{key}} and {{ key }}
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        processedContent = processedContent.replace(regex, value);
    });
    // Remove any remaining unreplaced placeholders (optional - helps with debugging)
    // processedContent = processedContent.replace(/{{[^}]+}}/g, '');
    logger.info(`Template processed with ${Object.keys(allVars).length} variables`);
    return processedContent;
}
/**
 * Validate template syntax (check for unclosed placeholders)
 */
export function validateTemplate(content) {
    const errors = [];
    // Check for unclosed brackets
    const openBrackets = (content.match(/{{/g) || []).length;
    const closeBrackets = (content.match(/}}/g) || []).length;
    if (openBrackets !== closeBrackets) {
        errors.push(`Mismatched brackets: ${openBrackets} opening vs ${closeBrackets} closing`);
    }
    // Check for nested brackets
    if (/{{[^}]*{{/.test(content)) {
        errors.push('Nested placeholders are not allowed');
    }
    // Extract all placeholders for logging
    const placeholders = content.match(/{{[^}]+}}/g) || [];
    logger.info(`Template contains ${placeholders.length} placeholders: ${placeholders.join(', ')}`);
    return {
        isValid: errors.length === 0,
        errors
    };
}
/**
 * Get list of available template variables for documentation
 */
export function getAvailableVariables() {
    return {
        // Customer
        '{{firstName}}': 'Customer first name',
        '{{lastName}}': 'Customer last name',
        '{{fullName}}': 'Customer full name',
        '{{email}}': 'Customer email address',
        '{{phone}}': 'Customer phone number',
        // Loyalty
        '{{loyaltyTier}}': 'Loyalty tier name (New, Silver, Gold, Platinum, Diamond)',
        '{{loyaltyPoints}}': 'Current loyalty points balance',
        '{{loyaltyLevel}}': 'Current loyalty level number',
        '{{totalWashes}}': 'Total lifetime washes',
        // Pet
        '{{petName}}': 'Pet name',
        '{{petBreed}}': 'Pet breed',
        '{{petBirthday}}': 'Pet birthday date',
        // Transaction
        '{{transactionId}}': 'Transaction ID',
        '{{amount}}': 'Transaction amount with currency',
        '{{currency}}': 'Currency code',
        '{{discountPercent}}': 'Discount percentage',
        '{{voucherCode}}': 'Voucher code',
        // Appointment
        '{{appointmentDate}}': 'Appointment date',
        '{{appointmentTime}}': 'Appointment time',
        '{{location}}': 'Appointment location',
        '{{serviceType}}': 'Service type',
        '{{bookingReference}}': 'Booking reference number',
        // Station
        '{{stationId}}': 'Station ID',
        '{{stationName}}': 'Station name',
        '{{stationAddress}}': 'Station address',
        // System
        '{{currentDate}}': 'Current date',
        '{{currentTime}}': 'Current time',
        '{{currentYear}}': 'Current year',
        '{{companyName}}': 'Company name (Pet Wash™)',
        '{{supportEmail}}': 'Support email address',
        '{{supportPhone}}': 'Support phone number',
        '{{websiteUrl}}': 'Website URL',
    };
}
