import { useEffect, useState } from 'react';
import { X, Heart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Language } from '@/lib/i18n';

interface KenzoWelcomePopupProps {
  language: Language;
}

export function KenzoWelcomePopup({ language }: KenzoWelcomePopupProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('kenzo-welcome-shown');
    
    if (!hasSeenWelcome) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('kenzo-welcome-shown', 'true');
  };

  if (!isVisible) return null;

  const messages = {
    he: {
      greeting: "שלום וזנב מתנופף! 🐾",
      intro: "אני Kenzo",
      subtitle: "הגולדן רטריבר הלבן והשגריר הרשמי של Pet Wash™️",
      welcome: "ברוכים הבאים למשפחת Pet Wash! אני כל כך שמח שהצטרפתם אלינו! 🤗",
      message: "כאן ב-Pet Wash™️, אנחנו לא רק שוטפים - אנחנו מטפלים בכלבים האהובים שלכם עם אהבה, טיפול אורגני פרימיום ותשומת לב אישית. כל כלב הוא חלק מהמשפחה שלנו!",
      promise: "אני מבטיח שכל ביקור יהיה מלא באהבה, משחק ומגע הספא הכי טוב! 💖",
      cta: "בואו נתחיל את ההרפתקה!",
      close: "תודה, Kenzo! 🐕"
    },
    en: {
      greeting: "Hello & Wagging Tail! 🐾",
      intro: "I'm Kenzo",
      subtitle: "The White Golden Retriever & Official Pet Wash™️ Ambassador",
      welcome: "Welcome to the Pet Wash family! I'm SO excited you're here! 🤗",
      message: "Here at Pet Wash™️, we don't just wash - we care for your beloved dogs with love, premium organic care, and personal attention. Every pup is part of our family!",
      promise: "I promise every visit will be full of love, play, and the best spa treatment! 💖",
      cta: "Let's Start the Adventure!",
      close: "Thanks, Kenzo! 🐕"
    }
  };

  const content = messages[language];
  const isRTL = language === 'he';

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-md z-[10000] animate-fade-in"
        onClick={handleClose}
      />
      
      {/* Welcome Popup */}
      <div 
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001] w-[95vw] max-w-[500px] animate-scale-in"
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{ fontFamily: isRTL ? 'Alef, sans-serif' : 'Inter, system-ui, sans-serif' }}
      >
        <div className="relative bg-gradient-to-br from-white via-blue-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-purple-950 rounded-3xl shadow-2xl overflow-hidden border-4 border-white/50 dark:border-white/10">
          
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-300/30 to-orange-300/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-blue-300/30 to-purple-300/30 rounded-full blur-3xl" />
          
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 flex items-center justify-center transition-all shadow-lg hover:scale-110"
            data-testid="button-close-kenzo-welcome"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>

          <div className="relative p-8">
            
            {/* Kenzo's Photo */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full blur-xl opacity-50 animate-pulse" />
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl ring-4 ring-yellow-400/50">
                  <img 
                    src="/brand/kenzo-avatar.jpeg" 
                    alt="Kenzo - Pet Wash Ambassador" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect fill="%23F59E0B" width="128" height="128"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="64">🐕</text></svg>';
                    }}
                  />
                </div>
                {/* Sparkle Effect */}
                <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 animate-bounce" />
                <Heart className="absolute -bottom-2 -left-2 w-8 h-8 text-red-500 animate-pulse" />
              </div>
            </div>

            {/* Greeting */}
            <div className="text-center mb-4">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2 animate-gradient">
                {content.greeting}
              </h2>
              <p className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                {content.intro}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {content.subtitle}
              </p>
            </div>

            {/* Welcome Message */}
            <div className="space-y-4 mb-6 text-center">
              <p className="text-lg font-semibold text-gray-800 dark:text-gray-100 leading-relaxed">
                {content.welcome}
              </p>
              
              <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-5 shadow-inner">
                <p className="text-base text-gray-700 dark:text-gray-200 leading-relaxed mb-3">
                  {content.message}
                </p>
                <p className="text-base font-medium text-gray-800 dark:text-gray-100 leading-relaxed flex items-center justify-center gap-2">
                  {content.promise}
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleClose}
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 rounded-xl"
                data-testid="button-start-adventure"
              >
                {content.cta}
              </Button>
              
              <button
                onClick={handleClose}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                data-testid="button-thanks-kenzo"
              >
                {content.close}
              </button>
            </div>

            {/* Paw Prints Decoration */}
            <div className="absolute bottom-2 left-4 text-4xl opacity-20 rotate-12">🐾</div>
            <div className="absolute top-20 right-8 text-3xl opacity-20 -rotate-12">🐾</div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .animate-scale-in {
          animation: scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </>
  );
}
