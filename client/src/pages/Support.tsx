import { useLocation } from "wouter";
import { MessageCircle, Phone, Mail, FileQuestion, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/languageStore";

export default function Support() {
  const [, setLocation] = useLocation();
  const { t, dir } = useLanguage();

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
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 rtl:left-auto rtl:right-4" style={{ color: '#667eea' }} />
            <Input
              className="pl-12 rtl:pl-4 rtl:pr-12 py-6 text-lg bg-transparent border-none focus-visible:ring-2 focus-visible:ring-purple-500"
              placeholder={t('supportPage.searchPlaceholder')}
              data-testid="input-search-help"
            />
          </div>
        </div>

        <div className="luxury-grid-4 mb-12">
          <div 
            className="luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center cursor-pointer luxury-animate-fade-in luxury-delay-4" 
            onClick={() => setLocation("/live-chat")}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">{t('supportPage.liveChat')}</h3>
            <p className="luxury-text-small mb-4">
              {t('supportPage.liveChatDesc')}
            </p>
            <button className="luxury-btn-secondary w-full" data-testid="button-live-chat">
              {t('supportPage.startChat')}
            </button>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center luxury-animate-fade-in luxury-delay-5">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
              <Phone className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">{t('supportPage.whatsapp')}</h3>
            <p className="luxury-text-small mb-4">
              {t('supportPage.whatsappDesc')}
            </p>
            <button className="luxury-btn-secondary w-full" data-testid="button-whatsapp">
              {t('supportPage.openWhatsapp')}
            </button>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center luxury-animate-fade-in luxury-delay-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">{t('supportPage.emailSupport')}</h3>
            <p className="luxury-text-small mb-4">
              {t('supportPage.emailDesc')}
            </p>
            <button className="luxury-btn-secondary w-full" data-testid="button-email" onClick={() => setLocation("/contact")}>
              {t('supportPage.contactUs')}
            </button>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center luxury-animate-fade-in luxury-delay-7">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <FileQuestion className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">{t('supportPage.faq')}</h3>
            <p className="luxury-text-small mb-4">
              {t('supportPage.faqDesc')}
            </p>
            <button className="luxury-btn-secondary w-full" data-testid="button-faq">
              {t('supportPage.viewFaq')}
            </button>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-xl p-8 luxury-animate-fade-in luxury-delay-8">
          <h2 className="luxury-heading-lg mb-6">{t('supportPage.popularTopics')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topics.map((topicKey, index) => (
              <button
                key={topicKey}
                className={`luxury-glass-panel luxury-shadow-sm text-left rtl:text-right p-4 rounded-lg transition-all hover:shadow-md luxury-animate-fade-in luxury-delay-${index + 9}`}
              >
                <p className="luxury-text-body">{t(topicKey)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
