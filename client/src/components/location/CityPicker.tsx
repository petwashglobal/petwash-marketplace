/**
 * PR-LOCATION-CITY-PICKER-1 — Israel city picker.
 *
 * Controlled mobile-first bottom-sheet selector backed by the
 * shared/data/israel-cities.ts dataset. The picker is the
 * single canonical UI for selecting a citySymbol everywhere
 * in the app. It returns { citySymbol, hebrewName, englishName }
 * to the parent and never writes anything itself.
 *
 * Hard rules (docs/location/PROGRAM.md):
 *   §1.2  citySymbol is the canonical key. The picker NEVER
 *         returns a free-text city.
 *   §1.4  No free-text city save.
 *   §1.12 No live Google Places / geocoding. The picker reads
 *         the baked dataset only.
 *   §3.4  Hebrew + English search; popular cities first; no IP
 *         / browser geolocation auto-fill.
 *
 * Mobile UX:
 *   - Radix Sheet (side="bottom") so the picker takes the full
 *     bottom half on mobile and a centred drawer on larger
 *     screens.
 *   - 100dvh-safe (Sheet uses the dvh-aware viewport math).
 *   - 44px+ touch targets on every interactive row.
 *   - dir="rtl" + textDir="rtl" for Hebrew users.
 *   - overscroll-behavior: contain on the scrollable list so
 *     iOS Safari does not bounce the parent page.
 *
 * NOT in this PR (PROGRAM.md §1.1 — one PR one purpose):
 *   - Wiring into the user profile form (PR-LOCATION-PROFILES-1)
 *   - Wiring into the booking form  (PR-BOOKINGS-CITY-SEARCH-1)
 *   - Wiring into provider onboarding (PR-PROVIDER-SERVICE-AREAS-1)
 *   - Match engine, schema, DB, audit, payment, auth.
 */

import * as React from "react";
import { X, Search } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  filterIsraelCities,
  popularCitiesForPicker,
  displayName,
  secondaryName,
  toSelection,
  CITY_PICKER_VERSION,
  type CityPickerSelection,
  type PickerLanguage,
} from "./cityPickerHelpers";

// Re-export the selection type and language type so callers
// can import everything from one place.
export type { CityPickerSelection, PickerLanguage } from "./cityPickerHelpers";

/**
 * Picker props. The component is fully controlled — parent
 * owns the open/closed state AND the selected citySymbol so
 * the picker stays a pure UI surface (no internal storage).
 */
export interface CityPickerProps {
  /**
   * Whether the picker sheet is currently open. Parent owns
   * this state; the picker calls onOpenChange when the user
   * dismisses the sheet (overlay tap, Esc, close button).
   */
  open: boolean;
  /** Notified when the sheet opens or closes. */
  onOpenChange: (open: boolean) => void;
  /**
   * The currently selected citySymbol, if any. Used only to
   * highlight the matching row in the list. null means "no
   * city picked yet".
   */
  value?: string | null;
  /**
   * Called with the selected city when the user picks a row.
   * The picker DOES NOT close itself — parent decides whether
   * to dismiss (typical pattern: setOpen(false) inside the
   * onChange handler).
   */
  onChange: (selection: CityPickerSelection) => void;
  /** UI language. Defaults to Hebrew (the platform's primary). */
  language?: PickerLanguage;
  /**
   * Override the visible title. Defaults to a translated
   * "Select your city" line.
   */
  title?: string;
  /**
   * Optional extra className on the SheetContent. The picker
   * sets its own height + padding; callers can layer on
   * brand-specific styling without forking the component.
   */
  className?: string;
  /** Optional override of the search-result list cap. */
  resultLimit?: number;
}

const DEFAULT_TITLE: Record<PickerLanguage, string> = {
  en: "Select your city",
  he: "בחר עיר",
};

const SEARCH_PLACEHOLDER: Record<PickerLanguage, string> = {
  en: "Search cities…",
  he: "חיפוש ערים…",
};

const POPULAR_HEADING: Record<PickerLanguage, string> = {
  en: "Popular cities",
  he: "ערים מובילות",
};

const EMPTY_HEADING: Record<PickerLanguage, string> = {
  en: "No cities match",
  he: "לא נמצאו ערים תואמות",
};

const EMPTY_HINT: Record<PickerLanguage, string> = {
  en: "Try a different spelling or shorter query.",
  he: "נסה איות אחר או חיפוש קצר יותר.",
};

const RESULT_CAP_HINT: Record<PickerLanguage, string> = {
  en: "Showing first matches. Refine to narrow.",
  he: "מוצגות התאמות ראשונות. צמצמו את החיפוש להמשך.",
};

export function CityPicker({
  open,
  onOpenChange,
  value,
  onChange,
  language = "he",
  title,
  className,
  resultLimit,
}: CityPickerProps): JSX.Element {
  const [query, setQuery] = React.useState("");

  // Reset the query whenever the sheet closes so a re-open
  // shows the popular list. Mirrors typical iOS sheet UX.
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const rtl = language === "he";
  const dir: "rtl" | "ltr" = rtl ? "rtl" : "ltr";

  const popular = React.useMemo(() => popularCitiesForPicker(), []);
  const results = React.useMemo(
    () => filterIsraelCities(query, language, resultLimit),
    [query, language, resultLimit],
  );

  const isPopularState = query.trim().length === 0;
  const showResultCapHint =
    !isPopularState &&
    typeof resultLimit !== "undefined" &&
    results.length === resultLimit;

  const handlePick = React.useCallback(
    (citySymbol: string) => {
      const all = popular; // popular always contains the value if it's a popular one
      // Search the full filtered set first; fall back to popular.
      const fromResults = results.find((c) => c.citySymbol === citySymbol);
      const fromPopular = all.find((c) => c.citySymbol === citySymbol);
      const city = fromResults || fromPopular;
      if (city) onChange(toSelection(city));
    },
    [results, popular, onChange],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        dir={dir}
        data-testid="city-picker-sheet"
        data-city-picker-version={CITY_PICKER_VERSION}
        className={cn(
          // Full-screen on mobile, comfortable height on tablet+
          "h-[100dvh] sm:h-[85dvh] sm:max-h-[720px]",
          // Respect iPhone safe area (notch + home indicator)
          "pt-[max(env(safe-area-inset-top),1rem)]",
          "pb-[max(env(safe-area-inset-bottom),1rem)]",
          "flex flex-col gap-3 p-0 bg-white",
          className,
        )}
      >
        {/* Header */}
        <SheetHeader className="px-4 pt-2 pb-1 text-start">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle
              className={cn(
                "text-lg font-semibold",
                rtl ? "text-right" : "text-left",
              )}
              data-testid="city-picker-title"
            >
              {title || DEFAULT_TITLE[language]}
            </SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={rtl ? "סגור" : "Close"}
              data-testid="city-picker-close"
              className={cn(
                "inline-flex items-center justify-center",
                "min-h-[44px] min-w-[44px] rounded-full",
                "text-gray-600 hover:bg-gray-100 active:bg-gray-200",
                "focus:outline-none focus:ring-2 focus:ring-gray-400",
              )}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </SheetHeader>

        {/* Search */}
        <div className="px-4">
          <div className="relative">
            <Search
              className={cn(
                "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none",
                rtl ? "right-3" : "left-3",
              )}
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={SEARCH_PLACEHOLDER[language]}
              textDir={rtl ? "rtl" : "ltr"}
              inputMode="search"
              autoComplete="off"
              aria-label={SEARCH_PLACEHOLDER[language]}
              data-testid="city-picker-search"
              className={cn(
                "min-h-[44px]",
                rtl ? "pr-9 pl-3 text-right" : "pl-9 pr-3 text-left",
              )}
            />
          </div>
        </div>

        {/* Section heading (popular vs results) */}
        <div
          className={cn(
            "px-4 text-xs font-medium uppercase tracking-wide text-gray-500",
            rtl ? "text-right" : "text-left",
          )}
          data-testid="city-picker-section-heading"
        >
          {isPopularState ? POPULAR_HEADING[language] : null}
        </div>

        {/* Scrollable list */}
        <ul
          role="listbox"
          aria-label={title || DEFAULT_TITLE[language]}
          data-testid="city-picker-list"
          className={cn(
            "flex-1 overflow-y-auto",
            // iOS smooth-scroll + no parent bounce
            "[-webkit-overflow-scrolling:touch] [overscroll-behavior:contain]",
            "divide-y divide-gray-100",
          )}
        >
          {results.length === 0 ? (
            <li
              className="px-4 py-10 text-center text-sm text-gray-600"
              data-testid="city-picker-empty"
            >
              <div className="font-medium">{EMPTY_HEADING[language]}</div>
              <div className="mt-1 text-gray-500">{EMPTY_HINT[language]}</div>
            </li>
          ) : (
            results.map((city) => {
              const isSelected = value === city.citySymbol;
              const primary = displayName(city, language);
              const secondary = secondaryName(city, language);
              return (
                <li key={city.citySymbol}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handlePick(city.citySymbol)}
                    data-testid={`city-picker-row-${city.citySymbol}`}
                    data-city-symbol={city.citySymbol}
                    className={cn(
                      "w-full min-h-[44px] px-4 py-3",
                      "flex items-center justify-between gap-3",
                      rtl ? "text-right" : "text-left",
                      "hover:bg-gray-50 active:bg-gray-100",
                      "focus:outline-none focus:bg-gray-50",
                      isSelected && "bg-gray-50",
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="text-base font-medium text-gray-900">
                        {primary}
                      </span>
                      {secondary ? (
                        <span className="text-sm text-gray-500">
                          {secondary}
                        </span>
                      ) : null}
                    </div>
                    {isSelected ? (
                      <span
                        aria-hidden="true"
                        className="text-xs font-semibold text-gray-700"
                      >
                        ✓
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
          {showResultCapHint ? (
            <li
              className="px-4 py-3 text-center text-xs text-gray-500"
              data-testid="city-picker-cap-hint"
            >
              {RESULT_CAP_HINT[language]}
            </li>
          ) : null}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
