/**
 * LuxeMetallicHero — the CEO-approved LVMH/Gucci-grade metallic homepage hero
 * (2026-06-18). Pure metallic black base, metallic gold + diamond, RTL Hebrew.
 *
 * Minimal by design: a glam statement (logo · headline · line · one CTA), NOT a
 * service catalogue — the full offering lives in the hamburger menu + the
 * Divisions section. PetWash Hub IS the dual-bay K9000 self-service station (ONE
 * thing, never shown as two).
 *
 * Brand rules: metallic gold (never flat yellow), no cream/gray; the REAL
 * PetWash™ logo asset shown UNALTERED in a white chip (asset is black; the chip
 * lets it sit on the black hero without recolouring — the ™ stays the legal mark).
 */
import { Link } from 'wouter';

export function LuxeMetallicHero({ onJoin }: { onJoin?: () => void }) {
  return (
    <section dir="rtl" className="lmh">
      <style>{`
        .lmh{position:relative;background:linear-gradient(160deg,#111114 0%,#000 50%,#15140f 100%);padding:clamp(40px,8vw,110px) clamp(18px,5vw,64px);overflow:hidden;font-family:'Assistant','Heebo',sans-serif}
        .lmh-frame{position:absolute;inset:14px;border:1.5px solid;border-image:linear-gradient(135deg,#fbeeb0,#d4af37,#9a7218,#f3da82) 1;border-radius:24px;opacity:.7;pointer-events:none}
        .lmh-in{position:relative;max-width:920px;margin:0 auto;text-align:center}
        .lmh-logo{display:inline-flex;background:#fff;border-radius:14px;padding:11px 20px;margin-bottom:clamp(20px,4vw,34px)}
        .lmh-logo img{height:clamp(34px,5vw,46px);width:auto;display:block}
        .lmh-rule{width:120px;height:1.4px;margin:0 auto clamp(18px,3vw,28px);background:linear-gradient(90deg,transparent,#d4af37,transparent)}
        .lmh-h1{font-size:clamp(38px,8vw,96px);line-height:1.04;font-weight:800;letter-spacing:-.02em;margin:0 0 16px}
        .lmh-h1 span{display:block;background:linear-gradient(180deg,#fff,#dadbe2,#a9abb6);-webkit-background-clip:text;background-clip:text;color:transparent}
        .lmh-h1 .g{background:linear-gradient(180deg,#fbeeb0,#d4af37,#9a7218,#f3da82);-webkit-background-clip:text;background-clip:text;color:#d4af37}
        .lmh-sub{color:#c9cad2;font-size:clamp(16px,2.6vw,26px);line-height:1.5;max-width:600px;margin:0 auto clamp(26px,4vw,38px)}
        .lmh-cta{display:inline-block;border:none;cursor:pointer;text-decoration:none;background:linear-gradient(180deg,#fbeeb0,#d4af37,#9a7218,#f3da82);color:#0a0a0a;font-size:clamp(18px,2.6vw,24px);font-weight:800;padding:16px clamp(48px,8vw,72px);border-radius:999px}
        .lmh-app{color:#8a8b93;font-size:13px;margin-top:16px}
      `}</style>
      <div className="lmh-frame" aria-hidden="true" />
      <div className="lmh-in">
        <span className="lmh-logo"><img src="/brand/petwash-logo-official.png" alt="PetWash™" /></span>
        <div className="lmh-rule" aria-hidden="true" />
        <h1 className="lmh-h1">
          <span>קהילת</span>
          <span className="g">חיות המחמד</span>
          <span>של ישראל.</span>
        </h1>
        <p className="lmh-sub">כל השירותים, אנשי המקצוע והקהילה — במקום אחד.</p>
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
