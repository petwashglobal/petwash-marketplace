/**
 * PETWASH UNIFIED BOOKING SYSTEM - DOMAIN TYPES
 * Based on reference implementation (2025)
 *
 * GUARANTEES:
 * - Every wash, paid or free, has a Booking
 * - Every Booking has exactly one primary Transaction
 * - Transactions are immutable
 * - Admin actions are logged as Events
 * - Human and Machine are both Resources
 */
export const SERVICE_CONFIGS = {
    K9000_WASH: {
        id: "K9000_WASH",
        serviceType: "self_service_wash",
        pricingType: "MINUTES",
        basePrice: 35,
        currency: "ILS",
        vatRate: 0.17,
        rules: {
            requiresStation: true,
            allowAdminFreeRun: true,
            maxMinutes: 30
        }
    },
    PET_ACADEMY: {
        id: "PET_ACADEMY",
        serviceType: "academy_session",
        pricingType: "SESSION",
        basePrice: 200,
        currency: "ILS",
        vatRate: 0.17,
        rules: {
            requiresProvider: true
        }
    },
    PET_SITTER: {
        id: "PET_SITTER",
        serviceType: "pet_sitting",
        pricingType: "HOURLY",
        basePrice: 50,
        currency: "ILS",
        vatRate: 0.17,
        rules: {
            requiresProvider: true,
            maxHours: 168
        }
    },
    PET_WALK: {
        id: "PET_WALK",
        serviceType: "pet_walking",
        pricingType: "HOURLY",
        basePrice: 40,
        currency: "ILS",
        vatRate: 0.17,
        rules: {
            requiresProvider: true,
            maxHours: 4
        }
    },
    PET_TREK: {
        id: "PET_TREK",
        serviceType: "pet_transport",
        pricingType: "DISTANCE",
        basePrice: 15,
        currency: "ILS",
        vatRate: 0.17,
        rules: {
            requiresProvider: true,
            maxHours: 12
        }
    }
};
