import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';
import { getApiUrl } from '@/lib/apiConfig';
// PR-LOCATION-GUARD-PLACES-1: client-side echo of the server
// gate. When the flag is OFF we skip the network call entirely
// and let the user type freely. The server is the authoritative
// gate; this check just avoids an unnecessary 503 round-trip.

function generateSessionToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string, details?: PlaceDetails) => void;
  onPlaceSelected?: (place: PlaceDetails) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  country?: string[];
  className?: string;
  inputClassName?: string;
  showExtraFields?: boolean;
  apartmentLabel?: string;
  postalCodeLabel?: string;
  apartmentPlaceholder?: string;
  postalCodePlaceholder?: string;
  types?: string[];
  darkMode?: boolean;
}

export interface PlaceDetails {
  formattedAddress: string;
  street?: string;
  streetNumber?: string;
  apartment?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

interface AutocompletePrediction {
  placeId: string;
  description: string;
  mainText?: string;
  secondaryText?: string;
  // 2026-06-18: free OSM/Nominatim returns coordinates + parsed parts inline, so no
  // second "place details" round-trip is needed.
  lat?: number;
  lng?: number;
  city?: string;
  postalCode?: string;
  countryCode?: string;
}

const queryCache = new Map<string, { predictions: AutocompletePrediction[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE = 30;

function pruneCache() {
  if (queryCache.size <= MAX_CACHE) return;
  const entries = [...queryCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
  while (queryCache.size > MAX_CACHE) {
    const oldest = entries.shift();
    if (oldest) queryCache.delete(oldest[0]);
  }
}

interface DropdownRect {
  top: number;
  left: number;
  width: number;
}

export function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Start typing your address...',
  label,
  error,
  required = false,
  country = ['il'],
  className = '',
  inputClassName,
  showExtraFields = true,
  apartmentLabel,
  postalCodeLabel,
  apartmentPlaceholder,
  postalCodePlaceholder,
  types,
  darkMode = false,
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<DropdownRect | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [buildingNumber, setBuildingNumber] = useState('');
  const [apartment, setApartment] = useState('');
  const [postalCode, setPostalCodeState] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showManualHint, setShowManualHint] = useState(false);
  // PR-B P0 fix: surface critical service errors (503 / 403) immediately
  // instead of waiting for MAX_CONSECUTIVE_FAILURES. A 503 means the API
  // key is unset on Cloud Run; a 403 means the origin allowlist rejected
  // this client. Either way, the user should see an actionable message
  // right away — silent failure is the production blocker we are fixing.
  const [serviceErrorMessage, setServiceErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const consecutiveFailures = useRef(0);
  const MAX_CONSECUTIVE_FAILURES = 5;
  const sessionTokenRef = useRef<string>(generateSessionToken());
  // Prevents the click-outside handler from firing during a selection
  const selectingRef = useRef(false);

  // Position the portaled dropdown right under the input.
  // iOS-SAFARI FIX 2026-06-18: when the soft keyboard opens, the layout/visual
  // viewports diverge and `window.scrollY` no longer reflects the on-screen offset,
  // so the dropdown floated away from the field. Anchor to the visualViewport offset
  // when available, and re-position on visualViewport resize/scroll (the events iOS
  // actually fires when the keyboard opens) — not just window resize/scroll.
  const updateDropdownPosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const vv = (typeof window !== 'undefined' ? window.visualViewport : null);
    const offsetTop = vv ? vv.offsetTop : 0;
    const offsetLeft = vv ? vv.offsetLeft : 0;
    setDropdownRect({
      top: rect.bottom + window.scrollY + offsetTop,
      left: rect.left + window.scrollX + offsetLeft,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    const vv = (typeof window !== 'undefined' ? window.visualViewport : null);
    vv?.addEventListener('resize', updateDropdownPosition);
    vv?.addEventListener('scroll', updateDropdownPosition);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
      vv?.removeEventListener('resize', updateDropdownPosition);
      vv?.removeEventListener('scroll', updateDropdownPosition);
    };
  }, [showDropdown, updateDropdownPosition]);

  useEffect(() => {
    // Use pointerdown — fires for both mouse clicks and touch taps on all devices
    const handlePointerOutside = (e: PointerEvent) => {
      if (selectingRef.current) return;
      if (inputRef.current && inputRef.current.contains(e.target as Node)) return;
      setShowDropdown(false);
    };
    document.addEventListener('pointerdown', handlePointerOutside);
    return () => document.removeEventListener('pointerdown', handlePointerOutside);
  }, []);

  const fetchPredictions = useCallback(async (input: string) => {
    // 2026-06-18: switched from Google Places (broken in prod / billing) to the FREE
    // OpenStreetMap Nominatim proxy (/api/geocode/suggest). No client flag gate needed.
    if (input.length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES) {
      return;
    }

    const components = country.length > 0
      ? country.map(c => `country:${c}`).join('|')
      : '';
    const cacheKey = `${input}|${components}`;

    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setPredictions(cached.predictions);
      // Always open dropdown when we have a cached response — empty array
      // triggers the "no matches / enter manually" empty state instead of
      // silently hiding the dropdown.
      setShowDropdown(true);
      updateDropdownPosition();
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setIsLoading(true);
    try {
      const lang = (document.documentElement.lang || 'he').slice(0, 2);
      const params = new URLSearchParams({ q: input, lang });

      const response = await fetch(getApiUrl(`/api/geocode/suggest?${params}`), {
        signal: abortRef.current.signal,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[Places] Autocomplete error', {
          status: response.status,
          reasonCode: errorData.reasonCode,
          googleStatus: errorData.googleStatus,
          traceId: errorData.traceId,
        });

        // PR-B P0 fix: distinguish hard service failures (503 / 403) from
        // intermittent Google API issues. Hard failures get an immediate
        // user-visible message; intermittent failures still rely on the
        // existing MAX_CONSECUTIVE_FAILURES → manual-hint fallback.
        if (response.status === 503) {
          setServiceErrorMessage(
            'חיפוש כתובות אינו זמין כעת. ניתן להקליד את הכתובת ידנית.',
          );
          setShowManualHint(true);
        } else if (response.status === 403) {
          setServiceErrorMessage(
            'שירות חיפוש הכתובות חסום מהדפדפן הנוכחי. ניתן להקליד ידנית או לרענן את העמוד.',
          );
          setShowManualHint(true);
        } else {
          consecutiveFailures.current++;
          if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES) {
            setShowManualHint(true);
          }
        }

        setPredictions([]);
        setShowDropdown(false);
        return;
      }

      const data = await response.json();
      const preds: AutocompletePrediction[] = data.predictions || [];
      consecutiveFailures.current = 0;
      setShowManualHint(false);
      setServiceErrorMessage(null);
      setPredictions(preds);
      // Keep the dropdown OPEN even when predictions are empty so the
      // empty-state UI (with "Enter address manually" button) shows.
      // Pre-fix the dropdown collapsed on empty results, which made
      // the user think the field "disappeared" while typing.
      setShowDropdown(true);
      updateDropdownPosition();

      queryCache.set(cacheKey, { predictions: preds, ts: Date.now() });
      pruneCache();
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('[Places] Network error:', err.message);
      consecutiveFailures.current++;
      if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES) setShowManualHint(true);
      setPredictions([]);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  }, [country, types, updateDropdownPosition]);

  const selectPrediction = useCallback(async (prediction: AutocompletePrediction) => {
    setShowDropdown(false);
    setPredictions([]);

    // 2026-06-18: Nominatim returns coordinates + parsed parts inline on the
    // prediction, so we build the address directly — no second round-trip / no Google.
    const details: PlaceDetails = {
      formattedAddress: prediction.description,
      city: prediction.city,
      postalCode: prediction.postalCode,
      countryCode: prediction.countryCode,
      lat: prediction.lat,
      lng: prediction.lng,
      placeId: prediction.placeId,
    };

    setSelectedPlace(details);
    setApartment('');
    setPostalCodeState(details.postalCode || '');
    onChange(details.formattedAddress, details);
    onPlaceSelected?.(details);
    selectingRef.current = false;
  }, [onChange, onPlaceSelected]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setSelectedPlace(null);
    if (!val) {
      setBuildingNumber('');
      setApartment('');
      setPostalCodeState('');
      setPredictions([]);
      setShowDropdown(false);
    }
    setHighlightIndex(-1);

    if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES) {
      consecutiveFailures.current = 0;
      setShowManualHint(false);
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchPredictions(val);
    }, 300);
  }, [onChange, fetchPredictions]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || predictions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (highlightIndex >= 0 && highlightIndex < predictions.length) {
        e.preventDefault();
        selectPrediction(predictions[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }, [showDropdown, predictions, highlightIndex, selectPrediction]);

  const emitUpdatedDetails = useCallback((base: PlaceDetails, bldg: string, apt: string, zip: string) => {
    const updated: PlaceDetails = {
      ...base,
      streetNumber: bldg || base.streetNumber,
      apartment: apt || undefined,
      postalCode: zip || base.postalCode,
    };
    // Rebuild formatted address incorporating building number + apartment + country
    let fullAddr = base.street
      ? `${base.street}${bldg ? ' ' + bldg : ''}${base.city ? ', ' + base.city : ''}${base.country ? ', ' + base.country : ''}`
      : base.formattedAddress;
    if (apt) fullAddr = `${fullAddr}, ${apt}`;
    updated.formattedAddress = fullAddr;
    onChange(fullAddr, updated);
    onPlaceSelected?.(updated);
  }, [onChange, onPlaceSelected]);

  const handleBuildingNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBuildingNumber(val);
    if (selectedPlace) emitUpdatedDetails(selectedPlace, val, apartment, postalCode);
  }, [selectedPlace, apartment, postalCode, emitUpdatedDetails]);

  const handleApartmentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApartment(val);
    if (selectedPlace) emitUpdatedDetails(selectedPlace, buildingNumber, val, postalCode);
  }, [selectedPlace, buildingNumber, postalCode, emitUpdatedDetails]);

  const handlePostalCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPostalCodeState(val);
    if (selectedPlace) emitUpdatedDetails(selectedPlace, buildingNumber, apartment, val);
  }, [selectedPlace, buildingNumber, apartment, emitUpdatedDetails]);

  // Dropdown rendered via portal so it escapes any overflow:hidden parent container.
  // Three states are visible to the user — never a silent "dropdown vanished":
  //   1. Has predictions → list them
  //   2. Typed ≥3 chars but zero predictions → "No matches" empty state with
  //      explicit "Enter address manually" button. Fixes the previous UX where
  //      empty results hid the dropdown entirely and the user thought the
  //      address field was broken ("appears for a second then disappears").
  //   3. Loading → spinner is on the input itself, no dropdown card needed.
  const inputLong = (value || '').trim().length >= 3;
  const showEmptyState = showDropdown && predictions.length === 0 && inputLong && !isLoading;
  const dropdownPortal = (
    (showDropdown && predictions.length > 0 && dropdownRect) ||
    (showEmptyState && dropdownRect)
  )
    ? createPortal(
        <div
          style={{
            position: 'absolute',
            top: dropdownRect!.top + 4,
            left: dropdownRect!.left,
            width: dropdownRect!.width,
            zIndex: 999999,
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
            style={{ WebkitOverflowScrolling: 'touch', maxHeight: '260px', overflowY: 'auto' }}
          >
            {predictions.length > 0 ? (
              predictions.map((pred, idx) => (
                <button
                  key={pred.placeId}
                  type="button"
                  dir="auto"
                  className={`w-full text-start px-4 py-3 flex items-start gap-3 border-b border-gray-50 last:border-b-0 ${
                    idx === highlightIndex ? 'bg-blue-50' : 'active:bg-blue-50'
                  }`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    selectingRef.current = true;
                    selectPrediction(pred);
                  }}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  style={{
                    minHeight: '52px',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 text-sm">
                      {pred.mainText || pred.description}
                    </div>
                    {pred.secondaryText && (
                      <div className="text-xs text-gray-500">
                        {pred.secondaryText}
                      </div>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-4 text-center">
                <div className="text-sm text-gray-600 mb-3">
                  לא נמצאו תוצאות עבור הכתובת. אפשר להזין ידנית.
                  <span className="block text-xs text-gray-400 mt-1 [direction:ltr]">No matches — enter the address manually below.</span>
                </div>
                <button
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setShowDropdown(false);
                    setShowManualHint(true);
                    // Synthesize a placeholder PlaceDetails so the apartment / building / postal
                    // helper fields appear and the parent form unblocks save. The user can edit
                    // every field by hand from here.
                    const manualPlace: PlaceDetails = {
                      formattedAddress: value,
                      street: value,
                      city: '',
                      country: 'Israel',
                      countryCode: 'IL',
                    };
                    setSelectedPlace(manualPlace);
                    onChange(value, manualPlace);
                    onPlaceSelected?.(manualPlace);
                  }}
                >
                  <MapPin className="h-4 w-4" />
                  הזן כתובת ידנית · Enter manually
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label className="text-base font-medium">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          inputMode="text"
          /* RTL 2026-06-18: follow the document direction so Hebrew addresses align
             right and Latin street names still read left — was unset (inconsistent). */
          dir="auto"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) {
              setShowDropdown(true);
              updateDropdownPosition();
            }
          }}
          placeholder={placeholder}
          className={inputClassName || `
            px-4 py-4 sm:py-5 text-base
            min-h-[48px] sm:min-h-[52px]
            rounded-xl
            border-2
            focus:ring-2 focus:ring-blue-500
            transition-all
            ${darkMode ? 'text-white placeholder:text-slate-500 bg-slate-800/50 border-slate-600 caret-white' : 'text-gray-900 placeholder:text-gray-500'}
            touch-manipulation
            ${error ? 'border-red-500 focus:border-red-500' : darkMode ? 'focus:border-amber-500 focus:ring-amber-500/20' : 'border-gray-300 focus:border-blue-500'}
          `}
          style={{
            color: darkMode ? '#ffffff' : '#1f2937',
            WebkitTextFillColor: darkMode ? '#ffffff' : '#1f2937',
            fontSize: '16px',
            WebkitAppearance: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
          required={required}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-form-type="other"
          data-lpignore="true"
          data-testid="input-google-places-autocomplete"
        />

        {isLoading && (
          <div className="absolute top-1/2 right-3 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {dropdownPortal}

      {showExtraFields && selectedPlace && (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-3">
          {/* Confirmed address context — city / area / country */}
          {(selectedPlace.city || selectedPlace.state || selectedPlace.country) && (
            <div className="flex flex-wrap gap-1.5">
              {selectedPlace.city && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white text-green-700 border border-green-200 shadow-sm">
                  🏙️ {selectedPlace.city}
                </span>
              )}
              {selectedPlace.state && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white text-blue-700 border border-blue-200 shadow-sm">
                  📍 {selectedPlace.state}
                </span>
              )}
              {selectedPlace.country && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white text-gray-700 border border-gray-200 shadow-sm">
                  🌍 {selectedPlace.country}
                </span>
              )}
            </div>
          )}

          {/* Editable sub-fields: building no. + unit, then postal code */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-gray-500 mb-1 block uppercase tracking-wide">
                מספר בניין / בית
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                value={buildingNumber}
                onChange={handleBuildingNumberChange}
                placeholder="לדוג׳ 18"
                className="px-3 py-2.5 text-sm rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 min-h-[44px] touch-manipulation bg-white"
                style={{ fontSize: '16px' }}
                autoComplete="off"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 mb-1 block uppercase tracking-wide">
                {apartmentLabel || 'דירה / יחידה'}
              </Label>
              <Input
                type="text"
                value={apartment}
                onChange={handleApartmentChange}
                placeholder={apartmentPlaceholder || 'דירה 3, קומה 2'}
                className="px-3 py-2.5 text-sm rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 min-h-[44px] touch-manipulation bg-white"
                style={{ fontSize: '16px' }}
                autoComplete="off"
                dir="rtl"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-500 mb-1 block uppercase tracking-wide">
              {postalCodeLabel || 'מיקוד (Postal Code)'}
            </Label>
            <Input
              type="text"
              inputMode="numeric"
              value={postalCode}
              onChange={handlePostalCodeChange}
              placeholder={postalCodePlaceholder || 'לדוג׳ 6291302'}
              className="px-3 py-2.5 text-sm rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 min-h-[44px] touch-manipulation bg-white"
              style={{ fontSize: '16px' }}
              autoComplete="off"
              dir="ltr"
            />
          </div>
        </div>
      )}

      {serviceErrorMessage ? (
        <p className="text-xs text-amber-700 mt-1" data-testid="places-service-error">
          {serviceErrorMessage}
        </p>
      ) : showManualHint && value.length >= 3 ? (
        <p className="text-xs text-amber-600 mt-1">
          הצעות כתובת אינן זמינות כעת. ניתן להקליד את הכתובת ידנית.
        </p>
      ) : !selectedPlace ? (
        <p className="text-[10px] text-gray-400 mt-0.5">
          הקלידו לקבלת הצעות אוטומטיות מ-Google
        </p>
      ) : null}

      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

export function useGooglePlaces() {
  return { isLoaded: true };
}
