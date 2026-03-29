/**
 * MARKETPLACE PROVIDER SEARCH RESULT CARD
 * Online service domains only. NOT for K9000.
 */

import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Star,
  MapPin,
  Clock,
  Shield,
  Zap,
  Navigation,
  ChevronRight,
} from "lucide-react";
import type { ProviderSearchItem } from "@shared/provider-search-types";

interface Props {
  item: ProviderSearchItem;
}

const SERVICE_LABELS: Record<string, { en: string; he: string }> = {
  pet_sitting: { en: "Pet Sitting",  he: "שמירה" },
  dog_walking: { en: "Dog Walking",  he: "הליכה" },
  grooming:    { en: "Grooming",     he: "טיפוח" },
  transport:   { en: "Transport",    he: "הסעות" },
  daycare:     { en: "Daycare",      he: "פנסיון" },
};

export function ProviderSearchCard({ item }: Props) {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === "he";
  const [, setLocation] = useLocation();

  const imageUrl = item.coverImageUrl || item.avatarUrl;
  const initials = item.displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card
      className="overflow-hidden hover:shadow-xl transition-all cursor-pointer group border border-zinc-100 dark:border-zinc-800"
      onClick={() => setLocation(`/provider/${item.providerSlug}`)}
      data-testid={`provider-card-${item.providerId}`}
    >
      {/* Desktop: horizontal layout; Mobile: stacked */}
      <div className="flex flex-col sm:flex-row">
        {/* Image / avatar */}
        <div className="relative sm:w-56 sm:shrink-0">
          <div className="h-48 sm:h-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={item.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-black dark:bg-white flex items-center justify-center">
                <span className="text-2xl font-bold text-white dark:text-black">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {/* Trust badges overlaid on image */}
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {item.verified && (
              <Badge className="bg-black text-white dark:bg-white dark:text-black text-xs py-0.5">
                <Shield className="h-3 w-3 mr-1" />
                {isHebrew ? "מאומת" : "Verified"}
              </Badge>
            )}
            {item.instantBook && (
              <Badge className="bg-emerald-600 text-white text-xs py-0.5">
                <Zap className="h-3 w-3 mr-1" />
                {isHebrew ? "מיידי" : "Instant"}
              </Badge>
            )}
          </div>

          {/* Distance chip */}
          {typeof item.distanceKm === "number" && (
            <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-black/90 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 shadow">
              <Navigation className="h-3 w-3 text-emerald-600" />
              <span className="text-emerald-700 dark:text-emerald-400">
                {item.distanceKm < 1
                  ? `${Math.round(item.distanceKm * 1000)} m`
                  : `${item.distanceKm.toFixed(1)} km`}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <CardContent className="flex-1 p-4 flex flex-col justify-between">
          <div>
            {/* Name + price */}
            <div className="flex items-start justify-between mb-2 gap-2">
              <div>
                <h3 className="font-bold text-lg leading-tight group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
                  {item.displayName}
                </h3>
                <p className="text-sm text-zinc-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {[item.suburb, item.city].filter(Boolean).join(", ")}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-lg">{item.priceLabel}</p>
                {item.currency && (
                  <p className="text-xs text-zinc-400">{item.currency}</p>
                )}
              </div>
            </div>

            {/* Rating + response */}
            <div className="flex items-center gap-4 mb-3 text-sm text-zinc-500">
              <span className="flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                {item.rating.toFixed(1)}
                <span className="font-normal text-zinc-400">
                  ({item.reviewsCount})
                </span>
              </span>
              {item.responseTimeMinutes != null && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {isHebrew
                    ? `עונה תוך ~${item.responseTimeMinutes} דק'`
                    : `Responds ~${item.responseTimeMinutes} min`}
                </span>
              )}
            </div>

            {/* Bio */}
            {item.shortBio && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-3">
                {item.shortBio}
              </p>
            )}

            {/* Service chips */}
            <div className="flex flex-wrap gap-1 mb-3">
              {item.supportedServices.slice(0, 4).map((s) => (
                <Badge key={s} variant="outline" className="text-xs">
                  {isHebrew
                    ? SERVICE_LABELS[s]?.he || s
                    : SERVICE_LABELS[s]?.en || s}
                </Badge>
              ))}
            </div>

            {/* Availability */}
            {item.nextAvailableText && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {isHebrew ? `זמין: ${item.nextAvailableText}` : `Available: ${item.nextAvailableText}`}
              </p>
            )}
          </div>

          {/* CTA */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/provider/${item.providerSlug}`);
              }}
            >
              {isHebrew ? "פרופיל" : "View profile"}
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/provider/${item.providerSlug}`);
              }}
            >
              {isHebrew ? "הזמן" : "Book"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
