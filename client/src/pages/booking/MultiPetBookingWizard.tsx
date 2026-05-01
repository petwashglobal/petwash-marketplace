/**
 * MultiPetBookingWizard
 * 5-step booking wizard for the PetWash marketplace.
 * Steps: schedule → pets → care → addons → confirm
 *
 * RULES:
 * - Frontend NEVER calculates totals — only renders /api/quotes/preview response
 * - Quote is debounced 600 ms after any meaningful state change
 * - On confirm, final quote is passed to POST /api/booking-requests as `finalQuote`
 */

import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight, ChevronLeft, Plus, Check, Loader2,
  Calendar, Pill, AlertTriangle,
  Star, Info, Shield, RefreshCw, Sparkles, PawPrint, StickyNote, Coins
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { InsuranceTrustChip } from "@/components/marketplace/InsuranceTrustChip";

// ── Types ────────────────────────────────────────────────────────────────────

type WizardStep = "schedule" | "pets" | "care" | "addons" | "confirm";

type PetType = "dog" | "cat" | "other";
type SizeCategory = "small" | "medium" | "large" | "giant";

interface UserPet {
  id: number;
  name: string;
  species: string; // dog | cat | rabbit | ...
  breed?: string;
  ageYears?: number;
  weightKg?: number;
  gender?: string;
  photoUrl?: string;
}

interface PetCareInfo {
  petId: number;
  clientRef: string;       // positional "0", "1", "2"
  petName: string;
  petType: PetType;
  breed?: string;
  sizeCategory: SizeCategory;
  ageYears?: number;
  weightKg?: number;
  gender?: string;
  requiresMedication: boolean;
  hasBehaviorFlag: boolean;
  hasSpecialNeeds: boolean;
  specialNotes: string;
  // service-specific
  coatType?: string;
  lastGroomedDate?: string;
  leashTrained?: boolean;
  dogParkOk?: boolean;
  feedingInstructions?: string;
  currentSkills?: string;
  trainingGoals?: string;
}

interface SelectedAddon {
  addonCode: string;
  addonName: string;
  scope: "booking" | "pet";
  petRef?: string;
  quantity: number;
  unitPriceCents: number;
}

interface AddonCatalogEntry {
  code: string;
  name: string;
  nameHe: string;
  scope: "booking" | "pet";
  unitPriceCents: number;
  icon?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STEPS: WizardStep[] = ["schedule", "pets", "care", "addons", "confirm"];
const STEP_LABELS: Record<WizardStep, string> = {
  schedule: "תאריך",
  pets: "חיות",
  care: "טיפול",
  addons: "תוספות",
  confirm: "אישור",
};

const SIZE_OPTIONS: { value: SizeCategory; label: string; sub: string }[] = [
  { value: "small", label: "קטן", sub: "עד 7 ק\"ג" },
  { value: "medium", label: "בינוני", sub: "7–20 ק\"ג" },
  { value: "large", label: "גדול", sub: "20–40 ק\"ג" },
  { value: "giant", label: "ענק", sub: "40+ ק\"ג" },
];

const COAT_TYPES = [
  { value: "short", label: "קצר" },
  { value: "medium", label: "בינוני" },
  { value: "long", label: "ארוך" },
  { value: "double", label: "כפול" },
  { value: "curly", label: "מתולתל" },
  { value: "wire", label: "גס/וירי" },
];

const ADDON_CATALOG: Record<string, AddonCatalogEntry[]> = {
  grooming: [
    { code: "nail_clip", name: "Nail Trim", nameHe: "גזיזת ציפורניים", scope: "pet", unitPriceCents: 3000, icon: "✂️" },
    { code: "ear_clean", name: "Ear Cleaning", nameHe: "ניקוי אוזניים", scope: "pet", unitPriceCents: 2000, icon: "👂" },
    { code: "deshed", name: "De-shedding Treatment", nameHe: "טיפול דה-שדינג", scope: "pet", unitPriceCents: 5000, icon: "🪮" },
    { code: "teeth_brush", name: "Teeth Brushing", nameHe: "צחצוח שיניים", scope: "pet", unitPriceCents: 2500, icon: "🦷" },
    { code: "bandana", name: "Bandana / Bow", nameHe: "בנדנה / קשת", scope: "pet", unitPriceCents: 1000, icon: "🎀" },
    { code: "blueberry_facial", name: "Blueberry Facial", nameHe: "פנים אוכמניות", scope: "pet", unitPriceCents: 2000, icon: "💙" },
  ],
  dog_walking: [
    { code: "extra_30min", name: "Extra 30 Minutes", nameHe: "30 דק׳ נוספות", scope: "booking", unitPriceCents: 3000, icon: "⏱️" },
    { code: "dog_park", name: "Dog Park Visit", nameHe: "ביקור בפארק כלבים", scope: "booking", unitPriceCents: 1500, icon: "🌳" },
    { code: "photo_report", name: "Photo Report", nameHe: "דוח תמונות", scope: "booking", unitPriceCents: 500, icon: "📸" },
    { code: "treat_pack", name: "Treat Pack", nameHe: "חבילת פינוקים", scope: "pet", unitPriceCents: 1200, icon: "🦴" },
  ],
  pet_sitting: [
    { code: "medication_admin", name: "Medication Administration", nameHe: "מתן תרופות", scope: "pet", unitPriceCents: 2000, icon: "💊" },
    { code: "daily_photos", name: "Daily Photo Updates", nameHe: "עדכוני תמונות יומיים", scope: "booking", unitPriceCents: 1000, icon: "📷" },
    { code: "grooming_light", name: "Light Grooming", nameHe: "טיפוח קל", scope: "pet", unitPriceCents: 3000, icon: "🪮" },
    { code: "vet_pickup", name: "Vet Pickup/Drop-off", nameHe: "איסוף/הורדה לוטרינר", scope: "booking", unitPriceCents: 5000, icon: "🏥" },
  ],
  house_sitting: [
    { code: "medication_admin", name: "Medication Administration", nameHe: "מתן תרופות", scope: "pet", unitPriceCents: 2000, icon: "💊" },
    { code: "daily_photos", name: "Daily Photo Updates", nameHe: "עדכוני תמונות יומיים", scope: "booking", unitPriceCents: 1000, icon: "📷" },
    { code: "mail_handling", name: "Mail Collection", nameHe: "איסוף דואר", scope: "booking", unitPriceCents: 500, icon: "📬" },
    { code: "plant_watering", name: "Plant Watering", nameHe: "השקיית צמחים", scope: "booking", unitPriceCents: 500, icon: "🪴" },
  ],
  training: [
    { code: "training_report", name: "Training Report", nameHe: "דוח אימון", scope: "booking", unitPriceCents: 1500, icon: "📋" },
    { code: "training_kit", name: "Training Kit", nameHe: "ערכת אימון", scope: "booking", unitPriceCents: 3000, icon: "🎒" },
    { code: "video_recap", name: "Video Recap", nameHe: "סיכום וידאו", scope: "booking", unitPriceCents: 2000, icon: "🎥" },
  ],
  daycare: [
    { code: "daily_photos", name: "Daily Photo Updates", nameHe: "עדכוני תמונות יומיים", scope: "booking", unitPriceCents: 1000, icon: "📷" },
    { code: "special_meal", name: "Special Meal Prep", nameHe: "הכנת ארוחה מיוחדת", scope: "pet", unitPriceCents: 2000, icon: "🥣" },
  ],
  default: [
    { code: "daily_photos", name: "Daily Photo Updates", nameHe: "עדכוני תמונות יומיים", scope: "booking", unitPriceCents: 1000, icon: "📷" },
    { code: "extra_care", name: "Extra Attention", nameHe: "תשומת לב נוספת", scope: "pet", unitPriceCents: 2500, icon: "❤️" },
  ],
};

const CARE_FIELDS_BY_SERVICE: Record<string, string[]> = {
  pet_sitting:   ["size", "medication", "behavior", "special_needs", "feeding_instructions", "notes"],
  house_sitting: ["size", "medication", "behavior", "special_needs", "feeding_instructions", "notes"],
  dog_walking:   ["size", "behavior", "leash_trained", "dog_park", "notes"],
  grooming:      ["size", "coat_type", "last_groomed", "medication", "special_needs", "notes"],
  training:      ["size", "behavior", "current_skills", "training_goals", "notes"],
  daycare:       ["size", "medication", "behavior", "feeding_instructions", "notes"],
  pet_taxi:      ["size", "notes"],
  k9000_wash:    ["size", "notes"],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function petEmoji(species: string): string {
  if (species === "dog") return "🐕";
  if (species === "cat") return "🐈";
  if (species === "rabbit") return "🐇";
  if (species === "bird") return "🐦";
  return "🐾";
}

function speciesToPetType(species: string): PetType {
  if (species === "dog") return "dog";
  if (species === "cat") return "cat";
  return "other";
}

function formatILS(cents: number): string {
  return `₪${(cents / 100).toFixed(0)}`;
}


function providerTypeToType(serviceType: string): string {
  if (["pet_sitting", "house_sitting", "daycare"].includes(serviceType)) return "sitter";
  if (serviceType === "dog_walking") return "walker";
  if (serviceType === "grooming") return "groomer";
  if (serviceType === "training") return "trainer";
  if (serviceType === "k9000_wash") return "k9000";
  return "sitter";
}

function serviceTypeToPlatform(serviceType: string): string {
  const map: Record<string, string> = {
    pet_sitting: "sitter_suite",
    house_sitting: "sitter_suite",
    daycare: "sitter_suite",
    dog_walking: "walk_my_pet",
    grooming: "groomers",
    training: "academy",
    pet_taxi: "pettrek",
    k9000_wash: "k9000",
  };
  return map[serviceType] || "sitter_suite";
}

function serviceTypeLabel(serviceType: string): string {
  const map: Record<string, string> = {
    pet_sitting: "שמרטפות לחיות",
    house_sitting: "שמירת בית",
    daycare: "פנסיון יומי",
    dog_walking: "הליכת כלבים",
    grooming: "טיפוח",
    training: "אילוף",
    pet_taxi: "מונית לחיות",
    k9000_wash: "רחצה עצמאית",
  };
  return map[serviceType] || serviceType;
}

// ── useQuotePreview hook ─────────────────────────────────────────────────────

interface QuoteState {
  loading: boolean;
  data: any | null;
  error: string | null;
}

function useQuotePreview(
  enabled: boolean,
  payload: object,
  deps: any[]
): QuoteState {
  const [state, setState] = useState<QuoteState>({ loading: false, data: null, error: null });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!enabled) return;
    setState(s => ({ ...s, loading: true, error: null }));

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await apiRequest("POST", "/api/quotes/preview", payload);
        const json = await res.json();
        if (!mountedRef.current) return;
        if (json.success) {
          setState({ loading: false, data: json, error: null });
        } else {
          setState({ loading: false, data: null, error: json.error || "Quote failed" });
        }
      } catch (e: any) {
        if (!mountedRef.current) return;
        setState({ loading: false, data: null, error: "Network error" });
      }
    }, 600);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

// ── ProgressBar ──────────────────────────────────────────────────────────────

function ProgressBar({ currentStep }: { currentStep: WizardStep }) {
  const idx = STEPS.indexOf(currentStep);
  return (
    <div className="px-4 py-3 border-b border-gray-100">
      {/* Step line */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                  i < idx
                    ? "bg-[#C5A55A] text-white shadow-sm"
                    : i === idx
                    ? "bg-[#C5A55A] text-white ring-4 ring-[#C5A55A]/20 shadow-md"
                    : "bg-white text-gray-400"
                }`}
              >
                {i < idx ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-[9px] mt-1 font-medium whitespace-nowrap ${
                i === idx ? "text-[#C5A55A]" : i < idx ? "text-[#C5A55A]/60" : "text-gray-300"
              }`}>
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 rounded-full transition-all duration-300 ${i < idx ? "bg-[#C5A55A]" : "bg-white"}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── RebookBanner ─────────────────────────────────────────────────────────────

interface RebookBannerProps {
  warnings: string[];
  petCount: number;
  addonCount: number;
  hasNotes: boolean;
}

function RebookBanner({ warnings, petCount, addonCount, hasNotes }: RebookBannerProps) {
  const hasPrefill = petCount > 0 || addonCount > 0 || hasNotes;
  return (
    <div className="mx-4 mt-3 rounded-2xl overflow-hidden border border-[#C5A55A]/25 shadow-sm">

      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-l from-[#C5A55A]/8 to-[#FAF6EE] px-4 py-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[#C5A55A]/15 border border-[#C5A55A]/20 flex items-center justify-center shrink-0 mt-0.5">
          <RefreshCw className="w-3.5 h-3.5 text-[#C5A55A]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-[#7A5C1E] tracking-wide">הזמנה חוזרת</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#C5A55A]/15 text-[#8B6914] border border-[#C5A55A]/25">
              על בסיס הזמנה קודמת
            </span>
          </div>

          {/* Prefill summary chips */}
          {hasPrefill && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {petCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#6B4E1A] bg-[#C5A55A]/12 px-2 py-0.5 rounded-full border border-[#C5A55A]/20">
                  <PawPrint className="w-2.5 h-2.5" />
                  {petCount === 1 ? 'חיית מחמד אחת הועברה' : `${petCount} חיות מחמד הועברו`}
                </span>
              )}
              {addonCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#6B4E1A] bg-[#C5A55A]/12 px-2 py-0.5 rounded-full border border-[#C5A55A]/20">
                  <Check className="w-2.5 h-2.5" />
                  {addonCount === 1 ? 'תוספת אחת הועברה' : `${addonCount} תוספות הועברו`}
                </span>
              )}
              {hasNotes && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#6B4E1A] bg-[#C5A55A]/12 px-2 py-0.5 rounded-full border border-[#C5A55A]/20">
                  <StickyNote className="w-2.5 h-2.5" />
                  הערות הועברו
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Price recalculation notice ─────────────────────────────────── */}
      <div className="px-4 py-2.5 flex items-start gap-2 bg-sky-50/70 border-t border-sky-100/80">
        <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-sky-700 leading-relaxed">
          <span className="font-semibold">המחיר מחושב מחדש</span> — התעריף מגיע ממנוע המחיר הנוכחי.
          ייתכן שישתנה מההזמנה הקודמת. בחר תאריך להצגת מחיר מעודכן.
        </p>
      </div>

      {/* ── Warnings ──────────────────────────────────────────────────── */}
      {warnings.length > 0 && (
        <div className="border-t border-amber-100 divide-y divide-amber-50/80">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 px-4 py-2.5 bg-amber-50/80">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 font-medium leading-relaxed">{w}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── QuoteMiniBar ─────────────────────────────────────────────────────────────

function QuoteMiniBar({ quote, loading }: { quote: any | null; loading: boolean }) {
  if (!quote && !loading) return null;
  return (
    <div className="bg-[#C5A55A]/10 border-t border-[#C5A55A]/20 px-4 py-2 flex items-center justify-between">
      <span className="text-xs text-[#C5A55A] font-medium">סה"כ משוער</span>
      {loading ? (
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> מחשב...
        </span>
      ) : quote ? (
        <span className="text-sm font-bold text-[#C5A55A]">{formatILS(quote.totals.totalCents)}</span>
      ) : null}
    </div>
  );
}

// ── ScheduleStep ─────────────────────────────────────────────────────────────

function ScheduleStep({
  serviceType,
  provider,
  startDate, setStartDate,
  endDate, setEndDate,
  startTime, setStartTime,
  endTime, setEndTime,
}: {
  serviceType: string;
  provider: any;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  startTime: string; setStartTime: (v: string) => void;
  endTime: string; setEndTime: (v: string) => void;
}) {
  const isMultiDay = ["pet_sitting", "house_sitting", "daycare"].includes(serviceType);
  const isHourly = ["dog_walking", "training", "pet_taxi"].includes(serviceType);

  return (
    <div className="p-4 space-y-5">
      {/* Provider card */}
      <div className="flex items-center gap-3 p-3 bg-white rounded-xl">
        {provider?.photoUrl ? (
          <img src={provider.photoUrl} alt={provider.name} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#C5A55A]/20 flex items-center justify-center text-xl">🐾</div>
        )}
        <div>
          <p className="font-semibold text-gray-900">{provider?.name || "בוחר..."}</p>
          <p className="text-xs text-gray-500">{provider?.serviceLabel || serviceTypeLabel(serviceType)}</p>
        </div>
        {provider?.rating && (
          <div className="mr-auto flex items-center gap-1 text-sm text-[#C5A55A] font-semibold">
            <Star className="w-3.5 h-3.5 fill-[#C5A55A]" /> {provider.rating}
          </div>
        )}
      </div>

      {/* Date picker */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800">
          {isMultiDay ? "תאריכי שהות" : isHourly ? "תאריך ושעה" : "תאריך שירות"}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">
              {isMultiDay ? "כניסה" : "תאריך"}
            </Label>
            <input
              type="date"
              value={startDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={e => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A55A]/30"
            />
          </div>
          {isMultiDay && (
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">יציאה</Label>
              <input
                type="date"
                value={endDate}
                min={startDate || new Date().toISOString().split("T")[0]}
                onChange={e => setEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A55A]/30"
              />
            </div>
          )}
          {!isMultiDay && (
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">שעת התחלה</Label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A55A]/30"
              />
            </div>
          )}
        </div>
        {isHourly && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">שעת סיום</Label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A55A]/30"
              />
            </div>
          </div>
        )}
        {isMultiDay && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">שעת כניסה</Label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A55A]/30" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">שעת יציאה</Label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A55A]/30" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PetsStep ─────────────────────────────────────────────────────────────────

function PetsStep({
  pets,
  petsLoading,
  selectedPetIds,
  onTogglePet,
}: {
  pets: UserPet[];
  petsLoading: boolean;
  selectedPetIds: number[];
  onTogglePet: (id: number) => void;
}) {
  const [, setLocation] = useLocation();

  if (petsLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#C5A55A]" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800">בחר חיות מחמד</h3>
        <p className="text-xs text-gray-500 mt-0.5">ניתן לבחור יותר מחיה אחת</p>
      </div>

      {pets.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <div className="text-4xl">🐾</div>
          <p className="text-sm text-gray-500">אין חיות מחמד רשומות</p>
          <Button variant="outline" size="sm" onClick={() => setLocation("/pets")} className="border-[#C5A55A] text-[#C5A55A]">
            <Plus className="w-3.5 h-3.5 mr-1" /> הוסף חיית מחמד
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {pets.map(pet => {
            const selected = selectedPetIds.includes(pet.id);
            return (
              <button
                key={pet.id}
                onClick={() => onTogglePet(pet.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-right ${
                  selected
                    ? "border-[#C5A55A] bg-[#C5A55A]/5"
                    : "border-gray-100 bg-white hover:border-gray-200"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${selected ? "bg-[#C5A55A]/20" : "bg-white"}`}>
                  {pet.photoUrl
                    ? <img src={pet.photoUrl} alt={pet.name} className="w-10 h-10 rounded-full object-cover" />
                    : petEmoji(pet.species)
                  }
                </div>
                <div className="flex-1 text-right">
                  <p className="font-semibold text-sm text-gray-900">{pet.name}</p>
                  <p className="text-xs text-gray-500">{pet.breed || pet.species}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selected ? "bg-[#C5A55A] border-[#C5A55A]" : "border-gray-300"
                }`}>
                  {selected && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            );
          })}

          <button
            onClick={() => setLocation("/pets?return=/booking")}
            className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-[#C5A55A]/40 hover:text-[#C5A55A] transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-sm">הוסף חיית מחמד חדשה</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── CareStep ─────────────────────────────────────────────────────────────────

function CareStep({
  petCares,
  onUpdateCare,
  serviceType,
}: {
  petCares: PetCareInfo[];
  onUpdateCare: (clientRef: string, updates: Partial<PetCareInfo>) => void;
  serviceType: string;
}) {
  const fields = CARE_FIELDS_BY_SERVICE[serviceType] || CARE_FIELDS_BY_SERVICE.pet_sitting;
  const [activeTab, setActiveTab] = useState(petCares[0]?.clientRef || "0");

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800">פרטי טיפול</h3>
        <p className="text-xs text-gray-500 mt-0.5">מלא פרטים לכל חיית מחמד בנפרד</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full bg-white rounded-xl p-1">
          {petCares.map(pc => (
            <TabsTrigger
              key={pc.clientRef}
              value={pc.clientRef}
              className="flex-1 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
            >
              <span className="mr-1">{petEmoji(pc.petType)}</span>
              {pc.petName.split(" ")[0]}
            </TabsTrigger>
          ))}
        </TabsList>

        {petCares.map(pc => (
          <TabsContent key={pc.clientRef} value={pc.clientRef} className="space-y-4 mt-3">
            <PetCareForm
              care={pc}
              fields={fields}
              onChange={updates => onUpdateCare(pc.clientRef, updates)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PetCareForm({
  care,
  fields,
  onChange,
}: {
  care: PetCareInfo;
  fields: string[];
  onChange: (updates: Partial<PetCareInfo>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Size */}
      {fields.includes("size") && (
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-2 block">גודל</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {SIZE_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={() => onChange({ sizeCategory: s.value })}
                className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all text-center ${
                  care.sizeCategory === s.value
                    ? "border-[#C5A55A] bg-[#C5A55A]/5"
                    : "border-gray-100 hover:border-gray-200"
                }`}
              >
                <span className="text-xs font-semibold text-gray-800">{s.label}</span>
                <span className="text-[10px] text-gray-400 mt-0.5">{s.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Coat type */}
      {fields.includes("coat_type") && (
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1 block">סוג פרווה</Label>
          <Select value={care.coatType || ""} onValueChange={v => onChange({ coatType: v })}>
            <SelectTrigger className="border-gray-200 focus:ring-[#C5A55A]/30">
              <SelectValue placeholder="בחר סוג פרווה..." />
            </SelectTrigger>
            <SelectContent>
              {COAT_TYPES.map(ct => (
                <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Last groomed date */}
      {fields.includes("last_groomed") && (
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1 block">תאריך טיפוח אחרון</Label>
          <input
            type="date"
            value={care.lastGroomedDate || ""}
            onChange={e => onChange({ lastGroomedDate: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A55A]/30"
          />
        </div>
      )}

      {/* Boolean flags */}
      {fields.includes("medication") && (
        <div className="flex items-center justify-between p-3 bg-white rounded-xl">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-gray-800">זקוק לתרופות</p>
              <p className="text-xs text-gray-500">יש לציין פרטים בהערות</p>
            </div>
          </div>
          <Switch
            checked={care.requiresMedication}
            onCheckedChange={v => onChange({ requiresMedication: v })}
            className="data-[state=checked]:bg-[#C5A55A]"
          />
        </div>
      )}

      {fields.includes("behavior") && (
        <div className="flex items-center justify-between p-3 bg-white rounded-xl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-gray-800">דגל התנהגותי</p>
              <p className="text-xs text-gray-500">אגרסיביות, פחדנות וכו׳</p>
            </div>
          </div>
          <Switch
            checked={care.hasBehaviorFlag}
            onCheckedChange={v => onChange({ hasBehaviorFlag: v })}
            className="data-[state=checked]:bg-[#C5A55A]"
          />
        </div>
      )}

      {fields.includes("special_needs") && (
        <div className="flex items-center justify-between p-3 bg-white rounded-xl">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-500" />
            <div>
              <p className="text-sm font-medium text-gray-800">צרכים מיוחדים</p>
              <p className="text-xs text-gray-500">נכות, קשיש, ריפוי וכו׳</p>
            </div>
          </div>
          <Switch
            checked={care.hasSpecialNeeds}
            onCheckedChange={v => onChange({ hasSpecialNeeds: v })}
            className="data-[state=checked]:bg-[#C5A55A]"
          />
        </div>
      )}

      {fields.includes("leash_trained") && (
        <div className="flex items-center justify-between p-3 bg-white rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-base">🐕</span>
            <p className="text-sm font-medium text-gray-800">מאולף לרצועה</p>
          </div>
          <Switch
            checked={!!care.leashTrained}
            onCheckedChange={v => onChange({ leashTrained: v })}
            className="data-[state=checked]:bg-[#C5A55A]"
          />
        </div>
      )}

      {fields.includes("dog_park") && (
        <div className="flex items-center justify-between p-3 bg-white rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-base">🌳</span>
            <p className="text-sm font-medium text-gray-800">מתאים לפארק כלבים</p>
          </div>
          <Switch
            checked={!!care.dogParkOk}
            onCheckedChange={v => onChange({ dogParkOk: v })}
            className="data-[state=checked]:bg-[#C5A55A]"
          />
        </div>
      )}

      {/* Text fields */}
      {fields.includes("feeding_instructions") && (
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1 block">הוראות האכלה</Label>
          <Textarea
            placeholder="כמויות, תדירות, אלרגיות למזון..."
            value={care.feedingInstructions || ""}
            onChange={e => onChange({ feedingInstructions: e.target.value })}
            className="text-sm border-gray-200 focus:ring-[#C5A55A]/30 resize-none"
            rows={2}
          />
        </div>
      )}

      {fields.includes("current_skills") && (
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1 block">כישורים נוכחיים</Label>
          <Textarea
            placeholder="ישיבה, עמידה, הליכה..."
            value={care.currentSkills || ""}
            onChange={e => onChange({ currentSkills: e.target.value })}
            className="text-sm border-gray-200 focus:ring-[#C5A55A]/30 resize-none"
            rows={2}
          />
        </div>
      )}

      {fields.includes("training_goals") && (
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1 block">מטרות אימון</Label>
          <Textarea
            placeholder="מה תרצה להשיג בסשן הזה?"
            value={care.trainingGoals || ""}
            onChange={e => onChange({ trainingGoals: e.target.value })}
            className="text-sm border-gray-200 focus:ring-[#C5A55A]/30 resize-none"
            rows={2}
          />
        </div>
      )}

      {fields.includes("notes") && (
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1 block">הערות נוספות</Label>
          <Textarea
            placeholder="כל מה שהמטפל צריך לדעת..."
            value={care.specialNotes || ""}
            onChange={e => onChange({ specialNotes: e.target.value })}
            className="text-sm border-gray-200 focus:ring-[#C5A55A]/30 resize-none"
            rows={3}
          />
        </div>
      )}
    </div>
  );
}

// ── AddonsStep ───────────────────────────────────────────────────────────────

function AddonsStep({
  serviceType,
  petCares,
  selectedAddons,
  onToggleAddon,
}: {
  serviceType: string;
  petCares: PetCareInfo[];
  selectedAddons: SelectedAddon[];
  onToggleAddon: (addon: AddonCatalogEntry, petRef?: string) => void;
}) {
  const catalog = ADDON_CATALOG[serviceType] || ADDON_CATALOG.default;
  const bookingAddons = catalog.filter(a => a.scope === "booking");
  const petAddons = catalog.filter(a => a.scope === "pet");

  function isSelected(code: string, petRef?: string): boolean {
    return selectedAddons.some(a => a.addonCode === code && a.petRef === petRef);
  }

  return (
    <div className="p-4 space-y-5">
      <div>
        <h3 className="font-semibold text-gray-800">תוספות ושירותים נוספים</h3>
        <p className="text-xs text-gray-500 mt-0.5">אופציונלי — ניתן לדלג</p>
      </div>

      {/* Booking-level addons — apply once for the whole booking */}
      {bookingAddons.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#C5A55A]" />
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">🔖 לכל ההזמנה</p>
            <span className="text-[10px] text-gray-400 bg-white px-2 py-0.5 rounded-full">חיוב אחד</span>
          </div>
          {bookingAddons.map(addon => {
            const selected = isSelected(addon.code);
            return (
              <button
                key={addon.code}
                onClick={() => onToggleAddon(addon)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-right ${
                  selected ? "border-[#C5A55A] bg-[#C5A55A]/5 shadow-sm" : "border-gray-100 bg-white hover:border-[#C5A55A]/30"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${selected ? "bg-[#C5A55A]/20" : "bg-white"}`}>
                  {addon.icon}
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm font-semibold text-gray-800">{addon.nameHe}</p>
                  <p className="text-xs text-gray-400">חיוב אחד · כל הזמן ההזמנה</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-bold text-[#C5A55A]">{formatILS(addon.unitPriceCents)}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? "bg-[#C5A55A] border-[#C5A55A]" : "border-gray-200"}`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Per-pet addons — priced per pet selected */}
      {petAddons.length > 0 && petCares.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">🐾 לפי חיית מחמד</p>
            <span className="text-[10px] text-gray-400 bg-white px-2 py-0.5 rounded-full">חיוב לכל חיה</span>
          </div>
          {petCares.map(pc => (
            <div key={pc.clientRef} className="space-y-2">
              {/* Pet header */}
              <div className="flex items-center gap-2 px-1 py-1">
                <span className="text-base">{petEmoji(pc.petType)}</span>
                <span className="text-sm font-semibold text-gray-700">{pc.petName}</span>
                <div className="flex-1 h-px bg-white" />
              </div>
              {petAddons.map(addon => {
                const selected = isSelected(addon.code, pc.clientRef);
                return (
                  <button
                    key={`${addon.code}-${pc.clientRef}`}
                    onClick={() => onToggleAddon(addon, pc.clientRef)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-right mr-3 ${
                      selected ? "border-blue-300 bg-blue-50/50 shadow-sm" : "border-gray-100 bg-white hover:border-blue-200"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${selected ? "bg-blue-100" : "bg-white"}`}>
                      {addon.icon}
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-sm font-medium text-gray-800">{addon.nameHe}</p>
                      <p className="text-xs text-gray-400">עבור {pc.petName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-bold text-gray-700">{formatILS(addon.unitPriceCents)}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? "bg-blue-500 border-blue-500" : "border-gray-200"}`}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {bookingAddons.length === 0 && petAddons.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <div className="text-3xl mb-2">✨</div>
          <p className="text-sm">אין תוספות זמינות לשירות זה</p>
        </div>
      )}
    </div>
  );
}

// ── ConfirmStep (Quote + Submit) ─────────────────────────────────────────────

function QuoteSkeleton() {
  return (
    <div className="animate-pulse space-y-2 p-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex justify-between">
          <div className="h-3 bg-white rounded w-32" />
          <div className="h-3 bg-white rounded w-12" />
        </div>
      ))}
      <div className="border-t border-gray-100 pt-3 mt-2">
        <div className="flex justify-between">
          <div className="h-4 bg-white rounded w-20" />
          <div className="h-5 bg-[#C5A55A]/10 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

function ConfirmStep({
  quote,
  quoteLoading,
  quoteError,
  petCares,
  selectedAddons,
  startDate,
  endDate,
  startTime,
  endTime,
  serviceType,
  message, setMessage,
  promoCode, setPromoCode,
  onApplyPromo,
  provider,
  onSubmit,
  isSubmitting,
  applyLoyaltyCredits, setApplyLoyaltyCredits,
  loyaltyAvailableCents,
  loyaltyMaxOnBookingCents,
  loyaltyToggleEnabled,
}: {
  quote: any | null;
  quoteLoading: boolean;
  quoteError: string | null;
  petCares: PetCareInfo[];
  selectedAddons: SelectedAddon[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  serviceType: string;
  message: string; setMessage: (v: string) => void;
  promoCode: string; setPromoCode: (v: string) => void;
  onApplyPromo: () => void;
  provider: any;
  onSubmit: () => void;
  isSubmitting: boolean;
  applyLoyaltyCredits: boolean;
  setApplyLoyaltyCredits: (v: boolean) => void;
  loyaltyAvailableCents: number;
  loyaltyMaxOnBookingCents: number;
  loyaltyToggleEnabled: boolean;
}) {
  const isMultiDay = ["pet_sitting", "house_sitting", "daycare"].includes(serviceType);
  const staleMs = quote?.quotedAt ? Date.now() - new Date(quote.quotedAt).getTime() : 0;
  const isStale = staleMs > 5 * 60 * 1000;

  return (
    <div className="divide-y divide-gray-100">

      {/* ── Provider block ─────────────────────────────────────────────── */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">נותן שירות</p>
        <div className="flex items-center gap-3">
          {provider?.photoUrl ? (
            <img src={provider.photoUrl} alt={provider.name} className="w-11 h-11 rounded-full object-cover border border-gray-100" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[#C5A55A]/15 flex items-center justify-center text-xl">🐾</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{provider?.name || "—"}</p>
            <p className="text-xs text-gray-500">{serviceTypeLabel(serviceType)}</p>
          </div>
          {provider?.rating && (
            <div className="flex items-center gap-1 text-xs font-semibold text-[#C5A55A]">
              <Star className="w-3 h-3 fill-[#C5A55A]" /> {provider.rating}
            </div>
          )}
        </div>
      </div>

      {/* ── Schedule block ─────────────────────────────────────────────── */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">לוח זמנים</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">{isMultiDay ? "כניסה" : "תאריך"}</p>
            <p className="text-sm font-semibold text-gray-800">{startDate}</p>
            <p className="text-xs text-gray-500">{startTime}</p>
          </div>
          {isMultiDay ? (
            <div className="bg-white rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">יציאה</p>
              <p className="text-sm font-semibold text-gray-800">{endDate}</p>
              <p className="text-xs text-gray-500">{endTime}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">שעת סיום</p>
              <p className="text-sm font-semibold text-gray-800">{endTime}</p>
              <p className="text-xs text-gray-500">{quote?.durationLabel || ""}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Pets block ─────────────────────────────────────────────────── */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          חיות מחמד ({petCares.length})
        </p>
        <div className="space-y-2">
          {petCares.map(pc => (
            <div key={pc.clientRef} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5">
              <span className="text-lg">{petEmoji(pc.petType)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{pc.petName}</p>
                <p className="text-xs text-gray-400">{pc.sizeCategory} · {pc.petType}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {pc.requiresMedication && (
                  <span className="flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                    <Pill className="w-2.5 h-2.5" /> תרופות
                  </span>
                )}
                {pc.hasBehaviorFlag && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                    <AlertTriangle className="w-2.5 h-2.5" /> התנהגות
                  </span>
                )}
                {pc.hasSpecialNeeds && (
                  <span className="flex items-center gap-0.5 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                    <Info className="w-2.5 h-2.5" /> מיוחד
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Add-ons block ───────────────────────────────────────────────── */}
      {selectedAddons.length > 0 && (
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            תוספות ({selectedAddons.length})
          </p>
          <div className="space-y-1.5">
            {selectedAddons.map((a, i) => {
              const petName = a.petRef ? petCares.find(pc => pc.clientRef === a.petRef)?.petName : null;
              return (
                <div key={i} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.scope === "booking" ? "bg-[#C5A55A]" : "bg-blue-400"}`} />
                    <p className="text-sm text-gray-700 truncate">{a.addonName}</p>
                    {petName && (
                      <span className="text-xs text-gray-400 bg-white px-1.5 py-0.5 rounded-full shrink-0">
                        {petName}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700 shrink-0 mr-2">{formatILS(a.unitPriceCents)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Loyalty credits ─────────────────────────────────────────────── */}
      {loyaltyAvailableCents > 0 && (
        <div className="px-5 py-4 space-y-3">
          {/* Balance banner */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#C5A55A]/10 border border-[#C5A55A]/20">
            <div className="w-9 h-9 rounded-full bg-[#C5A55A]/15 flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5 text-[#C5A55A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#7A5C1E]">קרדיטים זמינים</p>
              <p className="text-sm font-extrabold text-[#C5A55A]">{formatILS(loyaltyAvailableCents)}</p>
              {loyaltyMaxOnBookingCents > 0 && (
                <p className="text-[11px] text-[#8B6914] mt-0.5">
                  ניתן לממש עד {formatILS(loyaltyMaxOnBookingCents)} בהזמנה זו
                </p>
              )}
            </div>
          </div>

          {/* Toggle */}
          <div className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
            applyLoyaltyCredits
              ? "bg-emerald-50 border-emerald-200"
              : "bg-white border-gray-100"
          } ${!loyaltyToggleEnabled ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-2.5">
              <Coins className={`w-4 h-4 ${applyLoyaltyCredits ? "text-emerald-600" : "text-gray-400"}`} />
              <div>
                <p className="text-sm font-semibold text-gray-800">השתמש בקרדיטים</p>
                <p className="text-[11px] text-gray-400">
                  {loyaltyToggleEnabled
                    ? `חיסכון של עד ${formatILS(loyaltyMaxOnBookingCents)}`
                    : "מינימום מימוש ₪10"}
                </p>
              </div>
            </div>
            <Switch
              checked={applyLoyaltyCredits}
              onCheckedChange={setApplyLoyaltyCredits}
              disabled={!loyaltyToggleEnabled || quoteLoading}
            />
          </div>
        </div>
      )}

      {/* ── Promo code ─────────────────────────────────────────────────── */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">קוד קופון</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="הזן קוד (אופציונלי)"
            value={promoCode}
            onChange={e => setPromoCode(e.target.value.toUpperCase())}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A55A]/30"
            dir="ltr"
          />
          <Button
            variant="outline"
            size="sm"
            className="border-[#C5A55A] text-[#C5A55A] shrink-0 px-4 rounded-xl"
            disabled={!promoCode}
            onClick={onApplyPromo}
          >
            הפעל
          </Button>
        </div>
      </div>

      {/* ── Quote breakdown ─────────────────────────────────────────────── */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">פירוט עלות</p>
          {quoteLoading && (
            <div className="flex items-center gap-1 text-xs text-[#C5A55A]">
              <Loader2 className="w-3 h-3 animate-spin" /> מחשב...
            </div>
          )}
          {isStale && !quoteLoading && quote && (
            <span className="text-[10px] text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
              ⏱ הוזמן לפני {Math.round(staleMs / 60000)} דק׳
            </span>
          )}
        </div>

        {quoteLoading ? (
          <QuoteSkeleton />
        ) : quoteError ? (
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-600">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {quoteError}
          </div>
        ) : quote ? (
          <div className="space-y-0">
            {/* Pet lines */}
            <div className="space-y-2 pb-3">
              {quote.lineItems?.pets?.map((li: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {petEmoji(li.clientRef === "0" ? petCares[0]?.petType || "dog" : petCares[parseInt(li.clientRef)]?.petType || "dog")} {li.petName}
                    <span className="text-xs text-gray-400 mr-1">({li.label})</span>
                  </span>
                  <span className="font-medium text-gray-800">{formatILS(li.subtotalPriceCents)}</span>
                </div>
              ))}
            </div>

            {/* Addon lines from engine */}
            {(quote.lineItems?.addons?.length ?? 0) > 0 && (
              <div className="space-y-2 border-t border-dashed border-gray-100 pt-3 pb-3">
                {quote.lineItems.addons.map((li: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      {li.addonName}
                      {li.scope === "pet" && li.petRef != null && (
                        <span className="text-xs text-gray-400 mr-1">
                          ({petCares.find(pc => pc.clientRef === li.petRef)?.petName || ""})
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-gray-700">{formatILS(li.subtotalPriceCents)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            <div className="border-t border-gray-200 pt-3 space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>סכום ביניים</span>
                <span>{formatILS(quote.totals.subtotalCents)}</span>
              </div>
              {quote.totals.discountCents > 0 && (
                <div className="flex justify-between text-sm text-emerald-600 font-medium">
                  <span>✓ הנחת קופון</span>
                  <span>-{formatILS(quote.totals.discountCents)}</span>
                </div>
              )}
              {quote.totals.giftCardAppliedCents > 0 && (
                <div className="flex justify-between text-sm text-emerald-600 font-medium">
                  <span>🎁 כרטיס מתנה</span>
                  <span>-{formatILS(quote.totals.giftCardAppliedCents)}</span>
                </div>
              )}
              {quote.totals.walletCreditAppliedCents > 0 && (
                <div className="flex justify-between text-sm text-emerald-600 font-medium">
                  <span>💳 קרדיט ארנק</span>
                  <span>-{formatILS(quote.totals.walletCreditAppliedCents)}</span>
                </div>
              )}
              {(quote.totals.loyaltyRedeemedCents ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-[#C5A55A] font-medium">
                  <span className="flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5" /> קרדיטים מועדון
                  </span>
                  <span>-{formatILS(quote.totals.loyaltyRedeemedCents)}</span>
                </div>
              )}
              {quote.totals.taxCents > 0 && (
                <div className="flex justify-between text-sm text-gray-400">
                  <span>מע"מ (18%)</span>
                  <span>{formatILS(quote.totals.taxCents)}</span>
                </div>
              )}
            </div>

            {/* Final total */}
            <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-[#C5A55A]/20">
              <span className="font-bold text-gray-900 text-base">לתשלום</span>
              <span className="font-extrabold text-2xl text-[#C5A55A]">{formatILS(quote.totals.totalCents)}</span>
            </div>

            {/* Engine warnings */}
            {quote.warnings?.filter((w: string) => !w.includes("Using ₪0")).length > 0 && (
              <div className="mt-3 space-y-1.5">
                {quote.warnings
                  .filter((w: string) => !w.includes("Using ₪0"))
                  .map((w: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                      <span>{w}</span>
                    </div>
                  ))}
              </div>
            )}

            <p className="text-[9px] text-gray-300 text-center mt-2">
              {quote.pricingVersion} · {quote.durationLabel}
              {quote.quotedAt && ` · מחיר מ-${new Date(quote.quotedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-gray-400">
            <div className="text-2xl mb-2">💰</div>
            ממתין לנתוני ההזמנה...
          </div>
        )}
      </div>

      {/* ── Message to provider ─────────────────────────────────────────── */}
      <div className="px-5 py-4">
        <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">
          הודעה לנותן השירות
        </Label>
        <Textarea
          placeholder="פרטים מיוחדים, שאלות, בקשות... (אופציונלי)"
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="text-sm border-gray-200 rounded-xl focus:ring-[#C5A55A]/30 resize-none"
          rows={3}
        />
      </div>

      {/* ── Submit ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-5 space-y-3">
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || quoteLoading || !quote}
          className="w-full bg-[#C5A55A] hover:bg-[#b8945a] text-white font-bold py-4 rounded-2xl text-base shadow-md shadow-[#C5A55A]/20"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />שולח בקשת הזמנה...</>
          ) : (
            "שלח בקשת הזמנה ←"
        )}
      </Button>

      <p className="text-xs text-gray-400 text-center">
        <Shield className="w-3 h-3 inline mr-1" />
        ההזמנה תאושר רק לאחר אישור נותן השירות
      </p>

      <InsuranceTrustChip variant="card" isHebrew={true} />
      </div>
    </div>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

export default function MultiPetBookingWizard() {
  const { serviceType, providerId } = useParams<{ serviceType: string; providerId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useFirebaseAuth();

  // ── Rebook prefill — parse URL params once on mount ──────────────────────────
  const rebookParams = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const isRebook = p.get("rebook") === "1";
      const petIds = p.get("petIds")?.split(",").map(Number).filter(n => !isNaN(n) && n > 0) || [];
      const addons = p.get("addons")?.split(",").filter(Boolean) || [];
      const notes = p.get("notes") || "";
      return { isRebook, petIds, addons, notes };
    } catch {
      return { isRebook: false, petIds: [], addons: [], notes: "" };
    }
  })();

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>("schedule");

  // ── Schedule state ──────────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");

  // ── Pets state ──────────────────────────────────────────────────────────────
  const [selectedPetIds, setSelectedPetIds] = useState<number[]>([]);
  const [petCares, setPetCares] = useState<PetCareInfo[]>([]);

  // ── Addons state ────────────────────────────────────────────────────────────
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);

  // ── Confirm state ───────────────────────────────────────────────────────────
  const [message, setMessage] = useState(rebookParams.notes);
  const [promoCode, setPromoCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applyLoyaltyCredits, setApplyLoyaltyCredits] = useState(false);

  // ── Loyalty credits balance (fetched once, refreshes on step change) ─────────
  const { data: loyaltyBalanceData } = useQuery<{ balanceCents: number; pendingExpiryCents: number; pendingExpiryAt: string | null }>({
    queryKey: ["/api/loyalty-credits/balance"],
    enabled: !!user && step === "confirm",
    staleTime: 30_000,
  });

  // ── Rebook state ──────────────────────────────────────────────────────────────
  const [rebookWarnings, setRebookWarnings] = useState<string[]>([]);
  const [rebookPrefillMeta, setRebookPrefillMeta] = useState({ petCount: 0, addonCount: 0 });
  const petPrefillApplied = useRef(false);
  const addonPrefillApplied = useRef(false);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const platform = serviceType ? serviceTypeToPlatform(serviceType) : null;
  const providerApiKey = platform && providerId
    ? `/api/marketplace/provider/${platform}/${providerId}`
    : null;

  const { data: providerData } = useQuery({
    queryKey: [providerApiKey],
    enabled: !!providerApiKey,
  });

  const { data: petsData, isLoading: petsLoading } = useQuery({
    queryKey: ["/api/pets"],
    enabled: !!user,
  });

  const rawProvider = (providerData as any)?.provider || (providerData as any);
  const provider = rawProvider ? {
    ...rawProvider,
    name: rawProvider.name || [rawProvider.firstName, rawProvider.lastName].filter(Boolean).join(" ") || "ספק שירות",
    photoUrl: rawProvider.photoUrl || rawProvider.profilePictureUrl,
    rating: rawProvider.rating || rawProvider.averageRating,
    serviceLabel: rawProvider.serviceLabel || serviceTypeLabel(serviceType || ""),
  } : null;
  const pets: UserPet[] = Array.isArray(petsData) ? petsData : ((petsData as any)?.pets || []);

  // Auto-select single pet (only if not a rebook)
  useEffect(() => {
    if (rebookParams.isRebook) return;
    if (pets.length === 1 && selectedPetIds.length === 0) {
      setSelectedPetIds([pets[0].id]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pets, selectedPetIds.length]);

  // Rebook prefill: auto-select pets once pets have loaded
  useEffect(() => {
    if (!rebookParams.isRebook || !rebookParams.petIds.length || !pets.length) return;
    if (petPrefillApplied.current) return;
    petPrefillApplied.current = true;

    const validIds = rebookParams.petIds.filter(id => pets.some(p => p.id === id));
    const missingCount = rebookParams.petIds.length - validIds.length;
    if (validIds.length > 0) setSelectedPetIds(validIds);
    setRebookPrefillMeta(m => ({ ...m, petCount: validIds.length }));

    if (missingCount > 0) {
      const msg = missingCount === 1
        ? "חיית מחמד אחת לא נמצאה בחשבון — בחר שוב"
        : `${missingCount} חיות מחמד לא נמצאו בחשבון — בחר שוב`;
      setRebookWarnings(w => [...w, msg]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pets]);

  // Rebook prefill: auto-select valid addons once we know the serviceType
  useEffect(() => {
    if (!rebookParams.isRebook || !rebookParams.addons.length || !serviceType) return;
    if (addonPrefillApplied.current) return;
    addonPrefillApplied.current = true;

    const catalog = ADDON_CATALOG[serviceType] || ADDON_CATALOG["default"] || [];
    const catalogCodes = new Set(catalog.map(a => a.code));
    const validCodes = rebookParams.addons.filter(c => catalogCodes.has(c));
    const removedCount = rebookParams.addons.length - validCodes.length;

    if (validCodes.length > 0) {
      const prefilled: SelectedAddon[] = validCodes
        .map(code => catalog.find(a => a.code === code))
        .filter((a): a is AddonCatalogEntry => !!a)
        .map(a => ({
          addonCode: a.code,
          addonName: a.nameHe,
          scope: a.scope,
          quantity: 1,
          unitPriceCents: a.unitPriceCents,
        }));
      setSelectedAddons(prefilled);
      setRebookPrefillMeta(m => ({ ...m, addonCount: prefilled.length }));
    }

    if (removedCount > 0) {
      const msg = removedCount === 1
        ? "תוספת אחת הוסרה — אינה זמינה עוד עבור שירות זה"
        : `${removedCount} תוספות הוסרו — אינן זמינות עוד עבור שירות זה`;
      setRebookWarnings(w => [...w, msg]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType]);

  // ── Sync petCares when selection changes ────────────────────────────────────
  useEffect(() => {
    setPetCares(prev => {
      const result: PetCareInfo[] = selectedPetIds.map((pid, i) => {
        const existing = prev.find(c => c.petId === pid);
        if (existing) return { ...existing, clientRef: String(i) };
        const pet = pets.find(p => p.id === pid);
        return {
          petId: pid,
          clientRef: String(i),
          petName: pet?.name || `Pet ${i + 1}`,
          petType: speciesToPetType(pet?.species || "dog"),
          breed: pet?.breed,
          sizeCategory: "medium",
          ageYears: pet?.ageYears,
          weightKg: pet?.weightKg,
          gender: pet?.gender,
          requiresMedication: false,
          hasBehaviorFlag: false,
          hasSpecialNeeds: false,
          specialNotes: "",
        };
      });
      return result;
    });
  }, [selectedPetIds, pets]);

  // ── Build start/end ISO timestamps ─────────────────────────────────────────
  const startISO = (() => {
    try { return new Date(`${startDate}T${startTime}`).toISOString(); } catch { return ""; }
  })();
  const endISO = (() => {
    const isMultiDay = ["pet_sitting", "house_sitting", "daycare"].includes(serviceType || "");
    const ed = isMultiDay ? endDate : startDate;
    const et = isMultiDay ? endTime : endTime;
    try { return new Date(`${ed}T${et}`).toISOString(); } catch { return ""; }
  })();

  // ── Quote preview ───────────────────────────────────────────────────────────
  const quoteEnabled = step === "confirm" && petCares.length > 0 && !!startISO && !!endISO && !!providerId;

  const quotePayload = {
    providerId: providerId || "",
    serviceType: serviceType || "",
    bookingWindow: { startAt: startISO, endAt: endISO },
    pets: petCares.map(pc => ({
      clientRef: pc.clientRef,
      petId: String(pc.petId),
      petName: pc.petName,
      petType: pc.petType,
      breed: pc.breed || null,
      sizeCategory: pc.sizeCategory,
      ageYears: pc.ageYears || null,
      weightKg: pc.weightKg || null,
      gender: pc.gender || null,
      requiresMedication: pc.requiresMedication,
      hasBehaviorFlag: pc.hasBehaviorFlag,
      hasSpecialNeeds: pc.hasSpecialNeeds,
    })),
    addons: selectedAddons.map(a => ({
      addonCode: a.addonCode,
      scope: a.scope,
      petRef: a.petRef || null,
      quantity: a.quantity,
    })),
    promoCode: promoCode || null,
    userId: user?.uid || null,
    applyLoyaltyCredits,
  };

  const quoteDeps = [
    quoteEnabled,
    startISO,
    endISO,
    JSON.stringify(petCares.map(p => ({ ref: p.clientRef, size: p.sizeCategory, med: p.requiresMedication, beh: p.hasBehaviorFlag, sn: p.hasSpecialNeeds }))),
    JSON.stringify(selectedAddons.map(a => a.addonCode + a.petRef)),
    promoCode,
    applyLoyaltyCredits,
  ];

  const { loading: quoteLoading, data: quoteData, error: quoteError } = useQuotePreview(
    quoteEnabled,
    quotePayload,
    quoteDeps
  );

  // ── Derived loyalty values ───────────────────────────────────────────────────
  // Balance comes from the direct balance endpoint (fresh) OR from the quote (server-echoed).
  // Always prefer the direct endpoint so the value is correct even before the first quote fires.
  const loyaltyAvailableCents: number =
    loyaltyBalanceData?.balanceCents ??
    (quoteData as any)?.totals?.loyaltyAvailableCents ??
    0;
  const loyaltyMaxOnBookingCents: number = quoteData
    ? Math.min(loyaltyAvailableCents, Math.floor(((quoteData as any).totals?.subtotalCents ?? 0) * 0.5))
    : 0;
  const loyaltyToggleEnabled = loyaltyAvailableCents >= 1_000; // ₪10 minimum

  // ── Navigation ──────────────────────────────────────────────────────────────
  const stepIdx = STEPS.indexOf(step);

  function canGoNext(): boolean {
    if (step === "schedule") {
      return !!startDate && !!startISO && !!endISO;
    }
    if (step === "pets") return selectedPetIds.length > 0;
    if (step === "care") return petCares.every(pc => !!pc.sizeCategory);
    return true; // addons + confirm always ok
  }

  function goNext() {
    if (!canGoNext()) {
      toast({ title: "חסרים פרטים", description: "אנא מלא את כל השדות הנדרשים", variant: "destructive" });
      return;
    }
    if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1]);
  }

  function goBack() {
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1]);
    else setLocation(-1 as any);
  }

  // ── Pet care update ─────────────────────────────────────────────────────────
  function updateCare(clientRef: string, updates: Partial<PetCareInfo>) {
    setPetCares(prev => prev.map(c => c.clientRef === clientRef ? { ...c, ...updates } : c));
  }

  // ── Toggle pet selection ────────────────────────────────────────────────────
  function togglePet(petId: number) {
    setSelectedPetIds(prev =>
      prev.includes(petId) ? prev.filter(id => id !== petId) : [...prev, petId]
    );
  }

  // ── Toggle addon ────────────────────────────────────────────────────────────
  function toggleAddon(addon: AddonCatalogEntry, petRef?: string) {
    setSelectedAddons(prev => {
      const exists = prev.findIndex(a => a.addonCode === addon.code && a.petRef === petRef);
      if (exists >= 0) return prev.filter((_, i) => i !== exists);
      return [...prev, {
        addonCode: addon.code,
        addonName: addon.nameHe,
        scope: addon.scope,
        petRef: petRef || undefined,
        quantity: 1,
        unitPriceCents: addon.unitPriceCents,
      }];
    });
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!quoteData || !providerId || !serviceType) return;
    if (!user) { toast({ title: "יש להתחבר", variant: "destructive" }); return; }

    setIsSubmitting(true);
    try {
      const payload = {
        providerId,
        providerType: providerTypeToType(serviceType),
        serviceType,
        startDate: startISO,
        endDate: endISO,
        petCount: petCares.length,
        petIds: petCares.map(pc => String(pc.petId)),
        petDetails: petCares,
        selectedAddons,
        finalQuote: quoteData,
        promoCode: promoCode || undefined,
        message: message || undefined,
        applyLoyaltyCredits,
      };

      const res = await apiRequest("POST", "/api/booking-requests", payload);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Booking failed");

      toast({ title: "ההזמנה נשלחה! 🎉", description: "נותן השירות יאשר בקרוב" });
      setLocation(`/bookings`);
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message || "נסה שוב", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-white">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="font-semibold text-gray-900 flex-1 text-center">
            {rebookParams.isRebook ? "הזמנה חוזרת" : "הזמנה חדשה"}
          </h1>
          <div className="w-8" />
        </div>
        <ProgressBar currentStep={step} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {rebookParams.isRebook && (
          <RebookBanner
            warnings={rebookWarnings}
            petCount={rebookPrefillMeta.petCount}
            addonCount={rebookPrefillMeta.addonCount}
            hasNotes={!!rebookParams.notes}
          />
        )}

        {step === "schedule" && (
          <ScheduleStep
            serviceType={serviceType || "pet_sitting"}
            provider={provider}
            startDate={startDate} setStartDate={setStartDate}
            endDate={endDate} setEndDate={setEndDate}
            startTime={startTime} setStartTime={setStartTime}
            endTime={endTime} setEndTime={setEndTime}
          />
        )}
        {step === "pets" && (
          <PetsStep
            pets={pets}
            petsLoading={petsLoading}
            selectedPetIds={selectedPetIds}
            onTogglePet={togglePet}
          />
        )}
        {step === "care" && (
          <CareStep
            petCares={petCares}
            onUpdateCare={updateCare}
            serviceType={serviceType || "pet_sitting"}
          />
        )}
        {step === "addons" && (
          <AddonsStep
            serviceType={serviceType || "pet_sitting"}
            petCares={petCares}
            selectedAddons={selectedAddons}
            onToggleAddon={toggleAddon}
          />
        )}
        {step === "confirm" && (
          <ConfirmStep
            quote={quoteData}
            quoteLoading={quoteLoading}
            quoteError={quoteError}
            petCares={petCares}
            selectedAddons={selectedAddons}
            startDate={startDate}
            endDate={endDate}
            startTime={startTime}
            endTime={endTime}
            serviceType={serviceType || "pet_sitting"}
            message={message} setMessage={setMessage}
            promoCode={promoCode} setPromoCode={setPromoCode}
            onApplyPromo={() => {
              // Re-trigger quote with new promoCode by bumping the deps — quote hook already includes promoCode
            }}
            provider={provider}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            applyLoyaltyCredits={applyLoyaltyCredits}
            setApplyLoyaltyCredits={setApplyLoyaltyCredits}
            loyaltyAvailableCents={loyaltyAvailableCents}
            loyaltyMaxOnBookingCents={loyaltyMaxOnBookingCents}
            loyaltyToggleEnabled={loyaltyToggleEnabled}
          />
        )}
      </div>

      {/* Bottom nav */}
      {step !== "confirm" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-3 max-w-lg mx-auto safe-area-bottom">
          <Button
            variant="outline"
            onClick={goBack}
            className="flex-1 border-gray-200 text-gray-700"
          >
            <ChevronRight className="w-4 h-4 ml-1" />
            חזור
          </Button>
          <Button
            onClick={goNext}
            disabled={!canGoNext()}
            className="flex-1 bg-[#C5A55A] hover:bg-[#b8945a] text-white font-semibold"
          >
            המשך
            <ChevronLeft className="w-4 h-4 mr-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
