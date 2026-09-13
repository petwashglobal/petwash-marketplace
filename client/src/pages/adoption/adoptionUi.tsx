/**
 * Adopt a Pet — shared look and labels for the /adoption pages.
 *
 * The visual language is the CEO-approved Adoption maison (#920,
 * client/src/pages/AdoptionMaison.tsx): pure white, black type, one metallic
 * gold hairline, serif headlines, top-centred wordmark, RTL anchored right.
 * It is deliberately NOT PawFinder's look — different product, different mood.
 */
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { getFirebaseBearerToken } from '@/lib/queryClient';

export const GOLD = '#D4AF37';
export const GOLD_TEXT = '#9A7B2E';
export const HAIRLINE = '#E6E2D8';
export const PAPER = '#F4F1EA';

export interface AdoptionListing {
  id: number;
  listing_key?: string;
  lister_type?: string;
  pet_type: string;
  pet_name?: string | null;
  breed?: string | null;
  sex?: string;
  age_group?: string;
  size_category?: string;
  color?: string | null;
  description: string;
  temperament?: string | null;
  health_notes?: string | null;
  special_needs?: string | null;
  vaccinated?: string;
  neutered?: string;
  microchipped?: string;
  good_with_children?: string;
  good_with_dogs?: string;
  good_with_cats?: string;
  city: string;
  area?: string | null;
  status: string;
  primary_media?: string | null;
  moderation_reason?: string | null;
  pending_enquiries?: number;
}

type L = { he: string; en: string };
const t = (isHe: boolean, l: L) => (isHe ? l.he : l.en);

const STATUS: Record<string, L> = {
  pending_review: { he: 'בבדיקה', en: 'In review' },
  available: { he: 'זמין/ה לאימוץ', en: 'Available' },
  pending: { he: 'בתהליך היכרות', en: 'Adoption pending' },
  adopted: { he: 'אומץ/ה', en: 'Adopted' },
  rejected: { he: 'לא אושר', en: 'Not approved' },
  archived: { he: 'בארכיון', en: 'Archived' },
};
export const statusLabel = (isHe: boolean, s: string) => t(isHe, STATUS[s] ?? { he: s, en: s });

const PET: Record<string, L> = {
  dog: { he: 'כלב', en: 'Dog' }, cat: { he: 'חתול', en: 'Cat' }, rabbit: { he: 'ארנב', en: 'Rabbit' },
  bird: { he: 'ציפור', en: 'Bird' }, other: { he: 'אחר', en: 'Other' },
};
export const petLabel = (isHe: boolean, s: string) => t(isHe, PET[s] ?? { he: s, en: s });

const AGE: Record<string, L> = {
  baby: { he: 'גור', en: 'Baby' }, young: { he: 'צעיר/ה', en: 'Young' }, adult: { he: 'בוגר/ת', en: 'Adult' },
  senior: { he: 'מבוגר/ת', en: 'Senior' }, unknown: { he: 'גיל לא ידוע', en: 'Age unknown' },
};
export const ageLabel = (isHe: boolean, s?: string) => t(isHe, AGE[s || 'unknown'] ?? AGE.unknown);

const SEX: Record<string, L> = { male: { he: 'זכר', en: 'Male' }, female: { he: 'נקבה', en: 'Female' }, unknown: { he: '', en: '' } };
export const sexLabel = (isHe: boolean, s?: string) => t(isHe, SEX[s || 'unknown'] ?? SEX.unknown);

const YESNO: Record<string, L> = { yes: { he: 'כן', en: 'Yes' }, no: { he: 'לא', en: 'No' }, unknown: { he: 'לא ידוע', en: 'Unknown' } };
export const yesNoLabel = (isHe: boolean, s?: string) => t(isHe, YESNO[s || 'unknown'] ?? YESNO.unknown);

const LISTER: Record<string, L> = {
  private: { he: 'בעלים פרטיים', en: 'Private owner' }, rescue: { he: 'עמותת הצלה', en: 'Rescue' }, shelter: { he: 'מקלט', en: 'Shelter' },
};
export const listerLabel = (isHe: boolean, s?: string) => t(isHe, LISTER[s || 'private'] ?? LISTER.private);

/** The status mark on a card: a quiet gold-edged chip, never a loud badge. */
export function StatusChip({ isHe, status }: { isHe: boolean; status: string }) {
  const muted = status === 'adopted' || status === 'archived' || status === 'rejected';
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] tracking-[0.5px]"
      style={{ border: `1px solid ${muted ? HAIRLINE : GOLD}`, color: muted ? 'rgba(0,0,0,0.5)' : GOLD_TEXT, background: '#fff' }}
      data-testid={`adoption-status-${status}`}
    >
      {statusLabel(isHe, status)}
    </span>
  );
}

/** Page shell: RTL, white, wordmark top-centre, eyebrow, serif headline, gold hairline. */
export function AdoptionShell({ isHe, eyebrow, title, subtitle, children, back }: {
  isHe: boolean; eyebrow?: string; title: string; subtitle?: ReactNode; children: ReactNode; back?: { href: string; label: string };
}) {
  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className="min-h-screen bg-white text-black">
      <header className="px-6 pt-10 pb-6" style={{ textAlign: 'center' }}>
        <div className="text-sm tracking-[0.2px] font-serif">PetWash™‎</div>
        <div className="mt-5 text-[11px] tracking-[4px]" style={{ color: GOLD_TEXT }}>{eyebrow ?? 'אימוץ · ADOPTION'}</div>
        <h1 className="mt-3 font-serif font-normal leading-tight" style={{ fontSize: 'clamp(1.75rem, 7vw, 2.75rem)' }}>{title}</h1>
        <div className="mx-auto my-4 h-px w-12" style={{ backgroundColor: GOLD }} />
        {subtitle && <p className="mx-auto max-w-md text-sm leading-relaxed text-black/60">{subtitle}</p>}
        {back && (
          <div className="mt-4">
            <Link href={back.href}>
              <span className="text-xs text-black/70 pb-0.5 cursor-pointer" style={{ borderBottom: `1px solid ${GOLD}` }}>{back.label}</span>
            </Link>
          </div>
        )}
      </header>
      <main className="px-4 pb-16 max-w-3xl mx-auto">{children}</main>
    </div>
  );
}

export const fieldCls = 'w-full rounded-xl bg-white px-4 py-3 text-base text-black focus:outline-none';
export const fieldStyle = { border: `1px solid ${HAIRLINE}` };
export const labelCls = 'block text-xs text-black/55 mb-1.5';

export function PrimaryButton({ children, disabled, type = 'button', onClick, testId }: {
  children: ReactNode; disabled?: boolean; type?: 'button' | 'submit'; onClick?: () => void; testId?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="w-full rounded-full bg-black px-6 py-3.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function QuietLink({ href, children, testId }: { href: string; children: ReactNode; testId?: string }) {
  return (
    <Link href={href}>
      <span className="text-sm text-black pb-1 cursor-pointer transition-opacity hover:opacity-60" style={{ borderBottom: `1px solid ${GOLD}` }} data-testid={testId}>
        {children}
      </span>
    </Link>
  );
}

/**
 * Member call to /api/adoption. Bearer token → CSRF-exempt (a cookie-only POST
 * was 403'ing in prod, same as PawFinder). Returns the parsed body and throws
 * with the server's error code so pages can show a real message.
 */
export async function adoptionApi<T = any>(url: string, init: { method?: string; json?: unknown; form?: FormData } = {}): Promise<T> {
  const bt = await getFirebaseBearerToken();
  const headers: Record<string, string> = bt ? { Authorization: `Bearer ${bt}` } : {};
  if (init.json !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(url, {
    method: init.method ?? (init.json !== undefined || init.form ? 'POST' : 'GET'),
    headers,
    credentials: 'include',
    body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined),
  });
  let body: any = null;
  try { body = await r.json(); } catch { /* empty body */ }
  if (!r.ok) throw Object.assign(new Error(String(body?.error || `HTTP ${r.status}`)), { status: r.status, body });
  return body as T;
}

const ERRORS: Record<string, L> = {
  DAILY_LIMIT_REACHED: { he: 'אפשר לפרסם עד 3 מודעות ביום.', en: 'You can publish up to 3 listings a day.' },
  DUPLICATE_IMAGE: { he: 'התמונה הזו כבר בשימוש באחת המודעות שלך.', en: 'This photo is already used in one of your listings.' },
  DUPLICATE_ENQUIRY: { he: 'כבר שלחת פנייה על החיה הזו. נעדכן כשתהיה תשובה.', en: 'You already sent an enquiry for this pet.' },
  ENQUIRY_RATE_LIMIT: { he: 'שלחת הרבה פניות היום. נסו שוב מחר.', en: 'Too many enquiries today. Try again tomorrow.' },
  CANNOT_ENQUIRE_OWN_LISTING: { he: 'זו המודעה שלך.', en: 'This is your own listing.' },
  LISTING_NOT_OPEN: { he: 'החיה כבר לא זמינה לאימוץ.', en: 'This pet is no longer open for adoption.' },
  PHOTO_STORAGE_UNAVAILABLE: { he: 'לא הצלחנו לשמור את התמונה. נסו שוב בעוד רגע.', en: 'We could not store the photo. Please try again shortly.' },
  STATUS_CHANGE_NOT_ALLOWED: { he: 'אי אפשר לשנות את הסטטוס הזה.', en: 'That status change is not allowed.' },
  validation_error: { he: 'חלק מהפרטים חסרים או לא תקינים.', en: 'Some details are missing or invalid.' },
};
export const errorText = (isHe: boolean, err: any) =>
  t(isHe, ERRORS[String(err?.message)] ?? { he: 'משהו השתבש. נסו שוב.', en: 'Something went wrong. Please try again.' });
