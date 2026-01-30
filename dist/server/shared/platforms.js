/**
 * Pet Wash™ Platform Configuration
 * Unified platform definitions for the entire ecosystem
 *
 * Architecture: One "Smart Hub" platform with modes for:
 * - diy_station: Indoor/covered smart hub
 * - outdoor_station: Outdoor K9000-style twin machine
 */
export var PlatformId;
(function (PlatformId) {
    PlatformId["SmartHub"] = "SmartHub";
    PlatformId["PetSitter"] = "PetSitter";
    PlatformId["HouseSitting"] = "HouseSitting";
    PlatformId["DoggyDaycare"] = "DoggyDaycare";
    PlatformId["WalkMyPet"] = "WalkMyPet";
    PlatformId["PetTrek"] = "PetTrek";
    PlatformId["Academy"] = "Academy";
    PlatformId["TalentMarketplace"] = "TalentMarketplace";
})(PlatformId || (PlatformId = {}));
export const PLATFORMS = [
    {
        id: PlatformId.SmartHub,
        name: "Pet Wash Smart Hub™",
        nameHe: "Pet Wash Smart Hub™ - עמדת שטיפה חכמה",
        shortName: "Smart Hub",
        icon: "tub",
        description: "Premium DIY Pet Wash Smart Hub with K9000 twin station, organic shampoo and conditioner, tea tree oil rinse, flea control, disinfect cycle and 24/7 QR + Nayax card payments.",
        descriptionHe: "עמדת שטיפה חכמה DIY פרימיום עם עמדת K9000, שמפו ומרכך אורגניים, שטיפת שמן עץ התה, הדברת פרעושים, מחזור חיטוי ותשלומי QR + Nayax 24/7.",
        modes: ["diy_station", "outdoor_station"],
        enabled: true,
        bookingEnabled: true,
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
        description: "Overnight care in a loving sitter's home with PetWash Protect™ ₪25,000 guarantee.",
        descriptionHe: "טיפול לילי בבית מארח אוהב עם ערבות Pet Wash Protect™ של ₪25,000.",
        modes: ["overnight"],
        enabled: true,
        bookingEnabled: true,
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
        description: "Your sitter stays in your home with your pet, providing familiar comfort.",
        descriptionHe: "המטפל נשאר בביתך עם חיית המחמד, מספק נוחות מוכרת.",
        modes: ["in_home"],
        enabled: true,
        bookingEnabled: true,
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
        description: "Daytime care while you work, with playtime and photo updates.",
        descriptionHe: "טיפול יומי בזמן שאתה בעבודה, עם משחקים ועדכוני תמונות.",
        modes: ["daycare"],
        enabled: true,
        bookingEnabled: true,
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
        description: "30 or 60 minute walks with GPS tracking, photo updates, and potty break reports.",
        descriptionHe: "טיולים של 30 או 60 דקות עם מעקב GPS, עדכוני תמונות ודוחות צרכים.",
        modes: ["walk_30", "walk_60"],
        enabled: true,
        bookingEnabled: true,
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
        description: "Safe transportation anywhere you need with climate-controlled vehicles and GPS tracking.",
        descriptionHe: "הסעה בטוחה לכל מקום שתצטרך עם רכבים ממוזגים ומעקב GPS.",
        modes: ["transport"],
        enabled: true,
        bookingEnabled: true,
        requiresEscrow: true,
        supportsLoyalty: true,
        supportsEGift: true,
        route: "/pettrek",
    },
    {
        id: PlatformId.Academy,
        name: "Pet Wash Academy™",
        nameHe: "Pet Wash Academy™ - אילוף כלבים",
        shortName: "Academy",
        icon: "graduation-cap",
        description: "Private and group training with certified trainers using positive reinforcement.",
        descriptionHe: "אימון פרטי וקבוצתי עם מאלפים מוסמכים בגישה חיובית.",
        modes: ["private_training", "group_training"],
        enabled: true,
        bookingEnabled: true,
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
        description: "All sitters, walkers, drivers and trainers in one place with verified profiles.",
        descriptionHe: "כל השמרטפים, הווקרז, הנהגים והמאמנים במקום אחד עם פרופילים מאומתים.",
        modes: [],
        enabled: true,
        bookingEnabled: false,
        requiresEscrow: false,
        supportsLoyalty: false,
        supportsEGift: false,
        route: "/marketplace",
    },
];
export const getPlatformById = (id) => {
    return PLATFORMS.find(p => p.id === id);
};
export const getEnabledPlatforms = () => {
    return PLATFORMS.filter(p => p.enabled);
};
export const getBookablePlatforms = () => {
    return PLATFORMS.filter(p => p.enabled && p.bookingEnabled);
};
export const getPhysicalStations = () => {
    return PLATFORMS.filter(p => p.isPhysicalStation);
};
export const getMarketplacePlatforms = () => {
    return PLATFORMS.filter(p => p.enabled && p.bookingEnabled && p.requiresEscrow);
};
