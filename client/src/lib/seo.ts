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
  plushLab: {
    title: '⁦The Plush Lab™⁩ - AI Pet Avatar Creator | יוצר דמויות דיגיטליות',
    description: 'Create AI-powered 3D avatars of your pet — landmark detection, multilingual voices, custom animations. צרו דמות דיגיטלית תלת-ממדית מהחיה שלכם.',
    keywords: 'pet avatar, AI pet photo, 3D pet model, digital pet, דמות דיגיטלית, אווטאר כלב',
    ogType: 'product',
  },
  groomingMarketplace: {
    title: 'Grooming Marketplace - Pet Grooming Bookings | הזמנת גרומינג לכלבים',
    description: 'Book vetted pet groomers in Israel — full grooming, nail trimming, specialty cuts. Home service available from select providers. הזמינו גרומינג לכלבים — טיפוח מלא, גזיזת ציפורניים ותספורות.',
    keywords: 'pet grooming Israel, dog grooming, mobile grooming, pet salon, גרומינג לכלבים, טיפוח כלבים, תספורת לכלבים',
    ogType: 'website',
  },
  locations: {
    title: 'Station Locations - ⁦Pet Wash™⁩ | מיקומי תחנות',
    description: 'Find a K9000 self-service dog wash station near you across Israel. שטיפת כלבים בשירות עצמי — מצאו תחנת K9000 קרובה אליכם.',
    keywords: 'dog wash near me, pet wash locations, K9000 stations, שטיפת כלבים ליד, שטיפת כלבים בשירות עצמי, מיקומי תחנות',
    ogType: 'website',
  },
  packages: {
    title: 'Wash Packages - ⁦Pet Wash™⁩ | חבילות שטיפה',
    description: 'Multi-wash packages for K9000 self-service stations — transparent, VAT-inclusive pricing. חבילות שטיפה לתחנות K9000 במחיר שקוף כולל מע״מ.',
    keywords: 'pet wash packages, dog wash deals, חבילות שטיפה, מחיר שטיפת כלבים',
    ogType: 'product',
  },
  ourService: {
    title: 'Our Service - ⁦Pet Wash™⁩ | השירות שלנו',
    description: 'How PetWash self-service dog washing works — easy, safe and clean, with pet-formulated products. איך עובדת שטיפת כלבים בשירות עצמי — קל, בטוח ונקי, עם מוצרים המותאמים לחיות מחמד.',
    keywords: 'how pet wash works, self-service dog wash, איך שוטפים כלב, שטיפת כלבים בשירות עצמי',
    ogType: 'website',
  },
  gallery: {
    title: 'Gallery - ⁦Pet Wash™⁩ | גלריה',
    description: 'PetWash stations and happy dogs — see the experience. תחנות PetWash וכלבים מרוצים — הציצו בחוויה.',
    keywords: 'pet wash gallery, dog wash photos, גלריה, תמונות שטיפת כלבים',
    ogType: 'website',
  },
  subscriptions: {
    title: 'Subscriptions - ⁦Pet Wash™⁩ | מנויים',
    description: 'PetWash subscription plans for regular washes and care. תוכניות מנוי לשטיפות ולטיפוח קבועים.',
    keywords: 'pet wash subscription, dog wash plan, מנוי שטיפת כלבים, תוכנית טיפוח',
    ogType: 'product',
  },
  petCarePlanner: {
    title: 'Pet Care Planner - ⁦Pet Wash™⁩ | מתכנן טיפול',
    description: 'Plan your pet\'s care schedule — washes, grooming and more. תכננו את לוח הטיפול של חיית המחמד — שטיפות, טיפוח ועוד.',
    keywords: 'pet care planner, dog care schedule, מתכנן טיפול, לוח טיפוח לכלב',
    ogType: 'website',
  },
  academy: {
    title: 'Academy - Dog Training Bookings | אקדמיה — אילוף כלבים',
    description: 'Book vetted dog trainers through the PetWash Academy. הזמינו מאלפי כלבים דרך האקדמיה של PetWash.',
    keywords: 'dog training Israel, dog trainer booking, אילוף כלבים, מאלף כלבים',
    ogType: 'website',
  },
  buyGiftCard: {
    title: 'eGift Cards - ⁦Pet Wash™⁩ | שובר מתנה דיגיטלי',
    description: 'Give the gift of a clean, happy dog — digital gift cards with instant delivery and Apple/Google Wallet. שובר מתנה דיגיטלי לאוהבי כלבים — משלוח מיידי לנייד.',
    keywords: 'pet gift card, dog wash gift, eGift, שובר מתנה לכלב, גיפט קארד חיות מחמד',
    ogType: 'product',
  },
  careers: {
    title: 'Careers - ⁦Pet Wash™⁩ | קריירה',
    description: 'Join the team building premium urban pet-care infrastructure in Israel. הצטרפו לצוות שבונה תשתית טיפול בחיות מחמד בישראל.',
    keywords: 'pet wash careers, jobs, קריירה, דרושים',
    ogType: 'website',
  },
  shop: {
    title: 'The Shop - ⁦Pet Wash™⁩ | החנות',
    description: 'Pet care products, treats and personalised engraved accessories. מוצרי טיפוח, חטיפים ואביזרים בחריטה אישית.',
    keywords: 'pet shop israel, dog treats, engraved pet tag, חנות חיות מחמד, חטיפים לכלבים, חריטה אישית',
    ogType: 'website',
  },
  trust: {
    title: 'Trust & Certifications - ⁦Pet Wash™⁩ | אמון ותקנים',
    description: 'Product safety data sheets and APVMA-GMP manufacturing — the standards behind PetWash products. גיליונות בטיחות ותקני ייצור — הסטנדרטים מאחורי מוצרי PetWash.',
    keywords: 'pet wash certifications, product safety, APVMA, תקנים, בטיחות מוצרים',
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
    setMeta('og:url', seoConfig.canonical || window.location.href, true);
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
    
    // Canonical URL
    if (seoConfig.canonical) {
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', seoConfig.canonical);
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
