import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift, Heart, Sparkles, CreditCard, Mail, User, Smartphone, CheckCircle2, Shield } from 'lucide-react';
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
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const { toast } = useToast();

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
      setTimeout(() => setLocation('/vouchers'), 2000);
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
      setLocation('/signin');
      return;
    }
    
    createVoucherMutation.mutate(data);
  };

  const suggestedAmounts = [50, 100, 200, 500];

  return (
    <Layout>
    <div className="min-h-screen luxury-bg-purple-fade relative overflow-hidden">
      <div className="luxury-container py-8 sm:py-12 lg:py-16 relative z-10">
        {/* Luxury Header Section */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16 luxury-animate-fade-in">
          {/* Premium Badge */}
          <div className="inline-flex items-center justify-center mb-4 sm:mb-6 luxury-animate-scale-in">
            <span className="luxury-badge luxury-badge-gold">
              7-STAR LUXURY VOUCHERS
            </span>
          </div>

          {/* Main Title */}
          <h1 className="luxury-heading-xl mb-4 sm:mb-6 px-4 luxury-animate-slide-up luxury-delay-1">
            Pet Wash™ Digital Gifts
          </h1>
          
          {/* Subtitle */}
          <p className="luxury-text-body max-w-3xl mx-auto mb-2 sm:mb-4 px-4 luxury-animate-slide-up luxury-delay-2">
            Premium luxury vouchers with metallic themes, QR codes, and SHA256 security
          </p>
          
          {/* CTA Badge */}
          <button className="luxury-btn-primary luxury-shadow-xl luxury-animate-slide-up luxury-delay-3">
            <Sparkles className="w-4 h-4 inline mr-2" />
            Start Creating Your Luxury Gift
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 luxury-animate-fade-in luxury-delay-4">
          {/* E-Gift Form */}
          <Card className="luxury-glass-card luxury-shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50">
              <CardTitle className="luxury-heading-sm flex items-center gap-2">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                Create 7-Star Voucher
              </CardTitle>
              <CardDescription className="luxury-text-small">
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
                        <FormLabel className="luxury-heading-sm">
                          Gift Amount (<span className="luxury-text-gradient">₪</span>)
                        </FormLabel>
                        <div className="luxury-glass-card p-4 luxury-shadow-md">
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            {suggestedAmounts.map((amount) => (
                              <Button
                                key={amount}
                                type="button"
                                variant={field.value === amount ? "default" : "outline"}
                                className={`h-12 text-lg font-bold transition-all ${
                                  field.value === amount 
                                    ? 'luxury-badge luxury-badge-gold luxury-shadow-md border-2 border-amber-400' 
                                    : 'luxury-badge hover:luxury-shadow-sm'
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
                              className="h-12 text-lg luxury-glass-minimal"
                              placeholder="Custom amount"
                              data-testid="input-custom-amount"
                              {...field}
                            />
                          </FormControl>
                        </div>
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
                        <FormLabel className="luxury-heading-sm flex items-center gap-2">
                          <User className="w-4 h-4 text-purple-600" />
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
                        <FormLabel className="luxury-heading-sm flex items-center gap-2">
                          <Mail className="w-4 h-4 text-purple-600" />
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
                        <FormLabel className="luxury-heading-sm flex items-center gap-2">
                          <Mail className="w-4 h-4 text-purple-600" />
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

                  {/* Theme Selection - Gift Card Design Options */}
                  <FormField
                    control={form.control}
                    name="theme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="luxury-heading-sm">
                          Select Gift Card Design
                        </FormLabel>
                        <div className="luxury-grid-3 gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className={`luxury-glass-card luxury-hover-glow h-24 flex flex-col items-center justify-center transition-all ${
                              field.value === 'neo_black_platinum' 
                                ? 'luxury-shadow-lg border-4 border-purple-600 luxury-hover-glow bg-gradient-to-br from-gray-900 to-gray-700 text-white' 
                                : 'luxury-shadow-md hover:luxury-shadow-lg'
                            }`}
                            onClick={() => field.onChange('neo_black_platinum')}
                            data-testid="button-theme-platinum"
                          >
                            <span className="text-sm font-bold">Black</span>
                            <span className="text-xs opacity-80">Platinum</span>
                            {field.value === 'neo_black_platinum' && (
                              <span className="text-xl mt-1">✨</span>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className={`luxury-glass-card luxury-hover-glow h-24 flex flex-col items-center justify-center transition-all ${
                              field.value === 'neo_emerald' 
                                ? 'luxury-shadow-lg border-4 border-purple-600 luxury-hover-glow bg-gradient-to-br from-emerald-700 to-emerald-500 text-white' 
                                : 'luxury-shadow-md hover:luxury-shadow-lg'
                            }`}
                            onClick={() => field.onChange('neo_emerald')}
                            data-testid="button-theme-emerald"
                          >
                            <span className="text-sm font-bold">Emerald</span>
                            <span className="text-xs opacity-80">Luxury</span>
                            {field.value === 'neo_emerald' && (
                              <span className="text-xl mt-1">✨</span>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className={`luxury-glass-card luxury-hover-glow h-24 flex flex-col items-center justify-center transition-all ${
                              field.value === 'neo_silver' 
                                ? 'luxury-shadow-lg border-4 border-purple-600 luxury-hover-glow bg-gradient-to-br from-gray-400 to-gray-300 text-gray-900' 
                                : 'luxury-shadow-md hover:luxury-shadow-lg'
                            }`}
                            onClick={() => field.onChange('neo_silver')}
                            data-testid="button-theme-silver"
                          >
                            <span className="text-sm font-bold">Silver</span>
                            <span className="text-xs opacity-80">Classic</span>
                            {field.value === 'neo_silver' && (
                              <span className="text-xl mt-1">✨</span>
                            )}
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
                        <FormLabel className="luxury-heading-sm">Personal Message (Optional)</FormLabel>
                        <FormControl>
                          <textarea
                            className="w-full min-h-[100px] p-3 luxury-glass-minimal focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
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

                  {/* Checkout Summary - Payment Methods */}
                  <div className="luxury-glass-card luxury-shadow-xl p-5 space-y-4">
                    <div>
                      <h3 className="luxury-heading-sm mb-3 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                        Checkout Summary
                      </h3>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center luxury-text-body">
                        <span>Gift Amount:</span>
                        <span className="luxury-text-gradient font-bold">₪{form.watch('amount')}</span>
                      </div>
                      <div className="luxury-divider my-2"></div>
                      <div className="flex justify-between items-center">
                        <span className="luxury-heading-lg">Total:</span>
                        <span className="luxury-heading-lg luxury-text-gradient">₪{form.watch('amount')}</span>
                      </div>
                    </div>

                    <div className="flex justify-center mt-4">
                      <div className="luxury-badge luxury-badge-success">
                        <Shield className="w-4 h-4" />
                        <span>Secure Payment Gateway</span>
                      </div>
                    </div>

                    <p className="luxury-text-small text-center opacity-75">
                      🔒 Secured by Nayax • Bank-level encryption
                    </p>
                  </div>

                  {/* Submit Button - Premium */}
                  <Button
                    type="submit"
                    size="lg"
                    className="luxury-btn-primary luxury-shadow-xl w-full h-16 text-xl font-bold"
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
          <div className="space-y-6 luxury-animate-fade-in luxury-delay-5">
            {/* Live Voucher Preview Card */}
            <Card className="luxury-glass-card luxury-hover-glow luxury-shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50">
                <CardTitle className="luxury-heading-sm text-purple-700 flex items-center gap-2">
                  <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
                  Live Preview
                </CardTitle>
                <CardDescription className="luxury-text-small">See your voucher in real-time</CardDescription>
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

            <Card className="luxury-glass-card luxury-hover-glow luxury-shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-pink-50 to-rose-50">
                <CardTitle className="luxury-heading-sm text-pink-700">7-Star Features</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="space-y-4">
                  <li className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white flex-shrink-0">
                      💎
                    </div>
                    <div>
                      <p className="luxury-heading-sm text-sm">Metallic Themes</p>
                      <p className="luxury-text-small">Choose from Platinum, Emerald, or Silver</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white flex-shrink-0">
                      🔒
                    </div>
                    <div>
                      <p className="luxury-heading-sm text-sm">SHA256 Security</p>
                      <p className="luxury-text-small">Military-grade encryption & JWS signing</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white flex-shrink-0">
                      📱
                    </div>
                    <div>
                      <p className="luxury-heading-sm text-sm">QR Code Ready</p>
                      <p className="luxury-text-small">Instant redemption at any station</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white flex-shrink-0">
                      📊
                    </div>
                    <div>
                      <p className="luxury-heading-sm text-sm">Usage Tracking</p>
                      <p className="luxury-text-small">Full redemption history & analytics</p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="luxury-glass-card luxury-hover-glow luxury-shadow-lg overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="luxury-heading-sm mb-2">Secure Payment</h3>
                  <p className="luxury-text-small">
                    Powered by Nayax Payment Gateway with bank-level encryption
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 text-center luxury-animate-fade-in">
          <p className="luxury-text-body mb-6">Trusted by thousands of pet parents</p>
          <div className="flex flex-wrap justify-center gap-6">
            <div className="luxury-glass-minimal p-4 flex flex-col items-center gap-2 min-w-[140px] luxury-hover-lift">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-xl">
                🔒
              </div>
              <span className="luxury-text-small font-semibold">SSL Encrypted</span>
            </div>
            <div className="luxury-glass-minimal p-4 flex flex-col items-center gap-2 min-w-[140px] luxury-hover-lift">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white text-xl">
                ✅
              </div>
              <span className="luxury-text-small font-semibold">Israeli Registered</span>
            </div>
            <div className="luxury-glass-minimal p-4 flex flex-col items-center gap-2 min-w-[140px] luxury-hover-lift">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center text-white text-xl">
                🌿
              </div>
              <span className="luxury-text-small font-semibold">Organic Products</span>
            </div>
            <div className="luxury-glass-minimal p-4 flex flex-col items-center gap-2 min-w-[140px] luxury-hover-lift">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-600 to-yellow-600 flex items-center justify-center text-white text-xl">
                ⭐
              </div>
              <span className="luxury-text-small font-semibold">5-Star Rated</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
}
