/**
 * ⁦Pet Wash™⁩ Payment Configuration
 * Central configuration for all payment methods across the platform
 * 
 * CRITICAL: Nayax is currently DISABLED pending API key configuration
 */

export const PAYMENTS_CONFIG = {
  enableNayax: false,
  enableCreditCard: true,
  enableApplePay: false,
  enableGooglePay: false,
  
  defaultPaymentMethod: 'reservation_hold' as const,
  
  nayaxDisabledMessage: {
    en: 'Mobile payment (Nayax) will be available soon. Payment will be processed at the station.',
    he: 'תשלום נייד (Nayax) יהיה זמין בקרוב. התשלום יתבצע בתחנה.',
    ar: 'الدفع عبر الهاتف (Nayax) سيكون متاحًا قريبًا. سيتم الدفع في المحطة.',
    ru: 'Мобильная оплата (Nayax) скоро будет доступна. Оплата будет произведена на станции.',
    fr: 'Le paiement mobile (Nayax) sera bientôt disponible. Le paiement sera effectué à la station.',
    es: 'El pago móvil (Nayax) estará disponible pronto. El pago se realizará en la estación.',
  },
  
  reservationHoldMessage: {
    en: 'Your reservation is confirmed. Payment will be processed at the station.',
    he: 'ההזמנה אושרה. התשלום יתבצע בתחנה.',
    ar: 'تم تأكيد حجزك. سيتم الدفع في المحطة.',
    ru: 'Ваше бронирование подтверждено. Оплата будет произведена на станции.',
    fr: 'Votre réservation est confirmée. Le paiement sera effectué à la station.',
    es: 'Su reserva está confirmada. El pago se realizará en la estación.',
  },
  
  escrowMessage: {
    en: 'Secure 72-hour escrow protection for both parties.',
    he: 'הגנת נאמנות מאובטחת ל-72 שעות לשני הצדדים.',
    ar: 'حماية ضمان آمنة لمدة 72 ساعة لكلا الطرفين.',
    ru: 'Безопасная 72-часовая эскроу защита для обеих сторон.',
    fr: 'Protection séquestre sécurisée de 72 heures pour les deux parties.',
    es: 'Protección de depósito seguro de 72 horas para ambas partes.',
  },
};

export type PaymentMethod = 'credit_card' | 'nayax' | 'nayax-onsite' | 'reservation_hold' | 'manual_hold';

export function isNayaxEnabled(): boolean {
  return PAYMENTS_CONFIG.enableNayax;
}

export function getActivePaymentMethod(): PaymentMethod {
  if (PAYMENTS_CONFIG.enableNayax) {
    return 'nayax';
  }
  return PAYMENTS_CONFIG.defaultPaymentMethod;
}

export function getNayaxDisabledMessage(lang: string): string {
  const messages = PAYMENTS_CONFIG.nayaxDisabledMessage;
  return messages[lang as keyof typeof messages] || messages.en;
}

export function getReservationMessage(lang: string): string {
  const messages = PAYMENTS_CONFIG.reservationHoldMessage;
  return messages[lang as keyof typeof messages] || messages.en;
}
