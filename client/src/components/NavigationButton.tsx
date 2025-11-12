/**
 * Unified Navigation Button Component
 * 
 * Smart navigation across all Pet Wash platforms.
 * Supports Waze, Google Maps, and Apple Maps with automatic device detection.
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
  latitude: number;
  longitude: number;
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

  // Generate navigation links
  const wazeLink = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes&zoom=17`;
  const googleMapsLink = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodeURIComponent(label)}`;
  const appleMapsLink = `maps://?daddr=${latitude},${longitude}&q=${encodeURIComponent(label)}`;

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
        {/* Waze - Most popular in Israel */}
        <DropdownMenuItem
          onClick={() => handleNavigation(wazeLink, 'Waze')}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-3 w-full">
            <div className="w-8 h-8 rounded-full bg-[#33ccff] flex items-center justify-center">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">{t('Open in Waze')}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {t('Turn-by-turn navigation')}
              </div>
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

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
              <div className="text-xs font-medium text-gray-900 dark:text-white break-words">
                {address || placeName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </div>
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
  provider?: 'waze' | 'google' | 'apple';
  className?: string;
  children?: React.ReactNode;
}

export function NavigationLink({
  latitude,
  longitude,
  address,
  placeName,
  provider = 'waze',
  className = '',
  children,
}: NavigationLinkProps) {
  const { t } = useLanguage();
  const label = placeName || address || t('Navigate');

  const links = {
    waze: `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes&zoom=17`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    apple: `maps://?daddr=${latitude},${longitude}&q=${encodeURIComponent(label)}`,
  };

  return (
    <a
      href={links[provider]}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 ${className}`}
    >
      {children || (
        <>
          <Navigation className="h-4 w-4" />
          <span>{t('Navigate with')} {provider === 'waze' ? 'Waze' : provider === 'google' ? 'Google Maps' : 'Apple Maps'}</span>
          <ExternalLink className="h-3 w-3" />
        </>
      )}
    </a>
  );
}

export default NavigationButton;
