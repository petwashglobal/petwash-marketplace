import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { t } from './i18n';
import { splitI18nSource } from '../../../scripts/vite/i18nLanguagePacks';

/**
 * 2026-09-17 — the Academy (trainer search, trainer profile, booking a
 * session, its fees and refund line) and the account security / trusted
 * devices screens had Hebrew and English only. Arabic and Russian speakers
 * got English. 94 entries now carry ar + ru.
 *
 * Production strips secondary languages out of the main bundle into lazy
 * packs (scripts/vite/i18nLanguagePacks.ts), so this also proves the new
 * strings land in those packs, not only in the source file.
 */
const SAMPLES: Array<[key: string, ar: string, ru: string]> = [
  ['Book Training Session', 'احجز جلسة تدريب', 'Забронировать занятие'],
  ['Full refund if cancelled within 24 hours', 'استرداد كامل عند الإلغاء خلال 24 ساعة', 'Полный возврат при отмене в течение 24 часов'],
  ['VAT on Fee', 'ضريبة القيمة المضافة على الرسوم', 'НДС на сбор'],
  ['72-hour payment hold with automatic release', 'حجز الدفعة لمدة 72 ساعة مع تحرير تلقائي', 'Удержание платежа 72 часа с автоматическим переводом'],
  ['Search trainers by name or specialty...', 'ابحث عن مدرّبين بالاسم أو التخصص...', 'Поиск тренеров по имени или специализации...'],
  ['security.title', 'الأمان', 'Безопасность'],
  ['devices.cannotRemoveLast', 'لا يمكن إزالة جهازك الأخير', 'Нельзя удалить последнее устройство'],
];

describe('Academy and account security speak Arabic and Russian', () => {
  it('t() returns the Arabic and Russian text', () => {
    for (const [key, ar, ru] of SAMPLES) {
      expect(t(key, 'ar'), key).toContain(ar.replace(/[⁦⁩]/g, '').slice(0, 6));
      expect(t(key, 'ru'), key).toBe(ru);
    }
  });

  it('Hebrew and English are unchanged', () => {
    expect(t('Book Training Session', 'he')).toBe('הזמינו מפגש אימון');
    expect(t('Book Training Session', 'en')).toBe('Book Training Session');
  });

  it('the production pack split carries the new strings', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'i18n.ts'), 'utf8');
    const { packs, code } = splitI18nSource(src);
    for (const [key, ar, ru] of SAMPLES) {
      expect(packs.ar[key], `ar pack missing ${key}`).toBe(ar);
      expect(packs.ru[key], `ru pack missing ${key}`).toBe(ru);
    }
    // and the main bundle no longer carries them inline
    expect(code).not.toContain('احجز جلسة تدريب');
  });

  it('the brand name is not translated', () => {
    expect(t('⁦Pet Wash Academy™⁩', 'ar')).toContain('Pet Wash Academy');
    expect(t('⁦Pet Wash Academy™⁩', 'ru')).toContain('Pet Wash Academy');
  });

  it('franchise and shop mailto subjects stay English — PetWash staff read them', () => {
    expect(t('PetWash Franchise — Application', 'ar')).toBe('PetWash Franchise — Application');
    expect(t('PetWash Shop — Waitlist', 'ru')).toBe('PetWash Shop — Waitlist');
  });
});
