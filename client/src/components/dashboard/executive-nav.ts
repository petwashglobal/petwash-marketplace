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
  Package, FileText, Crown, Gift, Receipt, Activity, ShieldAlert,
} from 'lucide-react';

export type DashRole = 'admin' | 'ceo';

export interface NavItem {
  label: string;
  /** Hebrew label. Rendered when the dashboard language is 'he'. */
  labelHe?: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  roles: DashRole[];
  /** Short one-line description shown under the label in the menu. */
  hint?: string;
  /** Hebrew hint. Rendered when the dashboard language is 'he'. */
  hintHe?: string;
}

export interface NavGroup {
  group: string;
  /** Hebrew group name. Rendered when the dashboard language is 'he'. */
  groupHe?: string;
  items: NavItem[];
}

/**
 * Grouped back-office navigation. Paths are the live routes confirmed in
 * client/src/App.tsx. Keep groups small and labelled in plain language.
 */
export const EXECUTIVE_NAV: NavGroup[] = [
  {
    group: 'Command',
    groupHe: 'פיקוד',
    items: [
      { label: 'Admin Overview', labelHe: 'סקירת ניהול', path: '/admin/dashboard', icon: LayoutDashboard, roles: ['admin', 'ceo'], hint: 'KPIs, analytics, payments', hintHe: 'מדדים, אנליטיקה ותשלומים' },
      { label: 'CEO Report', labelHe: 'דוח מנכ״ל', path: '/admin/ceo-report', icon: Activity, roles: ['admin', 'ceo'], hint: 'Yesterday digest + eGift intelligence', hintHe: 'תקציר אתמול + מודיעין גיפט' },
      { label: 'CEO Suite', labelHe: 'חדר מנכ״ל', path: '/pet-wash-ltd/executive/ceo', icon: Crown, roles: ['ceo'], hint: 'Founder tools & gift cards', hintHe: 'כלי מייסד וכרטיסי מתנה' },
      { label: 'Operations Brain', labelHe: 'מרכז תפעול', path: '/admin/brain', icon: Bot, roles: ['admin', 'ceo'], hint: 'Live stations, alerts, approvals', hintHe: 'עמדות בזמן אמת, התראות ואישורים' },
      { label: 'Reminders (preview)', labelHe: 'תזכורות (תצוגה)', path: '/admin/reminder-preview', icon: Activity, roles: ['admin', 'ceo'], hint: 'What smart reminders would be sent — read-only', hintHe: 'אילו תזכורות חכמות היו נשלחות — לקריאה בלבד' },
    ],
  },
  {
    group: 'Money',
    groupHe: 'כספים',
    items: [
      { label: 'No Lost Money', labelHe: 'בלי כסף אבוד', path: '/admin/no-lost-money', icon: ShieldAlert, roles: ['admin', 'ceo'], hint: 'Money-leak detector', hintHe: 'גלאי דליפות כסף' },
      { label: 'Finance', labelHe: 'כספים', path: '/admin/finance', icon: Banknote, roles: ['admin', 'ceo'], hint: 'Accounting & tax', hintHe: 'הנהלת חשבונות ומיסוי' },
      { label: 'Wallet & Reconciliation', labelHe: 'ארנק והתחשבנות', path: '/admin/wallet-finance', icon: Wallet, roles: ['admin', 'ceo'], hint: 'Balances, payouts, settlement', hintHe: 'יתרות, תשלומים וסליקה' },
      { label: 'Sales', labelHe: 'מכירות', path: '/admin/sales', icon: BarChart3, roles: ['admin', 'ceo'], hint: 'Revenue, deals, forecasts', hintHe: 'הכנסות, עסקאות ותחזיות' },
      { label: 'Suppliers', labelHe: 'ספקים', path: '/admin/suppliers', icon: Truck, roles: ['admin', 'ceo'], hint: 'Vendors & invoicing', hintHe: 'ספקים וחשבוניות' },
      { label: 'SUMIT Payments', labelHe: 'תשלומי SUMIT', path: '/admin/sumit', icon: Receipt, roles: ['admin', 'ceo'], hint: 'Invoicing & charge status', hintHe: 'חשבוניות וסטטוס חיובים' },
      // Was a "ghost" page: routed at /admin/supplier-invoices but missing from this
      // menu, so admins couldn't reach it. Surfaced here (2026-06-19).
      { label: 'Supplier Invoices', labelHe: 'חשבוניות ספק', path: '/admin/supplier-invoices', icon: FileText, roles: ['admin', 'ceo'], hint: 'Vendor invoices & approval', hintHe: 'חשבוניות ספקים ואישור' },
      // Routed at /treasury (ExecutiveSuiteGuard, ceo/finance/super_admin tier)
      // but was missing from this menu, so it was unreachable from the back-office
      // nav. Surfaced here (2026-06-19) as CEO-only.
      { label: 'Treasury', labelHe: 'אוצר', path: '/treasury', icon: Banknote, roles: ['ceo'], hint: 'Cash reconciliation & reserves', hintHe: 'התחשבנות מזומן ורזרבות' },
    ],
  },
  {
    group: 'People',
    groupHe: 'אנשים',
    items: [
      { label: 'CRM', labelHe: 'לקוחות', path: '/admin/crm', icon: Users, roles: ['admin', 'ceo'], hint: 'Customers & leads', hintHe: 'לקוחות ולידים' },
      { label: 'HR', labelHe: 'משאבי אנוש', path: '/admin/hr', icon: Briefcase, roles: ['admin', 'ceo'], hint: 'Hiring, payroll, docs', hintHe: 'גיוס, שכר ומסמכים' },
      { label: 'Recruitment', labelHe: 'גיוס', path: '/admin/recruitment', icon: ClipboardList, roles: ['admin', 'ceo'], hint: 'Job postings & applicants', hintHe: 'משרות ומועמדים' },
      { label: 'Performance Reviews', labelHe: 'הערכות עובדים', path: '/admin/performance-reviews', icon: Star, roles: ['admin', 'ceo'], hint: 'Employee reviews', hintHe: 'הערכות ביצועים לעובדים' },
      { label: 'Retention & Reviews', labelHe: 'שימור וביקורות', path: '/admin/retention', icon: Users, roles: ['admin', 'ceo'], hint: 'Winback segments & review funnel', hintHe: 'פלחי שימור ומשפך ביקורות' },
    ],
  },
  {
    group: 'Operations',
    groupHe: 'תפעול',
    items: [
      { label: 'Operations', labelHe: 'תפעול', path: '/admin/operations', icon: Activity, roles: ['admin', 'ceo'], hint: 'Station ops & bay scheduling', hintHe: 'תפעול עמדות ושיבוץ תאים' },
      { label: 'Fault & Maintenance Intel', labelHe: 'תקלות ותחזוקה חכמה', path: '/admin/fault-intel', icon: Activity, roles: ['admin', 'ceo'], hint: 'Fault cost + predictive maintenance', hintHe: 'עלות תקלות ותחזוקה מנבאת' },
      { label: 'Logistics', labelHe: 'לוגיסטיקה', path: '/admin/logistics', icon: Package, roles: ['admin', 'ceo'], hint: 'Fulfilment & shipping', hintHe: 'מימוש הזמנות ומשלוחים' },
      { label: 'Stations', labelHe: 'עמדות', path: '/admin/stations', icon: MapPin, roles: ['admin', 'ceo'], hint: 'Facilities', hintHe: 'מתקנים' },
      { label: 'Station Registry', labelHe: 'מרשם עמדות', path: '/admin/station-registry', icon: Building2, roles: ['admin', 'ceo'], hint: 'Licensing & taxes', hintHe: 'רישוי ומיסוי' },
      { label: 'Marketplace Intelligence', labelHe: 'מודיעין שוק', path: '/admin/marketplace-intelligence', icon: BarChart3, roles: ['admin', 'ceo'], hint: 'Provider ranking & insights', hintHe: 'דירוג ספקים ותובנות' },
    ],
  },
  {
    group: 'Governance',
    groupHe: 'ממשל',
    items: [
      { label: 'KYC Review', labelHe: 'בדיקת זהות (KYC)', path: '/admin/kyc', icon: ShieldCheck, roles: ['admin', 'ceo'], hint: 'Identity & document review', hintHe: 'אימות זהות ובדיקת מסמכים' },
      { label: 'Policy & Compliance', labelHe: 'מדיניות וציות', path: '/admin/policy', icon: FileText, roles: ['admin', 'ceo'], hint: 'Governance docs', hintHe: 'מסמכי ממשל' },
      { label: 'Deadlines & Insurance', labelHe: 'תזכורות וביטוחים', path: '/admin/deadlines', icon: ShieldCheck, roles: ['admin', 'ceo'], hint: 'Renewal/expiry feed + insurance status', hintHe: 'תזכורות חידוש/תפוגה + סטטוס ביטוח' },
      { label: 'Franchise', labelHe: 'זכיינות', path: '/admin/franchise', icon: Handshake, roles: ['admin', 'ceo'], hint: 'Franchise operations', hintHe: 'תפעול זכיינות' },
      { label: 'JV Partners', labelHe: 'שותפי מיזם', path: '/admin/jv-partners', icon: Handshake, roles: ['admin', 'ceo'], hint: 'Joint-venture management', hintHe: 'ניהול מיזמים משותפים' },
      { label: 'Buildings & Partner Reports', labelHe: 'בניינים ודוחות שותפים', path: '/admin/buildings-partners', icon: Building2, roles: ['admin', 'ceo'], hint: 'Building/resident program + partner reports', hintHe: 'תוכנית בניינים/דיירים ודוחות שותפים' },
      { label: 'Vouchers', labelHe: 'שוברים', path: '/admin/vouchers', icon: Gift, roles: ['admin', 'ceo'], hint: 'Gift cards & coupons', hintHe: 'כרטיסי מתנה וקופונים' },
    ],
  },
];

/** Flat, role-filtered list of nav groups for a given role. */
export function navForRole(role: DashRole): NavGroup[] {
  return EXECUTIVE_NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);
}
