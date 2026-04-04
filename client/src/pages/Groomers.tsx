import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Scissors, MapPin, Star, Clock, Search, SlidersHorizontal, CheckCircle,
  Award, Heart, PawPrint, ChevronRight, Phone, Filter,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { useLocation } from 'wouter';

const SERVICES_FILTER = [
  { key: 'all', label: 'All Services', he: 'כל השירותים' },
  { key: 'full_groom', label: 'Full Groom', he: 'טיפוח מלא' },
  { key: 'bath_blow', label: 'Bath & Blow Dry', he: 'אמבטיה וייבוש' },
  { key: 'nail_trim', label: 'Nail Trim', he: 'קיצוץ ציפורניים' },
  { key: 'spa_treatment', label: 'Spa Treatment', he: 'טיפול ספא' },
  { key: 'de_shed', label: 'De-Shedding', he: 'הסרת שערות' },
];

const PET_FILTER = [
  { key: 'all', label: 'All Pets', he: 'כל החיות', emoji: '🐾' },
  { key: 'dog', label: 'Dogs', he: 'כלבים', emoji: '🐕' },
  { key: 'cat', label: 'Cats', he: 'חתולים', emoji: '🐈' },
  { key: 'small', label: 'Small Pets', he: 'חיות קטנות', emoji: '🐹' },
];

const MOCK_GROOMERS = [
  {
    id: 'g1', name: 'Shira Katz', city: 'Tel Aviv', rating: 4.9, reviews: 127,
    services: ['full_groom', 'bath_blow', 'spa_treatment'],
    priceFrom: 120, petTypes: ['dog', 'cat'], experience: 8,
    badges: ['Certified', 'Mobile', 'Top Groomer'],
    bio: 'Professional groomer specializing in breed-specific cuts. Mobile studio comes to you.',
    availability: 'Today',
    emoji: '✂️',
  },
  {
    id: 'g2', name: 'Yoav Ben-David', city: 'Tel Aviv', rating: 5.0, reviews: 89,
    services: ['full_groom', 'bath_blow', 'nail_trim', 'de_shed'],
    priceFrom: 110, petTypes: ['dog'], experience: 12,
    badges: ['Certified', 'Insured', '5 Stars'],
    bio: 'Luxury grooming salon in North Tel Aviv. Specializes in large breeds.',
    availability: 'Tomorrow',
    emoji: '🐕',
  },
  {
    id: 'g3', name: 'Noa Friedman', city: 'Ramat Gan', rating: 4.8, reviews: 64,
    services: ['bath_blow', 'nail_trim', 'ear_cleaning', 'spa_treatment'],
    priceFrom: 90, petTypes: ['dog', 'cat', 'small'], experience: 5,
    badges: ['Certified', 'Cat Specialist'],
    bio: 'Gentle groomer specializing in anxious pets and cats. Stress-free environment.',
    availability: 'Today',
    emoji: '🐈',
  },
  {
    id: 'g4', name: 'Amir Cohen', city: 'Petah Tikva', rating: 4.7, reviews: 41,
    services: ['full_groom', 'bath_blow', 'puppy_groom'],
    priceFrom: 100, petTypes: ['dog'], experience: 6,
    badges: ['Certified', 'Puppy Specialist'],
    bio: 'Puppy specialist with a gentle touch. Perfect for first-time grooms.',
    availability: 'Next week',
    emoji: '🐩',
  },
];

interface GroomersProps {
  language?: string;
}

export default function Groomers({ language: langProp }: GroomersProps) {
  const { language } = useLanguage();
  const isHebrew = (langProp || language) === 'he';
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [petFilter, setPetFilter] = useState('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const filteredGroomers = MOCK_GROOMERS.filter(g => {
    const matchesSearch = !searchQuery ||
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesService = serviceFilter === 'all' || g.services.includes(serviceFilter);
    const matchesPet = petFilter === 'all' || g.petTypes.includes(petFilter);
    return matchesSearch && matchesService && matchesPet;
  });

  function toggleFavorite(id: string) {
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
            {PET_FILTER.map(p => (
              <button key={p.key} onClick={() => setPetFilter(p.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${petFilter === p.key ? 'bg-white text-purple-700' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                {p.emoji} {isHebrew ? p.he : p.label}
              </button>
            ))}
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white/15 text-white hover:bg-white/25 ml-auto">
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
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filteredGroomers.length} groomer{filteredGroomers.length !== 1 ? 's' : ''} found
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredGroomers.map(groomer => (
            <Card key={groomer.id} className="luxury-glass-card luxury-shadow-md luxury-hover-lift luxury-animate-fade-in overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-br from-pink-400/20 via-purple-300/10 to-transparent h-24 relative">
                  <div className="absolute bottom-0 left-5 translate-y-1/2 w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-3xl shadow-lg">
                    {groomer.emoji}
                  </div>
                  <button
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                    onClick={() => toggleFavorite(groomer.id)}
                  >
                    <Heart className={`w-4 h-4 ${favorites.has(groomer.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                  </button>
                </div>

                <div className="px-5 pt-12 pb-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-black text-base">{groomer.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />{groomer.city}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="font-bold text-sm text-gray-800 dark:text-black">{groomer.rating}</span>
                        <span className="text-xs text-gray-400">({groomer.reviews})</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{groomer.experience} yrs exp</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{groomer.bio}</p>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {groomer.badges.map(badge => (
                      <span key={badge} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-white text-purple-700 dark:text-purple-300 text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />{badge}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {groomer.services.slice(0,3).map(svcKey => {
                      const svcLabel = SERVICES_FILTER.find(s => s.key === svcKey);
                      return svcLabel && svcLabel.key !== 'all' ? (
                        <span key={svcKey} className="text-xs bg-white dark:bg-white text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{isHebrew ? svcLabel.he : svcLabel.label}</span>
                      ) : null;
                    })}
                    {groomer.services.length > 3 && <span className="text-xs text-gray-400">+{groomer.services.length - 3} more</span>}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-xs text-gray-400">from</p>
                      <p className="font-bold text-purple-700 dark:text-purple-300">₪{groomer.priceFrom}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mr-auto ml-3">
                      <Clock className="w-3.5 h-3.5" />
                      <span className={groomer.availability === 'Today' ? 'text-green-600 font-medium' : ''}>{groomer.availability}</span>
                    </div>
                    <Button className="luxury-btn-primary" size="sm" onClick={() => setLocation(`/groomers/book`)}>
                      Book<ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredGroomers.length === 0 && (
          <div className="luxury-glass-card p-12 text-center">
            <Scissors className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="luxury-heading-sm text-gray-500">No groomers found</p>
            <p className="luxury-text-small text-gray-400 mt-1">Try adjusting your filters</p>
            <Button className="mt-4 luxury-btn-primary" onClick={() => { setSearchQuery(''); setServiceFilter('all'); setPetFilter('all'); }}>
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
