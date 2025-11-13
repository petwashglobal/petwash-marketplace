/**
 * PET WASH LTD - GLOBAL SUPER APP ARCHITECTURE
 * Single source of truth for all platforms, types, navigation, KYC, payments, and mobile integration
 * 
 * @description Core configuration and type definitions for the entire Pet Wash Ltd ecosystem
 * @version 2.0.0
 * @last-updated 2025-11-13
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type PlatformId =
  | "K9000_WASH"
  | "WALK_MY_PET"
  | "SITTER_SUITE"
  | "PET_TREK"
  | "GROOMERS"
  | "PET_WASH_HUB";

export type UserRole =
  | "CUSTOMER"
  | "WALKER"
  | "SITTER"
  | "DRIVER"
  | "GROOMER"
  | "ADMIN"
  | "PARTNER"
  | "OWNER"
  | "CEO"
  | "CFO"
  | "FINANCE"
  | "KYC_OFFICER"
  | "COMPLIANCE_OFFICER"
  | "AUDITOR"
  | "EXECUTIVE"
  | "ENTERPRISE_OPS";

export type BookingState =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "DECLINED"
  | "REFUNDED"
  | "DISPUTED";

export type CurrencyCode = "ILS" | "USD" | "EUR";

export type KycLevel = "LIGHT" | "STANDARD" | "ENHANCED";

export type DeviceType = "WEB" | "IOS" | "ANDROID";

export type LocaleCode =
  | "he-IL"
  | "en-US"
  | "ar-IL"
  | "ru-RU"
  | "fr-FR"
  | "es-ES";

// ============================================================================
// GLOBAL BRAND CONFIGURATION
// ============================================================================

export const petWashGlobalBrand = {
  companyLegalName: "Pet Wash Ltd",
  trademarkName: "Pet Wash™",
  trademarkSymbol: "TM",
  legalCountryOfIncorporation: "Israel",
  primarySupportEmail: "support@petwash.co.il",
  marketingDomain: "https://www.petwash.co.il",
  defaultCurrency: "ILS" as CurrencyCode,
  supportedLocales: [
    "he-IL",
    "en-US",
    "ar-IL",
    "ru-RU",
    "fr-FR",
    "es-ES",
  ] as LocaleCode[],
} as const;

// ============================================================================
// UI THEME - PURE WHITE LUXURY DESIGN SYSTEM
// ============================================================================

export const petWashUiTheme = {
  globalBackgroundColor: "#FFFFFF",
  allowedBackgroundColors: ["#FFFFFF"],
  primaryBrandColor: "#00B894",
  accentColor: "#1E90FF",
  errorColor: "#E53935",
  successColor: "#00C853",
  logo: {
    shouldUseTransparentPngOnly: true,
    maxHeightPx: 40,
    minHeightPx: 24,
    neverPlaceInsideColoredCard: true,
    requireTrademarkSymbol: true,
  },
  layout: {
    maxContentWidthPx: 1280,
    safeContentWidthPx: 1140,
    minPaddingHorizontalPx: 16,
    minPaddingVerticalPx: 12,
    breakpoints: {
      mobile: 0,
      tablet: 768,
      desktop: 1024,
      largeDesktop: 1440,
    },
    clampLayout: true,
  },
  typography: {
    fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    headingWeight: 600,
    bodyWeight: 400,
    baseFontSizePx: 16,
    minTouchTargetSizePx: 44,
  },
} as const;

// ============================================================================
// PLATFORM CATALOG - ALL 6 BUSINESS UNITS
// ============================================================================

export interface PlatformDefinition {
  id: PlatformId;
  displayName: string;
  shortCode: string;
  description: string;
  basePath: string;
  enabled: boolean;
}

export const petWashPlatforms: readonly PlatformDefinition[] = [
  {
    id: "K9000_WASH",
    displayName: "K9000 Self Wash",
    shortCode: "K9000",
    description: "Self service pet wash stations with Nayax payments.",
    basePath: "/k9000",
    enabled: true,
  },
  {
    id: "WALK_MY_PET",
    displayName: "Walk My Pet™",
    shortCode: "WALK",
    description: "Uber style dog walking marketplace.",
    basePath: "/walk-my-pet",
    enabled: true,
  },
  {
    id: "SITTER_SUITE",
    displayName: "The Sitter Suite™",
    shortCode: "SITTER",
    description: "Airbnb style pet sitters and home hosts.",
    basePath: "/sitter-suite",
    enabled: true,
  },
  {
    id: "PET_TREK",
    displayName: "PetTrek™ Transport",
    shortCode: "TREK",
    description: "Uber style safe pet transport.",
    basePath: "/pettrek",
    enabled: true,
  },
  {
    id: "GROOMERS",
    displayName: "Groomers",
    shortCode: "GROOM",
    description: "Premium grooming bookings and memberships.",
    basePath: "/groomers",
    enabled: true,
  },
  {
    id: "PET_WASH_HUB",
    displayName: "Pet Wash Hub",
    shortCode: "HUB",
    description: "Central hub, loyalty, account, admin and franchise.",
    basePath: "/hub",
    enabled: true,
  },
] as const;

// ============================================================================
// DEEP NAVIGATION MODEL - MULTI-LAYER HAMBURGER MENUS
// ============================================================================

export interface NavItem {
  id: string;
  label: string;
  path?: string;
  icon?: string;
  children?: NavItem[];
  rolesAllowed?: UserRole[];
}

export const platformNavigation: Record<PlatformId, NavItem[]> = {
  K9000_WASH: [
    {
      id: "k9000_overview",
      label: "Overview",
      path: "/k9000",
    },
    {
      id: "k9000_find_station",
      label: "Find a station",
      path: "/k9000/stations",
    },
    {
      id: "k9000_book_wash",
      label: "Book a wash",
      path: "/k9000/booking",
      children: [
        { id: "k9000_now", label: "Wash now", path: "/k9000/booking/now" },
        { id: "k9000_schedule", label: "Schedule", path: "/k9000/booking/schedule" },
      ],
    },
    {
      id: "k9000_wallet",
      label: "Loyalty and e-gift",
      path: "/k9000/wallet",
    },
    {
      id: "k9000_history",
      label: "My K9000 history",
      path: "/k9000/history",
    },
    {
      id: "k9000_support",
      label: "Help and safety",
      path: "/k9000/support",
    },
  ],
  WALK_MY_PET: [
    {
      id: "walk_overview",
      label: "Walk My Pet home",
      path: "/walk-my-pet",
    },
    {
      id: "walk_explore",
      label: "Browse walkers",
      path: "/walk-my-pet/explore",
    },
    {
      id: "walk_book",
      label: "Book a walk",
      path: "/walk-my-pet/book",
      children: [
        { id: "walk_one_time", label: "One time walk", path: "/walk-my-pet/book/one-time" },
        { id: "walk_recurring", label: "Recurring plan", path: "/walk-my-pet/book/recurring" },
      ],
    },
    {
      id: "walk_upcoming",
      label: "Upcoming walks",
      path: "/walk-my-pet/upcoming",
    },
    {
      id: "walk_past",
      label: "Past walks",
      path: "/walk-my-pet/history",
    },
    {
      id: "walk_my_walkers",
      label: "My walkers",
      path: "/walk-my-pet/my-walkers",
    },
    {
      id: "walk_membership",
      label: "Memberships",
      path: "/walk-my-pet/memberships",
    },
    {
      id: "walk_safety",
      label: "Safety and rules",
      path: "/walk-my-pet/safety",
    },
    {
      id: "walk_help",
      label: "Help center",
      path: "/walk-my-pet/help",
    },
  ],
  SITTER_SUITE: [
    {
      id: "sitter_home",
      label: "The Sitter Suite",
      path: "/sitter-suite",
    },
    {
      id: "sitter_explore",
      label: "Browse sitters",
      path: "/sitter-suite/explore",
    },
    {
      id: "sitter_search",
      label: "Find a sitter",
      path: "/sitter-suite/search",
    },
    {
      id: "sitter_list_home",
      label: "List your home",
      path: "/sitter-suite/host",
      rolesAllowed: ["SITTER"],
    },
    {
      id: "sitter_bookings",
      label: "My bookings",
      path: "/sitter-suite/bookings",
    },
    {
      id: "sitter_messages",
      label: "Messages",
      path: "/sitter-suite/messages",
    },
    {
      id: "sitter_earnings",
      label: "Earnings and payouts",
      path: "/sitter-suite/earnings",
      rolesAllowed: ["SITTER"],
    },
    {
      id: "sitter_reviews",
      label: "Reviews",
      path: "/sitter-suite/reviews",
    },
    {
      id: "sitter_become_sitter",
      label: "Become a sitter",
      path: "/sitter-suite/become-sitter",
    },
  ],
  PET_TREK: [
    {
      id: "trek_home",
      label: "PetTrek home",
      path: "/pettrek",
    },
    {
      id: "trek_explore",
      label: "Browse drivers",
      path: "/pettrek/explore",
    },
    {
      id: "trek_request",
      label: "Request a ride",
      path: "/pettrek/book",
    },
    {
      id: "trek_upcoming",
      label: "Upcoming rides",
      path: "/pettrek/upcoming",
    },
    {
      id: "trek_history",
      label: "Ride history",
      path: "/pettrek/history",
    },
    {
      id: "trek_drivers",
      label: "My drivers",
      path: "/pettrek/drivers",
    },
    {
      id: "trek_zones",
      label: "Zones and pricing",
      path: "/pettrek/pricing",
    },
    {
      id: "trek_safety",
      label: "Safety center",
      path: "/pettrek/safety",
    },
    {
      id: "trek_help",
      label: "Help and support",
      path: "/pettrek/help",
    },
  ],
  GROOMERS: [
    {
      id: "groom_home",
      label: "Groomers home",
      path: "/groomers",
    },
    {
      id: "groom_explore",
      label: "Browse groomers",
      path: "/groomers/explore",
    },
    {
      id: "groom_find",
      label: "Find a groomer",
      path: "/groomers/search",
    },
    {
      id: "groom_book",
      label: "Book grooming",
      path: "/groomers/book",
    },
    {
      id: "groom_upcoming",
      label: "Upcoming appointments",
      path: "/groomers/upcoming",
    },
    {
      id: "groom_history",
      label: "Appointment history",
      path: "/groomers/history",
    },
    {
      id: "groom_favourites",
      label: "Favourite groomers",
      path: "/groomers/favorites",
    },
    {
      id: "groom_pricing",
      label: "Pricing and packages",
      path: "/groomers/pricing",
    },
    {
      id: "groom_help",
      label: "Help center",
      path: "/groomers/help",
    },
  ],
  PET_WASH_HUB: [
    {
      id: "hub_home",
      label: "Pet Wash Hub",
      path: "/hub",
    },
    {
      id: "hub_loyalty",
      label: "My loyalty and wallets",
      path: "/hub/loyalty",
    },
    {
      id: "hub_pets",
      label: "My pets",
      path: "/hub/pets",
    },
    {
      id: "hub_bookings",
      label: "All my bookings",
      path: "/hub/bookings",
    },
    {
      id: "hub_admin",
      label: "Admin and operations",
      path: "/hub/admin",
      rolesAllowed: ["ADMIN"],
      children: [
        { id: "hub_admin_analytics", label: "Analytics", path: "/hub/admin/analytics" },
        { id: "hub_admin_franchise", label: "Franchise leads", path: "/hub/admin/franchise" },
        { id: "hub_admin_support", label: "Support tickets", path: "/hub/admin/support" },
      ],
    },
  ],
};

// ============================================================================
// KYC ENGINE CONFIGURATION
// ============================================================================

export interface KycLevelConfig {
  id: KycLevel;
  description: string;
  requiredFields: string[];
  requiresDocumentUpload: boolean;
  maxMonthlyVolumeILS: number;
}

export const kycConfig = {
  providerName: "PetWashKYC2025",
  levels: {
    LIGHT: {
      id: "LIGHT" as KycLevel,
      description: "Email, phone and basic profile. For basic K9000 and small bookings.",
      requiredFields: ["fullName", "email", "phone"],
      requiresDocumentUpload: false,
      maxMonthlyVolumeILS: 1500,
    } as KycLevelConfig,
    STANDARD: {
      id: "STANDARD" as KycLevel,
      description:
        "National ID or passport, selfie match, address. For walkers, sitters, drivers, groomers.",
      requiredFields: [
        "fullName",
        "email",
        "phone",
        "dateOfBirth",
        "nationalIdNumber",
        "documentFrontImage",
        "selfieImage",
        "address",
      ],
      requiresDocumentUpload: true,
      maxMonthlyVolumeILS: 50000,
    } as KycLevelConfig,
    ENHANCED: {
      id: "ENHANCED" as KycLevel,
      description: "Full KYC for high volume partners and franchisees.",
      requiredFields: [
        "fullName",
        "email",
        "phone",
        "dateOfBirth",
        "nationalIdNumber",
        "documentFrontImage",
        "documentBackImage",
        "selfieImage",
        "address",
        "companyName",
        "companyRegistrationNumber",
        "bankIban",
      ],
      requiresDocumentUpload: true,
      maxMonthlyVolumeILS: 9999999,
    } as KycLevelConfig,
  },
  resolveKycLevelForRole(role: UserRole): KycLevel {
    if (role === "CUSTOMER") return "LIGHT";
    if (role === "ADMIN" || role === "PARTNER" || role === "OWNER") return "ENHANCED";
    return "STANDARD";
  },
} as const;

// ============================================================================
// WALLET INTEGRATION - APPLE WALLET & GOOGLE WALLET
// ============================================================================

export const walletIntegrationConfig = {
  enableAppleWallet: true,
  enableGoogleWallet: true,
  defaultCardStyle: {
    backgroundColor: "#FFFFFF",
    textColor: "#000000",
    accentColor: petWashUiTheme.primaryBrandColor,
    showPetAvatar: true,
  },
  passTemplateIds: {
    loyaltyCard: "petwash_loyalty_2025",
    staffId: "petwash_staff_2025",
  },
} as const;

// ============================================================================
// NAYAX PAYMENT ORCHESTRATION - ISRAEL EXCLUSIVE
// ============================================================================

export const paymentOrchestrationConfig = {
  primaryGateway: "NAYAX" as const,
  k9000Gateway: "NAYAX" as const,
  marketplaceGateway: "NAYAX" as const,
  currencies: ["ILS", "USD", "EUR"] as CurrencyCode[],
  taxRules: {
    defaultCountry: "IL",
    includeVatInPrice: true,
    vatPercent: 17,
  },
  bookAndPayFlow: {
    timeoutMinutes: 15,
  },
  escrowConfig: {
    releaseDelayHours: 72,
    providerPayoutMethod: "ISRAELI_BANK_TRANSFER" as const,
  },
} as const;

// ============================================================================
// BOOKING SERVICE CONTRACTS
// ============================================================================

export interface BookingCreateInput {
  platformId: PlatformId;
  customerId: string;
  petIds: string[];
  providerId?: string;
  startsAt: string; // ISO 8601 datetime
  endsAt: string; // ISO 8601 datetime
  currency: CurrencyCode;
  totalAmount: number;
  deviceType: DeviceType;
  locale: LocaleCode;
}

export interface BookingRecord {
  id: string;
  platformId: PlatformId;
  customerId: string;
  petIds?: string[];
  providerId?: string;
  startsAt: string;
  endsAt: string;
  state: BookingState;
  currency: CurrencyCode;
  totalAmount: number;
  totalAmountCents: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// PAYMENT GATEWAY CONTRACTS
// ============================================================================

export interface CreatePaymentIntentInput {
  bookingId: string;
  customerId: string;
  platformId: PlatformId;
  amountCents: number;
  currency: CurrencyCode;
  deviceType: DeviceType;
}

export interface PaymentIntent {
  id: string;
  bookingId: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  gateway: "NAYAX";
  gatewaySessionId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// MOBILE CLIENT INTEGRATION CONTRACT
// ============================================================================

export const mobileClientContract = {
  supportedDevices: ["WEB", "IOS", "ANDROID"] as DeviceType[],
  apiEndpoints: {
    auth: {
      signIn: "/api/auth/sign-in",
      signUp: "/api/auth/sign-up",
      refresh: "/api/auth/refresh",
    },
    booking: {
      createDraft: "/api/bookings",
      listMyBookings: "/api/bookings/me",
      getBooking: (id: string) => `/api/bookings/${id}`,
    },
    payments: {
      createIntent: "/api/payments/intents",
      walletCards: "/api/wallet/cards",
    },
    kyc: {
      startFlow: "/api/kyc/start",
      uploadDocuments: "/api/kyc/upload",
      status: "/api/kyc/status",
    },
  },
  deepLinks: {
    iosScheme: "petwash://",
    androidScheme: "petwash://",
    routes: {
      hubHome: "petwash://hub/home",
      k9000Book: "petwash://k9000/book",
      walkBook: "petwash://walk/book",
      sitterSearch: "petwash://sitter/search",
      trekRequest: "petwash://trek/request",
      groomBook: "petwash://groom/book",
    },
  },
} as const;

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Get platform definition by ID
 */
export function getPlatformById(id: PlatformId): PlatformDefinition | undefined {
  return petWashPlatforms.find((p) => p.id === id);
}

/**
 * Get platform definition by base path
 */
export function getPlatformByPath(path: string): PlatformDefinition | undefined {
  return petWashPlatforms.find((p) => path.startsWith(p.basePath));
}

/**
 * Check if user role has access to navigation item
 */
export function canUserAccessNavItem(userRole: UserRole | undefined, navItem: NavItem): boolean {
  if (!navItem.rolesAllowed || navItem.rolesAllowed.length === 0) {
    return true;
  }
  if (!userRole) {
    return false;
  }
  // Admin and Owner have access to everything
  if (userRole === "ADMIN" || userRole === "OWNER") {
    return true;
  }
  return navItem.rolesAllowed.includes(userRole);
}

/**
 * Get navigation items accessible to user role
 */
export function getAccessibleNavItems(
  platformId: PlatformId,
  userRole: UserRole | undefined
): NavItem[] {
  const navItems = platformNavigation[platformId] || [];
  return navItems.filter((item) => canUserAccessNavItem(userRole, item));
}

/**
 * Convert amount to cents for payment processing
 */
export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert cents to amount for display
 */
export function centsToAmount(cents: number): number {
  return cents / 100;
}
