import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { Layout } from '@/components/Layout';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LogOut, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import diamondLogo from '@assets/IMG_3257_1771242993173.png';

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
  privilege: {
    en: 'Privilege',
    he: 'פריבילגיה',
    ar: 'امتياز',
    es: 'Privilegio',
    fr: 'Privilège',
    ru: 'Привилегия',
  },
  loyaltyMemberDashboard: {
    en: 'Loyalty Member',
    he: 'חבר מועדון נאמנות',
    ar: 'عضو برنامج الولاء',
    es: 'Miembro de Lealtad',
    fr: 'Membre Fidélité',
    ru: 'Участник Программы Лояльности',
  },
  balance: {
    en: 'Balance',
    he: 'יתרת ארנק',
    ar: 'الرصيد',
    es: 'Saldo',
    fr: 'Solde',
    ru: 'Баланс',
  },
  currentBalance: {
    en: 'Current balance',
    he: 'יתרה נוכחית',
    ar: 'الرصيد الحالي',
    es: 'Saldo actual',
    fr: 'Solde actuel',
    ru: 'Текущий баланс',
  },
  points: {
    en: 'Points',
    he: 'נקודות',
    ar: 'نقاط',
    es: 'Puntos',
    fr: 'Points',
    ru: 'Баллы',
  },
  availablePoints: {
    en: 'Available points',
    he: 'נקודות זמינות',
    ar: 'النقاط المتاحة',
    es: 'Puntos disponibles',
    fr: 'Points disponibles',
    ru: 'Доступные баллы',
  },
  savedCarers: {
    en: 'Saved Carers',
    he: 'מטפלים שמורים',
    ar: 'مقدمي الرعاية المحفوظين',
    es: 'Cuidadores Guardados',
    fr: 'Soignants Enregistrés',
    ru: 'Сохранённые Опекуны',
  },
  lifetimeValue: {
    en: 'Lifetime Value',
    he: 'ערך מצטבר',
    ar: 'القيمة الكلية',
    es: 'Valor Acumulado',
    fr: 'Valeur Cumulée',
    ru: 'Общая Стоимость',
  },
  totalSpending: {
    en: 'Total spending',
    he: 'סה"כ הוצאות',
    ar: 'إجمالي الإنفاق',
    es: 'Gasto total',
    fr: 'Dépenses totales',
    ru: 'Общие расходы',
  },
  savedCards: {
    en: 'Saved Cards',
    he: 'כרטיסים שמורים',
    ar: 'البطاقات المحفوظة',
    es: 'Tarjetas Guardadas',
    fr: 'Cartes Enregistrées',
    ru: 'Сохранённые Карты',
  },
  paymentMethods: {
    en: 'Payment methods',
    he: 'אמצעי תשלום',
    ar: 'طرق الدفع',
    es: 'Métodos de pago',
    fr: 'Méthodes de paiement',
    ru: 'Способы оплаты',
  },
  comingSoon: {
    en: 'Coming Soon',
    he: 'בקרוב',
    ar: 'قريباً',
    es: 'Próximamente',
    fr: 'Bientôt',
    ru: 'Скоро',
  },
  washCredits: {
    en: 'Wash Credits',
    he: 'קרדיט שטיפות',
    ar: 'رصيد الغسيل',
    es: 'Créditos de Lavado',
    fr: 'Crédits de Lavage',
    ru: 'Кредиты На Мойку',
  },
  bookWash: {
    en: 'Book a Wash',
    he: 'הזמן שטיפה',
    ar: 'احجز غسلة',
    es: 'Reservar Lavado',
    fr: 'Réserver un Lavage',
    ru: 'Записаться на Мойку',
  },
  findStation: {
    en: 'Find a Station',
    he: 'מצא תחנה',
    ar: 'ابحث عن محطة',
    es: 'Encontrar Estación',
    fr: 'Trouver une Station',
    ru: 'Найти Станцию',
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
  myAccount: {
    en: 'My Account',
    he: 'החשבון שלי',
    ar: 'حسابي',
    es: 'Mi Cuenta',
    fr: 'Mon Compte',
    ru: 'Мой Аккаунт',
  },
  myWallet: {
    en: 'My Wallet',
    he: 'הארנק שלי',
    ar: 'محفظتي',
    es: 'Mi Cartera',
    fr: 'Mon Portefeuille',
    ru: 'Мой Кошелёк',
  },
  viewLoyalty: {
    en: 'View Loyalty Program',
    he: 'צפה בתוכנית הנאמנות',
    ar: 'عرض برنامج الولاء',
    es: 'Ver Programa de Lealtad',
    fr: 'Voir le Programme de Fidélité',
    ru: 'Программа Лояльности',
  },
  giftCards: {
    en: 'Gift Cards',
    he: 'כרטיסי מתנה',
    ar: 'بطاقات هدايا',
    es: 'Tarjetas de Regalo',
    fr: 'Cartes Cadeaux',
    ru: 'Подарочные Карты',
  },
  packages: {
    en: 'Wash Packages',
    he: 'חבילות שטיפה',
    ar: 'باقات الغسيل',
    es: 'Paquetes de Lavado',
    fr: 'Forfaits de Lavage',
    ru: 'Пакеты Мойки',
  },
  inbox: {
    en: 'Inbox',
    he: 'תיבת דואר',
    ar: 'البريد الوارد',
    es: 'Bandeja de Entrada',
    fr: 'Boîte de Réception',
    ru: 'Входящие',
  },
  securitySettings: {
    en: 'Security & Face ID',
    he: 'אבטחה ו-Face ID',
    ar: 'الأمان وبصمة الوجه',
    es: 'Seguridad y Face ID',
    fr: 'Sécurité et Face ID',
    ru: 'Безопасность и Face ID',
  },
  member: {
    en: 'Member',
    he: 'חבר',
    ar: 'عضو',
    es: 'Miembro',
    fr: 'Membre',
    ru: 'Участник',
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
  active: {
    en: 'ACTIVE',
    he: 'פעיל',
    ar: 'نشط',
    es: 'ACTIVO',
    fr: 'ACTIF',
    ru: 'АКТИВНЫЙ',
  },
};

function tx(key: string, lang: string): string {
  return dashText[key]?.[lang] || dashText[key]?.en || key;
}

const goldGradient = 'linear-gradient(135deg, #C9A94E 0%, #E5D5A0 40%, #C9A94E 60%, #A8893A 100%)';
const goldText = { color: '#B8972F' };
const goldBorder = '1px solid rgba(201, 169, 78, 0.3)';
const cardBg = '#FFFFFF';
const cardShadow = '0 2px 16px rgba(0, 0, 0, 0.04), 0 1px 4px rgba(0,0,0,0.03)';

function LuxuryCard({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`relative rounded-xl overflow-hidden ${className}`}
      style={{
        background: cardBg,
        border: goldBorder,
        boxShadow: cardShadow,
      }}
    >
      <div
        className="absolute top-0 left-0 w-[3px] h-full rounded-l-xl"
        style={{ background: goldGradient }}
      />
      {children}
    </motion.div>
  );
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
  const giftBalance = wallet ? formatCurrency(wallet.egiftBalanceCents) : '0';

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <img src={diamondLogo} alt="PetWash" className="w-28 h-auto mx-auto mb-4 opacity-60" />
            <p className="text-xs tracking-[0.3em] uppercase" style={goldText}>{tx('loading', language)}</p>
          </motion.div>
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
      <div className="min-h-screen relative bg-white">
        <div className="relative z-10 w-full max-w-lg mx-auto px-4 sm:px-6 pt-6 pb-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-6"
          >
            <img src={diamondLogo} alt="PetWash™" className="w-52 sm:w-60 h-auto mx-auto mb-3" />
            <p
              className="text-lg sm:text-xl tracking-[0.15em] font-light"
              style={{ ...goldText, fontFamily: "'Playfair Display', 'Didot', Georgia, serif" }}
            >
              {tx('privilege', language)}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-center mb-6"
          >
            <h1
              className="text-2xl sm:text-3xl text-gray-900 font-light"
              style={{ fontFamily: "'Playfair Display', 'Didot', Georgia, serif", letterSpacing: '-0.01em' }}
            >
              {userName || tx('privilege', language)}
            </h1>
          </motion.div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <LuxuryCard delay={0.2}>
              <div className="px-3 py-4 sm:px-4 sm:py-5 text-center">
                <p className="text-[10px] sm:text-[11px] tracking-[0.12em] uppercase font-medium mb-2" style={goldText}>
                  {tx('balance', language)}
                </p>
                <p className="text-xl sm:text-2xl font-light text-gray-800 mb-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>
                  <span className="text-sm" style={goldText}>&#8362;</span>{totalBalance}
                </p>
                <p className="text-[9px] sm:text-[10px] text-gray-500 tracking-wide">{tx('currentBalance', language)}</p>
                <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(201,169,78,0.15)' }}>
                  <p className="text-[9px] tracking-[0.1em] uppercase" style={goldText}>ILS</p>
                </div>
              </div>
            </LuxuryCard>

            <LuxuryCard delay={0.25}>
              <div className="px-3 py-4 sm:px-4 sm:py-5 text-center">
                <p className="text-[10px] sm:text-[11px] tracking-[0.12em] uppercase font-medium mb-2" style={goldText}>
                  {tx('points', language)}
                </p>
                <p className="text-xl sm:text-2xl font-light text-gray-800 mb-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {loyaltyPoints.toLocaleString()}
                </p>
                <p className="text-[9px] sm:text-[10px] text-gray-500 tracking-wide">{tx('availablePoints', language)}</p>
                <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(201,169,78,0.15)' }}>
                  <p className="text-[9px] tracking-[0.1em] uppercase" style={goldText}>
                    {tierLabel} {tx('member', language)}
                  </p>
                </div>
              </div>
            </LuxuryCard>

            <LuxuryCard delay={0.3}>
              <div className="px-3 py-4 sm:px-4 sm:py-5 text-center">
                <p className="text-[10px] sm:text-[11px] tracking-[0.12em] uppercase font-medium mb-2" style={goldText}>
                  {tx('savedCarers', language)}
                </p>
                <p className="text-xl sm:text-2xl font-light text-gray-800" style={{ fontFamily: "'Playfair Display', serif" }}>
                  0
                </p>
              </div>
            </LuxuryCard>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <LuxuryCard delay={0.35}>
              <div className="px-3 py-4 sm:px-4 sm:py-5 text-center">
                <p className="text-[10px] sm:text-[11px] tracking-[0.12em] uppercase font-medium mb-2" style={goldText}>
                  {tx('lifetimeValue', language)}
                </p>
                <p className="text-xl sm:text-2xl font-light text-gray-800 mb-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>
                  <span className="text-sm" style={goldText}>&#8362;</span>{giftBalance}
                </p>
                <p className="text-[9px] sm:text-[10px] text-gray-500 tracking-wide">{tx('totalSpending', language)}</p>
              </div>
            </LuxuryCard>

            <LuxuryCard delay={0.4}>
              <div className="px-3 py-4 sm:px-4 sm:py-5 text-center">
                <p className="text-[10px] sm:text-[11px] tracking-[0.12em] uppercase font-medium mb-2" style={goldText}>
                  {tx('savedCards', language)}
                </p>
                <p className="text-xl sm:text-2xl font-light text-gray-800 mb-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>
                  0
                </p>
                <p className="text-[9px] sm:text-[10px] text-gray-500 tracking-wide">{tx('paymentMethods', language)}</p>
              </div>
            </LuxuryCard>

            <LuxuryCard delay={0.45}>
              <div className="px-3 py-4 sm:px-4 sm:py-5 text-center">
                <p className="text-xl sm:text-2xl font-light text-gray-400 mb-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>
                  0
                </p>
                <p className="text-[9px] sm:text-[10px] tracking-wide" style={goldText}>{tx('comingSoon', language)}</p>
              </div>
            </LuxuryCard>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              onClick={() => setLocation('/stations')}
              className="relative rounded-xl overflow-hidden text-center group"
              style={{
                background: '#FFFFFF',
                border: goldBorder,
                boxShadow: cardShadow,
              }}
            >
              <div
                className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: goldGradient }}
              />
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm sm:text-base font-medium text-gray-800 mb-0.5">
                    PetWash Station
                  </p>
                  <p className="text-[10px] text-gray-500">{tx('findStation', language)}</p>
                </div>
                <span
                  className="px-3 py-1 text-[9px] tracking-[0.15em] uppercase font-bold rounded-full text-white"
                  style={{ background: 'linear-gradient(135deg, #8DB255 0%, #6B9F3B 100%)' }}
                >
                  {tx('active', language)}
                </span>
              </div>
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
              className="relative rounded-xl overflow-hidden opacity-60"
              style={{
                background: '#FFFFFF',
                border: goldBorder,
                boxShadow: cardShadow,
              }}
            >
              <div
                className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: goldGradient }}
              />
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm sm:text-base font-medium text-gray-800 mb-0.5">
                    ⁦Walk My Pet™⁩
                  </p>
                  <p className="text-[10px] tracking-wide" style={goldText}>{tx('comingSoon', language)}</p>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              onClick={() => setLocation('/sitter-suite')}
              className="relative rounded-xl overflow-hidden text-center group"
              style={{
                background: '#FFFFFF',
                border: goldBorder,
                boxShadow: cardShadow,
              }}
            >
              <div
                className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: goldGradient }}
              />
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm sm:text-base font-medium text-gray-800 mb-0.5">
                    {tx('petSitting', language)}
                  </p>
                  <p className="text-[10px] text-gray-500">⁦The Sitter Suite™⁩</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.65 }}
              onClick={() => setLocation('/walk-my-pet')}
              className="relative rounded-xl overflow-hidden text-center group"
              style={{
                background: '#FFFFFF',
                border: goldBorder,
                boxShadow: cardShadow,
              }}
            >
              <div
                className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: goldGradient }}
              />
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm sm:text-base font-medium text-gray-800 mb-0.5">
                    {tx('dogWalking', language)}
                  </p>
                  <p className="text-[10px] text-gray-500">⁦Walk My Pet™⁩</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
            </motion.button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="relative rounded-xl overflow-hidden opacity-60"
              style={{
                background: '#FFFFFF',
                border: goldBorder,
                boxShadow: cardShadow,
              }}
            >
              <div
                className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: goldGradient }}
              />
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm sm:text-base font-medium text-gray-800 mb-0.5">
                    {tx('petTransport', language)}
                  </p>
                  <p className="text-[10px] tracking-wide" style={goldText}>⁦PetTrek™⁩ · {tx('comingSoon', language)}</p>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.75 }}
            className="mb-5"
          >
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium mb-3 text-center" style={goldText}>
              {tx('myAccount', language)}
            </p>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: goldBorder, boxShadow: cardShadow }}
            >
              {[
                { label: tx('myWallet', language), href: '/my-wallet' },
                { label: tx('viewLoyalty', language), href: '/loyalty/dashboard' },
                { label: tx('giftCards', language), href: '/gift-cards' },
                { label: tx('packages', language), href: '/packages' },
                { label: tx('inbox', language), href: '/personal-inbox', badge: unreadCount },
                { label: tx('myAccount', language), href: '/my-account' },
                { label: tx('securitySettings', language), href: '/settings/security' },
              ].map((item, idx) => (
                <Link key={item.href} href={item.href}>
                  <div
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-[#F9F9F9] transition-colors cursor-pointer"
                    style={{
                      background: '#FFFFFF',
                      borderBottom: idx < 6 ? '1px solid rgba(201,169,78,0.12)' : 'none',
                    }}
                  >
                    <p className="text-sm text-gray-800">
                      {item.label}
                      {item.badge && item.badge > 0 ? (
                        <span className="ml-2 px-2 py-0.5 text-[9px] tracking-wider uppercase font-semibold rounded-full text-white"
                          style={{ background: 'linear-gradient(135deg, #C9A94E, #A8893A)' }}>
                          {item.badge}
                        </span>
                      ) : null}
                    </p>
                    <ChevronRight className="w-3.5 h-3.5" style={goldText} />
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.75 }}
            className="mb-6"
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
              className="w-full rounded-xl px-5 py-3.5 flex items-center justify-center gap-2.5 transition-all hover:opacity-80"
              style={{
                background: '#FFFFFF',
                border: goldBorder,
                boxShadow: cardShadow,
              }}
            >
              <LogOut className="w-3.5 h-3.5" style={goldText} />
              <span className="text-xs tracking-[0.2em] uppercase font-medium" style={goldText}>
                {tx('signOut', language)}
              </span>
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-center pb-2"
          >
            <p className="text-[9px] tracking-[0.2em] uppercase" style={{ color: 'rgba(184, 151, 47, 0.5)' }}>
              ⁦Pet Wash™⁩ 2025 - 2026
            </p>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
