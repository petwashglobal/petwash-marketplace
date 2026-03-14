import { useLocation } from 'wouter';
import { Crown, Briefcase, Star, ScrollText, Calendar, FileText, RefreshCcw, Users, TrendingUp, Shield } from 'lucide-react';
interface FormCard {
  emoji: string;
  title: string;
  titleHe: string;
  description: string;
  href: string;
  color: string;
  tag?: string;
  tagColor?: string;
  department: string;
}

const FORMS: FormCard[] = [
  {
    emoji: '📅',
    title: 'Quick Booking',
    titleHe: 'הזמנה מהירה',
    description: 'Book any service — K9000, Sitter Suite, Walk, Trek, Academy, Grooming',
    href: '/forms/booking',
    color: '#3B82F6',
    tag: 'Most Popular',
    tagColor: 'bg-blue-500/20 text-blue-300',
    department: 'All Services',
  },
  {
    emoji: '👑',
    title: 'Join Prestige Club',
    titleHe: 'הצטרפות למועדון',
    description: 'Register for Gold, Platinum or Diamond membership with digital card',
    href: '/forms/club',
    color: '#C6A35B',
    tag: 'New',
    tagColor: 'bg-[#C6A35B]/20 text-[#E7C978]',
    department: 'Club & Loyalty',
  },
  {
    emoji: '🐾',
    title: 'Become a Provider',
    titleHe: 'הגש מועמדות כספק',
    description: 'Apply to join our provider network — upload ID, selfie & certificates',
    href: '/forms/provider',
    color: '#10B981',
    tag: 'ID + Selfie',
    tagColor: 'bg-green-500/20 text-green-300',
    department: 'Provider Relations',
  },
  {
    emoji: '⭐',
    title: 'Leave a Review',
    titleHe: 'כתיבת ביקורת',
    description: 'Rate your experience with K9000, Sitter Suite, or any platform',
    href: '/forms/review',
    color: '#F59E0B',
    department: 'Customer Experience',
  },
  {
    emoji: '🐕',
    title: 'Pet Onboarding',
    titleHe: 'רישום חיית מחמד',
    description: 'Register your pet and upload health documents to your PetWash™ profile',
    href: '/forms/onboarding',
    color: '#8B5CF6',
    department: 'Customer Experience',
  },
  {
    emoji: '↩️',
    title: 'Refund Request',
    titleHe: 'בקשת החזר כספי',
    description: 'Request a refund for any PetWash™ service or product',
    href: '/forms/refund',
    color: '#EF4444',
    department: 'Finance & Billing',
  },
  {
    emoji: '📜',
    title: 'Legal Agreements',
    titleHe: 'הסכמים משפטיים',
    description: 'Sign Terms of Service, Provider Agreement, Club Membership & DPA',
    href: '/forms/legal',
    color: '#6366F1',
    tag: 'E-Sign',
    tagColor: 'bg-indigo-500/20 text-indigo-300',
    department: 'Legal & Compliance',
  },
  {
    emoji: '💼',
    title: 'Job Application',
    titleHe: 'מועמדות לעבודה',
    description: 'Apply to join the PetWash™ team — upload CV and cover letter',
    href: '/forms/hr-application',
    color: '#F97316',
    department: 'HR & People',
  },
  {
    emoji: '🤝',
    title: 'Business Inquiry',
    titleHe: 'פנייה עסקית',
    description: 'Partnership, franchise, B2B sales, and corporate pet care programs',
    href: '/forms/sales-lead',
    color: '#14B8A6',
    department: 'Sales & Business Dev',
  },
];

const DEPARTMENTS = [...new Set(FORMS.map(f => f.department))];

export default function FormsHub() {
  const [, nav] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" dir="ltr">
      <div
        className="bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5 px-4 pb-4"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-3 pt-3">
          <span className="text-2xl">🐾</span>
          <div>
            <h1 className="text-lg font-bold">PetWash™ Forms</h1>
            <p className="text-[#C6A35B] text-xs" dir="rtl">כל הטפסים במקום אחד</p>
          </div>
        </div>
      </div>

      <div
        className="max-w-lg mx-auto px-4 py-5 space-y-6"
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-3 bg-gradient-to-r from-[#C6A35B]/10 to-transparent border border-[#C6A35B]/20 rounded-2xl p-4">
          <Shield className="w-6 h-6 text-[#C6A35B] shrink-0" />
          <div>
            <p className="text-white/80 text-sm font-medium">Secure · Encrypted · Compliant</p>
            <p className="text-white/40 text-xs">Document upload, e-signature, Google Drive backup. VAT 18% on all services.</p>
          </div>
        </div>

        {DEPARTMENTS.map(dept => {
          const deptForms = FORMS.filter(f => f.department === dept);
          return (
            <div key={dept}>
              <p className="text-xs font-bold text-white/30 uppercase tracking-widest px-1 mb-3">{dept}</p>
              <div className="space-y-2">
                {deptForms.map(form => (
                  <button
                    key={form.href}
                    type="button"
                    onClick={() => nav(form.href)}
                    className="w-full flex items-center gap-4 p-4 bg-white/[0.03] border border-white/8 rounded-2xl text-left active:bg-white/[0.07] transition-all"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                      style={{ backgroundColor: `${form.color}18` }}
                    >
                      {form.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold text-sm">{form.title}</p>
                        {form.tag && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.tagColor}`}>
                            {form.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-[#C6A35B]/60 text-xs mt-0.5" dir="rtl">{form.titleHe}</p>
                      <p className="text-white/35 text-xs mt-1 line-clamp-1">{form.description}</p>
                    </div>
                    <span className="text-white/20 text-xl shrink-0">›</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div className="text-center pt-4">
          <p className="text-white/20 text-xs">PetWash™ Ltd. · petwash.co.il</p>
          <p className="text-white/15 text-xs mt-1">GDPR & Israeli Privacy Law compliant · Encrypted · Google Drive backup</p>
        </div>
      </div>
    </div>
  );
}
