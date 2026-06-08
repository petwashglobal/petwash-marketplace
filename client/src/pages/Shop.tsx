/**
 * Shop — PetWash retail surface for branded merch + pet-lifestyle products.
 *
 * Owner direction 2026-05-24: previous version had three generic placeholder
 * cards (Organic Shampoos $24.99, Pet Accessories $34.99, Care Bundles
 * $89.99) — every price invented, no real product behind any of them.
 * Replaced with a real product-category preview that names the actual
 * planned lineup and gives customers a waitlist option. NO invented
 * prices. NO "Buy Now" buttons on products that don't exist.
 *
 * Product directions from owner (verbatim → categorised):
 *   - Personalized keychains (engraved with pet name, breed icon)
 *   - Healthy treats (organic, Israeli-sourced)
 *   - + more (organic shampoo/conditioner, branded apparel, station
 *     consumables, wash-credit gift cards)
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Tag, Heart, Sparkles, ShoppingBag, Mail, ArrowRight, Gift,
  Award, CheckCircle2,
} from 'lucide-react';

type LifeCategory = {
  id: string;
  iconBg: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle: string;
  examples: string[];
  status: 'in_development' | 'concept';
};

const CATEGORIES: LifeCategory[] = [
  {
    id: 'personalised',
    iconBg: 'linear-gradient(135deg,#f4d48a,#9d6f23)',
    icon: Tag,
    title: 'Personalised',
    subtitle: 'Engraved keychains, ID tags, and name-stamped collars.',
    examples: [
      'Engraved metal keychain — pet name + breed icon',
      'Stainless ID tag — phone number + chip ID',
      'Leather collar — pet name embossed',
      'Luggage-style luxury tag — for harnesses and bags',
    ],
    status: 'in_development',
  },
  {
    id: 'treats',
    iconBg: 'linear-gradient(135deg,#f97316,#dc2626)',
    icon: Heart,
    title: 'Treats — clean ingredients',
    subtitle: 'Israeli-sourced, no junk fillers.',
    examples: [
      'Cold-pressed liver bites',
      'Tea-tree-free training treats',
      'Single-protein chews',
      'Senior-formula soft treats',
    ],
    status: 'in_development',
  },
  {
    id: 'wash',
    iconBg: 'linear-gradient(135deg,#10b981,#059669)',
    icon: Sparkles,
    title: 'Wash + care',
    subtitle: 'Australian-made shampoo and conditioner.',
    examples: [
      'Gentle shampoo — sensitive skin',
      'Tea-tree-oil conditioner — coat repair',
      'Detangle finishing spray',
      'Paw + pad balm',
    ],
    status: 'in_development',
  },
  {
    id: 'gift',
    iconBg: 'linear-gradient(135deg,#a855f7,#7e22ce)',
    icon: Gift,
    title: 'Wash credits + e-gifts',
    subtitle: 'Pre-paid station credits, gift cards, and loyalty top-ups.',
    examples: [
      'PetWash gift card — any amount',
      '5-wash pre-paid pack',
      'Birthday-month gift bundle',
      'Refer-a-friend wash credit',
    ],
    status: 'in_development',
  },
  {
    id: 'apparel',
    iconBg: 'linear-gradient(135deg,#0b1220,#475569)',
    icon: Award,
    title: 'Apparel + branded',
    subtitle: 'Limited drops. PetWash bandanas, owner hoodies, beach towels.',
    examples: [
      'PetWash bandana — signature gold + black',
      'Owner hoodie — embroidered logo',
      'Microfibre quick-dry towel',
      'Limited-drop seasonal collection',
    ],
    status: 'concept',
  },
  {
    id: 'consumables',
    iconBg: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    icon: ShoppingBag,
    title: 'Station consumables',
    subtitle: 'For franchisees and operators — bulk pricing, no retail markup.',
    examples: [
      'Bulk shampoo refills',
      'Replacement tea-tree oil cartridges',
      'Station microfibre roll stock',
      'Spare brushes + hoses',
    ],
    status: 'concept',
  },
];

export default function Shop() {
  const [, setLocation] = useLocation();
  const [submittedCategory, setSubmittedCategory] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [interest, setInterest] = useState<string[]>([]);

  const toggleInterest = (id: string) => {
    setInterest((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submitWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // Real wiring lands when /api/shop/waitlist exists. Until then route
    // the operator to a mailto. Keeps the page honest — no fake "you're on
    // the list!" toast when there is no backend.
    const body = `Email: ${email}\nInterests: ${interest.join(', ') || '(none selected)'}\n\nFrom PetWash shop waitlist.`;
    window.location.href = `mailto:shop@petwash.co.il?subject=${encodeURIComponent('PetWash Shop — Waitlist')}&body=${encodeURIComponent(body)}`;
    setSubmittedCategory('done');
  };

  return (
    <div className="sh-shell">
      <style>{styles()}</style>

      <div className="sh-frame">
        <button type="button" className="sh-back" onClick={() => setLocation('/')}>
          ← Back
        </button>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <header className="sh-hero">
          <div className="sh-eyebrow">PetWash™ Shop</div>
          <h1 className="sh-h1">
            The pet-lifestyle shop.<br />
            <span className="sh-gold">In development — join the waitlist.</span>
          </h1>
          <p className="sh-intro">
            We are curating a tight lineup of branded merch, personalised accessories,
            and clean-ingredient treats. Honest preview below; no products are on
            sale yet. Tell us what you want first and you'll be notified when each
            category opens.
          </p>
        </header>

        {/* ── Categories ──────────────────────────────────────────────── */}
        <section className="sh-categories">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isPicked = interest.includes(cat.id);
            return (
              <article key={cat.id} className={`sh-card${isPicked ? ' is-picked' : ''}`}>
                <div className="sh-cardHead">
                  <span className="sh-cardIcon" style={{ background: cat.iconBg }}>
                    <Icon size={22} />
                  </span>
                  <span className={`sh-statusPill sh-status--${cat.status}`}>
                    {cat.status === 'in_development' ? 'In development' : 'Concept'}
                  </span>
                </div>
                <h3 className="sh-cardTitle">{cat.title}</h3>
                <p className="sh-cardSub">{cat.subtitle}</p>
                <ul className="sh-examples">
                  {cat.examples.map((ex) => (
                    <li key={ex}>— {ex}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`sh-pickBtn${isPicked ? ' is-on' : ''}`}
                  onClick={() => toggleInterest(cat.id)}
                  aria-pressed={isPicked}
                >
                  {isPicked ? (
                    <><CheckCircle2 size={16} /> Interested</>
                  ) : (
                    <><Mail size={16} /> Notify me</>
                  )}
                </button>
              </article>
            );
          })}
        </section>

        {/* ── Waitlist form ───────────────────────────────────────────── */}
        <section className="sh-waitlist">
          <div className="sh-waitInner">
            <h2 className="sh-h2">Join the waitlist</h2>
            <p className="sh-intro sh-intro--small">
              Tap a category above to mark interest. Add your email here and we'll
              notify you per category as each opens.
            </p>
            <form onSubmit={submitWaitlist} className="sh-form">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                className="sh-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className="sh-submit">
                Join {interest.length > 0 && <span className="sh-count">({interest.length} selected)</span>}
                <ArrowRight size={16} />
              </button>
            </form>
            {submittedCategory === 'done' && (
              <p className="sh-toast">Thanks — your email client should have opened with the waitlist message.</p>
            )}
          </div>
        </section>

        {/* ── Honest notice ───────────────────────────────────────────── */}
        <footer className="sh-foot">
          <p>
            Honest disclosure: every product above is in development or concept.
            None are on sale. No prices are published until SKUs are real and stock
            is in. Active PetWash surfaces today: K9000 wash stations, Sitter Suite,
            Walk My Pet, PetTrek.
          </p>
        </footer>
      </div>
    </div>
  );
}

function styles() {
  return `
    .sh-shell{ min-height:100vh; background:#fafaf9; color:#0b1220; font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; padding-bottom:80px }
    .sh-frame{ max-width:1200px; margin:0 auto; padding:32px clamp(20px,4vw,40px) }
    .sh-back{ background:none; border:0; color:#64748b; font-weight:600; padding:8px 0; cursor:pointer; margin-bottom:24px }

    .sh-hero{ padding:24px 0 48px }
    .sh-eyebrow{ display:inline-block; font-size:12.5px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:#9d6f23; padding:8px 14px; border:1px solid #e7d4a0; border-radius:999px; background:linear-gradient(180deg,#fffdf6,#fdf5dc); margin-bottom:18px }
    .sh-h1{ font-family:"Playfair Display",Georgia,serif; font-size:clamp(34px,5vw,64px); line-height:1.04; letter-spacing:-.025em; margin:0 0 18px; color:#0b1220; font-weight:600 }
    .sh-gold{ background:linear-gradient(120deg,#d8ad55,#9d6f23 60%,#6e4a1a); -webkit-background-clip:text; background-clip:text; color:transparent }
    .sh-intro{ font-size:clamp(15px,1.3vw,17px); line-height:1.65; color:#475569; max-width:720px; margin:0 }
    .sh-intro--small{ font-size:14px; margin-bottom:18px }

    .sh-categories{ display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:20px; margin:32px 0 56px }
    .sh-card{ display:flex; flex-direction:column; gap:12px; padding:24px; background:#fff; border:1px solid #e7e5e0; border-radius:18px; transition:border-color .15s ease, transform .15s ease, box-shadow .15s ease }
    .sh-card:hover{ transform:translateY(-2px); box-shadow:0 14px 32px rgba(11,18,32,.06) }
    .sh-card.is-picked{ border-color:#9d6f23; box-shadow:0 0 0 3px rgba(216,173,85,.15) }
    .sh-cardHead{ display:flex; align-items:center; justify-content:space-between; gap:12px }
    .sh-cardIcon{ width:44px; height:44px; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; color:#fff }
    .sh-statusPill{ font-size:10.5px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; padding:4px 8px; border-radius:999px }
    .sh-status--in_development{ background:#dbeafe; color:#1e40af }
    .sh-status--concept{ background:#f1f5f9; color:#475569 }
    .sh-cardTitle{ font-size:18px; font-weight:800; margin:4px 0 4px; color:#0b1220 }
    .sh-cardSub{ font-size:14px; color:#475569; margin:0; line-height:1.55 }
    .sh-examples{ list-style:none; padding:0; margin:8px 0 14px; color:#334155; font-size:13.5px; line-height:1.7 }
    .sh-pickBtn{ display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border:1px solid #e2e8f0; background:#fff; color:#0b1220; border-radius:10px; font-weight:700; font-size:13.5px; cursor:pointer; transition:all .15s ease; min-height:42px; align-self:flex-start }
    .sh-pickBtn:hover{ border-color:#9d6f23 }
    .sh-pickBtn.is-on{ background:#0b1220; color:#fff; border-color:#0b1220 }

    .sh-waitlist{ padding:40px; background:#fff; border:1px solid #e7e5e0; border-radius:24px; margin-bottom:32px }
    .sh-waitInner{ max-width:640px; margin:0 auto; text-align:center }
    .sh-h2{ font-family:"Playfair Display",Georgia,serif; font-size:clamp(26px,3vw,38px); margin:0 0 12px; color:#0b1220; font-weight:600 }
    .sh-form{ display:flex; gap:10px; margin-top:18px; flex-wrap:wrap; justify-content:center }
    .sh-input{ flex:1; min-width:240px; padding:14px 16px; font-size:16px; border:1px solid #e2e8f0; border-radius:12px; background:#fafaf9; outline:none }
    .sh-input:focus{ border-color:#9d6f23; box-shadow:0 0 0 3px rgba(216,173,85,.18) }
    .sh-submit{ display:inline-flex; align-items:center; gap:8px; padding:14px 20px; background:#0b1220; color:#fff; border:0; border-radius:12px; font-weight:800; font-size:14.5px; cursor:pointer; min-height:50px }
    .sh-submit:hover{ background:#1e293b }
    .sh-count{ font-weight:600; opacity:.85 }
    .sh-toast{ margin-top:14px; padding:10px 14px; border-radius:10px; background:#d1fae5; color:#065f46; font-weight:700; display:inline-block }

    .sh-foot{ text-align:center; padding:24px; color:#64748b; font-size:13px; line-height:1.6; max-width:720px; margin:0 auto }
  `;
}
