/**
 * "This is how your listing will look" — the empty state of both community
 * boards, done properly.
 *
 * An empty board tells a visitor nothing and invites nobody. A board of INVENTED
 * pets is worse: PetWash deleted fabricated lost-pet posts once already
 * (PR-FAKE 2026-06-13) because a made-up missing dog with a reward and a contact
 * button is a real-world harm.
 *
 * So: a clearly marked EXAMPLE. Every card carries a "דוגמה / EXAMPLE" ribbon,
 * the pets are named as examples, nothing is clickable into a pet page, there is
 * no contact button, no phone and no reward, and the whole block disappears the
 * moment one real listing exists. It sells the product without ever pretending
 * a pet is waiting.
 */
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { MapPin, Ruler, Clock, Footprints } from 'lucide-react';
import { GOLD, GOLD_INK, HAIRLINE, PAPER, SERIF, INK } from './Editorial';

export interface ExampleCard {
  /** Example pet name — always shown next to the EXAMPLE ribbon. */
  name: string;
  image: string;
  /** "2 years | Golden Retriever" or "Golden · honey" */
  line1: string;
  line2?: string;
  place: string;
  /** Available / Pending Meet, or LOST / FOUND. */
  badge: { text: string; bg: string; fg: string };
}

function Ribbon({ isHe }: { isHe: boolean }) {
  return (
    <span
      className="absolute top-2.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase"
      style={{ insetInlineEnd: 10, background: INK, color: GOLD }}
      data-testid="example-ribbon"
    >
      {isHe ? 'דוגמה' : 'Example'}
    </span>
  );
}

/**
 * @param cta  Where a visitor goes to create the real thing.
 */
export function ExamplePreview({ isHe, title, subtitle, cards, cta, note }: {
  isHe: boolean;
  title: string;
  subtitle: string;
  cards: ExampleCard[];
  cta: { href: string; label: string };
  note: string;
}) {
  return (
    <section className="mt-4" aria-label={isHe ? 'תצוגת דוגמה' : 'Example preview'} data-testid="example-preview">
      <div className="rounded-2xl px-5 py-4" style={{ background: PAPER, border: `1px solid ${HAIRLINE}` }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[22px] leading-tight text-black" style={{ fontFamily: SERIF }}>{title}</h3>
            <p className="mt-1 text-[13px] text-black/60">{subtitle}</p>
          </div>
          <Link href={cta.href}>
            <button className="rounded-full px-5 py-2 text-sm font-medium text-white" style={{ background: GOLD_INK }} data-testid="example-cta">
              {cta.label}
            </button>
          </Link>
        </div>
      </div>

      {/* Three cards, three columns: a 4-column grid left a dead slot on wide screens. */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <article
            key={c.name}
            className="relative flex flex-col overflow-hidden rounded-2xl bg-white"
            style={{ border: `1px solid ${HAIRLINE}` }}
            data-testid={`example-card-${c.name}`}
          >
            <div className="relative aspect-[4/3.4] overflow-hidden" style={{ background: PAPER }}>
              <img src={c.image} alt="" className="h-full w-full object-cover" loading="lazy" aria-hidden />
              <span className="absolute bottom-2.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ insetInlineStart: 10, background: c.badge.bg, color: c.badge.fg }}>
                {c.badge.text}
              </span>
              <Ribbon isHe={isHe} />
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="text-[22px] leading-tight text-black" style={{ fontFamily: SERIF }}>{c.name}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[13px] text-black/60"><Footprints className="h-3.5 w-3.5 shrink-0" />{c.line1}</div>
              {c.line2 && <div className="mt-1 flex items-center gap-1.5 text-[13px] text-black/60"><Ruler className="h-3.5 w-3.5 shrink-0" />{c.line2}</div>}
              <div className="mt-1 flex items-center gap-1.5 text-[13px] text-black/60"><MapPin className="h-3.5 w-3.5 shrink-0" />{c.place}</div>
              {/* No contact button, no phone, no reward: nothing here can be acted on. */}
              <div className="mt-auto pt-4 text-[12px] italic text-black/45" style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10 }}>
                {isHe ? 'כך תיראה המודעה שלכם' : 'This is how your listing will look'}
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-3 text-[12.5px] text-black/55" style={{ textAlign: 'center' }} data-testid="example-note">{note}</p>
    </section>
  );
}

/** Adopt a Pet examples — plainly named as examples, never as pets waiting. */
export function adoptionExamples(isHe: boolean): ExampleCard[] {
  const available = { text: isHe ? 'זמין/ה' : 'Available', bg: '#E4F3E6', fg: '#256B34' };
  const pending = { text: isHe ? 'בתהליך היכרות' : 'Pending Meet', bg: '#FBEFD3', fg: '#8A5A00' };
  return [
    {
      name: isHe ? 'דוגמה · כלב' : 'Example · Dog',
      image: '/community/example-dog.jpg',
      line1: isHe ? 'שנתיים · גולדן רטריבר' : '2 years · Golden Retriever',
      line2: isHe ? 'גדול · רגוע, טוב עם ילדים' : 'Large · Calm, good with kids',
      place: isHe ? 'כפר סבא' : 'Kfar Saba',
      badge: available,
    },
    {
      name: isHe ? 'דוגמה · חתולה' : 'Example · Cat',
      image: '/community/example-cat.jpg',
      line1: isHe ? '3 שנים · חתולת בית' : '3 years · Domestic shorthair',
      line2: isHe ? 'בינונית · שקטה, מתאימה לדירה' : 'Medium · Quiet, apartment friendly',
      place: isHe ? 'רמת גן' : 'Ramat Gan',
      badge: pending,
    },
    {
      name: isHe ? 'דוגמה · תוכי' : 'Example · Parrot',
      image: '/community/example-bird.jpg',
      line1: isHe ? 'בוגר · מקאו' : 'Adult · Macaw',
      line2: isHe ? 'חברותי · דורש זמן וסבלנות' : 'Sociable · Needs time and patience',
      place: isHe ? 'תל אביב' : 'Tel Aviv',
      badge: available,
    },
  ];
}

/** PawFinder examples — LOST / FOUND, no reward, no phone, nothing to press. */
export function pawFinderExamples(isHe: boolean): ExampleCard[] {
  const lost = { text: isHe ? 'אבד' : 'LOST', bg: '#F7DADA', fg: '#8E2A2A' };
  const found = { text: isHe ? 'נמצא' : 'FOUND', bg: '#DCEEE2', fg: '#22603B' };
  return [
    {
      name: isHe ? 'דוגמה · כלב אבוד' : 'Example · Lost dog',
      image: '/community/example-dog.jpg',
      line1: isHe ? 'גולדן רטריבר · דבש' : 'Golden Retriever · honey',
      line2: isHe ? 'גדול · קולר שחור' : 'Large · black collar',
      place: isHe ? 'פארק כפר סבא' : 'Kfar Saba park',
      badge: lost,
    },
    {
      name: isHe ? 'דוגמה · חתולה שנמצאה' : 'Example · Found cat',
      image: '/community/example-cat.jpg',
      line1: isHe ? 'כתומה-לבנה · עיניים ירוקות' : 'Orange-white · green eyes',
      line2: isHe ? 'קטנה · ללא קולר' : 'Small · no collar',
      place: isHe ? 'רחוב ויצמן, כפר סבא' : 'Weizmann St, Kfar Saba',
      badge: found,
    },
    {
      name: isHe ? 'דוגמה · תוכי אבוד' : 'Example · Lost parrot',
      image: '/community/example-bird.jpg',
      line1: isHe ? 'מקאו · אדום-כחול' : 'Macaw · red-blue',
      line2: isHe ? 'בינוני · עונה לשמו' : 'Medium · answers to his name',
      place: isHe ? 'תל אביב' : 'Tel Aviv',
      badge: lost,
    },
  ];
}

export function ExampleNote({ children }: { children: ReactNode }) {
  return <span className="text-[12.5px] text-black/55">{children}</span>;
}
