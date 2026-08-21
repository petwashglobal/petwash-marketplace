import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Home, Briefcase, Clock, Star, Plus, Loader2, Navigation, Building2 } from "lucide-react";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { apiRequest } from "@/lib/queryClient";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import type { UserAddress } from "@shared/schema";
import { CityPicker, type CityPickerSelection } from "@/components/location/CityPicker";
import { findIsraelCityBySymbol } from "@shared/data/israel-cities";

// ── Label config ─────────────────────────────────────────────────────────────
const LABEL_CONFIG: Record<string, { icon: React.ReactNode; text: string; textHe: string }> = {
  home:  { icon: <Home className="w-4 h-4" />,      text: "Home",    textHe: "בית"    },
  work:  { icon: <Briefcase className="w-4 h-4" />, text: "Work",    textHe: "עבודה"  },
  other: { icon: <Clock className="w-4 h-4" />,     text: "Recent",  textHe: "אחרון"  },
  custom:{ icon: <Star className="w-4 h-4" />,      text: "Saved",   textHe: "שמור"   },
};

export interface AddressPickerProps {
  value: string;
  onChange: (value: string, details?: PlaceDetails) => void;
  onPlaceSelected?: (place: PlaceDetails) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  autoSave?: boolean;           // auto-save chosen address to history
  showSavedList?: boolean;      // show the saved addresses list (default true)
  isHebrew?: boolean;
  required?: boolean;
  error?: string;
  country?: string[];           // 2026-06-18: overridable (was hardcoded ['IL'])
  autoSelectDefault?: boolean;  // auto-fill the pinned default address (off for e.g. a drop-off field)
  // Show a "Choose city" chip that opens the mapped Israeli-city sheet (shared/data/israel-cities.ts).
  // On pick, seeds the Google Places search input with the city so the free-text autocomplete
  // is biased to that locality. Off by default so existing consumers don't change.
  showCitySuggestion?: boolean;
}

export function AddressPicker({
  value,
  onChange,
  onPlaceSelected,
  label,
  placeholder,
  className = "",
  autoSave = true,
  showSavedList = true,
  isHebrew = true,
  required,
  error,
  country = ["il"],
  autoSelectDefault = true,
  showCitySuggestion = false,
}: AddressPickerProps) {
  const { user } = useFirebaseAuth();
  const queryClient = useQueryClient();
  const [geoLoading, setGeoLoading] = useState(false);
  const [showNew, setShowNew] = useState(!value);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [pickedCitySymbol, setPickedCitySymbol] = useState<string | null>(null);
  const [pickedCityLabel, setPickedCityLabel] = useState<string | null>(null);

  // ── Saved addresses ───────────────────────────────────────────────────────
  const { data: savedAddresses = [] } = useQuery<UserAddress[]>({
    queryKey: ["/api/user/addresses"],
    enabled: !!user?.uid && showSavedList,
  });

  // ── Save address mutation ─────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (payload: Partial<UserAddress> & { address: string }) =>
      apiRequest("POST", "/api/user/addresses", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/user/addresses"] }),
  });

  // ── Delete saved address ──────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/user/addresses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/user/addresses"] }),
  });

  // ── Handle place selection via autocomplete ───────────────────────────────
  const handlePlaceSelected = useCallback(
    (place: PlaceDetails) => {
      // SPEC: never block the user — emit address regardless of whether coords are present
      onChange(place.formattedAddress, place);
      onPlaceSelected?.(place);
      setShowNew(false);

      // Only persist to history when we have coordinates (coordinates = the truth)
      if (autoSave && user?.uid && place.lat != null && place.lng != null) {
        saveMutation.mutate({
          address: place.formattedAddress,
          street: place.street,
          streetNumber: place.streetNumber,
          apartment: place.apartment,
          floor: place.floor,
          entrance: place.entrance,
          notes: place.notes,
          city: place.city,
          postalCode: place.postalCode,   // optional — never blocks
          lat: place.lat as any,
          lng: place.lng as any,
          label: "other",
        });
      }
    },
    [onChange, onPlaceSelected, autoSave, user?.uid, saveMutation]
  );

  // ── Handle "use current location" ────────────────────────────────────────
  const handleCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          // Use the route that actually accepts lat/lng. The old code called
          // /api/google/places-details?latlng=... but that route requires a
          // placeId, so current-location address lookup failed by design.
          // FREE reverse-geocode (OSM/Nominatim via /api/geocode/reverse) — NOT the
          // paid Google endpoint (CEO 2026-08-01 cost cut: the free tier covers all of
          // Israel, Google Places must never bill for this).
          const params = new URLSearchParams({
            lat: String(latitude),
            lng: String(longitude),
            lang: isHebrew ? "he" : "en",
          });
          const res = await fetch(
            `/api/geocode/reverse?${params}`,
            { credentials: "include" }
          );
          const data = await res.json().catch(() => ({}));
          const formatted =
            data?.formattedAddress ||
            `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

          const place: PlaceDetails = {
            formattedAddress: formatted,
            city: data?.city,
            lat: latitude,
            lng: longitude,
          };

          onChange(formatted, place);
          onPlaceSelected?.(place);
          setShowNew(false);

          if (autoSave && user?.uid) {
            saveMutation.mutate({
              address: formatted,
              city: data?.city,
              lat: latitude as any,
              lng: longitude as any,
              label: "other",
            });
          }
        } catch {
          const addr = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          onChange(addr, { formattedAddress: addr, lat: latitude, lng: longitude });
          setShowNew(false);
        } finally {
          setGeoLoading(false);
        }
      },
      () => setGeoLoading(false)
    );
  }, [onChange, onPlaceSelected, autoSave, user?.uid, isHebrew]);

  // ── Select a saved address ────────────────────────────────────────────────
  const selectSaved = useCallback(
    (addr: UserAddress) => {
      const place: PlaceDetails = {
        formattedAddress: addr.address,
        street: addr.street ?? undefined,
        streetNumber: addr.streetNumber ?? undefined,
        apartment: addr.apartment ?? undefined,
        floor: (addr as any).floor ?? undefined,
        entrance: (addr as any).entrance ?? undefined,
        notes: (addr as any).notes ?? undefined,
        city: addr.city ?? undefined,
        postalCode: addr.postalCode ?? undefined,
        lat: addr.lat ? Number(addr.lat) : undefined,
        lng: addr.lng ? Number(addr.lng) : undefined,
      };
      onChange(addr.address, place);
      onPlaceSelected?.(place);
      setShowNew(false);

      // Bump usage count silently — pass lat/lng for proximity-based deduplication
      if (user?.uid) {
        saveMutation.mutate({
          address: addr.address,
          label: addr.label ?? "other",
          lat: addr.lat ? Number(addr.lat) : undefined,
          lng: addr.lng ? Number(addr.lng) : undefined,
        });
      }
    },
    [onChange, onPlaceSelected, user?.uid, saveMutation]
  );

  // ── Auto-select the pinned default address (2026-07-09) ───────────────────
  // Rover/Uber behaviour: if the user has a saved default address (label 'home',
  // isDefault — now pinned at enrol), pre-fill it instead of re-asking. Runs once,
  // only when the parent has no value yet, and does NOT bump usageCount (that's a
  // real selection, not an auto-fill). The user can still tap another saved
  // address or enter a new one. This makes the enrol-pinned address flow through
  // every AddressPicker consumer (bookings, shop) with no extra wiring.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (!autoSelectDefault) return;
    if (autoSelectedRef.current) return;
    if (value) { autoSelectedRef.current = true; return; }
    if (!showSavedList || savedAddresses.length === 0) return;
    const def = savedAddresses.find((a) => a.isDefault);
    if (!def) return;
    autoSelectedRef.current = true;
    const place: PlaceDetails = {
      formattedAddress: def.address,
      street: def.street ?? undefined,
      streetNumber: def.streetNumber ?? undefined,
      apartment: def.apartment ?? undefined,
      city: def.city ?? undefined,
      postalCode: def.postalCode ?? undefined,
      lat: def.lat ? Number(def.lat) : undefined,
      lng: def.lng ? Number(def.lng) : undefined,
    };
    onChange(def.address, place);
    onPlaceSelected?.(place);
    setShowNew(false);
  }, [savedAddresses, value, showSavedList, onChange, onPlaceSelected, autoSelectDefault]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">
          {label}
          {required && <span className="text-red-400 mr-1">*</span>}
        </label>
      )}

      {/* ── Current location pill ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleCurrentLocation}
        disabled={geoLoading}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#D4AF37] bg-[#D4AF37]/60 text-black text-sm font-medium hover:bg-[#D4AF37] active:bg-[#D4AF37] transition-colors"
      >
        {geoLoading ? (
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
        ) : (
          <Navigation className="w-4 h-4 shrink-0 fill-[#D4AF37] text-[#D4AF37]" />
        )}
        <span>{isHebrew ? "השתמש במיקומי הנוכחי" : "Use my current location"}</span>
      </button>

      {/* ── Saved addresses list ──────────────────────────────────────────── */}
      {showSavedList && savedAddresses.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">
            {isHebrew ? "כתובות שמורות" : "Saved addresses"}
          </p>
          {savedAddresses.map((addr) => {
            const cfg = LABEL_CONFIG[addr.label ?? "other"] ?? LABEL_CONFIG.other;
            const isSelected = value === addr.address;
            return (
              <div key={addr.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => selectSaved(addr)}
                  className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-right transition-all
                    ${isSelected
                      ? "bg-amber-50 border border-amber-300 text-amber-900"
                      : "bg-white border border-gray-100 hover:bg-white text-gray-800"
                    }`}
                >
                  <span className={`shrink-0 ${isSelected ? "text-amber-500" : "text-gray-400"}`}>
                    {cfg.icon}
                  </span>
                  <span className="flex-1 text-right truncate leading-tight">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                      {isHebrew ? cfg.textHe : cfg.text}
                      {addr.label === "custom" && addr.customLabel ? ` · ${addr.customLabel}` : ""}
                    </span>
                    {addr.address}
                  </span>
                  {isSelected && (
                    <span className="shrink-0 w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(addr.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-400 transition-all"
                  title={isHebrew ? "הסר" : "Remove"}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── New address input ─────────────────────────────────────────────── */}
      {(showNew || !value) ? (
        <div>
          {showCitySuggestion && (
            <button
              type="button"
              onClick={() => setCityPickerOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50/60 text-sm text-amber-900 hover:bg-amber-50 mb-2"
              data-testid="address-picker-city-suggestion-open"
            >
              <Building2 className="w-4 h-4 shrink-0 text-amber-500" />
              <span className="flex-1 text-right truncate">
                {pickedCityLabel
                  ? pickedCityLabel
                  : (isHebrew ? "בחר עיר מהרשימה" : "Choose a city from the list")}
              </span>
              <span className="text-xs text-amber-500">▾</span>
            </button>
          )}
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1.5">
            {isHebrew ? "הזן כתובת חדשה" : "Enter a new address"}
          </p>
          <GooglePlacesAutocomplete
            value={value}
            onChange={(val, details) => {
              onChange(val, details);
              if (details) setShowNew(false);
            }}
            onPlaceSelected={handlePlaceSelected}
            placeholder={placeholder ?? (isHebrew ? "חפש כתובת..." : "Search address...")}
            country={country}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
            <MapPin className="w-4 h-4 shrink-0 text-emerald-500" />
            <span className="flex-1 truncate text-right">{value}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="shrink-0 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-amber-600 hover:bg-amber-50 border border-gray-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {showCitySuggestion && (
        <CityPicker
          open={cityPickerOpen}
          onOpenChange={setCityPickerOpen}
          selectedCitySymbol={pickedCitySymbol}
          language={isHebrew ? "he" : "en"}
          onChange={(sel: CityPickerSelection) => {
            const displayCity = isHebrew
              ? sel.hebrewName
              : (sel.englishName || sel.hebrewName);
            setPickedCitySymbol(sel.citySymbol);
            setPickedCityLabel(displayCity);
            const rec = findIsraelCityBySymbol(sel.citySymbol);
            // Seed the free-text input with the city + comma so Google Places
            // biases the next suggestions to this locality. User types the
            // street after the comma.
            const seeded = `${displayCity}, `;
            const seededDetails: PlaceDetails = {
              formattedAddress: seeded,
              city: displayCity,
              postalCode:
                rec && rec.postcodes.length === 1
                  ? rec.postcodes[0]
                  : undefined,
            };
            onChange(seeded, seededDetails);
            setShowNew(true);
            setCityPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default AddressPicker;
