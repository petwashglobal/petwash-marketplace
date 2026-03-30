/**
 * PROVIDER CARD COMPONENT
 * 
 * Reusable luxury provider card for marketplace
 * Displays provider photo, name, rating, price, bio, certifications
 * 
 * Design: Pure white glassmorphism with Apple-style spring animations
 * Platform-aware: Conditionally renders platform-specific badges
 */

import { Star, MapPin, Shield, Camera, Clock, Check, Heart, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { MarketplaceProvider } from '@shared/schema';
import { Link } from 'wouter';
import { useSavedProviders } from '@/hooks/useSavedProviders';

interface ProviderCardProps {
  provider: MarketplaceProvider;
  onClick?: () => void;
}

export function ProviderCard({ provider, onClick }: ProviderCardProps) {
  const { isSaved, toggle, isPending } = useSavedProviders();
  const saved = isSaved(provider.userId);

  const platformLabels = {
    walk_my_pet: 'Walk My Pet',
    sitter_suite: 'Sitter Suite',
    pet_trek: 'PetTrek',
    groomers: 'Groomers',
    k9000: 'K9000',
  };

  const initials = `${provider.firstName.charAt(0)}${provider.lastName.charAt(0)}`.toUpperCase();
  const rating = provider.rating ? parseFloat(provider.rating) : 0;

  // Render platform-specific badges
  const renderBadges = () => {
    const badges: React.ReactNode[] = [];

    // Verified badge - now shown on avatar instead

    // Luxury badge style - minimal black/white
    const luxuryBadgeClass = "bg-white text-black border border-black/20 font-medium text-xs tracking-wide";

    // Walker-specific badges
    if (provider.kind === 'walker') {
      if (provider.bodyCamera) {
        badges.push(
          <Badge key="bodycam" variant="outline" className={luxuryBadgeClass} data-testid="badge-bodycam">
            <Camera className="w-3 h-3 mr-1" />
            Body Camera
          </Badge>
        );
      }
      if (provider.droneAccess) {
        badges.push(
          <Badge key="drone" variant="outline" className={luxuryBadgeClass} data-testid="badge-drone">
            Drone Access
          </Badge>
        );
      }
    }

    // Sitter-specific badges
    if (provider.kind === 'sitter') {
      if (provider.hasOwnPets) {
        badges.push(
          <Badge key="own-pets" variant="outline" className={luxuryBadgeClass} data-testid="badge-own-pets">
            Pet Owner
          </Badge>
        );
      }
    }

    // Driver-specific badges
    if (provider.kind === 'driver') {
      if (provider.hasAirConditioning) {
        badges.push(
          <Badge key="ac" variant="outline" className={luxuryBadgeClass} data-testid="badge-ac">
            Climate Control
          </Badge>
        );
      }
      if (provider.hasPetSafetyGear) {
        badges.push(
          <Badge key="safety" variant="outline" className={luxuryBadgeClass} data-testid="badge-safety">
            <Shield className="w-3 h-3 mr-1" />
            Safety Gear
          </Badge>
        );
      }
    }

    // Groomer-specific badges
    if (provider.kind === 'groomer') {
      if (provider.mobileService) {
        badges.push(
          <Badge key="mobile" variant="outline" className={luxuryBadgeClass} data-testid="badge-mobile">
            Mobile Service
          </Badge>
        );
      }
    }

    // Station badge — shown when provider is assigned to a PetWash station
    if ((provider as any).stationName) {
      badges.push(
        <Badge key="station" variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium text-xs" data-testid="badge-station">
          <Building2 className="w-3 h-3 mr-1" />
          {(provider as any).stationName}
        </Badge>
      );
    }

    return badges;
  };

  return (
    <Link
      href={`/marketplace/${provider.platform}/${provider.kind === 'walker' ? provider.walkerId : provider.id}`}
    >
      <Card
        className="group cursor-pointer luxury-glass-card luxury-hover-lift border-0 overflow-hidden"
        onClick={onClick}
        data-testid={`provider-card-${provider.id}`}
      >
        <CardContent className="p-6">
          <div className="flex gap-5">
            {/* Luxury Avatar with Ring */}
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-br from-black/10 via-black/5 to-transparent rounded-full blur-sm" />
              <Avatar className="relative w-20 h-20 ring-2 ring-black/10 shadow-lg">
                <AvatarImage
                  src={provider.profilePictureUrl || undefined}
                  alt={`${provider.firstName} ${provider.lastName}`}
                  className="object-cover"
                />
                <AvatarFallback className="bg-gradient-to-br from-black to-gray-700 text-white text-xl font-light tracking-wider">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {provider.isVerified && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-black rounded-full flex items-center justify-center shadow-md">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Name and Platform */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-lg font-semibold text-black tracking-tight truncate"
                    data-testid="text-provider-name"
                  >
                    {provider.firstName} {provider.lastName}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">
                    {platformLabels[provider.platform]}
                  </p>
                </div>

                {/* Price + Heart */}
                <div className="flex flex-col items-end gap-1 ml-4 flex-shrink-0">
                  <p
                    className="text-xl font-bold text-black"
                    data-testid="text-price"
                  >
                    {provider.priceDisplay}
                  </p>
                  <button
                    disabled={isPending}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(provider.userId, provider.platform);
                    }}
                    aria-label={saved ? 'הסר מהמועדפים' : 'שמור למועדפים'}
                    className="p-1.5 rounded-full hover:bg-rose-50 active:scale-90 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed group/heart"
                  >
                    <Heart
                      size={18}
                      className={`transition-all duration-200 ${
                        saved
                          ? 'fill-rose-500 text-rose-500 scale-110'
                          : 'fill-none text-gray-400 group-hover/heart:text-rose-400 group-hover/heart:scale-110'
                      } ${isPending ? 'animate-pulse' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Rating and Location */}
              <div className="flex items-center gap-4 mb-3">
                {rating > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-black/5 rounded-full" data-testid="rating-display">
                    <Star className="w-4 h-4 fill-black text-black" />
                    <span className="text-sm font-semibold text-black">
                      {rating.toFixed(1)}
                    </span>
                    {provider.totalBookings && provider.totalBookings > 0 && (
                      <span className="text-xs text-gray-500">
                        ({provider.totalBookings})
                      </span>
                    )}
                  </div>
                )}

                {provider.city && (
                  <div className="flex items-center gap-1 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-medium">{provider.city}</span>
                  </div>
                )}

                {provider.kind === 'walker' && provider.yearsOfExperience && (
                  <div className="flex items-center gap-1 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">{provider.yearsOfExperience}y exp</span>
                  </div>
                )}
              </div>

              {/* Bio */}
              {provider.bio && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed">
                  {provider.bio}
                </p>
              )}

              {/* Badges - Luxury Style */}
              <div className="flex flex-wrap gap-2">{renderBadges()}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
