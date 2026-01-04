import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ArrowRight, Wallet, Gift, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PaymentMethods from '@/components/PaymentMethods';

const cardStyles = {
  rose: {
    gradient: 'linear-gradient(135deg, #FFB6C1 0%, #FF69B4 30%, #DB7093 70%, #C71585 100%)',
    textColor: '#FFFFFF',
    accentColor: '#FFF0F5'
  },
  emerald: {
    gradient: 'linear-gradient(135deg, #2E8B57 0%, #228B22 30%, #006400 70%, #004D00 100%)',
    textColor: '#FFFFFF',
    accentColor: '#98FB98'
  },
  platinum: {
    gradient: 'linear-gradient(135deg, #2D2D2D 0%, #1A1A1A 30%, #0D0D0D 70%, #000000 100%)',
    textColor: '#FFFFFF',
    accentColor: '#C0C0C0'
  },
  gold: {
    gradient: 'linear-gradient(135deg, #FFD700 0%, #DAA520 30%, #B8860B 70%, #8B6914 100%)',
    textColor: '#1A1A1A',
    accentColor: '#FFF8DC'
  }
};

const platformServices = [
  { id: 'wash', name: 'K9000 Wash Hub™' },
  { id: 'sitter', name: 'Sitter Suite™' },
  { id: 'walk', name: 'Walk My Pet™' },
  { id: 'trek', name: 'PetTrek™' },
  { id: 'academy', name: 'Pet Wash Academy™' },
  { id: 'nayax', name: 'Nayax Pet Wash™' }
];

const giftOptions = [
  { value: 100, color: 'rose' as const },
  { value: 250, color: 'emerald' as const },
  { value: 500, color: 'platinum' as const },
  { value: 1000, color: 'gold' as const }
];

function LuxuryGiftCard({ 
  option,
  onClick,
  selected
}: { 
  option: typeof giftOptions[0];
  onClick: () => void;
  selected?: boolean;
}) {
  const style = cardStyles[option.color];
  const formattedValue = option.value >= 1000 
    ? `₪${(option.value / 1000).toFixed(0)},000` 
    : `₪${option.value}`;
  
  return (
    <button 
      type="button"
      className={`relative w-full text-left transition-all duration-500 rounded-2xl group ${
        selected 
          ? 'ring-4 ring-black ring-offset-4 scale-[1.03]' 
          : 'hover:scale-[1.02]'
      }`}
      onClick={onClick}
      data-testid={`egift-card-${option.value}`}
    >
      {option.value === 1000 && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <span className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs font-bold rounded-full shadow-lg whitespace-nowrap">
            BEST VALUE
          </span>
        </div>
      )}
      <div 
        className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-2xl transition-shadow duration-300 group-hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]"
        style={{ background: style.gradient }}
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full" style={{
            backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)'
          }} />
        </div>
        
        <div className="absolute top-4 sm:top-6 left-4 sm:left-6 flex items-center gap-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: style.accentColor }}>
            <Gift className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: option.color === 'gold' ? '#8B6914' : style.textColor === '#FFFFFF' ? '#333' : style.textColor }} />
          </div>
          <span className="text-sm sm:text-base font-bold tracking-wider" style={{ color: style.textColor }}>
            PetWash™
          </span>
        </div>

        <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6">
          <p className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-1" style={{ color: style.textColor }}>
            {formattedValue}
          </p>
          <p className="text-xs sm:text-sm font-medium opacity-80" style={{ color: style.textColor }}>
            E-Gift Credit
          </p>
        </div>

        <div className="absolute top-4 sm:top-6 right-4 sm:right-6">
          <div className="w-10 h-7 sm:w-12 sm:h-8 rounded" style={{ 
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }} />
        </div>
      </div>
    </button>
  );
}

export default function EGift() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<typeof giftOptions[0] | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>(['wash', 'sitter', 'walk', 'trek', 'academy', 'nayax']);
  const [step, setStep] = useState<'select' | 'checkout'>('select');
  
  const [formData, setFormData] = useState({
    recipientName: '',
    recipientEmail: '',
    senderName: '',
    senderEmail: '',
    message: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.recipientName.trim()) {
      newErrors.recipientName = 'Required';
    }
    if (!formData.recipientEmail.trim()) {
      newErrors.recipientEmail = 'Required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.recipientEmail)) {
      newErrors.recipientEmail = 'Invalid email';
    }
    if (!formData.senderName.trim()) {
      newErrors.senderName = 'Required';
    }
    if (!formData.senderEmail.trim()) {
      newErrors.senderEmail = 'Required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.senderEmail)) {
      newErrors.senderEmail = 'Invalid email';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCardClick = (option: typeof giftOptions[0]) => {
    setSelectedOption(option);
  };

  const proceedToCheckout = () => {
    if (!selectedOption) {
      toast({ title: "Please select a gift card value", variant: "destructive" });
      return;
    }
    setStep('checkout');
  };

  const handleCheckout = async () => {
    if (!validateForm()) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    if (!selectedOption) return;

    const finalPrice = selectedOption.value;

    try {
      const response = await fetch('/api/multi-service-gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: finalPrice,
          currency: 'ILS',
          recipientName: formData.recipientName,
          recipientEmail: formData.recipientEmail,
          senderName: formData.senderName,
          senderEmail: formData.senderEmail,
          message: formData.message,
          eligibleServices: selectedServices
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({ 
          title: "Gift Card Created!", 
          description: `Gift card code: ${data.publicCode}` 
        });
        setFormData({ recipientName: '', recipientEmail: '', senderName: '', senderEmail: '', message: '' });
        setSelectedOption(null);
        setStep('select');
      } else {
        toast({ 
          title: "Error creating gift card", 
          description: data.message || 'Please try again',
          variant: "destructive" 
        });
      }
    } catch (error) {
      toast({ 
        title: "Error processing gift", 
        description: "Please try again later",
        variant: "destructive" 
      });
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(s => s !== serviceId)
        : [...prev, serviceId]
    );
  };

  if (step === 'checkout' && selectedOption) {
    const style = cardStyles[selectedOption.color];
    const finalPrice = selectedOption.value;
    const formattedValue = finalPrice >= 1000 
      ? `₪${(finalPrice / 1000).toFixed(0)},000` 
      : `₪${finalPrice}`;

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
          <Button 
            variant="ghost" 
            onClick={() => setStep('select')}
            className="mb-4 sm:mb-6"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
            <div className="order-2 lg:order-1">
              <Card className="border-0 shadow-xl">
                <CardContent className="p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">
                    Express Checkout
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="recipientName" className="text-sm">Recipient Name *</Label>
                      <Input
                        id="recipientName"
                        placeholder="Who is this for?"
                        value={formData.recipientName}
                        onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                        className={`mt-1 ${errors.recipientName ? 'border-red-500' : ''}`}
                        data-testid="input-recipient-name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="recipientEmail" className="text-sm">Recipient Email *</Label>
                      <Input
                        id="recipientEmail"
                        type="email"
                        placeholder="Their email"
                        value={formData.recipientEmail}
                        onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                        className={`mt-1 ${errors.recipientEmail ? 'border-red-500' : ''}`}
                        data-testid="input-recipient-email"
                      />
                    </div>

                    <div>
                      <Label htmlFor="senderName" className="text-sm">Your Name *</Label>
                      <Input
                        id="senderName"
                        placeholder="Your name"
                        value={formData.senderName}
                        onChange={(e) => setFormData(prev => ({ ...prev, senderName: e.target.value }))}
                        className={`mt-1 ${errors.senderName ? 'border-red-500' : ''}`}
                        data-testid="input-sender-name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="senderEmail" className="text-sm">Your Email *</Label>
                      <Input
                        id="senderEmail"
                        type="email"
                        placeholder="Your email"
                        value={formData.senderEmail}
                        onChange={(e) => setFormData(prev => ({ ...prev, senderEmail: e.target.value }))}
                        className={`mt-1 ${errors.senderEmail ? 'border-red-500' : ''}`}
                        data-testid="input-sender-email"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="message" className="text-sm">Personal Message</Label>
                      <Input
                        id="message"
                        placeholder="Add a personal touch..."
                        value={formData.message}
                        onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                        className="mt-1"
                        data-testid="input-message"
                      />
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm font-medium text-gray-700 mb-2">Redeemable at:</p>
                    <div className="flex flex-wrap gap-2">
                      {platformServices.filter(s => selectedServices.includes(s.id)).map(service => (
                        <span key={service.id} className="bg-black text-white px-2 py-1 rounded-full text-xs">
                          {service.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-black hover:bg-gray-800 text-white py-5 sm:py-6 text-base sm:text-lg mt-4 sm:mt-6"
                    onClick={handleCheckout}
                    data-testid="button-checkout"
                  >
                    Pay ₪{finalPrice} & Send Gift
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>

                  <p className="text-xs text-gray-500 text-center mt-3">
                    Secure checkout • No account required
                  </p>
                  
                  <div className="mt-4 sm:mt-6 pt-4 border-t border-gray-100">
                    <PaymentMethods language="en" size="sm" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="order-1 lg:order-2">
              <div className="w-full max-w-xs sm:max-w-sm mx-auto lg:sticky lg:top-8">
                <div 
                  className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-2xl"
                  style={{ background: style.gradient }}
                >
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 left-0 w-full h-full" style={{
                      backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)'
                    }} />
                  </div>
                  
                  <div className="absolute top-5 left-5 flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: style.accentColor }}>
                      <Gift className="w-5 h-5" style={{ color: selectedOption.color === 'gold' ? '#8B6914' : '#333' }} />
                    </div>
                    <span className="text-base font-bold tracking-wider" style={{ color: style.textColor }}>
                      PetWash™
                    </span>
                  </div>

                  <div className="absolute bottom-5 left-5 right-5">
                    <p className="text-4xl sm:text-5xl font-black tracking-tight mb-1" style={{ color: style.textColor }}>
                      {formattedValue}
                    </p>
                    <p className="text-sm font-medium opacity-80" style={{ color: style.textColor }}>
                      E-Gift Credit
                    </p>
                  </div>

                  <div className="absolute top-5 right-5">
                    <div className="w-12 h-8 rounded" style={{ 
                      background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }} />
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-xs text-amber-600 font-medium">Works at all Pet Wash™ services</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-100 to-yellow-100 rounded-full mb-4">
            <Wallet className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Platform-Wide Credit</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
            Gift Card Credit
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">
            Give the gift of premium pet care credit. Use anywhere across Pet Wash™ platforms - from self-service washes to pet sitting, dog walking, adventures, and more!
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <p className="text-sm font-medium text-gray-700 mb-3 text-center">
              Gift can be used at:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {platformServices.map(service => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service.id)}
                  className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                    selectedServices.includes(service.id)
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  data-testid={`service-toggle-${service.id}`}
                >
                  {service.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {giftOptions.map((option) => (
              <LuxuryGiftCard
                key={option.value}
                option={option}
                onClick={() => handleCardClick(option)}
                selected={selectedOption?.value === option.value}
              />
            ))}
          </div>

          {selectedOption && (
            <div className="mt-6 sm:mt-8 text-center">
              <Button 
                className="bg-black hover:bg-gray-800 text-white px-8 sm:px-12 py-5 sm:py-6 text-base sm:text-lg"
                onClick={proceedToCheckout}
                data-testid="button-proceed-checkout"
              >
                Continue to Checkout
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          <div className="mt-8 sm:mt-12 flex flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" />
              Instant Delivery
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" />
              No Account Required
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" />
              Valid 12 Months
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" />
              All Services
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}