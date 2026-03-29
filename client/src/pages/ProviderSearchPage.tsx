/**
 * MARKETPLACE PROVIDER SEARCH PAGE
 * Route: /search  (also /providers/search)
 *
 * Online service domains only: pet_sitting, dog_walking, grooming, transport, daycare.
 * NOT for K9000.
 *
 * Layout:
 *   Desktop: sticky hero bar → smart chips → left sidebar (filters) + results grid
 *   Mobile:  sticky hero bar → sticky toolbar (filter + sort) → results list + bottom sheet
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Search,
  MapPin,
} from "lucide-react";
import { useProviderSearch, DEFAULT_FILTERS } from "@/hooks/useProviderSearch";
import { ProviderSearchHero } from "@/components/providers/ProviderSearchHero";
import { ProviderFilterPanel } from "@/components/providers/ProviderFilterPanel";
import { ProviderSearchCard } from "@/components/providers/ProviderSearchCard";
import type { ProviderSortMode } from "@shared/provider-search-types";

const SORT_LABELS: Record<ProviderSortMode, { en: string; he: string }> = {
  recommended:      { en: "Recommended",       he: "מומלצים" },
  closest:          { en: "Nearest first",      he: "הקרוב ביותר" },
  top_rated:        { en: "Top rated",          he: "מדורג גבוה" },
  lowest_price:     { en: "Price: low to high", he: "מחיר נמוך" },
  fastest_response: { en: "Fastest response",   he: "מגיב מהר" },
};

// ── Smart chip helpers ───────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/** Next Saturday (or today if it's Saturday) */
function nextWeekendStart() {
  const d = new Date();
  const dayOfWeek = d.getDay(); // 0=Sun … 6=Sat
  const daysToSat = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
  d.setDate(d.getDate() + daysToSat);
  return d.toISOString().split("T")[0];
}

/** Sunday after the upcoming Saturday */
function nextWeekendEnd() {
  const d = new Date(nextWeekendStart());
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

// ── CardSkeleton ─────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 animate-pulse">
      <div className="flex flex-col sm:flex-row">
        {/* Image placeholder */}
        <div className="h-52 sm:h-auto sm:w-52 sm:shrink-0 bg-zinc-100 dark:bg-zinc-800" />
        {/* Body placeholder */}
        <div className="flex-1 p-5 space-y-3">
          <div className="flex justify-between gap-3">
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-zinc-100 dark:bg-zinc-800 rounded-md w-3/5" />
              <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded-md w-2/5" />
            </div>
            <div className="h-7 bg-zinc-100 dark:bg-zinc-800 rounded-md w-16 shrink-0" />
          </div>
          <div className="flex gap-3">
            <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-md w-16" />
            <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-md w-24" />
          </div>
          <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded-md w-full" />
          <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded-md w-4/5" />
          <div className="flex gap-2 mt-2">
            <div className="h-6 bg-zinc-100 dark:bg-zinc-800 rounded-full w-20" />
            <div className="h-6 bg-zinc-100 dark:bg-zinc-800 rounded-full w-16" />
          </div>
          <div className="flex gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 mt-auto">
            <div className="h-8 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex-1" />
            <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded-lg flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ProviderSearchPage() {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === "he";
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const {
    filters,
    setFilters,
    loading,
    data,
    error,
    runSearch,
    runSearchDebounced,
    activeFilterCount,
    resetFilters,
  } = useProviderSearch();

  const results = data?.results || [];

  const applyFilters = () => {
    runSearch({ ...filters, page: 1 });
    setMobileFiltersOpen(false);
  };

  // ── Smart chip definitions ─────────────────────────────────────────────────
  const today = todayStr();
  const satStr = nextWeekendStart();
  const sunStr = nextWeekendEnd();

  const isChipActive = {
    availableToday:
      filters.startDate === today && filters.endDate === today,
    thisWeekend:
      filters.startDate === satStr && filters.endDate === sunStr,
    instantBook: !!filters.instantBookOnly,
    topRated: filters.minRating === 4.8,
  };

  const toggleChip = (chip: keyof typeof isChipActive, patchOn: any, patchOff: any) => {
    const next = {
      ...filters,
      ...(isChipActive[chip] ? patchOff : patchOn),
      page: 1,
    };
    setFilters(next);
    runSearch(next);
  };

  // ── Active filter chips ────────────────────────────────────────────────────
  const chips: { label: string; onRemove: () => void }[] = [];
  if (filters.verifiedOnly)
    chips.push({ label: isHebrew ? "מאומת" : "Verified", onRemove: () => runSearch({ ...filters, verifiedOnly: false, page: 1 }) });
  if (filters.insuredOnly)
    chips.push({ label: isHebrew ? "מבוטח" : "Insured", onRemove: () => runSearch({ ...filters, insuredOnly: false, page: 1 }) });
  if (filters.instantBookOnly && !isChipActive.instantBook)
    chips.push({ label: isHebrew ? "הזמנה מיידית" : "Instant Book", onRemove: () => runSearch({ ...filters, instantBookOnly: false, page: 1 }) });
  if ((filters.minRating || 0) > 0 && filters.minRating !== 4.8)
    chips.push({ label: `${filters.minRating}★+`, onRemove: () => runSearch({ ...filters, minRating: 0, page: 1 }) });
  if ((filters.priceMax || 999999) < 999999)
    chips.push({ label: isHebrew ? `עד ₪${filters.priceMax}` : `Up to ₪${filters.priceMax}`, onRemove: () => runSearch({ ...filters, priceMax: 999999, page: 1 }) });
  if ((filters.priceMin || 0) > 0)
    chips.push({ label: isHebrew ? `מ-₪${filters.priceMin}` : `From ₪${filters.priceMin}`, onRemove: () => runSearch({ ...filters, priceMin: 0, page: 1 }) });
  if (filters.lat && filters.radiusKm && filters.radiusKm !== 15)
    chips.push({ label: isHebrew ? `${filters.radiusKm} ק"מ` : `${filters.radiusKm} km`, onRemove: () => runSearch({ ...filters, radiusKm: 15, page: 1 }) });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">

      {/* Sticky search hero */}
      <ProviderSearchHero
        filters={filters}
        onChange={setFilters}
        onSearch={() => runSearch({ ...filters, page: 1 })}
        onSearchDebounced={runSearchDebounced}
        loading={loading}
      />

      {/* ── Smart chips strip ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">

            {/* Available today */}
            <SmartChip
              active={isChipActive.availableToday}
              onClick={() => toggleChip(
                "availableToday",
                { startDate: today, endDate: today },
                { startDate: undefined, endDate: undefined }
              )}
            >
              {isHebrew ? "פנוי היום" : "Available today"}
            </SmartChip>

            {/* This weekend */}
            <SmartChip
              active={isChipActive.thisWeekend}
              onClick={() => toggleChip(
                "thisWeekend",
                { startDate: satStr, endDate: sunStr },
                { startDate: undefined, endDate: undefined }
              )}
            >
              {isHebrew ? "סוף השבוע" : "This weekend"}
            </SmartChip>

            {/* Instant Book */}
            <SmartChip
              active={isChipActive.instantBook}
              onClick={() => toggleChip(
                "instantBook",
                { instantBookOnly: true },
                { instantBookOnly: false }
              )}
            >
              ⚡ {isHebrew ? "הזמנה מיידית" : "Instant Book"}
            </SmartChip>

            {/* Top rated */}
            <SmartChip
              active={isChipActive.topRated}
              onClick={() => toggleChip(
                "topRated",
                { minRating: 4.8 },
                { minRating: 0 }
              )}
            >
              ★ {isHebrew ? "מדורגים 4.8+" : "Top rated 4.8+"}
            </SmartChip>

            {/* Near me — only when GPS not active */}
            {!filters.lat && (
              <SmartChip
                active={false}
                onClick={() => {
                  if (!navigator.geolocation) return;
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const next = {
                        ...filters,
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        sort: "closest" as ProviderSortMode,
                        page: 1,
                      };
                      setFilters(next);
                      runSearch(next);
                    },
                    () => {}
                  );
                }}
              >
                <MapPin className="h-3 w-3 inline mr-1" />
                {isHebrew ? "קרוב אלי" : "Near me"}
              </SmartChip>
            )}
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Badge
              key={chip.label}
              variant="outline"
              className="flex items-center gap-1 pr-1 bg-white dark:bg-zinc-900"
            >
              {chip.label}
              <button
                onClick={chip.onRemove}
                className="ml-1 hover:opacity-60 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            onClick={resetFilters}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
          >
            {isHebrew ? "נקה הכל" : "Clear all"}
          </button>
        </div>
      )}

      {/* ── Mobile toolbar ─────────────────────────────────────────────────── */}
      <div className="lg:hidden sticky top-[60px] z-20 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-4 py-2 flex items-center gap-3">
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="relative">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              {isHebrew ? "פילטרים" : "Filters"}
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side={isHebrew ? "left" : "right"}
            className="w-full sm:max-w-md overflow-y-auto"
          >
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5" />
                {isHebrew ? "פילטרים" : "Filters"}
              </SheetTitle>
            </SheetHeader>
            <div className="py-6">
              <ProviderFilterPanel
                filters={filters}
                onChange={setFilters}
                onApply={applyFilters}
                onReset={() => {
                  resetFilters();
                  setMobileFiltersOpen(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        <Select
          value={filters.sort || "recommended"}
          onValueChange={(v) => {
            const next = { ...filters, sort: v as ProviderSortMode, page: 1 };
            setFilters(next);
            runSearch(next);
          }}
        >
          <SelectTrigger className="w-auto gap-2 h-9 text-sm">
            <ArrowUpDown className="h-3 w-3 text-zinc-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filters.lat && (
              <SelectItem value="closest">
                {isHebrew ? "הקרוב ביותר" : "Nearest first"}
              </SelectItem>
            )}
            <SelectItem value="recommended">{isHebrew ? "מומלצים" : "Recommended"}</SelectItem>
            <SelectItem value="top_rated">{isHebrew ? "מדורג גבוה" : "Top rated"}</SelectItem>
            <SelectItem value="lowest_price">{isHebrew ? "מחיר נמוך" : "Lowest price"}</SelectItem>
            <SelectItem value="fastest_response">{isHebrew ? "מגיב מהר" : "Fastest response"}</SelectItem>
          </SelectContent>
        </Select>

        {/* Live result count on mobile */}
        {data && !loading && (
          <span className="text-xs text-zinc-400 ml-auto">
            {data.total} {isHebrew ? "ספקים" : "providers"}
          </span>
        )}
      </div>

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">

          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5 shadow-sm">
              <h2 className="text-base font-semibold mb-5 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                {isHebrew ? "פילטרים" : "Filters"}
                {activeFilterCount > 0 && (
                  <Badge className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </h2>
              <ProviderFilterPanel
                filters={filters}
                onChange={setFilters}
                onApply={() => runSearch({ ...filters, page: 1 })}
                onReset={resetFilters}
              />
            </div>
          </aside>

          {/* Results */}
          <main className="flex-1 min-w-0">

            {/* Result meta + desktop sort */}
            {(data || loading) && (
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-zinc-500">
                  {loading ? (
                    <div className="h-4 w-32 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                  ) : (
                    <>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {data?.total}
                      </span>{" "}
                      {isHebrew ? "ספקים נמצאו" : "providers found"}
                      {filters.lat && data?.debug?.usedLocation && (
                        <span className="text-zinc-400 ml-1">
                          {isHebrew
                            ? `ברדיוס ${filters.radiusKm || 15} ק"מ`
                            : `within ${filters.radiusKm || 15} km`}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Desktop sort */}
                <div className="hidden lg:flex items-center gap-2 text-sm text-zinc-500">
                  <ArrowUpDown className="h-3 w-3" />
                  <Select
                    value={filters.sort || "recommended"}
                    onValueChange={(v) => {
                      const next = { ...filters, sort: v as ProviderSortMode, page: 1 };
                      setFilters(next);
                      runSearch(next);
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm w-48 border-0 shadow-none p-0 focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filters.lat && (
                        <SelectItem value="closest">
                          {isHebrew ? "הקרוב ביותר" : "Nearest first"}
                        </SelectItem>
                      )}
                      <SelectItem value="recommended">{isHebrew ? "מומלצים" : "Recommended"}</SelectItem>
                      <SelectItem value="top_rated">{isHebrew ? "מדורג גבוה" : "Top rated"}</SelectItem>
                      <SelectItem value="lowest_price">{isHebrew ? "מחיר נמוך" : "Lowest price"}</SelectItem>
                      <SelectItem value="fastest_response">{isHebrew ? "מגיב מהר" : "Fastest response"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Skeletons — match real card layout */}
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-100 dark:border-zinc-800">
                <p className="text-red-500 mb-4">{error}</p>
                <Button
                  variant="outline"
                  onClick={() => runSearch({ ...filters, page: 1 })}
                >
                  <Search className="h-4 w-4 mr-2" />
                  {isHebrew ? "נסה שוב" : "Try again"}
                </Button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && data && results.length === 0 && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-10 text-center border border-zinc-100 dark:border-zinc-800">
                <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                  <Search className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="font-semibold text-lg mb-2">
                  {isHebrew ? "לא נמצאו ספקים באזור זה" : "No providers found in this area"}
                </h3>
                <p className="text-zinc-500 text-sm mb-6 max-w-xs mx-auto">
                  {isHebrew
                    ? "נסה להרחיב את הרדיוס, להסיר פילטר, או לשנות תאריכים."
                    : "Try expanding the radius, removing a filter, or changing your dates."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {filters.lat && (filters.radiusKm || 15) < 50 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const next = { ...filters, radiusKm: 30, page: 1 };
                        setFilters(next);
                        runSearch(next);
                      }}
                    >
                      {isHebrew ? "הרחב חיפוש ל-30 ק\"מ" : "Expand search to 30 km"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      const next = { ...DEFAULT_FILTERS, lat: filters.lat, lng: filters.lng, page: 1 };
                      setFilters(next);
                      runSearch(next);
                    }}
                  >
                    {isHebrew ? "הצג את כל הספקים" : "Show all providers"}
                  </Button>
                </div>
              </div>
            )}

            {/* Results */}
            {!loading && !error && results.length > 0 && (
              <div className="space-y-4">
                {results.map((item) => (
                  <ProviderSearchCard key={item.providerId} item={item} />
                ))}

                {/* Pagination */}
                {data && data.total > data.pageSize && (
                  <div className="flex justify-center gap-3 pt-4">
                    <Button
                      variant="outline"
                      disabled={data.page <= 1}
                      onClick={() => {
                        const next = { ...filters, page: data.page - 1 };
                        setFilters(next);
                        runSearch(next);
                      }}
                    >
                      {isHebrew ? "הקודם" : "Previous"}
                    </Button>
                    <span className="flex items-center text-sm text-zinc-500">
                      {isHebrew
                        ? `עמוד ${data.page} מתוך ${Math.ceil(data.total / data.pageSize)}`
                        : `Page ${data.page} of ${Math.ceil(data.total / data.pageSize)}`}
                    </span>
                    <Button
                      variant="outline"
                      disabled={data.page >= Math.ceil(data.total / data.pageSize)}
                      onClick={() => {
                        const next = { ...filters, page: data.page + 1 };
                        setFilters(next);
                        runSearch(next);
                      }}
                    >
                      {isHebrew ? "הבא" : "Next"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* First-load prompt */}
            {!loading && !data && !error && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-10 text-center border border-zinc-100 dark:border-zinc-800">
                <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                  <Search className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="font-semibold text-lg mb-2">
                  {isHebrew ? "מצא ספק לחיית המחמד שלך" : "Find the right provider"}
                </h3>
                <p className="text-zinc-400 text-sm max-w-xs mx-auto">
                  {isHebrew
                    ? "הכנס מיקום או הפעל GPS כדי לחפש ספקים קרובים."
                    : "Enter a location or enable GPS to find providers near you."}
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ── SmartChip sub-component ──────────────────────────────────────────────────

function SmartChip({
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
      className={`
        inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium
        border transition-all duration-150 shrink-0
        ${active
          ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
          : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-500"
        }
      `}
    >
      {children}
    </button>
  );
}
