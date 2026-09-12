/**
 * Crash-card copy (CEO 2026-09-12).
 *
 * The AppErrorBoundary card was English-only. Our primary audience is Israeli
 * and the whole app runs in Hebrew RTL — so the ONE screen a customer sees when
 * something breaks was the one screen that stopped speaking their language.
 * A luxury brand does not fall back to English at its worst moment.
 *
 * Pure + exported on purpose: the boundary is a class component that renders
 * during a crash, which is the hardest thing in the app to drive from a test.
 * Keeping the copy and the language decision here makes both directly testable.
 */

export type CrashCardCopy = {
  isHe: boolean;
  dir: 'rtl' | 'ltr';
  title: string;
  body: string;
  reference: string;
  keepsHappening: string;
  windowsLinux: string;
  mac: string;
  reloadLatest: string;
  reload: string;
  goHome: string;
};

/**
 * Decide whether the crash card should speak Hebrew.
 *
 * Order matters. `<html lang>` is authoritative once Layout has run, but a
 * crash can happen before it ever mounts — so fall back to the persisted
 * `pw_lang` choice, then to the browser's own preference. Everything is
 * wrapped: a boundary must never throw while deciding what to say.
 */
export function isHebrewCrashLocale(
  htmlLang?: string | null,
  storedLang?: string | null,
  navigatorLang?: string | null,
): boolean {
  const first = [htmlLang, storedLang, navigatorLang]
    .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
    .find((v) => v.length > 0);
  if (!first) return false;
  // 'he', 'he-IL', and the legacy 'iw' code all mean Hebrew.
  return first === 'he' || first.startsWith('he-') || first === 'iw' || first.startsWith('iw-');
}

export function crashCardCopy(isHe: boolean, isChunkError: boolean): CrashCardCopy {
  if (isHe) {
    return {
      isHe: true,
      dir: 'rtl',
      title: isChunkError ? 'זמינה גרסה חדשה' : 'משהו השתבש',
      body: isChunkError
        ? 'חלק מהאפליקציה לא נטען. בדרך כלל זה אומר שהרגע עלתה גרסה חדשה. רעננו כדי לקבל אותה.'
        : 'אירעה שגיאה בלתי צפויה. הצוות שלנו קיבל התראה וכבר מטפל בזה.',
      reference: 'מספר אסמכתא',
      keepsHappening: 'זה חוזר על עצמו. נסו רענון מלא כדי לנקות את המטמון:',
      windowsLinux: ' (Windows/Linux) ',
      mac: ' (Mac)',
      reloadLatest: 'רענון לגרסה האחרונה',
      reload: 'רענון הדף',
      goHome: 'לדף הבית',
    };
  }
  return {
    isHe: false,
    dir: 'ltr',
    title: isChunkError ? 'A new version is available' : 'Something went wrong',
    body: isChunkError
      ? 'Part of the app failed to load. This usually means a newer version was just deployed. Reload to get the latest version.'
      : "We've encountered an unexpected error. Our team has been notified and is working on fixing it.",
    reference: 'Reference',
    keepsHappening: 'This keeps happening. Try a hard reload to clear the cache:',
    windowsLinux: ' (Windows/Linux) ',
    mac: ' (Mac)',
    reloadLatest: 'Reload to get the latest version',
    reload: 'Reload Page',
    goHome: 'Go Home',
  };
}
