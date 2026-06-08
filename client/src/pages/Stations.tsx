import { useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/languageStore";
import { Layout } from "@/components/Layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Droplet, 
  Sparkles, 
  Search,
  CheckCircle2,
  XCircle,
  Users,
  Wifi,
  CreditCard,
  Accessibility,
  Camera,
  Coffee,
  ArrowLeft,
  ArrowRight,
  X
} from "lucide-react";

const stText: Record<string, Record<string, string>> = {
  back: {
    en: 'Back',
    he: 'חזרה',
    ar: 'رجوع',
    ru: 'Назад',
    fr: 'Retour',
    es: 'Volver',
  },
  smartWashHubs: {
    en: '⁦K9000™⁩ SMART WASH HUBS',
    he: '⁦K9000™⁩ מרכזי שטיפה חכמים',
    ar: '⁦K9000™⁩ مراكز الغسيل الذكية',
    ru: '⁦K9000™⁩ УМНЫЕ СТАНЦИИ МОЙКИ',
    fr: '⁦K9000™⁩ CENTRES DE LAVAGE INTELLIGENTS',
    es: '⁦K9000™⁩ CENTROS DE LAVADO INTELIGENTES',
  },
  premiumWashStations: {
    en: 'Premium Wash Stations',
    he: 'תחנות שטיפה פרמיום',
    ar: 'محطات غسيل متميزة',
    ru: 'Премиум станции мойки',
    fr: 'Stations de lavage premium',
    es: 'Estaciones de lavado premium',
  },
  heroDesc: {
    en: 'Self-service ⁦K9000™⁩ natural wash locations. Professional-grade equipment, natural products, convenient locations.',
    he: 'מיקומי שטיפה טבעית ⁦K9000™⁩ בשירות עצמי. ציוד מקצועי, מוצרים טבעיים, מיקומים נוחים.',
    ar: 'مواقع الغسيل الطبيعي ⁦K9000™⁩ بالخدمة الذاتية. معدات احترافية، منتجات طبيعية، مواقع مريحة.',
    ru: 'Натуральная мойка ⁦K9000™⁩ самообслуживания. Профессиональное оборудование, натуральные продукты, удобные расположения.',
    fr: 'Stations de lavage naturel ⁦K9000™⁩ en libre-service. Équipement professionnel, produits naturels, emplacements pratiques.',
    es: 'Estaciones de lavado natural ⁦K9000™⁩ autoservicio. Equipo profesional, productos naturales, ubicaciones convenientes.',
  },
  searchPlaceholder: {
    en: 'Search by location or station name...',
    he: 'חפש לפי מיקום או שם תחנה...',
    ar: 'ابحث حسب الموقع أو اسم المحطة...',
    ru: 'Поиск по расположению или названию станции...',
    fr: 'Rechercher par emplacement ou nom de station...',
    es: 'Buscar por ubicación o nombre de estación...',
  },
  filters: {
    en: 'Filters:',
    he: 'סינון:',
    ar: 'تصفية:',
    ru: 'Фильтры:',
    fr: 'Filtres:',
    es: 'Filtros:',
  },
  availableNow: {
    en: 'Available Now',
    he: 'זמין עכשיו',
    ar: 'متاح الآن',
    ru: 'Доступно сейчас',
    fr: 'Disponible maintenant',
    es: 'Disponible ahora',
  },
  wheelchairAccessible: {
    en: 'Wheelchair Accessible',
    he: 'נגיש לכסאות גלגלים',
    ar: 'متاح لذوي الاحتياجات الخاصة',
    ru: 'Доступно для инвалидных колясок',
    fr: 'Accessible aux fauteuils roulants',
    es: 'Accesible para sillas de ruedas',
  },
  freeWifi: {
    en: 'Free WiFi',
    he: 'WiFi חינם',
    ar: 'واي فاي مجاني',
    ru: 'Бесплатный WiFi',
    fr: 'WiFi gratuit',
    es: 'WiFi gratis',
  },
  clearAll: {
    en: 'Clear All',
    he: 'נקה הכל',
    ar: 'مسح الكل',
    ru: 'Очистить всё',
    fr: 'Tout effacer',
    es: 'Limpiar todo',
  },
  interactiveMap: {
    en: 'Interactive Map',
    he: 'מפה אינטראקטיבית',
    ar: 'خريطة تفاعلية',
    ru: 'Интерактивная карта',
    fr: 'Carte interactive',
    es: 'Mapa interactivo',
  },
  viewAllStations: {
    en: 'View all stations on an interactive map',
    he: 'צפו בכל התחנות על מפה אינטראקטיבית',
    ar: 'عرض جميع المحطات على خريطة تفاعلية',
    ru: 'Смотрите все станции на интерактивной карте',
    fr: 'Voir toutes les stations sur une carte interactive',
    es: 'Ver todas las estaciones en un mapa interactivo',
  },
  openMapView: {
    en: 'Open Map View',
    he: 'פתח תצוגת מפה',
    ar: 'فتح عرض الخريطة',
    ru: 'Открыть карту',
    fr: 'Ouvrir la vue carte',
    es: 'Abrir vista de mapa',
  },
  stationsFound: {
    en: 'Stations Found',
    he: 'תחנות נמצאו',
    ar: 'محطات تم العثور عليها',
    ru: 'Станций найдено',
    fr: 'Stations trouvées',
    es: 'Estaciones encontradas',
  },
  open: {
    en: 'Open',
    he: 'פתוח',
    ar: 'مفتوح',
    ru: 'Открыто',
    fr: 'Ouvert',
    es: 'Abierto',
  },
  busy: {
    en: 'Busy',
    he: 'עמוס',
    ar: 'مشغول',
    ru: 'Занято',
    fr: 'Occupé',
    es: 'Ocupado',
  },
  closed: {
    en: 'Closed',
    he: 'סגור',
    ar: 'مغلق',
    ru: 'Закрыто',
    fr: 'Fermé',
    es: 'Cerrado',
  },
  away: {
    en: 'away',
    he: 'משם',
    ar: 'بعيد',
    ru: 'отсюда',
    fr: 'de distance',
    es: 'de distancia',
  },
  directions: {
    en: 'Directions',
    he: 'ניווט',
    ar: 'اتجاهات',
    ru: 'Маршрут',
    fr: 'Itinéraire',
    es: 'Direcciones',
  },
  bookNow: {
    en: 'Book Now',
    he: 'הזמן עכשיו',
    ar: 'احجز الآن',
    ru: 'Забронировать',
    fr: 'Réserver maintenant',
    es: 'Reservar ahora',
  },
  location: {
    en: 'Location',
    he: 'מיקום',
    ar: 'الموقع',
    ru: 'Расположение',
    fr: 'Emplacement',
    es: 'Ubicación',
  },
  fromYourLocation: {
    en: 'from your location',
    he: 'מהמיקום שלך',
    ar: 'من موقعك',
    ru: 'от вашей локации',
    fr: 'de votre position',
    es: 'desde tu ubicación',
  },
  operatingHours: {
    en: 'Operating Hours',
    he: 'שעות פעילות',
    ar: 'ساعات العمل',
    ru: 'Часы работы',
    fr: 'Heures d\'ouverture',
    es: 'Horario de operación',
  },
  currentStatus: {
    en: 'Current Status',
    he: 'סטטוס נוכחי',
    ar: 'الحالة الحالية',
    ru: 'Текущий статус',
    fr: 'Statut actuel',
    es: 'Estado actual',
  },
  openNow: {
    en: 'Open Now',
    he: 'פתוח עכשיו',
    ar: 'مفتوح الآن',
    ru: 'Открыто сейчас',
    fr: 'Ouvert maintenant',
    es: 'Abierto ahora',
  },
  temporarilyClosed: {
    en: 'Temporarily Closed',
    he: 'סגור זמנית',
    ar: 'مغلق مؤقتاً',
    ru: 'Временно закрыто',
    fr: 'Temporairement fermé',
    es: 'Cerrado temporalmente',
  },
  amenities: {
    en: 'Amenities',
    he: 'שירותים ומתקנים',
    ar: 'المرافق',
    ru: 'Удобства',
    fr: 'Équipements',
    es: 'Servicios',
  },
  getDirections: {
    en: 'Get Directions',
    he: 'קבל הוראות הגעה',
    ar: 'الحصول على الاتجاهات',
    ru: 'Проложить маршрут',
    fr: 'Obtenir l\'itinéraire',
    es: 'Obtener direcciones',
  },
  contactlessPayment: {
    en: 'Contactless Payment',
    he: 'תשלום ללא מגע',
    ar: 'الدفع بدون تلامس',
    ru: 'Бесконтактная оплата',
    fr: 'Paiement sans contact',
    es: 'Pago sin contacto',
  },
  securityCamera: {
    en: 'Security Camera',
    he: 'מצלמת אבטחה',
    ar: 'كاميرا أمنية',
    ru: 'Камера безопасности',
    fr: 'Caméra de sécurité',
    es: 'Cámara de seguridad',
  },
  nearbyCafe: {
    en: 'Nearby Café',
    he: 'בית קפה בקרבת מקום',
    ar: 'مقهى قريب',
    ru: 'Кафе поблизости',
    fr: 'Café à proximité',
    es: 'Cafetería cercana',
  },
  accessible: {
    en: 'Accessible',
    he: 'נגיש',
    ar: 'متاح',
    ru: 'Доступно',
    fr: 'Accessible',
    es: 'Accesible',
  },
};

function tx(key: string, lang: string): string {
  return stText[key]?.[lang] || stText[key]?.en || key;
}

const mockStations: Array<{
  id: number;
  name: string;
  address: string;
  distance: string;
  status: string;
  availability: string;
  image: string;
  hours: string;
  amenities: string[];
}> = [];

const stats: Array<{ label: string; value: string; icon: any }> = [];

const amenityIcons: Record<string, any> = {
  wifi: Wifi,
  payment: CreditCard,
  camera: Camera,
  accessible: Accessibility,
  cafe: Coffee
};

function getAmenityLabel(amenity: string, lang: string): string {
  const map: Record<string, string> = {
    wifi: tx('freeWifi', lang),
    payment: tx('contactlessPayment', lang),
    camera: tx('securityCamera', lang),
    accessible: tx('wheelchairAccessible', lang),
    cafe: tx('nearbyCafe', lang),
  };
  return map[amenity] || amenity;
}

export default function Stations() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const isRtl = language === 'he' || language === 'ar';
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;
  const [selectedStation, setSelectedStation] = useState<typeof mockStations[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    available: false,
    accessible: false,
    wifi: false
  });

  const filteredStations = mockStations.filter(station => {
    const matchesSearch = station.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         station.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilters = 
      (!filters.available || station.status === "open") &&
      (!filters.accessible || station.amenities.includes("accessible")) &&
      (!filters.wifi || station.amenities.includes("wifi"));
    return matchesSearch && matchesFilters;
  });

  return (
    <Layout>
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        <button
          onClick={() => { try { window.history.back(); } catch { setLocation('/dashboard'); } }}
          className="flex items-center gap-2 mb-6 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <BackArrow className="w-5 h-5" />
          <span className="text-sm font-medium">{tx('back', language)}</span>
        </button>

        <div className="text-center mb-12 luxury-animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-300">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold tracking-wider text-cyan-600">{tx('smartWashHubs', language)}</span>
          </div>
          
          <div className="flex justify-center items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center luxury-shadow-xl">
              <Droplet className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-light text-gray-900 mb-4" style={{ fontFamily: 'Georgia, serif' }}>
            {tx('premiumWashStations', language)}
          </h1>
          <p className="text-gray-500 text-base max-w-2xl mx-auto mb-8">
            {tx('heroDesc', language)}
          </p>

          <div className="max-w-2xl mx-auto p-5 rounded-3xl bg-white border border-[#E8E3D9] shadow-md">
            <div className="h-1 -mt-5 -mx-5 mb-5 rounded-t-[28px] bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500" />
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
              <Input
                type="text"
                placeholder={tx('searchPlaceholder', language)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-6 text-lg bg-white border-[#E8E3D9] text-[#1A1A1A] placeholder:text-[#AAAAAA] focus:border-cyan-500 rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 luxury-animate-slide-up luxury-delay-1">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="p-6 text-center transition-all duration-300 hover:scale-[1.02] rounded-3xl bg-white border border-[#E8E3D9] shadow-sm"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-500/15 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold text-[#1A1A1A] mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-[#7A7068]">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 mb-8 luxury-animate-fade-in luxury-delay-2 rounded-2xl bg-white border border-[#E8E3D9] shadow-sm">
          <div className="flex flex-wrap items-center gap-6">
            <h3 className="text-sm font-semibold text-[#1A1A1A]">{tx('filters', language)}</h3>
            
            <label className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={filters.available}
                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, available: !!checked }))}
                className="border-cyan-500/50 data-[state=checked]:bg-cyan-600"
              />
              <span className="text-sm text-[#7A7068] group-hover:text-cyan-600 transition-colors">{tx('availableNow', language)}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={filters.accessible}
                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, accessible: !!checked }))}
                className="border-cyan-500/50 data-[state=checked]:bg-cyan-600"
              />
              <span className="text-sm text-[#7A7068] group-hover:text-cyan-600 transition-colors">{tx('wheelchairAccessible', language)}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={filters.wifi}
                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, wifi: !!checked }))}
                className="border-cyan-500/50 data-[state=checked]:bg-cyan-600"
              />
              <span className="text-sm text-[#7A7068] group-hover:text-cyan-600 transition-colors">{tx('freeWifi', language)}</span>
            </label>

            {(filters.available || filters.accessible || filters.wifi) && (
              <button
                onClick={() => setFilters({ available: false, accessible: false, wifi: false })}
                className="text-sm text-[#7A7068] text-cyan-400 hover:text-cyan-600 ml-auto transition-colors"
              >
                {tx('clearAll', language)}
              </button>
            )}
          </div>

          {(filters.available || filters.accessible || filters.wifi) && (
            <div className="flex flex-wrap gap-2 mt-4">
              {filters.available && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  {tx('availableNow', language)}
                </span>
              )}
              {filters.accessible && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-gray-700 text-xs font-medium">
                  <Accessibility className="w-4 h-4" />
                  {tx('accessible', language)}
                </span>
              )}
              {filters.wifi && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-gray-700 text-xs font-medium">
                  <Wifi className="w-4 h-4" />
                  WiFi
                </span>
              )}
            </div>
          )}
        </div>

        <div 
          className="rounded-2xl overflow-hidden mb-12 luxury-animate-scale-in luxury-delay-3 bg-white border border-[#E8E3D9] shadow-sm"
        >
          <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500" />
          <div className="aspect-video bg-gradient-to-br from-cyan-50 via-white to-blue-50 flex items-center justify-center relative p-8 border border-[#E8E3D9] rounded-xl">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-500/20 flex items-center justify-center">
                <MapPin className="w-10 h-10 text-cyan-400" />
              </div>
              <h3 className="text-base font-semibold text-[#1A1A1A] mb-3">{tx('interactiveMap', language)}</h3>
              <p className="text-gray-500 text-base mb-6">{tx('viewAllStations', language)}</p>
              <button
                onClick={() => setLocation("/map")}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity inline-flex items-center"
              >
                <Navigation className="w-5 h-5 mr-2 inline" />
                {tx('openMapView', language)}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-xl font-semibold text-[#1A1A1A] mb-6">
            {filteredStations.length} {tx('stationsFound', language)}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStations.map((station, index) => (
              <div
                key={station.id}
                className="bg-white border border-[#E8E3D9] rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] luxury-animate-fade-in shadow-sm"
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
                onClick={() => setSelectedStation(station)}
              >
                <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500" />
                
                <div className="aspect-video overflow-hidden relative">
                  <img
                    src={station.image}
                    alt={station.name}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                  />
                  
                  <div className="absolute top-4 right-4">
                    {station.status === "open" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        {tx('open', language)}
                      </span>
                    )}
                    {station.status === "busy" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                        <Users className="w-4 h-4" />
                        {tx('busy', language)}
                      </span>
                    )}
                    {station.status === "closed" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-gray-700 text-xs font-medium">
                        <XCircle className="w-4 h-4" />
                        {tx('closed', language)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-base font-semibold text-[#1A1A1A] mb-2">{station.name}</h3>
                  
                  <p className="text-sm text-[#7A7068] mb-3 flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-400" />
                    {station.address}
                  </p>

                  <p className="font-bold text-[#1A1A1A] text-2xl font-semibold mb-3 text-cyan-600">
                    {station.distance} {tx('away', language)}
                  </p>

                  <p className="text-sm text-[#7A7068] mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    {station.availability} • {station.hours}
                  </p>

                  <div className="flex gap-2 mb-4 flex-wrap">
                    {station.amenities.slice(0, 4).map((amenity) => {
                      const Icon = amenityIcons[amenity];
                      return (
                        <div
                          key={amenity}
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/15 flex items-center justify-center"
                          title={getAmenityLabel(amenity, language)}
                        >
                          <Icon className="w-4 h-4 text-cyan-400" />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/map?station=${station.id}`);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity inline-flex items-center justify-center"
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      {tx('directions', language)}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/booking?station=${station.id}`);
                      }}
                      className="flex-1 py-2.5 border border-[#E8E3D9] rounded-xl text-sm text-[#1A1A1A] hover:bg-white transition-colors"
                    >
                      {tx('bookNow', language)}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={!!selectedStation} onOpenChange={() => setSelectedStation(null)}>
        <DialogContent className="bg-white border border-[#E8E3D9] text-[#1A1A1A] max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedStation && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-[#1A1A1A] mb-4">
                  {selectedStation.name}
                </DialogTitle>
              </DialogHeader>

              <div className="aspect-video overflow-hidden rounded-2xl mb-6">
                <img
                  src={selectedStation.image}
                  alt={selectedStation.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-[#1A1A1A] mb-2">{tx('location', language)}</h4>
                  <p className="text-gray-500 text-base flex items-start gap-2">
                    <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0 text-cyan-400" />
                    {selectedStation.address}
                  </p>
                  <p className="text-cyan-600 font-semibold mt-2 ml-7">
                    {selectedStation.distance} {tx('fromYourLocation', language)}
                  </p>
                </div>

                <div className="bg-white border border-[#E8E3D9] p-4 rounded-xl">
                  <h4 className="text-sm font-semibold text-[#1A1A1A] mb-2">{tx('operatingHours', language)}</h4>
                  <p className="text-gray-500 text-base flex items-center gap-2">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    {selectedStation.hours}
                  </p>
                </div>

                <div className="bg-white border border-[#E8E3D9] p-4 rounded-xl">
                  <h4 className="text-sm font-semibold text-[#1A1A1A] mb-2">{tx('currentStatus', language)}</h4>
                  <div className="flex items-center gap-3">
                    {selectedStation.status === "open" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        {tx('openNow', language)}
                      </span>
                    )}
                    {selectedStation.status === "busy" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                        <Users className="w-4 h-4" />
                        {tx('busy', language)}
                      </span>
                    )}
                    {selectedStation.status === "closed" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-gray-700 text-xs font-medium">
                        <XCircle className="w-4 h-4" />
                        {tx('temporarilyClosed', language)}
                      </span>
                    )}
                    <span className="text-sm text-[#7A7068]">{selectedStation.availability}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-[#1A1A1A] mb-4">{tx('amenities', language)}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedStation.amenities.map((amenity) => {
                      const Icon = amenityIcons[amenity];
                      return (
                        <div
                          key={amenity}
                          className="flex items-center gap-3 bg-white border border-[#E8E3D9] p-3 rounded-xl"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/15 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-cyan-400" />
                          </div>
                          <span className="text-sm text-[#7A7068]">{getAmenityLabel(amenity, language)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => {
                      setLocation(`/map?station=${selectedStation.id}`);
                      setSelectedStation(null);
                    }}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity inline-flex items-center justify-center"
                  >
                    <Navigation className="w-5 h-5 mr-2" />
                    {tx('getDirections', language)}
                  </button>
                  <button
                    onClick={() => {
                      setLocation(`/booking?station=${selectedStation.id}`);
                      setSelectedStation(null);
                    }}
                    className="flex-1 py-3 border border-[#E8E3D9] rounded-xl text-sm text-[#1A1A1A] hover:bg-white transition-colors"
                  >
                    {tx('bookNow', language)}
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
}
