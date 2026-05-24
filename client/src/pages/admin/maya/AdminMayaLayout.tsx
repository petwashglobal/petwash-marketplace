/**
 * Shared layout shell for all /admin/maya/* pages.
 *
 * Design: minimal, typography-first, black/white, hairline borders,
 * generous spacing. Mobile-first; iPad Safari treated as a first-class
 * breakpoint via the md: prefix (≥768px).
 *
 * Nav lives in a fixed top bar; on mobile the secondary nav collapses
 * to a horizontal scroll strip rather than a hamburger drawer (faster
 * for staff who switch panels constantly).
 *
 * No gradients, no rounded-2xl, no decorative shadows.
 */
import { Link, useLocation } from 'wouter';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { type ReactNode } from 'react';

const NAV: Array<{ path: string; label: string }> = [
  { path: '/admin/maya', label: 'Overview' },
  { path: '/admin/maya/inbox', label: 'Inbox' },
  { path: '/admin/maya/leads', label: 'Leads' },
  { path: '/admin/maya/provider-drafts', label: 'Provider drafts' },
  { path: '/admin/maya/booking-drafts', label: 'Booking drafts' },
  { path: '/admin/maya/tasks', label: 'Tasks' },
  { path: '/admin/maya/escalations', label: 'Escalations' },
  { path: '/admin/maya/voice/calls', label: 'Voice' },
  { path: '/admin/maya/audit', label: 'Audit' },
];

interface AdminMayaLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function AdminMayaLayout({ title, subtitle, actions, children }: AdminMayaLayoutProps) {
  const [location] = useLocation();
  const { admin } = useAdminAuth();

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Top brand bar */}
      <div className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
              PetWash&trade;
            </span>
            <span className="text-xs text-neutral-400">/</span>
            <span className="text-sm font-medium text-neutral-900">Maya</span>
          </div>
          <div className="text-xs text-neutral-500" data-testid="admin-identity">
            {admin?.email ?? 'admin'}
          </div>
        </div>
      </div>

      {/* Section nav */}
      <nav
        className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur"
        aria-label="Maya admin sections"
      >
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <ul className="flex gap-1 overflow-x-auto py-2 md:gap-2" role="list">
            {NAV.map((item) => {
              const active =
                item.path === '/admin/maya'
                  ? location === '/admin/maya'
                  : location === item.path || location.startsWith(item.path + '/');
              return (
                <li key={item.path} className="shrink-0">
                  <Link
                    href={item.path}
                    className={[
                      'block whitespace-nowrap rounded-sm px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Page header */}
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 md:flex-row md:items-end md:justify-between md:px-8 md:py-10">
          <div>
            <h1 className="text-2xl font-medium tracking-tight md:text-3xl">{title}</h1>
            {subtitle && (
              <p className="mt-2 max-w-2xl text-sm text-neutral-500">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </header>

      {/* Page body */}
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">{children}</main>
    </div>
  );
}

/**
 * Reusable empty-state when the backend reports maya_disabled or
 * feature_disabled. Honest, restrained, no exclamation marks.
 */
export function MayaDisabledState({ feature }: { feature?: string }) {
  return (
    <div className="rounded-sm border border-neutral-200 bg-white px-6 py-12 text-center">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
        Currently disabled
      </div>
      <p className="mt-3 text-sm text-neutral-600">
        Maya {feature ? `(${feature})` : ''} is not enabled in this environment. An admin can enable
        it from the system configuration.
      </p>
    </div>
  );
}

/**
 * Reusable loading placeholder. No spinners — quiet.
 */
export function MayaLoading() {
  return (
    <div className="rounded-sm border border-neutral-200 bg-white px-6 py-10 text-center text-sm text-neutral-500">
      Loading…
    </div>
  );
}

/**
 * Reusable empty list state. Used when the API returns successfully but
 * there's no data yet.
 */
export function MayaEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-sm border border-neutral-200 bg-white px-6 py-10 text-center text-sm text-neutral-500">
      {message}
    </div>
  );
}
