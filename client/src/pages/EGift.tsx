import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Check, ArrowRight, Wallet, Gift, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import roseFrontImg from '@assets/IMG_2004_1767477310445.png';
import roseBackImg from '@assets/IMG_2005_1767477310445.png';
import emeraldFrontImg from '@assets/IMG_2002_1767477310445.png';
import emeraldBackImg from '@assets/IMG_2003_1767477310445.png';
import goldFrontImg from '@assets/IMG_1996_1767477310445.png';
import goldBackImg from '@assets/IMG_1997_1767477310445.png';
import platinumFrontImg from '@assets/IMG_1998_1767477310445.png';
import platinumBackImg from '@assets/IMG_1999_1767477310445.png';

const cardImages = {
  rose: { front: roseFrontImg, back: roseBackImg, name: 'Rose Pink' },
  emerald: { front: emeraldFrontImg, back: emeraldBackImg, name: 'Emerald Green' },
  platinum: { front: platinumFrontImg, back: platinumBackImg, name: 'Platinum Black' },
  gold: { front: goldFrontImg, back: goldBackImg, name: 'Gold' }
};

const platformServices = [
  { id: 'wash', name: 'K9000 Wash Hub™', description: 'Self-service wash stations' },
  { id: 'sitter', name: 'Sitter Suite™', description: 'Premium pet sitting' },
  { id: 'walk', name: 'Walk My Pet™', description: 'Professional dog walking' },
  { id: 'trek', name: 'PetTrek™', description: 'Adventure experiences' },
  { id: 'academy', name: 'Pet Wash Academy™', description: 'Training & education' },
  { id: 'nayax', name: 'Nayax Pet Wash™', description: 'Hardware payment stations' }
];

const giftOptions = [
  { value: 100, color: 'rose' as const, label: '₪100 Credit', description: 'Perfect starter gift' },
  { value: 250, color: 'emerald' as const, label: '₪250 Credit', description: 'Popular choice' },
  { value: 500, color: 'platinum' as const, label: '₪500 Credit', description: 'Premium gift' },
  { value: 1000, color: 'gold' as const, label: '₪1,000 Credit', description: 'Ultimate luxury gift' }
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
  const images = cardImages[option.color];
  const formattedValue = option.value >= 1000 
    ? `₪${(option.value / 1000).toFixed(0)},000` 
    : `₪${option.value}`;
  
  return (
    <button 
      type="button"
      className={`relative w-full text-left transition-all duration-300 rounded-2xl ${
        selected ? 'ring-4 ring-black ring-offset-2 scale-[1.02]' : 'hover:scale-[1.02]'
      }`}
      onClick={onClick}
      data-testid={`egift-card-${option.value}`}
    >
      <div className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-xl">
        <img 
          src={images.front}
          alt={`${formattedValue} Credit E-Gift Card`}
          className="w-full h-full object-cover object-center"
          loading="lazy"
        />
      </div>
      <div className="mt-3 text-center">
        <p className="text-xl sm:text-2xl font-bold text-gray-900">
          {formattedValue}
        </p>
        <p className="text-lg font-semibold text-gray-700">Platform Credit</p>
        <p className="text-sm text-gray-600 mt-1">{option.description}</p>
        {option.value === 1000 && (
          <span className="inline-block mt-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
            Best Value
          </span>
        )}
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
    const images = cardImages[selectedOption.color];
    const finalPrice = selectedOption.value;

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
                </CardContent>
              </Card>
            </div>

            <div className="order-1 lg:order-2">
              <div className="w-full max-w-xs sm:max-w-sm mx-auto lg:sticky lg:top-8">
                <div className="relative aspect-[1.586/1] rounded-2xl overflow-hidden shadow-2xl">
                  <img 
                    src={images.front}
                    alt="E-Gift Card Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-4 text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">₪{finalPrice}</p>
                  <p className="text-gray-600 mt-1">Platform Credit Gift Card</p>
                  <p className="text-xs text-amber-600 font-medium mt-1">Works at all Pet Wash™ services</p>
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