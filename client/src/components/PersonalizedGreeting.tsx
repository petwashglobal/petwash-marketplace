import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/languageStore';

interface GreetingResponse {
  ok: boolean;
  greeting: string;
  occasionBased: boolean;
}

export function PersonalizedGreeting() {
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if greeting was already shown in this session
  useEffect(() => {
    const greetingShown = sessionStorage.getItem('petwash_greeting_shown');
    if (greetingShown) {
      setIsDismissed(true);
      setIsVisible(false);
    }
  }, []);

  // Fetch personalized greeting
  const { data, isLoading } = useQuery<GreetingResponse>({
    queryKey: ['/api/greeting', language],
    enabled: !isDismissed,
    staleTime: Infinity, // Only fetch once per session
  });

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (data && !isDismissed) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [data, isDismissed]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsDismissed(true);
      sessionStorage.setItem('petwash_greeting_shown', 'true');
    }, 300);
  };

  if (isDismissed || isLoading || !data) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ 
            duration: 0.4,
            ease: [0.16, 1, 0.3, 1] // Apple-style spring
          }}
          className="mb-6"
        >
          <Card className="relative overflow-hidden bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-pink-900/20 border-2 border-blue-200 dark:border-blue-800 shadow-lg">
            {/* Animated background sparkles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-200/40 to-orange-200/40 dark:from-yellow-500/20 dark:to-orange-500/20 rounded-full blur-2xl"
              />
              <motion.div
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.2, 0.5, 0.2],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1
                }}
                className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-blue-200/40 to-purple-200/40 dark:from-blue-500/20 dark:to-purple-500/20 rounded-full blur-2xl"
              />
            </div>

            <div className="relative p-5 sm:p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Kenzo Avatar */}
                <motion.div
                  animate={{
                    rotate: [0, 10, -10, 10, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                  className="text-5xl sm:text-6xl flex-shrink-0"
                  data-testid="kenzo-avatar"
                >
                  🐕
                </motion.div>

                <div className="flex-1 min-w-0">
                  {/* Occasion badge */}
                  {data.occasionBased && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center gap-1 mb-2"
                    >
                      <Sparkles className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 uppercase tracking-wide">
                        {language === 'he' ? 'ברכה מיוחדת' : 'Special Greeting'}
                      </span>
                    </motion.div>
                  )}

                  {/* Greeting text */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white leading-relaxed"
                    data-testid="greeting-text"
                  >
                    {data.greeting}
                  </motion.p>

                  {/* Pet Wash branding */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-sm text-gray-600 dark:text-gray-400 mt-1"
                  >
                    — Kenzo, Pet Wash™ 🐾
                  </motion.p>
                </div>
              </div>

              {/* Dismiss button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDismiss}
                className="flex-shrink-0 hover:bg-white/50 dark:hover:bg-black/20 rounded-full"
                data-testid="dismiss-greeting"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
