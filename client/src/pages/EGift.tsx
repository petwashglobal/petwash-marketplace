import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift, Heart, Sparkles, CreditCard, Mail, User, Smartphone, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Voucher 2025 form schema
const eGiftFormSchema = z.object({
  amount: z.coerce.number().min(10, "Minimum ₪10").max(5000, "Maximum ₪5,000"),
  recipientEmail: z.string().email("Valid email required"),
  recipientName: z.string().min(1, "Recipient name required"),
  purchaserEmail: z.string().email("Valid email required"),
  message: z.string().max(200, "Maximum 200 characters").optional(),
  theme: z.enum(['neo_black_platinum', 'neo_emerald', 'neo_silver']).default('neo_emerald')
});

type EGiftFormData = z.infer<typeof eGiftFormSchema>;

export default function EGift() {
  const [, navigate] = useNavigate();
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const [selectedPayment, setSelectedPayment] = useState<string>('apple_pay');

  const form = useForm<EGiftFormData>({
    resolver: zodResolver(eGiftFormSchema),
    defaultValues: {
      amount: 100,
      recipientEmail: '',
      recipientName: '',
      purchaserEmail: user?.email || '',
      message: '',
      theme: 'neo_emerald'
    }
  });

  const createVoucherMutation = useMutation({
    mutationFn: async (data: EGiftFormData) => {
      // Calculate expiration date (2 years from now for premium vouchers)
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 2);
      
      return await apiRequest('/api/vouchers-2025/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'egift',
          value_type: 'currency',
          value: data.amount,
          washes: 0,
          currency: 'ILS',
          expires_at: expiresAt.toISOString(),
          theme: data.theme,
          recipient_name: data.recipientName,
          recipient_email: data.recipientEmail,
          purchaser_email: data.purchaserEmail,
          message: data.message || ''
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "✨ 7-Star Voucher Created!",
        description: `Successfully created luxury ₪${form.getValues('amount')} voucher for ${form.getValues('recipientName')}`,
      });
      
      form.reset();
      setTimeout(() => navigate('/vouchers'), 2000);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "❌ Creation Failed",
        description: error.message || "Failed to create voucher. Please try again."
      });
    }
  });

  const onSubmit = (data: EGiftFormData) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to send e-gift cards."
      });
      navigate('/signin');
      return;
    }
    
    createVoucherMutation.mutate(data);
  };

  const suggestedAmounts = [50, 100, 200, 500];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <Gift className="w-10 h-10 sm:w-12 sm:h-12 text-pink-600" />
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
              Pet Wash™ 7-Star Vouchers
            </h1>
            <Heart className="w-10 h-10 sm:w-12 sm:h-12 text-purple-600" />
          </div>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Premium luxury vouchers with metallic themes, QR codes, and SHA256 security 💎🔒
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
          {/* E-Gift Form */}
          <Card className="border-2 border-purple-200 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Create 7-Star Voucher
              </CardTitle>
              <CardDescription>
                Luxury digital voucher with metallic themes & enhanced security
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Amount Selection */}
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">
                          Gift Amount (₪)
                        </FormLabel>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {suggestedAmounts.map((amount) => (
                            <Button
                              key={amount}
                              type="button"
                              variant={field.value === amount ? "default" : "outline"}
                              className={`h-12 text-lg font-bold ${
                                field.value === amount 
                                  ? 'bg-gradient-to-r from-pink-600 to-purple-600' 
                                  : ''
                              }`}
                              onClick={() => field.onChange(amount)}
                              data-testid={`button-amount-${amount}`}
                            >
                              ₪{amount}
                            </Button>
                          ))}
                        </div>
                        <FormControl>
                          <Input
                            type="number"
                            min="10"
                            max="5000"
                            className="h-12 text-lg"
                            placeholder="Custom amount"
                            data-testid="input-custom-amount"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Recipient Name */}
                  <FormField
                    control={form.control}
                    name="recipientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Recipient Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="h-12"
                            placeholder="Who's the lucky pet parent?"
                            data-testid="input-recipient-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Recipient Email */}
                  <FormField
                    control={form.control}
                    name="recipientEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Recipient Email
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            className="h-12"
                            placeholder="friend@example.com"
                            data-testid="input-recipient-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Your Email */}
                  <FormField
                    control={form.control}
                    name="purchaserEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Your Email
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            className="h-12"
                            placeholder="your@example.com"
                            data-testid="input-purchaser-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Theme Selection */}
                  <FormField
                    control={form.control}
                    name="theme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">
                          Card Theme
                        </FormLabel>
                        <div className="grid grid-cols-3 gap-3">
                          <Button
                            type="button"
                            variant={field.value === 'neo_black_platinum' ? "default" : "outline"}
                            className={`h-20 flex flex-col items-center justify-center ${
                              field.value === 'neo_black_platinum' 
                                ? 'bg-gradient-to-br from-gray-900 to-gray-700 text-white' 
                                : ''
                            }`}
                            onClick={() => field.onChange('neo_black_platinum')}
                            data-testid="button-theme-platinum"
                          >
                            <span className="text-xs font-bold">Black</span>
                            <span className="text-xs">Platinum</span>
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === 'neo_emerald' ? "default" : "outline"}
                            className={`h-20 flex flex-col items-center justify-center ${
                              field.value === 'neo_emerald' 
                                ? 'bg-gradient-to-br from-emerald-700 to-emerald-500 text-white' 
                                : ''
                            }`}
                            onClick={() => field.onChange('neo_emerald')}
                            data-testid="button-theme-emerald"
                          >
                            <span className="text-xs font-bold">Emerald</span>
                            <span className="text-xs">Luxury</span>
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === 'neo_silver' ? "default" : "outline"}
                            className={`h-20 flex flex-col items-center justify-center ${
                              field.value === 'neo_silver' 
                                ? 'bg-gradient-to-br from-gray-400 to-gray-300 text-gray-900' 
                                : ''
                            }`}
                            onClick={() => field.onChange('neo_silver')}
                            data-testid="button-theme-silver"
                          >
                            <span className="text-xs font-bold">Silver</span>
                            <span className="text-xs">Classic</span>
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Personal Message */}
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal Message (Optional)</FormLabel>
                        <FormControl>
                          <textarea
                            className="w-full min-h-[100px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                            placeholder="Add a heartfelt message... 💝"
                            maxLength={200}
                            data-testid="textarea-message"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {field.value?.length || 0}/200 characters
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Payment Method Selection - 7-Star Luxury */}
                  <div className="space-y-4 pt-4 border-t-2 border-purple-100">
                    <div>
                      <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                        Choose Payment Method
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {/* Apple Pay */}
                      <button
                        type="button"
                        onClick={() => setSelectedPayment('apple_pay')}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          selectedPayment === 'apple_pay'
                            ? 'border-black bg-gradient-to-br from-gray-900 to-black text-white shadow-lg'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        data-testid="button-payment-apple-pay"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Smartphone className="w-6 h-6" />
                          <span className="text-sm font-bold">Apple Pay</span>
                        </div>
                        {selectedPayment === 'apple_pay' && (
                          <CheckCircle2 className="absolute top-2 right-2 w-5 h-5 text-green-400" />
                        )}
                      </button>

                      {/* Google Pay */}
                      <button
                        type="button"
                        onClick={() => setSelectedPayment('google_pay')}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          selectedPayment === 'google_pay'
                            ? 'border-blue-500 bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        data-testid="button-payment-google-pay"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Smartphone className="w-6 h-6" />
                          <span className="text-sm font-bold">Google Pay</span>
                        </div>
                        {selectedPayment === 'google_pay' && (
                          <CheckCircle2 className="absolute top-2 right-2 w-5 h-5 text-green-400" />
                        )}
                      </button>

                      {/* Visa */}
                      <button
                        type="button"
                        onClick={() => setSelectedPayment('visa')}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          selectedPayment === 'visa'
                            ? 'border-blue-600 bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        data-testid="button-payment-visa"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <CreditCard className="w-6 h-6" />
                          <span className="text-sm font-bold">Visa</span>
                        </div>
                        {selectedPayment === 'visa' && (
                          <CheckCircle2 className="absolute top-2 right-2 w-5 h-5 text-green-400" />
                        )}
                      </button>

                      {/* Mastercard */}
                      <button
                        type="button"
                        onClick={() => setSelectedPayment('mastercard')}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          selectedPayment === 'mastercard'
                            ? 'border-red-500 bg-gradient-to-br from-red-600 to-orange-500 text-white shadow-lg'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        data-testid="button-payment-mastercard"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <CreditCard className="w-6 h-6" />
                          <span className="text-sm font-bold">Mastercard</span>
                        </div>
                        {selectedPayment === 'mastercard' && (
                          <CheckCircle2 className="absolute top-2 right-2 w-5 h-5 text-green-400" />
                        )}
                      </button>

                      {/* Amex */}
                      <button
                        type="button"
                        onClick={() => setSelectedPayment('amex')}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          selectedPayment === 'amex'
                            ? 'border-blue-400 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        data-testid="button-payment-amex"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <CreditCard className="w-6 h-6" />
                          <span className="text-sm font-bold">Amex</span>
                        </div>
                        {selectedPayment === 'amex' && (
                          <CheckCircle2 className="absolute top-2 right-2 w-5 h-5 text-green-400" />
                        )}
                      </button>

                      {/* Diners */}
                      <button
                        type="button"
                        onClick={() => setSelectedPayment('diners')}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          selectedPayment === 'diners'
                            ? 'border-indigo-500 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-lg'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        data-testid="button-payment-diners"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <CreditCard className="w-6 h-6" />
                          <span className="text-sm font-bold">Diners</span>
                        </div>
                        {selectedPayment === 'diners' && (
                          <CheckCircle2 className="absolute top-2 right-2 w-5 h-5 text-green-400" />
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-gray-500 text-center">
                      🔒 Secured by Nayax Payment Gateway • Bank-level encryption
                    </p>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-14 text-lg font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 hover:opacity-90 transition-all"
                    disabled={createVoucherMutation.isPending}
                    data-testid="button-send-egift"
                  >
                    {createVoucherMutation.isPending ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Sending Gift...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Create Luxury Voucher (₪{form.watch('amount')})
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Live Preview & Benefits Section */}
          <div className="space-y-6">
            {/* Live Voucher Preview Card */}
            <Card className="border-2 border-gradient overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
              <CardHeader>
                <CardTitle className="text-purple-700 flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Live Preview
                </CardTitle>
                <CardDescription>See your voucher in real-time</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Voucher Card Preview */}
                <div
                  className={`relative p-6 rounded-2xl shadow-2xl min-h-[280px] flex flex-col justify-between ${
                    form.watch('theme') === 'neo_black_platinum'
                      ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white'
                      : form.watch('theme') === 'neo_emerald'
                      ? 'bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 text-white'
                      : 'bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500 text-gray-900'
                  }`}
                  data-testid="voucher-preview-card"
                >
                  {/* Top Section */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-semibold opacity-90">PetWash™ Luxury</p>
                      <p className="text-xs opacity-75">7-Star Metal Card</p>
                    </div>
                    <Sparkles className="w-6 h-6 opacity-80" />
                  </div>

                  {/* Middle Section */}
                  <div className="flex-1 flex flex-col justify-center py-4">
                    <h2 className="text-2xl font-bold mb-2">E-Gift Voucher</h2>
                    <p className="text-sm opacity-90 mb-1">
                      For: {form.watch('recipientName') || 'Your Favourite Pet Parent'}
                    </p>
                    <p className="text-3xl font-black mt-2">
                      ₪{form.watch('amount') || 100}
                    </p>
                  </div>

                  {/* Bottom Section */}
                  <div className="text-xs opacity-75">
                    <p>From: {form.watch('purchaserEmail') || 'PetWash™ Member'}</p>
                    {form.watch('message') && (
                      <p className="mt-2 italic">"{form.watch('message')}"</p>
                    )}
                  </div>

                  {/* Decorative Elements */}
                  <div className="absolute bottom-4 right-4 opacity-20">
                    <Gift className="w-16 h-16" />
                  </div>
                </div>

                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500">
                    ✨ Theme: <span className="font-semibold capitalize">{form.watch('theme')?.replace('neo_', '').replace('_', ' ')}</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-pink-200">
              <CardHeader className="bg-gradient-to-r from-pink-50 to-rose-50">
                <CardTitle className="text-pink-700">7-Star Features</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="text-2xl">💎</span>
                    <div>
                      <p className="font-semibold">Metallic Themes</p>
                      <p className="text-sm text-gray-600">Choose from Platinum, Emerald, or Silver</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-2xl">🔒</span>
                    <div>
                      <p className="font-semibold">SHA256 Security</p>
                      <p className="text-sm text-gray-600">Military-grade encryption & JWS signing</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-2xl">📱</span>
                    <div>
                      <p className="font-semibold">QR Code Ready</p>
                      <p className="text-sm text-gray-600">Instant redemption at any station</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-2xl">📊</span>
                    <div>
                      <p className="font-semibold">Usage Tracking</p>
                      <p className="text-sm text-gray-600">Full redemption history & analytics</p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <CreditCard className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                  <h3 className="font-bold text-lg mb-2">Secure Payment</h3>
                  <p className="text-sm text-gray-600">
                    Powered by Nayax Payment Gateway with bank-level encryption
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 mb-4">Trusted by thousands of pet parents</p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-400">
            <span>🔒 SSL Encrypted</span>
            <span>✅ Israeli Registered Business</span>
            <span>🌿 Organic Products</span>
            <span>⭐ 5-Star Rated</span>
          </div>
        </div>
      </div>
    </div>
  );
}
