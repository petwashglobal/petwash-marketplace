import { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';

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
  showExtraFields = false,
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
  const [proxyStatus, setProxyStatus] = useState<'ok' | 'degraded' | 'unknown'>('unknown');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);

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

      const response = await fetch(`/api/google/places-autocomplete?${params}`, {
        signal: abortRef.current.signal,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[Places Proxy] Autocomplete failed', {
          status: response.status,
          error: errorData.error,
          googleStatus: errorData.googleStatus,
        });
        setProxyStatus('degraded');
        setPredictions([]);
        setShowDropdown(false);
        return;
      }

      const data = await response.json();
      const preds: AutocompletePrediction[] = data.predictions || [];
      setProxyStatus('ok');
      setPredictions(preds);
      setShowDropdown(preds.length > 0);

      queryCache.set(cacheKey, { predictions: preds, ts: Date.now() });
      pruneCache();
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('[Places Proxy] Network error', err.message);
      setProxyStatus('degraded');
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
      const response = await fetch(`/api/google/places-details?${params}`, {
        credentials: 'include',
      });

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
      console.warn('[Places Proxy] Details error:', err.message);
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
    if (!val) {
      setSelectedPlace(null);
      setApartment('');
      setPostalCodeState('');
      setPredictions([]);
      setShowDropdown(false);
    }
    setHighlightIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchPredictions(val);
    }, 250);
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
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <Label className="text-sm font-medium text-gray-600 mb-1 block">
              {apartmentLabel || 'Apt / Unit / Floor'}
            </Label>
            <Input
              type="text"
              value={apartment}
              onChange={handleApartmentChange}
              placeholder={apartmentPlaceholder || 'e.g. Apt 4, Floor 2'}
              className="px-3 py-3 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 min-h-[44px] touch-manipulation"
              style={{ fontSize: '16px' }}
              autoComplete="off"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600 mb-1 block">
              {postalCodeLabel || 'Postal Code'}
            </Label>
            <Input
              type="text"
              value={postalCode}
              onChange={handlePostalCodeChange}
              placeholder={postalCodePlaceholder || 'e.g. 6100000'}
              className="px-3 py-3 text-sm rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 min-h-[44px] touch-manipulation"
              style={{ fontSize: '16px' }}
              autoComplete="off"
            />
          </div>
        </div>
      )}

      {showExtraFields && selectedPlace && (
        <div className="flex flex-wrap gap-2 mt-1">
          {selectedPlace.street && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              {selectedPlace.street}
            </span>
          )}
          {selectedPlace.city && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
              {selectedPlace.city}
            </span>
          )}
          {selectedPlace.country && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
              {selectedPlace.country}
            </span>
          )}
        </div>
      )}

      {proxyStatus === 'degraded' && !error && (
        <p className="text-xs text-amber-600 mt-1">
          Address suggestions temporarily unavailable. You can type your address manually.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

export function useGooglePlaces() {
  return { isLoaded: true };
}

let googleMapsLoadPromise: Promise<void> | null = null;

export function loadGoogleMapsScript(language?: string, region?: string): Promise<void> {
  if (typeof window !== 'undefined' && window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  const lang = language || 'he';
  const reg = region || 'IL';

  googleMapsLoadPromise = new Promise<void>(async (resolve, reject) => {
    let apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
      try {
        const resp = await fetch('/api/config/google-maps', { credentials: 'include' });
        if (resp.ok) {
          const data = await resp.json();
          if (data.apiKey) apiKey = data.apiKey;
        }
      } catch { /* ignore */ }
    }
    if (!apiKey) {
      googleMapsLoadPromise = null;
      reject(new Error('No API key'));
      return;
    }

    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing && window.google?.maps?.places) {
      resolve();
      return;
    }
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&language=${lang}&region=${reg}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const check = (attempts = 0) => {
        if (window.google?.maps?.places) resolve();
        else if (attempts > 100) { googleMapsLoadPromise = null; reject(new Error('Places API not available')); }
        else setTimeout(() => check(attempts + 1), 50);
      };
      check();
    };
    script.onerror = () => { googleMapsLoadPromise = null; reject(new Error('Failed to load Google Maps script')); };
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}
