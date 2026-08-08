import { useState } from 'react';
import { Link } from 'wouter';
import { Share2, Users, Gift, Copy, Mail, MessageCircle, TrendingUp, Award, ArrowLeft, Send, Facebook, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { apiRequest } from '@/lib/queryClient';
import { useSEO, pageSEO } from '@/lib/seo';

interface ReferralStats {
  totalInvites: number;
  successfulInvites: number;
  pendingInvites: number;
  totalCreditsGrantedILS: number;
}

interface SummaryData {
  referralCode: string | null;
  stats?: ReferralStats;
}

export default function LoyaltyRefer() {
  useSEO(pageSEO.loyaltyRefer);
  const [language] = useState(localStorage.getItem('petwash_lang') || 'he');
  const isHebrew = language === 'he';
  const { toast } = useToast();
  const { user } = useFirebaseAuth();

  // Use GET /api/referral/link (authed) — it MINTS the member's own code via
  // getOrCreateReferralCode. The old /api/loyalty-credits/summary only SELECTs an
  // existing code (never mints) and, via the no-Bearer default fetcher, returned
  // null for real members → the page shared the generic 'PETWASH' code that's
  // attributable to nobody. (2026-07-27)
  const { data: linkData, isLoading: summaryLoading } = useQuery<SummaryData>({
    queryKey: ['/api/referral/link'],
    queryFn: async () => {
      try { const r = await apiRequest('GET', '/api/referral/link'); return r.ok ? await r.json() : { referralCode: null }; }
      catch { return { referralCode: null }; }
    },
    enabled:  !!user,
    staleTime: 60_000,
  });

  const referralCode = linkData?.referralCode ?? null;
  const displayCode  = referralCode ?? (summaryLoading ? '…' : '');

  // Only include a code in the share text when we actually have the member's real
  // one — never share the generic non-attributable fallback.
  const codeSuffix = referralCode ? (isHebrew ? ` השתמשו בקוד ההזמנה שלי: ${referralCode}` : ` Use my referral code: ${referralCode}`) : '';
  const shareText = (isHebrew
    ? `הצטרפו ל-PetWash™ — הטיפוח והשמירה הטובים ביותר לחיות מחמד!`
    : `Join PetWash™ — the best pet care app!`) + codeSuffix;
  const siteUrl = 'https://petwash.co.il';

  const handleCopy = async () => {
    const text = referralCode ?? displayCode;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast({
      title: isHebrew ? 'הועתק!' : 'Copied!',
      description: isHebrew ? 'קוד ההפניה הועתק ללוח' : 'Referral code copied to clipboard',
    });
  };

  const shareButtons = [
    {
      icon: MessageCircle,
      label: isHebrew ? 'וואטסאפ' : 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
    },
    {
      icon: Facebook,
      label: isHebrew ? 'פייסבוק' : 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteUrl)}&quote=${encodeURIComponent(shareText)}`,
    },
    {
      icon: Mail,
      label: isHebrew ? 'אימייל' : 'Email',
      href: `mailto:?subject=${encodeURIComponent(isHebrew ? 'הזמנה ל-PetWash™' : 'Join PetWash™')}&body=${encodeURIComponent(shareText + '\n' + siteUrl)}`,
    },
    {
      icon: Send,
      label: 'SMS',
      href: `sms:?body=${encodeURIComponent(shareText)}`,
    },
  ];

  // Real figures from /api/referral/link → stats (no more hardcoded "0"). (2026-08-08)
  const rs = linkData?.stats;
  const stats = [
    {
      icon: Users,
      label: isHebrew ? 'חברים שהופנו' : 'Friends Referred',
      value: String(rs?.successfulInvites ?? 0),
    },
    {
      icon: Gift,
      label: isHebrew ? 'תגמולים שנצברו' : 'Rewards Earned',
      value: `₪${(rs?.totalCreditsGrantedILS ?? 0).toFixed(0)}`,
    },
    {
      icon: Award,
      label: isHebrew ? 'הזמנות ממתינות' : 'Pending Invites',
      value: String(rs?.pendingInvites ?? 0),
    },
  ];

  const rewards = [
    {
      friends: isHebrew ? 'חבר 1' : '1 Friend',
      friendsAlt: isHebrew ? '1 Friend' : 'חבר 1',
      reward: '200',
      bonus: isHebrew ? 'רחיצה בסיסית חינם' : 'Free Basic Wash',
    },
    {
      friends: isHebrew ? '3 חברים' : '3 Friends',
      friendsAlt: isHebrew ? '3 Friends' : '3 חברים',
      reward: '750',
      bonus: isHebrew ? 'רחיצה פרימיום חינם' : 'Free Premium Wash',
    },
    {
      friends: isHebrew ? '5 חברים' : '5 Friends',
      friendsAlt: isHebrew ? '5 Friends' : '5 חברים',
      reward: '1,500',
      bonus: isHebrew ? 'שדרוג לדרגת כסף' : 'Silver Tier Upgrade',
    },
    {
      friends: isHebrew ? '10 חברים' : '10 Friends',
      friendsAlt: isHebrew ? '10 Friends' : '10 חברים',
      reward: '3,500',
      bonus: isHebrew ? 'שדרוג לדרגת זהב' : 'Gold Tier Upgrade',
    },
  ];

  return (
    <div
      dir={isHebrew || language === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen"
      style={{ background: '#FFFFFF' }}
    >
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/loyalty">
          <a className="inline-flex items-center gap-2 text-[#0a0a0a] hover:text-[#0a0a0a] transition-all duration-300 mb-8 group">
            <ArrowLeft className={`w-5 h-5 transition-transform duration-300 ${isHebrew ? 'rotate-180 group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
            <span className="text-sm font-medium">{isHebrew ? 'חזרה לנאמנות' : 'Back to Loyalty'}</span>
          </a>
        </Link>

        <div className="text-center mb-12">
          <img src="/brand/petwash-logo-white-bg.png" alt="⁦PetWash™⁩" className="h-12 mx-auto mb-6 opacity-90" />
          <div className="w-16 h-16 rounded-2xl bg-[rgba(139,92,246,0.1)] border border-[rgba(139,92,246,0.2)] flex items-center justify-center mx-auto mb-4">
            <Share2 className="w-8 h-8 text-[#D4AF37]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[#1A1A1A] mb-3">
            {isHebrew ? 'הזמנת חברים' : 'Refer a Friend'}
          </h1>
          <p className="text-lg text-[#7A7068] max-w-2xl mx-auto">
            {isHebrew ? 'הזמינו חברים והרוויחו קרדיט רחיצה. שתפו את האהבה וקבלו תגמולים יחד!' : 'Invite friends and earn wash credits. Share the love and get rewarded together!'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white border border-[#E8E3D9] backdrop-blur-xl text-center transition-all duration-300 hover:border-[rgba(139,92,246,0.3)]"
            >
              <div className="w-12 h-12 rounded-xl bg-[rgba(139,92,246,0.1)] flex items-center justify-center mx-auto mb-3">
                <stat.icon className="w-6 h-6 text-[#D4AF37]" />
              </div>
              <p className="text-[#8A8078] text-sm mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-[#0a0a0a]">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="p-8 rounded-2xl bg-white border border-[rgba(217, 184, 76,0.15)] backdrop-blur-xl mb-10 shadow-[0_0_40px_rgba(217, 184, 76,0.05)]">
          <h2 className="text-2xl font-bold text-[#1A1A1A] text-center mb-6">
            {isHebrew ? 'קוד ההפניה שלך' : 'Your Referral Code'}
          </h2>
          <div className="max-w-md mx-auto">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#F0EBE0] border border-[rgba(217, 184, 76,0.2)] mb-6">
              <code className="flex-1 text-2xl font-bold text-center text-[#0a0a0a] tracking-[0.2em] flex items-center justify-center gap-2">
                {summaryLoading ? <Loader2 className="w-5 h-5 animate-spin text-[#0a0a0a]" /> : displayCode}
              </code>
              <button
                onClick={handleCopy}
                className="p-3 rounded-lg bg-[rgba(217, 184, 76,0.1)] hover:bg-[rgba(217, 184, 76,0.2)] transition-all duration-300 border border-[rgba(217, 184, 76,0.2)]"
              >
                <Copy className="w-5 h-5 text-[#0a0a0a]" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {shareButtons.map((button, idx) => (
                <a
                  key={idx}
                  href={button.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.15)] hover:bg-[rgba(139,92,246,0.15)] hover:border-[rgba(139,92,246,0.3)] transition-all duration-300"
                >
                  <button.icon className="w-5 h-5 text-[#D4AF37]" />
                  <span className="text-xs text-[#6A6A6A]">{button.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-white border border-[#E8E3D9] backdrop-blur-xl mb-10">
          <h2 className="text-2xl font-bold text-[#1A1A1A] text-center mb-8">
            {isHebrew ? 'תגמולי הפניה' : 'Referral Rewards'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {rewards.map((reward, idx) => (
              <div
                key={idx}
                className="p-6 rounded-xl bg-white border border-[#E8E3D9] text-center transition-all duration-300 hover:border-[rgba(217, 184, 76,0.3)] hover:scale-[1.02]"
              >
                <div className="w-10 h-10 rounded-full bg-[rgba(217, 184, 76,0.1)] flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-5 h-5 text-[#0a0a0a]" />
                </div>
                <p className="font-semibold text-[#1A1A1A] mb-1">{reward.friends}</p>
                <p className="text-[#9A9088] text-xs mb-2">{reward.friendsAlt}</p>
                <p className="text-2xl font-bold text-[#0a0a0a] mb-1">{reward.reward}</p>
                <p className="text-[#8A8078] text-xs">{isHebrew ? 'נקודות' : 'Points'}</p>
                <div className="mt-3 pt-3 border-t border-[#E8E3D9]">
                  <p className="text-[#7A7068] text-sm">{reward.bonus}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-white border border-[#E8E3D9] backdrop-blur-xl">
          <h2 className="text-2xl font-bold text-[#1A1A1A] text-center mb-8">
            {isHebrew ? 'איך זה עובד' : 'How It Works'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#D9B84C] to-[#D9B84C] text-[#0A0A0F] font-bold text-xl flex items-center justify-center mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-[#1A1A1A] mb-1">{isHebrew ? 'שתפו את הקוד' : 'Share Your Code'}</h3>
              <p className="text-[#8A8078] text-sm">{isHebrew ? 'שלחו את קוד ההפניה הייחודי שלכם לחברים ומשפחה' : 'Send your unique referral code to friends and family'}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#D9B84C] to-[#D9B84C] text-[#0A0A0F] font-bold text-xl flex items-center justify-center mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-[#1A1A1A] mb-1">{isHebrew ? 'הם נרשמים' : 'They Sign Up'}</h3>
              <p className="text-[#8A8078] text-sm">{isHebrew ? 'החבר שלכם יוצר חשבון באמצעות הקוד שלכם' : 'Your friend creates an account using your code'}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#D9B84C] to-[#D9B84C] text-[#0A0A0F] font-bold text-xl flex items-center justify-center mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-[#1A1A1A] mb-1">{isHebrew ? 'הרוויחו תגמולים' : 'Earn Rewards'}</h3>
              <p className="text-[#8A8078] text-sm">{isHebrew ? 'שניכם מקבלים נקודות בונוס ותגמולים' : 'Both of you receive bonus points and rewards'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
