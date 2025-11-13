/**
 * PROVIDER CARD COMPONENT
 * 
 * Reusable luxury provider card for marketplace
 * Displays provider photo, name, rating, price, bio, certifications
 * 
 * Design: Pure white glassmorphism with Apple-style spring animations
 * Platform-aware: Conditionally renders platform-specific badges
 */

import { Star, MapPin, Shield, Camera, Clock, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { MarketplaceProvider } from '@shared/schema';
import { Link } from 'wouter';

interface ProviderCardProps {
  provider: MarketplaceProvider;
  onClick?: () => void;
}

export function ProviderCard({ provider, onClick }: ProviderCardProps) {
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

    // Verified badge
    if (provider.isVerified) {
      badges.push(
        <Badge
          key="verified"
          variant="outline"
          className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
          data-testid="badge-verified"
        >
          <Shield className="w-3 h-3 mr-1" />
          Verified
        </Badge>
      );
    }

    // Walker-specific badges
    if (provider.kind === 'walker') {
      if (provider.bodyCamera) {
        badges.push(
          <Badge
            key="bodycam"
            variant="outline"
            className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
            data-testid="badge-bodycam"
          >
            <Camera className="w-3 h-3 mr-1" />
            Body Camera
          </Badge>
        );
      }
      if (provider.droneAccess) {
        badges.push(
          <Badge
            key="drone"
            variant="outline"
            className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
            data-testid="badge-drone"
          >
            🚁 Drone
          </Badge>
        );
      }
    }

    // Sitter-specific badges
    if (provider.kind === 'sitter') {
      if (provider.hasOwnPets) {
        badges.push(
          <Badge
            key="own-pets"
            variant="outline"
            className="bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800"
            data-testid="badge-own-pets"
          >
            🐾 Pet Owner
          </Badge>
        );
      }
    }

    // Driver-specific badges
    if (provider.kind === 'driver') {
      if (provider.hasAirConditioning) {
        badges.push(
          <Badge
            key="ac"
            variant="outline"
            className="bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800"
            data-testid="badge-ac"
          >
            ❄️ A/C
          </Badge>
        );
      }
      if (provider.hasPetSafetyGear) {
        badges.push(
          <Badge
            key="safety"
            variant="outline"
            className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800"
            data-testid="badge-safety"
          >
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
          <Badge
            key="mobile"
            variant="outline"
            className="bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800"
            data-testid="badge-mobile"
          >
            🚐 Mobile Service
          </Badge>
        );
      }
    }

    return badges;
  };

  return (
    <Link
      href={`/marketplace/${provider.platform}/providers/${provider.kind === 'walker' ? provider.walkerId : provider.id}`}
    >
      <Card
        className="group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
        onClick={onClick}
        data-testid={`provider-card-${provider.id}`}
      >
        <CardContent className="p-6">
          <div className="flex gap-4">
            {/* Avatar */}
            <Avatar className="w-20 h-20 border-2 border-gray-100 dark:border-gray-800">
              <AvatarImage
                src={provider.profilePictureUrl || undefined}
                alt={`${provider.firstName} ${provider.lastName}`}
              />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Name and Platform */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-lg font-semibold text-gray-900 dark:text-white truncate"
                    data-testid="text-provider-name"
                  >
                    {provider.firstName} {provider.lastName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {platformLabels[provider.platform]}
                  </p>
                </div>

                {/* Price */}
                <div className="text-right ml-4">
                  <p
                    className="text-lg font-bold text-gray-900 dark:text-white"
                    data-testid="text-price"
                  >
                    {provider.priceDisplay}
                  </p>
                </div>
              </div>

              {/* Rating and Location */}
              <div className="flex items-center gap-4 mb-3">
                {rating > 0 && (
                  <div className="flex items-center gap-1" data-testid="rating-display">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {rating.toFixed(1)}
                    </span>
                    {provider.totalBookings && provider.totalBookings > 0 && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({provider.totalBookings})
                      </span>
                    )}
                  </div>
                )}

                {provider.city && (
                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{provider.city}</span>
                  </div>
                )}

                {provider.kind === 'walker' && provider.yearsOfExperience && (
                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">{provider.yearsOfExperience}y exp</span>
                  </div>
                )}
              </div>

              {/* Bio */}
              {provider.bio && (
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
                  {provider.bio}
                </p>
              )}

              {/* Badges */}
              <div className="flex flex-wrap gap-2">{renderBadges()}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
