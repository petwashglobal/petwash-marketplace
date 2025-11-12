import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';

/**
 * 🌟 WORLD-CLASS GOOGLE PLACES AUTOCOMPLETE 🌟
 * 
 * Premium address autocomplete with instant fill for Israeli and international addresses
 * - Automatic field population (street, city, postal code, country)
 * - Mobile-optimized with large touch targets
 * - Real-time validation and feedback
 * - 7-star UX experience
 */

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string, details?: PlaceDetails) => void;
  onPlaceSelected?: (place: PlaceDetails) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  country?: string[]; // e.g., ['il', 'us'] for Israel and USA
  className?: string;
}

export interface PlaceDetails {
  formattedAddress: string;
  street?: string;
  streetNumber?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

export function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Start typing your address...',
  label,
  error,
  required = false,
  country = ['il'], // Default to Israel
  className = '',
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // Load Google Maps Script
    const loadScript = () => {
      if (window.google && window.google.maps) {
        setScriptLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}&libraries=places&language=en`;
      script.async = true;
      script.defer = true;
      script.onload = () => setScriptLoaded(true);
      script.onerror = () => console.error('[Google Places] Failed to load Google Maps script');
      document.head.appendChild(script);
    };

    loadScript();
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !inputRef.current) return;

    // Initialize Google Places Autocomplete
    try {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: country.length > 0 ? { country } : undefined,
        fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
      });

      // Listen for place selection
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (!place || !place.address_components) {
          console.warn('[Google Places] No place details available');
          return;
        }

        setIsLoading(true);

        // Extract address components
        const details: PlaceDetails = {
          formattedAddress: place.formatted_address || '',
          placeId: place.place_id,
          lat: place.geometry?.location?.lat(),
          lng: place.geometry?.location?.lng(),
        };

        place.address_components.forEach((component) => {
          const types = component.types;

          if (types.includes('street_number')) {
            details.streetNumber = component.long_name;
          }
          if (types.includes('route')) {
            details.street = component.long_name;
          }
          if (types.includes('locality')) {
            details.city = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            details.state = component.long_name;
          }
          if (types.includes('postal_code')) {
            details.postalCode = component.long_name;
          }
          if (types.includes('country')) {
            details.country = component.long_name;
          }
        });

        // Combine street number and street name
        if (details.streetNumber && details.street) {
          details.street = `${details.street} ${details.streetNumber}`;
        }

        console.log('[Google Places] ✅ Address selected:', details);

        // Update parent component
        onChange(details.formattedAddress, details);
        onPlaceSelected?.(details);

        setIsLoading(false);
      });
    } catch (error) {
      console.error('[Google Places] Initialization error:', error);
    }

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [scriptLoaded, onChange, onPlaceSelected, country]);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label htmlFor="google-places-input" className="text-base font-medium">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none z-10" />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500 animate-spin z-10" />
        )}
        <Input
          ref={inputRef}
          id="google-places-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`
            pl-12 pr-12 py-6 text-base
            min-h-[56px]
            rounded-xl
            border-2
            focus:ring-2 focus:ring-blue-500
            transition-all
            ${error ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}
            ${isLoading ? 'bg-blue-50' : 'bg-white'}
          `}
          required={required}
          autoComplete="off"
          data-testid="input-google-places-autocomplete"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
          <span className="font-medium">⚠️</span> {error}
        </p>
      )}
      {!error && !isLoading && value && (
        <p className="text-sm text-gray-500 mt-1">
          ✅ Start typing to see suggestions. Your address will auto-fill instantly.
        </p>
      )}
    </div>
  );
}

/**
 * Hook for programmatic access to Google Places API
 */
export function useGooglePlaces() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}&libraries=places&language=en`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);
  }, []);

  return { isLoaded };
}
