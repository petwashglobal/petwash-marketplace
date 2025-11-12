import { useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { type Language, t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GooglePlacesAutocomplete } from "@/components/ui/google-places-autocomplete";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Gift, MapPin, Mail, User, Calendar, DollarSign } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BuyGiftCardProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

export default function BuyGiftCard({ language, onLanguageChange }: BuyGiftCardProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  
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

  const predefinedAmounts = [50, 100, 200, 500, 1000];

  const handleAddressSelect = (addressData: {
    fullAddress: string;
    street?: string;
    city?: string;
    postcode?: string;
    country?: string;
  }) => {
    setFormData(prev => ({
      ...prev,
      address: addressData.fullAddress,
      city: addressData.city || prev.city,
      postcode: addressData.postcode || prev.postcode,
      country: addressData.country || prev.country,
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
      const response = await fetch('/api/gift-cards/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to purchase gift card');
      }

      const data = await response.json();
      
      toast({
        title: t('common.success', language),
        description: t('giftCards.purchaseSuccess', language),
      });

      // Redirect to payment page
      navigate(`/payment/gift-card/${data.voucherId}`);
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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-pink-50 via-white to-purple-50" dir={language === "he" || language === "ar" ? "rtl" : "ltr"}>
      <Header language={language} onLanguageChange={onLanguageChange} />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Gift className="w-16 h-16 mx-auto mb-4 text-pink-600" />
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {t('giftCards.buyTitle', language)}
            </h1>
            <p className="text-gray-600">
              {t('giftCards.subtitle', language)}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Gift Amount */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                    placeholder="John Doe"
                    autoComplete="name"
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
                      className="pl-10"
                      required
                      data-testid="input-recipient-email"
                    />
                  </div>
                </div>

                <div>
                  <Label>{t('giftCards.recipientPhone', language)}</Label>
                  <Input
                    type="tel"
                    value={formData.recipientPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, recipientPhone: e.target.value }))}
                    placeholder="050-123-4567"
                    autoComplete="tel"
                    data-testid="input-recipient-phone"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Redemption Location - Google Autocomplete */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                    onSelect={handleAddressSelect}
                    placeholder={t('giftCards.addressPlaceholder', language)}
                    className="w-full"
                    data-testid="input-address-autocomplete"
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
            <Card>
              <CardHeader>
                <CardTitle>{t('giftCards.personalMessage', language)}</CardTitle>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {t('giftCards.deliveryDate', language)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, deliveryDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  data-testid="input-delivery-date"
                />
              </CardContent>
            </Card>

            {/* Sender Info (Optional) */}
            <Card>
              <CardHeader>
                <CardTitle>{t('giftCards.yourDetails', language)}</CardTitle>
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
                    placeholder="Anonymous"
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
                    placeholder="For confirmation"
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
          <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
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

      <Footer language={language} />
    </div>
  );
}
