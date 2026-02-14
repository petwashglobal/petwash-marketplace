import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { Layout } from '@/components/Layout';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LogOut } from 'lucide-react';

interface WalletSummary {
  walletId: string;
  userId: string;
  egiftBalanceCents: number;
  washPackageCredits: number;
  loyaltyPointsBalance: number;
  promoBalanceCents: number;
  referralBalanceCents: number;
  totalCreditsValueCents: number;
  loyaltyTier: string;
  tierPointsThisYear: number;
}

const tierLabels: Record<string, Record<string, string>> = {
  bronze: { en: 'Bronze', he: 'Bronze', ar: 'برونزي', es: 'Bronce', fr: 'Bronze', ru: 'Бронза' },
  silver: { en: 'Silver', he: 'Silver', ar: 'فضي', es: 'Plata', fr: 'Argent', ru: 'Серебро' },
  gold: { en: 'Gold', he: 'Gold', ar: 'ذهبي', es: 'Oro', fr: 'Or', ru: 'Золото' },
  platinum: { en: 'Platinum', he: 'Platinum', ar: 'بلاتيني', es: 'Platino', fr: 'Platine', ru: 'Платина' },
  diamond: { en: 'Diamond', he: 'Diamond', ar: 'ألماسي', es: 'Diamante', fr: 'Diamant', ru: 'Бриллиант' },
  emerald: { en: 'Emerald', he: 'Emerald', ar: 'زمردي', es: 'Esmeralda', fr: 'Émeraude', ru: 'Изумруд' },
  royal: { en: 'Royal', he: 'Royal', ar: 'ملكي', es: 'Real', fr: 'Royal', ru: 'Королевский' },
};

const dashText: Record<string, Record<string, string>> = {
  welcomeBack: {
    en: 'Welcome back',
    he: 'ברוכים השבים',
    ar: 'مرحبًا بعودتك',
    es: 'Bienvenido de nuevo',
    fr: 'Bon retour',
    ru: 'С возвращением',
  },
  yourPersonalSpace: {
    en: 'Your Personal Space',
    he: 'המרחב האישי שלך',
    ar: 'مساحتك الشخصية',
    es: 'Tu Espacio Personal',
    fr: 'Votre Espace Personnel',
    ru: 'Ваше Личное Пространство',
  },
  loyalty: {
    en: 'Loyalty',
    he: 'נאמנות',
    ar: 'الولاء',
    es: 'Lealtad',
    fr: 'Fidélité',
    ru: 'Лояльность',
  },
  member: {
    en: 'Member',
    he: 'חבר',
    ar: 'عضو',
    es: 'Miembro',
    fr: 'Membre',
    ru: 'Участник',
  },
  points: {
    en: 'Points',
    he: 'נקודות',
    ar: 'نقاط',
    es: 'Puntos',
    fr: 'Points',
    ru: 'Баллы',
  },
  wallet: {
    en: 'Wallet Balance',
    he: 'יתרת ארנק',
    ar: 'رصيد المحفظة',
    es: 'Saldo de Cartera',
    fr: 'Solde du Portefeuille',
    ru: 'Баланс Кошелька',
  },
  washCredits: {
    en: 'Wash Credits',
    he: 'קרדיט שטיפות',
    ar: 'رصيد الغسيل',
    es: 'Créditos de Lavado',
    fr: 'Crédits de Lavage',
    ru: 'Кредиты На Мойку',
  },
  giftBalance: {
    en: 'Gift Balance',
    he: 'יתרת מתנות',
    ar: 'رصيد الهدايا',
    es: 'Saldo de Regalos',
    fr: 'Solde Cadeaux',
    ru: 'Баланс Подарков',
  },
  bookWash: {
    en: 'Book a Wash',
    he: 'הזמן שטיפה',
    ar: 'احجز غسلة',
    es: 'Reservar Lavado',
    fr: 'Réserver un Lavage',
    ru: 'Записаться на Мойку',
  },
  viewLoyalty: {
    en: 'View Loyalty Program',
    he: 'צפה בתוכנית הנאמנות',
    ar: 'عرض برنامج الولاء',
    es: 'Ver Programa de Lealtad',
    fr: 'Voir le Programme de Fidélité',
    ru: 'Программа Лояльности',
  },
  myWallet: {
    en: 'My Wallet',
    he: 'הארנק שלי',
    ar: 'محفظتي',
    es: 'Mi Cartera',
    fr: 'Mon Portefeuille',
    ru: 'Мой Кошелёк',
  },
  giftCards: {
    en: 'Gift Cards',
    he: 'כרטיסי מתנה',
    ar: 'بطاقات هدايا',
    es: 'Tarjetas de Regalo',
    fr: 'Cartes Cadeaux',
    ru: 'Подарочные Карты',
  },
  findStation: {
    en: 'Find a Station',
    he: 'מצא תחנה',
    ar: 'ابحث عن محطة',
    es: 'Encontrar Estación',
    fr: 'Trouver une Station',
    ru: 'Найти Станцию',
  },
  myAccount: {
    en: 'My Account',
    he: 'החשבון שלי',
    ar: 'حسابي',
    es: 'Mi Cuenta',
    fr: 'Mon Compte',
    ru: 'Мой Аккаунт',
  },
  inbox: {
    en: 'Inbox',
    he: 'תיבת דואר',
    ar: 'البريد الوارد',
    es: 'Bandeja de Entrada',
    fr: 'Boîte de Réception',
    ru: 'Входящие',
  },
  packages: {
    en: 'Wash Packages',
    he: 'חבילות שטיפה',
    ar: 'باقات الغسيل',
    es: 'Paquetes de Lavado',
    fr: 'Forfaits de Lavage',
    ru: 'Пакеты Мойки',
  },
  petSitting: {
    en: 'Pet Sitting',
    he: 'שמרטפות',
    ar: 'رعاية الحيوانات',
    es: 'Cuidado de Mascotas',
    fr: 'Garde d\'Animaux',
    ru: 'Присмотр за Питомцами',
  },
  dogWalking: {
    en: 'Dog Walking',
    he: 'טיולי כלבים',
    ar: 'تمشية الكلاب',
    es: 'Paseo de Perros',
    fr: 'Promenades de Chiens',
    ru: 'Выгул Собак',
  },
  petTransport: {
    en: 'Pet Transport',
    he: 'הסעת חיות מחמד',
    ar: 'نقل الحيوانات',
    es: 'Transporte de Mascotas',
    fr: 'Transport d\'Animaux',
    ru: 'Перевозка Питомцев',
  },
  loading: {
    en: 'Loading...',
    he: 'טוען...',
    ar: 'جاري التحميل...',
    es: 'Cargando...',
    fr: 'Chargement...',
    ru: 'Загрузка...',
  },
  signOut: {
    en: 'Sign Out',
    he: 'התנתק',
    ar: 'تسجيل الخروج',
    es: 'Cerrar sesión',
    fr: 'Déconnexion',
    ru: 'Выйти',
  },
  securitySettings: {
    en: 'Security & Face ID',
    he: 'אבטחה ו-Face ID',
    ar: 'الأمان وبصمة الوجه',
    es: 'Seguridad y Face ID',
    fr: 'Sécurité et Face ID',
    ru: 'Безопасность и Face ID',
  },
};

function tx(key: string, lang: string): string {
  return dashText[key]?.[lang] || dashText[key]?.en || key;
}

export default function Dashboard() {
  const { user: firebaseUser, loading } = useFirebaseAuth();
  const { language } = useLanguage();
  const [, setLocation] = useLocation();

  const { data: profileData } = useQuery({
    queryKey: ['/api/simple-auth/me'],
    enabled: !!firebaseUser,
  });

  const { data: walletData } = useQuery<{ success: boolean; wallet: WalletSummary }>({
    queryKey: ['/api/credit-wallet/summary'],
    enabled: !!firebaseUser,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/messages/unread/count'],
    enabled: !!firebaseUser,
  });

  const wallet = walletData?.wallet || null;
  const userProfile = (profileData as any)?.user;
  const userName = userProfile?.firstName || firebaseUser?.displayName?.split(' ')[0] || '';
  const unreadCount = unreadData?.count || 0;
  const formatCurrency = (cents: number) => `${(cents / 100).toFixed(0)}`;
  const tierKey = (wallet?.loyaltyTier || 'bronze').toLowerCase();
  const tierLabel = tierLabels[tierKey]?.[language] || tierLabels[tierKey]?.en || 'Bronze';
  const loyaltyPoints = wallet?.loyaltyPointsBalance || 0;
  const totalBalance = wallet ? formatCurrency(wallet.totalCreditsValueCents) : '0';
  const washCredits = wallet?.washPackageCredits || 0;
  const giftBalance = wallet ? formatCurrency(wallet.egiftBalanceCents) : '0';

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <p className="text-sm text-gray-400 tracking-widest uppercase">{tx('loading', language)}</p>
        </div>
      </Layout>
    );
  }

  if (!firebaseUser) {
    setLocation('/signin');
    return null;
  }

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
          
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12 sm:mb-16"
          >
            <p className="text-[11px] tracking-[0.35em] uppercase text-gray-400 mb-3">
              {tx('welcomeBack', language)}
            </p>
            <h1 
              className="text-3xl sm:text-4xl lg:text-5xl text-black font-light mb-2"
              style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', Georgia, serif", letterSpacing: '-0.02em' }}
            >
              {userName || tx('yourPersonalSpace', language)}
            </h1>
            <div className="w-12 h-[1px] bg-black mt-5" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12 sm:mb-16"
          >
            <div className="bg-[#FAFAF9] p-6 sm:p-8">
              <p className="text-[10px] tracking-[0.25em] uppercase text-gray-400 mb-3">{tx('loyalty', language)}</p>
              <p className="text-2xl sm:text-3xl font-light text-black mb-1"
                style={{ fontFamily: "'Playfair Display', serif" }}>
                {loyaltyPoints.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">{tx('points', language)}</p>
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400">
                  {tierLabel} {tx('member', language)}
                </p>
              </div>
            </div>

            <div className="bg-[#FAFAF9] p-6 sm:p-8">
              <p className="text-[10px] tracking-[0.25em] uppercase text-gray-400 mb-3">{tx('wallet', language)}</p>
              <p className="text-2xl sm:text-3xl font-light text-black mb-1"
                style={{ fontFamily: "'Playfair Display', serif" }}>
                {totalBalance}
              </p>
              <p className="text-xs text-gray-500">ILS</p>
            </div>

            <div className="bg-[#FAFAF9] p-6 sm:p-8">
              <p className="text-[10px] tracking-[0.25em] uppercase text-gray-400 mb-3">{tx('washCredits', language)}</p>
              <p className="text-2xl sm:text-3xl font-light text-black mb-1"
                style={{ fontFamily: "'Playfair Display', serif" }}>
                {washCredits}
              </p>
              <p className="text-xs text-gray-500">{tx('washCredits', language)}</p>
            </div>

            <div className="bg-[#FAFAF9] p-6 sm:p-8">
              <p className="text-[10px] tracking-[0.25em] uppercase text-gray-400 mb-3">{tx('giftBalance', language)}</p>
              <p className="text-2xl sm:text-3xl font-light text-black mb-1"
                style={{ fontFamily: "'Playfair Display', serif" }}>
                {giftBalance}
              </p>
              <p className="text-xs text-gray-500">ILS</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-12 sm:mb-16"
          >
            <p className="text-[10px] tracking-[0.3em] uppercase text-gray-400 mb-6">⁦Pet Wash™⁩ Services</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1px] bg-gray-100">
              <button
                onClick={() => setLocation('/stations')}
                className="bg-white p-6 sm:p-8 text-left hover:bg-[#FAFAF9] transition-colors group"
              >
                <p className="text-sm sm:text-base text-black font-normal mb-1 group-hover:text-gray-700 transition-colors">
                  {tx('bookWash', language)}
                </p>
                <p className="text-xs text-gray-400">{tx('findStation', language)}</p>
              </button>
              <button
                onClick={() => setLocation('/sitter-suite')}
                className="bg-white p-6 sm:p-8 text-left hover:bg-[#FAFAF9] transition-colors group"
              >
                <p className="text-sm sm:text-base text-black font-normal mb-1 group-hover:text-gray-700 transition-colors">
                  {tx('petSitting', language)}
                </p>
                <p className="text-xs text-gray-400">⁦The Sitter Suite™⁩</p>
              </button>
              <button
                onClick={() => setLocation('/walk-my-pet')}
                className="bg-white p-6 sm:p-8 text-left hover:bg-[#FAFAF9] transition-colors group"
              >
                <p className="text-sm sm:text-base text-black font-normal mb-1 group-hover:text-gray-700 transition-colors">
                  {tx('dogWalking', language)}
                </p>
                <p className="text-xs text-gray-400">⁦Walk My Pet™⁩</p>
              </button>
              <div
                className="bg-white p-6 sm:p-8 text-left opacity-60 cursor-default"
              >
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm sm:text-base text-black font-normal">
                    {tx('petTransport', language)}
                  </p>
                  <span className="px-1.5 py-0.5 text-[8px] tracking-[0.12em] uppercase font-semibold rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                    {language === 'he' ? 'בקרוב' : 'Soon'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">⁦PetTrek™⁩</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-12 sm:mb-16"
          >
            <p className="text-[10px] tracking-[0.3em] uppercase text-gray-400 mb-6">{tx('myAccount', language)}</p>
            <div className="space-y-[1px] bg-gray-100">
              <Link href="/my-wallet">
                <div className="bg-white p-5 sm:p-6 flex items-center justify-between hover:bg-[#FAFAF9] transition-colors cursor-pointer">
                  <p className="text-sm text-black">{tx('myWallet', language)}</p>
                  <span className="text-xs text-gray-400">&rsaquo;</span>
                </div>
              </Link>
              <Link href="/loyalty/dashboard">
                <div className="bg-white p-5 sm:p-6 flex items-center justify-between hover:bg-[#FAFAF9] transition-colors cursor-pointer">
                  <p className="text-sm text-black">{tx('viewLoyalty', language)}</p>
                  <span className="text-xs text-gray-400">&rsaquo;</span>
                </div>
              </Link>
              <Link href="/gift-cards">
                <div className="bg-white p-5 sm:p-6 flex items-center justify-between hover:bg-[#FAFAF9] transition-colors cursor-pointer">
                  <p className="text-sm text-black">{tx('giftCards', language)}</p>
                  <span className="text-xs text-gray-400">&rsaquo;</span>
                </div>
              </Link>
              <Link href="/packages">
                <div className="bg-white p-5 sm:p-6 flex items-center justify-between hover:bg-[#FAFAF9] transition-colors cursor-pointer">
                  <p className="text-sm text-black">{tx('packages', language)}</p>
                  <span className="text-xs text-gray-400">&rsaquo;</span>
                </div>
              </Link>
              <Link href="/personal-inbox">
                <div className="bg-white p-5 sm:p-6 flex items-center justify-between hover:bg-[#FAFAF9] transition-colors cursor-pointer">
                  <p className="text-sm text-black">
                    {tx('inbox', language)}
                    {unreadCount > 0 && (
                      <span className="ml-3 text-[10px] tracking-wider uppercase text-gray-400">
                        {unreadCount} new
                      </span>
                    )}
                  </p>
                  <span className="text-xs text-gray-400">&rsaquo;</span>
                </div>
              </Link>
              <Link href="/my-account">
                <div className="bg-white p-5 sm:p-6 flex items-center justify-between hover:bg-[#FAFAF9] transition-colors cursor-pointer">
                  <p className="text-sm text-black">{tx('myAccount', language)}</p>
                  <span className="text-xs text-gray-400">&rsaquo;</span>
                </div>
              </Link>
              <Link href="/settings/security">
                <div className="bg-white p-5 sm:p-6 flex items-center justify-between hover:bg-[#FAFAF9] transition-colors cursor-pointer">
                  <p className="text-sm text-black">{tx('securitySettings', language)}</p>
                  <span className="text-xs text-gray-400">&rsaquo;</span>
                </div>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mb-12 sm:mb-16"
          >
            <button
              onClick={async () => {
                try {
                  await signOut(auth);
                  document.cookie = 'pw_session=; Max-Age=0; path=/';
                  window.location.assign('/');
                } catch (e) {
                  window.location.assign('/');
                }
              }}
              className="w-full p-5 sm:p-6 border border-gray-200 flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-4 h-4 text-gray-500" />
              <span className="text-sm tracking-[0.15em] uppercase text-gray-600">
                {tx('signOut', language)}
              </span>
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="border-t border-gray-100 pt-8"
          >
            <p className="text-[10px] tracking-[0.2em] uppercase text-gray-300 text-center">
              ⁦Pet Wash™⁩ 2025 - 2026
            </p>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
