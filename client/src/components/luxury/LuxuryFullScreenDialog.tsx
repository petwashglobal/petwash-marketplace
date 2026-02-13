import { useState, useEffect } from 'react';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Language } from '@/lib/i18n';

interface LuxuryFullScreenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: () => void;
  title: string;
  subtitle?: string;
  description: string;
  actionButtonText: string;
  language?: Language;
  isLoading?: boolean;
  showAfterDelay?: number;
}

export function LuxuryFullScreenDialog({
  isOpen,
  onClose,
  onAction,
  title,
  subtitle,
  description,
  actionButtonText,
  language = 'he',
  isLoading = false,
  showAfterDelay,
}: LuxuryFullScreenDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isRTL = language === 'he' || language === 'ar';

  useEffect(() => {
    if (showAfterDelay && showAfterDelay > 0) {
      const timer = setTimeout(() => {
        setInternalOpen(true);
      }, showAfterDelay);
      return () => clearTimeout(timer);
    }
  }, [showAfterDelay]);

  const effectiveOpen = showAfterDelay ? internalOpen : isOpen;

  const handleClose = () => {
    if (showAfterDelay) {
      setInternalOpen(false);
    }
    onClose();
  };

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
  };

  return (
    <DialogPrimitive.Root open={effectiveOpen} onOpenChange={handleClose}>
      <AnimatePresence>
        {effectiveOpen && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              />
            </DialogPrimitive.Overlay>
            
            <DialogPrimitive.Content asChild>
              <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ 
                  type: 'spring', 
                  damping: 25, 
                  stiffness: 300,
                  duration: 0.4 
                }}
                className={cn(
                  "fixed inset-0 z-50 bg-white",
                  "flex flex-col items-center justify-center",
                  "p-6 sm:p-12",
                  isRTL && "rtl"
                )}
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <DialogPrimitive.Close asChild>
                  <button
                    className={cn(
                      "absolute top-6 w-11 h-11",
                      "flex items-center justify-center",
                      "rounded-full",
                      "text-gray-600 hover:text-gray-900",
                      "hover:bg-gray-100",
                      "transition-all duration-200",
                      "focus:outline-none focus:ring-2 focus:ring-gray-300",
                      isRTL ? "left-6" : "right-6"
                    )}
                    aria-label="Close"
                    data-testid="button-close-luxury-dialog"
                  >
                    <X className="w-6 h-6" strokeWidth={1.5} />
                  </button>
                </DialogPrimitive.Close>

                <div className="flex flex-col items-center justify-center max-w-md text-center">
                  {subtitle && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center gap-2 mb-4 px-4 py-2 bg-amber-50 rounded-full"
                    >
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-700">
                        {subtitle}
                      </span>
                    </motion.div>
                  )}

                  <DialogPrimitive.Title asChild>
                    <motion.h2
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className={cn(
                        "text-3xl sm:text-4xl font-black text-gray-900 mb-4",
                        isRTL ? "text-right" : "text-left",
                        "text-center"
                      )}
                    >
                      {title}
                    </motion.h2>
                  </DialogPrimitive.Title>

                  <DialogPrimitive.Description asChild>
                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className={cn(
                        "text-lg text-gray-600 leading-relaxed mb-10",
                        isRTL ? "text-right" : "text-left",
                        "text-center"
                      )}
                    >
                      {description}
                    </motion.p>
                  </DialogPrimitive.Description>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5, type: 'spring' }}
                  >
                    <Button
                      onClick={handleAction}
                      disabled={isLoading}
                      className={cn(
                        "bg-gradient-to-r from-amber-500 to-amber-600",
                        "hover:from-amber-600 hover:to-amber-700",
                        "text-white font-bold",
                        "px-8 py-4 text-lg",
                        "rounded-xl",
                        "shadow-lg shadow-amber-500/25",
                        "hover:shadow-xl hover:shadow-amber-500/30",
                        "hover:scale-105",
                        "transition-all duration-300",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                      data-testid="button-luxury-action"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                          />
                          {isRTL ? 'טוען...' : 'Loading...'}
                        </span>
                      ) : (
                        actionButtonText
                      )}
                    </Button>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="absolute bottom-8 text-center text-sm text-gray-400"
                >
                  {isRTL ? 'הצעה מיוחדת מ-⁦Pet Wash™⁩' : 'Special offer from ⁦Pet Wash™⁩'}
                </motion.div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

export function useLuxuryPromoDialog(delay: number = 3000) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    const hasSeenPromo = localStorage.getItem('petwash_promo_seen');
    if (hasSeenPromo) return;

    const timer = setTimeout(() => {
      if (!hasShown) {
        setIsOpen(true);
        setHasShown(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, hasShown]);

  const close = () => {
    setIsOpen(false);
    localStorage.setItem('petwash_promo_seen', 'true');
  };

  return { isOpen, close, setIsOpen };
}
