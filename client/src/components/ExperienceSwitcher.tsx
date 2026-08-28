/**
 * ExperienceSwitcher — the multi-role workspace control.
 *
 * CEO 2026-08-26 role model: one PetWash account, a SET of workspaces.
 * A human can be a Pet Parent (customer) AND a Provider AND an Admin
 * at the same time; this lets them flip cleanly between those
 * workspaces instead of being trapped in one.
 *
 * WORKSPACES (not identities): Pet Parent | Provider | Admin.
 * Prestige is NOT a workspace — it is a membership entitlement that
 * travels with the human account. It surfaces as a badge inside the
 * Pet Parent home (see PrestigeHome enrolled-only wordmark / tier chip),
 * never as a switcher tile with a Crown.
 *
 * Server-authoritative: renders one button per workspace in
 * `dashboardsAllowed` (from /whoami) — never a client-side guess. Access
 * itself is still enforced by RoleProtectedRoute / RequireAuth; this is
 * pure navigation. It hides itself for single-workspace users (no
 * switcher noise for a plain Pet Parent).
 *
 * On native the two apps already separate the workspaces by bundle, so
 * this shows on web / shared surfaces where one person needs all their
 * hats in one place.
 */
import { useLocation } from 'wouter';
import { PawPrint, Briefcase, ShieldCheck, ChevronRight } from 'lucide-react';
import { useWhoami, type DashboardType } from '@/auth/useWhoami';
import { useLanguage } from '@/lib/languageStore';

// Which real route each workspace opens, plus how it presents. Note the
// `member` KEY is preserved because that is what /whoami.dashboardsAllowed
// still emits today; only the visible label / icon change from
// "Member + Crown" (Prestige framing) to "Pet Parent + PawPrint".
const WORKSPACES: Record<DashboardType, { route: string; en: string; he: string; sub_en: string; sub_he: string; icon: any; tone: string }> = {
  member:   { route: '/prestige/home',   en: 'Pet Parent', he: 'הורה לחיה', sub_en: 'Book, wash, wallet & rewards', sub_he: 'הזמנות, שטיפה, ארנק והטבות', icon: PawPrint,    tone: '#0e7a54' },
  provider: { route: '/provider-os',     en: 'Provider',   he: 'ספק',       sub_en: 'Jobs, calendar & earnings',    sub_he: 'עבודות, יומן והכנסות',        icon: Briefcase,   tone: '#0e7a54' },
  staff:    { route: '/admin/dashboard', en: 'Admin',      he: 'ניהול',     sub_en: 'Operations console',           sub_he: 'קונסולת תפעול',               icon: ShieldCheck, tone: '#334155' },
  admin:    { route: '/admin/dashboard', en: 'Admin',      he: 'ניהול',     sub_en: 'Operations console',           sub_he: 'קונסולת תפעול',               icon: ShieldCheck, tone: '#334155' },
};

const ORDER: DashboardType[] = ['member', 'provider', 'admin', 'staff'];

export function ExperienceSwitcher() {
  const [location, navigate] = useLocation();
  const { dashboardsAllowed, isAuthenticated } = useWhoami();
  const { language } = useLanguage();
  const he = language === 'he';

  if (!isAuthenticated) return null;

  // Every human is a Pet Parent; dedupe staff/admin to one "Admin" tile.
  const workspaces = new Set<DashboardType>(['member', ...dashboardsAllowed]);
  const tiles = ORDER.filter((w) => workspaces.has(w)).filter((w, i, arr) => {
    // collapse staff+admin → show only the first admin-tier tile
    if (w === 'staff' && arr.includes('admin')) return false;
    return true;
  });

  // A single-workspace user (Pet Parent only) has nothing to switch to —
  // don't show the control.
  if (tiles.length <= 1) return null;

  const onWorkspace = (route: string) => location === route || location.startsWith(route + '/');

  return (
    <div className="mb-6 rounded-2xl border border-gray-100 shadow-sm p-4" dir={he ? 'rtl' : 'ltr'}>
      <p className="text-sm font-semibold text-gray-900 mb-1">{he ? 'עברו בין המצבים' : 'Switch mode'}</p>
      <p className="text-[11px] text-gray-500 mb-3">
        {he ? 'חשבון אחד, כמה מצבים — עברו בין הורה לחיה, ספק וניהול.' : 'One account, several modes — jump between Pet Parent, Provider and Admin.'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {tiles.map((w) => {
          const cfg = WORKSPACES[w];
          const Icon = cfg.icon;
          const active = onWorkspace(cfg.route);
          return (
            <button
              key={w}
              onClick={() => navigate(cfg.route)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${active ? 'border-gray-300 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
              data-testid={`experience-switcher-${w}`}
            >
              <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${cfg.tone}14` }}>
                <Icon className="w-4.5 h-4.5" style={{ color: cfg.tone, width: 18, height: 18 }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-gray-900">{he ? cfg.he : cfg.en}{active && <span className="ml-1 text-[10px] font-normal text-gray-400">{he ? '· נוכחי' : '· current'}</span>}</span>
                <span className="block text-[11px] text-gray-500 truncate">{he ? cfg.sub_he : cfg.sub_en}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
