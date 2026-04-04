/**
 * MARKETPLACE PROVIDER SEARCH RESULT CARD
 * Online service domains only. NOT for K9000.
 */

import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
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
  CheckCircle2,
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

  const locationParts = [item.suburb, item.city].filter(Boolean).join(", ");

  return (
    <div
      className="bg-white dark:bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group border border-zinc-100 dark:border-zinc-800"
      onClick={() => setLocation(`/provider/${item.providerSlug}`)}
      data-testid={`provider-card-${item.providerId}`}
    >
      <div className="flex flex-col sm:flex-row">

        {/* ── Image panel ─────────────────────────────── */}
        <div className="relative sm:w-52 sm:shrink-0">
          <div className="h-52 sm:h-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={item.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-zinc-800 dark:bg-zinc-200 flex items-center justify-center">
                <span className="text-2xl font-bold text-white dark:text-zinc-800">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {/* Trust badges overlaid top-left */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {item.verified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-900/90 text-white text-xs font-medium">
                <Shield className="h-3 w-3" />
                {isHebrew ? "מאומת" : "Verified"}
              </span>
            )}
            {item.instantBook && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600/90 text-white text-xs font-medium">
                <Zap className="h-3 w-3" />
                {isHebrew ? "הזמנה מיידית" : "Instant Book"}
              </span>
            )}
            {item.insured && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600/90 text-white text-xs font-medium">
                <CheckCircle2 className="h-3 w-3" />
                {isHebrew ? "מבוטח" : "Insured"}
              </span>
            )}
          </div>

          {/* Distance chip — bottom right */}
          {typeof item.distanceKm === "number" && (
            <div className="absolute bottom-3 right-3 bg-white/95 dark:bg-white/95 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm border border-zinc-100 dark:border-zinc-700">
              <Navigation className="h-3 w-3 text-emerald-600" />
              <span className="text-emerald-700 dark:text-emerald-400">
                {item.distanceKm < 1
                  ? `${Math.round(item.distanceKm * 1000)} m`
                  : `${item.distanceKm.toFixed(1)} km`}
              </span>
            </div>
          )}
        </div>

        {/* ── Body ────────────────────────────────────── */}
        <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
          <div>
            {/* Row 1: Name + price */}
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="min-w-0">
                <h3 className="font-bold text-lg leading-snug truncate group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                  {item.displayName}
                </h3>
                {locationParts && (
                  <p className="text-sm text-zinc-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0 text-zinc-400" />
                    <span className="truncate">{locationParts}</span>
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-xl leading-tight text-zinc-900 dark:text-zinc-100">
                  {item.priceLabel}
                </p>
                {item.currency && (
                  <p className="text-xs text-zinc-400 mt-0.5">{item.currency}</p>
                )}
              </div>
            </div>

            {/* Row 2: Rating + response time */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 mb-3">
              {/* Star rating — prominent */}
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 shrink-0" />
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  {item.rating.toFixed(1)}
                </span>
                <span className="text-sm text-zinc-400">
                  ({item.reviewsCount})
                </span>
              </div>
              {/* Completed bookings */}
              {item.completedBookings > 0 && (
                <span className="text-sm text-zinc-400">
                  {isHebrew
                    ? `${item.completedBookings} הזמנות`
                    : `${item.completedBookings} bookings`}
                </span>
              )}
              {/* Response time */}
              {item.responseTimeMinutes != null && (
                <span className="flex items-center gap-1 text-sm text-zinc-400">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {isHebrew
                    ? `עונה תוך ~${item.responseTimeMinutes} דק'`
                    : `Responds ~${item.responseTimeMinutes} min`}
                </span>
              )}
            </div>

            {/* Short bio */}
            {item.shortBio && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-3 leading-relaxed">
                {item.shortBio}
              </p>
            )}

            {/* Service chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {item.supportedServices.slice(0, 4).map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="text-xs px-2 py-0.5 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                >
                  {isHebrew ? SERVICE_LABELS[s]?.he || s : SERVICE_LABELS[s]?.en || s}
                </Badge>
              ))}
            </div>

            {/* Availability */}
            {item.nextAvailableText && (
              <p className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                {isHebrew ? `זמין: ${item.nextAvailableText}` : `Available: ${item.nextAvailableText}`}
              </p>
            )}
          </div>

          {/* CTA buttons */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-sm border-zinc-200 dark:border-zinc-700"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/provider/${item.providerSlug}`);
              }}
            >
              {isHebrew ? "צפה בפרופיל" : "View profile"}
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-white text-sm font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/provider/${item.providerSlug}`);
              }}
            >
              {isHebrew ? "הזמן עכשיו" : "Book now"}
              <ChevronRight className="h-4 w-4 ml-1 shrink-0" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
