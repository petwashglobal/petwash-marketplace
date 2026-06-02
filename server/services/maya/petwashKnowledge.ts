/**
 * Maya's PetWash™ knowledge base (WhatsApp + future channels).
 *
 * HONESTY RULE (CEO operating standard — no false facts):
 * Maya may only state things that are TRUE today. Prices, exact hours and the
 * exact address are NOT yet finalized — they are left `null` below and Maya
 * answers "finalized for launch, I'll send you first" until you fill them in.
 * Fill the `FILL-IN` fields in ONE place here and Maya answers fully everywhere.
 *
 * Brand rule: always "PetWash™" / "PetWash Hub™". Never alter the logo.
 */

export interface LocalizedText {
  he: string;
  en: string;
}

export const PETWASH_KNOWLEDGE = {
  brand: 'PetWash™',
  site: 'petwash.co.il',
  support: 'support@petwash.co.il',

  /** 'pre_launch' until the Kfar Saba station is actually operating. */
  launchStatus: 'pre_launch' as 'pre_launch' | 'open',

  /** The physical product (all TRUE today). */
  station: {
    name: 'PetWash Hub™',
    model: 'K9000',
    bays: 2,                 // dual-bay, each bay independent
    selfService: true,       // DIY premium self-wash
    largeDogsWelcome: true,
  },

  /** First location + expansion (TRUE — opening soon in Kfar Saba, expanding). */
  firstLocation: {
    city: { he: 'כפר סבא', en: 'Kfar Saba' },
    // FILL-IN when confirmed (until then Maya says "we'll share at launch"):
    address: null as string | null,
    hours: null as LocalizedText | null,   // e.g. { he: 'א׳–ש׳, 06:00–24:00', en: 'Sun–Sat, 06:00–24:00' }
  },

  /** FILL-IN when finalized. Until then Maya does NOT quote a price. */
  priceRange: null as LocalizedText | null, // e.g. { he: '₪30–₪50 לשטיפה', en: '₪30–₪50 per wash' }

  /** Short, honest product blurbs Maya can use (TRUE today). */
  blurb: {
    he:
      'עמדת רחצה עצמית חכמה ופרימיום לכלבים (PetWash Hub™ / K9000) — ' +
      'שני תאי רחצה עצמאיים, מים בטמפרטורה נעימה ומוצרי טיפוח איכותיים. ' +
      'מושלם גם לכלב גדול.',
    en:
      'A smart, premium self-service dog-wash (PetWash Hub™ / K9000) — ' +
      'two independent wash bays, comfortable-temperature water and quality ' +
      'grooming products. Perfect for large dogs too.',
  } as LocalizedText,

  openingLine: {
    he: 'אנחנו נפתחים ממש בקרוב בכפר סבא, ומתרחבים משם הלאה 🐾',
    en: "We're opening very soon in Kfar Saba, and expanding from there 🐾",
  } as LocalizedText,

  /** What Maya asks to capture the lead. */
  captureAsk: {
    he: 'אפשר להוסיף אותך לרשימת הפתיחה? רק תכתבו לי שם ועיר ונעדכן אתכם ראשונים 🙏',
    en: 'May I add you to the launch list? Just send me your name and city and we’ll update you first 🙏',
  } as LocalizedText,
};

/** Honest hours answer — real hours if set, else launch-promise. */
export function hoursAnswer(locale: 'he' | 'en'): string {
  const h = PETWASH_KNOWLEDGE.firstLocation.hours;
  if (h) return h[locale];
  return locale === 'he'
    ? 'שעות הפעילות המדויקות נסגרות לקראת הפתיחה — אשלח לך אותן ראשונה ברגע שנפתח.'
    : "Exact opening hours are being finalized for launch — I'll send them to you first the moment we open.";
}

/** Honest price answer — real range if set, else launch-promise (never invents). */
export function priceAnswer(locale: 'he' | 'en'): string {
  const p = PETWASH_KNOWLEDGE.priceRange;
  if (p) return p[locale];
  return locale === 'he'
    ? 'טווח המחירים נסגר לקראת הפתיחה — אשלח לך אותו ראשונה כשנפתח.'
    : "The price range is being finalized for launch — I'll send it to you first when we open.";
}

/** Honest location answer — real address if set, else city + launch-promise. */
export function locationAnswer(locale: 'he' | 'en'): string {
  const addr = PETWASH_KNOWLEDGE.firstLocation.address;
  const city = PETWASH_KNOWLEDGE.firstLocation.city[locale];
  if (addr) return locale === 'he' ? `אנחנו ב${addr}, ${city}.` : `We're at ${addr}, ${city}.`;
  return locale === 'he'
    ? `הסניף הראשון נפתח בקרוב ב${city} — הכתובת המדויקת תפורסם לקראת הפתיחה.`
    : `Our first location opens soon in ${city} — the exact address will be shared at launch.`;
}
