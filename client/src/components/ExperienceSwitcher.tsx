/**
 * ExperienceSwitcher — the multi-role control (CEO 2026-07-03).
 *
 * One PetWash account, a SET of capabilities. A person can be a Prestige member
 * AND a provider AND an admin at the same time (e.g. the founder). This lets
 * them flip cleanly between those worlds instead of being trapped in one.
 *
 * Server-authoritative: it renders one button per world in `dashboardsAllowed`
 * (from /whoami) — never a client-side guess. Access itself is still enforced by
 * RoleProtectedRoute / RequireAuth; this is pure navigation. It hides itself for
 * single-role users (no switcher noise for a plain member).
 *
 * On native the two apps already separate the worlds by bundle, so this shows on
 * web / shared surfaces where one person needs all their hats in one place.
 */
import { useLocation } from 'wouter';
import { Crown, Briefcase, ShieldCheck, ChevronRight } from 'lucide-react';
import { useWhoami, type DashboardType } from '@/auth/useWhoami';
import { useLanguage } from '@/lib/languageStore';

const GOLD = '#D4AF37';

// Which real route each world opens, plus how it presents.
const WORLDS: Record<DashboardType, { route: string; en: string; he: string; sub_en: string; sub_he: string; icon: any; tone: string }> = {
  member:   { route: '/prestige/home',  en: 'Member',   he: 'חבר',    sub_en: 'Book, wash, wallet & rewards', sub_he: 'הזמנות, שטיפה, ארנק והטבות', icon: Crown,       tone: GOLD },
  provider: { route: '/provider-os',    en: 'Provider', he: 'ספק',    sub_en: 'Jobs, calendar & earnings',    sub_he: 'עבודות, יומן והכנסות',        icon: Briefcase,   tone: '#0e7a54' },
  staff:    { route: '/admin/dashboard',en: 'Admin',    he: 'ניהול',  sub_en: 'Operations console',           sub_he: 'קונסולת תפעול',               icon: ShieldCheck, tone: '#334155' },
  admin:    { route: '/admin/dashboard',en: 'Admin',    he: 'ניהול',  sub_en: 'Operations console',           sub_he: 'קונסולת תפעול',               icon: ShieldCheck, tone: '#334155' },
};

const ORDER: DashboardType[] = ['member', 'provider', 'admin', 'staff'];

export function ExperienceSwitcher() {
  const [location, navigate] = useLocation();
  const { dashboardsAllowed, isAuthenticated } = useWhoami();
  const { language } = useLanguage();
  const he = language === 'he';

  if (!isAuthenticated) return null;

  // Everyone is a member; dedupe staff/admin to one "Admin" tile.
  const worlds = new Set<DashboardType>(['member', ...dashboardsAllowed]);
  const tiles = ORDER.filter((w) => worlds.has(w)).filter((w, i, arr) => {
    // collapse staff+admin → show only the first admin-tier tile
    if (w === 'staff' && arr.includes('admin')) return false;
    return true;
  });

  // A plain member has nothing to switch to — don't show the control.
  if (tiles.length <= 1) return null;

  const onWorld = (route: string) => location === route || location.startsWith(route + '/');

  return (
    <div className="mb-6 rounded-2xl border border-gray-100 shadow-sm p-4" dir={he ? 'rtl' : 'ltr'}>
      <p className="text-sm font-semibold text-gray-900 mb-1">{he ? 'עברו בין החוויות' : 'Switch experience'}</p>
      <p className="text-[11px] text-gray-500 mb-3">
        {he ? 'חשבון אחד, כמה תפקידים — עברו בין חבר, ספק וניהול.' : 'One account, several roles — jump between Member, Provider and Admin.'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {tiles.map((w) => {
          const cfg = WORLDS[w];
          const Icon = cfg.icon;
          const active = onWorld(cfg.route);
          return (
            <button
              key={w}
              onClick={() => navigate(cfg.route)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${active ? 'border-gray-300 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
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
