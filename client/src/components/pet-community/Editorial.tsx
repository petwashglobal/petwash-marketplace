/**
 * Editorial frame for the CEO-approved Adopt a Pet and PawFinder™‎ boards
 * (canonical mockups, 2026-09-13). Shared LOOK only: each product passes its own
 * words, pillars and steps. Adoption and PawFinder stay two products.
 *
 * Palette: white, black type, metallic gold #D4AF37 hairlines, warm paper
 * #F7F3EC, Cormorant Garamond serif. Hebrew-first: everything flips with dir.
 */
import type { ReactNode } from 'react';
export { placeLine } from '@shared/lib/placeLine';

export const GOLD = '#D4AF37';
export const GOLD_INK = '#9A7B2E';
export const INK = '#111111';
export const HAIRLINE = '#E8E2D6';
export const PAPER = '#F7F3EC';
export const SERIF = "'Cormorant Garamond', 'Noto Serif Hebrew', Georgia, serif";

const Rule = ({ w = 32 }: { w?: number }) => <span className="block h-px" style={{ width: w, background: GOLD }} />;

/** Poster header: corner taglines, wordmark, giant serif title, subtitle, gold italic line. */
export function EditorialHeader({ isHe, cornerStart, cornerEnd, title, titleMark, subtitle, italic }: {
  isHe: boolean;
  cornerStart: string[];
  cornerEnd: string[];
  title: string;
  /** e.g. "™‎" rendered small and raised after the title. */
  titleMark?: string;
  subtitle: string;
  italic: string;
}) {
  const corner = (lines: string[], align: 'start' | 'end') => (
    <div className="hidden md:flex flex-col gap-1 pt-2" style={{ alignItems: align === 'start' ? 'flex-start' : 'flex-end' }}>
      {align === 'end' && <Rule w={24} />}
      {lines.map((l) => (
        <span key={l} className="text-[10px] tracking-[0.32em] uppercase text-black/60">{l}</span>
      ))}
      {align === 'start' && <Rule w={24} />}
    </div>
  );
  return (
    <header className="relative px-5 pt-8 md:pt-10 pb-6" style={{ textAlign: 'center' }}>
      <div className="mx-auto grid max-w-6xl grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-start gap-4">
        {corner(cornerStart, 'start')}
        <div className="flex flex-col items-center">
          <div className="text-[28px] leading-none" style={{ fontFamily: SERIF }}>PetWash™‎</div>
          <div className="mt-1.5 text-[9px] tracking-[0.34em] uppercase" style={{ color: GOLD_INK }}>
            {isHe ? 'חיות מאושרות · מחר טוב יותר' : 'Happier pets. Brighter tomorrows.'}
          </div>
          <span className="mt-3"><Rule w={28} /></span>
        </div>
        {corner(cornerEnd, 'end')}
      </div>
      <h1 className="mt-5 font-normal leading-[0.95] text-black" style={{ fontFamily: SERIF, fontSize: 'clamp(3rem, 11vw, 6.5rem)', letterSpacing: '-0.01em' }}>
        {title}
        {titleMark && <sup className="align-super" style={{ fontSize: '0.22em', marginInlineStart: 4 }}>{titleMark}</sup>}
      </h1>
      <p className="mt-3 text-black" style={{ fontFamily: SERIF, fontSize: 'clamp(1.25rem, 3.4vw, 2rem)' }}>{subtitle}</p>
      <p className="mt-2 italic" style={{ fontFamily: SERIF, color: GOLD_INK, fontSize: 'clamp(1.15rem, 3vw, 1.75rem)' }}>{italic}</p>
    </header>
  );
}

export interface Pillar { icon: ReactNode; title: string; body: string }

/** Four gold-ringed pillars separated by hairlines. */
export function PillarRow({ pillars }: { pillars: Pillar[] }) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-10">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {pillars.map((p, i) => (
          <div key={p.title} className="flex flex-col items-center px-4 py-5" style={{ textAlign: 'center', borderInlineStart: i % 4 === 0 ? 'none' : `1px solid ${HAIRLINE}` }}>
            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ border: `1px solid ${GOLD}`, color: GOLD_INK }}>{p.icon}</span>
            <h3 className="mt-4 text-2xl text-black" style={{ fontFamily: SERIF }}>{p.title}</h3>
            <p className="mt-1.5 max-w-[16rem] text-[15px] leading-snug text-black/60" style={{ fontFamily: SERIF }}>{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export interface Step { icon: ReactNode; title: string; body: string }

/** Script lead-in + five steps with arrows, on warm paper. */
export function StepsBand({ lead, steps, isHe }: { lead: string; steps: Step[]; isHe: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-5">
      <div className="grid items-center gap-6 rounded-3xl px-6 py-8 md:grid-cols-[minmax(10rem,14rem)_1fr]" style={{ background: PAPER }}>
        <p className="italic leading-tight" style={{ fontFamily: SERIF, color: GOLD_INK, fontSize: 'clamp(1.6rem, 3.6vw, 2.4rem)', textAlign: isHe ? 'right' : 'left' }}>{lead}</p>
        <ol className="grid grid-cols-2 gap-y-6 sm:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.title} className="relative flex flex-col items-center px-2" style={{ textAlign: 'center' }}>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white" style={{ border: `1px solid ${GOLD}`, color: GOLD_INK }}>{s.icon}</span>
              <span className="mt-3 text-xl text-black" style={{ fontFamily: SERIF }}>{s.title}</span>
              <span className="mt-1 text-[14px] italic leading-snug text-black/55" style={{ fontFamily: SERIF }}>{s.body}</span>
              {i < steps.length - 1 && (
                <span aria-hidden className="absolute top-6 hidden text-lg sm:block" style={{ color: GOLD_INK, insetInlineEnd: -8 }}>{isHe ? '←' : '→'}</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Closing band: photo, spaced caps statement, round gold seal, footer line. */
export function ClosingBand({ isHe, image, imageAlt, heading, caption, seal, footer }: {
  isHe: boolean;
  image: string;
  imageAlt: string;
  heading: string[];
  caption: string[];
  seal: string[];
  footer: ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 md:grid-cols-[1.2fr_1fr_auto]">
        <div className="relative h-56 overflow-hidden rounded-3xl md:h-64">
          <img src={image} alt={imageAlt} className="h-full w-full object-cover" loading="lazy" />
          <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(${isHe ? '270deg' : '90deg'}, transparent 55%, #fff 100%)` }} />
        </div>
        <div style={{ textAlign: isHe ? 'right' : 'left' }}>
          <Rule w={28} />
          {heading.map((h) => (
            <div key={h} className="mt-2 text-sm tracking-[0.32em] uppercase text-black">{h}</div>
          ))}
          <div className="mt-4"><Rule w={28} /></div>
          {caption.map((c) => (
            <div key={c} className="mt-1.5 text-[11px] tracking-[0.26em] uppercase text-black/55">{c}</div>
          ))}
        </div>
        <div className="mx-auto flex h-40 w-40 flex-col items-center justify-center rounded-full bg-white" style={{ border: `1px solid ${GOLD}`, boxShadow: `0 0 0 6px #fff, 0 0 0 7px ${HAIRLINE}`, textAlign: 'center' }}>
          {seal.map((s) => (
            <span key={s} className="text-[11px] tracking-[0.26em] uppercase text-black leading-6">{s}</span>
          ))}
          <span className="mt-1"><Rule w={18} /></span>
        </div>
      </div>
      <footer className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t px-5 py-6" style={{ borderColor: HAIRLINE }}>
        <div className="flex items-center gap-4">
          <span className="text-3xl" style={{ fontFamily: SERIF }}>PetWash™‎</span>
          <span className="h-8 w-px" style={{ background: HAIRLINE }} />
          <span className="text-lg italic" style={{ fontFamily: SERIF }}>{footer}</span>
        </div>
        <div className="flex items-center gap-3">
          <Rule w={20} />
          <span className="text-[10px] tracking-[0.3em] uppercase text-black/60 leading-5" style={{ textAlign: isHe ? 'left' : 'right' }}>
            {isHe ? <>חמלה היום<br />מחר טוב יותר</> : <>Compassion today.<br />Brighter tomorrows.</>}
          </span>
        </div>
      </footer>
    </section>
  );
}

/** Sidebar nav row + the soft note card under it. */
export function SideNav({ title, subtitle, items, active, onSelect, note, icon }: {
  title: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  items: { key: string; label: string; icon: ReactNode; badge?: number }[];
  active: string;
  onSelect: (key: string) => void;
  note: string[];
}) {
  return (
    <aside className="hidden lg:block w-56 shrink-0">
      <div className="flex items-start gap-2 px-2">
        {icon && <span style={{ color: GOLD_INK }}>{icon}</span>}
        <div>
          <div className="text-[26px] leading-tight text-black" style={{ fontFamily: SERIF }}>{title}</div>
          {subtitle && <div className="mt-1 text-[13px] leading-snug text-black/55">{subtitle}</div>}
        </div>
      </div>
      <nav className="mt-6 flex flex-col gap-1">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => onSelect(it.key)}
            data-testid={`sidenav-${it.key}`}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
            style={{ background: active === it.key ? PAPER : 'transparent', color: INK, fontWeight: active === it.key ? 600 : 400 }}
          >
            <span style={{ color: active === it.key ? GOLD_INK : 'rgba(0,0,0,0.55)' }}>{it.icon}</span>
            <span className="flex-1" style={{ textAlign: 'start' }}>{it.label}</span>
            {!!it.badge && <span className="rounded-full px-1.5 text-[11px] text-white" style={{ background: GOLD_INK }}>{it.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="mt-8 rounded-2xl px-5 py-6" style={{ background: PAPER }}>
        {note.map((n) => (
          <div key={n} className="text-[22px] leading-snug" style={{ fontFamily: SERIF, color: GOLD_INK }}>{n}</div>
        ))}
        <span className="mt-3 block h-px w-8" style={{ background: GOLD }} />
      </div>
    </aside>
  );
}

/** Rounded filter chip — black when active, hairline when not. */
export function Chip({ active, onClick, children, testId }: { active?: boolean; onClick?: () => void; children: ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={!!active}
      className="rounded-full px-3.5 py-1.5 text-[13px] transition-colors whitespace-nowrap"
      style={{ background: active ? INK : '#fff', color: active ? '#fff' : INK, border: `1px solid ${active ? INK : HAIRLINE}` }}
    >
      {children}
    </button>
  );
}
