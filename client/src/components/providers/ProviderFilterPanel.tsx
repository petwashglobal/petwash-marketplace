/**
 * MARKETPLACE PROVIDER FILTER PANEL
 * Desktop sidebar + mobile sheet content.
 * Online service domains only. NOT for K9000.
 */

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { X, RotateCcw, Search } from "lucide-react";
import type {
  ProviderSearchFilters,
  ProviderSortMode,
} from "@shared/provider-search-types";

interface Props {
  filters: ProviderSearchFilters;
  onChange: (next: ProviderSearchFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

const RADIUS_CHIPS = [5, 10, 15, 20, 30, 50];
const RATING_CHIPS = [
  { value: 0,   labelEn: "Any",  labelHe: "הכל" },
  { value: 4,   labelEn: "4.0+", labelHe: "4.0+" },
  { value: 4.5, labelEn: "4.5+", labelHe: "4.5+" },
  { value: 4.8, labelEn: "4.8+", labelHe: "4.8+" },
];

const PRICE_MAX_CHIPS = [
  { value: 999999, labelEn: "Any",   labelHe: "הכל" },
  { value: 150,    labelEn: "₪150",  labelHe: "₪150" },
  { value: 250,    labelEn: "₪250",  labelHe: "₪250" },
  { value: 400,    labelEn: "₪400",  labelHe: "₪400" },
];

const SORT_OPTIONS: { value: ProviderSortMode; labelEn: string; labelHe: string }[] = [
  { value: "recommended",    labelEn: "Recommended",       labelHe: "מומלצים" },
  { value: "closest",        labelEn: "Closest first",     labelHe: "הקרוב ביותר" },
  { value: "top_rated",      labelEn: "Top rated",         labelHe: "מדורג גבוה" },
  { value: "lowest_price",   labelEn: "Price: low to high",labelHe: "מחיר: נמוך לגבוה" },
  { value: "fastest_response",labelEn: "Fastest response", labelHe: "מגיב מהר" },
];

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
        active
          ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}

export function ProviderFilterPanel({ filters, onChange, onApply, onReset }: Props) {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === "he";

  const up = (patch: Partial<ProviderSearchFilters>) =>
    onChange({ ...filters, ...patch, page: 1 });

  return (
    <div className="space-y-6">
      {/* Sort */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">
          {isHebrew ? "מיין לפי" : "Sort by"}
        </Label>
        <Select
          value={filters.sort || "recommended"}
          onValueChange={(v) => up({ sort: v as ProviderSortMode })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {isHebrew ? s.labelHe : s.labelEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Radius — only when GPS is active */}
      {filters.lat && (
        <>
          <div>
            <Label className="text-sm font-semibold mb-3 block">
              {isHebrew
                ? `רדיוס חיפוש: ${filters.radiusKm || 15} ק"מ`
                : `Search radius: ${filters.radiusKm || 15} km`}
            </Label>
            <div className="flex flex-wrap gap-2 mb-3">
              {RADIUS_CHIPS.map((r) => (
                <ChipButton
                  key={r}
                  active={filters.radiusKm === r}
                  onClick={() => up({ radiusKm: r })}
                >
                  {r} {isHebrew ? 'ק"מ' : "km"}
                </ChipButton>
              ))}
            </div>
            <Slider
              value={[filters.radiusKm || 15]}
              onValueChange={([v]) => up({ radiusKm: v })}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
          </div>
          <Separator />
        </>
      )}

      {/* Rating */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">
          {isHebrew ? "דירוג מינימלי" : "Minimum rating"}
        </Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {RATING_CHIPS.map((r) => (
            <ChipButton
              key={r.value}
              active={filters.minRating === r.value}
              onClick={() => up({ minRating: r.value })}
            >
              {isHebrew ? r.labelHe : r.labelEn}
            </ChipButton>
          ))}
        </div>
        <Slider
          value={[filters.minRating || 0]}
          onValueChange={([v]) => up({ minRating: v })}
          min={0}
          max={5}
          step={0.5}
          className="w-full"
        />
      </div>

      <Separator />

      {/* Price range */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">
          {isHebrew ? "טווח מחירים (₪)" : "Price range (₪)"}
        </Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRICE_MAX_CHIPS.map((p) => (
            <ChipButton
              key={p.value}
              active={(filters.priceMax || 999999) === p.value}
              onClick={() => up({ priceMax: p.value })}
            >
              {isHebrew ? p.labelHe : p.labelEn}
            </ChipButton>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder={isHebrew ? "מ-₪" : "Min ₪"}
            value={filters.priceMin || ""}
            onChange={(e) =>
              up({ priceMin: e.target.value ? Number(e.target.value) : 0 })
            }
          />
          <Input
            type="number"
            placeholder={isHebrew ? "עד ₪" : "Max ₪"}
            value={
              !filters.priceMax || filters.priceMax >= 999999
                ? ""
                : filters.priceMax
            }
            onChange={(e) =>
              up({
                priceMax: e.target.value ? Number(e.target.value) : 999999,
              })
            }
          />
        </div>
      </div>

      <Separator />

      {/* Trust / badges */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">
          {isHebrew ? "אמינות" : "Trust"}
        </Label>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={!!filters.verifiedOnly}
              onCheckedChange={(v) => up({ verifiedOnly: !!v })}
              data-testid="check-verified"
            />
            <span className="text-sm">{isHebrew ? "מאומת בלבד" : "Verified only"}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={!!filters.insuredOnly}
              onCheckedChange={(v) => up({ insuredOnly: !!v })}
              data-testid="check-insured"
            />
            <span className="text-sm">{isHebrew ? "מבוטח בלבד" : "Insured only"}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={!!filters.instantBookOnly}
              onCheckedChange={(v) => up({ instantBookOnly: !!v })}
              data-testid="check-instant"
            />
            <span className="text-sm">
              {isHebrew ? "הזמנה מיידית בלבד" : "Instant Book only"}
            </span>
          </label>
        </div>
      </div>

      <Separator />

      {/* Pet */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">
          {isHebrew ? "חיית מחמד" : "Pet"}
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={filters.petType || "__all__"}
            onValueChange={(v) =>
              up({ petType: v === "__all__" ? "" : (v as any) })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={isHebrew ? "כל החיות" : "All pets"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{isHebrew ? "כל החיות" : "All pets"}</SelectItem>
              <SelectItem value="dog">{isHebrew ? "כלב" : "Dog"}</SelectItem>
              <SelectItem value="cat">{isHebrew ? "חתול" : "Cat"}</SelectItem>
              <SelectItem value="other">{isHebrew ? "אחר" : "Other"}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.petSize || "__all__"}
            onValueChange={(v) =>
              up({ petSize: v === "__all__" ? "" : (v as any) })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={isHebrew ? "כל הגדלים" : "All sizes"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{isHebrew ? "כל הגדלים" : "All sizes"}</SelectItem>
              <SelectItem value="small">{isHebrew ? "קטן" : "Small"}</SelectItem>
              <SelectItem value="medium">{isHebrew ? "בינוני" : "Medium"}</SelectItem>
              <SelectItem value="large">{isHebrew ? "גדול" : "Large"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          {isHebrew ? "אפס" : "Reset"}
        </Button>
        <Button
          className="flex-1 bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-white"
          onClick={onApply}
        >
          <Search className="h-4 w-4 mr-2" />
          {isHebrew ? "חפש" : "Apply"}
        </Button>
      </div>
    </div>
  );
}
