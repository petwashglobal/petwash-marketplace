/**
 * LuxeMetallicHero — the CEO-approved LVMH/Gucci-grade metallic hero (2026-06-18).
 * Pure metallic black base, metallic gold + diamond, jewel-metallic accents
 * (emerald / sapphire / rose / platinum). RTL Hebrew, fully responsive.
 *
 * Brand rules honoured: metallic (never flat yellow-gold, never cream/gray),
 * the REAL PetWash™ logo asset shown UNALTERED inside a white chip (the asset is
 * black, so a white plate lets it sit on the black hero without recolouring it —
 * the ™ stays part of the official mark). Not-live services carry a "בקרוב" tag.
 */
import { Link } from 'wouter';

interface Tile {
  name: string;
  desc: string;
  accent: string;        // CSS gradient for the top bar + border tint
  status: 'live' | 'soon';
  statusLabel: string;
}

const TILES: Tile[] = [
  { name: 'PetWash Hub™', desc: 'מרכז הרחצה והשירותים', accent: 'linear-gradient(90deg,#fbeeb0,#d4af37,#9a7218)', status: 'live', statusLabel: 'פעיל' },
  { name: 'K9000™', desc: 'עמדת רחצה עצמית · תשלום Nayax', accent: 'linear-gradient(90deg,#ffffff,#dadbe2,#a9abb6)', status: 'live', statusLabel: 'פעיל' },
  { name: 'Walk My Pet™', desc: 'טיולים וליווי לחיות מחמד', accent: 'linear-gradient(90deg,#36e0a0,#0C7A50,#063b27)', status: 'soon', statusLabel: 'בקרוב' },
  { name: 'The Sitter Suite™', desc: 'Pet Sitting מקצועי ואמין', accent: 'linear-gradient(90deg,#ffc6da,#d6457e,#7a2444)', status: 'soon', statusLabel: 'בקרוב' },
  { name: 'PetTrek™', desc: 'הסעות לחיות מחמד', accent: 'linear-gradient(90deg,#7db0ff,#2553d6,#10245e)', status: 'soon', statusLabel: 'בקרוב' },
  { name: 'Franchise Solutions™', desc: 'הצטרפו כשותפים בישראל', accent: 'linear-gradient(90deg,#ffffff,#bfe6f0,#7fc2d8)', status: 'live', statusLabel: 'פתוח' },
];

export function LuxeMetallicHero({ onJoin }: { onJoin?: () => void }) {
  return (
    <section dir="rtl" className="lmh">
      <style>{`
        .lmh{position:relative;background:linear-gradient(160deg,#111114 0%,#000 50%,#15140f 100%);padding:clamp(28px,5vw,64px) clamp(16px,4vw,56px);overflow:hidden;font-family:'Assistant','Heebo',sans-serif}
        .lmh-frame{position:absolute;inset:14px;border:1.5px solid;border-image:linear-gradient(135deg,#fbeeb0,#d4af37,#9a7218,#f3da82) 1;border-radius:22px;opacity:.7;pointer-events:none}
        .lmh-in{position:relative;max-width:1040px;margin:0 auto;text-align:center}
        .lmh-logo{display:inline-flex;background:#fff;border-radius:14px;padding:10px 18px;margin-bottom:22px}
        .lmh-logo img{height:38px;width:auto;display:block}
        .lmh-h1{font-size:clamp(34px,7vw,86px);line-height:1.05;font-weight:800;letter-spacing:-.02em;margin:0 0 14px}
        .lmh-h1 span{display:block;background:linear-gradient(180deg,#fff,#dadbe2,#a9abb6);-webkit-background-clip:text;background-clip:text;color:transparent}
        .lmh-h1 .g{background:linear-gradient(180deg,#fbeeb0,#d4af37,#9a7218,#f3da82);-webkit-background-clip:text;background-clip:text;color:#d4af37}
        .lmh-sub{color:#c9cad2;font-size:clamp(15px,2.4vw,24px);line-height:1.5;max-width:620px;margin:0 auto 26px}
        .lmh-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-bottom:26px}
        .lmh-tile{position:relative;background:#0c0c0e;border:1px solid rgba(212,175,55,.35);border-radius:16px;padding:18px 18px 16px;text-align:right;overflow:hidden}
        .lmh-bar{position:absolute;top:0;right:0;left:0;height:5px}
        .lmh-name{font-size:clamp(18px,2.2vw,24px);font-weight:700;margin:6px 0 4px;background:linear-gradient(180deg,#fbeeb0,#d4af37,#9a7218);-webkit-background-clip:text;background-clip:text;color:#d4af37}
        .lmh-desc{color:#b9bac2;font-size:14px;line-height:1.45}
        .lmh-pill{position:absolute;top:14px;left:14px;font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px}
        .lmh-live{color:#36e0a0;border:1px solid rgba(54,224,160,.4)}
        .lmh-soon{color:#e9c96a;border:1px solid rgba(212,175,55,.4)}
        .lmh-cta{display:inline-block;border:none;cursor:pointer;background:linear-gradient(180deg,#fbeeb0,#d4af37,#9a7218,#f3da82);color:#0a0a0a;font-size:clamp(17px,2.4vw,22px);font-weight:800;padding:15px 54px;border-radius:999px}
        .lmh-app{color:#8a8b93;font-size:13px;margin-top:14px}
      `}</style>
      <div className="lmh-frame" aria-hidden="true" />
      <div className="lmh-in">
        <span className="lmh-logo"><img src="/brand/petwash-logo-official.png" alt="PetWash™" /></span>
        <h1 className="lmh-h1">
          <span>קהילת</span>
          <span className="g">חיות המחמד</span>
          <span>של ישראל.</span>
        </h1>
        <p className="lmh-sub">כל השירותים, אנשי המקצוע והקהילה — במקום אחד.</p>

        <div className="lmh-grid">
          {TILES.map((tile) => (
            <div className="lmh-tile" key={tile.name}>
              <div className="lmh-bar" style={{ background: tile.accent }} />
              <span className={`lmh-pill ${tile.status === 'live' ? 'lmh-live' : 'lmh-soon'}`}>● {tile.statusLabel}</span>
              <div className="lmh-name">{tile.name}</div>
              <div className="lmh-desc">{tile.desc}</div>
            </div>
          ))}
        </div>

        {onJoin ? (
          <button className="lmh-cta" onClick={onJoin} data-testid="hero-join">הצטרפו עכשיו</button>
        ) : (
          <Link href="/signup" className="lmh-cta" data-testid="hero-join">הצטרפו עכשיו</Link>
        )}
        <div className="lmh-app">בקרוב באפליקציה · App Store · Google Play</div>
      </div>
    </section>
  );
}
