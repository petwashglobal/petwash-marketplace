// SEO utilities for ⁦Pet Wash™⁩
// Comprehensive meta tags, OpenGraph, Twitter Cards, structured data

import { useEffect } from 'react';

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  canonical?: string;
  noindex?: boolean;
  locale?: 'he_IL' | 'en_US';
}

// Default SEO configuration
export const defaultSEO: SEOConfig = {
  title: '⁦Pet Wash™⁩ — Premium Self-Service Dog Wash | שטיפת כלבים בשירות עצמי',
  description: 'Premium K9000 self-service dog wash stations in Israel, plus grooming, dog-walking and pet-sitting bookings. Pet-formulated products, loyalty rewards, Apple/Google Wallet. שטיפת כלבים בשירות עצמי בתחנות K9000 — וגם גרומינג, דוגווקר ופנסיון.',
  keywords: 'self-service dog wash israel, pet wash, dog wash, K9000, Israel pet services, שטיפת כלבים בשירות עצמי, שטיפת כלבים, מקלחת לכלב, כלבים ישראל',
  ogImage: 'https://petwash.co.il/IMG_7114_1751624638881.jpeg',
  ogType: 'website',
  locale: 'he_IL',
};

// Page-specific SEO configurations
export const pageSEO: Record<string, SEOConfig> = {
  home: {
    title: '⁦Pet Wash™⁩ — Premium Self-Service Dog Wash | שטיפת כלבים בשירות עצמי',
    description: 'Premium self-service dog wash at K9000 stations — easy, safe, clean. Book online and earn loyalty rewards. שטיפת כלבים בשירות עצמי בתחנות K9000 — קל, בטוח ונקי. הזמנה אונליין וצבירת נקודות נאמנות.',
    keywords: 'pet wash Israel, self-service dog wash, K9000, smart pet care, שטיפת כלבים בשירות עצמי, תחנות שטיפה חכמות',
    ogType: 'website',
  },
  locations: {
    title: 'Locations - ⁦Pet Wash™⁩ | תחנות שטיפת כלבים בישראל',
    description: 'Find a ⁦Pet Wash™⁩ K9000 self-service dog wash station near you in Israel — addresses, hours and live status. מצאו תחנת שטיפת כלבים בשירות עצמי K9000 קרובה אליכם בישראל.',
    keywords: 'pet wash locations, dog wash near me, K9000 stations Israel, תחנות שטיפת כלבים, שטיפת כלבים בשירות עצמי ליד, מיקומים',
    canonical: 'https://petwash.co.il/locations',
    ogType: 'website',
  },
  pricing: {
    title: 'Pricing & Packages - ⁦Pet Wash™⁩ | מחירים וחבילות',
    description: 'Transparent, all-inclusive pricing for premium pet washing — VAT included, no surprises. Loyalty tier discounts and gift cards available. מחירים שקופים כולל מע״מ, הנחות נאמנות ושוברי מתנה.',
    keywords: 'pet wash prices, dog wash cost, loyalty discounts, מחיר שטיפת כלבים, הנחות נאמנות',
    ogType: 'website',
  },
  about: {
    title: 'About Us - ⁦Pet Wash™⁩ | אודות',
    description: 'Premium urban pet-care infrastructure: K9000 self-service wash stations and a vetted pet-care marketplace, built for modern apartment living. תשתית טיפול בחיות מחמד — תחנות שטיפה בשירות עצמי ומרקטפלייס לשירותי חיות מחמד.',
    keywords: 'about pet wash, pet care infrastructure, Israel pet company, אודות שטיפת חיות מחמד',
    ogType: 'website',
  },
  contact: {
    title: 'Contact Us - ⁦Pet Wash™⁩ | צור קשר',
    description: 'Get in touch with ⁦Pet Wash™⁩. WhatsApp support, email, phone. We\'re here to help with your pet care needs. צור קשר עם ⁦Pet Wash™⁩ דרך WhatsApp, אימייל, או טלפון.',
    keywords: 'contact pet wash, customer support, WhatsApp support, תמיכת לקוחות, צור קשר',
    ogType: 'website',
  },
  login: {
    title: 'Login - ⁦Pet Wash™⁩ | התחברות',
    description: 'Sign in to your ⁦Pet Wash™⁩ account. Access loyalty rewards, booking history, and premium features. התחבר לחשבון ⁦Pet Wash™⁩ שלך.',
    keywords: 'pet wash login, customer portal, התחברות, כניסה לחשבון',
    ogType: 'website',
    noindex: true,
  },
  signup: {
    title: 'Sign Up - ⁦Pet Wash™⁩ | הרשמה',
    description: 'Create your ⁦Pet Wash™⁩ account. Start earning loyalty points instantly, book washes online, and unlock premium rewards. צור חשבון ⁦Pet Wash™⁩ והתחל לצבור נקודות מיד.',
    keywords: 'pet wash signup, create account, join loyalty program, הרשמה, יצירת חשבון',
    ogType: 'website',
  },
  vouchers: {
    title: 'Gift Cards & E-Vouchers - ⁦Pet Wash™⁩ | שוברי מתנה',
    description: 'Buy digital gift cards for pet lovers. Instant delivery via email, Apple Wallet, Google Wallet. קנה שוברי מתנה דיגיטליים לאוהבי חיות מחמד.',
    keywords: 'pet wash gift card, e-voucher, digital gift, שובר מתנה, גיפט קארד',
    ogType: 'product',
  },
  franchise: {
    title: 'Location Partner Review - ⁦Pet Wash™⁩ | בדיקת שותף מיקום',
    description: 'Controlled Pet Wash™ location-partner and licensed-operator review for approved Israeli sites. NDA, site review, support/supply terms, legal/accountant review, and owner approval required.',
    keywords: 'pet wash location partner, licensed operator review, site review, שותף מיקום, מפעיל מורשה, בדיקת אתר',
    ogType: 'website',
  },
  k9000: {
    title: '⁦K9000™⁩ Self-Service Dog Wash Stations - ⁦Pet Wash™⁩ | שטיפת כלבים בשירות עצמי',
    description: 'Premium K9000 self-service dog wash stations — pet-formulated products, contactless payment, easy, safe and clean. שטיפת כלבים בשירות עצמי בתחנות K9000 — קל, בטוח ונקי, מוצרים המותאמים לחיות מחמד.',
    keywords: 'K9000, self-service dog wash, smart pet station, שטיפת כלבים בשירות עצמי, תחנות שטיפה חכמות, מקלחת לכלב',
    ogType: 'product',
  },
  walkMyPet: {
    title: '⁦Walk My Pet™⁩ - Dog Walking Bookings | הזמנת דוגווקר',
    description: 'Book vetted dog walkers in Israel with easy online booking and live walk updates. הזמינו דוגווקר בישראל — הזמנה אונליין פשוטה ועדכונים מהטיול.',
    keywords: 'dog walking Israel, pet walker, dog walker booking, דוגווקר, מטיילי כלבים, שירות הליכה',
    ogType: 'website',
  },
  sitterSuite: {
    title: '⁦The Sitter Suite™⁩ - Pet Sitting Bookings | פנסיון ושמירה לחיות מחמד',
    description: 'Book vetted pet sitters for overnight care, daily visits and boarding — with escrow-protected payments. הזמינו פנסיון ושמירה לחיות מחמד עם תשלום מאובטח בנאמנות.',
    keywords: 'pet sitting Israel, pet boarding, overnight pet care, dog sitter, פנסיון כלבים, שמירה על חיות מחמד',
    ogType: 'website',
  },
  petTrek: {
    title: '⁦PetTrek™⁩ - Pet Transportation | הסעות לחיות מחמד',
    description: 'Pet transport bookings across Israel — vet visits, airport transfers and inter-city travel. הסעות לחיות מחמד בישראל — וטרינר, שדה תעופה ובין-עירוני.',
    keywords: 'pet transport Israel, dog taxi, pet shuttle, vet transport, הסעות כלבים, מונית לחיות מחמד',
    ogType: 'website',
  },
  groomingMarketplace: {
    title: 'Grooming Marketplace - Pet Grooming Bookings | הזמנת גרומינג לכלבים',
    description: 'Book vetted pet groomers in Israel — full grooming, nail trimming, specialty cuts. Home service available from select providers. הזמינו גרומינג לכלבים — טיפוח מלא, גזיזת ציפורניים ותספורות.',
    keywords: 'pet grooming Israel, dog grooming, mobile grooming, pet salon, גרומינג לכלבים, טיפוח כלבים, תספורת לכלבים',
    ogType: 'website',
  },
  // Added 2026-07-12: these pages called useSEO(pageSEO.<key>) for keys that did
  // not exist, so each silently fell back to the generic home title/description.
  packages: {
    title: 'Wash Packages & Pricing - ⁦Pet Wash™⁩ | חבילות שטיפה ומחירים',
    description: 'Self-service ⁦K9000⁩ dog-wash packages and pricing in Israel — a standard wash is ₪55 (VAT included). Loyalty members save more. חבילות שטיפה עצמית ⁦K9000⁩ ומחירים — שטיפה סטנדרטית ₪55 כולל מע״מ, וחברי מועדון חוסכים יותר.',
    keywords: 'pet wash packages, dog wash price Israel, K9000 pricing, חבילות שטיפת כלבים, מחיר שטיפת כלב, ₪55',
    canonical: 'https://petwash.co.il/packages',
    ogType: 'product',
  },
  shop: {
    title: 'Pet Shop - Premium Pet Products | חנות מוצרים לחיות מחמד',
    description: 'Browse premium pet-care products from ⁦Pet Wash™⁩ — shampoos, accessories and more. Online purchases opening soon. עיינו במוצרי טיפוח פרימיום לחיות מחמד — הרכישה אונליין תיפתח בקרוב.',
    keywords: 'pet shop Israel, dog products, pet accessories, מוצרים לחיות מחמד, חנות כלבים, טיפוח כלבים',
    canonical: 'https://petwash.co.il/shop',
    ogType: 'website',
  },
  academy: {
    title: '⁦Pet Wash™⁩ Academy - Dog Training | אקדמיה ואילוף כלבים',
    description: 'Dog-training bookings and pet-care know-how from vetted trainers in Israel. הזמנת אילוף כלבים ותכני טיפוח ממאלפים מנוסים בישראל.',
    keywords: 'dog training Israel, dog trainer, puppy training, אילוף כלבים, מאלף כלבים, אקדמיה לכלבים',
    canonical: 'https://petwash.co.il/academy',
    ogType: 'website',
  },
  subscriptions: {
    title: 'Membership & Plans - ⁦Pet Wash™⁩ | מנויים וחברות מועדון',
    description: 'Join ⁦Pet Wash™⁩ membership for wash savings, loyalty rewards and member-only pricing. הצטרפו לחברות מועדון ⁦Pet Wash™⁩ להטבות, נקודות נאמנות ומחירי חברים.',
    keywords: 'pet wash membership, loyalty club, dog wash subscription, מנוי שטיפת כלבים, מועדון לקוחות, חברות',
    canonical: 'https://petwash.co.il/subscriptions',
    ogType: 'website',
  },
  buyGiftCard: {
    title: 'Buy a Gift Card - ⁦Pet Wash™⁩ | קניית שובר מתנה',
    description: 'Buy a digital ⁦Pet Wash™⁩ gift card — instant delivery by email, Apple Wallet and Google Wallet. קנו שובר מתנה דיגיטלי ⁦Pet Wash™⁩ — משלוח מיידי במייל ובארנק הדיגיטלי.',
    keywords: 'pet wash gift card, buy gift card, e-voucher Israel, שובר מתנה, גיפט קארד, קניית שובר',
    canonical: 'https://petwash.co.il/buy-gift-card',
    ogType: 'product',
  },
  petCarePlanner: {
    title: 'Pet Care Planner - ⁦Pet Wash™⁩ | מתכנן הטיפוח לחיה שלכם',
    description: 'Plan your pet\'s care — washes, grooming, walks and reminders — in one place with ⁦Pet Wash™⁩. תכננו את הטיפוח של החיה שלכם — שטיפות, גרומינג, טיולים ותזכורות — במקום אחד.',
    keywords: 'pet care planner, dog care schedule, pet reminders, מתכנן טיפוח לכלב, לוח טיפול בחיה, תזכורות',
    canonical: 'https://petwash.co.il/pet-care-planner',
    ogType: 'website',
  },
  ourService: {
    title: 'Our Services - ⁦Pet Wash™⁩ | השירותים שלנו',
    description: 'Everything ⁦Pet Wash™⁩ offers — ⁦K9000⁩ self-service dog wash, grooming, dog-walking, pet-sitting and transport, all in one app. כל שירותי ⁦Pet Wash™⁩ — שטיפה עצמית, גרומינג, דוגווקר, פנסיון והסעות באפליקציה אחת.',
    keywords: 'pet services Israel, dog wash grooming walking sitting, שירותי חיות מחמד, שטיפה גרומינג דוגווקר פנסיון',
    canonical: 'https://petwash.co.il/our-service',
    ogType: 'website',
  },
  gallery: {
    title: 'Gallery - ⁦Pet Wash™⁩ | גלריה',
    description: 'See ⁦Pet Wash™⁩ ⁦K9000⁩ stations and happy, clean dogs. צפו בעמדות ⁦K9000⁩ של ⁦Pet Wash™⁩ ובכלבים מטופחים ומאושרים.',
    keywords: 'pet wash gallery, K9000 photos, dog wash Israel, גלריה שטיפת כלבים, תמונות עמדת שטיפה',
    canonical: 'https://petwash.co.il/gallery',
    ogType: 'website',
  },
  careers: {
    title: 'Careers - ⁦Pet Wash™⁩ | דרושים וקריירה',
    description: 'Join the ⁦Pet Wash™⁩ team — open roles for people who love pets and great service. הצטרפו לצוות ⁦Pet Wash™⁩ — משרות פתוחות לאוהבי חיות מחמד ושירות מעולה.',
    keywords: 'pet wash careers, jobs Israel pets, dog company jobs, דרושים, קריירה, משרות',
    canonical: 'https://petwash.co.il/careers',
    ogType: 'website',
  },
  trust: {
    title: 'Trust, Safety & Compliance - ⁦Pet Wash™⁩ | אמון, בטיחות ותאימות',
    description: 'How ⁦Pet Wash™⁩ keeps pets, customers and data safe — vetting, security and compliance standards. כך ⁦Pet Wash™⁩ שומר על חיות המחמד, הלקוחות והמידע — סינון, אבטחה ותקני תאימות.',
    keywords: 'pet wash trust safety, data security, provider vetting, אמון ובטיחות, אבטחת מידע, תאימות',
    canonical: 'https://petwash.co.il/trust',
    ogType: 'website',
  },
  // Added 2026-07-14 (board item 8): public routes that never called useSEO(),
  // so every one of them shipped the generic index.html title/description.
  story: {
    title: 'Our Story & Mission - ⁦Pet Wash™⁩ | הסיפור שלנו',
    description: 'The story behind ⁦Pet Wash™⁩ — building premium self-service dog wash stations and pet-care services in Israel. הסיפור מאחורי ⁦Pet Wash™⁩ — תחנות שטיפה עצמית ושירותי טיפול לחיות מחמד בישראל.',
    keywords: 'pet wash story, about pet wash israel, pet care company, הסיפור שלנו, אודות',
    canonical: 'https://petwash.co.il/story',
    ogType: 'website',
  },
  media: {
    title: 'Media, Photos & Videos - ⁦Pet Wash™⁩ | מדיה ותמונות',
    description: 'Photos and videos of ⁦Pet Wash™⁩ ⁦K9000⁩ stations — station demos and our brand story. תמונות וסרטונים של עמדות ⁦K9000⁩ — הדגמות תחנה וסיפור המותג.',
    keywords: 'pet wash media, K9000 videos, dog wash photos, מדיה, סרטונים, תמונות',
    canonical: 'https://petwash.co.il/media',
    ogType: 'website',
  },
  status: {
    title: 'System Status - ⁦Pet Wash™⁩ | סטטוס מערכת',
    description: 'Live service status for the ⁦Pet Wash™⁩ platform. סטטוס שירות עדכני של פלטפורמת ⁦Pet Wash™⁩.',
    keywords: 'pet wash status, system status, service status, סטטוס מערכת',
    canonical: 'https://petwash.co.il/status',
    ogType: 'website',
  },
  partnersFranchise: {
    title: 'Franchise Enquiries - ⁦Pet Wash™⁩ | פניות זכיינות',
    description: 'Interested in a ⁦Pet Wash™⁩ franchise in Israel? Tell us about yourself and we\'ll be in touch. מתעניינים בזכיינות ⁦Pet Wash™⁩ בישראל? ספרו לנו על עצמכם ונחזור אליכם.',
    keywords: 'pet wash franchise, franchise israel, dog wash franchise, זכיינות, זיכיון שטיפת כלבים',
    canonical: 'https://petwash.co.il/partners/franchise',
    ogType: 'website',
  },
  partnersLocations: {
    title: 'Location Partners - ⁦Pet Wash™⁩ | שותפי מיקום',
    description: 'Offer a location for a ⁦Pet Wash™⁩ ⁦K9000⁩ station — shopping centers, retail and other high-traffic sites. הציעו מיקום לתחנת ⁦K9000⁩ — מרכזי קניות ואתרים עם תנועת לקוחות גבוהה.',
    keywords: 'pet wash location partner, host a dog wash station, שותף מיקום, אירוח תחנת שטיפה',
    canonical: 'https://petwash.co.il/partners/locations',
    ogType: 'website',
  },
  partnersSuppliers: {
    title: 'Supplier Enquiries - ⁦Pet Wash™⁩ | פניות ספקים',
    description: 'Supplier enquiries for ⁦Pet Wash™⁩ — products and services for our stations and marketplace. פניות ספקים ל-⁦Pet Wash™⁩ — מוצרים ושירותים לתחנות ולמרקטפלייס שלנו.',
    keywords: 'pet wash suppliers, pet product supplier israel, ספקים, ספק מוצרי חיות מחמד',
    canonical: 'https://petwash.co.il/partners/suppliers',
    ogType: 'website',
  },
  partnersMunicipal: {
    title: 'Municipal & Council Projects - ⁦Pet Wash™⁩ | פרויקטים עירוניים',
    description: 'Modern pet-care infrastructure for cities and local authorities in Israel. תשתית טיפוח חיות מחמד מודרנית לערים ולרשויות מקומיות בישראל.',
    keywords: 'municipal pet wash, city dog wash station, פרויקטים עירוניים, רשויות מקומיות',
    canonical: 'https://petwash.co.il/partners/municipal',
    ogType: 'website',
  },
  legalIndex: {
    title: 'Legal Center - ⁦Pet Wash™⁩ | מרכז משפטי',
    description: 'All ⁦Pet Wash™⁩ legal documents in one place — terms, privacy, policies and provider agreements. כל המסמכים המשפטיים של ⁦Pet Wash™⁩ — תנאים, פרטיות, מדיניות והסכמי נותני שירות.',
    keywords: 'pet wash legal, terms, privacy, policies, מסמכים משפטיים, תקנון',
    canonical: 'https://petwash.co.il/legal',
    ogType: 'website',
  },
  privacyPolicy: {
    title: 'Privacy Policy - ⁦Pet Wash™⁩ | מדיניות פרטיות',
    description: 'How ⁦Pet Wash™⁩ collects, uses and protects your personal data. כיצד ⁦Pet Wash™⁩ אוספת, משתמשת ומגינה על המידע האישי שלכם.',
    keywords: 'pet wash privacy policy, data protection, מדיניות פרטיות, הגנת מידע',
    canonical: 'https://petwash.co.il/privacy-policy',
    ogType: 'website',
  },
  terms: {
    title: 'Terms of Service - ⁦Pet Wash™⁩ | תנאי שימוש',
    description: 'The terms that govern use of the ⁦Pet Wash™⁩ platform and services. תנאי השימוש בפלטפורמת ⁦Pet Wash™⁩ ובשירותיה.',
    keywords: 'pet wash terms of service, terms and conditions, תנאי שימוש, תקנון',
    canonical: 'https://petwash.co.il/terms',
    ogType: 'website',
  },
  accessibility: {
    title: 'Accessibility Statement - ⁦Pet Wash™⁩ | הצהרת נגישות',
    description: 'The ⁦Pet Wash™⁩ accessibility statement — how we work to make the platform usable for everyone. הצהרת הנגישות של ⁦Pet Wash™⁩ — כך אנו פועלים להנגשת הפלטפורמה לכולם.',
    keywords: 'pet wash accessibility, accessibility statement, הצהרת נגישות, נגישות',
    canonical: 'https://petwash.co.il/accessibility',
    ogType: 'website',
  },
  accountDeletion: {
    title: 'Delete Your Account - ⁦Pet Wash™⁩ | מחיקת חשבון',
    description: 'How to delete your ⁦Pet Wash™⁩ account and associated data. כיצד למחוק את חשבון ⁦Pet Wash™⁩ שלכם ואת המידע הקשור אליו.',
    keywords: 'delete pet wash account, account deletion, data deletion, מחיקת חשבון, מחיקת מידע',
    canonical: 'https://petwash.co.il/account-deletion',
    ogType: 'website',
  },
  marketplace: {
    title: 'Pet Care Marketplace - ⁦Pet Wash™⁩ | מרקטפלייס שירותי חיות מחמד',
    description: 'Browse and book pet-care providers in Israel — grooming, dog-walking, pet-sitting and training. עיינו והזמינו נותני שירות לחיות מחמד בישראל — גרומינג, דוגווקר, פנסיון ואילוף.',
    keywords: 'pet care marketplace israel, book pet services, מרקטפלייס חיות מחמד, הזמנת שירותים לכלב',
    canonical: 'https://petwash.co.il/marketplace',
    ogType: 'website',
  },
  platformHub: {
    title: 'All Services - ⁦Pet Wash™⁩ | כל השירותים',
    description: 'One hub for every ⁦Pet Wash™⁩ service — self-service wash, grooming, dog-walking, pet-sitting and training. כל שירותי ⁦Pet Wash™⁩ במקום אחד — שטיפה עצמית, גרומינג, דוגווקר, פנסיון ואילוף.',
    keywords: 'pet wash services, pet services hub israel, שירותי חיות מחמד, כל השירותים',
    canonical: 'https://petwash.co.il/services',
    ogType: 'website',
  },
  egift: {
    title: 'eGift Cards - ⁦Pet Wash™⁩ | שוברי מתנה דיגיטליים',
    description: 'Send a digital ⁦Pet Wash™⁩ gift card — instant delivery by email. שלחו שובר מתנה דיגיטלי של ⁦Pet Wash™⁩ — משלוח מיידי במייל.',
    keywords: 'pet wash egift, digital gift card, שובר מתנה דיגיטלי, גיפט קארד',
    canonical: 'https://petwash.co.il/egift',
    ogType: 'product',
  },
  loyalty: {
    title: 'Loyalty Program - ⁦Pet Wash™⁩ | מועדון נאמנות',
    description: 'Earn points on washes and bookings, climb tiers and unlock member benefits with ⁦Pet Wash™⁩. צברו נקודות בשטיפות ובהזמנות, טפסו בדרגות ופתחו הטבות חברים עם ⁦Pet Wash™⁩.',
    keywords: 'pet wash loyalty program, member rewards, מועדון נאמנות, צבירת נקודות',
    canonical: 'https://petwash.co.il/loyalty',
    ogType: 'website',
  },
  loyaltyBenefits: {
    title: 'Member Benefits - ⁦Pet Wash™⁩ | הטבות חברים',
    description: 'Loyalty member benefits at ⁦Pet Wash™⁩ — tier discounts and rewards. הטבות חברי מועדון ⁦Pet Wash™⁩ — הנחות לפי דרגה ותגמולים.',
    keywords: 'pet wash member benefits, loyalty discounts, הטבות חברים, הנחות מועדון',
    canonical: 'https://petwash.co.il/loyalty/benefits',
    ogType: 'website',
  },
  loyaltyBirthday: {
    title: 'Birthday Reward - ⁦Pet Wash™⁩ | הטבת יום הולדת',
    description: 'Loyalty members get a birthday treat for their pet. חברי המועדון מקבלים הטבת יום הולדת לחיית המחמד שלהם.',
    keywords: 'pet birthday reward, loyalty birthday, הטבת יום הולדת, יום הולדת לכלב',
    canonical: 'https://petwash.co.il/loyalty/birthday',
    ogType: 'website',
  },
  loyaltyRefer: {
    title: 'Refer a Friend - ⁦Pet Wash™⁩ | חבר מביא חבר',
    description: 'Invite friends to ⁦Pet Wash™⁩ and earn loyalty rewards when they join. הזמינו חברים ל-⁦Pet Wash™⁩ וצברו תגמולי נאמנות כשהם מצטרפים.',
    keywords: 'pet wash referral, refer a friend, חבר מביא חבר, הפניית חברים',
    canonical: 'https://petwash.co.il/loyalty/refer',
    ogType: 'website',
  },
  prestigeClub: {
    title: '⁦Pet Wash Prestige™⁩ Club | מועדון Prestige',
    description: 'The ⁦Pet Wash Prestige™⁩ membership club — why it exists, member tiers and benefits. מועדון החברות ⁦Pet Wash Prestige™⁩ — למה הוא קיים, דרגות חברות והטבות.',
    keywords: 'pet wash prestige, membership club, מועדון פרסטיז׳, מועדון חברים',
    canonical: 'https://petwash.co.il/prestige-club',
    ogType: 'website',
  },
  privilege: {
    title: 'Join the Loyalty Club - ⁦Pet Wash™⁩ | הצטרפות למועדון',
    description: 'Sign up to the ⁦Pet Wash™⁩ loyalty club and start earning points. הצטרפו למועדון הנאמנות של ⁦Pet Wash™⁩ והתחילו לצבור נקודות.',
    keywords: 'join pet wash club, loyalty signup, הצטרפות למועדון, הרשמה למועדון',
    canonical: 'https://petwash.co.il/privilege',
    ogType: 'website',
  },
  daycareCalculator: {
    title: 'Daycare Price Calculator - ⁦Pet Wash™⁩ | מחשבון פנסיון',
    description: 'Estimate daycare and pet-sitting costs for your pet with our smart calculator. העריכו עלות פנסיון ושמירה לחיית המחמד שלכם עם המחשבון החכם שלנו.',
    keywords: 'pet daycare calculator, pet sitting cost, מחשבון פנסיון, עלות שמירה לכלב',
    canonical: 'https://petwash.co.il/daycare-calculator',
    ogType: 'website',
  },
  map: {
    title: 'Station Map - ⁦Pet Wash™⁩ | מפת תחנות',
    description: 'Find ⁦K9000⁩ self-service dog wash stations near you on the map. אתרו תחנות שטיפה עצמית ⁦K9000⁩ בקרבתכם על המפה.',
    keywords: 'pet wash map, dog wash station map, K9000 near me, מפת תחנות, שטיפת כלבים ליד',
    canonical: 'https://petwash.co.il/map',
    ogType: 'website',
  },
  pawFinder: {
    title: '⁦Paw Finder™⁩ - Lost & Found Pets | חיות מחמד אבודות ונמצאות',
    description: 'Community board for lost and found pets in Israel — post a report and help pets get back home. לוח קהילתי לחיות מחמד אבודות ושנמצאו בישראל — פרסמו דיווח ועזרו לחיות לחזור הביתה.',
    keywords: 'lost pet israel, found dog, lost dog board, כלב אבוד, חיה אבודה, חיות שנמצאו',
    canonical: 'https://petwash.co.il/paw-finder',
    ogType: 'website',
  },
  adoption: {
    title: 'Adoption Maison - ⁦Pet Wash™⁩ | אימוץ חיות מחמד',
    description: 'Browse pets looking for a forever home. עיינו בחיות מחמד שמחפשות בית חם לאימוץ.',
    keywords: 'pet adoption israel, adopt a dog, אימוץ כלבים, אימוץ חיות מחמד',
    canonical: 'https://petwash.co.il/adoption',
    ogType: 'website',
  },
  follow: {
    title: 'Follow Us - ⁦Pet Wash™⁩ | עקבו אחרינו',
    description: 'Follow ⁦Pet Wash™⁩ on Instagram, TikTok and Facebook — film your pet\'s wash and tag @petwashltd. עקבו אחרי ⁦Pet Wash™⁩ באינסטגרם, בטיקטוק ובפייסבוק — צלמו את השטיפה ותייגו @petwashltd.',
    keywords: 'pet wash social, instagram petwashltd, עקבו אחרינו, רשתות חברתיות',
    canonical: 'https://petwash.co.il/follow',
    ogType: 'website',
  },
  wallet: {
    title: 'Wallet Pass - ⁦Pet Wash™⁩ | כרטיס לארנק הדיגיטלי',
    description: 'Add your ⁦Pet Wash™⁩ member pass to Apple Wallet or Google Wallet. הוסיפו את כרטיס החבר של ⁦Pet Wash™⁩ ל-Apple Wallet או ל-Google Wallet.',
    keywords: 'pet wash wallet pass, apple wallet, google wallet, כרטיס דיגיטלי, ארנק דיגיטלי',
    canonical: 'https://petwash.co.il/wallet',
    ogType: 'website',
  },
  groomingReviews: {
    title: 'Grooming Reviews - ⁦Pet Wash™⁩ | ביקורות גרומינג',
    description: 'Customer reviews and ratings for grooming services. ביקורות ודירוגים של לקוחות על שירותי גרומינג.',
    keywords: 'grooming reviews israel, dog grooming ratings, ביקורות גרומינג, דירוגי מטפחים',
    canonical: 'https://petwash.co.il/grooming-reviews',
    ogType: 'website',
  },
  platformsHub: {
    title: '⁦Pet Wash™⁩ Hub - All Platforms | כל הפלטפורמות',
    description: 'Jump to every ⁦Pet Wash™⁩ platform — wash stations, pet-sitting, dog-walking, grooming and more. גשו לכל הפלטפורמות של ⁦Pet Wash™⁩ — תחנות שטיפה, פנסיון, דוגווקר, גרומינג ועוד.',
    keywords: 'pet wash hub, pet wash platforms, כל הפלטפורמות, שירותי חיות מחמד',
    canonical: 'https://petwash.co.il/hub',
    ogType: 'website',
  },
};

/**
 * useSEO Hook
 * Updates document meta tags for SEO and social sharing
 */
export function useSEO(config?: Partial<SEOConfig>) {
  useEffect(() => {
    const seoConfig = { ...defaultSEO, ...config };
    
    // Update document title
    document.title = seoConfig.title;
    
    // Helper function to update or create meta tag
    const setMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, name);
        document.head.appendChild(element);
      }
      
      element.setAttribute('content', content);
    };
    
    // Helper function to add or update link tag
    const setLink = (rel: string, href: string, type?: string) => {
      let element = document.querySelector(`link[rel="${rel}"][href="${href}"]`) as HTMLLinkElement;
      
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        element.setAttribute('href', href);
        if (type) {
          element.setAttribute('type', type);
        }
        document.head.appendChild(element);
      }
    };
    
    // Standard meta tags
    if (seoConfig.description) {
      setMeta('description', seoConfig.description);
    }
    
    if (seoConfig.keywords) {
      setMeta('keywords', seoConfig.keywords);
    }
    
    if (seoConfig.noindex) {
      setMeta('robots', 'noindex, nofollow');
    } else {
      setMeta('robots', 'index, follow');
    }
    
    // OpenGraph meta tags (Facebook, WhatsApp, LinkedIn)
    setMeta('og:title', seoConfig.title, true);
    setMeta('og:description', seoConfig.description, true);
    setMeta('og:type', seoConfig.ogType || 'website', true);
    // Canonical/og:url — default to the PRODUCTION origin + current path (query &
    // hash dropped) so every route self-canonicalizes correctly. Before this,
    // useSEO only set a canonical when one was passed explicitly, so every route
    // except home + StationPage inherited index.html's "/" canonical. Uses the
    // hardcoded prod origin (not window.location.origin) so staging/preview hosts
    // never leak into the canonical. An explicit config.canonical still wins.
    const path = window.location.pathname;
    const canonicalHref =
      seoConfig.canonical ?? `https://petwash.co.il${path === '/' ? '/' : path.replace(/\/+$/, '')}`;
    setMeta('og:url', canonicalHref, true);
    setMeta('og:site_name', '⁦Pet Wash™⁩', true);
    setMeta('og:locale', seoConfig.locale || 'he_IL', true);
    setMeta('og:locale:alternate', seoConfig.locale === 'he_IL' ? 'en_US' : 'he_IL', true);
    
    if (seoConfig.ogImage) {
      setMeta('og:image', seoConfig.ogImage, true);
      setMeta('og:image:width', '1200', true);
      setMeta('og:image:height', '630', true);
      setMeta('og:image:alt', '⁦Pet Wash™⁩ — premium self-service dog wash in Israel', true);
    }
    
    // Twitter Card meta tags
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', seoConfig.title);
    setMeta('twitter:description', seoConfig.description);
    if (seoConfig.ogImage) {
      setMeta('twitter:image', seoConfig.ogImage);
    }
    
    // Canonical URL — always set (defaulted above), so non-home routes stop
    // inheriting index.html's "/" canonical.
    {
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', canonicalHref);
    }
    
    // Speed/Performance meta tags (2026 best practices)
    // DNS prefetch for critical domains
    setLink('dns-prefetch', '//petwash.co.il');
    setLink('dns-prefetch', '//fonts.googleapis.com');
    setLink('dns-prefetch', '//fonts.gstatic.com');
    setLink('dns-prefetch', '//www.google-analytics.com');
    setLink('dns-prefetch', '//www.googletagmanager.com');
    
  }, [config]);
}

/* Claim-bearing schema generators (LocalBusiness/Service/FAQ/Website) were
 * DELETED 2026-06-10: they were imported nowhere, yet carried a placeholder
 * phone number, invented opening hours/prices (₪45), "up to 50%" and
 * "Israel's leading" claims — falsehood landmines waiting for a future
 * import. Real LocalBusiness schema returns with the per-station pages PR,
 * generated from live station data. Neutral utilities below are kept.
 */
/**
 * Inject structured data into page
 */
export function injectStructuredData(schema: object) {
  const scriptId = 'structured-data';
  let script = document.getElementById(scriptId) as HTMLScriptElement | null;
  
  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  
  script.textContent = JSON.stringify(schema);
}

/**
 * Generate BreadcrumbList structured data
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  const breadcrumbs = [
    {
      '@type': 'ListItem',
      position: 1,
      name: '⁦Pet Wash™⁩',
      item: 'https://petwash.co.il',
    },
    ...items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 2,
      name: item.name,
      item: item.url,
    })),
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs,
  };
}

/**
 * Generate hreflang links for multilingual pages (supports 6 languages)
 */
export function generateHreflangLinks(pagePath: string) {
  const baseUrl = 'https://petwash.co.il';
  const languages = ['he', 'en', 'ar', 'ru', 'fr', 'es'];
  
  // Remove existing hreflang links
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(link => link.remove());
  
  // Create hreflang links for all supported languages
  languages.forEach((lang) => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = lang;
    link.href = `${baseUrl}${pagePath}?lang=${lang}`;
    document.head.appendChild(link);
  });
  
  // x-default (Hebrew as primary for Israeli audience)
  const defaultLink = document.createElement('link');
  defaultLink.rel = 'alternate';
  defaultLink.hreflang = 'x-default';
  defaultLink.href = `${baseUrl}${pagePath}`;
  document.head.appendChild(defaultLink);
}
