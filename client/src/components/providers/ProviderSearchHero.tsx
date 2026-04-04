/**
 * MARKETPLACE PROVIDER SEARCH HERO BAR
 * Sticky top bar: location, service type, optional dates, GPS.
 * Online service domains only. NOT for K9000.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, MapPin, Calendar, Navigation, Check } from "lucide-react";
import type { ProviderSearchFilters } from "@shared/provider-search-types";

interface Props {
  filters: ProviderSearchFilters;
  onChange: (next: ProviderSearchFilters) => void;
  onSearch: () => void;
  onSearchDebounced?: (next: ProviderSearchFilters) => void;
  loading?: boolean;
}

const SERVICE_OPTIONS = [
  { value: "",            labelEn: "All services",  labelHe: "כל השירותים" },
  { value: "pet_sitting", labelEn: "Pet Sitting",   labelHe: "שמירה על חיות" },
  { value: "dog_walking", labelEn: "Dog Walking",   labelHe: "הליכת כלבים" },
  { value: "grooming",    labelEn: "Grooming",      labelHe: "טיפוח" },
  { value: "daycare",     labelEn: "Daycare",       labelHe: "פנסיון יומי" },
  { value: "transport",   labelEn: "Transport",     labelHe: "הסעות" },
];

export function ProviderSearchHero({ filters, onChange, onSearch, onSearchDebounced, loading }: Props) {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === "he";
  const [locating, setLocating] = useState(false);

  const useGPS = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          ...filters,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          sort: "closest" as const,
          page: 1,
        };
        onChange(next);
        onSearch();
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  const clearGPS = () => {
    const next = { ...filters, lat: undefined, lng: undefined, sort: "recommended" as const, page: 1 };
    onChange(next);
    onSearch();
  };

  return (
    <div className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">

          {/* Location / text search */}
          <div className="lg:col-span-2">
            <Label className="text-xs font-medium text-zinc-500 mb-1 block">
              {isHebrew ? "מיקום או שם" : "Location or name"}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                <Input
                  placeholder={isHebrew ? "עיר, אזור, מיקוד..." : "City, suburb, postcode..."}
                  value={filters.q || ""}
                  onChange={(e) => {
                    const next = { ...filters, q: e.target.value, page: 1 };
                    onChange(next);
                    // Auto-search with 300 ms debounce while typing
                    if (onSearchDebounced) onSearchDebounced(next);
                  }}
                  className="pl-10"
                  data-testid="input-provider-q"
                  onKeyDown={(e) => e.key === "Enter" && onSearch()}
                />
              </div>
              {/* GPS button */}
              <Button
                variant="outline"
                size="icon"
                onClick={filters.lat ? clearGPS : useGPS}
                disabled={locating}
                title={
                  filters.lat
                    ? (isHebrew ? "בטל מיקום GPS" : "Clear GPS location")
                    : (isHebrew ? "השתמש במיקומי" : "Use my location")
                }
                data-testid="button-gps"
                className={
                  filters.lat
                    ? "border-emerald-500 text-emerald-600 dark:border-emerald-400"
                    : ""
                }
              >
                {filters.lat ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Navigation className={`h-4 w-4 ${locating ? "animate-pulse" : ""}`} />
                )}
              </Button>
            </div>
            {filters.lat && (
              <p className="text-xs text-emerald-600 mt-1">
                {isHebrew
                  ? `מיקום GPS פעיל · רדיוס ${filters.radiusKm || 15} ק"מ`
                  : `GPS active · ${filters.radiusKm || 15} km radius`}
              </p>
            )}
          </div>

          {/* Service type */}
          <div>
            <Label className="text-xs font-medium text-zinc-500 mb-1 block">
              {isHebrew ? "סוג שירות" : "Service type"}
            </Label>
            <Select
              value={filters.serviceType || ""}
              onValueChange={(v) => {
                const next = { ...filters, serviceType: v as any, page: 1 };
                onChange(next);
                onSearch();
              }}
            >
              <SelectTrigger data-testid="select-service-type">
                <SelectValue placeholder={isHebrew ? "כל השירותים" : "All services"} />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_OPTIONS.map((s) => (
                  <SelectItem key={s.value || "all"} value={s.value || "__all__"}>
                    {isHebrew ? s.labelHe : s.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start date */}
          <div>
            <Label className="text-xs font-medium text-zinc-500 mb-1 block">
              {isHebrew ? "מתאריך (אופציונלי)" : "From (optional)"}
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              <Input
                type="date"
                className="pl-10"
                value={filters.startDate || ""}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => {
                  const v = e.target.value || undefined;
                  onChange({
                    ...filters,
                    startDate: v,
                    endDate:
                      v && filters.endDate && filters.endDate < v
                        ? v
                        : filters.endDate,
                    page: 1,
                  });
                }}
                data-testid="input-start-date"
              />
            </div>
          </div>

          {/* End date + search button */}
          <div>
            <Label className="text-xs font-medium text-zinc-500 mb-1 block">
              {isHebrew ? "עד תאריך (אופציונלי)" : "Until (optional)"}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                <Input
                  type="date"
                  className="pl-10"
                  value={filters.endDate || ""}
                  min={filters.startDate || new Date().toISOString().split("T")[0]}
                  onChange={(e) =>
                    onChange({ ...filters, endDate: e.target.value || undefined, page: 1 })
                  }
                  data-testid="input-end-date"
                />
              </div>
              <Button
                onClick={onSearch}
                disabled={loading}
                className="bg-zinc-900 hover:bg-zinc-700 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-white shrink-0"
                data-testid="button-search"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">
                  {loading
                    ? (isHebrew ? "מחפש..." : "...")
                    : (isHebrew ? "חפש" : "Search")}
                </span>
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
