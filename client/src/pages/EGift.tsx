import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Gift, Mail, User, CreditCard, Zap, ChevronRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const eGiftFormSchema = z.object({
  washes: z.number().min(1).max(20),
  recipientEmail: z.string().email("Valid email required"),
  recipientName: z.string().min(1, "Recipient name required"),
  purchaserEmail: z.string().email("Valid email required"),
  purchaserName: z.string().min(1, "Your name required"),
  message: z.string().max(200, "Maximum 200 characters").optional(),
  cardColor: z.enum(['platinum', 'gold', 'emerald', 'rose']).default('platinum')
});

type EGiftFormData = z.infer<typeof eGiftFormSchema>;

const WASH_PRICE = 55;

const cardColors = {
  platinum: {
    name: 'Platinum Black',
    bg: 'linear-gradient(145deg, #1a1a1a 0%, #2d2d2d 25%, #1a1a1a 50%, #0a0a0a 100%)',
    text: 'text-white',
    accent: '#FFFFFF',
    chipBg: 'linear-gradient(135deg, #d4af37 0%, #f4e4a1 25%, #d4af37 50%, #aa8a2e 100%)'
  },
  gold: {
    name: 'Royal Gold',
    bg: 'linear-gradient(145deg, #d4af37 0%, #f4e4a1 25%, #d4af37 50%, #aa8a2e 100%)',
    text: 'text-white',
    accent: '#FFFFFF',
    chipBg: 'linear-gradient(135deg, #d4af37 0%, #f4e4a1 25%, #d4af37 50%, #aa8a2e 100%)'
  },
  emerald: {
    name: 'Emerald Green',
    bg: 'linear-gradient(145deg, #1a5f3c 0%, #2a7a4e 25%, #1a5f3c 50%, #0d4a2c 100%)',
    text: 'text-white',
    accent: '#FFFFFF',
    chipBg: 'linear-gradient(135deg, #d4af37 0%, #f4e4a1 25%, #d4af37 50%, #aa8a2e 100%)'
  },
  rose: {
    name: 'Rose Pink',
    bg: 'linear-gradient(145deg, #b85a8c 0%, #d4789e 25%, #b85a8c 50%, #8a3d68 100%)',
    text: 'text-white',
    accent: '#FFFFFF',
    chipBg: 'linear-gradient(135deg, #d4af37 0%, #f4e4a1 25%, #d4af37 50%, #aa8a2e 100%)'
  }
};

const washOptions = [
  { washes: 1, label: 'Single Wash', discount: 0 },
  { washes: 3, label: '3 Washes', discount: 5 },
  { washes: 5, label: '5 Washes', discount: 8 },
  { washes: 10, label: '10 Washes', discount: 12 }
];

function generateSerialNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'PWL';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function LuxuryGiftCard({ 
  washes, 
  recipientName, 
  cardColor, 
  serialNumber,
  isFlipped = false
}: { 
  washes: number; 
  recipientName: string; 
  cardColor: keyof typeof cardColors;
  serialNumber: string;
  isFlipped?: boolean;
}) {
  const colors = cardColors[cardColor];
  
  return (
    <div 
      className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-2xl transform transition-transform duration-700"
      style={{ 
        background: colors.bg,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset'
      }}
    >
      {!isFlipped ? (
        <>
          {/* Front of Card */}
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            {/* Top Row - Logo and Mascot */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
                    <path d="M12 2C10.5 2 9.3 3.2 9.3 4.7c0 .7.3 1.4.7 1.9-.4.2-.7.4-1 .7-1.4-1-3.3-1.1-4.8-.2C2.7 8 2.2 10 3 11.5c.5.9 1.3 1.5 2.2 1.8-.1.4-.2.9-.2 1.4 0 3.9 3.1 7 7 7s7-3.1 7-7c0-.5-.1-.9-.2-1.4.9-.3 1.7-.9 2.2-1.8.8-1.5.3-3.5-1.2-4.4-1.5-.9-3.4-.8-4.8.2-.3-.3-.6-.5-1-.7.4-.5.7-1.2.7-1.9C14.7 3.2 13.5 2 12 2z"/>
                  </svg>
                </div>
                <span className={`text-lg font-semibold ${colors.text}`} style={{ fontFamily: 'system-ui' }}>
                  PetWash<sup className="text-xs">™</sup>
                </span>
              </div>
              
              {/* Pet Mascot Icon */}
              <div className="opacity-60">
                <svg viewBox="0 0 80 60" className="w-16 h-12" fill="white" fillOpacity="0.9">
                  <path d="M65 10 L65 5 L60 5 L60 10 L55 10 L55 15 L60 15 L65 15 L70 15 L70 10 Z" fillOpacity="0.6"/>
                  <ellipse cx="55" cy="35" rx="12" ry="15" fillOpacity="0.8"/>
                  <circle cx="50" cy="30" r="3" fill="black" fillOpacity="0.6"/>
                  <ellipse cx="55" cy="45" rx="4" ry="2" fillOpacity="0.5"/>
                  <ellipse cx="30" cy="40" rx="10" ry="12" fillOpacity="0.8"/>
                  <circle cx="26" cy="35" r="2" fill="black" fillOpacity="0.6"/>
                  <path d="M35 50 Q40 55 45 50" stroke="white" strokeWidth="2" fill="none" strokeOpacity="0.6"/>
                </svg>
              </div>
            </div>
            
            {/* Chip and Title */}
            <div className="flex items-center gap-4 mt-4">
              <div 
                className="w-12 h-10 rounded-lg"
                style={{ 
                  background: colors.chipBg,
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-px p-1">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="bg-black bg-opacity-10 rounded-sm"></div>
                  ))}
                </div>
              </div>
              <div>
                <div className={`text-xl font-bold ${colors.text}`}>
                  {washes} {washes === 1 ? 'Wash' : 'Washes'} E-Gift
                </div>
                <div className={`text-sm opacity-70 ${colors.text}`}>PetWash Ltd</div>
              </div>
            </div>
            
            {/* Details Row */}
            <div className="mt-auto">
              <div className={`text-xs opacity-60 ${colors.text} mb-1`}>
                Each wash starts at ₪{WASH_PRICE} for single wash
              </div>
              <div className={`text-xs opacity-60 ${colors.text} mb-2`}>
                PACKAGE DISCOUNT: {washes} Washes
              </div>
              <div className="flex justify-between items-end">
                <div className={`text-xs font-mono ${colors.text} opacity-70`}>
                  SN: {serialNumber}/{washes}
                </div>
                <div className={`text-lg font-bold ${colors.text} uppercase tracking-wider`}>
                  {recipientName || 'RECIPIENT'}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Back of Card */}
          <div className="absolute inset-0 p-6 flex flex-col">
            {/* QR Code Area */}
            <div className="flex items-start gap-3">
              <div className="bg-white p-2 rounded-lg">
                <div className="w-16 h-16 grid grid-cols-5 grid-rows-5 gap-0.5">
                  {[...Array(25)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`${Math.random() > 0.5 ? 'bg-black' : 'bg-white'}`}
                    ></div>
                  ))}
                </div>
              </div>
              <div className={`text-xs font-mono ${colors.text} opacity-70 transform -rotate-90 origin-left mt-8`}>
                SN: {serialNumber}
              </div>
              <div className="flex-1"></div>
              <div className="w-24 h-8 bg-white rounded"></div>
            </div>
            
            <div className="mt-6">
              <div className={`text-xs ${colors.text} opacity-60`}>VALID UNTIL: XX/XX</div>
              <div className={`text-xs ${colors.text} opacity-60`}>XX/XX LD LIMIT: XX/XX</div>
            </div>
            
            <div className={`text-sm ${colors.text} mt-4`}>
              This card entitles the holder to {washes}
              <br />
              complimentary {washes === 1 ? 'wash' : 'washes'}
            </div>
            
            {/* Bottom Row */}
            <div className="mt-auto flex justify-between items-end">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
                    <path d="M12 2C10.5 2 9.3 3.2 9.3 4.7c0 .7.3 1.4.7 1.9-.4.2-.7.4-1 .7-1.4-1-3.3-1.1-4.8-.2C2.7 8 2.2 10 3 11.5c.5.9 1.3 1.5 2.2 1.8-.1.4-.2.9-.2 1.4 0 3.9 3.1 7 7 7s7-3.1 7-7c0-.5-.1-.9-.2-1.4.9-.3 1.7-.9 2.2-1.8.8-1.5.3-3.5-1.2-4.4-1.5-.9-3.4-.8-4.8.2-.3-.3-.6-.5-1-.7.4-.5.7-1.2.7-1.9C14.7 3.2 13.5 2 12 2z"/>
                  </svg>
                </div>
                <span className={`text-sm font-semibold ${colors.text}`}>
                  PetWash<sup className="text-xs">™</sup>
                </span>
              </div>
              <div className={`text-lg font-bold ${colors.text} uppercase tracking-wider`}>
                {recipientName || 'RECIPIENT'}
              </div>
            </div>
            
            {/* Pet Mascot */}
            <div className="absolute right-16 bottom-20 opacity-50">
              <svg viewBox="0 0 80 60" className="w-20 h-14" fill="white">
                <ellipse cx="55" cy="35" rx="12" ry="15"/>
                <circle cx="50" cy="30" r="3" fill="black" fillOpacity="0.5"/>
                <ellipse cx="30" cy="40" rx="10" ry="12"/>
                <circle cx="26" cy="35" r="2" fill="black" fillOpacity="0.5"/>
              </svg>
            </div>
          </div>
        </>
      )}
      
      {/* Metallic Shine Effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 55%, transparent 60%)',
        }}
      ></div>
    </div>
  );
}

export default function EGift() {
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const [isFlipped, setIsFlipped] = useState(false);
  const [serialNumber] = useState(generateSerialNumber);
  const [isGuestCheckout, setIsGuestCheckout] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const form = useForm<EGiftFormData>({
    resolver: zodResolver(eGiftFormSchema),
    defaultValues: {
      washes: 3,
      recipientEmail: '',
      recipientName: '',
      purchaserEmail: user?.email || '',
      purchaserName: user?.displayName || '',
      message: '',
      cardColor: 'platinum'
    }
  });

  useEffect(() => {
    if (user?.email) {
      form.setValue('purchaserEmail', user.email);
    }
    if (user?.displayName) {
      form.setValue('purchaserName', user.displayName);
    }
  }, [user, form]);

  const watchedValues = form.watch();
  const selectedWashOption = washOptions.find(o => o.washes === watchedValues.washes) || washOptions[0];
  const totalPrice = watchedValues.washes * WASH_PRICE * (1 - selectedWashOption.discount / 100);
  const savings = watchedValues.washes * WASH_PRICE - totalPrice;

  const createVoucherMutation = useMutation({
    mutationFn: async (data: EGiftFormData) => {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 2);
      
      return await apiRequest('/api/vouchers-2025/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'egift',
          value_type: 'washes',
          value: totalPrice,
          washes: data.washes,
          currency: 'ILS',
          expires_at: expiresAt.toISOString(),
          theme: data.cardColor,
          recipient_name: data.recipientName,
          recipient_email: data.recipientEmail,
          purchaser_email: data.purchaserEmail,
          purchaser_name: data.purchaserName,
          message: data.message || '',
          serial_number: serialNumber
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Gift Card Created!",
        description: `${watchedValues.washes} wash gift card sent to ${watchedValues.recipientName}`,
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
    // For guests, validate purchaser info is filled
    if (!user) {
      if (!data.purchaserName || !data.purchaserEmail) {
        toast({
          variant: "destructive",
          title: "Your info required",
          description: "Please enter your name and email to complete the purchase."
        });
        setIsGuestCheckout(true);
        return;
      }
    }
    // Proceed with creating the gift card (works for both guests and members)
    createVoucherMutation.mutate(data);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-neutral-50">
        {/* Hero Section */}
        <div className="relative bg-black text-white py-16 md:py-24 overflow-hidden">
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              background: 'radial-gradient(circle at 30% 50%, rgba(212,175,55,0.3) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(212,175,55,0.2) 0%, transparent 40%)'
            }}
          ></div>
          
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 border border-white border-opacity-20 rounded-full mb-6 bg-white bg-opacity-5">
                <Gift className="w-4 h-4" />
                <span className="text-sm font-medium tracking-widest uppercase">Digital Gift Cards</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-4">
                Give the Gift of
                <span className="block font-bold mt-2">Premium Pet Care</span>
              </h1>
              
              <p className="text-lg text-white text-opacity-60 max-w-xl mx-auto">
                Luxury digital gift cards with instant delivery. Perfect for any pet lover.
              </p>
              
              {/* Express Checkout Badge */}
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-white bg-opacity-10 rounded-full">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-sm">Express checkout available for guests</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            
            {/* Card Preview Section */}
            <div className="order-1 lg:order-2">
              <div className="sticky top-24">
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-4">
                  Live Preview
                </h3>
                
                {/* Card with Flip Toggle */}
                <div 
                  className="cursor-pointer perspective-1000"
                  onClick={() => setIsFlipped(!isFlipped)}
                  data-testid="card-preview"
                >
                  <LuxuryGiftCard
                    washes={watchedValues.washes}
                    recipientName={watchedValues.recipientName}
                    cardColor={watchedValues.cardColor as keyof typeof cardColors}
                    serialNumber={serialNumber}
                    isFlipped={isFlipped}
                  />
                </div>
                
                <p className="text-center text-sm text-neutral-400 mt-4">
                  Click card to flip
                </p>
                
                {/* Price Summary */}
                <div className="mt-8 bg-white rounded-2xl p-6 border border-neutral-100">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-neutral-500">
                      {watchedValues.washes} × ₪{WASH_PRICE}
                    </span>
                    <span className="font-medium">₪{watchedValues.washes * WASH_PRICE}</span>
                  </div>
                  {savings > 0 && (
                    <div className="flex justify-between items-center mb-3 text-green-600">
                      <span>Discount ({selectedWashOption.discount}%)</span>
                      <span>-₪{savings.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="border-t border-neutral-100 pt-3 flex justify-between items-center">
                    <span className="font-bold text-lg">Total</span>
                    <span className="font-bold text-2xl">₪{totalPrice.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Form Section */}
            <div className="order-2 lg:order-1">
              <h2 className="text-2xl font-bold mb-8">Create Your Gift Card</h2>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  
                  {/* Wash Count Selection */}
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wider text-neutral-400 mb-4">
                      Select Washes
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {washOptions.map((option) => (
                        <button
                          key={option.washes}
                          type="button"
                          onClick={() => form.setValue('washes', option.washes)}
                          className={`
                            relative p-4 rounded-xl text-center transition-all duration-200
                            ${watchedValues.washes === option.washes 
                              ? 'bg-black text-white shadow-lg scale-105' 
                              : 'bg-white text-black border-2 border-neutral-100 hover:border-neutral-300'
                            }
                          `}
                          data-testid={`button-washes-${option.washes}`}
                        >
                          <div className="text-2xl font-bold">{option.washes}</div>
                          <div className="text-xs opacity-70 mt-1">{option.label}</div>
                          {option.discount > 0 && (
                            <div className={`text-xs mt-2 font-medium ${
                              watchedValues.washes === option.washes ? 'text-green-300' : 'text-green-600'
                            }`}>
                              Save {option.discount}%
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Card Color Selection */}
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wider text-neutral-400 mb-4">
                      Card Design
                    </label>
                    <div className="grid grid-cols-4 gap-3">
                      {(Object.keys(cardColors) as Array<keyof typeof cardColors>).map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => form.setValue('cardColor', color)}
                          className={`
                            relative aspect-[1.586/1] rounded-xl overflow-hidden transition-all duration-200
                            ${watchedValues.cardColor === color 
                              ? 'ring-2 ring-black ring-offset-2 scale-105' 
                              : 'hover:scale-105'
                            }
                          `}
                          style={{ background: cardColors[color].bg }}
                          data-testid={`button-color-${color}`}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-white text-xs font-bold opacity-80">
                              {color.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-neutral-400 mt-2">
                      Selected: {cardColors[watchedValues.cardColor as keyof typeof cardColors]?.name}
                    </p>
                  </div>
                  
                  {/* Recipient Details */}
                  <div className="space-y-4">
                    <label className="block text-sm font-bold uppercase tracking-wider text-neutral-400">
                      Recipient Details
                    </label>
                    
                    <FormField
                      control={form.control}
                      name="recipientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                              <Input 
                                {...field} 
                                placeholder="Recipient's name (shown on card)"
                                className="pl-12 h-14 bg-white border-neutral-200 rounded-xl"
                                data-testid="input-recipient-name"
                              />
                            </div>
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
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                              <Input 
                                {...field} 
                                type="email"
                                placeholder="Recipient's email"
                                className="pl-12 h-14 bg-white border-neutral-200 rounded-xl"
                                data-testid="input-recipient-email"
                              />
                            </div>
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
                        <FormLabel className="text-sm font-bold uppercase tracking-wider text-neutral-400">
                          Personal Message (Optional)
                        </FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            rows={3}
                            placeholder="Add a special message..."
                            className="w-full p-4 bg-white border border-neutral-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-black"
                            maxLength={200}
                            data-testid="input-message"
                          />
                        </FormControl>
                        <div className="text-xs text-neutral-400 text-right">
                          {field.value?.length || 0}/200
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Guest Checkout Fields */}
                  {(isGuestCheckout || !user) && (
                    <div className="space-y-4 p-6 bg-white rounded-xl border border-neutral-200">
                      <div className="flex items-center gap-2 mb-4">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        <span className="font-bold">Express Checkout</span>
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="purchaserName"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                                <Input 
                                  {...field} 
                                  placeholder="Your name"
                                  className="pl-12 h-14 bg-neutral-50 border-neutral-200 rounded-xl"
                                  data-testid="input-purchaser-name"
                                />
                              </div>
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
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                                <Input 
                                  {...field} 
                                  type="email"
                                  placeholder="Your email (for receipt)"
                                  className="pl-12 h-14 bg-neutral-50 border-neutral-200 rounded-xl"
                                  data-testid="input-purchaser-email"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                  
                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={createVoucherMutation.isPending}
                    className="w-full h-16 bg-black hover:bg-neutral-800 text-white rounded-xl text-lg font-bold tracking-wide"
                    data-testid="button-submit"
                  >
                    {createVoucherMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Creating Gift Card...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Purchase for ₪{totalPrice.toFixed(0)}
                        <ChevronRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                  
                  <p className="text-xs text-center text-neutral-400">
                    Secure payment via Nayax. Card delivered instantly via email.
                  </p>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
