/**
 * israelOccasions.ts — today's special-occasion greeting, Israel-first.
 *
 * Returns a greeting for an Israeli holiday (computed accurately with the
 * @hebcal/core Hebrew calendar) or a fixed international day (World Dog Day),
 * or null when today is ordinary. The caller passes the result to
 * smartGreeting({ occasion }), where it ranks above the time-of-day greeting
 * but below a personal birthday.
 *
 * Israel is the primary market, so the Hebrew calendar (il: true) drives the
 * holiday set — Rosh Hashana → "שנה טובה", Yom Kippur → "גמר חתימה טובה",
 * the pilgrimage/joy festivals → "חג שמח". Fully fault-tolerant: any hebcal
 * error returns null and the greeting simply falls back to time-of-day.
 */
import { HebrewCalendar } from '@hebcal/core';
import type { GreetLang } from './smartGreeting';

type Phrase = Record<GreetLang, string>;
const pick = (p: Phrase, lang: GreetLang) => p[lang] ?? p.en;

const SHANA_TOVA: Phrase = { he: 'שנה טובה ומתוקה', en: 'Shana Tova', ar: 'سنة جديدة سعيدة', ru: 'Шана Това', fr: 'Shana Tova', es: 'Shaná Tová' };
const GMAR_CHATIMA: Phrase = { he: 'גמר חתימה טובה', en: 'G’mar Chatima Tova', ar: 'غمار حاتيما طوفا', ru: 'Гмар Хатима Това', fr: 'Gmar Hatima Tova', es: 'Gmar Jatimá Tová' };
const CHAG_SAMEACH: Phrase = { he: 'חג שמח', en: 'Chag Sameach', ar: 'عيد سعيد', ru: 'Хаг Самеах', fr: 'Chag Sameach', es: 'Jag Sameaj' };
const WORLD_DOG_DAY: Phrase = { he: 'יום הכלב העולמי שמח', en: 'Happy World Dog Day', ar: 'يوم الكلب العالمي سعيد', ru: 'С Всемирным днём собак', fr: 'Bonne Journée mondiale du chien', es: 'Feliz Día Mundial del Perro' };

export interface Occasion { text: string; emoji: string }

/** Today's special-occasion greeting, or null. `now` defaults to the device clock. */
export function israelOccasion(lang: GreetLang = 'he', now: Date = new Date()): Occasion | null {
  // Fixed international day — World Dog Day, August 26.
  if (now.getMonth() === 7 && now.getDate() === 26) {
    return { text: pick(WORLD_DOG_DAY, lang), emoji: '🐶' };
  }

  try {
    const events = HebrewCalendar.calendar({ start: now, end: now, il: true, sedrot: false, omer: false });
    for (const ev of events) {
      const desc = ev.getDesc(); // English, e.g. "Rosh Hashana 5787", "Pesach I"
      if (desc.includes('Rosh Hashana') && !desc.includes('LaBehemot')) return { text: pick(SHANA_TOVA, lang), emoji: '🍎' };
      if (desc.includes('Yom Kippur')) return { text: pick(GMAR_CHATIMA, lang), emoji: '🤍' };
      if (/Sukkot|Pesach|Shavuot|Simchat Torah|Shmini Atzeret|Chanukah|Purim/.test(desc)) {
        // Skip the minor/erev-only markers that aren't celebratory days themselves.
        if (desc.includes('CH’’M') || desc.includes("CH''M")) continue; // chol hamoed — keep looking for the chag itself
        return { text: pick(CHAG_SAMEACH, lang), emoji: '🎉' };
      }
    }
  } catch {
    // hebcal unavailable / error — fall through to null so the greeting degrades.
  }
  return null;
}
