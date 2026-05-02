/**
 * ⁦Pet Wash™⁩ Global Header 2025
 * Octopus model + Loyalty & VIP Club + 6 languages + luxury menus
 *
 * Platforms:
 * - Pet Wash Hub
 * - Pet Wash Stations
 * - Pet Wash Sitter
 * - Pet Wash Walker
 * - Pet Wash Transport
 * - Pet Wash Academy
 * - Pet Wash Shop (future)
 * - Avatar Studio (FROZEN – show but no live flows)
 *
 * Loyalty & VIP Club:
 * - Free to join for every user
 * - Tiers (example): Member, Silver, Gold, VIP Elite
 * - Benefits: discounted washes, priority booking, birthday gift, VIP events
 * - Refer a friend bonuses
 *
 * Header rules:
 * - Logo always center and dominant
 * - Social icons far left (#PetWashLtd)
 * - Luxury hamburger on the right with deep sections
 * - 6 languages: en, he, ru, fr, es, ar (RTL for he + ar)
 * - Works on iPhone, iPad, laptop, large screens
 *
 * This file assumes Nir's existing CSS classes:
 * pw-header, pw-header-inner, pw-header-left, pw-header-center, pw-header-right,
 * pw-nav-desktop, pw-mega-menu, pw-mega-inner, pw-mobile-drawer, etc.
 */

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiInstagram, SiFacebook, SiTiktok, SiSpotify } from "react-icons/si";
import { Bell } from "lucide-react";
import { useFirebaseAuth } from "../auth/AuthProvider";
import { useAccountNavigation } from "../hooks/useAccountNavigation";
import goldUserIcon from "@assets/IMG_3329_1771419021263.jpeg";

type LangDir = "ltr" | "rtl";

const LANGUAGES: { code: string; label: string; dir: LangDir }[] = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "he", label: "עברית", dir: "rtl" },
  { code: "ru", label: "Русский", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "es", label: "Español", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
];

// Geo-based language detection: Hebrew for Israel, English for rest of world
function detectInitialLanguage(): string {
  if (typeof window === "undefined") return "en";
  
  // Check for saved preference first
  const saved = window.localStorage.getItem("pw_lang");
  if (saved && LANGUAGES.some(l => l.code === saved)) {
    return saved;
  }
  
  // Check for geo-detected country (set by App or geolocation service)
  const countryCode = window.localStorage.getItem("pw_country");
  if (countryCode === "IL") {
    return "he"; // Hebrew default for Israel
  }
  
  // Fallback: Use browser language or default to English (guard against undefined)
  const lang = (navigator?.language || 'en').toLowerCase();
  if (lang.startsWith("he")) return "he";
  if (lang.startsWith("ar")) return "ar";
  if (lang.startsWith("ru")) return "ru";
  if (lang.startsWith("fr")) return "fr";
  if (lang.startsWith("es")) return "es";
  
  return "en"; // English default for rest of world
}

// Async geo-detection to set country code
async function detectCountry(): Promise<string> {
  try {
    const response = await fetch("https://ipapi.co/country_code/", { 
      method: "GET",
      signal: AbortSignal.timeout(3000) 
    });
    if (response.ok) {
      const countryCode = await response.text();
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pw_country", countryCode.trim());
      }
      return countryCode.trim();
    }
  } catch (e) {
    // Fallback silently
  }
  return "";
}

const T: Record<string, Record<string, string>> = {
  "section.platforms": { en: "PLATFORMS", he: "פלטפורמות", ru: "ПЛАТФОРМЫ", fr: "PLATEFORMES", es: "PLATAFORMAS", ar: "المنصات" },
  "group.customer": { en: "Customer platforms", he: "פלטפורמות לקוחות", ru: "Платформы для клиентов", fr: "Plateformes clients", es: "Plataformas para clientes", ar: "منصات العملاء" },
  "group.partners": { en: "Partners, academy and future", he: "שותפים, אקדמיה ועתיד", ru: "Партнёры, академия и будущее", fr: "Partenaires, académie et avenir", es: "Socios, academia y futuro", ar: "شركاء، أكاديمية ومستقبل" },
  "hub.label": { en: "Pet Wash Hub", he: "מרכז ⁦Pet Wash™⁩", ru: "Центр ⁦Pet Wash™⁩", fr: "Centre ⁦Pet Wash™⁩", es: "Centro ⁦Pet Wash™⁩", ar: "مركز ⁦Pet Wash™⁩" },
  "hub.desc": { en: "One 7 star account for all your pets and services", he: "חשבון אחד ב-7 כוכבים לכל חיות המחמד והשירותים שלך", ru: "Один аккаунт 7 звёзд для всех ваших питомцев и услуг", fr: "Un compte 7 étoiles pour tous vos animaux et services", es: "Una cuenta 7 estrellas para todas tus mascotas y servicios", ar: "حساب واحد بسبع نجوم لجميع حيواناتك وخدماتك" },
  "stations.label": { en: "Pet Wash Stations", he: "תחנות ⁦Pet Wash™⁩", ru: "Станции ⁦Pet Wash™⁩", fr: "Stations ⁦Pet Wash™⁩", es: "Estaciones ⁦Pet Wash™⁩", ar: "محطات ⁦Pet Wash™⁩" },
  "stations.desc": { en: "Self service K9000 organic wash locations", he: "תחנות שטיפה אורגנית ⁦K9000™⁩ בשירות עצמי", ru: "Станции органической мойки ⁦K9000™⁩ самообслуживания", fr: "Stations de lavage organique ⁦K9000™⁩ en libre-service", es: "Estaciones de lavado orgánico ⁦K9000™⁩ de autoservicio", ar: "محطات غسيل عضوي ⁦K9000™⁩ ذاتية الخدمة" },
  "sitter.label": { en: "Pet Sitter", he: "שמרטף לחיות מחמד", ru: "Няня для питомцев", fr: "Garde d'animaux", es: "Cuidador de mascotas", ar: "جليس حيوانات أليفة" },
  "sitter.desc": { en: "Trusted pet and home sitting in your neighborhood", he: "שמרטפות אמינות לחיות מחמד ולבית", ru: "Надёжный присмотр за питомцами и домом", fr: "Garde de confiance pour animaux et maison", es: "Cuidado confiable de mascotas y hogar", ar: "رعاية موثوقة للحيوانات الأليفة والمنزل" },
  "walker.label": { en: "Pet Walker", he: "מטייל עם חיות מחמד", ru: "Выгул питомцев", fr: "Promeneur d'animaux", es: "Paseador de mascotas", ar: "مشّاي حيوانات أليفة" },
  "walker.desc": { en: "Walks, play time and outdoor activities", he: "טיולים, משחקים ופעילויות חוץ", ru: "Прогулки, игры и активный отдых", fr: "Promenades, jeux et activités en plein air", es: "Paseos, juegos y actividades al aire libre", ar: "نزهات، وقت لعب وأنشطة خارجية" },
  "transport.label": { en: "Pet Transport", he: "הסעות חיות מחמד", ru: "Перевозка питомцев", fr: "Transport d'animaux", es: "Transporte de mascotas", ar: "نقل حيوانات أليفة" },
  "transport.desc": { en: "Pet taxi between home, sitter and stations (coming soon)", he: "מונית לחיות מחמד בין הבית, המטפל והתחנות (בקרוב)", ru: "Такси для питомцев между домом, няней и станциями (скоро)", fr: "Taxi pour animaux entre domicile, gardien et stations (bientôt)", es: "Taxi para mascotas entre hogar, cuidador y estaciones (próximamente)", ar: "تاكسي حيوانات بين المنزل والجليس والمحطات (قريبًا)" },
  "pawfinder.label": { en: "PawFinder™ – Lost & Found", he: "PawFinder™ – מציאת חיות", ru: "PawFinder™ – Потерянные и найденные", fr: "PawFinder™ – Animaux perdus & trouvés", es: "PawFinder™ – Perdidos y encontrados", ar: "PawFinder™ – المفقود والموجود" },
  "pawfinder.desc": { en: "AI-powered community lost & found for pets", he: "מציאת חיות מחמד אבודות בקהילה בעזרת בינה מלאכותית", ru: "Поиск потерянных питомцев с помощью ИИ", fr: "Animaux perdus et trouvés par la communauté, propulsé par IA", es: "Comunidad de mascotas perdidas y encontradas con IA", ar: "مجتمع إيجاد الحيوانات الضائعة بالذكاء الاصطناعي" },
  "academy.label": { en: "Pet Wash Academy", he: "אקדמיית ⁦Pet Wash™⁩", ru: "Академия ⁦Pet Wash™⁩", fr: "Académie ⁦Pet Wash™⁩", es: "Academia ⁦Pet Wash™⁩", ar: "أكاديمية ⁦Pet Wash™⁩" },
  "academy.desc": { en: "Training, certification and education for pros", he: "הכשרה, הסמכה וחינוך למקצוענים", ru: "Обучение, сертификация и образование для профессионалов", fr: "Formation, certification et éducation pour professionnels", es: "Formación, certificación y educación para profesionales", ar: "تدريب وشهادات وتعليم للمحترفين" },
  "shop.label": { en: "Pet Wash Shop", he: "חנות ⁦Pet Wash™⁩", ru: "Магазин ⁦Pet Wash™⁩", fr: "Boutique ⁦Pet Wash™⁩", es: "Tienda ⁦Pet Wash™⁩", ar: "متجر ⁦Pet Wash™⁩" },
  "shop.desc": { en: "Organic care products and accessories (coming soon)", he: "מוצרי טיפוח אורגניים ואביזרים (בקרוב)", ru: "Органические средства ухода и аксессуары (скоро)", fr: "Produits de soin bio et accessoires (bientôt)", es: "Productos de cuidado orgánico y accesorios (próximamente)", ar: "منتجات عناية عضوية وإكسسوارات (قريبًا)" },
  "avatar.label": { en: "Avatar Studio", he: "סטודיו אווטאר", ru: "Студия аватаров", fr: "Studio Avatar", es: "Estudio Avatar", ar: "استوديو أفاتار" },
  "avatar.desc": { en: "AI pet avatar builder (coming soon)", he: "יוצר אווטאר בינה מלאכותית לחיות מחמד (בקרוב)", ru: "Создание аватаров питомцев с ИИ (скоро)", fr: "Créateur d'avatars IA pour animaux (bientôt)", es: "Creador de avatares IA para mascotas (próximamente)", ar: "صانع صور رمزية بالذكاء الاصطناعي (قريبًا)" },
  "frozen": { en: "Coming Soon", he: "בקרוב", ru: "Скоро", fr: "Bientôt", es: "Próximamente", ar: "قريبًا" },
  "section.loyalty": { en: "LOYALTY, BOOKING AND CLUB", he: "נאמנות, הזמנות ומועדון", ru: "ЛОЯЛЬНОСТЬ, БРОНИРОВАНИЕ И КЛУБ", fr: "FIDÉLITÉ, RÉSERVATION ET CLUB", es: "FIDELIDAD, RESERVAS Y CLUB", ar: "الولاء والحجز والنادي" },
  "booking.label": { en: "Smart booking", he: "הזמנה חכמה", ru: "Умное бронирование", fr: "Réservation intelligente", es: "Reserva inteligente", ar: "حجز ذكي" },
  "loyalty-club.label": { en: "PetWash Privilege", he: "PetWash Privilege", ru: "PetWash Privilege", fr: "PetWash Privilege", es: "PetWash Privilege", ar: "PetWash Privilege" },
  "loyalty-tiers.label": { en: "Tiers: Member, Signature, Elite, Privilege, Black Reserve", he: "דרגות: חבר, Signature, Elite, Privilege, Black Reserve", ru: "Уровни: Участник, Signature, Elite, Privilege, Black Reserve", fr: "Niveaux : Membre, Signature, Elite, Privilege, Black Reserve", es: "Niveles: Miembro, Signature, Elite, Privilege, Black Reserve", ar: "المستويات: عضو، Signature، Elite، Privilege، Black Reserve" },
  "loyalty-benefits.label": { en: "Benefits and perks", he: "הטבות ויתרונות", ru: "Привилегии и бонусы", fr: "Avantages et privilèges", es: "Beneficios y ventajas", ar: "مزايا وامتيازات" },
  "loyalty-birthday.label": { en: "Birthday & special rewards", he: "הטבות יום הולדת ומיוחדות", ru: "Подарки на день рождения и специальные награды", fr: "Récompenses d'anniversaire et spéciales", es: "Recompensas de cumpleaños y especiales", ar: "مكافآت أعياد الميلاد والمكافآت الخاصة" },
  "refer.label": { en: "Refer a friend", he: "הפנה חבר", ru: "Пригласите друга", fr: "Parrainez un ami", es: "Recomienda a un amigo", ar: "أحل صديقًا" },
  "egift.label": { en: "e-Gift", he: "תווי שי דיגיטליים", ru: "Электронные ваучеры", fr: "Bons cadeaux", es: "Vales regalo", ar: "قسائم رقمية" },
  "map.label": { en: "Find a station", he: "מצא תחנה", ru: "Найти станцию", fr: "Trouver une station", es: "Encontrar una estación", ar: "ابحث عن محطة" },
  "section.partners": { en: "PARTNERS & FRANCHISE", he: "שותפים וזכיינות", ru: "ПАРТНЁРЫ И ФРАНШИЗА", fr: "PARTENAIRES ET FRANCHISE", es: "SOCIOS Y FRANQUICIA", ar: "الشركاء والامتياز" },
  "franchise.label": { en: "Franchise & city partners", he: "זכיינות ושותפויות עירוניות", ru: "Франшиза и городские партнёры", fr: "Franchise et partenaires municipaux", es: "Franquicia y socios municipales", ar: "امتياز وشركاء بلديات" },
  "business-locations.label": { en: "Business locations & landlords", he: "מיקומים עסקיים ובעלי נכסים", ru: "Бизнес-площадки и арендодатели", fr: "Emplacements commerciaux et propriétaires", es: "Ubicaciones comerciales y propietarios", ar: "مواقع تجارية وملّاك عقارات" },
  "suppliers.label": { en: "Suppliers & brands", he: "ספקים ומותגים", ru: "Поставщики и бренды", fr: "Fournisseurs et marques", es: "Proveedores y marcas", ar: "موردون وعلامات تجارية" },
  "municipal.label": { en: "Municipal & council projects", he: "פרויקטים עירוניים ומועצתיים", ru: "Муниципальные проекты", fr: "Projets municipaux et communaux", es: "Proyectos municipales", ar: "مشاريع بلدية ومحلية" },
  "section.company": { en: "COMPANY", he: "חברה", ru: "КОМПАНИЯ", fr: "ENTREPRISE", es: "EMPRESA", ar: "الشركة" },
  "about.label": { en: "About Pet Wash", he: "אודות ⁦Pet Wash™⁩", ru: "О ⁦Pet Wash™⁩", fr: "À propos de ⁦Pet Wash™⁩", es: "Acerca de ⁦Pet Wash™⁩", ar: "حول ⁦Pet Wash™⁩" },
  "story.label": { en: "Our story and mission", he: "הסיפור והמשימה שלנו", ru: "Наша история и миссия", fr: "Notre histoire et mission", es: "Nuestra historia y misión", ar: "قصتنا ومهمتنا" },
  "media.label": { en: "Media, photos and videos", he: "מדיה, תמונות וסרטונים", ru: "Медиа, фото и видео", fr: "Médias, photos et vidéos", es: "Medios, fotos y vídeos", ar: "وسائط، صور وفيديوهات" },
  "gallery.label": { en: "Gallery", he: "גלריה", ru: "Галерея", fr: "Galerie", es: "Galería", ar: "معرض" },
  "careers.label": { en: "Careers", he: "קריירה", ru: "Карьера", fr: "Carrières", es: "Empleo", ar: "وظائف" },
  "section.legal": { en: "LEGAL", he: "משפטי", ru: "ЮРИДИЧЕСКАЯ ИНФОРМАЦИЯ", fr: "MENTIONS LÉGALES", es: "LEGAL", ar: "قانوني" },
  "terms.label": { en: "Terms and conditions", he: "תנאים והגבלות", ru: "Условия использования", fr: "Conditions générales", es: "Términos y condiciones", ar: "الشروط والأحكام" },
  "privacy.label": { en: "Privacy & data protection", he: "פרטיות והגנת מידע", ru: "Конфиденциальность и защита данных", fr: "Confidentialité et protection des données", es: "Privacidad y protección de datos", ar: "الخصوصية وحماية البيانات" },
  "egift-policy.label": { en: "eGift and refund policy", he: "מדיניות תווי שי והחזרים", ru: "Политика ваучеров и возвратов", fr: "Politique des bons et remboursement", es: "Política de vales y reembolso", ar: "سياسة القسائم والاسترداد" },
  "loyalty-terms.label": { en: "PetWash Privilege terms", he: "תנאי PetWash Privilege", ru: "Условия PetWash Privilege", fr: "Conditions PetWash Privilege", es: "Términos PetWash Privilege", ar: "شروط PetWash Privilege" },
  "cookies.label": { en: "Cookies & tracking", he: "עוגיות ומעקב", ru: "Файлы cookie и отслеживание", fr: "Cookies et suivi", es: "Cookies y seguimiento", ar: "ملفات تعريف الارتباط والتتبع" },
  "accessibility.label": { en: "Accessibility statement", he: "הצהרת נגישות", ru: "Заявление о доступности", fr: "Déclaration d'accessibilité", es: "Declaración de accesibilidad", ar: "بيان إمكانية الوصول" },
  "section.support": { en: "SUPPORT", he: "תמיכה", ru: "ПОДДЕРЖКА", fr: "ASSISTANCE", es: "SOPORTE", ar: "الدعم" },
  "faq.label": { en: "Help center & FAQ", he: "מרכז עזרה ושאלות נפוצות", ru: "Центр помощи и ЧЗВ", fr: "Centre d'aide et FAQ", es: "Centro de ayuda y preguntas frecuentes", ar: "مركز المساعدة والأسئلة الشائعة" },
  "contact.label": { en: "Contact & WhatsApp", he: "צור קשר ו-WhatsApp", ru: "Контакты и WhatsApp", fr: "Contact et WhatsApp", es: "Contacto y WhatsApp", ar: "اتصل بنا وواتساب" },
  "status.label": { en: "System status", he: "סטטוס מערכת", ru: "Статус системы", fr: "État du système", es: "Estado del sistema", ar: "حالة النظام" },
  "nav.platforms": { en: "Platforms", he: "פלטפורמות", ru: "Платформы", fr: "Plateformes", es: "Plataformas", ar: "المنصات" },
  "nav.loyalty": { en: "PetWash Privilege", he: "PetWash Privilege", ru: "PetWash Privilege", fr: "PetWash Privilege", es: "PetWash Privilege", ar: "PetWash Privilege" },
  "nav.giftCards": { en: "e-Gift", he: "תווי שי דיגיטליים", ru: "Электронные ваучеры", fr: "Bons cadeaux", es: "Vales regalo", ar: "قسائم رقمية" },
  "nav.about": { en: "About", he: "אודות", ru: "О нас", fr: "À propos", es: "Acerca de", ar: "حول" },
  "nav.legal": { en: "Legal", he: "משפטי", ru: "Юридическое", fr: "Légal", es: "Legal", ar: "قانوني" },
  "nav.support": { en: "Support", he: "תמיכה", ru: "Поддержка", fr: "Assistance", es: "Soporte", ar: "الدعم" },
  "account": { en: "Account", he: "חשבון", ru: "Аккаунт", fr: "Compte", es: "Cuenta", ar: "الحساب" },
  "signin": { en: "Sign in", he: "התחברות", ru: "Войти", fr: "Se connecter", es: "Iniciar sesión", ar: "تسجيل الدخول" },
  "signup": { en: "Sign up", he: "הרשמה", ru: "Регистрация", fr: "S'inscrire", es: "Registrarse", ar: "إنشاء حساب" },
  "mydashboard": { en: "My Dashboard", he: "הלוח שלי", ru: "Мой кабинет", fr: "Mon tableau de bord", es: "Mi panel", ar: "لوحتي" },
  "myaccount": { en: "My account", he: "החשבון שלי", ru: "Мой аккаунт", fr: "Mon compte", es: "Mi cuenta", ar: "حسابي" },
  "logout": { en: "Log out", he: "התנתק", ru: "Выйти", fr: "Déconnexion", es: "Cerrar sesión", ar: "تسجيل الخروج" },
};

function t(key: string, lang: string): string {
  return T[key]?.[lang] || T[key]?.en || key;
}

const PLATFORM_ITEMS = [
  { id: "hub", labelKey: "hub.label", descKey: "hub.desc", href: "/hub", frozen: false },
  { id: "stations", labelKey: "stations.label", descKey: "stations.desc", href: "/stations", frozen: false },
  { id: "pawfinder", labelKey: "pawfinder.label", descKey: "pawfinder.desc", href: "/paw-finder", frozen: false },
  { id: "sitter", labelKey: "sitter.label", descKey: "sitter.desc", href: "/sitter-suite", frozen: false },
  { id: "walker", labelKey: "walker.label", descKey: "walker.desc", href: "/walk-my-pet", frozen: false },
  { id: "transport", labelKey: "transport.label", descKey: "transport.desc", href: "/pettrek/book", frozen: true },
];

const PARTNER_ITEMS = [
  { id: "academy", labelKey: "academy.label", descKey: "academy.desc", href: "/academy", frozen: false },
  { id: "shop", labelKey: "shop.label", descKey: "shop.desc", href: "/shop", frozen: true },
  { id: "avatar", labelKey: "avatar.label", descKey: "avatar.desc", href: "#", frozen: true },
];

const PLATFORM_GROUPS = [
  { id: "customer-experience", titleKey: "group.customer", items: PLATFORM_ITEMS },
  { id: "partners-and-growth", titleKey: "group.partners", items: PARTNER_ITEMS },
];

const USER_MENU_ITEMS = [
  { id: "booking", labelKey: "booking.label", href: "/booking" },
  { id: "loyalty-club", labelKey: "loyalty-club.label", href: "/loyalty" },
  { id: "loyalty-tiers", labelKey: "loyalty-tiers.label", href: "/loyalty/tiers" },
  { id: "loyalty-benefits", labelKey: "loyalty-benefits.label", href: "/loyalty/benefits" },
  { id: "loyalty-birthday", labelKey: "loyalty-birthday.label", href: "/loyalty/birthday" },
  { id: "refer", labelKey: "refer.label", href: "/loyalty/refer" },
  { id: "egift", labelKey: "egift.label", href: "/egift" },
  { id: "map", labelKey: "map.label", href: "/map" },
];

const PARTNER_MENU_ITEMS = [
  { id: "franchise", labelKey: "franchise.label", href: "/franchise" },
  { id: "business-locations", labelKey: "business-locations.label", href: "/partners/locations" },
  { id: "suppliers", labelKey: "suppliers.label", href: "/partners/suppliers" },
  { id: "municipal", labelKey: "municipal.label", href: "/partners/municipal" },
];

const COMPANY_MENU_ITEMS = [
  { id: "about", labelKey: "about.label", href: "/about" },
  { id: "story", labelKey: "story.label", href: "/story" },
  { id: "media", labelKey: "media.label", href: "/media" },
  { id: "gallery", labelKey: "gallery.label", href: "/gallery" },
  { id: "careers", labelKey: "careers.label", href: "/careers" },
];

const LEGAL_MENU_ITEMS = [
  { id: "terms", labelKey: "terms.label", href: "/legal/terms" },
  { id: "privacy", labelKey: "privacy.label", href: "/legal/privacy" },
  { id: "egift-policy", labelKey: "egift-policy.label", href: "/legal/egift-policy" },
  { id: "loyalty-terms", labelKey: "loyalty-terms.label", href: "/legal/loyalty-terms" },
  { id: "cookies", labelKey: "cookies.label", href: "/legal/cookies" },
  { id: "accessibility", labelKey: "accessibility.label", href: "/legal/accessibility" },
];

const SUPPORT_MENU_ITEMS = [
  { id: "faq", labelKey: "faq.label", href: "/support" },
  { id: "contact", labelKey: "contact.label", href: "/contact" },
  { id: "status", labelKey: "status.label", href: "/status" },
];

// Optional props for controlled component mode
interface PetWashHeaderProps {
  language?: string;
  onLanguageChange?: (language: string) => void;
}

export const PetWashHeader: React.FC<PetWashHeaderProps> = ({ 
  language: controlledLanguage, 
  onLanguageChange: controlledOnLanguageChange 
}) => {
  const { user, loading, logout } = useFirebaseAuth();
  const { resolveAccountRoute } = useAccountNavigation();
  const [isResolvingProfile, setIsResolvingProfile] = useState(false);

  /**
   * Navigate to the user's account destination. The gold profile icon must
   * NEVER feel dead — even before Firebase auth has resolved on iPhone Safari
   * (where ITP cookie partitioning can delay claim propagation by seconds).
   *
   * resolveAccountRoute() returns a real route in every case:
   *   - waits up to 1.5s for auth to settle
   *   - tries claims-based fast path
   *   - falls back to POST /api/auth/post-login (Bearer + cookie)
   *   - safe default '/home' if everything else fails
   */
  const handleProfileNavigate = async () => {
    if (isResolvingProfile) return; // already in flight — debounce double-tap
    setIsResolvingProfile(true);
    try {
      const route = await resolveAccountRoute();
      handleNavigate(route);
    } catch (err) {
      // resolveAccountRoute is itself failure-tolerant — but belt + braces:
      // a thrown exception still lands the user somewhere they can navigate.
      console.error('[handleProfileNavigate] unexpected error', err);
      handleNavigate('/home');
    } finally {
      // window.location.assign typically unloads the page before this runs.
      // Reset state in case navigation was cancelled (e.g., service-worker
      // intercept) so a future click is not stuck "in flight" forever.
      setIsResolvingProfile(false);
    }
  };

  const [internalLanguage, setInternalLanguage] = useState<string>(detectInitialLanguage);
  const [isPlatformsOpen, setIsPlatformsOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Unread message count for badge on Messages nav link
  const { data: inboxConversations } = useQuery<any[]>({
    queryKey: ["/api/booking-chat/inbox"],
    refetchInterval: 30000,
    enabled: !!user,
  });
  const totalUnreadMessages = inboxConversations?.reduce((sum: number, c: any) => {
    const myUnread = user?.uid === c.customerId ? (c.customerUnread ?? 0) : (c.providerUnread ?? 0);
    return sum + myUnread;
  }, 0) ?? 0;

  // Unread in-app notification count for bell badge
  const { data: unreadCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 60000,
    enabled: !!user,
  });
  const unreadNotificationCount = unreadCountData?.count ?? 0;

  // Use controlled value if provided, otherwise use internal state
  const currentLanguage = controlledLanguage !== undefined ? controlledLanguage : internalLanguage;
  
  // Apply RTL or LTR to html element
  useEffect(() => {
    const selected = LANGUAGES.find((l) => l.code === currentLanguage);
    const dir: LangDir = selected?.dir || "ltr";

    if (typeof document !== "undefined") {
      document.documentElement.dir = dir;
      document.documentElement.lang = currentLanguage;
    }
  }, [currentLanguage]);

  // Close platforms mega menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".pw-nav-item-platforms")) {
        setIsPlatformsOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Restore saved language (only in uncontrolled mode)
  useEffect(() => {
    if (controlledLanguage !== undefined) return; // Skip if controlled
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("pw_lang");
    if (saved && LANGUAGES.some((l) => l.code === saved)) {
      setInternalLanguage(saved);
    }
  }, [controlledLanguage]);

  // Geo-detection for language default (Hebrew for Israel, English outside)
  useEffect(() => {
    if (controlledLanguage !== undefined) return; // Skip if controlled
    if (typeof window === "undefined") return;
    
    // Only run geo-detection if no saved preference and no country yet
    const saved = window.localStorage.getItem("pw_lang");
    const country = window.localStorage.getItem("pw_country");
    
    if (!saved && !country) {
      detectCountry().then((countryCode) => {
        if (countryCode === "IL") {
          setInternalLanguage("he");
        }
        // For other countries, keep the default (English)
      });
    }
  }, [controlledLanguage]);

  const handleNavigate = (href: string) => {
    if (!href || href === "#") return;
    if (href.startsWith("http")) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.assign(href);
    setIsMobileOpen(false);
  };

  const handleLanguageChange = (code: string) => {
    // If controlled, call the parent handler
    if (controlledOnLanguageChange) {
      controlledOnLanguageChange(code);
    } else {
      // Uncontrolled mode: update internal state
      setInternalLanguage(code);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pw_lang", code);
      }
    }
  };

  return (
    <>
      {/* Main header */}
      <header className="pw-header" role="banner">
        {/* ROW 1: Logo centered at top - crown position */}
        <div className="pw-header-row-logo">
          <button
            type="button"
            className="pw-logo-link"
            style={{ touchAction: 'manipulation', cursor: 'pointer' }}
            onClick={() => handleNavigate("/")}
            aria-label="Pet Wash home"
          >
            <img 
              src="/brand/petwash-logo-official.png" 
              alt="⁦PetWash™⁩" 
              className="pw-header-logo-img"
            />
          </button>
        </div>

        {/* ROW 2: Social left | Nav center | Profile + Burger + Lang right */}
        <div className="pw-header-row-controls">
          <div className="pw-header-left">
            <a className="pw-social-link pw-social-spotify" href="https://open.spotify.com/user/31ff52czgq4ezgui5ufyplo5mrbq" target="_blank" rel="noreferrer" aria-label="Pet Wash Spotify" data-testid="link-social-spotify">
              <SiSpotify size={18} />
            </a>
            <a className="pw-social-link pw-social-tiktok" href="https://www.tiktok.com/@petwashltd" target="_blank" rel="noreferrer" aria-label="Pet Wash TikTok" data-testid="link-social-tiktok">
              <SiTiktok size={18} />
            </a>
            <a className="pw-social-link pw-social-facebook" href="https://www.facebook.com/petwashltd" target="_blank" rel="noreferrer" aria-label="Pet Wash Facebook" data-testid="link-social-facebook">
              <SiFacebook size={18} />
            </a>
            <a className="pw-social-link pw-social-instagram" href="https://www.instagram.com/petwashltd" target="_blank" rel="noreferrer" aria-label="Pet Wash Instagram" data-testid="link-social-instagram">
              <SiInstagram size={18} />
            </a>
          </div>

          <nav className="pw-nav-desktop">
            <div className="pw-nav-item pw-nav-item-platforms">
              <button
                type="button"
                className="pw-nav-link"
                style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                aria-expanded={isPlatformsOpen}
                aria-haspopup="true"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlatformsOpen((prev) => !prev);
                }}
              >
                {t("nav.platforms", currentLanguage)}
              </button>
              {isPlatformsOpen && (
                <div className="pw-mega-menu" role="menu">
                  <div className="pw-mega-inner">
                    {PLATFORM_GROUPS.map((group) => (
                      <div className="pw-mega-column" key={group.id} role="group" aria-label={t(group.titleKey, currentLanguage)}>
                        <div className="pw-mega-title">{t(group.titleKey, currentLanguage)}</div>
                        {group.items.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            role="menuitem"
                            className={"pw-mega-link" + (item.frozen ? " pw-mega-link-frozen" : "")}
                            style={{ touchAction: 'manipulation', cursor: item.frozen ? 'default' : 'pointer' }}
                            disabled={item.frozen}
                            onClick={() => { if (item.frozen) return; handleNavigate(item.href); }}
                          >
                            <span>{t(item.labelKey, currentLanguage)}</span>
                            {item.frozen ? (
                              <span className="pw-pill-frozen">{t("frozen", currentLanguage)}</span>
                            ) : (
                              <span style={{ opacity: 0.6, fontSize: 11, marginInlineStart: 8 }}>
                                {t(item.descKey, currentLanguage)}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="pw-nav-item">
              <button type="button" className="pw-nav-link" style={{ touchAction: 'manipulation', cursor: 'pointer' }} onClick={() => handleNavigate("/loyalty")}>
                {t("nav.loyalty", currentLanguage)}
              </button>
            </div>
            <div className="pw-nav-item">
              <button type="button" className="pw-nav-link" style={{ touchAction: 'manipulation', cursor: 'pointer' }} onClick={() => handleNavigate("/egift")}>
                {t("nav.giftCards", currentLanguage)}
              </button>
            </div>
          </nav>

          <div className="pw-header-right">
            {/* Notification bell — visible when user is logged in */}
            {user && (
              <button
                type="button"
                className="pw-header-icon-btn"
                style={{ position: 'relative', touchAction: 'manipulation', cursor: 'pointer', background: 'none', border: 'none', padding: '6px', borderRadius: '50%' }}
                onClick={() => handleNavigate('/notifications')}
                aria-label="Notifications"
                data-testid="button-notifications-bell"
              >
                <Bell size={22} style={{ color: 'var(--pw-icon-color, #fff)' }} />
                {unreadNotificationCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      lineHeight: 1,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 3px',
                    }}
                  >
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              className="pw-header-profile-btn"
              style={{ touchAction: 'manipulation', cursor: 'pointer' }}
              onClick={handleProfileNavigate}
              aria-label={user ? t("mydashboard", currentLanguage) : t("signin", currentLanguage)}
              aria-busy={(loading || isResolvingProfile) || undefined}
              data-testid="button-header-profile"
            >
              <div className="pw-header-profile-circle">
                <img src={goldUserIcon} alt="" className="pw-header-profile-img" />
              </div>
            </button>
            <button
              type="button"
              className="pw-burger pw-burger-luxury"
              style={{ touchAction: 'manipulation', cursor: 'pointer' }}
              onClick={() => setIsMobileOpen(true)}
              aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileOpen}
              aria-controls="pw-mobile-drawer"
              data-testid="button-hamburger"
            >
              <span />
              <span />
              <span />
            </button>
            <select
              className="pw-language-select pw-language-luxury"
              value={currentLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              data-testid="select-language"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobile nav strip - single tight row below header on small screens only (<768px) */}
        <div className="pw-mobile-nav-strip">
          <div className="pw-mobile-nav-strip-row">
            <button type="button" className="pw-mobile-nav-strip-link" style={{ touchAction: 'manipulation', cursor: 'pointer' }} onClick={() => handleNavigate("/egift")}>
              {t("nav.giftCards", currentLanguage)}
            </button>
            <span className="pw-mobile-nav-strip-dot">·</span>
            <button type="button" className="pw-mobile-nav-strip-link" style={{ touchAction: 'manipulation', cursor: 'pointer' }} onClick={() => handleNavigate("/loyalty")}>
              {t("nav.loyalty", currentLanguage)}
            </button>
            <span className="pw-mobile-nav-strip-dot">·</span>
            <button type="button" className="pw-mobile-nav-strip-link" style={{ touchAction: 'manipulation', cursor: 'pointer' }} onClick={() => setIsMobileOpen(true)}>
              {t("nav.platforms", currentLanguage)}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer overlay backdrop */}
      <div
        className={`pw-drawer-overlay ${isMobileOpen ? "open" : ""}`}
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <div 
        id="pw-mobile-drawer"
        className={`pw-mobile-drawer ${isMobileOpen ? "open" : ""}`}
        aria-hidden={!isMobileOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="pw-mobile-top">
          <button
            type="button"
            className="pw-mobile-close"
            style={{ touchAction: 'manipulation', cursor: 'pointer' }}
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close menu"
            tabIndex={isMobileOpen ? 0 : -1}
          >
            ✕
          </button>
        </div>

        <div className="pw-mobile-logo-wrap">
          <button
            type="button"
            className="pw-logo-link-mobile"
            style={{ touchAction: 'manipulation', cursor: 'pointer' }}
            onClick={() => {
              handleNavigate("/");
              setIsMobileOpen(false);
            }}
            aria-label="Pet Wash home"
          >
            <img 
              src="/brand/petwash-logo-official.png" 
              alt="⁦PetWash™⁩" 
              className="pw-mobile-logo-img"
            />
          </button>
        </div>

        {/* Language + account row */}
        <div className="pw-mobile-lang-row">
          <select
            className="pw-language-select"
            value={currentLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="pw-account-btn"
            style={{ touchAction: 'manipulation', cursor: 'pointer' }}
            onClick={handleProfileNavigate}
            aria-busy={(loading || isResolvingProfile) || undefined}
            data-testid="button-mobile-account-gold"
          >
            <div className="pw-account-circle">
              <img src={goldUserIcon} alt="" className="pw-account-gold-icon" />
            </div>
          </button>
        </div>

        {/* Scrollable menu content */}
        <div className="pw-mobile-menu-scroll">
          {/* Platforms */}
          <div className="pw-mobile-section">
            <div className="pw-mobile-section-title">{t("section.platforms", currentLanguage)}</div>
            {PLATFORM_GROUPS.map((group) => (
              <div className="pw-mobile-group" key={group.id}>
                <div className="pw-mobile-group-title">{t(group.titleKey, currentLanguage)}</div>
                <div className="pw-mobile-group-items">
                  {group.items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={
                        "pw-mobile-link" +
                        (item.frozen ? " pw-mega-link-frozen" : "")
                      }
                      style={{ touchAction: 'manipulation', cursor: item.frozen ? 'default' : 'pointer' }}
                      onClick={() => {
                        if (item.frozen) return;
                        handleNavigate(item.href);
                      }}
                    >
                      <span>{t(item.labelKey, currentLanguage)}</span>
                      {item.frozen && (
                        <span className="pw-pill-frozen">{t("frozen", currentLanguage)}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Loyalty & VIP Club + user items */}
          <div className="pw-mobile-section">
            <div className="pw-mobile-section-title">
              {t("section.loyalty", currentLanguage)}
            </div>
            {USER_MENU_ITEMS.map((item) => (
              <button
                type="button"
                key={item.id}
                className="pw-mobile-link"
                style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                onClick={() => handleNavigate(item.href)}
              >
                <span>{t(item.labelKey, currentLanguage)}</span>
              </button>
            ))}
          </div>

          {/* Partners */}
          <div className="pw-mobile-section">
            <div className="pw-mobile-section-title">{t("section.partners", currentLanguage)}</div>
            {PARTNER_MENU_ITEMS.map((item) => (
              <button
                type="button"
                key={item.id}
                className="pw-mobile-link"
                style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                onClick={() => handleNavigate(item.href)}
              >
                {t(item.labelKey, currentLanguage)}
              </button>
            ))}
          </div>

          {/* Company */}
          <div className="pw-mobile-section">
            <div className="pw-mobile-section-title">{t("section.company", currentLanguage)}</div>
            {COMPANY_MENU_ITEMS.map((item) => (
              <button
                type="button"
                key={item.id}
                className="pw-mobile-link"
                style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                onClick={() => handleNavigate(item.href)}
              >
                {t(item.labelKey, currentLanguage)}
              </button>
            ))}
          </div>

          {/* Legal */}
          <div className="pw-mobile-section">
            <div className="pw-mobile-section-title">{t("section.legal", currentLanguage)}</div>
            {LEGAL_MENU_ITEMS.map((item) => (
              <button
                type="button"
                key={item.id}
                className="pw-mobile-link"
                style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                onClick={() => handleNavigate(item.href)}
              >
                {t(item.labelKey, currentLanguage)}
              </button>
            ))}
          </div>

          {/* Support */}
          <div className="pw-mobile-section">
            <div className="pw-mobile-section-title">{t("section.support", currentLanguage)}</div>
            {SUPPORT_MENU_ITEMS.map((item) => (
              <button
                type="button"
                key={item.id}
                className="pw-mobile-link"
                style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                onClick={() => handleNavigate(item.href)}
              >
                {t(item.labelKey, currentLanguage)}
              </button>
            ))}
          </div>

          {/* Account / Sign in / Sign out */}
          <div className="pw-mobile-section">
            <div className="pw-mobile-section-title">
              {user ? t("account", currentLanguage) : t("signin", currentLanguage)}
            </div>
            {user ? (
              <>
                <button
                  type="button"
                  className="pw-mobile-link"
                  style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                  onClick={handleProfileNavigate}
                  aria-busy={(loading || isResolvingProfile) || undefined}
                  data-testid="button-mobile-menu-account"
                >
                  {t("mydashboard", currentLanguage)}
                </button>
                <button
                  type="button"
                  className="pw-mobile-link"
                  style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                  onClick={() => handleNavigate("/my-account")}
                >
                  {t("myaccount", currentLanguage)}
                </button>
                <button
                  type="button"
                  className="pw-mobile-link pw-logout-btn"
                  style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                  onClick={async () => {
                    await logout();
                    setIsMobileOpen(false);
                    window.location.assign("/");
                  }}
                >
                  {t("logout", currentLanguage)}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="pw-mobile-link"
                  style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                  onClick={() => handleNavigate("/signin")}
                >
                  {t("signin", currentLanguage)}
                </button>
                <button
                  type="button"
                  className="pw-mobile-link"
                  style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                  onClick={() => handleNavigate("/signup")}
                >
                  {t("signup", currentLanguage)}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
