import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift, Heart, Sparkles, CreditCard, Mail, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// E-Gift form schema matching backend validation
const eGiftFormSchema = z.object({
  amount: z.coerce.number().min(10, "Minimum ₪10").max(5000, "Maximum ₪5,000"),
  recipientEmail: z.string().email("Valid email required"),
  recipientName: z.string().min(1, "Recipient name required"),
  purchaserEmail: z.string().email("Valid email required"),
  message: z.string().max(200, "Maximum 200 characters").optional()
});

type EGiftFormData = z.infer<typeof eGiftFormSchema>;

export default function EGift() {
  const [, navigate] = useNavigate();
  const { user } = useFirebaseAuth();
  const { toast } = useToast();

  const form = useForm<EGiftFormData>({
    resolver: zodResolver(eGiftFormSchema),
    defaultValues: {
      amount: 100,
      recipientEmail: '',
      recipientName: '',
      purchaserEmail: user?.email || '',
      message: ''
    }
  });

  const createVoucherMutation = useMutation({
    mutationFn: async (data: EGiftFormData) => {
      return await apiRequest('/api/gift-cards', {
        method: 'POST',
        body: JSON.stringify({
          type: 'STORED_VALUE',
          currency: 'ILS',
          initialAmount: data.amount,
          remainingAmount: data.amount,
          status: 'ISSUED',
          purchaserEmail: data.purchaserEmail,
          recipientEmail: data.recipientEmail,
          purchaserUid: user?.uid || null,
          expiresAt: null // No expiration
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "🎉 E-Gift Card Sent!",
        description: `Successfully sent ₪${form.getValues('amount')} gift card to ${form.getValues('recipientEmail')}`,
      });
      
      form.reset();
      setTimeout(() => navigate('/hub'), 2000);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "❌ Purchase Failed",
        description: error.message || "Failed to send e-gift card. Please try again."
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
              Digital Pet Wash™ E-Gifts
            </h1>
            <Heart className="w-10 h-10 sm:w-12 sm:h-12 text-purple-600" />
          </div>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Send instant love to pet parents - Perfect for birthdays, holidays, or just because! 💝🐾
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
          {/* E-Gift Form */}
          <Card className="border-2 border-purple-200 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Create E-Gift Card
              </CardTitle>
              <CardDescription>
                Instant delivery via email - No physical card needed!
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
                        <Gift className="w-5 h-5 mr-2" />
                        Send E-Gift Card (₪{form.watch('amount')})
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Benefits Section */}
          <div className="space-y-6">
            <Card className="border-2 border-pink-200">
              <CardHeader className="bg-gradient-to-r from-pink-50 to-rose-50">
                <CardTitle className="text-pink-700">Why E-Gift Cards?</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <p className="font-semibold">Instant Delivery</p>
                      <p className="text-sm text-gray-600">Arrives in seconds via email</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-2xl">🎁</span>
                    <div>
                      <p className="font-semibold">Perfect for Any Occasion</p>
                      <p className="text-sm text-gray-600">Birthdays, holidays, thank you gifts</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-2xl">🌍</span>
                    <div>
                      <p className="font-semibold">Works Everywhere</p>
                      <p className="text-sm text-gray-600">Valid at all Pet Wash stations & services</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-2xl">🔒</span>
                    <div>
                      <p className="font-semibold">Secure & Reliable</p>
                      <p className="text-sm text-gray-600">Tracked in your account, never expires</p>
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
