import { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';
import { getApiUrl } from '@/lib/apiConfig';

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [apartment, setApartment] = useState('');
  const [postalCode, setPostalCodeState] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showManualHint, setShowManualHint] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const consecutiveFailures = useRef(0);
  const MAX_CONSECUTIVE_FAILURES = 5;
  const sessionTokenRef = useRef<string>(generateSessionToken());

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPredictions = useCallback(async (input: string) => {
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
      setShowDropdown(cached.predictions.length > 0);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setIsLoading(true);
    try {
      const params = new URLSearchParams({ input });
      if (components) params.append('components', components);
      if (types && types.length > 0) params.append('types', types.join('|'));

      const lang = document.documentElement.lang === 'he' ? 'iw' : 'en';
      params.append('language', lang);

      const response = await fetch(getApiUrl(`/api/google/places-autocomplete?${params}`), {
        signal: abortRef.current.signal,
        credentials: 'include',
        headers: { 'x-places-session': sessionTokenRef.current },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[Places] Autocomplete error', {
          status: response.status,
          reasonCode: errorData.reasonCode,
          googleStatus: errorData.googleStatus,
          traceId: errorData.traceId,
        });
        consecutiveFailures.current++;
        if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES) setShowManualHint(true);
        setPredictions([]);
        setShowDropdown(false);
        return;
      }

      const data = await response.json();
      const preds: AutocompletePrediction[] = data.predictions || [];
      consecutiveFailures.current = 0;
      setShowManualHint(false);
      setPredictions(preds);
      setShowDropdown(preds.length > 0);

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
  }, [country, types]);

  const selectPrediction = useCallback(async (prediction: AutocompletePrediction) => {
    setShowDropdown(false);
    setPredictions([]);
    setIsLoading(true);

    try {
      const lang = document.documentElement.lang === 'he' ? 'iw' : 'en';
      const params = new URLSearchParams({
        placeId: prediction.placeId,
        language: lang,
      });
      const currentSessionToken = sessionTokenRef.current;
      const response = await fetch(getApiUrl(`/api/google/places-details?${params}`), {
        credentials: 'include',
        headers: { 'x-places-session': currentSessionToken },
      });
      sessionTokenRef.current = generateSessionToken();

      if (!response.ok) {
        throw new Error(`Details fetch failed: ${response.status}`);
      }

      const data = await response.json();

      const details: PlaceDetails = {
        formattedAddress: data.formattedAddress || prediction.description,
        street: data.street,
        streetNumber: data.streetNumber,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        countryCode: data.countryCode,
        lat: data.lat,
        lng: data.lng,
        placeId: prediction.placeId,
      };

      if (details.streetNumber && details.street) {
        details.street = `${details.street} ${details.streetNumber}`;
      }

      setSelectedPlace(details);
      setApartment('');
      setPostalCodeState(details.postalCode || '');
      onChange(details.formattedAddress, details);
      onPlaceSelected?.(details);
    } catch (err: any) {
      console.warn('[Places] Details error:', err.message);
      const fallback: PlaceDetails = {
        formattedAddress: prediction.description,
        placeId: prediction.placeId,
      };
      setSelectedPlace(fallback);
      onChange(prediction.description, fallback);
      onPlaceSelected?.(fallback);
    } finally {
      setIsLoading(false);
    }
  }, [onChange, onPlaceSelected]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setSelectedPlace(null);
    if (!val) {
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

  const emitUpdatedDetails = useCallback((base: PlaceDetails, apt: string, zip: string) => {
    const updated: PlaceDetails = {
      ...base,
      apartment: apt || undefined,
      postalCode: zip || base.postalCode,
    };
    let fullAddr = base.formattedAddress;
    if (apt) fullAddr = `${fullAddr}, ${apt}`;
    updated.formattedAddress = fullAddr;
    onChange(fullAddr, updated);
    onPlaceSelected?.(updated);
  }, [onChange, onPlaceSelected]);

  const handleApartmentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApartment(val);
    if (selectedPlace) emitUpdatedDetails(selectedPlace, val, postalCode);
  }, [selectedPlace, postalCode, emitUpdatedDetails]);

  const handlePostalCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPostalCodeState(val);
    if (selectedPlace) emitUpdatedDetails(selectedPlace, apartment, val);
  }, [selectedPlace, apartment, emitUpdatedDetails]);

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
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) setShowDropdown(true);
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

        {showDropdown && predictions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-[99999] left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 max-h-[260px] overflow-y-auto"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {predictions.map((pred, idx) => (
              <button
                key={pred.placeId}
                type="button"
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-gray-50 last:border-b-0 ${
                  idx === highlightIndex
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => selectPrediction(pred)}
                onMouseEnter={() => setHighlightIndex(idx)}
                style={{ minHeight: '48px', touchAction: 'manipulation' }}
              >
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">
                    {pred.mainText || pred.description}
                  </div>
                  {pred.secondaryText && (
                    <div className="text-xs text-gray-500 truncate">
                      {pred.secondaryText}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showExtraFields && selectedPlace && (
        <div className="mt-2 space-y-3">
          <div className="flex flex-wrap gap-2">
            {selectedPlace.street && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                🏠 {selectedPlace.street}
              </span>
            )}
            {selectedPlace.city && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                🏙️ {selectedPlace.city}
              </span>
            )}
            {(postalCode || selectedPlace.postalCode) && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                📮 {postalCode || selectedPlace.postalCode}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium text-gray-600 mb-1 block">
                {apartmentLabel || 'דירה / קומה / יחידה'}
              </Label>
              <Input
                type="text"
                value={apartment}
                onChange={handleApartmentChange}
                placeholder={apartmentPlaceholder || 'לדוג׳ דירה 3, קומה 2, כניסה א׳'}
                className="px-3 py-3 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 min-h-[44px] touch-manipulation"
                style={{ fontSize: '16px' }}
                autoComplete="off"
                dir="rtl"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600 mb-1 block">
                {postalCodeLabel || 'מיקוד'}
              </Label>
              <Input
                type="text"
                value={postalCode}
                onChange={handlePostalCodeChange}
                placeholder={postalCodePlaceholder || 'לדוג׳ 6291302'}
                className="px-3 py-3 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 min-h-[44px] touch-manipulation"
                style={{ fontSize: '16px' }}
                autoComplete="off"
                dir="ltr"
              />
            </div>
          </div>
        </div>
      )}

      {showManualHint && value.length >= 3 ? (
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
