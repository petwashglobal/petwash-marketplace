/**
 * smartGreeting.ts — a warm, context-aware greeting line.
 *
 * Instead of a flat "Hello NIR", this returns a greeting that changes with the
 * time of day and the occasion, in the user's language:
 *   • Morning / afternoon / evening / night  (בוקר טוב / צהריים טובים / ערב טוב / לילה טוב)
 *   • Civil New Year (Jan 1)                  (שנה טובה)
 *   • The user's birthday                     (יום הולדת שמח NIR! 🎂)
 *   • A pet's birthday                        (יום הולדת שמח לרקסי! 🐾)
 *
 * Pure + client-side (uses the device clock), so it needs no network call for
 * the time-of-day part. Birthday lines activate only when the caller passes the
 * dates in (opts.birthday / opts.petBirthdays) — pass them when that profile
 * data is available; otherwise it gracefully shows the time-of-day greeting.
 *
 * Priority (most special first): user birthday → pet birthday → New Year → time of day.
 */

export type GreetLang = 'he' | 'en' | 'ar' | 'ru' | 'fr' | 'es';

export interface SmartGreetOpts {
  /** Override "now" — for tests. Defaults to the device clock. */
  now?: Date;
  /** User's date of birth (any Date-parseable string). Day+month is what matters. */
  birthday?: string | null;
  /** Pets with optional DOBs — first one whose day+month is today wins. */
  petBirthdays?: Array<{ name: string; dob?: string | null }>;
}

type Phrase = Record<GreetLang, string>;

// {name} is substituted with the first name; {pet} with the pet's name.
const TIME_GREETINGS: { fromHour: number; toHour: number; phrase: Phrase }[] = [
  {
    fromHour: 5, toHour: 11, // 05:00–11:59 morning
    phrase: { he: 'בוקר טוב', en: 'Good morning', ar: 'صباح الخير', ru: 'Доброе утро', fr: 'Bonjour', es: 'Buenos días' },
  },
  {
    fromHour: 12, toHour: 16, // noon–16:59 afternoon
    phrase: { he: 'צהריים טובים', en: 'Good afternoon', ar: 'مساء الخير', ru: 'Добрый день', fr: 'Bon après-midi', es: 'Buenas tardes' },
  },
  {
    fromHour: 17, toHour: 21, // 17:00–21:59 evening
    phrase: { he: 'ערב טוב', en: 'Good evening', ar: 'مساء الخير', ru: 'Добрый вечер', fr: 'Bonsoir', es: 'Buenas noches' },
  },
  {
    fromHour: 22, toHour: 4, // 22:00–04:59 night (wraps midnight)
    phrase: { he: 'לילה טוב', en: 'Good night', ar: 'تصبح على خير', ru: 'Доброй ночи', fr: 'Bonne nuit', es: 'Buenas noches' },
  },
];

const NEW_YEAR: Phrase = { he: 'שנה אזרחית טובה', en: 'Happy New Year', ar: 'سنة جديدة سعيدة', ru: 'С Новым годом', fr: 'Bonne année', es: 'Feliz Año Nuevo' };
const BIRTHDAY: Phrase = { he: 'יום הולדת שמח', en: 'Happy Birthday', ar: 'عيد ميلاد سعيد', ru: 'С днём рождения', fr: 'Joyeux anniversaire', es: 'Feliz cumpleaños' };
// Pet birthday — Hebrew/French/Spanish need a "to {pet}" preposition.
const PET_BIRTHDAY: Phrase = { he: 'יום הולדת שמח ל{pet}', en: 'Happy Birthday to {pet}', ar: 'عيد ميلاد سعيد لـ{pet}', ru: 'С днём рождения, {pet}', fr: 'Joyeux anniversaire à {pet}', es: 'Feliz cumpleaños a {pet}' };

function pick(p: Phrase, lang: GreetLang): string {
  return p[lang] ?? p.en;
}

/** True when the given date's day+month equals the reference date's day+month. */
function isSameDayMonth(dobStr: string | null | undefined, ref: Date): boolean {
  if (!dobStr) return false;
  const d = new Date(dobStr);
  if (isNaN(d.getTime())) return false;
  return d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function timeGreeting(hour: number, lang: GreetLang): string {
  const slot = TIME_GREETINGS.find((s) =>
    s.fromHour <= s.toHour
      ? hour >= s.fromHour && hour <= s.toHour
      : hour >= s.fromHour || hour <= s.toHour, // wrap past midnight
  );
  return pick(slot ? slot.phrase : TIME_GREETINGS[0].phrase, lang);
}

/**
 * Returns a greeting line WITHOUT the name appended, plus whether it's a
 * celebration (so the caller can add an emoji / different styling if it wants).
 */
export function smartGreetingParts(
  lang: GreetLang = 'he',
  opts: SmartGreetOpts = {},
): { text: string; celebration: boolean; emoji: string } {
  const now = opts.now ?? new Date();

  // 1. User birthday — most personal.
  if (isSameDayMonth(opts.birthday, now)) {
    return { text: pick(BIRTHDAY, lang), celebration: true, emoji: '🎂' };
  }
  // 2. Pet birthday.
  const pet = (opts.petBirthdays ?? []).find((p) => isSameDayMonth(p.dob, now));
  if (pet) {
    return { text: pick(PET_BIRTHDAY, lang).replace('{pet}', pet.name), celebration: true, emoji: '🐾' };
  }
  // 3. Civil New Year (Jan 1).
  if (now.getMonth() === 0 && now.getDate() === 1) {
    return { text: pick(NEW_YEAR, lang), celebration: true, emoji: '🎉' };
  }
  // 4. Time of day.
  return { text: timeGreeting(now.getHours(), lang), celebration: false, emoji: '' };
}

/**
 * Full greeting line: "בוקר טוב NIR" / "יום הולדת שמח NIR! 🎂".
 * Pet birthdays already contain the pet's name, so the user's name is omitted
 * there to avoid "Happy Birthday to Rexy NIR".
 */
export function smartGreeting(
  firstName: string | undefined | null,
  lang: GreetLang = 'he',
  opts: SmartGreetOpts = {},
): string {
  const parts = smartGreetingParts(lang, opts);
  const name = (firstName || '').trim();
  const now = opts.now ?? new Date();
  const isPetBday = !!(opts.petBirthdays ?? []).find((p) => isSameDayMonth(p.dob, now)) && !isSameDayMonth(opts.birthday, now);

  if (isPetBday) {
    return parts.emoji ? `${parts.text} ${parts.emoji}` : parts.text;
  }
  const base = name ? `${parts.text} ${name}` : parts.text;
  return parts.celebration && parts.emoji ? `${base}! ${parts.emoji}` : base;
}
