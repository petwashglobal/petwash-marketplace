import { Link } from 'wouter';
import { ArrowRight, ExternalLink } from 'lucide-react';

const FORMS = [
  {
    href: '/forms/review',
    icon: '⭐',
    title: 'Customer Review & Rating',
    titleHe: 'ביקורת לקוח וציון',
    desc: 'Rate your experience with any PetWash™ service — K9000, Sitter Suite, Walk My Pet, PetTrek, or Academy.',
    tag: 'PUBLIC',
    tagColor: 'text-green-400 bg-green-400/10',
  },
  {
    href: '/forms/onboarding',
    icon: '🐾',
    title: 'Customer Onboarding & Pet Registration',
    titleHe: 'אונבורדינג לקוחות ורישום חיית מחמד',
    desc: 'New to PetWash™? Register your pet and complete your customer profile in 3 minutes.',
    tag: 'PUBLIC',
    tagColor: 'text-green-400 bg-green-400/10',
  },
  {
    href: '/forms/refund',
    icon: '↩️',
    title: 'Refund Request',
    titleHe: 'בקשת החזר כספי',
    desc: 'Request a refund for any PetWash™ service. We review all requests within 2–5 business days.',
    tag: 'SUPPORT',
    tagColor: 'text-amber-400 bg-amber-400/10',
  },
  {
    href: '/forms/sales-lead',
    icon: '🤝',
    title: 'Business Inquiry',
    titleHe: 'פנייה עסקית',
    desc: 'Enterprise partnerships, API integrations, reseller programs, or white label licensing.',
    tag: 'B2B',
    tagColor: 'text-blue-400 bg-blue-400/10',
  },
  {
    href: '/forms/hr-application',
    icon: '💼',
    title: 'Job Application',
    titleHe: 'בקשת מועמדות לתפקיד',
    desc: 'Join the PetWash™ team. Apply for open positions across all departments and regions.',
    tag: 'CAREERS',
    tagColor: 'text-purple-400 bg-purple-400/10',
  },
  {
    href: '/franchise',
    icon: '🏪',
    title: 'Franchise Inquiry',
    titleHe: 'פנייה לזיכיון',
    desc: 'Interested in opening a PetWash™ location? Submit your franchise inquiry.',
    tag: 'FRANCHISE',
    tagColor: 'text-[#C6A35B] bg-[#C6A35B]/10',
    external: true,
  },
  {
    href: '/contact',
    icon: '💬',
    title: 'Contact & Support',
    titleHe: 'צור קשר ותמיכה',
    desc: 'General inquiries, technical support, billing questions. We respond within 24 hours.',
    tag: 'SUPPORT',
    tagColor: 'text-amber-400 bg-amber-400/10',
    external: true,
  },
  {
    href: '/become-provider',
    icon: '🐕',
    title: 'Provider Application',
    titleHe: 'בקשת הצטרפות כספק',
    desc: 'Apply to join our provider network as a dog sitter, dog walker, PetTrek driver, or K9000 operator.',
    tag: 'PROVIDERS',
    tagColor: 'text-orange-400 bg-orange-400/10',
    external: true,
  },
];

export default function FormsHub() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="border-b border-[#C6A35B]/20 bg-[#111]">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h1 className="text-3xl font-bold text-white mb-2">PetWash™ Forms</h1>
          <p className="text-gray-400 text-sm">All public-facing forms — reviews, applications, refunds, and business inquiries</p>
          <p className="text-[#C6A35B]/60 text-xs mt-1">כל הטפסים הציבוריים של PetWash™</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FORMS.map(form => (
            <Link key={form.href} href={form.href}>
              <div className="group relative bg-[#111] border border-[#C6A35B]/15 hover:border-[#C6A35B]/40 rounded-xl p-5 cursor-pointer transition-all duration-200 hover:bg-[#161616]">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{form.icon}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${form.tagColor}`}>{form.tag}</span>
                    {form.external && <ExternalLink className="h-3 w-3 text-gray-600" />}
                  </div>
                </div>
                <h3 className="font-semibold text-white text-base mb-0.5 group-hover:text-[#C6A35B] transition-colors">{form.title}</h3>
                <p className="text-[#C6A35B]/50 text-xs mb-2">{form.titleHe}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{form.desc}</p>
                <div className="mt-3 flex items-center gap-1 text-[#C6A35B]/40 group-hover:text-[#C6A35B]/70 text-xs font-medium transition-colors">
                  Open form <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-xs text-gray-700">All form submissions are processed securely and logged to our internal tracking system.</p>
          <p className="text-xs text-gray-700 mt-0.5">All data is protected under Israeli Privacy Law 5742-1981 and GDPR.</p>
          <Link href="/" className="text-[#C6A35B]/40 hover:text-[#C6A35B]/70 text-xs mt-4 inline-block transition-colors">← Back to PetWash™</Link>
        </div>
      </div>
    </div>
  );
}
