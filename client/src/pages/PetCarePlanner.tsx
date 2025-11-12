import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Droplets, AlertCircle, CheckCircle2, CloudRain, Sun, Snowflake, Thermometer, Sparkles, Heart, Star, Gift, QrCode, Download, Award, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { format, differenceInDays, parseISO } from 'date-fns';
import { calculateTier, TIER_CONFIG } from '@/lib/loyalty';

interface Pet {
  id: number;
  customerId: number;
  name: string;
  breed: string;
  age: number;
  weight: string;
  lastWashDate: string | null;
  nextWashDue: string | null;
  nextVaccinationDate: string | null;
  vaccinationNotes: string | null;
  reminderEnabled: boolean;
}

interface WashSchedule {
  id: number;
  petId: number;
  petName: string;
  scheduledDate: string;
  weather?: WeatherForecast;
  status: 'pending' | 'completed' | 'cancelled';
}

interface WeatherForecast {
  temperature: number;
  description: string;
  condition: string;
  recommendation: string;
  priority?: string;
  actionAdvice?: string;
  icon: string;
  pollenLevel?: number;
  pollenRisk?: string;
  rainChance?: number;
  dataSnapshot?: Record<string, any>;
}

export default function PetCarePlanner({ language = 'en' }: { language?: string }) {
  const isHebrew = language === 'he';
  const { toast } = useToast();
  const [selectedCity, setSelectedCity] = useState('Tel Aviv');
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const [washDate, setWashDate] = useState('');
  const [coatCondition, setCoatCondition] = useState<'good' | 'shedding' | 'matted'>('good');
  const [showQRCode, setShowQRCode] = useState(false);

  const { data: pets = [], isLoading: petsLoading } = useQuery<Pet[]>({
    queryKey: ['/api/pets'],
  });

  const { data: washSchedules = [], isLoading: schedulesLoading } = useQuery<WashSchedule[]>({
    queryKey: ['/api/pet-care/wash-schedules'],
  });

  // Fetch real loyalty data from API
  const { data: loyaltyData, isLoading: loyaltyLoading } = useQuery<{
    tier: 'new' | 'silver' | 'gold' | 'platinum';
    totalWashes: number;
    giftBalance: number;
    washesUntilNextTier: number;
    nextTier: string | null;
  }>({
    queryKey: ['/api/loyalty/user-profile'],
  });

  const scheduleWashMutation = useMutation({
    mutationFn: async (data: { petId: number; date: string; city: string; coatCondition: string; daysSinceLastWash: number }) =>
      apiRequest('/api/pet-care/schedule-wash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pet-care/wash-schedules'] });
      toast({
        title: isHebrew ? '✨ רחצה נקבעה בהצלחה' : '✨ Wash Scheduled Successfully',
        description: isHebrew
          ? '🌤️ התחזית מוצגת למטה + המלצות AI מתקדמות'
          : '🌤️ Weather forecast + Advanced AI recommendations displayed below',
      });
      setWashDate('');
      setSelectedPetId(null);
      setCoatCondition('good');
    },
  });

  const handleScheduleWash = () => {
    if (!selectedPetId || !washDate) {
      toast({
        title: isHebrew ? '⚠️ שגיאה' : '⚠️ Error',
        description: isHebrew
          ? 'אנא בחר חיית מחמד ותאריך'
          : 'Please select a pet and date',
        variant: 'destructive',
      });
      return;
    }

    // Validate date is within forecast range (14 days)
    const selectedDate = new Date(washDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 14);

    if (selectedDate < today) {
      toast({
        title: isHebrew ? '⚠️ תאריך שגוי' : '⚠️ Invalid Date',
        description: isHebrew
          ? 'אנא בחר תאריך עתידי'
          : 'Please select a future date',
        variant: 'destructive',
      });
      return;
    }

    if (selectedDate > maxDate) {
      toast({
        title: isHebrew ? '⚠️ תאריך רחוק מדי' : '⚠️ Date Too Far',
        description: isHebrew
          ? 'תחזית מזג אוויר זמינה עד 14 ימים מראש. אנא בחר תאריך קרוב יותר.'
          : 'Weather forecast available up to 14 days ahead. Please select a closer date.',
        variant: 'destructive',
      });
      return;
    }

    const selectedPet = pets.find(p => p.id === selectedPetId);
    const daysSinceLastWash = selectedPet?.lastWashDate 
      ? differenceInDays(new Date(), parseISO(selectedPet.lastWashDate))
      : 7;

    scheduleWashMutation.mutate({
      petId: selectedPetId,
      date: washDate,
      city: selectedCity,
      coatCondition,
      daysSinceLastWash,
    });
  };

  const getVaccineStatus = (pet: Pet) => {
    if (!pet.nextVaccinationDate) return null;
    
    const daysUntilVaccine = differenceInDays(
      parseISO(pet.nextVaccinationDate),
      new Date()
    );

    if (daysUntilVaccine < 0) {
      return { type: 'overdue', days: Math.abs(daysUntilVaccine) };
    } else if (daysUntilVaccine <= 60) {
      return { type: 'due-soon', days: daysUntilVaccine };
    }
    return { type: 'current', days: daysUntilVaccine };
  };

  const calculateWashReminder = (pet: Pet) => {
    if (!pet.lastWashDate) return null;
    
    const WASH_GOAL_DAYS = 14;
    const lastWash = parseISO(pet.lastWashDate);
    const daysSince = differenceInDays(new Date(), lastWash);
    const daysUntilDue = WASH_GOAL_DAYS - daysSince;
    
    if (daysUntilDue <= 0) {
      return { type: 'overdue', days: Math.abs(daysUntilDue), message: isHebrew ? '✅ מוכן עכשיו! הזמן לרחצה טרייה.' : '✅ READY NOW! Your pet is due for a fresh wash.' };
    } else if (daysUntilDue <= 3) {
      return { type: 'due-soon', days: daysUntilDue, message: isHebrew ? `⚠️ קרוב! רחצה נדרשת תוך ${daysUntilDue} ימים.` : `⚠️ DUE SOON! Wash is due in ${daysUntilDue} days.` };
    }
    return { type: 'on-track', days: daysUntilDue, message: isHebrew ? `🗓️ במסלול! רחצה הבאה בעוד ${daysUntilDue} ימים.` : `🗓️ On track! Next wash in ${daysUntilDue} days.` };
  };

  const generateNayaxQRCode = () => {
    const redeemAmount = Math.min(10.00, loyaltyData.giftBalance);
    const uniqueToken = `NAYAX-GIFT-${loyaltyData.tier.toUpperCase()}-${Date.now()}`;
    const redeemURL = `https://petwash.co.il/redeem?token=${uniqueToken}&amount=${redeemAmount.toFixed(2)}`;
    
    return {
      amount: redeemAmount,
      url: redeemURL,
      token: uniqueToken,
    };
  };

  const downloadCalendarEvent = (petName: string, washDate: string) => {
    const tierConfig = TIER_CONFIG[loyaltyData.tier];
    const title = `Wash Due: ${petName} (${loyaltyData.tier.toUpperCase()} Member)`;
    const details = `Time to look paw-some! Redeem your ${tierConfig.discount}% loyalty discount at the K9000 station.`;
    const dateString = washDate.replace(/-/g, '');
    
    const calendarData = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${title}\nDTSTART:${dateString}\nDTEND:${dateString}\nDESCRIPTION:${details}\nEND:VEVENT\nEND:VCALENDAR`;
    
    const blob = new Blob([calendarData], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `petwash-${petName}-${washDate}.ics`;
    link.click();
    
    toast({
      title: isHebrew ? '📅 הארוע נוסף ליומן' : '📅 Calendar Event Downloaded',
      description: isHebrew ? 'פתח את הקובץ להוספה ליומן שלך' : 'Open the file to add to your calendar',
    });
  };

  const getWeatherIcon = (condition: string) => {
    if (condition.includes('rain') || condition.includes('shower')) {
      return <CloudRain className="h-8 w-8 text-blue-500 icon-glow-blue" />;
    } else if (condition.includes('snow')) {
      return <Snowflake className="h-8 w-8 text-blue-300 icon-glow-blue" />;
    } else if (condition.includes('cloud')) {
      return <Thermometer className="h-8 w-8 text-gray-500" />;
    }
    return <Sun className="h-8 w-8 text-yellow-500 icon-glow-gold" />;
  };

  const getWeatherBadge = (recommendation: string, priority?: string) => {
    if (priority === 'postpone' || priority === 'health-risk' || recommendation.includes('HIGH RAIN RISK') || recommendation.includes('TOO COLD') || recommendation.includes('SKIN ALERT')) {
      return (
        <Badge variant="destructive" className="gap-2 px-4 py-2 text-sm font-semibold animate-pulse">
          <AlertCircle className="h-4 w-4" /> {recommendation}
        </Badge>
      );
    } else if (priority === 'urgent' || recommendation.includes('WASH ASAP')) {
      return (
        <Badge className="gap-2 px-4 py-2 text-sm font-semibold bg-gradient-metallic-rose text-white border-0 animate-pulse">
          <TrendingUp className="h-4 w-4" /> {recommendation}
        </Badge>
      );
    } else if (priority === 'recommended' || priority === 'optimal') {
      return (
        <Badge className="gap-2 px-4 py-2 text-sm font-semibold bg-green-500 hover:bg-green-600 border-0">
          <CheckCircle2 className="h-4 w-4" /> {recommendation}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-2 px-4 py-2 text-sm font-semibold">
          {recommendation}
        </Badge>
    );
  };

  // Safe tier config with fallback during loading
  const tierConfig = loyaltyData ? TIER_CONFIG[loyaltyData.tier] : TIER_CONFIG['new'];
  const qrData = loyaltyData ? generateNayaxQRCode() : { amount: 0, url: '', token: '' };

  if (petsLoading || loyaltyLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-metallic-platinum rounded w-1/4"></div>
          <div className="h-64 bg-metallic-silver rounded"></div>
          <div className="h-48 bg-metallic-gold rounded"></div>
        </div>
      </div>
    );
  }

  // Fallback if loyaltyData fails to load
  if (!loyaltyData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">
          <p>Failed to load loyalty data. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl" dir={isHebrew ? 'rtl' : 'ltr'}>
      {/* Luxury Hero Section */}
      <div className="mb-12 text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Sparkles className="h-12 w-12 icon-glow-gold animate-pulse" />
          <h1 className="text-5xl font-bold text-metallic-gold">
            {isHebrew ? '🐾 מתכנן טיפול יוקרתי לחיות מחמד' : '🐾 Luxury Pet Care Planner'}
          </h1>
          <Heart className="h-12 w-12 icon-glow-rose animate-pulse" />
        </div>
        <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
          {isHebrew
            ? '✨ ניהול חיסונים חכם, תזמון רחצות פרימיום, AI מתקדם + מערכת נאמנות VIP 🌟'
            : '✨ Smart vaccine management, premium wash scheduling, Advanced AI + VIP Loyalty System 🌟'}
        </p>
      </div>

      {/* 2026 INNOVATIVE HUB: LOYALTY WALLET */}
      <Card className="mb-8 border-metallic-platinum hover-glow-platinum shadow-luxury transition-all duration-300 hover:scale-[1.01]">
        <CardHeader className="bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white rounded-t-lg border-b-4 border-metallic-platinum">
          <CardTitle className="flex items-center gap-3 text-2xl font-bold">
            <Award className="h-7 w-7 animate-pulse text-yellow-400" />
            {isHebrew ? '🏆 ארנק נאמנות VIP' : '🏆 VIP Loyalty Wallet'}
          </CardTitle>
          <CardDescription className="text-gray-100 text-base mt-2 font-medium">
            {isHebrew
              ? '💎 הטבות אקסקלוסיביות, כרטיסי מתנה ופדיון Nayax QR'
              : '💎 Exclusive Benefits, Gift Cards & Nayax QR Redemption'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 bg-gradient-to-br from-purple-50 via-white to-blue-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tier Badge */}
            <div className="text-center p-6 rounded-xl bg-white border-2 border-purple-300 shadow-md hover:scale-105 transition-all">
              <div className="text-5xl mb-3">{tierConfig.badge}</div>
              <h3 className="font-bold text-2xl mb-2" style={{ color: tierConfig.color.dark }}>
                {loyaltyData.tier.toUpperCase()}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {isHebrew ? `${loyaltyData.totalWashes} רחצות סה"כ` : `${loyaltyData.totalWashes} Total Washes`}
              </p>
              <Badge className="px-4 py-2 text-base font-bold" style={{ background: tierConfig.color.dark }}>
                {tierConfig.discount}% {isHebrew ? 'הנחה' : 'Discount'}
              </Badge>
            </div>

            {/* E-Gift Balance */}
            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-400 shadow-md hover:scale-105 transition-all">
              <Gift className="h-12 w-12 mx-auto mb-3 text-green-600 icon-glow-gold" />
              <h3 className="font-bold text-lg text-muted-foreground mb-2">
                {isHebrew ? '💳 יתרת כרטיס מתנה' : '💳 E-Gift Balance'}
              </h3>
              <p className="text-4xl font-bold text-green-600 mb-2">
                ₪{loyaltyData.giftBalance.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {isHebrew ? `עד ₪${qrData.amount.toFixed(2)} לפדיון` : `Up to ₪${qrData.amount.toFixed(2)} redeemable`}
              </p>
            </div>

            {/* Nayax QR Redemption */}
            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-100 border-2 border-blue-400 shadow-md hover:scale-105 transition-all">
              <QrCode className="h-12 w-12 mx-auto mb-3 text-blue-600 icon-glow-blue" />
              <h3 className="font-bold text-lg text-muted-foreground mb-2">
                {isHebrew ? '📱 פדיון Nayax QR' : '📱 Nayax QR Redemption'}
              </h3>
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(qrData.url);
                  toast({
                    title: isHebrew ? '✅ הקוד הועתק!' : '✅ Code Copied!',
                    description: isHebrew ? 'הדבק בארנק הדיגיטלי שלך' : 'Paste in your digital wallet',
                  });
                }}
                className="btn-luxury-blue w-full text-sm py-2 mt-2"
                data-testid="button-copy-qr"
              >
                <Download className="h-4 w-4 mr-2" />
                {isHebrew ? 'העתק קישור QR' : 'Copy QR Link'}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                {isHebrew ? 'סרוק ב-K9000 לזיכוי מיידי' : 'Scan at K9000 for instant credit'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Vaccine Tracker - Ultra Luxury Design */}
        <Card className="border-metallic-rose hover-glow-rose shadow-luxury transition-all duration-300 hover:scale-[1.02]">
          <CardHeader className="bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white rounded-t-lg border-b-4 border-pink-500">
            <CardTitle className="flex items-center gap-3 text-2xl font-bold">
              <Star className="h-7 w-7 animate-pulse text-pink-400" />
              {isHebrew ? '💉 מעקב חיסונים + תזכורות רחצה' : '💉 Vaccine Tracker + Wash Reminders'}
            </CardTitle>
            <CardDescription className="text-gray-100 text-base mt-2 font-medium">
              {isHebrew
                ? '🔔 תזכורות אוטומטיות חכמות (יעד: 14 ימים בין רחצות)'
                : '🔔 Smart automatic reminders (Goal: 14 days between washes)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 bg-gradient-to-br from-pink-50 to-white">
            {pets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Heart className="h-16 w-16 mx-auto mb-4 text-pink-300" />
                <p className="text-lg">{isHebrew ? '🐕 לא נמצאו חיות מחמד. הוסף חיית מחמד בהגדרות.' : '🐕 No pets found. Add a pet in settings.'}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {pets.map((pet, index) => {
                  const vaccineStatus = getVaccineStatus(pet);
                  const washReminder = calculateWashReminder(pet);
                  const bgColors = ['bg-white', 'bg-gradient-to-br from-purple-50 to-white', 'bg-gradient-to-br from-blue-50 to-white'];
                  
                  return (
                    <div
                      key={pet.id}
                      className={`${bgColors[index % bgColors.length]} border-2 border-metallic-rose rounded-xl p-5 hover:shadow-luxury transition-all duration-300 hover:scale-[1.03]`}
                      data-testid={`vaccine-pet-${pet.id}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-2xl text-metallic-rose flex items-center gap-2">
                            🐾 {pet.name}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-500" />
                            {pet.breed} • {pet.age} {isHebrew ? 'שנים' : 'years'} • {pet.weight}
                          </p>
                        </div>
                        {vaccineStatus && (
                          <div>
                            {vaccineStatus.type === 'overdue' && (
                              <Badge variant="destructive" className="gap-2 px-4 py-2 text-sm font-bold animate-pulse">
                                <AlertCircle className="h-4 w-4" />
                                ⚠️ {isHebrew ? 'פג תוקף!' : 'Overdue!'}
                              </Badge>
                            )}
                            {vaccineStatus.type === 'due-soon' && (
                              <Badge className="gap-2 px-4 py-2 text-sm font-bold bg-metallic-gold text-white border-0 animate-pulse">
                                <AlertCircle className="h-4 w-4" />
                                ⏰ {isHebrew ? `${vaccineStatus.days} ימים` : `${vaccineStatus.days} days`}
                              </Badge>
                            )}
                            {vaccineStatus.type === 'current' && (
                              <Badge variant="outline" className="gap-2 px-4 py-2 text-sm font-bold border-green-500 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                ✅ {isHebrew ? 'תקין' : 'Current'}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Wash Reminder */}
                      {washReminder && (
                        <div className={`mb-4 rounded-lg p-4 border-2 ${
                          washReminder.type === 'overdue' ? 'bg-red-50 border-red-300' :
                          washReminder.type === 'due-soon' ? 'bg-yellow-50 border-yellow-300' :
                          'bg-blue-50 border-blue-300'
                        }`}>
                          <p className="text-sm font-semibold flex items-center gap-2">
                            <Droplets className="h-5 w-5" />
                            {washReminder.message}
                          </p>
                          {washReminder.type !== 'on-track' && (
                            <Button
                              onClick={() => downloadCalendarEvent(pet.name, format(new Date(Date.now() + washReminder.days * 86400000), 'yyyy-MM-dd'))}
                              className="mt-2 btn-luxury-blue text-xs py-1 px-3"
                              data-testid={`button-calendar-sync-${pet.id}`}
                            >
                              <Calendar className="h-3 w-3 mr-1" />
                              {isHebrew ? 'סנכרן ליומן' : 'Sync to Calendar'}
                            </Button>
                          )}
                        </div>
                      )}
                      
                      {pet.nextVaccinationDate ? (
                        <div className="mt-4 bg-metallic-platinum rounded-lg p-4 border-2 border-purple-200">
                          <p className="text-sm font-semibold flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-purple-600" />
                            {isHebrew ? '📅 חיסון הבא:' : '📅 Next Vaccine:'}
                            <span className="ml-2 font-bold text-purple-700 text-base">
                              {format(parseISO(pet.nextVaccinationDate), 'MMMM dd, yyyy')}
                            </span>
                          </p>
                          {pet.vaccinationNotes && (
                            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-yellow-500" />
                              {pet.vaccinationNotes}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic mt-3">
                          {isHebrew ? '📋 לא נקבע חיסון' : '📋 No vaccine scheduled'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wash Scheduler - Ultra Luxury Design with AI */}
        <Card className="border-metallic-gold hover-glow-gold shadow-luxury transition-all duration-300 hover:scale-[1.02]">
          <CardHeader className="bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white rounded-t-lg border-b-4 border-yellow-500">
            <CardTitle className="flex items-center gap-3 text-2xl font-bold">
              <Droplets className="h-7 w-7 animate-pulse text-yellow-400" />
              {isHebrew ? '🌤️ מתזמן רחצות פרימיום + AI חכם' : '🌤️ Premium Wash Scheduler + Smart AI'}
            </CardTitle>
            <CardDescription className="text-gray-100 text-base mt-2 font-medium">
              {isHebrew
                ? '🧠 החלטות AI רב-גורמיות: מזג אוויר + אבקנים + מצב פרווה'
                : '🧠 Multi-Factor AI: Weather + Pollen + Coat Condition'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 bg-gradient-to-br from-yellow-50 to-white">
            <div className="space-y-5 mb-8">
              <div>
                <Label htmlFor="city-input" className="text-base font-semibold flex items-center gap-2">
                  🌍 {isHebrew ? 'עיר לתחזית מזג אוויר:' : 'City for Weather Forecast:'}
                </Label>
                <Input
                  id="city-input"
                  type="text"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  placeholder={isHebrew ? 'תל אביב' : 'Tel Aviv'}
                  className="mt-2 border-2 border-blue-300 focus:border-blue-500 rounded-lg py-6 text-base"
                  data-testid="input-city"
                />
              </div>

              <div>
                <Label htmlFor="pet-select" className="text-base font-semibold flex items-center gap-2">
                  🐶 {isHebrew ? 'בחר חיית מחמד:' : 'Select Pet:'}
                </Label>
                <select
                  id="pet-select"
                  value={selectedPetId || ''}
                  onChange={(e) => setSelectedPetId(Number(e.target.value))}
                  className="w-full mt-2 px-4 py-3 border-2 border-blue-300 focus:border-blue-500 rounded-lg text-base font-medium"
                  data-testid="select-pet"
                >
                  <option value="">{isHebrew ? 'בחר...' : '✨ Choose...'}</option>
                  {pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      🐾 {pet.name} ({pet.breed})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="coat-condition" className="text-base font-semibold flex items-center gap-2">
                  🐕 {isHebrew ? 'מצב פרווה:' : 'Coat Condition:'}
                </Label>
                <select
                  id="coat-condition"
                  value={coatCondition}
                  onChange={(e) => setCoatCondition(e.target.value as 'good' | 'shedding' | 'matted')}
                  className="w-full mt-2 px-4 py-3 border-2 border-blue-300 focus:border-blue-500 rounded-lg text-base font-medium"
                  data-testid="select-coat-condition"
                >
                  <option value="good">✅ {isHebrew ? 'טוב' : 'Good'}</option>
                  <option value="shedding">🌾 {isHebrew ? 'נושר' : 'Shedding'}</option>
                  <option value="matted">⚠️ {isHebrew ? 'מסובך' : 'Matted'}</option>
                </select>
              </div>

              <div>
                <Label htmlFor="wash-date" className="text-base font-semibold flex items-center gap-2">
                  📆 {isHebrew ? 'תאריך רחצה:' : 'Wash Date:'}
                </Label>
                <Input
                  id="wash-date"
                  type="date"
                  value={washDate}
                  onChange={(e) => setWashDate(e.target.value)}
                  className="mt-2 border-2 border-blue-300 focus:border-blue-500 rounded-lg py-6 text-base"
                  data-testid="input-wash-date"
                />
              </div>

              <button
                onClick={handleScheduleWash}
                disabled={scheduleWashMutation.isPending}
                className="btn-luxury-gold w-full text-lg py-4 flex items-center justify-center gap-3 disabled:opacity-50"
                data-testid="button-schedule-wash"
              >
                <Sparkles className="h-6 w-6" />
                {scheduleWashMutation.isPending
                  ? (isHebrew ? '⏳ מתזמן...' : '⏳ Scheduling...')
                  : (isHebrew ? '🧠 תזמן רחצה + AI Analysis' : '🧠 Schedule Wash + AI Analysis')}
              </button>
            </div>

            <Separator className="my-8 bg-gradient-to-r from-transparent via-yellow-300 to-transparent h-0.5" />

            {/* Scheduled Washes with AI Recommendations */}
            <div className="space-y-4">
              <h3 className="font-bold text-xl text-muted-foreground flex items-center gap-2">
                <Calendar className="h-6 w-6 text-blue-500" />
                {isHebrew ? '📋 רחצות מתוכננות + המלצות AI' : '📋 Scheduled Washes + AI Recommendations'}
              </h3>
              
              {schedulesLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-24 bg-metallic-silver rounded-lg"></div>
                  <div className="h-24 bg-metallic-platinum rounded-lg"></div>
                </div>
              ) : washSchedules.length === 0 ? (
                <div className="text-center py-8">
                  <Droplets className="h-16 w-16 mx-auto mb-4 text-blue-300" />
                  <p className="text-base text-muted-foreground">
                    {isHebrew ? '💧 אין רחצות מתוכננות עדיין' : '💧 No washes scheduled yet'}
                  </p>
                </div>
              ) : (
                washSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="border-2 border-metallic-gold rounded-xl p-5 space-y-3 bg-white hover:shadow-luxury transition-all duration-300 hover:scale-[1.02]"
                    data-testid={`wash-schedule-${schedule.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-xl flex items-center gap-2">
                          🐾 {schedule.petName}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {format(parseISO(schedule.scheduledDate), 'EEEE, MMMM dd, yyyy')}
                        </p>
                      </div>
                      <Badge 
                        variant={schedule.status === 'completed' ? 'default' : 'outline'} 
                        className="px-4 py-2 text-sm font-bold"
                      >
                        {schedule.status === 'completed' ? '✅' : '⏳'} {schedule.status}
                      </Badge>
                    </div>
                    
                    {schedule.weather && (
                      <>
                        <div className="bg-gradient-to-br from-blue-100 to-cyan-50 rounded-xl p-4 space-y-3 border-2 border-blue-200">
                          <div className="flex items-center gap-3">
                            {getWeatherIcon(schedule.weather.condition)}
                            <span className="font-bold text-2xl">{schedule.weather.temperature}°C</span>
                            <span className="text-base text-muted-foreground font-medium">
                              {schedule.weather.description}
                            </span>
                          </div>
                          
                          {schedule.weather.pollenLevel && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold">🌸 Pollen Level:</span>
                              <Badge variant={schedule.weather.pollenRisk === 'high' ? 'destructive' : 'outline'}>
                                {schedule.weather.pollenLevel}/10 ({schedule.weather.pollenRisk})
                              </Badge>
                              <span className="font-semibold ml-4">☔ Rain Chance:</span>
                              <Badge variant={schedule.weather.rainChance && schedule.weather.rainChance > 40 ? 'destructive' : 'outline'}>
                                {schedule.weather.rainChance}%
                              </Badge>
                            </div>
                          )}
                          
                          <div className="mt-3">
                            {getWeatherBadge(schedule.weather.recommendation, schedule.weather.priority)}
                          </div>
                          
                          {schedule.weather.actionAdvice && (
                            <p className="text-sm font-medium text-blue-700 mt-2">
                              💡 {schedule.weather.actionAdvice}
                            </p>
                          )}
                        </div>
                        
                        {/* Data Snapshot for Transparency */}
                        {schedule.weather.dataSnapshot && (
                          <details className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-300">
                            <summary className="cursor-pointer font-semibold text-sm text-gray-700 flex items-center gap-2">
                              📊 {isHebrew ? 'נתוני החלטה AI (שקיפות)' : 'AI Decision Data Snapshot (Transparency)'}
                            </summary>
                            <div className="mt-3 space-y-1 text-xs text-gray-600">
                              {Object.entries(schedule.weather.dataSnapshot).map(([key, value]) => (
                                <div key={key} className="flex justify-between border-b border-gray-200 py-1">
                                  <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                  <span>{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
