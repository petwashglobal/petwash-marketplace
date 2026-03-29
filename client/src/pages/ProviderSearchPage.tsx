/**
 * MARKETPLACE PROVIDER SEARCH PAGE
 * Route: /search
 *
 * Online service domains only: pet_sitting, dog_walking, grooming, transport, daycare.
 * NOT for K9000.
 *
 * Layout:
 *   Desktop: sticky hero bar → left sidebar (filters) + results grid
 *   Mobile:  sticky hero bar → toolbar (filter button + sort) → results list + bottom sheet
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Star,
  Shield,
  Navigation,
  Zap,
  X,
  Search,
} from "lucide-react";
import { useProviderSearch, DEFAULT_FILTERS } from "@/hooks/useProviderSearch";
import { ProviderSearchHero } from "@/components/providers/ProviderSearchHero";
import { ProviderFilterPanel } from "@/components/providers/ProviderFilterPanel";
import { ProviderSearchCard } from "@/components/providers/ProviderSearchCard";
import type { ProviderSortMode } from "@shared/provider-search-types";

const SORT_LABELS: Record<ProviderSortMode, { en: string; he: string }> = {
  recommended:     { en: "Recommended",        he: "מומלצים" },
  closest:         { en: "Nearest first",       he: "הקרוב ביותר" },
  top_rated:       { en: "Top rated",           he: "מדורג גבוה" },
  lowest_price:    { en: "Price: low to high",  he: "מחיר נמוך" },
  fastest_response:{ en: "Fastest response",    he: "מגיב מהר" },
};

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
    activeFilterCount,
    resetFilters,
  } = useProviderSearch();

  const results = data?.results || [];

  const applyFilters = () => {
    runSearch({ ...filters, page: 1 });
    setMobileFiltersOpen(false);
  };

  const sortLabel = SORT_LABELS[filters.sort || "recommended"];

  // Active filter chips for the strip below the hero
  const chips: { label: string; onRemove: () => void }[] = [];
  if (filters.verifiedOnly)
    chips.push({
      label: isHebrew ? "מאומת" : "Verified",
      onRemove: () =>
        runSearch({ ...filters, verifiedOnly: false, page: 1 }),
    });
  if (filters.insuredOnly)
    chips.push({
      label: isHebrew ? "מבוטח" : "Insured",
      onRemove: () =>
        runSearch({ ...filters, insuredOnly: false, page: 1 }),
    });
  if (filters.instantBookOnly)
    chips.push({
      label: isHebrew ? "הזמנה מיידית" : "Instant Book",
      onRemove: () =>
        runSearch({ ...filters, instantBookOnly: false, page: 1 }),
    });
  if ((filters.minRating || 0) > 0)
    chips.push({
      label: `${filters.minRating}★+`,
      onRemove: () => runSearch({ ...filters, minRating: 0, page: 1 }),
    });
  if ((filters.priceMax || 999999) < 999999)
    chips.push({
      label: isHebrew ? `עד ₪${filters.priceMax}` : `Up to ₪${filters.priceMax}`,
      onRemove: () => runSearch({ ...filters, priceMax: 999999, page: 1 }),
    });
  if ((filters.priceMin || 0) > 0)
    chips.push({
      label: isHebrew ? `מ-₪${filters.priceMin}` : `From ₪${filters.priceMin}`,
      onRemove: () => runSearch({ ...filters, priceMin: 0, page: 1 }),
    });
  if (filters.lat && filters.radiusKm && filters.radiusKm !== 15)
    chips.push({
      label: isHebrew ? `${filters.radiusKm} ק"מ` : `${filters.radiusKm} km`,
      onRemove: () => runSearch({ ...filters, radiusKm: 15, page: 1 }),
    });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sticky search hero */}
      <ProviderSearchHero
        filters={filters}
        onChange={setFilters}
        onSearch={() => runSearch({ ...filters, page: 1 })}
        loading={loading}
      />

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

      {/* Mobile toolbar: filter button + sort dropdown */}
      <div className="lg:hidden sticky top-[73px] z-20 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-4 py-2 flex items-center gap-3">
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="relative">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              {isHebrew ? "פילטרים" : "Filters"}
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs flex items-center justify-center font-bold">
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
      </div>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5 shadow-sm">
              <h2 className="text-base font-semibold mb-5 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                {isHebrew ? "פילטרים" : "Filters"}
                {activeFilterCount > 0 && (
                  <Badge className="bg-black text-white dark:bg-white dark:text-black text-xs">
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
            {/* Result meta */}
            {(data || loading) && (
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-zinc-500">
                  {loading ? (
                    <Skeleton className="h-4 w-32" />
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
                      const next = {
                        ...filters,
                        sort: v as ProviderSortMode,
                        page: 1,
                      };
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
                      <SelectItem value="recommended">
                        {isHebrew ? "מומלצים" : "Recommended"}
                      </SelectItem>
                      <SelectItem value="top_rated">
                        {isHebrew ? "מדורג גבוה" : "Top rated"}
                      </SelectItem>
                      <SelectItem value="lowest_price">
                        {isHebrew ? "מחיר נמוך" : "Lowest price"}
                      </SelectItem>
                      <SelectItem value="fastest_response">
                        {isHebrew ? "מגיב מהר" : "Fastest response"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Loading skeletons */}
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="flex flex-col sm:flex-row">
                      <Skeleton className="h-48 sm:h-40 sm:w-56 shrink-0" />
                      <div className="flex-1 p-4 space-y-3">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <Card className="p-6 text-center">
                <p className="text-red-500">{error}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => runSearch({ ...filters, page: 1 })}
                >
                  <Search className="h-4 w-4 mr-2" />
                  {isHebrew ? "נסה שוב" : "Try again"}
                </Button>
              </Card>
            )}

            {/* Empty state */}
            {!loading && !error && data && results.length === 0 && (
              <Card className="p-10 text-center">
                <Search className="h-10 w-10 text-zinc-300 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">
                  {isHebrew ? "לא נמצאו ספקים" : "No providers found"}
                </h3>
                <p className="text-zinc-500 text-sm mb-6">
                  {isHebrew
                    ? "נסה להרחיב את הרדיוס, להסיר פילטר, או לשנות תאריכים."
                    : "Try widening the radius, removing a filter, or changing dates."}
                </p>
                <div className="flex gap-3 justify-center">
                  {filters.lat && (filters.radiusKm || 15) < 50 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const next = {
                          ...filters,
                          radiusKm: Math.min(50, (filters.radiusKm || 15) + 10),
                          page: 1,
                        };
                        setFilters(next);
                        runSearch(next);
                      }}
                    >
                      {isHebrew ? "הרחב רדיוס" : "Expand radius"}
                    </Button>
                  )}
                  <Button variant="outline" onClick={resetFilters}>
                    {isHebrew ? "אפס פילטרים" : "Reset filters"}
                  </Button>
                </div>
              </Card>
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
              <Card className="p-10 text-center">
                <Search className="h-10 w-10 text-zinc-300 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">
                  {isHebrew ? "מצא ספק לחיית המחמד שלך" : "Find the right provider"}
                </h3>
                <p className="text-zinc-400 text-sm">
                  {isHebrew
                    ? "הכנס מיקום או הפעל GPS כדי לחפש ספקים קרובים."
                    : "Enter a location or enable GPS to find providers near you."}
                </p>
              </Card>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
