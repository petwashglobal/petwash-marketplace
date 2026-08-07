/**
 * Prerendered public LANDING pages for crawlers + AI answer engines.
 *
 * PROBLEM: PetWash is a Vite SPA. Firebase Hosting serves index.html for every
 * route, whose <noscript> is just "JavaScript Required". So /sitter-suite,
 * /walk-my-pet and /academy — real paid-service pages listed in sitemap.xml —
 * are BLANK to non-JS crawlers (ChatGPT/Perplexity/Bing) and fragile for Google.
 *
 * FIX (this module): read the BUILT index.html (so the hashed asset tags are
 * always current), inject route-specific <title>/description/canonical + Service
 * JSON-LD, and inject real, crawlable content INTO <div id="root">. Non-JS
 * crawlers read that content; a human's React app mounts into #root and replaces
 * it with the live page. No build-pipeline change, no asset-hash drift.
 *
 * Wired the SAME way as sitemap.xml/robots.txt: a Firebase Hosting rewrite sends
 * the exact landing path to Cloud Run (Express), which calls this.
 *
 * COPY RULES (petwash-marketing-legal): truthful + conservative only. No fake
 * reviews, no guaranteed-safety, no medical/eco claims, no invented prices or
 * discounts. Prices/policies are described as "shown before you book", never a
 * specific number here.
 */
import fs from 'fs';
import path from 'path';

export interface LandingContent {
  slug: string;
  titleHe: string; titleEn: string;
  descHe: string; descEn: string;
  h1He: string; h1En: string;
  /** Ordered {heading, body} sections, He + En. */
  sections: Array<{ hHe: string; hEn: string; pHe: string; pEn: string }>;
  /** Real anchor CTAs (customer + provider go to DIFFERENT paths). */
  ctas: Array<{ href: string; he: string; en: string }>;
  /** schema.org Service type. */
  serviceType: string;
}

export const LANDING_PAGES: Record<string, LandingContent> = {
  'sitter-suite': {
    slug: 'sitter-suite',
    titleHe: 'פט סיטר — הזמנת בייביסיטר לחיות מחמד | PetWash™',
    titleEn: 'Pet Sitter — Book a Verified Pet Sitter in Israel | PetWash™',
    descHe: 'הזמינו פט סיטר מאומת ב-PetWash — טיפול בבית שלכם או אצל המטפל. כל המטפלים עוברים אימות זהות וסקירה. המחיר מוצג לפני ההזמנה. עברית ואנגלית.',
    descEn: 'Book a verified pet sitter with PetWash — care in your home or the sitter\'s. Every sitter passes identity verification and review. See the price before you book.',
    h1He: 'פט סיטר — טיפול אמין בחיה שלכם',
    h1En: 'Pet Sitter — trusted care for your pet',
    serviceType: 'PetSitting',
    sections: [
      { hHe: 'מה זה פט סיטר?', hEn: 'What is Pet Sitter?', pHe: 'שירות הזמנת מטפלים לחיות מחמד — בביקורי בית או אירוח אצל המטפל, לפי מה שמתאים לכם ולחיה.', pEn: 'A booking service that matches you with pet sitters — in-home visits or hosting at the sitter, whichever suits you and your pet.' },
      { hHe: 'איך מזמינים?', hEn: 'How booking works', pHe: 'בוחרים מטפל ותאריכים, מוסיפים את פרטי החיה, והמחיר מוצג לפני האישור. התשלום מאובטח ומתבצע דרך PetWash.', pEn: 'Pick a sitter and dates, add your pet\'s details, and the price is shown before you confirm. Payment is secured through PetWash.' },
      { hHe: 'אמון ובטיחות', hEn: 'Trust & safety', pHe: 'מטפלים עוברים אימות זהות וסקירה לפני אישור. יש מדיניות ביטול ותהליך תמיכה זמין.', pEn: 'Sitters pass identity verification and review before approval. A cancellation policy and support process apply.' },
    ],
    ctas: [
      { href: '/sitter-suite/browse', he: 'הזמנת מטפל', en: 'Book a sitter' },
      { href: '/apply-provider', he: 'להצטרף כמטפל', en: 'Become a sitter' },
    ],
  },
  'walk-my-pet': {
    slug: 'walk-my-pet',
    titleHe: 'Walk My Pet — הזמנת דוגווקר | PetWash™',
    titleEn: 'Walk My Pet — Book a Dog Walk in Israel | PetWash™',
    descHe: 'הזמינו טיול לכלב עם דוגווקר מאומת ב-PetWash. בוחרים משך, מקבלים עדכוני יציאה וחזרה. המחיר מוצג לפני ההזמנה.',
    descEn: 'Book a dog walk with a verified walker on PetWash. Choose the duration and get check-in / check-out updates. See the price before you book.',
    h1He: 'Walk My Pet — טיול לכלב, בקלות',
    h1En: 'Walk My Pet — a walk for your dog, made easy',
    serviceType: 'DogWalking',
    sections: [
      { hHe: 'מה זה Walk My Pet?', hEn: 'What is Walk My Pet?', pHe: 'הזמנת דוגווקרים לטיול לכלב שלכם, עם בחירת משך הטיול ועדכונים לאורך הדרך.', pEn: 'Book dog walkers for your dog, choose the walk length, and get updates along the way.' },
      { hHe: 'איך מזמינים?', hEn: 'How booking works', pHe: 'בוחרים משך וזמן, מוסיפים את פרטי הכלב, והמחיר מוצג לפני האישור.', pEn: 'Choose a duration and time, add your dog\'s details, and the price is shown before you confirm.' },
      { hHe: 'אמון ובטיחות', hEn: 'Trust & safety', pHe: 'הדוגווקרים עוברים אימות וסקירה. יש עדכוני יציאה וחזרה ומדיניות ביטול.', pEn: 'Walkers are verified and reviewed. Check-in / check-out updates and a cancellation policy apply.' },
    ],
    ctas: [
      { href: '/walk-my-pet', he: 'הזמנת טיול', en: 'Book a walk' },
      { href: '/join/walker', he: 'להצטרף כדוגווקר', en: 'Become a walker' },
    ],
  },
  'academy': {
    slug: 'academy',
    titleHe: 'PetWash Academy — אילוף וחינוך כלבים | PetWash™',
    titleEn: 'PetWash Academy — Dog Training Sessions | PetWash™',
    descHe: 'הזמינו מפגשי אילוף וחינוך כלבים עם מאלפים מאומתים ב-PetWash Academy. לוח זמנים ומחיר מוצגים לפני ההזמנה. מדיניות ביטול חלה.',
    descEn: 'Book dog training sessions with vetted trainers at PetWash Academy. Schedule and price are shown before you book. A cancellation policy applies.',
    h1He: 'PetWash Academy — אילוף וחינוך כלבים',
    h1En: 'PetWash Academy — dog training & education',
    serviceType: 'EducationEvent',
    sections: [
      { hHe: 'מה זה PetWash Academy?', hEn: 'What is PetWash Academy?', pHe: 'מפגשי אילוף וחינוך כלבים עם מאלפים שעברו סקירה, למגוון רמות וצרכים.', pEn: 'Dog training and education sessions with reviewed trainers, for a range of levels and needs.' },
      { hHe: 'איך מזמינים?', hEn: 'How booking works', pHe: 'בוחרים מפגש ומועד, ולוח הזמנים והמחיר מוצגים לפני האישור.', pEn: 'Pick a session and time; the schedule and price are shown before you confirm.' },
      { hHe: 'ביטול ותמיכה', hEn: 'Cancellation & support', pHe: 'חלה מדיניות ביטול, ותמיכה זמינה דרך PetWash.', pEn: 'A cancellation policy applies, and support is available through PetWash.' },
    ],
    ctas: [
      { href: '/academy', he: 'להצטרף ל-Academy', en: 'Join Academy' },
      { href: '/apply-provider', he: 'להצטרף כמאלף', en: 'Become a trainer' },
    ],
  },
  'k9000': {
    slug: 'k9000',
    titleHe: 'K9000 — שטיפת כלבים בשירות עצמי | PetWash™',
    titleEn: 'K9000 Self-Service Dog Wash | PetWash™',
    descHe: 'שטפו את הכלב בעמדת K9000 של PetWash — מים חמים, שמפו ומרכך מותאמים לחיות, וייבוש, בכמה דקות. מצאו תחנה בקרבתכם.',
    descEn: 'Wash your dog at a PetWash K9000 station — warm water, pet-formulated shampoo & conditioner, and blow-dry, in minutes. Find a station near you.',
    h1He: 'K9000 — שטיפת כלבים בשירות עצמי',
    h1En: 'K9000 — self-service dog wash',
    serviceType: 'PetWash',
    sections: [
      { hHe: 'איך זה עובד?', hEn: 'How it works', pHe: 'מגיעים לעמדת K9000, בוחרים תוכנית, ושוטפים את הכלב עם מים חמים, שמפו, מרכך וייבוש — הכל במקום אחד.', pEn: 'Arrive at a K9000 station, choose a program, and wash your dog with warm water, shampoo, conditioner and blow-dry — all in one place.' },
      { hHe: 'לחברי Prestige', hEn: 'For Prestige members', pHe: 'חברי PetWash Prestige נהנים מהטבת חבר על שטיפה. ההצטרפות חינם.', pEn: 'PetWash Prestige members enjoy a member benefit on washes. Joining is free.' },
    ],
    ctas: [
      { href: '/stations', he: 'מצאו תחנה', en: 'Find a station' },
      { href: '/prestige-pass', he: 'הצטרפו ל-Prestige', en: 'Join Prestige' },
    ],
  },
  'stations': {
    slug: 'stations',
    titleHe: 'מצאו תחנת K9000 בישראל | PetWash™',
    titleEn: 'Find a K9000 Dog-Wash Station in Israel | PetWash™',
    descHe: 'איתור עמדות שטיפת כלבים K9000 של PetWash בישראל — פרטי תחנה ושעות פעילות.',
    descEn: 'Locate PetWash K9000 self-service dog-wash stations across Israel — station details and opening hours.',
    h1He: 'מצאו תחנת K9000 בקרבתכם',
    h1En: 'Find a K9000 station near you',
    serviceType: 'PetWash',
    sections: [
      { hHe: 'תחנות PetWash', hEn: 'PetWash stations', pHe: 'עמדות K9000 לשטיפה עצמית של הכלב. בכל עמוד תחנה מוצגים הפרטים ושעות הפעילות.', pEn: 'K9000 self-service dog-wash stations. Each station page shows its details and opening hours.' },
    ],
    ctas: [
      { href: '/stations', he: 'לרשימת התחנות', en: 'Browse stations' },
      { href: '/k9000', he: 'איך K9000 עובד', en: 'How K9000 works' },
    ],
  },
  'egift': {
    slug: 'egift',
    titleHe: 'eGift — כרטיס מתנה דיגיטלי לחיות מחמד | PetWash™',
    titleEn: 'eGift — Digital Pet-Care Gift Card | PetWash™',
    descHe: 'קנו כרטיס מתנה דיגיטלי של PetWash. הנמען מפעיל אותו והיתרה מופיעה בארנק PetWash לשימוש בשירותים. אפשר לקנות גם בלי הרשמה.',
    descEn: 'Buy a PetWash digital gift card. The recipient activates it and the balance appears in their PetWash wallet, usable across services. Guest checkout available.',
    h1He: 'eGift — מתנה לאוהבי חיות',
    h1En: 'eGift — a gift for pet lovers',
    serviceType: 'GiftCard',
    sections: [
      { hHe: 'איך זה עובד?', hEn: 'How it works', pHe: 'בוחרים סכום, משלמים, והנמען מקבל קישור. לאחר הפעלה, היתרה נשמרת בארנק PetWash שלו.', pEn: 'Choose an amount, pay, and the recipient gets a link. After activation, the balance is stored in their PetWash wallet.' },
    ],
    ctas: [
      { href: '/egift', he: 'קנו eGift', en: 'Buy an eGift' },
      { href: '/prestige-pass', he: 'על הארנק ו-Prestige', en: 'About the wallet & Prestige' },
    ],
  },
  'prestige-pass': {
    slug: 'prestige-pass',
    titleHe: 'PetWash Prestige — מועדון נאמנות חינם | PetWash™',
    titleEn: 'PetWash Prestige — Free Loyalty Membership | PetWash™',
    descHe: 'הצטרפו ל-PetWash Prestige בחינם — נקודות ותגמולים, הטבת חבר בעמדות K9000, הפתעת יום הולדת וכרטיס ארנק דיגיטלי.',
    descEn: 'Join PetWash Prestige free — points and rewards, a member benefit at K9000 stations, a birthday perk, and a digital wallet pass.',
    h1He: 'PetWash Prestige — נאמנות חינם',
    h1En: 'PetWash Prestige — free loyalty',
    serviceType: 'LoyaltyProgram',
    sections: [
      { hHe: 'מה מקבלים?', hEn: 'What you get', pHe: 'חברות חינם עם נקודות ותגמולים, הטבת חבר על שטיפה ב-K9000, הפתעת יום הולדת וכרטיס ארנק דיגיטלי.', pEn: 'Free membership with points and rewards, a member benefit on K9000 washes, a birthday perk, and a digital wallet pass.' },
    ],
    ctas: [
      { href: '/prestige-pass', he: 'הצטרפו בחינם', en: 'Join free' },
      { href: '/k9000', he: 'איך K9000 עובד', en: 'How K9000 works' },
    ],
  },
  'groomers': {
    slug: 'groomers',
    titleHe: 'גרומינג לכלבים — הזמנת מספרה ניידת/מטפח | PetWash™',
    titleEn: 'Dog Grooming — Book a Professional Groomer | PetWash™',
    descHe: 'הזמינו גרומר מקצועי ב-PetWash. נותני שירות מאומתים, המחיר מוצג לפני ההזמנה, ומדיניות ביטול חלה.',
    descEn: 'Book a professional groomer on PetWash. Verified providers, price shown before booking, cancellation policy applies.',
    h1He: 'גרומינג לכלבים — טיפוח מקצועי',
    h1En: 'Dog grooming — professional care',
    serviceType: 'PetGrooming',
    sections: [
      { hHe: 'איך מזמינים?', hEn: 'How booking works', pHe: 'בוחרים מטפח ומועד, מוסיפים את פרטי החיה, והמחיר מוצג לפני האישור.', pEn: 'Pick a groomer and time, add your pet\'s details, and the price is shown before you confirm.' },
      { hHe: 'אמון ובטיחות', hEn: 'Trust & safety', pHe: 'נותני השירות עוברים אימות וסקירה. חלה מדיניות ביטול.', pEn: 'Providers are verified and reviewed. A cancellation policy applies.' },
    ],
    ctas: [
      { href: '/groomers', he: 'הזמנת גרומר', en: 'Book a groomer' },
      { href: '/apply-provider', he: 'להצטרף כגרומר', en: 'Become a groomer' },
    ],
  },
  'pettrek': {
    slug: 'pettrek',
    titleHe: 'PetTrek — מונית לחיות מחמד / הסעת חיות | PetWash™',
    titleEn: 'PetTrek — Pet Taxi & Transport | PetWash™',
    descHe: 'הזמינו הסעה לחיה עם PetTrek של PetWash. נהגים מאומתים, המחיר מוצג לפני ההזמנה.',
    descEn: 'Book pet transport with PetWash PetTrek. Verified drivers, price shown before booking.',
    h1He: 'PetTrek — הסעת חיות מחמד',
    h1En: 'PetTrek — pet transport',
    serviceType: 'Taxi',
    sections: [
      { hHe: 'איך מזמינים?', hEn: 'How booking works', pHe: 'בוחרים מוצא ויעד ומועד, והמחיר מוצג לפני האישור.', pEn: 'Choose pickup, destination and time; the price is shown before you confirm.' },
      { hHe: 'אמון ובטיחות', hEn: 'Trust & safety', pHe: 'הנהגים עוברים אימות וסקירה. חלה מדיניות ביטול.', pEn: 'Drivers are verified and reviewed. A cancellation policy applies.' },
    ],
    ctas: [
      { href: '/pettrek', he: 'הזמנת הסעה', en: 'Book transport' },
      { href: '/apply-provider', he: 'להצטרף כנהג', en: 'Become a driver' },
    ],
  },
};

const BASE_URL = (process.env.BASE_URL || 'https://petwash.co.il').replace(/\/$/, '');

/** Resolve the built index.html across the dev + prod layouts. Returns null if absent. */
export function findIndexHtml(): string | null {
  const candidates: string[] = [];
  try { if (import.meta.dirname) candidates.push(path.resolve(import.meta.dirname, '..', 'public', 'index.html')); } catch { /* dirname unavailable */ }
  candidates.push(path.resolve(process.cwd(), 'dist', 'public', 'index.html'));
  candidates.push(path.resolve(process.cwd(), 'server', 'public', 'index.html'));
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8'); } catch { /* next */ }
  }
  return null;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Inject a landing page's SEO + real content into the built index.html.
 * Returns null if the page slug is unknown or index.html can't be read (caller
 * then falls back to the normal SPA response, so we never break a route).
 */
export function renderLandingHtml(slug: string): string | null {
  const page = LANDING_PAGES[slug];
  if (!page) return null;
  const html = findIndexHtml();
  if (!html) return null;

  const canonical = `${BASE_URL}/${page.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: page.serviceType,
    name: page.titleEn.replace(/ \| PetWash™$/, ''),
    description: page.descEn,
    provider: { '@type': 'Organization', name: 'PetWash', url: BASE_URL },
    areaServed: { '@type': 'Country', name: 'Israel' },
    url: canonical,
  };

  // Real crawlable content, RTL Hebrew primary + English parity.
  const content = `
    <main id="prerender-landing" dir="rtl" style="max-width:920px;margin:0 auto;padding:24px;font-family:Inter,system-ui,sans-serif">
      <h1>${esc(page.h1He)}</h1>
      <p lang="en" dir="ltr" style="opacity:.85">${esc(page.h1En)}</p>
      ${page.sections.map(s => `
      <section>
        <h2>${esc(s.hHe)} <span lang="en" dir="ltr" style="opacity:.7">/ ${esc(s.hEn)}</span></h2>
        <p>${esc(s.pHe)}</p>
        <p lang="en" dir="ltr" style="opacity:.85">${esc(s.pEn)}</p>
      </section>`).join('')}
      <nav aria-label="actions">
        ${page.ctas.map(c => `<a href="${esc(c.href)}" rel="nofollow">${esc(c.he)} / <span lang="en" dir="ltr">${esc(c.en)}</span></a>`).join(' &nbsp; ')}
      </nav>
    </main>`;

  let out = html;
  // Swap <title>
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.titleHe)} | ${esc(page.titleEn)}</title>`);
  // Swap meta description
  out = out.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(page.descHe)} ${esc(page.descEn)}">`);
  // Swap canonical
  out = out.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonical}">`);
  // Inject JSON-LD before </head>
  out = out.replace('</head>', `  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n</head>`);
  // Inject real content INTO #root (React replaces it on mount for humans).
  out = out.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
  return out;
}
