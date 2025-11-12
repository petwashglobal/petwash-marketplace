import { useLocation } from 'wouter';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, Gift, Percent, Crown, Mail, Dog } from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { type Language, t } from '@/lib/i18n';

interface DashboardQuickActionsProps {
  language: Language;
}

export function DashboardQuickActions({ language }: DashboardQuickActionsProps) {
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState<string | null>(null);
  const { trackEvent } = useAnalytics();

  const go = (path: string, key: string, action: string) => () => {
    setBusy(key);
    trackEvent({
      action: 'qa_click',
      category: 'quick_actions',
      label: action,
      language,
    });
    
    // Simulate brief loading state for better UX
    setTimeout(() => {
      setLocation(path);
      setBusy(null);
    }, 150);
  };

  return (
    <div className="space-y-3">
      <Button 
        className="w-full" 
        variant="outline"
        onClick={go('/packages', 'book', 'book_wash')}
        disabled={busy === 'book'}
        aria-label={t('quickActions.bookWash', language)}
        data-testid="button-book-wash"
      >
        <CreditCard className="w-4 h-4 mr-2" />
        {busy === 'book' ? t('quickActions.opening', language) : t('quickActions.bookWash', language)}
      </Button>
      <Button 
        className="w-full" 
        variant="outline"
        onClick={go('/gift-cards/buy', 'buy', 'buy_gift_card')}
        disabled={busy === 'buy'}
        aria-label={t('quickActions.buyGift', language)}
        data-testid="button-buy-gift"
      >
        <Gift className="w-4 h-4 mr-2" />
        {busy === 'buy' ? t('quickActions.opening', language) : t('quickActions.buyGift', language)}
      </Button>
      <Button 
        className="w-full" 
        variant="outline"
        onClick={go('/gift-cards/redeem', 'redeem', 'redeem_gift_card')}
        disabled={busy === 'redeem'}
        aria-label={t('quickActions.redeem', language)}
        data-testid="button-redeem-gift"
      >
        <Percent className="w-4 h-4 mr-2" />
        {busy === 'redeem' ? t('quickActions.opening', language) : t('quickActions.redeem', language)}
      </Button>
      <Button 
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white" 
        onClick={go('/loyalty', 'loyalty', 'view_loyalty')}
        disabled={busy === 'loyalty'}
        aria-label={t('quickActions.loyalty', language)}
        data-testid="button-loyalty"
      >
        <Crown className="w-4 h-4 mr-2" />
        {busy === 'loyalty' ? t('quickActions.opening', language) : t('quickActions.loyalty', language)}
      </Button>
      
      {/* Luxury Inbox Button */}
      <Button 
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md" 
        onClick={go('/inbox', 'inbox', 'open_inbox')}
        disabled={busy === 'inbox'}
        aria-label={t('quickActions.inbox', language)}
        data-testid="button-inbox"
      >
        <Mail className="w-4 h-4 mr-2" />
        {busy === 'inbox' ? t('quickActions.opening', language) : t('quickActions.inbox', language)}
      </Button>
      
      {/* My Pets Button */}
      <Button 
        className="w-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-md" 
        onClick={go('/pets', 'pets', 'manage_pets')}
        disabled={busy === 'pets'}
        aria-label={t('quickActions.pets', language)}
        data-testid="button-pets"
      >
        <Dog className="w-4 h-4 mr-2" />
        {busy === 'pets' ? t('quickActions.opening', language) : t('quickActions.pets', language)}
      </Button>
    </div>
  );
}
