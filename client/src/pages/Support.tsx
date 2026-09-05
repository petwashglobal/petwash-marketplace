import { useState } from "react";
import { useLocation } from "wouter";
import { MessageCircle, Phone, Mail, FileQuestion, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/languageStore";
import { useSEO } from "@/lib/seo";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support-contact";

export default function Support() {
  const [, setLocation] = useLocation();
  const { t, dir } = useLanguage();
  const [helpQuery, setHelpQuery] = useState("");

  /**
   * PR-NAV-4 — every control below used to be dead.
   *
   * The search box had no onChange and no onSubmit, the "View FAQ" button had
   * no onClick, and all six "Popular Topics" buttons had no onClick. There is
   * no FAQ document and no help-article index anywhere in the app, so none of
   * them could ever have worked — the whole block was a shell that implied
   * answers existed.
   *
   * Fixed honestly, without inventing FAQ content: a question hands off to the
   * contact form with the text pre-filled, so the label ("How do I use a K9000
   * station?") genuinely leads to getting that question answered. The FAQ card
   * gets an explicit coming-soon state instead of a button that goes nowhere.
   */
  const askSupport = (question: string) => {
    setLocation(`/contact?message=${encodeURIComponent(question)}`);
  };
  useSEO({
    title: 'Support & Help - ⁦PetWash™⁩ | תמיכה ועזרה',
    description: 'Get help with ⁦PetWash™⁩ — ⁦K9000⁩ washes, bookings, payments, membership and more. WhatsApp, email and phone support. תמיכה ועזרה ל-⁦PetWash™⁩ — שטיפות, הזמנות, תשלומים וחברות מועדון, ב-WhatsApp, אימייל וטלפון.',
    keywords: 'pet wash support, help, customer service, contact, תמיכה, עזרה, שירות לקוחות, צור קשר',
    canonical: 'https://petwash.co.il/support',
    ogType: 'website',
  });

  const topics = [
    'supportPage.topic.k9000',
    'supportPage.topic.loyalty',
    'supportPage.topic.booking',
    'supportPage.topic.billing',
    'supportPage.topic.safety',
    'supportPage.topic.technical',
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh" dir={dir}>
      <div className="luxury-services-hero">
        <div className="luxury-services-hero-content">
          <div className="luxury-services-badge luxury-animate-fade-in">
            <Sparkles className="h-4 w-4" />
            {t('supportPage.badge')}
          </div>
          <h1 className="luxury-heading-xl luxury-animate-fade-in luxury-delay-1">
            {t('supportPage.title')}
          </h1>
          <p className="luxury-services-subtitle luxury-animate-fade-in luxury-delay-2">
            {t('supportPage.subtitle')}
          </p>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="luxury-glass-card luxury-shadow-xl p-6 mb-12 luxury-animate-fade-in luxury-delay-3">
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              if (!helpQuery.trim()) return;
              askSupport(helpQuery.trim());
            }}
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 rtl:left-auto rtl:right-4" style={{ color: '#667eea' }} />
            <Input
              className="pl-12 rtl:pl-4 rtl:pr-12 py-6 text-lg bg-transparent border-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
              placeholder={t('supportPage.searchPlaceholderHonest')}
              value={helpQuery}
              onChange={(e) => setHelpQuery(e.target.value)}
              data-testid="input-search-help"
            />
            <Button
              type="submit"
              disabled={!helpQuery.trim()}
              className="luxury-btn-secondary mt-4 w-full sm:w-auto"
              data-testid="button-ask-support"
            >
              {t('supportPage.askSupport')}
            </Button>
          </form>
        </div>

        <div className="luxury-grid-4 mb-12">
          <div 
            className="luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center cursor-pointer luxury-animate-fade-in luxury-delay-4" 
            onClick={() => setLocation("/live-chat")}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8932F] flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">{t('supportPage.liveChat')}</h3>
            <p className="luxury-text-small mb-4">
              {t('supportPage.liveChatDesc')}
            </p>
            <Button className="luxury-btn-secondary w-full" data-testid="button-live-chat" onClick={(e) => { e.stopPropagation(); setLocation("/live-chat"); }}>
              {t('supportPage.startChat')}
            </Button>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center luxury-animate-fade-in luxury-delay-5">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
              <Phone className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">{t('supportPage.whatsapp')}</h3>
            <p className="luxury-text-small mb-4">
              {t('supportPage.whatsappDesc')}
            </p>
            <Button className="luxury-btn-secondary w-full" data-testid="button-whatsapp" onClick={() => window.open(SUPPORT_WHATSAPP_URL, "_blank", "noopener,noreferrer")}>
              {t('supportPage.openWhatsapp')}
            </Button>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center luxury-animate-fade-in luxury-delay-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8932F] flex items-center justify-center">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">{t('supportPage.emailSupport')}</h3>
            <p className="luxury-text-small mb-4">
              {t('supportPage.emailDesc')}
            </p>
            <Button className="luxury-btn-secondary w-full" data-testid="button-email" onClick={() => setLocation("/contact")}>
              {t('supportPage.contactUs')}
            </Button>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center luxury-animate-fade-in luxury-delay-7">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8932F] flex items-center justify-center">
              <FileQuestion className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">{t('supportPage.faq')}</h3>
            <p className="luxury-text-small mb-4">
              {t('supportPage.faqComingSoonDesc')}
            </p>
            <div
              className="w-full py-2 rounded-lg bg-white/70 text-gray-500 text-sm font-medium text-center cursor-default"
              data-testid="badge-faq-coming-soon"
            >
              {t('supportPage.faqComingSoon')}
            </div>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-xl p-8 luxury-animate-fade-in luxury-delay-8">
          <h2 className="luxury-heading-lg mb-6">{t('supportPage.popularTopics')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topics.map((topicKey, index) => (
              <Button
                key={topicKey}
                onClick={() => askSupport(t(topicKey))}
                className={`luxury-glass-panel luxury-shadow-sm text-left rtl:text-right p-4 rounded-lg transition-all hover:shadow-md luxury-animate-fade-in luxury-delay-${index + 9}`}
                data-testid={`button-topic-${topicKey.split('.').pop()}`}
              >
                <p className="luxury-text-body">{t(topicKey)}</p>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
