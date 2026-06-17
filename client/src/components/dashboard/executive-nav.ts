/**
 * executive-nav.ts
 *
 * SINGLE source of truth for the back-office dashboard menu. Before this, the
 * ~28 admin/executive dashboards (Finance, Ops, HR, Sales, Stations, …) were
 * each a standalone page reachable only by typing its URL — admins hit dead
 * ends and the sprawl was invisible. DashboardShell renders this registry as
 * one consolidated "Tools" menu so every back-office surface is discoverable
 * from one place, grouped and role-gated.
 *
 * To surface a dashboard: add it here. Do NOT re-implement a second menu.
 *
 * `roles` = which signed-in roles see the link. 'admin' covers admin +
 * super_admin; 'ceo' is the executive/founder suite (a superset — CEO sees
 * everything admin sees plus the executive-only group).
 */
import type { ComponentType } from 'react';
import {
  LayoutDashboard, BarChart3, Wallet, Users, Banknote, Building2, Bot,
  Truck, Briefcase, Star, ClipboardList, ShieldCheck, Handshake, MapPin,
  Package, FileText, Crown, Gift, Receipt, Activity,
} from 'lucide-react';

export type DashRole = 'admin' | 'ceo';

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  roles: DashRole[];
  /** Short one-line description shown under the label in the menu. */
  hint?: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

/**
 * Grouped back-office navigation. Paths are the live routes confirmed in
 * client/src/App.tsx. Keep groups small and labelled in plain language.
 */
export const EXECUTIVE_NAV: NavGroup[] = [
  {
    group: 'Command',
    items: [
      { label: 'Admin Overview', path: '/admin/dashboard', icon: LayoutDashboard, roles: ['admin', 'ceo'], hint: 'KPIs, analytics, payments' },
      { label: 'CEO Suite', path: '/pet-wash-ltd/executive/ceo', icon: Crown, roles: ['ceo'], hint: 'Founder tools & gift cards' },
      { label: 'Operations Brain', path: '/admin/brain', icon: Bot, roles: ['admin', 'ceo'], hint: 'Live stations, alerts, approvals' },
    ],
  },
  {
    group: 'Money',
    items: [
      { label: 'Finance', path: '/admin/finance', icon: Banknote, roles: ['admin', 'ceo'], hint: 'Accounting & tax' },
      { label: 'Wallet & Reconciliation', path: '/admin/wallet-finance', icon: Wallet, roles: ['admin', 'ceo'], hint: 'Balances, payouts, settlement' },
      { label: 'Sales', path: '/admin/sales', icon: BarChart3, roles: ['admin', 'ceo'], hint: 'Revenue, deals, forecasts' },
      { label: 'Suppliers', path: '/admin/suppliers', icon: Truck, roles: ['admin', 'ceo'], hint: 'Vendors & invoicing' },
      { label: 'SUMIT Payments', path: '/admin/sumit', icon: Receipt, roles: ['admin', 'ceo'], hint: 'Invoicing & charge status' },
    ],
  },
  {
    group: 'People',
    items: [
      { label: 'CRM', path: '/admin/crm', icon: Users, roles: ['admin', 'ceo'], hint: 'Customers & leads' },
      { label: 'HR', path: '/admin/hr', icon: Briefcase, roles: ['admin', 'ceo'], hint: 'Hiring, payroll, docs' },
      { label: 'Recruitment', path: '/admin/recruitment', icon: ClipboardList, roles: ['admin', 'ceo'], hint: 'Job postings & applicants' },
      { label: 'Performance Reviews', path: '/admin/performance-reviews', icon: Star, roles: ['admin', 'ceo'], hint: 'Employee reviews' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { label: 'Operations', path: '/admin/operations', icon: Activity, roles: ['admin', 'ceo'], hint: 'Station ops & bay scheduling' },
      { label: 'Logistics', path: '/admin/logistics', icon: Package, roles: ['admin', 'ceo'], hint: 'Fulfilment & shipping' },
      { label: 'Stations', path: '/admin/stations', icon: MapPin, roles: ['admin', 'ceo'], hint: 'Facilities' },
      { label: 'Station Registry', path: '/admin/station-registry', icon: Building2, roles: ['admin', 'ceo'], hint: 'Licensing & taxes' },
      { label: 'Marketplace Intelligence', path: '/admin/marketplace-intelligence', icon: BarChart3, roles: ['admin', 'ceo'], hint: 'Provider ranking & insights' },
    ],
  },
  {
    group: 'Governance',
    items: [
      { label: 'KYC Review', path: '/admin/kyc', icon: ShieldCheck, roles: ['admin', 'ceo'], hint: 'Identity & document review' },
      { label: 'Policy & Compliance', path: '/admin/policy', icon: FileText, roles: ['admin', 'ceo'], hint: 'Governance docs' },
      { label: 'Franchise', path: '/admin/franchise', icon: Handshake, roles: ['admin', 'ceo'], hint: 'Franchise operations' },
      { label: 'JV Partners', path: '/admin/jv-partners', icon: Handshake, roles: ['admin', 'ceo'], hint: 'Joint-venture management' },
      { label: 'Vouchers', path: '/admin/vouchers', icon: Gift, roles: ['admin', 'ceo'], hint: 'Gift cards & coupons' },
    ],
  },
];

/** Flat, role-filtered list of nav groups for a given role. */
export function navForRole(role: DashRole): NavGroup[] {
  return EXECUTIVE_NAV
    .map((g) => ({ group: g.group, items: g.items.filter((i) => i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);
}
