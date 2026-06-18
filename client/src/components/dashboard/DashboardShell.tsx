/**
 * DashboardShell — the single luxury chrome shared by the executive role
 * dashboards (Admin, CEO). White background, black text, emerald accents,
 * the REAL PetWash™ logo asset top-center (never recreated/recolored), and
 * ONE consolidated "Tools" drawer that surfaces every back-office dashboard
 * (see executive-nav.ts) so admins no longer hit dead-end URLs.
 *
 * Brand rules honoured: pure-white surface, black text, emerald (#047857)
 * accents, gold reserved for glam/crown only, real logo asset top-center.
 */
import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X, Home, LogOut, Clock } from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { navForRole, type DashRole } from './executive-nav';
import { cn } from '@/lib/utils';

interface DashboardShellProps {
  role: DashRole;
  /** Page title shown in the utility bar (e.g. "Admin", "CEO Suite"). */
  title: string;
  subtitle?: string;
  /** Optional accent node rendered at the far right of the title row. */
  actions?: ReactNode;
  children: ReactNode;
}

export function DashboardShell({ role, title, subtitle, actions, children }: DashboardShellProps) {
  const [, navigate] = useLocation();
  const [location] = useLocation();
  const { logout } = useFirebaseAuth();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // Live clock — start after mount so SSR/first-paint is deterministic.
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Close the drawer on route change.
  useEffect(() => { setToolsOpen(false); }, [location]);

  const groups = navForRole(role);

  const handleLogout = async () => {
    try { await logout?.(); } finally { navigate('/'); }
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* ── Brand bar: REAL logo, top-center ───────────────────────────── */}
      <div className="border-b border-black/10 bg-white">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-center h-16">
            <button
              onClick={() => setToolsOpen(true)}
              className="absolute left-0 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-black hover:bg-black/[0.04] transition-colors"
              aria-label="Open tools menu"
              data-testid="button-open-tools"
            >
              <Menu className="w-5 h-5" />
              <span className="hidden sm:inline">Tools</span>
            </button>

            <Link href="/" className="pw-logo-link" aria-label="PetWash home">
              <img
                src="/brand/petwash-logo-official.png"
                alt="PetWash"
                className="h-10 w-auto object-contain"
              />
            </Link>

            <div className="absolute right-0 flex items-center gap-1">
              {now && (
                <div className="hidden md:flex items-center gap-1.5 text-xs text-black/50 font-mono mr-2">
                  <Clock className="w-3.5 h-3.5" />
                  {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-black/70 hover:bg-black/[0.04] transition-colors"
                data-testid="link-home"
              >
                <Home className="w-4 h-4" />
                <span className="hidden lg:inline">Home</span>
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-black/70 hover:bg-black/[0.04] transition-colors"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline">Log out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Title row ───────────────────────────────────────────────────── */}
      <div className="border-b border-black/10 bg-white">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-black">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-black/55">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* ── Tools drawer (consolidated back-office nav) ─────────────────── */}
      {toolsOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setToolsOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[88%] max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between px-5 h-16 border-b border-black/10">
              <span className="text-sm font-semibold uppercase tracking-[0.14em] text-black/60">Tools</span>
              <button
                onClick={() => setToolsOpen(false)}
                className="rounded-lg p-2 text-black/60 hover:bg-black/[0.04]"
                aria-label="Close tools menu"
                data-testid="button-close-tools"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
              {groups.map((g) => (
                <div key={g.group}>
                  <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#B8860B]">
                    {g.group}
                  </p>
                  <div className="space-y-0.5">
                    {g.items.map((item) => {
                      const Icon = item.icon;
                      const active = location === item.path || location.startsWith(`${item.path}/`);
                      return (
                        <Link
                          key={item.path}
                          href={item.path}
                          className={cn(
                            'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
                            active ? 'bg-[#D4AF37]/10 text-[#1A1A1A]' : 'text-black hover:bg-black/[0.04]',
                          )}
                          data-testid={`tool-${item.path}`}
                        >
                          <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', active ? 'text-[#B8860B]' : 'text-black/45')} />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium leading-tight">{item.label}</span>
                            {item.hint && <span className="block text-xs text-black/45 leading-tight mt-0.5">{item.hint}</span>}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
