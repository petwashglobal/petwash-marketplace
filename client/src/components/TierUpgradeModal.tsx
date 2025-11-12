import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTierConfig, getTierDisplay, type LoyaltyTier } from '@/lib/loyalty';
import { Crown, Sparkles, Star } from 'lucide-react';
import { type Language, t } from '@/lib/i18n';

interface TierUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  newTier: LoyaltyTier;
  language: Language;
}

export function TierUpgradeModal({ open, onClose, newTier, language }: TierUpgradeModalProps) {
  const tierConfig = getTierConfig(newTier);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (open) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        {/* Confetti Effect */}
        <AnimatePresence>
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none z-50">
              {[...Array(30)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  initial={{
                    x: '50%',
                    y: '50%',
                    opacity: 1,
                    scale: 0,
                  }}
                  animate={{
                    x: `${Math.random() * 100}%`,
                    y: `${Math.random() * 100}%`,
                    opacity: 0,
                    scale: 1,
                    rotate: Math.random() * 360,
                  }}
                  transition={{
                    duration: 1.5 + Math.random(),
                    ease: 'easeOut',
                  }}
                >
                  {i % 3 === 0 ? (
                    <Sparkles className="h-4 w-4 text-yellow-400" />
                  ) : i % 3 === 1 ? (
                    <Star className="h-4 w-4 text-blue-400" />
                  ) : (
                    <Crown className="h-3 w-3 text-purple-400" />
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        <DialogHeader>
          <DialogTitle className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.6 }}
              className="flex flex-col items-center gap-4 mb-4"
            >
              <div className="text-6xl">{tierConfig.badge}</div>
              <div>
                <div className="text-2xl font-bold mb-2">{t('tierModal.congratulations', language)}</div>
                <div className="text-lg text-gray-600">
                  {t('tierModal.tierUpgrade', language)}
                </div>
              </div>
            </motion.div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('tierModal.upgradedMessage', language)}
          </DialogDescription>
        </DialogHeader>

        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Tier Badge */}
          <div
            className="p-6 rounded-lg text-center"
            style={{ background: tierConfig.color.gradient }}
          >
            <h3 className="text-3xl font-bold text-white mb-2">
              {getTierDisplay(newTier, language).toUpperCase()}
            </h3>
            <p className="text-white/90 text-lg">
              {tierConfig.discount}% {t('tierModal.discount', language)}
            </p>
          </div>

          {/* New Perks */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {t('tierModal.newPerks', language)}
            </h4>
            <ul className="space-y-2">
              {tierConfig.perks.map((perk, index) => (
                <motion.li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-600"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                >
                  <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                  <span>{perk}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              {t('tierModal.close', language)}
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              onClick={() => {
                onClose();
                window.location.href = '/loyalty';
              }}
            >
              <Crown className="h-4 w-4 mr-2" />
              {t('tierModal.explore', language)}
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

// Utility to check and trigger tier upgrade
export function checkTierUpgrade(
  previousWashes: number,
  currentWashes: number,
  onUpgrade: (newTier: LoyaltyTier) => void
) {
  const previousTier = calculateTierFromWashes(previousWashes);
  const currentTier = calculateTierFromWashes(currentWashes);

  if (previousTier !== currentTier) {
    onUpgrade(currentTier);
  }
}

function calculateTierFromWashes(washes: number): LoyaltyTier {
  if (washes >= 25) return 'platinum';
  if (washes >= 10) return 'gold';
  if (washes >= 3) return 'silver';
  return 'new';
}
