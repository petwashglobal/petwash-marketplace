/**
 * Pet Wash™ Platform Configuration
 * Unified platform definitions for the entire ecosystem
 *
 * CORRECTED PLATFORM CLASSIFICATION (April 2026):
 *
 * BOOKING-ENGINE PLATFORMS (provider selection → availability → booking → confirm → complete → payout):
 *   - PetSitter   : overnight/in-home/daycare care marketplace (like Mad Paws)
 *   - HouseSitting: sub-mode of PetSitter — sitter stays at client's home
 *   - DoggyDaycare: sub-mode of PetSitter — daytime care
 *   - WalkMyPet   : dog walking marketplace
 *   - Academy     : pet TRAINER booking marketplace (NOT generic course content)
 *
 * SESSION / REDEEM PLATFORM (entitlement validation → bay auth → session start → atomic consume → ledger):
 *   - SmartHub (K9000 Dual Wash Bay): machine-based, self-service, walk-in + QR/Nayax/wallet/package
 *     Do NOT apply booking-engine lifecycle to K9000.
 *
 * FROZEN / COMING SOON:
 *   - PetTrek: pet transport — pending operational licensing in Israel.
 *     Keep architecture awareness; do NOT build active flows.
 *
 * DIRECTORY (no direct bookings):
 *   - TalentMarketplace: browse sitters/walkers/trainers across platforms
 */

/**
 * Engine type distinguishes operational logic at a platform level.
 * - booking_engine      : provider → availability → booking → confirm → complete → payout
 * - session_redeem      : entitlement/payment validation → machine auth → session → atomic consume → ledger
 * - directory           : browse/search only, no direct booking
 * - coming_soon         : frozen / pending licensing — no active flows
 */
export type PlatformEngineType =
  | "booking_engine"
  | "session_redeem"
  | "directory"
  | "coming_soon";

export enum PlatformId {
  SmartHub = "SmartHub",
  PetSitter = "PetSitter",
  HouseSitting = "HouseSitting",
  DoggyDaycare = "DoggyDaycare",
  WalkMyPet = "WalkMyPet",
  PetTrek = "PetTrek",
  Academy = "Academy",
  TalentMarketplace = "TalentMarketplace",
}

export type PlatformMode =
  | "diy_station"       // indoor / covered smart hub
  | "outdoor_station"   // outdoor K9000-style twin machine
  | "overnight"         // overnight pet sitting
  | "in_home"           // sitter stays at client's home
  | "daycare"           // daytime care
  | "walk_30"           // 30 minute walk
  | "walk_60"           // 60 minute walk
  | "transport"         // pet transport
  | "private_training"  // private dog training
  | "group_training";   // group training sessions

export interface PlatformDefinition {
  id: PlatformId;
  name: string;
  nameHe: string;
  shortName: string;
  icon: string;
  description: string;
  descriptionHe: string;
  modes: PlatformMode[];
  enabled: boolean;
  /** True only for booking-engine platforms that accept provider bookings. K9000 is false. */
  bookingEnabled: boolean;
  /** Operational engine type — must be used to select the correct lifecycle logic. */
  engineType: PlatformEngineType;
  requiresEscrow: boolean;
  supportsLoyalty: boolean;
  supportsEGift: boolean;
  isPhysicalStation?: boolean;
  /** True when the platform is frozen / pending licensing — no active flows allowed. */
  comingSoon?: boolean;
  route: string;
}

export const PLATFORMS: PlatformDefinition[] = [
  {
    id: PlatformId.SmartHub,
    name: "Pet Wash Smart Hub™",
    nameHe: "Pet Wash Smart Hub™ - עמדת שטיפה חכמה",
    shortName: "Smart Hub",
    icon: "tub",
    description:
      "K9000 dual wash bay — self-service, walk-in capable. Nayax QR + card terminal. Supports wallet, package, e-gift, loyalty, and coupon redemption. Session/redeem engine — not a booking marketplace.",
    descriptionHe:
      "עמדת K9000 Dual Wash Bay לשטיפה עצמית, כניסה חופשית. תשלום Nayax QR + כרטיס. תומך בארנק, חבילות, כרטיסי מתנה, נאמנות וקופונים.",
    modes: ["diy_station", "outdoor_station"],
    enabled: true,
    bookingEnabled: false, // K9000 is a session/redeem engine — NOT a booking marketplace
    engineType: "session_redeem",
    requiresEscrow: false,
    supportsLoyalty: true,
    supportsEGift: true,
    isPhysicalStation: true,
    route: "/k9000",
  },
  {
    id: PlatformId.PetSitter,
    name: "Pet Sitter™",
    nameHe: "פנסיון לחיות מחמד",
    shortName: "Sitter",
    icon: "home",
    description: "Human-service booking marketplace for overnight and scheduled care in a loving sitter's home. Provider selection, availability, booking, confirmation, payout and refund/cancel logic. PetWash Protect™ ₪25,000 guarantee.",
    descriptionHe: "שוק שירותי טיפול — טיפול לילי ומתוזמן בבית מארח אוהב עם ערבות Pet Wash Protect™ של ₪25,000.",
    modes: ["overnight"],
    enabled: true,
    bookingEnabled: true,
    engineType: "booking_engine",
    requiresEscrow: true,
    supportsLoyalty: true,
    supportsEGift: true,
    route: "/sitter-suite",
  },
  {
    id: PlatformId.HouseSitting,
    name: "House Sitting™",
    nameHe: "שמרטפות בבית",
    shortName: "House Sit",
    icon: "sofa",
    description: "Pet Sitter mode — sitter stays in your home with your pet, providing familiar comfort.",
    descriptionHe: "מצב שמרטפות — המטפל נשאר בביתך עם חיית המחמד, מספק נוחות מוכרת.",
    modes: ["in_home"],
    enabled: true,
    bookingEnabled: true,
    engineType: "booking_engine",
    requiresEscrow: true,
    supportsLoyalty: true,
    supportsEGift: true,
    route: "/sitter-suite",
  },
  {
    id: PlatformId.DoggyDaycare,
    name: "Doggy Daycare™",
    nameHe: "מעון יום לכלבים",
    shortName: "Daycare",
    icon: "users",
    description: "Pet Sitter mode — daytime care while you work, with playtime and photo updates.",
    descriptionHe: "מצב שמרטפות — טיפול יומי בזמן שאתה בעבודה, עם משחקים ועדכוני תמונות.",
    modes: ["daycare"],
    enabled: true,
    bookingEnabled: true,
    engineType: "booking_engine",
    requiresEscrow: true,
    supportsLoyalty: true,
    supportsEGift: true,
    route: "/sitter-suite",
  },
  {
    id: PlatformId.WalkMyPet,
    name: "Walk My Pet™",
    nameHe: "Walk My Pet™ - טיולי כלבים",
    shortName: "Walk",
    icon: "footprints",
    description: "Dog walking booking marketplace. Separate from Pet Sitter — distinct provider (walker), scheduling, walk completion, payout, and refund/cancel logic. 30 or 60 minute walks with GPS tracking, photo updates, and potty break reports.",
    descriptionHe: "שוק הזמנות ספציפי להליכת כלבים. ווקרים נפרדים מסיטרים. טיולים של 30 או 60 דקות עם מעקב GPS, עדכוני תמונות ודוחות צרכים.",
    modes: ["walk_30", "walk_60"],
    enabled: true,
    bookingEnabled: true,
    engineType: "booking_engine",
    requiresEscrow: true,
    supportsLoyalty: true,
    supportsEGift: true,
    route: "/walk-my-pet",
  },
  {
    id: PlatformId.PetTrek,
    name: "PetTrek™",
    nameHe: "PetTrek™ - הסעות חיות מחמד",
    shortName: "PetTrek",
    icon: "car",
    description: "Pet transport — COMING SOON. Pending operational licensing in Israel. No active flows. Architecture preserved for future implementation.",
    descriptionHe: "הסעות חיות מחמד — בקרוב. ממתין לרישוי תפעולי בישראל. אין זרימות פעילות.",
    modes: ["transport"],
    enabled: false, // FROZEN — pending licensing. Do not enable without legal clearance.
    bookingEnabled: false,
    engineType: "coming_soon",
    comingSoon: true,
    requiresEscrow: false,
    supportsLoyalty: false,
    supportsEGift: false,
    route: "/pettrek",
  },
  {
    id: PlatformId.Academy,
    name: "Pet Wash Academy™",
    nameHe: "Pet Wash Academy™ - אילוף כלבים",
    shortName: "Academy",
    icon: "graduation-cap",
    description: "Pet TRAINER booking marketplace. Private and group training sessions with certified trainers using positive reinforcement. Provider (trainer) selection, availability, booking creation, confirmation, session completion, payout and refund/cancel logic.",
    descriptionHe: "שוק הזמנות מאלפי חיות מחמד. אימון פרטי וקבוצתי עם מאלפים מוסמכים בגישה חיובית.",
    modes: ["private_training", "group_training"],
    enabled: true,
    bookingEnabled: true,
    engineType: "booking_engine",
    requiresEscrow: true,
    supportsLoyalty: true,
    supportsEGift: true,
    route: "/academy",
  },
  {
    id: PlatformId.TalentMarketplace,
    name: "Talent Marketplace™",
    nameHe: "Talent Marketplace™ - מאגר אנשי מקצוע",
    shortName: "Talent",
    icon: "star",
    description: "Browse sitters, walkers, and trainers across all booking-engine platforms in one place with verified profiles. Directory only — bookings are made through the individual platform.",
    descriptionHe: "עיון בשמרטפים, ווקרים ומאלפים ממאגר אנשי מקצוע מאומתים. ספריית עיון בלבד.",
    modes: [],
    enabled: true,
    bookingEnabled: false,
    engineType: "directory",
    requiresEscrow: false,
    supportsLoyalty: false,
    supportsEGift: false,
    route: "/marketplace",
  },
];

export const getPlatformById = (id: PlatformId): PlatformDefinition | undefined => {
  return PLATFORMS.find(p => p.id === id);
};

export const getEnabledPlatforms = (): PlatformDefinition[] => {
  return PLATFORMS.filter(p => p.enabled);
};

export const getBookablePlatforms = (): PlatformDefinition[] => {
  return PLATFORMS.filter(p => p.enabled && p.bookingEnabled);
};

export const getPhysicalStations = (): PlatformDefinition[] => {
  return PLATFORMS.filter(p => p.isPhysicalStation);
};

export const getMarketplacePlatforms = (): PlatformDefinition[] => {
  return PLATFORMS.filter(p => p.enabled && p.bookingEnabled && p.requiresEscrow);
};

/** Returns only the active booking-engine platforms (Pet Sitter, Walk My Pet, Academy and their sub-modes). */
export const getBookingEnginePlatforms = (): PlatformDefinition[] => {
  return PLATFORMS.filter(p => p.enabled && p.engineType === "booking_engine");
};

/** Returns the K9000 session/redeem platforms. */
export const getSessionRedeemPlatforms = (): PlatformDefinition[] => {
  return PLATFORMS.filter(p => p.enabled && p.engineType === "session_redeem");
};

/** Returns platforms that are frozen / coming soon. */
export const getComingSoonPlatforms = (): PlatformDefinition[] => {
  return PLATFORMS.filter(p => p.engineType === "coming_soon");
};
