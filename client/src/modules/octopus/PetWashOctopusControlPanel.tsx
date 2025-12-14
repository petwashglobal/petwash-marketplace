import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

/**
 * FILE: src/modules/octopus/PetWashOctopusControlPanel.tsx
 *
 * PETWASH LUXE 2025 - MAIN OCTOPUS CONTROL PANEL
 * Pure white - metallic - 7 star luxury - Apple level clean UI.
 * 
 * December 2025 Upgrade:
 * - Added TanStack Query integration for real-time admin metrics
 * - Updated all sample data to December 2025
 * - Connected to /api/admin/metrics for live dashboard data
 *
 * This is a front end blueprint for:
 * - Global control panel (HQ)
 * - All platforms in one view (sitters, walkers, transport, academy, smart hub, K9000)
 * - Booking management shell
 * - Sitter and driver profiles
 * - Loyalty, invoices, payouts
 *
 * Dev notes:
 * - Tailwind classes are used for layout and styling. If you do not use Tailwind, replace with your own CSS.
 * - All text and layout can be adjusted, but keep the luxury visual rules consistent.
 * - This file does not talk directly to APIs. Fill the TODOs with your real fetch logic.
 */

/* -----------------------------------------------------------
   1. LUXE 2025 DESIGN TOKENS
   ----------------------------------------------------------- */

const luxe = {
  bgPure: "bg-white",
  textPrimary: "text-slate-900",
  textSoft: "text-slate-500",
  borderSoft: "border-slate-200/70",
  shadowSoft:
    "shadow-[0_18px_45px_rgba(15,23,42,0.08)] shadow-slate-900/10",
  radiusXL: "rounded-3xl",
  radiusLG: "rounded-2xl",
  radiusPill: "rounded-full",
  metallicSurface:
    "bg-gradient-to-br from-slate-50 via-white to-slate-100/80",
  metallicCard:
    "bg-gradient-to-br from-white via-slate-50 to-slate-100/70",
  emeraldAccent: "text-emerald-500",
  emeraldBgSoft: "bg-emerald-50",
  emeraldBorderSoft: "border-emerald-100",
  emeraldGlow:
    "shadow-[0_0_0_1px_rgba(16,185,129,0.4),0_18px_40px_rgba(16,185,129,0.16)]",
  fontSans: "font-[system-ui,-apple-system,BlinkMacSystemFont,Segoe_UI,sans-serif]",
};

/* -----------------------------------------------------------
   2. TYPES
   ----------------------------------------------------------- */

type PetWashPlatformId =
  | "pet_sitter"
  | "house_sitting"
  | "walk_my_pet"
  | "pettrek"
  | "academy"
  | "smart_hub"
  | "k9000"
  | "talent";

interface PetWashPlatform {
  id: PetWashPlatformId;
  name: string;
  labelHe: string;
  description: string;
  status: "live" | "beta" | "planning";
  primaryKpiLabel: string;
  primaryKpiValue: string;
  secondaryKpiLabel: string;
  secondaryKpiValue: string;
  iconEmoji: string;
}

interface BookingSummary {
  id: string;
  platformId: PetWashPlatformId;
  guestName: string;
  petName: string;
  serviceType: string;
  checkIn: string;
  checkOut: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  amountNis: number;
  city: string;
}

interface TalentProfile {
  id: string;
  role: "sitter" | "walker" | "driver" | "trainer" | "operator";
  fullName: string;
  avatarUrl?: string;
  rating: number;
  totalJobs: number;
  city: string;
  bioShort: string;
  badges: string[];
  hourlyFromNis: number;
  verifiedBackground: boolean;
  petTypes: string[];
}

interface LoyaltySnapshot {
  activeMembers: number;
  pointsIssued: number;
  pointsRedeemed: number;
  avgPointsPerUser: number;
}

interface InvoiceSummary {
  id: string;
  type: "customer" | "payout";
  label: string;
  date: string;
  amountNis: number;
  status: "draft" | "issued" | "paid" | "failed";
  counterparty: string;
}

/* -----------------------------------------------------------
   3. DUMMY DATA (REPLACE WITH REAL API LATER)
   ----------------------------------------------------------- */

const PLATFORMS: PetWashPlatform[] = [
  {
    id: "pet_sitter",
    name: "Pet Sitter Luxe",
    labelHe: "פנסיון ובייביסיטר לכלבים וחתולים",
    description:
      "לינה בבית מארח מאושר או בבית הלקוח, כולל עדכוני תמונות וסטורי.",
    status: "live",
    primaryKpiLabel: "Active bookings",
    primaryKpiValue: "128",
    secondaryKpiLabel: "Top rating",
    secondaryKpiValue: "4.96",
    iconEmoji: "🏠",
  },
  {
    id: "house_sitting",
    name: "Home Sitting",
    labelHe: "ישיבה בבית הלקוח",
    description:
      "מטפל מאושר נשאר בבית הלקוח, עם ביטוח וערבות פט ווש.",
    status: "live",
    primaryKpiLabel: "Active stays",
    primaryKpiValue: "42",
    secondaryKpiLabel: "Avg nights",
    secondaryKpiValue: "3.4",
    iconEmoji: "🛋️",
  },
  {
    id: "walk_my_pet",
    name: "Walk My Pet",
    labelHe: "Walk My Pet - טיולי כלבים",
    description:
      "טיולים עם GPS, מעקב חי, תמונות לאחר טיול, וחתימת מסירה.",
    status: "live",
    primaryKpiLabel: "Walks today",
    primaryKpiValue: "73",
    secondaryKpiLabel: "Cities",
    secondaryKpiValue: "6",
    iconEmoji: "🐕",
  },
  {
    id: "pettrek",
    name: "PetTrek Transport",
    labelHe: "PetTrek - הסעות חכמות לחיות מחמד",
    description:
      "הסעות לוטרינר, גרומר, שדה תעופה ומלונות, עם מעקב מלא.",
    status: "beta",
    primaryKpiLabel: "Trips today",
    primaryKpiValue: "19",
    secondaryKpiLabel: "Drivers online",
    secondaryKpiValue: "7",
    iconEmoji: "🚗",
  },
  {
    id: "academy",
    name: "PetWash Academy",
    labelHe: "PetWash Academy - אילוף ולימוד",
    description:
      "מאמנים מוסמכים, שיעורים אישיים וקורסים דיגיטליים.",
    status: "beta",
    primaryKpiLabel: "Sessions booked",
    primaryKpiValue: "31",
    secondaryKpiLabel: "Trainers",
    secondaryKpiValue: "12",
    iconEmoji: "🎓",
  },
  {
    id: "smart_hub",
    name: "Pet Wash Smart Hub",
    labelHe: "Pet Wash Smart Hub - עמדת שטיפה חכמה",
    description:
      "עמדת DIY מפנקת עם שמפו, מרכך, שמן עץ התה, מייבש, ונאייקס.",
    status: "live",
    primaryKpiLabel: "Washes today",
    primaryKpiValue: "54",
    secondaryKpiLabel: "Stations online",
    secondaryKpiValue: "11",
    iconEmoji: "🚿",
  },
  {
    id: "k9000",
    name: "K9000 Signature",
    labelHe: "K9000 - עמדת שטיפה פרימיום",
    description:
      "עמדה פיזית מלאת חיישנים, 24/7, עם ניהול דרך האוקטופוס.",
    status: "live",
    primaryKpiLabel: "Live bays",
    primaryKpiValue: "2",
    secondaryKpiLabel: "Next installs",
    secondaryKpiValue: "5",
    iconEmoji: "💧",
  },
  {
    id: "talent",
    name: "Talent Marketplace",
    labelHe: "Talent Marketplace - מאגר אנשי מקצוע",
    description:
      "כל הסיטרים, ווקרז, דרייברים ומאמנים במקום אחד.",
    status: "live",
    primaryKpiLabel: "Approved talent",
    primaryKpiValue: "214",
    secondaryKpiLabel: "Cities",
    secondaryKpiValue: "9",
    iconEmoji: "⭐",
  },
];

const MOCK_BOOKINGS: BookingSummary[] = [
  {
    id: "BKG-2025-1201",
    platformId: "pet_sitter",
    guestName: "Dana Levi",
    petName: "Luna",
    serviceType: "Overnight at sitter home",
    checkIn: "2025-12-13",
    checkOut: "2025-12-15",
    status: "confirmed",
    amountNis: 620,
    city: "Tel Aviv",
  },
  {
    id: "BKG-2025-1202",
    platformId: "walk_my_pet",
    guestName: "Omer Ben",
    petName: "Rocky",
    serviceType: "60 min GPS Walk",
    checkIn: "2025-12-13",
    checkOut: "2025-12-13",
    status: "pending",
    amountNis: 89,
    city: "Ramat Gan",
  },
  {
    id: "BKG-2025-1203",
    platformId: "pettrek",
    guestName: "Shiri Cohen",
    petName: "Milo",
    serviceType: "Vet transport - return",
    checkIn: "2025-12-12",
    checkOut: "2025-12-12",
    status: "completed",
    amountNis: 210,
    city: "Ra'anana",
  },
];

const MOCK_TALENT: TalentProfile[] = [
  {
    id: "TAL-001",
    role: "sitter",
    fullName: "Ido Shakarzi",
    rating: 4.98,
    totalJobs: 213,
    city: "Rosh HaAyin",
    bioShort:
      "מארח ביתי חם עם חצר מגודרת, ניסיון רב עם כלבים רגישים.",
    badges: ["Top Sitter", "Background Verified", "First Aid"],
    hourlyFromNis: 55,
    verifiedBackground: true,
    petTypes: ["Dogs", "Cats"],
  },
  {
    id: "TAL-002",
    role: "walker",
    fullName: "Tom Chen",
    rating: 4.92,
    totalJobs: 187,
    city: "Tel Aviv",
    bioShort:
      "טיולים עם GPS, עדכוני וידאו, התמחות בכלבים אנרגטיים.",
    badges: ["Elite Walker", "GPS Verified"],
    hourlyFromNis: 45,
    verifiedBackground: true,
    petTypes: ["Dogs"],
  },
];

const MOCK_LOYALTY: LoyaltySnapshot = {
  activeMembers: 1294,
  pointsIssued: 982300,
  pointsRedeemed: 436200,
  avgPointsPerUser: 760,
};

const MOCK_INVOICES: InvoiceSummary[] = [
  {
    id: "INV-2025-1201",
    type: "customer",
    label: "Single Wash - National Park",
    date: "2025-12-12",
    amountNis: 55,
    status: "paid",
    counterparty: "Customer",
  },
  {
    id: "INV-2025-1202",
    type: "customer",
    label: "3 Wash Package",
    date: "2025-12-11",
    amountNis: 150,
    status: "issued",
    counterparty: "Customer",
  },
  {
    id: "INV-2025-2001",
    type: "payout",
    label: "Payout - Ido (Week 50)",
    date: "2025-12-13",
    amountNis: 1820,
    status: "paid",
    counterparty: "Ido Shakarzi",
  },
];

/* -----------------------------------------------------------
   4. SHARED LUXE COMPONENTS
   ----------------------------------------------------------- */

const CardShell: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => {
  return (
    <section
      className={[
        luxe.metallicCard,
        luxe.radiusXL,
        luxe.shadowSoft,
        "border",
        luxe.borderSoft,
        "p-6 md:p-7 lg:p-8",
        "transition-transform duration-200 hover:-translate-y-[1px]",
        className || "",
      ].join(" ")}
    >
      {children}
    </section>
  );
};

interface LuxeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "outline" | "pill";
  size?: "sm" | "md" | "lg";
}

const LuxeButton: React.FC<LuxeButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  className,
  ...rest
}) => {
  const sizeClasses =
    size === "sm"
      ? "px-3 py-1.5 text-xs md:text-sm"
      : size === "lg"
      ? "px-6 py-3 text-sm md:text-base"
      : "px-4 py-2 text-sm";

  let variantClasses = "";
  if (variant === "primary") {
    variantClasses = [
      "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500",
      "text-white",
      "shadow-[0_10px_30px_rgba(16,185,129,0.40)]",
      "hover:shadow-[0_16px_40px_rgba(16,185,129,0.55)]",
      "hover:brightness-110",
      "border border-emerald-300/70",
    ].join(" ");
  } else if (variant === "ghost") {
    variantClasses = [
      "bg-white/50",
      "hover:bg-slate-100/70",
      "text-slate-700",
      "border border-slate-200/70",
    ].join(" ");
  } else if (variant === "outline") {
    variantClasses = [
      "bg-transparent",
      "text-slate-800",
      "border border-slate-300/80",
      "hover:bg-slate-50/70",
    ].join(" ");
  } else if (variant === "pill") {
    variantClasses = [
      "bg-white/60",
      "backdrop-blur",
      "text-slate-800",
      "border border-slate-200/70",
      "hover:bg-slate-100/70",
      luxe.radiusPill,
    ].join(" ");
  }

  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2",
        "font-medium",
        "transition-all duration-150 ease-out",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        luxe.fontSans,
        sizeClasses,
        variant !== "pill" ? "rounded-full" : "",
        variantClasses,
        className || "",
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
};

const SectionTitle: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => (
  <div className="flex flex-col gap-1 mb-4">
    <h2
      className={[
        "text-lg md:text-xl font-semibold tracking-tight",
        luxe.textPrimary,
      ].join(" ")}
    >
      {title}
    </h2>
    {subtitle && (
      <p className={["text-xs md:text-sm", luxe.textSoft].join(" ")}>
        {subtitle}
      </p>
    )}
  </div>
);

/* -----------------------------------------------------------
   5. PLATFORM GRID
   ----------------------------------------------------------- */

const PlatformStatusBadge: React.FC<{ status: PetWashPlatform["status"] }> = ({
  status,
}) => {
  if (status === "live") {
    return (
      <span
        className={[
          "inline-flex items-center gap-1 text-xs px-3 py-1",
          luxe.radiusPill,
          "border border-emerald-200 bg-emerald-50 text-emerald-600",
        ].join(" ")}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Live
      </span>
    );
  }
  if (status === "beta") {
    return (
      <span
        className={[
          "inline-flex items-center gap-1 text-xs px-3 py-1",
          luxe.radiusPill,
          "border border-amber-200 bg-amber-50 text-amber-600",
        ].join(" ")}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Beta
      </span>
    );
  }
  return (
    <span
      className={[
        "inline-flex items-center gap-1 text-xs px-3 py-1",
        luxe.radiusPill,
        "border border-slate-200 bg-slate-50 text-slate-600",
      ].join(" ")}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Planning
    </span>
  );
};

const PlatformGrid: React.FC<{
  platforms: PetWashPlatform[];
  selectedId: PetWashPlatformId;
  onSelect: (id: PetWashPlatformId) => void;
}> = ({ platforms, selectedId, onSelect }) => {
  return (
    <CardShell className="col-span-12 xl:col-span-7">
      <SectionTitle
        title="PetWash Platforms - Octopus View"
        subtitle="All brands in one white, metallic, 7 star overview."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {platforms.map((p) => {
          const selected = p.id === selectedId;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={[
                "group text-left",
                "border",
                "transition-all duration-200",
                "p-4 md:p-5",
                luxe.radiusLG,
                selected
                  ? [
                      luxe.emeraldGlow,
                      "bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/40",
                    ].join(" ")
                  : [luxe.borderSoft, luxe.metallicSurface].join(" "),
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      "h-9 w-9 md:h-10 md:w-10 flex items-center justify-center",
                      "rounded-2xl bg-white border border-slate-100 shadow-sm",
                      "text-lg",
                    ].join(" ")}
                  >
                    {p.iconEmoji}
                  </div>
                  <div className="flex flex-col">
                    <span
                      className={[
                        "text-sm md:text-base font-semibold",
                        luxe.textPrimary,
                      ].join(" ")}
                    >
                      {p.name}
                    </span>
                    <span className="text-[11px] md:text-xs text-slate-500">
                      {p.labelHe}
                    </span>
                  </div>
                </div>
                <PlatformStatusBadge status={p.status} />
              </div>
              <p
                className={[
                  "text-xs md:text-sm mb-3 text-slate-500",
                  "line-clamp-2 md:line-clamp-3",
                ].join(" ")}
              >
                {p.description}
              </p>
              <div className="flex items-center justify-between text-xs md:text-sm">
                <div className="flex flex-col">
                  <span className="text-slate-400">{p.primaryKpiLabel}</span>
                  <span className="font-semibold text-slate-900">
                    {p.primaryKpiValue}
                  </span>
                </div>
                <div className="h-10 w-px bg-slate-200/70" />
                <div className="flex flex-col text-right">
                  <span className="text-slate-400">{p.secondaryKpiLabel}</span>
                  <span className="font-semibold text-slate-900">
                    {p.secondaryKpiValue}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </CardShell>
  );
};

/* -----------------------------------------------------------
   6. BOOKING SHELL (ALL PLATFORMS)
   ----------------------------------------------------------- */

const BookingStatusPill: React.FC<{ status: BookingSummary["status"] }> = ({
  status,
}) => {
  const base =
    "inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium border";
  if (status === "confirmed") {
    return (
      <span
        className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}
      >
        Confirmed
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span
        className={`${base} border-amber-200 bg-amber-50 text-amber-700`}
      >
        Pending
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span
        className={`${base} border-slate-200 bg-slate-50 text-slate-700`}
      >
        Completed
      </span>
    );
  }
  return (
    <span
      className={`${base} border-rose-200 bg-rose-50 text-rose-700`}
    >
      Cancelled
    </span>
  );
};

const BookingShell: React.FC<{
  bookings: BookingSummary[];
  selectedPlatformId: PetWashPlatformId;
}> = ({ bookings, selectedPlatformId }) => {
  const [activeFilter, setActiveFilter] =
    useState<BookingSummary["status"] | "all">("all");

  const filtered = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.platformId !== selectedPlatformId) return false;
        if (activeFilter === "all") return true;
        return b.status === activeFilter;
      }),
    [bookings, selectedPlatformId, activeFilter]
  );

  const platform = PLATFORMS.find((p) => p.id === selectedPlatformId);

  return (
    <CardShell className="col-span-12 xl:col-span-5">
      <SectionTitle
        title={`Bookings - ${platform?.name || ""}`}
        subtitle="All bookings connected to payments, invoices and talent payouts."
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(["all", "pending", "confirmed", "completed"] as const).map(
          (s) => (
            <LuxeButton
              key={s}
              variant={s === activeFilter ? "primary" : "ghost"}
              size="sm"
              onClick={() =>
                setActiveFilter(
                  s === "all" ? "all" : (s as BookingSummary["status"])
                )
              }
            >
              {s === "all"
                ? "All"
                : s.charAt(0).toUpperCase() + s.slice(1)}
            </LuxeButton>
          )
        )}
      </div>

      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
        {filtered.map((b) => (
          <div
            key={b.id}
            className={[
              "flex items-center justify-between gap-3",
              "border border-slate-100/80 bg-white/80",
              "rounded-2xl px-3.5 py-3",
            ].join(" ")}
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-mono text-[11px] text-slate-400">
                  {b.id}
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{b.city}</span>
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {b.petName} - {b.serviceType}
              </div>
              <div className="text-xs text-slate-500">
                {b.guestName} - {b.checkIn} → {b.checkOut}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-sm font-semibold text-slate-900">
                ₪{b.amountNis.toFixed(0)}
              </div>
              <BookingStatusPill status={b.status} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 italic">
            No bookings yet for this platform and filter.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <LuxeButton variant="ghost" size="sm">
          View all bookings
        </LuxeButton>
        <LuxeButton size="sm">Create manual booking</LuxeButton>
      </div>
    </CardShell>
  );
};

/* -----------------------------------------------------------
   7. TALENT PANEL (SITTERS, WALKERS, DRIVERS, TRAINERS)
   ----------------------------------------------------------- */

const TalentRoleLabel: React.FC<{ role: TalentProfile["role"] }> = ({
  role,
}) => {
  if (role === "sitter") return <span>Luxury Pet Sitter</span>;
  if (role === "walker") return <span>Walk My Pet Walker</span>;
  if (role === "driver") return <span>PetTrek Driver</span>;
  if (role === "trainer") return <span>Academy Trainer</span>;
  return <span>Smart Hub Operator</span>;
};

const TalentPanel: React.FC<{ talent: TalentProfile[] }> = ({ talent }) => {
  return (
    <CardShell className="col-span-12 xl:col-span-7">
      <SectionTitle
        title="Talent Marketplace"
        subtitle="All approved sitters, walkers, drivers and trainers in one premium view."
      />
      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
        {talent.map((t) => (
          <div
            key={t.id}
            className={[
              "flex items-center justify-between gap-3",
              "border border-slate-100 bg-white/80",
              "rounded-2xl px-3.5 py-3",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <div
                className={[
                  "h-10 w-10 rounded-full",
                  "bg-gradient-to-br from-slate-100 via-white to-slate-200",
                  "border border-slate-200",
                  "flex items-center justify-center text-sm font-semibold text-slate-700",
                ].join(" ")}
              >
                {t.fullName
                  .split(" ")
                  .map((x) => x[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {t.fullName}
                  </span>
                  {t.verifiedBackground && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Background Verified
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                  <TalentRoleLabel role={t.role} />
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>{t.city}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">
                  {t.bioShort}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {t.badges.map((b) => (
                    <span
                      key={b}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 min-w-[88px]">
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Rating</span>
                <span className="text-sm font-semibold text-slate-900">
                  {t.rating.toFixed(2)}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                {t.totalJobs} jobs
              </div>
              <div className="text-xs font-semibold text-slate-900">
                From ₪{t.hourlyFromNis}/hr
              </div>
              <LuxeButton variant="ghost" size="sm" className="mt-1">
                View profile
              </LuxeButton>
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
};

/* -----------------------------------------------------------
   8. LOYALTY, E GIFT, INVOICES, PAYOUTS
   ----------------------------------------------------------- */

const LoyaltyAndInvoicesPanel: React.FC<{
  loyalty: LoyaltySnapshot;
  invoices: InvoiceSummary[];
}> = ({ loyalty, invoices }) => {
  return (
    <CardShell className="col-span-12 xl:col-span-5">
      <SectionTitle
        title="Loyalty, E Gift, Invoices"
        subtitle="High end packages and clear financial trail for HQ."
      />

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div
          className={[
            "border border-emerald-100",
            "rounded-2xl",
            "p-3.5",
            luxe.emeraldBgSoft,
          ].join(" ")}
        >
          <div className="text-[11px] text-emerald-700 mb-1">
            Active Members
          </div>
          <div className="text-lg font-semibold text-emerald-900 mb-1">
            {loyalty.activeMembers.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700">
            Avg {loyalty.avgPointsPerUser.toLocaleString()} pts per user
          </div>
        </div>
        <div
          className={[
            "border border-slate-200 rounded-2xl p-3.5",
            "bg-gradient-to-br from-slate-50 via-white to-slate-100/60",
          ].join(" ")}
        >
          <div className="text-[11px] text-slate-500 mb-1">
            Points Issued vs Redeemed
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {Math.round(loyalty.pointsRedeemed / 1000)}k
            </span>
            <span className="text-[11px] text-slate-500">
              of {Math.round(loyalty.pointsIssued / 1000)}k pts
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
              style={{
                width: `${Math.min(
                  (loyalty.pointsRedeemed / loyalty.pointsIssued) * 100,
                  100
                ).toFixed(1)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">
          Latest invoices and payouts
        </span>
        <LuxeButton variant="ghost" size="sm">
          View all
        </LuxeButton>
      </div>

      <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
        {invoices.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between gap-2 border border-slate-100 rounded-2xl px-3 py-2.5 bg-white/80"
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-mono text-[10px] text-slate-400">
                  {inv.id}
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{inv.date}</span>
              </div>
              <div className="text-xs text-slate-600">
                {inv.label}
              </div>
              <div className="text-[11px] text-slate-400">
                {inv.type === "customer"
                  ? "Customer invoice"
                  : "Payout"}
                {" - "}
                {inv.counterparty}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-sm font-semibold text-slate-900">
                ₪{inv.amountNis.toFixed(0)}
              </div>
              <span
                className={[
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border",
                  inv.status === "paid"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : inv.status === "issued"
                    ? "border-slate-200 bg-slate-50 text-slate-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
                ].join(" ")}
              >
                {inv.status.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
};

/* -----------------------------------------------------------
   9. K9000 AND SMART HUB STATUS STRIP
   ----------------------------------------------------------- */

const K9000StatusStrip: React.FC = () => {
  return (
    <div
      className={[
        "col-span-12",
        "border",
        "mt-4",
        luxe.borderSoft,
        luxe.radiusXL,
        "px-4 py-3 md:px-6 md:py-4",
        "bg-gradient-to-r from-slate-50 via-white to-slate-50",
        "flex flex-col md:flex-row md:items-center md:justify-between gap-3",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div
          className={[
            "h-9 w-9 rounded-2xl",
            "bg-gradient-to-br from-emerald-500 via-emerald-400 to-emerald-500",
            "text-white flex items-center justify-center text-lg shadow-lg",
          ].join(" ")}
        >
          🚿
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-900">
            K9000 and Smart Hub Status
          </span>
          <span className="text-xs text-slate-500">
            Live bays, water temperature, payment health and QR terminals.
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-slate-700">
            Bays online: <b>2 / 2</b>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-slate-700">
            QR terminals: <b>OK</b>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-700">
            Next service window: <b>Thu 14:30</b>
          </span>
        </div>
      </div>
    </div>
  );
};

/* -----------------------------------------------------------
   10. ADMIN METRICS API TYPES & HOOK
   ----------------------------------------------------------- */

interface AdminMetricsResponse {
  success: boolean;
  metrics: {
    revenue: {
      total: string;
      today: string;
      avgTransaction: string;
      transactionCount: number;
      todayTransactionCount: number;
    };
    stations: {
      active: number;
      total: number;
      errors: number;
      totalWashes: number;
      healthRate: string;
    };
    loyalty: {
      totalMembers: number;
      bronze: number;
      silver: number;
      gold: number;
      platinum: number;
      diamond: number;
      emerald: number;
      royal: number;
      platinumRate: string;
    };
    franchises: {
      active_franchises: number;
      total_franchises: number;
      activation_rate: number;
    };
    timestamp: string;
    timezone: string;
  };
}

const useAdminMetrics = () => {
  return useQuery<AdminMetricsResponse>({
    queryKey: ['/api/admin/metrics'],
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider fresh for 30 seconds
    retry: 2,
  });
};

/* -----------------------------------------------------------
   11. K9000 STATUS STRIP WITH LIVE DATA
   ----------------------------------------------------------- */

const K9000StatusStripWithData: React.FC<{
  stationData?: AdminMetricsResponse['metrics']['stations'];
  isLoading?: boolean;
}> = ({ stationData, isLoading }) => {
  const activeCount = stationData?.active ?? 2;
  const totalCount = stationData?.total ?? 2;
  const errorsCount = stationData?.errors ?? 0;
  const healthRate = stationData?.healthRate ?? '100.0';

  return (
    <div
      className={[
        "col-span-12",
        "border",
        "mt-4",
        luxe.borderSoft,
        luxe.radiusXL,
        "px-4 py-3 md:px-6 md:py-4",
        "bg-gradient-to-r from-slate-50 via-white to-slate-50",
        "flex flex-col md:flex-row md:items-center md:justify-between gap-3",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div
          className={[
            "h-9 w-9 rounded-2xl",
            "bg-gradient-to-br from-emerald-500 via-emerald-400 to-emerald-500",
            "text-white flex items-center justify-center text-lg shadow-lg",
          ].join(" ")}
        >
          🚿
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-900">
            K9000 and Smart Hub Status {isLoading && <span className="text-xs text-slate-400 ml-2">⟳</span>}
          </span>
          <span className="text-xs text-slate-500">
            Live bays, water temperature, payment health and QR terminals.
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${activeCount === totalCount ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className="text-slate-700">
            Bays online: <b>{activeCount} / {totalCount}</b>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${errorsCount === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <span className="text-slate-700">
            QR terminals: <b>{errorsCount === 0 ? 'OK' : `${errorsCount} errors`}</b>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-700">
            Health rate: <b>{healthRate}%</b>
          </span>
        </div>
      </div>
    </div>
  );
};

/* -----------------------------------------------------------
   12. MAIN OCTOPUS CONTROL PANEL WRAPPER
   ----------------------------------------------------------- */

export const PetWashOctopusControlPanel: React.FC = () => {
  const [selectedPlatformId, setSelectedPlatformId] =
    useState<PetWashPlatformId>("pet_sitter");
  
  // Fetch real-time admin metrics from API
  const { data: metricsData, isLoading: metricsLoading } = useAdminMetrics();
  
  // Derive loyalty data from API or fallback to mock
  const loyaltyData: LoyaltySnapshot = useMemo(() => {
    if (metricsData?.success && metricsData.metrics?.loyalty) {
      const l = metricsData.metrics.loyalty;
      return {
        activeMembers: l.totalMembers,
        pointsIssued: MOCK_LOYALTY.pointsIssued, // Keep mock for now
        pointsRedeemed: MOCK_LOYALTY.pointsRedeemed,
        avgPointsPerUser: MOCK_LOYALTY.avgPointsPerUser,
      };
    }
    return MOCK_LOYALTY;
  }, [metricsData]);

  return (
    <div
      className={[
        luxe.bgPure,
        luxe.fontSans,
        "min-h-screen",
        "text-slate-900",
        "px-3 md:px-6 lg:px-10 py-4 md:py-6",
        "bg-gradient-to-b from-slate-50 via-white to-slate-100/50",
      ].join(" ")}
    >
      {/* Top bar - HQ header */}
      <header className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div
            className={[
              "h-9 w-9 rounded-2xl",
              "bg-gradient-to-br from-slate-900 via-black to-slate-800",
              "text-white flex items-center justify-center text-sm font-semibold tracking-tight",
              "shadow-[0_10px_30px_rgba(15,23,42,0.55)]",
            ].join(" ")}
          >
            PW
          </div>
          <div className="flex flex-col">
            <h1 className="text-base md:text-lg font-semibold tracking-tight text-slate-900">
              PetWash HQ - Octopus Control Panel
            </h1>
            <p className="text-[11px] md:text-xs text-slate-500">
              Mother company view for all platforms, bookings, loyalty,
              K9000 and smart hub - pure white luxury mode.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <LuxeButton variant="pill" size="sm">
            Global status: <span className={luxe.emeraldAccent}>{metricsLoading ? '...' : 'Stable'}</span>
          </LuxeButton>
          <LuxeButton size="sm">New manual booking</LuxeButton>
        </div>
      </header>

      {/* Main grid */}
      <main className="grid grid-cols-12 gap-5">
        <PlatformGrid
          platforms={PLATFORMS}
          selectedId={selectedPlatformId}
          onSelect={setSelectedPlatformId}
        />
        <BookingShell
          bookings={MOCK_BOOKINGS}
          selectedPlatformId={selectedPlatformId}
        />
        <TalentPanel talent={MOCK_TALENT} />
        <LoyaltyAndInvoicesPanel
          loyalty={loyaltyData}
          invoices={MOCK_INVOICES}
        />
        <K9000StatusStripWithData 
          stationData={metricsData?.metrics?.stations}
          isLoading={metricsLoading}
        />
      </main>
    </div>
  );
};

export default PetWashOctopusControlPanel;

/**
 * HOW TO USE - DEV TEAM NOTES
 *
 * 1. Place this file at:
 *    src/modules/octopus/PetWashOctopusControlPanel.tsx
 *
 * 2. Wire into routing:
 *    - For example in React Router or Next:
 *      <Route path="/hq" element={<PetWashOctopusControlPanel />} />
 *
 * 3. Replace dummy data with real API calls:
 *    - Use React Query or your internal data hooks.
 *    - Replace MOCK_BOOKINGS, MOCK_TALENT, MOCK_LOYALTY, MOCK_INVOICES
 *      with calls to:
 *        - /api/admin/bookings
 *        - /api/admin/talent
 *        - /api/admin/loyalty
 *        - /api/admin/invoices
 *
 * 4. Keep the visual rules:
 *    - Pure white background
 *    - Metallic gradients only as accents
 *    - Rounded corners only as in this file
 *    - Buttons are always pill or full round, never square
 *    - No heavy borders or dark boxes
 *
 * 5. Extend:
 *    - Add sub pages:
 *      - /hq/platforms/:id
 *      - /hq/talent/:id
 *      - /hq/invoices/:id
 *      - /hq/k9000
 *    - Use the same CardShell and LuxeButton for full brand consistency.
 */