import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/languageStore";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  Home,
  Droplets,
  Dog,
  Route as RouteIcon,
  GraduationCap,
  ShoppingBag,
  Award,
  Gift,
  Star,
  Activity,
  Clock,
  Sparkles,
  Heart,
} from "lucide-react";

const hubText: Record<string, Record<string, string>> = {
  title: {
    en: '⁦Pet Wash™⁩ Hub',
    he: '⁦Pet Wash™⁩ Hub',
    ar: '⁦Pet Wash™⁩ Hub',
    ru: '⁦Pet Wash™⁩ Hub',
    fr: '⁦Pet Wash™⁩ Hub',
    es: '⁦Pet Wash™⁩ Hub',
  },
  welcomeBack: {
    en: 'Welcome back',
    he: 'שלום',
    ar: 'مرحبًا بعودتك',
    ru: 'С возвращением',
    fr: 'Bon retour',
    es: 'Bienvenido de nuevo',
  },
  subtitle: {
    en: 'One 7-star account for all your pets and services. Seamless access to our complete ecosystem.',
    he: 'חשבון 7 כוכבים אחד לכל חיות המחמד והשירותים שלך. גישה חלקה למערכת האקולוגית המלאה שלנו.',
    ar: 'حساب واحد بسبع نجوم لجميع حيواناتك الأليفة وخدماتك.',
    ru: 'Один 7-звёздочный аккаунт для всех ваших питомцев и услуг.',
    fr: 'Un compte 7 étoiles pour tous vos animaux et services.',
    es: 'Una cuenta 7 estrellas para todas tus mascotas y servicios.',
  },
  activeBookings: {
    en: 'Active Bookings',
    he: 'הזמנות פעילות',
    ar: 'الحجوزات النشطة',
    ru: 'Активные бронирования',
    fr: 'Réservations actives',
    es: 'Reservas activas',
  },
  loyaltyPoints: {
    en: 'Loyalty Points',
    he: 'נקודות נאמנות',
    ar: 'نقاط الولاء',
    ru: 'Баллы лояльности',
    fr: 'Points de fidélité',
    es: 'Puntos de lealtad',
  },
  servicesUsed: {
    en: 'Services Used',
    he: 'שירותים בשימוש',
    ar: 'الخدمات المستخدمة',
    ru: 'Использованные услуги',
    fr: 'Services utilisés',
    es: 'Servicios utilizados',
  },
  explorePlatforms: {
    en: 'Explore Our Platforms',
    he: 'גלה את הפלטפורמות שלנו',
    ar: 'استكشف منصاتنا',
    ru: 'Изучите наши платформы',
    fr: 'Explorez nos plateformes',
    es: 'Explora nuestras plataformas',
  },
  launch: {
    en: 'Launch',
    he: 'כניסה',
    ar: 'إطلاق',
    ru: 'Запустить',
    fr: 'Lancer',
    es: 'Iniciar',
  },
  comingSoon: {
    en: 'Coming Soon',
    he: 'בקרוב',
    ar: 'قريباً',
    ru: 'Скоро',
    fr: 'Bientôt',
    es: 'Próximamente',
  },
  recentActivity: {
    en: 'Recent Activity',
    he: 'פעילות אחרונה',
    ar: 'النشاط الأخير',
    ru: 'Недавняя активность',
    fr: 'Activité récente',
    es: 'Actividad reciente',
  },
  loyaltyStatus: {
    en: 'Loyalty Status',
    he: 'סטטוס נאמנות',
    ar: 'حالة الولاء',
    ru: 'Статус лояльности',
    fr: 'Statut fidélité',
    es: 'Estado de lealtad',
  },
  goldMember: {
    en: 'Gold Member',
    he: 'חבר זהב',
    ar: 'عضو ذهبي',
    ru: 'Золотой участник',
    fr: 'Membre Or',
    es: 'Miembro Oro',
  },
  points: {
    en: 'Points',
    he: 'נקודות',
    ar: 'نقاط',
    ru: 'Баллы',
    fr: 'Points',
    es: 'Puntos',
  },
  pointsToNext: {
    en: '750 points to Platinum',
    he: '750 נקודות עד פלטינום',
    ar: '750 نقطة للبلاتيني',
    ru: '750 баллов до Платины',
    fr: '750 points pour Platine',
    es: '750 puntos para Platino',
  },
  viewRewards: {
    en: 'View Rewards',
    he: 'צפה בתגמולים',
    ar: 'عرض المكافآت',
    ru: 'Смотреть награды',
    fr: 'Voir les récompenses',
    es: 'Ver recompensas',
  },
  experienceEcosystem: {
    en: 'Experience the ⁦Pet Wash™⁩ Ecosystem',
    he: 'חווה את המערכת האקולוגית של ⁦Pet Wash™⁩',
    ar: 'اكتشف نظام ⁦Pet Wash™⁩',
    ru: 'Откройте экосистему ⁦Pet Wash™⁩',
    fr: 'Découvrez l\'écosystème ⁦Pet Wash™⁩',
    es: 'Experimenta el ecosistema ⁦Pet Wash™⁩',
  },
  oneAccount: {
    en: 'One account. Eight premium platforms. Unlimited care for your pets.',
    he: 'חשבון אחד. שמונה פלטפורמות פרמיום. טיפול ללא גבולות לחיות המחמד שלך.',
    ar: 'حساب واحد. ثماني منصات متميزة. رعاية غير محدودة لحيواناتك.',
    ru: 'Один аккаунт. Восемь премиум-платформ. Безграничная забота о питомцах.',
    fr: 'Un compte. Huit plateformes premium. Soin illimité pour vos animaux.',
    es: 'Una cuenta. Ocho plataformas premium. Cuidado ilimitado para tus mascotas.',
  },
  back: {
    en: 'Back',
    he: 'חזרה',
    ar: 'رجوع',
    ru: 'Назад',
    fr: 'Retour',
    es: 'Volver',
  },
  washStations: {
    en: 'Wash Stations',
    he: 'תחנות שטיפה',
    ar: 'محطات الغسيل',
    ru: 'Станции мойки',
    fr: 'Stations de lavage',
    es: 'Estaciones de lavado',
  },
  washStationsDesc: {
    en: 'Self-service K9000 organic wash',
    he: 'שטיפה אורגנית בשירות עצמי ⁦K9000™⁩',
    ar: 'غسيل عضوي ⁦K9000™⁩ بالخدمة الذاتية',
    ru: 'Органическая мойка K9000 самообслуживания',
    fr: 'Lavage bio K9000 en libre-service',
    es: 'Lavado orgánico K9000 autoservicio',
  },
  sitterSuite: {
    en: 'Sitter Suite',
    he: 'שמרטפות',
    ar: 'جناح رعاية الحيوانات',
    ru: 'Няни для питомцев',
    fr: 'Suite de garde',
    es: 'Suite de cuidadores',
  },
  sitterSuiteDesc: {
    en: 'Trusted pet and home sitting',
    he: 'שמרטפות אמינות לחיות מחמד ולבית',
    ar: 'رعاية موثوقة للحيوانات والمنزل',
    ru: 'Надёжный присмотр за питомцами и домом',
    fr: 'Garde d\'animaux et de maison de confiance',
    es: 'Cuidado confiable de mascotas y hogar',
  },
  walkMyPet: {
    en: 'Walk My Pet',
    he: 'טיולי כלבים',
    ar: 'تمشية حيواني الأليف',
    ru: 'Выгул питомца',
    fr: 'Promener mon animal',
    es: 'Pasear mi mascota',
  },
  walkMyPetDesc: {
    en: 'Walks, play time and outdoor',
    he: 'טיולים, זמן משחק ופעילות חוץ',
    ar: 'جولات ولعب في الهواء الطلق',
    ru: 'Прогулки, игры и активности на свежем воздухе',
    fr: 'Promenades, jeux et activités en plein air',
    es: 'Paseos, juegos y actividades al aire libre',
  },
  petTrek: {
    en: '⁦PetTrek™⁩',
    he: '⁦PetTrek™⁩',
    ar: '⁦PetTrek™⁩',
    ru: '⁦PetTrek™⁩',
    fr: '⁦PetTrek™⁩',
    es: '⁦PetTrek™⁩',
  },
  petTrekDesc: {
    en: 'Pet taxi between locations',
    he: 'מונית לחיות מחמד בין מיקומים',
    ar: 'تاكسي للحيوانات بين المواقع',
    ru: 'Такси для питомцев между локациями',
    fr: 'Taxi pour animaux entre sites',
    es: 'Taxi de mascotas entre ubicaciones',
  },
  plushLab: {
    en: '⁦The Plush Lab™⁩',
    he: '⁦The Plush Lab™⁩',
    ar: '⁦The Plush Lab™⁩',
    ru: '⁦The Plush Lab™⁩',
    fr: '⁦The Plush Lab™⁩',
    es: '⁦The Plush Lab™⁩',
  },
  plushLabDesc: {
    en: 'Premium pet boutique',
    he: 'בוטיק פרמיום לחיות מחמד',
    ar: 'بوتيك فاخر للحيوانات الأليفة',
    ru: 'Премиум бутик для питомцев',
    fr: 'Boutique premium pour animaux',
    es: 'Boutique premium para mascotas',
  },
  academy: {
    en: 'Academy',
    he: 'אקדמיה',
    ar: 'الأكاديمية',
    ru: 'Академия',
    fr: 'Académie',
    es: 'Academia',
  },
  academyDesc: {
    en: 'Training and certification',
    he: 'הכשרה והסמכה',
    ar: 'التدريب والشهادات',
    ru: 'Обучение и сертификация',
    fr: 'Formation et certification',
    es: 'Formación y certificación',
  },
  loyaltyVip: {
    en: 'Loyalty & VIP',
    he: 'נאמנות ו-VIP',
    ar: 'الولاء و VIP',
    ru: 'Лояльность и VIP',
    fr: 'Fidélité et VIP',
    es: 'Lealtad y VIP',
  },
  loyaltyVipDesc: {
    en: 'Rewards and benefits',
    he: 'תגמולים והטבות',
    ar: 'مكافآت وامتيازات',
    ru: 'Награды и привилегии',
    fr: 'Récompenses et avantages',
    es: 'Recompensas y beneficios',
  },
  eGiftCards: {
    en: 'eGift Cards',
    he: 'תווי שי דיגיטליים',
    ar: 'بطاقات هدايا رقمية',
    ru: 'Электронные подарочные карты',
    fr: 'Cartes cadeaux numériques',
    es: 'Tarjetas de regalo digitales',
  },
  eGiftCardsDesc: {
    en: 'Digital gifts for loved ones',
    he: 'מתנות דיגיטליות ליקירים',
    ar: 'هدايا رقمية للأحباء',
    ru: 'Цифровые подарки для близких',
    fr: 'Cadeaux numériques pour vos proches',
    es: 'Regalos digitales para seres queridos',
  },
  washStationBooking: {
    en: 'Wash Station Booking',
    he: 'הזמנת תחנת שטיפה',
    ar: 'حجز محطة غسيل',
    ru: 'Бронирование станции',
    fr: 'Réservation station de lavage',
    es: 'Reserva de estación de lavado',
  },
  telAvivMarina: {
    en: 'Tel Aviv Marina - Station #5',
    he: 'מרינה תל אביב - תחנה #5',
    ar: 'مارينا تل أبيب - المحطة #5',
    ru: 'Марина Тель-Авива - Станция #5',
    fr: 'Marina de Tel-Aviv - Station n°5',
    es: 'Marina de Tel Aviv - Estación #5',
  },
  hoursAgo2: {
    en: '2 hours ago',
    he: 'לפני שעתיים',
    ar: 'منذ ساعتين',
    ru: '2 часа назад',
    fr: 'Il y a 2 heures',
    es: 'Hace 2 horas',
  },
  completed: {
    en: 'Completed',
    he: 'הושלם',
    ar: 'مكتمل',
    ru: 'Завершено',
    fr: 'Terminé',
    es: 'Completado',
  },
  walkScheduled: {
    en: 'Walk Scheduled',
    he: 'טיול מתוזמן',
    ar: 'جولة مجدولة',
    ru: 'Прогулка запланирована',
    fr: 'Promenade programmée',
    es: 'Paseo programado',
  },
  tomorrowAt10: {
    en: 'Tomorrow at 10:00 AM',
    he: 'מחר ב-10:00',
    ar: 'غداً الساعة 10:00 صباحاً',
    ru: 'Завтра в 10:00',
    fr: 'Demain à 10h00',
    es: 'Mañana a las 10:00',
  },
  hoursAgo5: {
    en: '5 hours ago',
    he: 'לפני 5 שעות',
    ar: 'منذ 5 ساعات',
    ru: '5 часов назад',
    fr: 'Il y a 5 heures',
    es: 'Hace 5 horas',
  },
  upcoming: {
    en: 'Upcoming',
    he: 'קרוב',
    ar: 'قادم',
    ru: 'Предстоящее',
    fr: 'À venir',
    es: 'Próximo',
  },
  loyaltyRewardEarned: {
    en: 'Loyalty Reward Earned',
    he: 'תגמול נאמנות הושג',
    ar: 'مكافأة ولاء مكتسبة',
    ru: 'Награда за лояльность получена',
    fr: 'Récompense fidélité obtenue',
    es: 'Recompensa de lealtad obtenida',
  },
  pointsAdded: {
    en: '+50 points added',
    he: '+50 נקודות נוספו',
    ar: '+50 نقطة مضافة',
    ru: '+50 баллов добавлено',
    fr: '+50 points ajoutés',
    es: '+50 puntos añadidos',
  },
  dayAgo: {
    en: '1 day ago',
    he: 'לפני יום',
    ar: 'منذ يوم واحد',
    ru: '1 день назад',
    fr: 'Il y a 1 jour',
    es: 'Hace 1 día',
  },
  new: {
    en: 'New',
    he: 'חדש',
    ar: 'جديد',
    ru: 'Новое',
    fr: 'Nouveau',
    es: 'Nuevo',
  },
};

function tx(key: string, lang: string): string {
  return hubText[key]?.[lang] || hubText[key]?.en || key;
}

export default function Hub() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isRtl = language === 'he' || language === 'ar';
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const platforms = [
    {
      icon: Droplets,
      nameKey: "washStations",
      descKey: "washStationsDesc",
      href: "/stations",
      comingSoon: false,
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: Home,
      nameKey: "sitterSuite",
      descKey: "sitterSuiteDesc",
      href: "/sitter-suite/overview",
      comingSoon: false,
      gradient: "from-green-500 to-emerald-500",
    },
    {
      icon: Dog,
      nameKey: "walkMyPet",
      descKey: "walkMyPetDesc",
      href: "/walk-my-pet/overview",
      comingSoon: false,
      gradient: "from-orange-500 to-amber-500",
    },
    {
      icon: RouteIcon,
      nameKey: "petTrek",
      descKey: "petTrekDesc",
      href: "#",
      comingSoon: true,
      gradient: "from-purple-500 to-pink-500",
    },
    {
      icon: ShoppingBag,
      nameKey: "plushLab",
      descKey: "plushLabDesc",
      href: "#",
      comingSoon: true,
      gradient: "from-rose-500 to-red-500",
    },
    {
      icon: GraduationCap,
      nameKey: "academy",
      descKey: "academyDesc",
      href: "/academy",
      comingSoon: false,
      gradient: "from-indigo-500 to-violet-500",
    },
    {
      icon: Award,
      nameKey: "loyaltyVip",
      descKey: "loyaltyVipDesc",
      href: "/loyalty",
      comingSoon: false,
      gradient: "from-yellow-500 to-orange-500",
    },
    {
      icon: Gift,
      nameKey: "eGiftCards",
      descKey: "eGiftCardsDesc",
      href: "/egift",
      comingSoon: false,
      gradient: "from-pink-500 to-fuchsia-500",
    },
  ];

  const quickStats = [
    { labelKey: "activeBookings", value: "3", icon: Activity },
    { labelKey: "loyaltyPoints", value: "1,250", icon: Star },
    { labelKey: "servicesUsed", value: "12", icon: Sparkles },
  ];

  const recentActivity = [
    {
      titleKey: "washStationBooking",
      descKey: "telAvivMarina",
      timeKey: "hoursAgo2",
      badgeKey: "completed",
      badgeType: "success",
    },
    {
      titleKey: "walkScheduled",
      descKey: "tomorrowAt10",
      timeKey: "hoursAgo5",
      badgeKey: "upcoming",
      badgeType: "default",
    },
    {
      titleKey: "loyaltyRewardEarned",
      descKey: "pointsAdded",
      timeKey: "dayAgo",
      badgeKey: "new",
      badgeType: "gold",
    },
  ];

  return (
    <Layout>
    <div className="min-h-screen luxury-bg-purple-fade">
      <div className="luxury-container py-12">
        
        <Button
          variant="ghost"
          onClick={() => { try { window.history.back(); } catch { setLocation('/dashboard'); } }}
          className="flex items-center gap-2 mb-6 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <BackArrow className="w-5 h-5" />
          <span className="text-sm font-medium">{tx('back', language)}</span>
        </Button>

        <div className="text-center mb-16 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-4">
            {tx('title', language)}
          </h1>
          {user && (
            <p className="luxury-heading-lg mb-3">
              {tx('welcomeBack', language)}, {user.displayName || user.email?.split('@')[0] || ''}!
            </p>
          )}
          <p className="luxury-text-body max-w-2xl mx-auto">
            {tx('subtitle', language)}
          </p>
        </div>

        <div className="luxury-glass-card luxury-shadow-lg p-8 mb-12 luxury-animate-slide-up luxury-delay-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {quickStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.labelKey} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="luxury-heading-lg luxury-text-gradient mb-1">
                    {stat.value}
                  </div>
                  <div className="luxury-text-small">
                    {tx(stat.labelKey, language)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="luxury-heading-md text-center mb-8 luxury-animate-fade-in luxury-delay-2">
            {tx('explorePlatforms', language)}
          </h2>
          <div className="luxury-grid-4">
            {platforms.map((platform, index) => {
              const Icon = platform.icon;
              return (
                <div
                  key={platform.nameKey}
                  className={`luxury-glass-card luxury-hover-glow luxury-shadow-xl p-6 luxury-animate-scale-in luxury-delay-${Math.min(index + 1, 5)} ${
                    platform.comingSoon
                      ? "opacity-70 cursor-default"
                      : "cursor-pointer"
                  } relative`}
                  onClick={platform.comingSoon ? undefined : () => setLocation(platform.href)}
                >
                  {platform.comingSoon && (
                    <div className="absolute top-3 right-3 z-10">
                      <span className="px-3 py-1 text-[10px] tracking-wider uppercase font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
                        {tx('comingSoon', language)}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${platform.gradient} flex items-center justify-center shadow-lg ${platform.comingSoon ? 'grayscale-[30%]' : ''}`}>
                      <Icon className="w-10 h-10 text-white" />
                    </div>
                    <div>
                      <h3 className="luxury-heading-sm mb-2">{tx(platform.nameKey, language)}</h3>
                      <p className="luxury-text-small">
                        {tx(platform.descKey, language)}
                      </p>
                    </div>
                    {!platform.comingSoon && platform.href !== "#" && (
                      <Button className="luxury-btn-primary w-full mt-2">
                        {tx('launch', language)}
                      </Button>
                    )}
                    {platform.comingSoon && (
                      <div className="w-full mt-2 py-2 rounded-lg bg-white text-gray-500 text-sm font-medium text-center cursor-default">
                        {tx('comingSoon', language)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="luxury-animate-slide-up luxury-delay-3">
            <h3 className="luxury-heading-md mb-6">{tx('recentActivity', language)}</h3>
            <div className="luxury-glass-panel p-6 space-y-4">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="luxury-glass-minimal p-4 luxury-hover-lift flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900 dark:text-black">
                        {tx(activity.titleKey, language)}
                      </h4>
                      <span className={`luxury-badge ${
                        activity.badgeType === 'success' ? 'luxury-badge-success' :
                        activity.badgeType === 'gold' ? 'luxury-badge-gold' : 'luxury-badge'
                      } flex-shrink-0`}>
                        {tx(activity.badgeKey, language)}
                      </span>
                    </div>
                    <p className="luxury-text-small mb-1">{tx(activity.descKey, language)}</p>
                    <p className="luxury-text-small opacity-60">{tx(activity.timeKey, language)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="luxury-animate-slide-up luxury-delay-4">
            <h3 className="luxury-heading-md mb-6">{tx('loyaltyStatus', language)}</h3>
            <div className="luxury-glass-card luxury-hover-glow p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 mb-4">
                  <Award className="w-10 h-10 text-white" />
                </div>
                <div className="luxury-badge-gold mb-3">
                  {tx('goldMember', language)}
                </div>
                <div className="luxury-heading-lg luxury-text-gradient mb-1">
                  1,250 {tx('points', language)}
                </div>
                <p className="luxury-text-small">
                  {tx('pointsToNext', language)}
                </p>
              </div>
              
              <div className="relative h-3 bg-white dark:bg-white rounded-full overflow-hidden mb-6">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: '62.5%' }}
                ></div>
              </div>
              
              <Button 
                className="luxury-btn-primary w-full"
                onClick={() => setLocation('/loyalty')}
              >
                {tx('viewRewards', language)}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center luxury-animate-fade-in luxury-delay-5">
          <div className="luxury-glass-card luxury-shadow-xl p-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-6">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h2 className="luxury-heading-lg mb-4">
              {tx('experienceEcosystem', language)}
            </h2>
            <p className="luxury-text-body mb-6 max-w-2xl mx-auto">
              {tx('oneAccount', language)}
            </p>
          </div>
        </div>

      </div>
    </div>
    </Layout>
  );
}
