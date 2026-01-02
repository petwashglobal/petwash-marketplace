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
import { Gift, Mail, User, Shield, Crown, Check, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const eGiftFormSchema = z.object({
  amount: z.coerce.number().min(10, "Minimum ₪10").max(5000, "Maximum ₪5,000"),
  recipientEmail: z.string().email("Valid email required"),
  recipientName: z.string().min(1, "Recipient name required"),
  purchaserEmail: z.string().email("Valid email required"),
  message: z.string().max(200, "Maximum 200 characters").optional(),
  theme: z.enum(['platinum', 'classic', 'minimal']).default('platinum')
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
      theme: 'platinum'
    }
  });

  const createVoucherMutation = useMutation({
    mutationFn: async (data: EGiftFormData) => {
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
        title: "Gift Card Created",
        description: `Successfully created ₪${form.getValues('amount')} gift card for ${form.getValues('recipientName')}`,
      });
      
      form.reset();
      setTimeout(() => setLocation('/vouchers'), 2000);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Failed to create gift card. Please try again."
      });
    }
  });

  const onSubmit = (data: EGiftFormData) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to send gift cards."
      });
      setLocation('/signin');
      return;
    }
    
    createVoucherMutation.mutate(data);
  };

  const suggestedAmounts = [50, 100, 200, 500];

  const getCardStyle = (theme: string) => {
    switch (theme) {
      case 'platinum':
        return 'bg-black text-white';
      case 'classic':
        return 'bg-white text-black border-2 border-black';
      case 'minimal':
        return 'bg-white text-black border border-black border-opacity-20';
      default:
        return 'bg-black text-white';
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <div className="relative bg-black text-white py-16 md:py-20 overflow-hidden">
                    
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 border border-white border-opacity-30 rounded-full mb-6">
                <Gift className="w-4 h-4" />
                <span className="text-sm font-medium tracking-widest uppercase">Digital Gift Cards</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-4">
                Give the Gift of
                <span className="block font-bold">Premium Pet Care</span>
              </h1>
              
              <p className="text-lg text-white opacity-70 max-w-xl mx-auto">
                Luxury digital gift cards with QR codes and bank-level security.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            
            {/* Form Section */}
            <div>
              <h2 className="text-2xl font-bold mb-8">Create Your Gift Card</h2>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  
                  {/* Amount Selection */}
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-bold uppercase tracking-wider">
                          Select Amount
                        </FormLabel>
                        <div className="space-y-4">
                          <div className="grid grid-cols-4 gap-3">
                            {suggestedAmounts.map((amount) => (
                              <button
                                key={amount}
                                type="button"
                                className={`
                                  py-4 rounded-xl font-bold text-lg transition-all duration-200
                                  ${field.value === amount 
                                    ? 'bg-black text-white shadow-lg' 
                                    : 'bg-white text-black border-2 border-black border-opacity-10 hover:border-opacity-100'
                                  }
                                `}
                                onClick={() => field.onChange(amount)}
                                data-testid={`button-amount-${amount}`}
                              >
                                ₪{amount}
                              </button>
                            ))}
                          </div>
                          <FormControl>
                            <Input
                              type="number"
                              min="10"
                              max="5000"
                              className="h-14 text-lg border-2 border-black border-opacity-10 focus:border-opacity-100 rounded-xl"
                              placeholder="Or enter custom amount..."
                              data-testid="input-custom-amount"
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Card Design */}
                  <FormField
                    control={form.control}
                    name="theme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-bold uppercase tracking-wider">
                          Card Design
                        </FormLabel>
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { id: 'platinum', name: 'Platinum', bg: 'bg-black', text: 'text-white' },
                            { id: 'classic', name: 'Classic', bg: 'bg-white border-2 border-black', text: 'text-black' },
                            { id: 'minimal', name: 'Minimal', bg: 'bg-white border border-black border-opacity-20', text: 'text-black' }
                          ].map((theme) => (
                            <button
                              key={theme.id}
                              type="button"
                              className={`
                                relative p-4 rounded-xl aspect-[4/3] flex flex-col items-center justify-center
                                transition-all duration-200 ${theme.bg} ${theme.text}
                                ${field.value === theme.id ? 'ring-4 ring-black ring-offset-2' : ''}
                              `}
                              onClick={() => field.onChange(theme.id)}
                              data-testid={`button-theme-${theme.id}`}
                            >
                              <span className="font-bold text-sm">{theme.name}</span>
                              {field.value === theme.id && (
                                <div className="absolute top-2 right-2">
                                  <Check className="w-4 h-4" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Recipient Details */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="recipientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Recipient Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="h-14 border-2 border-black border-opacity-10 focus:border-opacity-100 rounded-xl"
                              placeholder="Who's the lucky pet parent?"
                              data-testid="input-recipient-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="recipientEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Recipient Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              className="h-14 border-2 border-black border-opacity-10 focus:border-opacity-100 rounded-xl"
                              placeholder="friend@example.com"
                              data-testid="input-recipient-email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="purchaserEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Your Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              className="h-14 border-2 border-black border-opacity-10 focus:border-opacity-100 rounded-xl"
                              placeholder="your@example.com"
                              data-testid="input-purchaser-email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Personal Message */}
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-bold uppercase tracking-wider">
                          Personal Message (Optional)
                        </FormLabel>
                        <FormControl>
                          <textarea
                            className="w-full min-h-[120px] p-4 border-2 border-black border-opacity-10 focus:border-opacity-100 rounded-xl resize-none transition-colors"
                            placeholder="Add a heartfelt message..."
                            maxLength={200}
                            data-testid="textarea-message"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-right">
                          {field.value?.length || 0}/200
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit */}
                  <div className="pt-4">
                    <div className="bg-black bg-opacity-5 rounded-2xl p-6 mb-6">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-black opacity-60">Total</span>
                        <span className="text-3xl font-bold">₪{form.watch('amount')}</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-sm text-black opacity-50">
                        <Shield className="w-4 h-4" />
                        <span>Secured by Nayax - Bank-level encryption</span>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-16 bg-black text-white hover:bg-opacity-80 rounded-xl text-lg font-bold"
                      disabled={createVoucherMutation.isPending}
                      data-testid="button-send-egift"
                    >
                      {createVoucherMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Gift className="w-5 h-5" />
                          Send Gift Card
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>

            {/* Preview Section */}
            <div className="lg:sticky lg:top-8 space-y-8">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4">Live Preview</h3>
                
                {/* Gift Card Preview */}
                <div 
                  className={`
                    relative rounded-2xl aspect-[1.6/1] p-8 flex flex-col justify-between
                    shadow-2xl transition-all duration-300
                    ${getCardStyle(form.watch('theme'))}
                  `}
                  data-testid="voucher-preview-card"
                >
                  {/* Card Pattern */}
                  <div className="absolute inset-0 rounded-2xl overflow-hidden opacity-10">
                    <div className="absolute inset-0" style={{
                      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, ${form.watch('theme') === 'platinum' ? 'white' : 'black'} 10px, ${form.watch('theme') === 'platinum' ? 'white' : 'black'} 11px)`
                    }}></div>
                  </div>

                  {/* Top */}
                  <div className="relative flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold tracking-widest uppercase opacity-60">Pet Wash</p>
                      <p className="text-xs opacity-40">Digital Gift Card</p>
                    </div>
                    <Sparkles className="w-6 h-6 opacity-60" />
                  </div>

                  {/* Center - Amount */}
                  <div className="relative text-center">
                    <p className="text-5xl md:text-6xl font-black tracking-tight">
                      ₪{form.watch('amount')}
                    </p>
                  </div>

                  {/* Bottom */}
                  <div className="relative flex justify-between items-end">
                    <div>
                      <p className="text-xs opacity-40 mb-1">FOR</p>
                      <p className="font-bold truncate max-w-[150px]">
                        {form.watch('recipientName') || 'Recipient Name'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-40 mb-1">VALID</p>
                      <p className="font-bold">2 Years</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="bg-black bg-opacity-5 rounded-2xl p-6">
                <h4 className="font-bold mb-4">Every Gift Card Includes</h4>
                <ul className="space-y-3">
                  {[
                    'Unique QR code for easy redemption',
                    'SHA-256 cryptographic security',
                    'Valid for 2 years from purchase',
                    'Usable at any Pet Wash station',
                    'Digital delivery via email',
                    'Apple Wallet compatible'
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="bg-black text-white py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Crown className="w-12 h-12 mx-auto mb-6 opacity-60" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              The Perfect Gift for Pet Lovers
            </h2>
            <p className="text-white opacity-60 max-w-xl mx-auto">
              Premium organic pet care, beautifully packaged in a digital gift card.
              Valid at all Pet Wash stations nationwide.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
