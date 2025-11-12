import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Briefcase, Download, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/languageStore";
import { useAuth } from "@/hooks/useAuth";

export default function MyWalletCards() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isHebrew = language === 'he';
  const [isGenerating, setIsGenerating] = useState<'loyalty' | 'business' | null>(null);
  
  // Business card customization
  const [businessCardData, setBusinessCardData] = useState({
    title: '',
    phone: '',
    mobile: ''
  });

  const handleAddLoyaltyCard = async () => {
    if (!user) {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew ? 'יש להתחבר תחילה' : 'Please sign in first',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsGenerating('loyalty');
      
      const response = await fetch('/api/wallet/vip-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate VIP card');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PetWash_VIP_Card.pkpass`;
      a.click();

      toast({
        title: isHebrew ? '✨ הצלחה!' : '✨ Success!',
        description: isHebrew 
          ? 'כרטיס ה-VIP שלך נוסף ל-Apple Wallet'
          : 'Your VIP loyalty card has been added to Apple Wallet'
      });
    } catch (error) {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew 
          ? 'לא הצלחנו ליצור כרטיס VIP'
          : 'Failed to create VIP card',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(null);
    }
  };

  const handleAddBusinessCard = async () => {
    if (!user) {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew ? 'יש להתחבר תחילה' : 'Please sign in first',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsGenerating('business');
      
      const response = await fetch('/api/wallet/my-business-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customBusinessCard: {
            title: businessCardData.title || undefined,
            phone: businessCardData.phone || undefined,
            mobile: businessCardData.mobile || undefined
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate business card');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PetWash_Business_Card.pkpass`;
      a.click();

      toast({
        title: isHebrew ? '✨ הצלחה!' : '✨ Success!',
        description: isHebrew 
          ? 'כרטיס הביקור שלך נוסף ל-Apple Wallet'
          : 'Your business card has been added to Apple Wallet'
      });
    } catch (error) {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew 
          ? 'לא הצלחנו ליצור כרטיס ביקור'
          : 'Failed to create business card',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(null);
    }
  };

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

  if (!isIOS) {
    return (
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 border-amber-200 dark:border-amber-800">
        <CardContent className="pt-6 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            {isHebrew 
              ? '📱 Apple Wallet זמין רק במכשירי iPhone ו-iPad'
              : '📱 Apple Wallet is only available on iPhone and iPad'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {isHebrew 
              ? 'השתמש במכשיר iOS כדי להוסיף את הכרטיסים שלך'
              : 'Use an iOS device to add your cards'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* VIP Loyalty Card */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full blur-3xl opacity-20"></div>
        <CardHeader className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
          </div>
          <CardTitle className="text-2xl">
            {isHebrew ? 'כרטיס VIP Loyalty' : 'VIP Loyalty Card'}
          </CardTitle>
          <CardDescription>
            {isHebrew 
              ? 'כרטיס נאמנות יוקרתי עם עיצוב בסגנון כרטיס אשראי'
              : 'Luxury loyalty card with credit card style design'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400">✨</span>
                <span>{isHebrew ? 'עיצוב בסגנון כרטיס בנק יוקרתי' : 'Luxury bank card style design'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400">💳</span>
                <span>{isHebrew ? 'יתרת נקודות בזמן אמת' : 'Real-time points balance'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400">📍</span>
                <span>{isHebrew ? 'התראות מבוססות מיקום' : 'Location-based notifications'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400">🎨</span>
                <span>{isHebrew ? 'עיצוב אישי לפי רמה (חדש/כסף/זהב/פלטינום/יהלום)' : 'Tier-based design (New/Silver/Gold/Platinum/Diamond)'}</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleAddLoyaltyCard}
            disabled={isGenerating === 'loyalty'}
            className="w-full bg-black hover:bg-gray-800 text-white h-12 text-lg font-medium"
            data-testid="button-add-loyalty-card"
          >
            {isGenerating === 'loyalty' ? (
              <>
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                {isHebrew ? 'יוצר...' : 'Creating...'}
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                {isHebrew ? 'הוסף ל-Apple Wallet' : 'Add to Apple Wallet'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Personal Business Card */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full blur-3xl opacity-20"></div>
        <CardHeader className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" />
          </div>
          <CardTitle className="text-2xl">
            {isHebrew ? 'כרטיס ביקור דיגיטלי' : 'Digital Business Card'}
          </CardTitle>
          <CardDescription>
            {isHebrew 
              ? 'כרטיס ביקור אישי לשיתוף מהיר'
              : 'Personal business card for quick sharing'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="title" className="text-sm">
                {isHebrew ? 'תפקיד (אופציונלי)' : 'Title (Optional)'}
              </Label>
              <Input
                id="title"
                placeholder={isHebrew ? 'לדוגמה: VIP Member, מנהל, וכו...' : 'e.g., VIP Member, Manager, etc.'}
                value={businessCardData.title}
                onChange={(e) => setBusinessCardData({ ...businessCardData, title: e.target.value })}
                data-testid="input-business-card-title"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-sm">
                {isHebrew ? 'טלפון (אופציונלי)' : 'Phone (Optional)'}
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+972 XX-XXXXXXX"
                value={businessCardData.phone}
                onChange={(e) => setBusinessCardData({ ...businessCardData, phone: e.target.value })}
                data-testid="input-business-card-phone"
              />
            </div>
            <div>
              <Label htmlFor="mobile" className="text-sm">
                {isHebrew ? 'נייד (אופציונלי)' : 'Mobile (Optional)'}
              </Label>
              <Input
                id="mobile"
                type="tel"
                placeholder="+972 5X-XXXXXXX"
                value={businessCardData.mobile}
                onChange={(e) => setBusinessCardData({ ...businessCardData, mobile: e.target.value })}
                data-testid="input-business-card-mobile"
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 p-3 rounded-lg border border-blue-200 dark:border-blue-800 text-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">📱</span>
                <span>{isHebrew ? 'שיתוף דרך QR, AirDrop, NFC' : 'Share via QR, AirDrop, NFC'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">🤝</span>
                <span>{isHebrew ? 'NameDrop - הקש iPhone ב-iPhone' : 'NameDrop - Tap iPhone to iPhone'}</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleAddBusinessCard}
            disabled={isGenerating === 'business'}
            className="w-full bg-black hover:bg-gray-800 text-white h-12 text-lg font-medium"
            data-testid="button-add-business-card"
          >
            {isGenerating === 'business' ? (
              <>
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                {isHebrew ? 'יוצר...' : 'Creating...'}
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                {isHebrew ? 'הוסף ל-Apple Wallet' : 'Add to Apple Wallet'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
