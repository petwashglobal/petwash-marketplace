// SEO utilities for Pet Wash™
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
  title: 'Pet Wash™ - Premium Organic Pet Care | שטיפת חיות מחמד אורגנית פרימיום',
  description: 'Israel\'s leading premium organic pet washing service. 5-tier loyalty program (up to 25% discount), AI-powered booking, Apple/Google Wallet integration. שירות שטיפת חיות מחמד אורגני פרימיום מוביל בישראל עם תוכנית נאמנות 5 רמות.',
  keywords: 'pet wash, dog wash, cat wash, organic pet care, Israel pet services, שטיפת כלבים, שטיפת חיות מחמד, שטיפה אורגנית, כלבים ישראל',
  ogImage: 'https://petwash.co.il/IMG_7114_1751624638881.jpeg',
  ogType: 'website',
  locale: 'he_IL',
};

// Page-specific SEO configurations
export const pageSEO: Record<string, SEOConfig> = {
  home: {
    title: 'Pet Wash™ - Premium Organic Pet Care | שטיפת חיות מחמד אורגנית',
    description: 'Israel\'s #1 premium organic pet washing service with K9000 smart stations. Book online, earn loyalty rewards, get weather-based recommendations. שירות שטיפת חיות מחמד אורגני מוביל בישראל עם תחנות חכמות K9000.',
    keywords: 'pet wash Israel, organic dog wash, K9000, smart pet care, שטיפת כלבים אורגנית, תחנות שטיפה חכמות',
    ogType: 'website',
  },
  pricing: {
    title: 'Pricing & Packages - Pet Wash™ | מחירים וחבילות',
    description: 'Transparent pricing for premium organic pet washing. 5-tier loyalty program (New to Diamond) with up to 25% discounts. Gift cards available. מחירים שקופים לשטיפת חיות מחמד אורגנית עם הנחות עד 25%.',
    keywords: 'pet wash prices, dog wash cost, loyalty discounts, מחיר שטיפת כלבים, הנחות נאמנות',
    ogType: 'website',
  },
  about: {
    title: 'About Us - Pet Wash™ | אודות',
    description: 'Learn about Israel\'s leading premium organic pet care platform. Our mission: banking-grade security, organic products, AI-powered service. למד על פלטפורמת טיפול בחיות מחמד אורגנית מובילה בישראל.',
    keywords: 'about pet wash, organic pet care, Israel pet company, אודות שטיפת חיות מחמד',
    ogType: 'website',
  },
  contact: {
    title: 'Contact Us - Pet Wash™ | צור קשר',
    description: 'Get in touch with Pet Wash™. WhatsApp support, email, phone. We\'re here to help with your pet care needs. צור קשר עם Pet Wash™ דרך WhatsApp, אימייל, או טלפון.',
    keywords: 'contact pet wash, customer support, WhatsApp support, תמיכת לקוחות, צור קשר',
    ogType: 'website',
  },
  login: {
    title: 'Login - Pet Wash™ | התחברות',
    description: 'Sign in to your Pet Wash™ account. Access loyalty rewards, booking history, and premium features. התחבר לחשבון Pet Wash™ שלך.',
    keywords: 'pet wash login, customer portal, התחברות, כניסה לחשבון',
    ogType: 'website',
    noindex: true,
  },
  signup: {
    title: 'Sign Up - Pet Wash™ | הרשמה',
    description: 'Create your Pet Wash™ account. Start earning loyalty points instantly, book washes online, and unlock premium rewards. צור חשבון Pet Wash™ והתחל לצבור נקודות מיד.',
    keywords: 'pet wash signup, create account, join loyalty program, הרשמה, יצירת חשבון',
    ogType: 'website',
  },
  vouchers: {
    title: 'Gift Cards & E-Vouchers - Pet Wash™ | שוברי מתנה',
    description: 'Buy digital gift cards for pet lovers. Instant delivery via email, Apple Wallet, Google Wallet. קנה שוברי מתנה דיגיטליים לאוהבי חיות מחמד.',
    keywords: 'pet wash gift card, e-voucher, digital gift, שובר מתנה, גיפט קארד',
    ogType: 'product',
  },
  franchise: {
    title: 'Franchise Opportunities - Pet Wash™ | הזדמנויות זיכיון',
    description: 'Join Israel\'s fastest-growing pet care franchise. Global expansion planned for 2026. Complete support, proven business model. הצטרף לזיכיון טיפול בחיות מחמד המתפתח ביותר בישראל.',
    keywords: 'pet wash franchise, business opportunity, זיכיון, הזדמנות עסקית',
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
    setMeta('og:site_name', 'Pet Wash™', true);
    setMeta('og:locale', seoConfig.locale || 'he_IL', true);
    setMeta('og:locale:alternate', seoConfig.locale === 'he_IL' ? 'en_US' : 'he_IL', true);
    
    if (seoConfig.ogImage) {
      setMeta('og:image', seoConfig.ogImage, true);
      setMeta('og:image:width', '1200', true);
      setMeta('og:image:height', '630', true);
      setMeta('og:image:alt', 'Pet Wash™ - Premium Organic Pet Care', true);
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
    
  }, [config]);
}

/**
 * Generate structured data (JSON-LD) for LocalBusiness
 */
export function generateLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://petwash.co.il/#organization',
    name: 'Pet Wash™',
    alternateName: 'Pet Wash Israel',
    description: 'Premium organic pet washing service in Israel with K9000 smart stations',
    url: 'https://petwash.co.il',
    logo: 'https://petwash.co.il/brand/petwash-logo-official.png',
    image: 'https://petwash.co.il/IMG_7114_1751624638881.jpeg',
    telephone: '+972-XX-XXX-XXXX',
    email: 'Support@PetWash.co.il',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IL',
      addressLocality: 'Israel',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 31.7683,
      longitude: 35.2137,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Sunday'],
        opens: '08:00',
        closes: '20:00',
      },
    ],
    priceRange: '₪₪₪',
    currenciesAccepted: 'ILS',
    paymentAccepted: 'Credit Card, Debit Card, Apple Pay, Google Pay',
    sameAs: [
      'https://www.facebook.com/petwashltd',
      'https://www.instagram.com/petwashltd',
      'https://www.tiktok.com/@petwashltd',
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '156',
      bestRating: '5',
      worstRating: '1',
    },
  };
}

/**
 * Generate structured data for Service
 */
export function generateServiceSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Pet Washing and Grooming',
    provider: {
      '@id': 'https://petwash.co.il/#organization',
    },
    areaServed: {
      '@type': 'Country',
      name: 'Israel',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Pet Washing Services',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Single Pet Wash',
            description: 'Premium organic pet washing service',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: '3 Wash Package',
            description: 'Package of 3 premium washes with loyalty discount',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: '5 Wash Package',
            description: 'Package of 5 premium washes with loyalty discount',
          },
        },
      ],
    },
  };
}

/**
 * Inject structured data into page
 */
export function injectStructuredData(schema: object) {
  const scriptId = 'structured-data';
  let script = document.getElementById(scriptId);
  
  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  
  script.textContent = JSON.stringify(schema);
}

/**
 * Generate hreflang links for bilingual pages
 */
export function generateHreflangLinks(pagePath: string) {
  const baseUrl = 'https://petwash.co.il';
  
  // Remove existing hreflang links
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(link => link.remove());
  
  // Hebrew version
  const heLink = document.createElement('link');
  heLink.rel = 'alternate';
  heLink.hreflang = 'he';
  heLink.href = `${baseUrl}${pagePath}?lang=he`;
  document.head.appendChild(heLink);
  
  // English version
  const enLink = document.createElement('link');
  enLink.rel = 'alternate';
  enLink.hreflang = 'en';
  enLink.href = `${baseUrl}${pagePath}?lang=en`;
  document.head.appendChild(enLink);
  
  // x-default (Hebrew as primary)
  const defaultLink = document.createElement('link');
  defaultLink.rel = 'alternate';
  defaultLink.hreflang = 'x-default';
  defaultLink.href = `${baseUrl}${pagePath}`;
  document.head.appendChild(defaultLink);
}
