/**
 * Apple Wallet "Add to Wallet" Button Component
 * 
 * Luxury button that adds VIP loyalty card to Apple Wallet
 * Features:
 * - Beautiful Apple-style design
 * - Bilingual support (Hebrew/English)
 * - Automatic user data detection
 * - Loading states
 * - Error handling
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/languageStore';
import { Apple, Download, Loader2, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';

interface AppleWalletButtonProps {
  tier: 'new' | 'silver' | 'gold' | 'platinum' | 'diamond';
  points: number;
  discountPercent: number;
  memberSince?: Date;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function AppleWalletButton({
  tier,
  points,
  discountPercent,
  memberSince,
  className = '',
  size = 'md',
}: AppleWalletButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isHebrew = language === 'he';

  const handleAddToWallet = async () => {
    if (!user) {
      toast({
        title: isHebrew ? 'נדרש התחברות' : 'Login Required',
        description: isHebrew 
          ? 'אנא התחבר כדי להוסיף כרטיס VIP ל-Wallet' 
          : 'Please sign in to add VIP card to Wallet',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const userId = (user as any).uid || (user as any).id;
      const userName = (user as any).displayName || (user as any).email?.split('@')[0] || 'VIP Member';
      const userEmail = (user as any).email || '';

      // Call API to generate Apple Wallet pass
      const response = await fetch('/api/wallet/vip-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          userName,
          userEmail,
          tier,
          points,
          discountPercent,
          memberSince: memberSince || new Date(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Check if it's a configuration error
        if (response.status === 503) {
          toast({
            title: isHebrew ? 'בקרוב...' : 'Coming Soon...',
            description: isHebrew
              ? 'Apple Wallet בתהליך הגדרה. תכונה זו תהיה זמינה בקרוב!'
              : 'Apple Wallet is being configured. This feature will be available soon!',
          });
          return;
        }

        throw new Error(error.message || 'Failed to generate pass');
      }

      // Download the .pkpass file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PetWash_VIP_${tier.toUpperCase()}.pkpass`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: isHebrew ? '✅ הצלחה!' : '✅ Success!',
        description: isHebrew
          ? 'כרטיס ה-VIP שלך הורד! הקש עליו כדי להוסיף ל-Wallet.'
          : 'Your VIP card has been downloaded! Tap it to add to Wallet.',
      });

    } catch (error) {
      console.error('Error adding to wallet:', error);
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew
          ? 'לא ניתן להוסיף כרטיס ל-Wallet כעת. נסה שוב מאוחר יותר.'
          : 'Could not add card to Wallet. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user is on iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Button sizes
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button
        onClick={handleAddToWallet}
        disabled={isLoading}
        className={`
          bg-black text-white hover:bg-gray-900 
          rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300
          font-semibold flex items-center gap-3
          ${sizeClasses[size]}
          ${className}
        `}
        data-testid="button-add-to-wallet"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" size={size === 'lg' ? 24 : size === 'sm' ? 16 : 20} />
            {isHebrew ? 'מייצר...' : 'Generating...'}
          </>
        ) : (
          <>
            {isIOS ? (
              <Apple size={size === 'lg' ? 24 : size === 'sm' ? 16 : 20} />
            ) : (
              <Wallet size={size === 'lg' ? 24 : size === 'sm' ? 16 : 20} />
            )}
            <span>
              {isHebrew ? 'הוסף ל-Wallet' : 'Add to Wallet'}
            </span>
            {isIOS && (
              <div className="inline-flex items-center gap-1 bg-white/20 px-2 py-1 rounded text-xs">
                <Apple size={12} />
                iOS
              </div>
            )}
          </>
        )}
      </Button>
    </motion.div>
  );
}

/**
 * Simple "Add to Wallet" badge (for compact layouts)
 */
export function AppleWalletBadge({ 
  tier, 
  points, 
  discountPercent,
  memberSince 
}: AppleWalletButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isHebrew = language === 'he';

  const handleAddToWallet = async () => {
    if (!user) {
      toast({
        title: isHebrew ? 'נדרש התחברות' : 'Login Required',
        description: isHebrew 
          ? 'אנא התחבר כדי להוסיף כרטיס VIP ל-Wallet' 
          : 'Please sign in to add VIP card to Wallet',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const userId = (user as any).uid || (user as any).id;
      const userName = (user as any).displayName || (user as any).email?.split('@')[0] || 'VIP Member';
      const userEmail = (user as any).email || '';

      const response = await fetch('/api/wallet/vip-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          userName,
          userEmail,
          tier,
          points,
          discountPercent,
          memberSince: memberSince || new Date(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 503) {
          toast({
            title: isHebrew ? 'בקרוב...' : 'Coming Soon...',
            description: isHebrew
              ? 'Apple Wallet בתהליך הגדרה'
              : 'Apple Wallet is being configured',
          });
          return;
        }
        throw new Error(error.message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PetWash_VIP_${tier.toUpperCase()}.pkpass`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: isHebrew ? '✅ הצלחה!' : '✅ Success!',
        description: isHebrew
          ? 'כרטיס ה-VIP הורד בהצלחה'
          : 'VIP card downloaded successfully',
      });

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew ? 'ניסיון נכשל' : 'Failed to download',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.button
      onClick={handleAddToWallet}
      disabled={isLoading}
      className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-900 transition-all shadow-md hover:shadow-lg"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      data-testid="badge-add-to-wallet"
    >
      {isLoading ? (
        <Loader2 className="animate-spin" size={16} />
      ) : (
        <Apple size={16} />
      )}
      <span className="text-sm font-medium">
        {isHebrew ? 'Wallet' : 'Wallet'}
      </span>
    </motion.button>
  );
}
