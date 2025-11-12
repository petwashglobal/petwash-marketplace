import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { type Language, t } from "@/lib/i18n";
import { GmailOAuthButton } from "@/components/GmailOAuthButton";
import { Mail, Sparkles, CheckCircle2 } from "lucide-react";
import { FaGoogle } from "react-icons/fa";

interface GmailDemoProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

/**
 * LUXURY 2025: Gmail OAuth Demo Page
 * Shows the beautiful Google permission consent screen
 * User can test "Sign in with Gmail" on iPhone and press "Save"!
 */
export default function GmailDemo({ language, onLanguageChange }: GmailDemoProps) {
  const handleGmailSuccess = (accessToken: string, user: any) => {
    console.log('🎉 Gmail connected successfully!', { accessToken: '***', user });
  };

  const handleGmailError = (error: Error) => {
    console.error('Gmail OAuth error:', error);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-blue-950">
      <Header 
        language={language} 
        onLanguageChange={onLanguageChange}
        showDarkModeToggle={false}
      />
      
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-2xl">
          {/* LUXURY 2025: Premium Hero Section */}
          <div className="text-center mb-12 animate-in fade-in duration-1000">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl shadow-blue-600/30">
                <FaGoogle className="w-8 h-8 text-white" />
              </div>
              <div className="text-6xl animate-pulse">✨</div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-700 shadow-xl shadow-purple-600/30">
                <Mail className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                {t('gmailDemo.title', language)}
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto leading-relaxed tracking-wide">
              {t('gmailDemo.heroDescription', language)}
            </p>
          </div>

          {/* LUXURY 2025: Premium Gmail OAuth Card */}
          <div className="relative group animate-in slide-in-from-bottom duration-1000 delay-300">
            {/* Premium Glow Background */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
            
            {/* Main Card */}
            <div className="relative p-8 sm:p-10 lg:p-12 rounded-3xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl border-2 border-neutral-200/60 dark:border-neutral-700/60 shadow-2xl">
              {/* Gmail OAuth Button */}
              <GmailOAuthButton 
                language={language}
                onSuccess={handleGmailSuccess}
                onError={handleGmailError}
              />

              {/* Premium Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-neutral-200 dark:border-neutral-700" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 text-sm font-medium text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 tracking-wide">
                    {t('gmailDemo.whatHappens', language)}
                  </span>
                </div>
              </div>

              {/* LUXURY 2025: Step-by-Step Preview */}
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-2 border-blue-200/60 dark:border-blue-700/40">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1 tracking-wide">
                      {t('gmailDemo.googlePopup', language)}
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                      {t('gmailDemo.step1Description', language)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-2 border-purple-200/60 dark:border-purple-700/40">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 dark:bg-purple-500 flex items-center justify-center text-white font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1 tracking-wide">
                      {t('gmailDemo.permissionScreen', language)}
                    </h3>
                    <p className="text-sm text-purple-700 dark:text-purple-300 leading-relaxed">
                      {t('gmailDemo.step2Description', language)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-2 border-green-200/60 dark:border-green-700/40">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 dark:bg-green-500 flex items-center justify-center text-white font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1 tracking-wide">
                      {t('gmailDemo.pressAllow', language)}
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 leading-relaxed">
                      {t('gmailDemo.step3Description', language)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* LUXURY 2025: Premium Features Grid */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 animate-in fade-in duration-1000 delay-500">
            <div className="p-6 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-2 border-neutral-200/60 dark:border-neutral-700/60 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2 tracking-wide">
                {t('gmailDemo.builtInSecurity', language)}
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {t('gmailDemo.googleOAuth', language)}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-2 border-neutral-200/60 dark:border-neutral-700/60 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-600/30">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2 tracking-wide">
                {t('gmailDemo.perfectExperience', language)}
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {t('gmailDemo.likeAppleGoogle', language)}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-2 border-neutral-200/60 dark:border-neutral-700/60 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-pink-600 to-pink-700 flex items-center justify-center shadow-lg shadow-pink-600/30">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2 tracking-wide">
                {t('gmailDemo.fullAccess', language)}
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {t('gmailDemo.readAndSend', language)}
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer language={language} />
    </div>
  );
}
