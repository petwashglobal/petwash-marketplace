/**
 * Premium platform card content (PR-PREMIUM-CARDS-1).
 *
 * Six platforms in the PetWash ecosystem. Each card carries:
 *   • id           — used for asset lookup ({id}-card.{locale}.webp)
 *   • title        — bilingual (he/en)
 *   • headline     — bilingual emotional one-liner
 *   • subtitle     — bilingual supporting line
 *   • cta          — bilingual button label
 *   • href         — wouter route
 *   • status       — optional badge ("coming-soon" → bilingual badge label)
 *
 * Hard rules (CEO directive 2026-05-10):
 *   • No image text auto-translation. Card text rendered here is
 *     overlaid HTML (selectable, accessible); image text is part
 *     of the static .webp asset only.
 *   • Smart Hub image is the IP-locked K9000 station; never
 *     recreate.
 */

export type CardStatus = 'live' | 'coming-soon';

export interface PlatformCardContent {
  id: string;
  href: string;
  status: CardStatus;
  title: { he: string; en: string };
  headline: { he: string; en: string };
  subtitle: { he: string; en: string };
  cta: { he: string; en: string };
  /** Optional badge label override (default for 'coming-soon' is
   *  the localised "Coming Soon" string). */
  badge?: { he: string; en: string };
}

export const PLATFORM_CARDS: readonly PlatformCardContent[] = [
  {
    id: 'smart-hub',
    href: '/stations',
    status: 'live',
    title: {
      he: 'PetWash Smart Hub',
      en: 'PetWash Smart Hub',
    },
    headline: {
      he: 'טיפול חכם. חיות נקיות. חיים מאושרים.',
      en: 'Smart care. Clean pets. Happy life.',
    },
    subtitle: {
      he: 'רחצה עצמית פרימיום, פתוח 24/7.',
      en: 'Premium self-service pet wash, open 24/7.',
    },
    cta: {
      he: 'מצא תחנה',
      en: 'Find a station',
    },
  },
  {
    id: 'pet-sitter',
    href: '/sitter-suite',
    status: 'live',
    title: {
      he: 'Petsitter',
      en: 'Pet Sitter',
    },
    headline: {
      he: 'טיפול אמין כשאתם לא יכולים להיות שם.',
      en: 'Trusted care when you can’t be there.',
    },
    subtitle: {
      he: 'מטפלים מאומתים. אהבה אמיתית. שקט נפשי.',
      en: 'Verified sitters. Real love. Peace of mind.',
    },
    cta: {
      he: 'מצא מטפל',
      en: 'Find a sitter',
    },
  },
  {
    id: 'petfinder',
    href: '/paw-finder',
    status: 'live',
    title: {
      he: 'פטפיינדר',
      en: 'PetFinder',
    },
    headline: {
      he: 'כל חיית מחמד מגיעה ראויה שיימצאו.',
      en: 'Every pet deserves to be found.',
    },
    subtitle: {
      he: 'טכנולוגיה חכמה. אנשים אמיתיים. מפגשים שמחים.',
      en: 'Smart technology. Real people. Happy reunions.',
    },
    cta: {
      he: 'דווח על חיה אבודה',
      en: 'Report lost pet',
    },
  },
  {
    id: 'pettrek',
    href: '/pettrek',
    status: 'coming-soon',
    title: {
      he: 'פטטרק',
      en: 'PetTrek',
    },
    headline: {
      he: 'הסעות חכמות. חיות מאושרות. שקט נפשי.',
      en: 'Smart transport. Happy pets. Peace of mind.',
    },
    subtitle: {
      he: 'נהגים מאומתים. טיפול אמיתי. שקט נפשי.',
      en: 'Verified drivers. Real care. Peace of mind.',
    },
    cta: {
      he: 'הצטרפו לרשימת ההמתנה',
      en: 'Join the waitlist',
    },
    badge: {
      he: 'בקרוב',
      en: 'Coming Soon',
    },
  },
  {
    id: 'academy',
    href: '/academy',
    status: 'live',
    title: {
      he: 'PetWash Academy',
      en: 'PetWash Academy',
    },
    headline: {
      he: 'לומדים. גדלים. מובילים.',
      en: 'Learn. Grow. Lead.',
    },
    subtitle: {
      he: 'מקדמים את עתיד הטיפול בחיות מחמד.',
      en: 'Elevate the future of pet care.',
    },
    cta: {
      he: 'התחילו את המסע',
      en: 'Start your journey today',
    },
  },
  {
    id: 'walk-my-pet',
    href: '/walk-my-pet',
    status: 'live',
    title: {
      he: 'Walk My Pet',
      en: 'Walk My Pet',
    },
    headline: {
      he: 'כשאתם לא יכולים להיות שם, אנחנו ניקח את הטיול.',
      en: 'When you can’t be there, we’ll take the walk.',
    },
    subtitle: {
      he: 'מולכי כלבים מאומתים. חיות מחמד שמחות. עדכונים בזמן אמת.',
      en: 'Verified walkers. Happy pets. Real-time updates.',
    },
    cta: {
      he: 'הזמן טיול',
      en: 'Book a walk',
    },
  },
] as const;

/**
 * "Platform Universe" section heading — bilingual.
 *
 * The Hebrew variant wraps "PetWash™" in U+2066 (LRI — Left-to-Right
 * Isolate) and U+2069 (PDI — Pop Directional Isolate) so the Latin
 * brand mark + ™ symbol render as a single LTR cluster inside the
 * RTL Hebrew sentence. Without isolation, the Unicode bidirectional
 * algorithm reorders the ™ to the visual left of "PetWash" in RTL
 * context. Matches the pattern already used elsewhere in the
 * codebase (see Footer.tsx, WashPackages.tsx, etc.).
 * CEO directive: ™ must always sit to the right of "PetWash" in
 * every language, including Hebrew and Arabic.
 */
export const PLATFORM_UNIVERSE_HEADING = {
  he: 'עולם ⁦PetWash™⁩',
  en: 'The PetWash™ Platform Universe',
} as const;
