import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Scissors, Calendar, Clock, MapPin, PawPrint, Star, CheckCircle2,
  ChevronRight, ChevronLeft, DollarSign, Info, Sparkles,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { format, addDays } from 'date-fns';

const SERVICES = [
  { key: 'bath_blow', en: 'Bath & Blow Dry', he: 'אמבטיה וייבוש', emoji: '🛁', price: 120, duration: '60 min', desc: 'Full wash, blow dry & brush out' },
  { key: 'full_groom', en: 'Full Groom', he: 'טיפוח מלא', emoji: '✂️', price: 180, duration: '90 min', desc: 'Bath, trim, nail, ear & teeth' },
  { key: 'nail_trim', en: 'Nail Trim', he: 'קיצוץ ציפורניים', emoji: '💅', price: 60, duration: '20 min', desc: 'Nail clipping & filing' },
  { key: 'spa_treatment', en: 'Spa Treatment', he: 'טיפול ספא', emoji: '🧴', price: 220, duration: '120 min', desc: 'Premium spa with conditioning mask' },
  { key: 'puppy_groom', en: 'Puppy Groom', he: 'טיפוח לגורים', emoji: '🐾', price: 140, duration: '75 min', desc: 'Gentle first groom for puppies' },
  { key: 'de_shed', en: 'De-Shedding', he: 'הסרת שערות', emoji: '🪮', price: 150, duration: '60 min', desc: 'Reduce shedding by up to 90%' },
  { key: 'teeth_cleaning', en: 'Teeth Cleaning', he: 'ניקוי שיניים', emoji: '🦷', price: 80, duration: '30 min', desc: 'Safe dental cleaning' },
  { key: 'ear_cleaning', en: 'Ear Cleaning', he: 'ניקוי אוזניים', emoji: '👂', price: 60, duration: '20 min', desc: 'Ear canal cleaning & inspection' },
];

const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const PET_SIZES = [
  { key: 'small', label: 'Small', labelHe: 'קטן', desc: 'Under 10kg', emoji: '🐩' },
  { key: 'medium', label: 'Medium', labelHe: 'בינוני', desc: '10–25kg', emoji: '🦮' },
  { key: 'large', label: 'Large', labelHe: 'גדול', desc: 'Over 25kg', emoji: '🐕' },
];

interface GroomersBookProps {
  language?: string;
}

export default function GroomersBook({ language: langProp }: GroomersBookProps) {
  const { language } = useLanguage();
  const isHebrew = (langProp || language) === 'he';
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [petSize, setPetSize] = useState('medium');
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [address, setAddress] = useState('');

  const { data: pets = [] } = useQuery<any[]>({
    queryKey: ['/api/pets'],
    queryFn: () => fetch('/api/pets', { credentials: 'include' }).then(r => r.json()).then(d => d.pets || d || []),
  });

  const bookMutation = useMutation({
    mutationFn: () => {
      const svc = SERVICES.find(s => s.key === selectedService)!;
      const [hours] = selectedTime.split(':').map(Number);
      const startDate = new Date(`${selectedDate}T${selectedTime}:00`);
      const endDate = new Date(startDate.getTime() + 90 * 60 * 1000);
      return apiRequest('POST', '/api/booking-requests', {
        providerType: 'groomer',
        serviceType: selectedService,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        petCount: 1,
        petDetails: [{ name: petName || 'My pet', breed: petBreed, size: petSize }],
        subtotalCents: svc.price * 100,
        serviceFeeCents: Math.round(svc.price * 100 * 0.15),
        totalCents: Math.round(svc.price * 100 * 1.15),
        currency: 'ILS',
        ownerMessage: specialNotes || undefined,
        specialRequirements: address || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: 'Booking request sent!', description: 'Your groomer will confirm shortly.' });
      setLocation('/groomers/customer/dashboard');
    },
    onError: () => toast({ title: 'Booking failed', description: 'Please try again.', variant: 'destructive' }),
  });

  const selectedSvc = SERVICES.find(s => s.key === selectedService);
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const maxDate = format(addDays(new Date(), 60), 'yyyy-MM-dd');

  const canNext = (
    step === 1 ? !!selectedService :
    step === 2 ? !!selectedDate && !!selectedTime :
    step === 3 ? !!petName :
    true
  );

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-bg-primary text-white py-10">
        <div className="luxury-container">
          <div className="flex items-center gap-2 mb-1"><Scissors className="w-6 h-6 text-pink-300" /><span className="text-pink-200 text-sm font-medium uppercase tracking-wide">Grooming Marketplace</span></div>
          <h1 className="text-3xl font-bold text-white mb-2">{isHebrew ? 'הזמן מפגש טיפוח' : 'Book a Grooming Session'}</h1>
          <p className="text-purple-100">Professional grooming for your pet</p>

          <div className="flex items-center gap-2 mt-6">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i + 1 <= step ? 'bg-white text-purple-700' : 'bg-white/20 text-white/60'}`}>
                  {i + 1 < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                {i < totalSteps - 1 && <div className={`h-0.5 w-8 md:w-16 transition-all ${i + 1 < step ? 'bg-white' : 'bg-white/20'}`} />}
              </div>
            ))}
            <span className="ml-2 text-white/70 text-sm">
              {['Choose Service', 'Pick Date & Time', 'Your Pet', 'Confirm'][step - 1]}
            </span>
          </div>
        </div>
      </div>

      <div className="luxury-container py-8 max-w-2xl">
        {step === 1 && (
          <div>
            <h2 className="luxury-heading-md mb-4">{isHebrew ? 'בחר שירות' : 'Choose a Service'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SERVICES.map(svc => (
                <div
                  key={svc.key}
                  onClick={() => setSelectedService(svc.key)}
                  className={`cursor-pointer luxury-glass-card p-4 transition-all luxury-hover-lift ${selectedService === svc.key ? 'ring-2 ring-purple-500 bg-purple-50/50 dark:bg-white' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{svc.emoji}</span>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-black text-sm">{isHebrew ? svc.he : svc.en}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{svc.desc}</p>
                      </div>
                    </div>
                    {selectedService === svc.key && <CheckCircle2 className="w-5 h-5 text-purple-500 flex-shrink-0" />}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{svc.duration}</span>
                    <span className="font-bold text-purple-700 dark:text-purple-300">from ₪{svc.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="luxury-heading-md">{isHebrew ? 'בחר תאריך ושעה' : 'Pick Date & Time'}</h2>
            {selectedSvc && (
              <div className="luxury-glass-card p-4 flex items-center gap-3 bg-purple-50/50 dark:bg-white">
                <span className="text-2xl">{selectedSvc.emoji}</span>
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-black">{isHebrew ? selectedSvc.he : selectedSvc.en}</p>
                  <p className="text-xs text-gray-500">{selectedSvc.duration} · ₪{selectedSvc.price}</p>
                </div>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium mb-2 block">Date</Label>
              <Input type="date" min={tomorrow} max={maxDate} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="luxury-input" />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Time</Label>
              <div className="grid grid-cols-3 gap-2">
                {TIME_SLOTS.map(slot => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all ${selectedTime === slot ? 'bg-purple-600 text-white shadow-md' : 'luxury-glass-card hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-700 dark:text-black'}`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Service Address</Label>
              <Input placeholder="Enter your address..." value={address} onChange={e => setAddress(e.target.value)} className="luxury-input" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="luxury-heading-md">{isHebrew ? 'פרטי חיית המחמד' : 'Your Pet\'s Details'}</h2>

            {pets.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Quick fill from saved pets</Label>
                {pets.slice(0,3).map((pet: any) => (
                  <button key={pet.id} onClick={() => { setPetName(pet.name || ''); setPetBreed(pet.breed || ''); }} className="w-full luxury-glass-card p-3 flex items-center gap-3 text-left hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors">
                    <span className="text-xl">🐾</span>
                    <div><p className="font-medium text-sm text-gray-900 dark:text-black">{pet.name}</p><p className="text-xs text-gray-500">{pet.breed}</p></div>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Pet Name *</Label>
                <Input placeholder="Max, Luna..." value={petName} onChange={e => setPetName(e.target.value)} className="luxury-input" />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Breed</Label>
                <Input placeholder="Golden Retriever..." value={petBreed} onChange={e => setPetBreed(e.target.value)} className="luxury-input" />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Pet Size</Label>
              <div className="grid grid-cols-3 gap-3">
                {PET_SIZES.map(size => (
                  <button key={size.key} onClick={() => setPetSize(size.key)}
                    className={`py-3 rounded-xl text-center transition-all ${petSize === size.key ? 'bg-purple-600 text-white shadow-md' : 'luxury-glass-card hover:bg-purple-50 dark:hover:bg-purple-900/20'}`}>
                    <div className="text-2xl mb-1">{size.emoji}</div>
                    <p className="text-xs font-medium">{isHebrew ? size.labelHe : size.label}</p>
                    <p className="text-xs text-current opacity-70">{size.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Special Instructions</Label>
              <Textarea placeholder="Allergies, anxious dog, bite history, preferred products..." value={specialNotes} onChange={e => setSpecialNotes(e.target.value)} rows={3} className="luxury-input" />
            </div>
          </div>
        )}

        {step === 4 && selectedSvc && (
          <div className="space-y-4">
            <h2 className="luxury-heading-md">{isHebrew ? 'אשר הזמנה' : 'Confirm Booking'}</h2>

            <div className="luxury-glass-card p-5 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
                <span className="text-3xl">{selectedSvc.emoji}</span>
                <div>
                  <p className="font-bold text-gray-900 dark:text-black">{isHebrew ? selectedSvc.he : selectedSvc.en}</p>
                  <p className="text-sm text-gray-500">{selectedSvc.duration}</p>
                </div>
              </div>

              {[
                { icon: Calendar, label: 'Date', value: selectedDate ? format(new Date(selectedDate), 'MMMM d, yyyy') : '—' },
                { icon: Clock, label: 'Time', value: selectedTime || '—' },
                { icon: PawPrint, label: 'Pet', value: `${petName || 'Your pet'} · ${petBreed || 'Unknown breed'} · ${petSize}` },
                { icon: MapPin, label: 'Address', value: address || 'Not specified' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-white flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-black">{value}</p>
                  </div>
                </div>
              ))}

              {specialNotes && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">{specialNotes}</p>
                </div>
              )}
            </div>

            <div className="luxury-glass-card p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Service</span><span>₪{selectedSvc.price}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Platform fee (15%)</span><span>₪{Math.round(selectedSvc.price * 0.15)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100 dark:border-gray-700">
                <span>Total</span><span className="text-purple-700 dark:text-purple-300">₪{Math.round(selectedSvc.price * 1.15)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3" />Payment held in 72hr escrow — released on completion
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" />Back
            </Button>
          )}
          {step < totalSteps ? (
            <Button className="luxury-btn-primary flex-1" onClick={() => setStep(s => s + 1)} disabled={!canNext}>
              Continue<ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button className="luxury-btn-primary flex-1" onClick={() => bookMutation.mutate()} disabled={bookMutation.isPending || !petName}>
              {bookMutation.isPending ? <><div className="luxury-spinner mr-2 w-4 h-4" />Booking...</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Confirm Booking</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
