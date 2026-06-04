import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Scissors, MapPin, Star, Clock, Search, CheckCircle,
  Heart, ChevronRight, Filter, Loader2, AlertCircle,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { useLocation } from 'wouter';
import { fetchProviderBrowseResults } from '@/api/providerSearchApi';

const SERVICES_FILTER = [
  { key: 'all', label: 'All Services', he: 'כל השירותים' },
  { key: 'full_groom', label: 'Full Groom', he: 'טיפוח מלא' },
  { key: 'bath_blow', label: 'Bath & Blow Dry', he: 'אמבטיה וייבוש' },
  { key: 'nail_trim', label: 'Nail Trim', he: 'קיצוץ ציפורניים' },
  { key: 'spa_treatment', label: 'Spa Treatment', he: 'טיפול ספא' },
  { key: 'de_shed', label: 'De-Shedding', he: 'הסרת שערות' },
];

interface GroomerResult {
  id: string | number;
  odId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  profilePictureUrl?: string;
  rating?: string | number;
  totalBookings?: number;
  isActive?: boolean;
  isVerified?: boolean;
  priceDisplay?: string;
  city?: string;
  serviceArea?: string;
  serviceTypes?: string[];
}

interface GroomersProps {
  language?: string;
}

export default function Groomers({ language: langProp }: GroomersProps) {
  const { language } = useLanguage();
  const isHebrew = (langProp || language) === 'he';
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [favorites, setFavorites] = useState<Set<string | number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, isError } = useQuery<{ providers: GroomerResult[]; total: number }>({
    queryKey: ['/api/providers/search', 'groomers'],
    queryFn: async () => {
      const result = await fetchProviderBrowseResults({
        serviceType: 'grooming',
        pageSize: 50,
      });

      return {
        total: result.pagination.total,
        providers: result.providers.map((provider) => {
          const [firstName = '', ...lastNameParts] = provider.displayName.split(' ');
          return {
            id: provider.id,
            firstName,
            lastName: lastNameParts.join(' '),
            profilePictureUrl: provider.profilePhotoUrl || undefined,
            rating: provider.rating ?? undefined,
            totalBookings: provider.reviewCount,
            isActive: true,
            isVerified: true,
            priceDisplay: provider.pricing.perHour ? `₪${provider.pricing.perHour}` : undefined,
            city: provider.location,
            serviceArea: provider.location,
            serviceTypes: provider.supportedServices,
          };
        }),
      };
    },
  });

  const allGroomers: GroomerResult[] = data?.providers ?? [];

  const filteredGroomers = allGroomers.filter(g => {
    const fullName = `${g.firstName ?? ''} ${g.lastName ?? ''}`.trim();
    const location = g.city ?? g.serviceArea ?? '';
    const matchesSearch =
      !searchQuery ||
      fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesService =
      serviceFilter === 'all' ||
      (g.serviceTypes ?? []).includes(serviceFilter);
    return matchesSearch && matchesService;
  });

  function toggleFavorite(id: string | number) {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-bg-primary text-white py-12">
        <div className="luxury-container">
          <div className="flex items-center gap-2 mb-2"><Scissors className="w-6 h-6 text-pink-300" /><span className="text-pink-200 text-sm font-medium uppercase tracking-wide">Grooming Marketplace</span></div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{isHebrew ? 'מצא מטפח מקצועי' : 'Find a Professional Groomer'}</h1>
          <p className="text-purple-100 mb-8">Certified, insured groomers near you</p>

          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder={isHebrew ? 'חפש לפי שם או עיר...' : 'Search by name or city...'}
              className="pl-10 pr-4 h-12 bg-white/95 border-0 rounded-xl text-gray-800 placeholder:text-gray-400 shadow-lg"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white/15 text-white hover:bg-white/25">
              <Filter className="w-4 h-4" />{isHebrew ? 'פילטרים' : 'Filters'}
            </button>
          </div>

          {showFilters && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {SERVICES_FILTER.map(s => (
                <button key={s.key} onClick={() => setServiceFilter(s.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${serviceFilter === s.key ? 'bg-pink-400 text-white' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                  {isHebrew ? s.he : s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="luxury-container py-8">
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>{isHebrew ? 'טוען מטפחים...' : 'Loading groomers...'}</span>
          </div>
        )}

        {isError && (
          <div className="luxury-glass-card p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="luxury-heading-sm text-gray-700">
              {isHebrew ? 'לא ניתן לטעון מטפחים כרגע' : 'Unable to load groomers right now'}
            </p>
            <p className="luxury-text-small text-gray-400 mt-1">
              {isHebrew ? 'אנא נסה שוב מאוחר יותר' : 'Please try again later'}
            </p>
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {filteredGroomers.length} groomer{filteredGroomers.length !== 1 ? 's' : ''} found
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredGroomers.map(groomer => {
                const fullName = `${groomer.firstName ?? ''} ${groomer.lastName ?? ''}`.trim();
                const city = groomer.city ?? groomer.serviceArea ?? '';
                const rating = parseFloat(String(groomer.rating ?? 0)).toFixed(1);
                const price = groomer.priceDisplay ?? '';
                const id = groomer.id;

                return (
                  <Card key={id} className="luxury-glass-card luxury-shadow-md luxury-hover-lift luxury-animate-fade-in overflow-hidden">
                    <CardContent className="p-0">
                      <div className="bg-gradient-to-br from-pink-400/20 via-purple-300/10 to-transparent h-24 relative">
                        <div className="absolute bottom-0 left-5 translate-y-1/2 w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-3xl shadow-lg">
                          ✂️
                        </div>
                        <button
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                          onClick={() => toggleFavorite(id)}
                        >
                          <Heart className={`w-4 h-4 ${favorites.has(id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                        </button>
                      </div>

                      <div className="px-5 pt-12 pb-5">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-black text-base">{fullName}</h3>
                            {city && (
                              <p className="text-sm text-gray-500 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />{city}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-amber-500">
                              <Star className="w-4 h-4 fill-current" />
                              <span className="font-bold text-sm text-gray-800 dark:text-black">{rating}</span>
                              {groomer.totalBookings != null && (
                                <span className="text-xs text-gray-400">({groomer.totalBookings})</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {groomer.isVerified && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-white text-purple-700 dark:text-purple-300 text-xs font-medium">
                              <CheckCircle className="w-3 h-3" />Verified
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div>
                            {price && (
                              <>
                                <p className="text-xs text-gray-400">from</p>
                                <p className="font-bold text-purple-700 dark:text-purple-300">{price}</p>
                              </>
                            )}
                          </div>
                          <Button className="luxury-btn-primary" size="sm" onClick={() => setLocation(`/groomers/book`)}>
                            Book<ChevronRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredGroomers.length === 0 && allGroomers.length === 0 && (
              <div className="luxury-glass-card p-12 text-center">
                <Scissors className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="luxury-heading-sm text-gray-500">
                  {isHebrew ? 'לא נמצאו מטפחים באזורך' : 'No groomers available yet'}
                </p>
                <p className="luxury-text-small text-gray-400 mt-1">
                  {isHebrew ? 'שירות הטיפוח יושק בקרוב' : 'Grooming service is coming to your area soon'}
                </p>
              </div>
            )}

            {filteredGroomers.length === 0 && allGroomers.length > 0 && (
              <div className="luxury-glass-card p-12 text-center">
                <Scissors className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="luxury-heading-sm text-gray-500">No groomers found</p>
                <p className="luxury-text-small text-gray-400 mt-1">Try adjusting your filters</p>
                <Button className="mt-4 luxury-btn-primary" onClick={() => { setSearchQuery(''); setServiceFilter('all'); }}>
                  Clear Filters
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
