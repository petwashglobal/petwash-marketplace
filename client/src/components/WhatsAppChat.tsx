import { MessageCircle } from 'lucide-react';
import { Language } from '@/lib/i18n';
import { useAnalytics } from '@/hooks/useAnalytics';

interface WhatsAppChatProps {
  language: Language;
}

export function WhatsAppChat({ language }: WhatsAppChatProps) {
  const { trackWhatsAppClick } = useAnalytics();

  const handleWhatsAppClick = () => {
    try {
      trackWhatsAppClick(language);
      
      const message = language === 'en' 
        ? 'Hello! I would like to know more about Pet Wash™️ services'
        : 'שלום! אני מעוניין לדעת יותר על שירותי Pet Wash™️';
      
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/972549833355?text=${encodedMessage}`;
      
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      // Fallback to direct WhatsApp link
      window.location.href = `https://wa.me/972549833355`;
    }
  };

  return (
    <div className="floating-button-whatsapp">
      <button
        onClick={handleWhatsAppClick}
        className="group relative bg-green-500 hover:bg-green-600 text-white p-3 sm:p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-green-300 min-w-[48px] min-h-[48px] flex items-center justify-center"
        aria-label={language === 'en' ? 'Contact us on WhatsApp' : 'צור קשר דרך WhatsApp'}
        title={language === 'en' ? 'Chat with us on WhatsApp' : 'צ\'אט איתנו ב-WhatsApp'}
        type="button"
      >
        <MessageCircle size={24} className="drop-shadow-sm sm:w-7 sm:h-7" />
        
        {/* Pulse animation ring */}
        <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-20 pointer-events-none"></div>
        
        {/* Tooltip - only show on hover for desktop */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-black text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none hidden sm:block rtl:right-auto rtl:left-0">
          {language === 'en' ? 'Chat with us!' : 'צ\'אט איתנו!'}
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black rtl:right-auto rtl:left-4"></div>
        </div>
      </button>
    </div>
  );
}