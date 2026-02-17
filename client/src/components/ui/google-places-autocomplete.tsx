import { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiUrl } from '@/lib/apiConfig';

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
  language?: string;
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
  lat?: number;
  lng?: number;
  placeId?: string;
}

let googleMapsLoadPromise: Promise<void> | null = null;
let googleMapsLoadedLanguage: string | null = null;

function getDocumentLanguage(): string {
  const htmlLang = document.documentElement.lang;
  if (htmlLang) return htmlLang.substring(0, 2);
  const stored = localStorage.getItem('pw_lang') || localStorage.getItem('language');
  if (stored) return stored;
  return 'iw';
}

function loadGoogleMapsScript(lang?: string): Promise<void> {
  const requestedLang = lang || getDocumentLanguage();
  const mapsLang = requestedLang === 'he' ? 'iw' : requestedLang;

  if (window.google && window.google.maps && window.google.maps.places) {
    if (googleMapsLoadedLanguage && googleMapsLoadedLanguage !== mapsLang) {
      const oldScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (oldScript) oldScript.remove();
      delete (window as any).google;
      googleMapsLoadPromise = null;
      googleMapsLoadedLanguage = null;
    } else {
      return Promise.resolve();
    }
  }

  if (googleMapsLoadPromise && googleMapsLoadedLanguage === mapsLang) {
    return googleMapsLoadPromise;
  }

  googleMapsLoadPromise = new Promise<void>(async (resolve, reject) => {
    let apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
      try {
        const response = await fetch(getApiUrl('/api/config/google-maps'));
        if (response.ok) {
          const data = await response.json();
          apiKey = data.apiKey || '';
        }
      } catch (e) {
        console.error('[Google Places] Failed to fetch API key from server');
      }
    }

    if (!apiKey) {
      console.error('[Google Places] No API key configured');
      googleMapsLoadPromise = null;
      reject(new Error('No API key'));
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      const check = () => {
        if (window.google && window.google.maps && window.google.maps.places) {
          googleMapsLoadedLanguage = mapsLang;
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=${mapsLang}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const check = () => {
        if (window.google && window.google.maps && window.google.maps.places) {
          googleMapsLoadedLanguage = mapsLang;
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    };
    script.onerror = () => {
      googleMapsLoadPromise = null;
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

function injectPacStyles() {
  const styleId = 'google-pac-mobile-fix';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .pac-container {
      z-index: 99999 !important;
      background-color: #fff !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15) !important;
      border: 1px solid #e5e7eb !important;
      margin-top: 4px !important;
      padding: 4px 0 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      max-height: 260px !important;
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch !important;
    }
    .pac-item {
      padding: 12px 16px !important;
      font-size: 15px !important;
      line-height: 1.4 !important;
      cursor: pointer !important;
      border-top: 1px solid #f3f4f6 !important;
      min-height: 48px !important;
      display: flex !important;
      align-items: center !important;
      -webkit-tap-highlight-color: transparent !important;
      touch-action: manipulation !important;
    }
    .pac-item:first-child {
      border-top: none !important;
    }
    .pac-item:hover,
    .pac-item:active,
    .pac-item.pac-item-selected {
      background-color: #f8f9fa !important;
    }
    .pac-item-query {
      font-size: 15px !important;
      font-weight: 500 !important;
      color: #1f2937 !important;
    }
    .pac-item span:last-child {
      font-size: 13px !important;
      color: #6b7280 !important;
    }
    .pac-icon {
      display: none !important;
    }
    .pac-logo::after {
      display: none !important;
    }
    @media (max-width: 768px) {
      .pac-container {
        position: fixed !important;
        left: 8px !important;
        right: 8px !important;
        width: auto !important;
        max-height: 200px !important;
      }
      .pac-item {
        padding: 14px 16px !important;
        min-height: 52px !important;
        font-size: 16px !important;
      }
    }
  `;
  document.head.appendChild(style);
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
  language,
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isReady, setIsReady] = useState(false);
  const isSelectingRef = useRef(false);
  const skipNextOnChangeRef = useRef(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [apartment, setApartment] = useState('');
  const [postalCode, setPostalCode] = useState('');

  useEffect(() => {
    injectPacStyles();
    loadGoogleMapsScript(language)
      .then(() => setIsReady(true))
      .catch(() => {});
  }, [language]);

  const emitUpdatedDetails = useCallback((base: PlaceDetails, apt: string, zip: string) => {
    const updated: PlaceDetails = {
      ...base,
      apartment: apt || undefined,
      postalCode: zip || base.postalCode,
    };
    let fullAddr = base.formattedAddress;
    if (apt) {
      fullAddr = `${fullAddr}, ${apt}`;
    }
    updated.formattedAddress = fullAddr;
    onChange(fullAddr, updated);
    onPlaceSelected?.(updated);
  }, [onChange, onPlaceSelected]);

  const handlePlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();

    if (!place?.address_components && !place?.formatted_address && !place?.name) {
      return;
    }

    isSelectingRef.current = true;

    if (!place.address_components) {
      const addr = place.formatted_address || place.name || '';
      const basicDetails: PlaceDetails = {
        formattedAddress: addr,
        placeId: place.place_id,
        lat: place.geometry?.location?.lat(),
        lng: place.geometry?.location?.lng(),
      };
      skipNextOnChangeRef.current = true;
      setSelectedPlace(basicDetails);
      setApartment('');
      setPostalCode('');
      onChange(addr, basicDetails);
      onPlaceSelected?.(basicDetails);
      isSelectingRef.current = false;
      return;
    }

    const details: PlaceDetails = {
      formattedAddress: place.formatted_address || '',
      placeId: place.place_id,
      lat: place.geometry?.location?.lat(),
      lng: place.geometry?.location?.lng(),
    };

    place.address_components.forEach((component) => {
      const t = component.types;
      if (t.includes('street_number')) details.streetNumber = component.long_name;
      if (t.includes('route')) details.street = component.long_name;
      if (t.includes('subpremise')) details.apartment = component.long_name;
      if (t.includes('locality')) details.city = component.long_name;
      if (t.includes('sublocality_level_1') && !details.city) details.city = component.long_name;
      if (t.includes('administrative_area_level_1')) details.state = component.long_name;
      if (t.includes('postal_code')) details.postalCode = component.long_name;
      if (t.includes('country')) details.country = component.long_name;
    });

    if (details.streetNumber && details.street) {
      details.street = `${details.street} ${details.streetNumber}`;
    }

    skipNextOnChangeRef.current = true;
    setSelectedPlace(details);
    setApartment(details.apartment || '');
    setPostalCode(details.postalCode || '');
    onChange(details.formattedAddress, details);
    onPlaceSelected?.(details);
    isSelectingRef.current = false;
  }, [onChange, onPlaceSelected]);

  useEffect(() => {
    if (!isReady || !inputRef.current) return;

    if (autocompleteRef.current) {
      google.maps.event.clearInstanceListeners(autocompleteRef.current);
      autocompleteRef.current = null;
    }

    try {
      const options: google.maps.places.AutocompleteOptions = {
        componentRestrictions: country.length > 0 ? { country } : undefined,
        fields: ['address_components', 'formatted_address', 'geometry', 'place_id', 'name'],
      };

      if (types && types.length > 0) {
        options.types = types;
      } else {
        options.types = ['address'];
      }

      const ac = new google.maps.places.Autocomplete(inputRef.current, options);

      ac.addListener('place_changed', handlePlaceChanged);
      autocompleteRef.current = ac;

      const form = inputRef.current.closest('form');
      if (form) {
        const preventSubmit = (e: Event) => {
          if (isSelectingRef.current) {
            e.preventDefault();
          }
        };
        form.addEventListener('submit', preventSubmit);
        return () => {
          form.removeEventListener('submit', preventSubmit);
          if (autocompleteRef.current) {
            google.maps.event.clearInstanceListeners(autocompleteRef.current);
          }
        };
      }
    } catch (err) {
      console.error('[Google Places] Init error:', err);
    }

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isReady, country.join(','), handlePlaceChanged]);

  useEffect(() => {
    if (!inputRef.current) return;
    if (skipNextOnChangeRef.current) {
      skipNextOnChangeRef.current = false;
      if (inputRef.current.value === value) return;
    }
    if (inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (!e.target.value) {
      setSelectedPlace(null);
      setApartment('');
      setPostalCode('');
    }
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const pacContainer = document.querySelector('.pac-container');
      if (pacContainer && pacContainer.querySelectorAll('.pac-item').length > 0) {
        e.preventDefault();
      }
    }
  }, []);

  const handleApartmentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApartment(val);
    if (selectedPlace) {
      emitUpdatedDetails(selectedPlace, val, postalCode);
    }
  }, [selectedPlace, postalCode, emitUpdatedDetails]);

  const handlePostalCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPostalCode(val);
    if (selectedPlace) {
      emitUpdatedDetails(selectedPlace, apartment, val);
    }
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
          defaultValue={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
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

      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

export function useGooglePlaces() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setIsLoaded(true))
      .catch(() => {});
  }, []);

  return { isLoaded };
}
