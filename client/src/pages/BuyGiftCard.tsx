import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { getApiUrl } from '@/lib/apiConfig';
import { type Language, t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { NativeDateSelect } from '@/components/ui/native-date-select';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Gift, MapPin, Mail, User, Calendar, DollarSign, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneInput } from '@/components/PhoneInput';
import { usePaymentStatus } from '@/hooks/use-payment-status';
import { useSEO, pageSEO } from '@/lib/seo';

interface BuyGiftCardProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

export default function BuyGiftCard({ language, onLanguageChange }: BuyGiftCardProps) {
  useSEO(pageSEO.buyGiftCard);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const { paymentsEnabled, isLoading: paymentStatusLoading } = usePaymentStatus();
  const isRTL = language === 'he' || language === 'ar';
  
  const [formData, setFormData] = useState({
    // Sender info (optional - can be anonymous gift)
    senderName: "",
    senderEmail: "",
    
    // Recipient info (REQUIRED)
    recipientName: "",
    recipientEmail: "",
    recipientPhone: "",
    
    // Delivery address (REQUIRED - for station redemption)
    address: "",
    city: "",
    postcode: "",
    country: "Israel",
    
    // Gift details
    amount: "",
    message: "",
    deliveryDate: new Date().toISOString().split('T')[0],
  });

  // Pre-fill sender + address from profile (best-effort — works if logged in)
  const { data: userProfile } = useQuery<{
    displayName?: string; email?: string; firstName?: string; lastName?: string;
    street?: string; city?: string; postalCode?: string; address?: string;
  }>({
    queryKey: ['/api/user/profile'],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (userProfile) {
      const name = [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ')
        || userProfile.displayName || '';
      const street = userProfile.street || userProfile.address || '';
      setFormData(prev => ({
        ...prev,
        senderName: prev.senderName || name,
        senderEmail: prev.senderEmail || userProfile.email || '',
        address: prev.address || street,
        city: prev.city || userProfile.city || '',
        postcode: prev.postcode || userProfile.postalCode || '',
      }));
    }
  }, [userProfile]);

  const predefinedAmounts = [50, 100, 200, 500, 1000];

  const handleAddressChange = (value: string, details?: PlaceDetails) => {
    setFormData(prev => ({
      ...prev,
      address: value,
      city: details?.city || prev.city,
      postcode: details?.postalCode || prev.postcode,
      country: details?.country || prev.country,
    }));
  };

  const handlePlaceSelected = (place: PlaceDetails) => {
    setFormData(prev => ({
      ...prev,
      address: place.formattedAddress,
      city: place.city || prev.city,
      postcode: place.postalCode || prev.postcode,
      country: place.country || prev.country,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.recipientName || !formData.recipientEmail || !formData.amount || !formData.postcode) {
      toast({
        title: t('common.error', language),
        description: t('common.fillRequired', language),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/gift-cards/purchase'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to purchase gift card');
      }

      const data = await response.json();
      
      if (data.paymentUrl) {
        // Redirect to Nayax payment page (external)
        window.location.href = data.paymentUrl;
      } else {
        throw new Error('Payment URL not provided');
      }
    } catch (error: any) {
      toast({
        title: t('common.failed', language),
        description: error.message || t('giftCards.purchaseFailed', language),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!paymentStatusLoading && !paymentsEnabled) {
    return (
      <Layout language={language} onLanguageChange={onLanguageChange}>
        <div className="min-h-screen flex flex-col luxury-bg-mesh" dir={isRTL ? 'rtl' : 'ltr'}>
          <main className="flex-1 container mx-auto px-4 py-16 flex items-center justify-center">
            <div className="max-w-md w-full text-center">
              <div className="relative mb-6">
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                  <Gift className="w-12 h-12 text-purple-500" />
                </div>
                <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shadow-md mx-auto" style={{ right: 'calc(50% - 52px)' }}>
                  <Clock className="w-4 h-4 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-3 text-slate-800">
                {isRTL ? '🎁 כרטיסי מתנה — בקרוב!' : '🎁 Gift Cards — Coming Soon!'}
              </h1>
              <p className="text-slate-500 leading-relaxed mb-6">
                {isRTL
                  ? 'אנחנו בגרסת השקה — כרטיסי מתנה דיגיטליים יהיו זמינים ברגע שמערכת התשלומים תופעל. תודה על הסבלנות!'
                  : 'We\'re in soft launch mode — digital gift cards will be available as soon as our payment system goes live. Thanks for your patience!'}
              </p>
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 mb-6 text-sm text-purple-700">
                {isRTL
                  ? '✅ בינתיים, הצטרף למועדון, גלה ספקים וצור קשר עם קהילת חובבי החיות שלנו!'
                  : '✅ In the meantime, join the club, discover providers, and connect with our pet lover community!'}
              </div>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors shadow-sm"
              >
                {isRTL ? '← חזרה לדף הבית' : '← Back to Home'}
              </button>
            </div>
          </main>
        </div>
      </Layout>
    );
  }

  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen flex flex-col luxury-bg-mesh" dir={language === "he" || language === "ar" ? "rtl" : "ltr"}>
        <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 luxury-animate-fade-in">
            <Gift className="w-16 h-16 mx-auto mb-4 text-purple-600" />
            <h1 className="luxury-heading-xl mb-2">
              {t('giftCards.buyTitle', language)}
            </h1>
            <p className="luxury-text-body text-gray-600">
              {t('giftCards.subtitle', language)}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Gift Amount */}
            <Card className="luxury-glass-card luxury-shadow-lg">
              <CardHeader>
                <CardTitle className="luxury-heading-sm flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  {t('giftCards.amount', language)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {predefinedAmounts.map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant={formData.amount === String(amount) ? "default" : "outline"}
                      onClick={() => setFormData(prev => ({ ...prev, amount: String(amount) }))}
                      className="h-16"
                      data-testid={`button-amount-${amount}`}
                    >
                      ₪{amount}
                    </Button>
                  ))}
                </div>
                
                <div>
                  <Label>{t('giftCards.customAmount', language)}</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder={t('giftCards.enterAmount', language)}
                    min="10"
                    required
                    data-testid="input-custom-amount"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Recipient Details */}
            <Card className="luxury-glass-card luxury-shadow-lg">
              <CardHeader>
                <CardTitle className="luxury-heading-sm flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {t('giftCards.recipientDetails', language)}
                </CardTitle>
                <CardDescription>
                  {t('giftCards.recipientQuestion', language)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t('giftCards.recipientName', language)} *</Label>
                  <Input
                    value={formData.recipientName}
                    onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                    placeholder={language === 'he' ? 'ישראל ישראלי' : language === 'ar' ? 'الاسم الكامل' : 'Full name'}
                    autoComplete="name"
                    className="luxury-glass-minimal"
                    required
                    data-testid="input-recipient-name"
                  />
                </div>

                <div>
                  <Label>{t('giftCards.recipientEmail', language)} *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="email"
                      value={formData.recipientEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                      placeholder="email@example.com"
                      autoComplete="email"
                      className="luxury-glass-minimal pl-10"
                      required
                      data-testid="input-recipient-email"
                    />
                  </div>
                </div>

                <div>
                  <Label>{t('giftCards.recipientPhone', language)}</Label>
                  <PhoneInput
                    value={formData.recipientPhone}
                    onChange={(value) => setFormData(prev => ({ ...prev, recipientPhone: value }))}
                    language={language === 'he' ? 'he' : 'en'}
                    defaultCountry="IL"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Redemption Location - Google Autocomplete */}
            <Card className="luxury-glass-card luxury-shadow-lg">
              <CardHeader>
                <CardTitle className="luxury-heading-sm flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  {t('giftCards.redemptionLocation', language)}
                </CardTitle>
                <CardDescription>
                  {t('giftCards.redemptionQuestion', language)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t('giftCards.fullAddress', language)} *</Label>
                  <GooglePlacesAutocomplete
                    value={formData.address}
                    onChange={handleAddressChange}
                    onPlaceSelected={handlePlaceSelected}
                    placeholder={t('giftCards.addressPlaceholder', language)}
                    className="w-full"
                    country={['il', 'us', 'gb', 'au', 'ca']}
                    required
                  />
                  {formData.address && (
                    <p className="text-sm text-gray-600 mt-2">
                      ✓ {formData.address}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('giftCards.city', language)}</Label>
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="Tel Aviv"
                      data-testid="input-city"
                    />
                  </div>
                  <div>
                    <Label>{t('giftCards.postcode', language)} *</Label>
                    <Input
                      value={formData.postcode}
                      onChange={(e) => setFormData(prev => ({ ...prev, postcode: e.target.value }))}
                      placeholder="12345"
                      required
                      data-testid="input-postcode"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personal Message */}
            <Card className="luxury-glass-card luxury-shadow-lg">
              <CardHeader>
                <CardTitle className="luxury-heading-sm">{t('giftCards.personalMessage', language)}</CardTitle>
                <CardDescription>
                  {t('giftCards.messageDesc', language)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder={t('giftCards.messagePlaceholder', language)}
                  rows={4}
                  maxLength={500}
                  data-testid="textarea-message"
                />
                <p className="text-sm text-gray-500 mt-2">
                  {formData.message.length}/500 {t('giftCards.characters', language)}
                </p>
              </CardContent>
            </Card>

            {/* Delivery Date */}
            <Card className="luxury-glass-card luxury-shadow-lg">
              <CardHeader>
                <CardTitle className="luxury-heading-sm flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {t('giftCards.deliveryDate', language)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <NativeDateSelect
                  value={formData.deliveryDate}
                  onChange={(date) => setFormData(prev => ({ ...prev, deliveryDate: date }))}
                  language={language}
                  minYear={new Date().getFullYear()}
                  maxYear={new Date().getFullYear() + 1}
                />
              </CardContent>
            </Card>

            {/* Sender Info (Optional) */}
            <Card className="luxury-glass-card luxury-shadow-lg">
              <CardHeader>
                <CardTitle className="luxury-heading-sm">{t('giftCards.yourDetails', language)}</CardTitle>
                <CardDescription>
                  {t('giftCards.anonymousGift', language)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t('giftCards.yourName', language)}</Label>
                  <Input
                    value={formData.senderName}
                    onChange={(e) => setFormData(prev => ({ ...prev, senderName: e.target.value }))}
                    placeholder={language === 'he' ? 'אנונימי' : language === 'ar' ? 'مجهول' : 'Anonymous'}
                    autoComplete="name"
                    data-testid="input-sender-name"
                  />
                </div>
                <div>
                  <Label>{t('giftCards.yourEmail', language)}</Label>
                  <Input
                    type="email"
                    value={formData.senderEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, senderEmail: e.target.value }))}
                    placeholder={language === 'he' ? 'לשליחת אישור' : language === 'ar' ? 'للتأكيد' : 'For confirmation'}
                    autoComplete="email"
                    data-testid="input-sender-email"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-semibold text-lg"
              data-testid="button-purchase-gift-card"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Gift className="w-5 h-5 mr-2" />
                  {t('giftCards.continuePayment', language)} - ₪{formData.amount || '0'}
                </>
              )}
            </Button>
          </form>

          {/* Legal Notice */}
          <div className="mt-8 p-4 bg-white rounded-lg text-sm text-gray-600">
            <p className="font-semibold mb-2">
              {t('giftCards.terms', language)}
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('giftCards.term1', language)}</li>
              <li>{t('giftCards.term2', language)}</li>
              <li>{t('giftCards.term3', language)}</li>
              <li>{t('giftCards.term4', language)}</li>
            </ul>
          </div>
        </div>
      </main>
      </div>
    </Layout>
  );
}
