/**
 * Unified Navigation Button Component
 *
 * Smart navigation across all Pet Wash platforms.
 * Supports Google Maps + Apple Maps (iOS) with automatic device detection.
 *
 * WAZE-KILL (CEO 2026-08-23): Waze support removed by explicit CEO order —
 * "kill the waze, its need new pet wash waze, not good mislead people".
 * The Waze dropdown item + Waze branch in NavigationLink are removed;
 * `provider='waze'` on NavigationLink now falls back to Google Maps so
 * existing callers do not break. Reinstate after a new verified
 * PetWash Waze Places listing is set up.
 *
 * Used by: Academy, Walk My Pet, PetTrek, Sitter Suite, K9000 Stations,
 *          Plush Lab, Main Wash Services, Franchise Locations
 */

import { useState } from 'react';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/lib/languageStore';

interface NavigationButtonProps {
  // lat/lng are optional: when omitted, navigation falls back to an address
  // text query (Waze/Google/Apple all support destination-by-address). This lets
  // job cards that only carry a typed address still offer turn-by-turn nav.
  latitude?: number;
  longitude?: number;
  address?: string;
  placeName?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
  testId?: string;
}

export function NavigationButton({
  latitude,
  longitude,
  address,
  placeName,
  variant = 'outline',
  size = 'default',
  className = '',
  showLabel = true,
  testId = 'button-navigate',
}: NavigationButtonProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const label = placeName || address || t('Destination');
  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';
  const q = encodeURIComponent(address || placeName || '');

  // WAZE-KILL (CEO 2026-08-23): `wazeLink` removed. See file header.
  // Generate navigation links — by coordinates when available (most precise),
  // otherwise by address text query.
  const googleMapsLink = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodeURIComponent(label)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  const appleMapsLink = hasCoords
    ? `maps://?daddr=${latitude},${longitude}&q=${encodeURIComponent(label)}`
    : `maps://?daddr=${q}`;

  // Detect device/platform
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  const handleNavigation = (url: string, provider: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`gap-2 ${className}`}
          data-testid={testId}
        >
          <Navigation className="h-4 w-4" />
          {showLabel && <span>{t('Navigate')}</span>}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* WAZE-KILL (CEO 2026-08-23): the Waze dropdown item was removed here.
            See file header. Google Maps + Apple Maps stay. */}

        {/* Google Maps */}
        <DropdownMenuItem
          onClick={() => handleNavigation(googleMapsLink, 'Google Maps')}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-3 w-full">
            <div className="w-8 h-8 rounded-full bg-[#4285F4] flex items-center justify-center">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">{t('Open in Google Maps')}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {t('Detailed route information')}
              </div>
            </div>
          </div>
        </DropdownMenuItem>

        {/* Apple Maps (iOS only) */}
        {isIOS && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleNavigation(appleMapsLink, 'Apple Maps')}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{t('Open in Apple Maps')}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {t('Native iOS navigation')}
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          </>
        )}

        {/* Address Display */}
        {(address || placeName) && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                {t('Address')}:
              </div>
              <div className="text-xs font-medium text-gray-900 dark:text-black break-words">
                {address || placeName}
              </div>
              {hasCoords && (
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {latitude!.toFixed(6)}, {longitude!.toFixed(6)}
                </div>
              )}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Simple Navigation Link Component (for inline use)
 */
interface NavigationLinkProps {
  latitude: number;
  longitude: number;
  address?: string;
  placeName?: string;
  // WAZE-KILL (CEO 2026-08-23): `'waze'` value accepted for BACKWARD
  // COMPATIBILITY with existing callers, but internally coerced to
  // Google Maps below so no Waze URL is ever emitted. Kept in the
  // union type so TypeScript compiles unchanged for legacy callsites.
  provider?: 'waze' | 'google' | 'apple';
  className?: string;
  children?: React.ReactNode;
}

export function NavigationLink({
  latitude,
  longitude,
  address,
  placeName,
  provider = 'google',
  className = '',
  children,
}: NavigationLinkProps) {
  const { t } = useLanguage();
  const label = placeName || address || t('Navigate');

  // WAZE-KILL (CEO 2026-08-23): coerce legacy provider='waze' → 'google'.
  const effectiveProvider: 'google' | 'apple' =
    provider === 'apple' ? 'apple' : 'google';

  const links = {
    google: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    apple: `maps://?daddr=${latitude},${longitude}&q=${encodeURIComponent(label)}`,
  };

  return (
    <a
      href={links[effectiveProvider]}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 text-[#B8932F] hover:text-[#B8932F] dark:text-[#D4AF37] dark:hover:text-[#D4AF37] ${className}`}
    >
      {children || (
        <>
          <Navigation className="h-4 w-4" />
          <span>{t('Navigate with')} {effectiveProvider === 'google' ? 'Google Maps' : 'Apple Maps'}</span>
          <ExternalLink className="h-3 w-3" />
        </>
      )}
    </a>
  );
}

export default NavigationButton;
