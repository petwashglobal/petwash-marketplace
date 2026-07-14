import { useEffect } from "react";
import { SOCIAL_LINKS } from "@/components/FollowUsBar";
import { useSEO, pageSEO } from "@/lib/seo";

/**
 * /follow — the QR destination for in-station "film & tag @petwashltd" signage.
 * Big, mobile-first tap targets to every PetWash social, plus the UGC prompt.
 * Hebrew-first; brand names LTR. No login, no data collection.
 */
const MAIN = SOCIAL_LINKS.filter((l) => l.key !== "spotify");
const SPOTIFY = SOCIAL_LINKS.find((l) => l.key === "spotify");

const BRAND: Record<string, { bg: string; label: string; handle: string }> = {
  instagram: { bg: "linear-gradient(135deg,#833AB4,#E1306C,#F77737)", label: "Instagram", handle: "@petwashltd" },
  tiktok:    { bg: "#000000", label: "TikTok", handle: "@petwashltd" },
  facebook:  { bg: "#1877F2", label: "Facebook", handle: "petwashltd" },
};

export default function Follow() {
  useSEO(pageSEO.follow);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col items-center px-5 py-10" dir="rtl">
      <div className="w-full max-w-md text-center">
        <div className="text-6xl mb-4">🐾</div>
        <h1 className="text-3xl font-extrabold text-gray-900">עקבו אחרינו</h1>
        <p className="text-gray-500 mt-2 leading-relaxed">
          צלמו את השטיפה של הכלב שלכם, תייגו <span dir="ltr" className="font-semibold">@petwashltd</span> —
          ואולי תופיעו אצלנו 🎬
        </p>

        <div className="mt-8 space-y-3">
          {MAIN.map(({ key, href, Icon }) => {
            const b = BRAND[key];
            return (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-4 rounded-2xl px-5 py-4 text-white shadow-md active:scale-[0.98] transition-transform"
                style={{ background: b.bg }}
                data-testid={`follow-cta-${key}`}
              >
                <Icon className="w-7 h-7 shrink-0" />
                <span className="flex-1 text-right">
                  <span className="block font-bold text-lg leading-tight">{b.label}</span>
                  <span dir="ltr" className="block text-white/85 text-sm">{b.handle}</span>
                </span>
                <span className="text-white/80 text-xl">›</span>
              </a>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-semibold text-gray-800 mb-1">איך מתייגים?</p>
          <p>מעלים סטורי או ריל, מוסיפים <span dir="ltr" className="font-semibold">@petwashltd</span> ו-<span dir="ltr">#PetWashLtd</span>. זהו 🐶</p>
        </div>

        {SPOTIFY && (
          <a
            href={SPOTIFY.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 mt-6 text-sm text-gray-400 hover:text-gray-600"
          >
            <SPOTIFY.Icon className="w-4 h-4" /> הפלייליסט שלנו ב-Spotify
          </a>
        )}

        <p className="mt-10 text-xs text-gray-300">PetWash™ · פארק ולד, כפר סבא</p>
      </div>
    </div>
  );
}
