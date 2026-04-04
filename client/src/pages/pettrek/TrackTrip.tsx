import { Button } from "@/components/ui/button";
import { useParams, useLocation } from "wouter";
import { MapPin, Clock, Car, Phone, MessageCircle, Star, Navigation, User, CheckCircle, Circle, Share2, Headphones, Receipt, PawPrint } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";
import { useToast } from "@/hooks/use-toast";

export default function TrackTrip() {
  const { tripId } = useParams();
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();

  // Mock data for demo - in production, this would come from real-time API/WebSocket
  const tripStatus = 'in_transit'; // 'scheduled' | 'in_transit' | 'completed'
  const driverName = isHebrew ? 'דוד כהן' : 'David Cohen';
  const driverRating = 4.9;
  const vehicleModel = isHebrew ? 'טויוטה קורולה' : 'Toyota Corolla';
  const licensePlate = '12-345-67';
  const eta = 12;
  const distance = 3.5;
  const petName = isHebrew ? 'מקס' : 'Max';
  const pickupAddress = isHebrew ? 'רחוב הרצל 123, תל אביב' : '123 Herzl Street, Tel Aviv';
  const dropoffAddress = isHebrew ? 'רחוב דיזנגוף 45, תל אביב' : '45 Dizengoff Street, Tel Aviv';
  const serviceType = isHebrew ? 'הסעה רגילה' : 'Standard Transport';
  const specialInstructions = isHebrew ? 'הכלב חרד מרעשים - נא לנהוג בשקט' : 'Dog is anxious with noise - please drive quietly';

  const timelineSteps = [
    { 
      id: 'pickup', 
      label: isHebrew ? 'איסוף' : 'Pickup', 
      time: '10:30 AM', 
      status: 'completed' 
    },
    { 
      id: 'in_transit', 
      label: isHebrew ? 'בדרך' : 'In Transit', 
      time: '10:45 AM', 
      status: 'current' 
    },
    { 
      id: 'delivery', 
      label: isHebrew ? 'מסירה' : 'Delivery', 
      time: '11:00 AM', 
      status: 'pending' 
    }
  ];

  const realtimeUpdates = [
    { time: '10:45 AM', message: isHebrew ? 'הנהג בדרך ליעד' : 'Driver is on the way to destination' },
    { time: '10:35 AM', message: isHebrew ? 'הכלב נאסף בהצלחה' : 'Pet picked up successfully' },
    { time: '10:30 AM', message: isHebrew ? 'הנהג הגיע לנקודת האיסוף' : 'Driver arrived at pickup location' },
    { time: '10:25 AM', message: isHebrew ? 'הנהג בדרך לאיסוף' : 'Driver heading to pickup' }
  ];

  const getStatusBadge = () => {
    if (tripStatus === 'completed') {
      return 'luxury-badge-success';
    } else if (tripStatus === 'in_transit') {
      return 'luxury-badge-gold';
    }
    return 'luxury-badge';
  };

  const getStatusText = () => {
    if (tripStatus === 'completed') {
      return isHebrew ? '✓ הושלם' : '✓ Completed';
    } else if (tripStatus === 'in_transit') {
      return isHebrew ? '🚗 בדרך' : '🚗 In Transit';
    }
    return isHebrew ? '⏰ מתוכנן' : '⏰ Scheduled';
  };

  return (
    <div className="min-h-screen luxury-bg-mesh py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Trip Status Header */}
        <div className="luxury-animate-fade-in">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="space-y-2">
              <div className={`${getStatusBadge()} text-lg px-6 py-2 ${tripStatus === 'in_transit' ? 'animate-pulse' : ''}`}>
                {getStatusText()}
              </div>
              <h1 className="luxury-heading-lg luxury-text-gradient">
                {isHebrew ? `נסיעה #${tripId}` : `Trip #${tripId}`}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-purple-600" />
              <div>
                <p className="luxury-text-small">
                  {isHebrew ? 'זמן הגעה משוער' : 'Estimated Arrival'}
                </p>
                <p className="luxury-heading-md text-purple-600">{eta} {isHebrew ? 'דקות' : 'min'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Map & Timeline */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Live Map */}
            <div className="luxury-glass-card luxury-shadow-xl p-6 luxury-animate-slide-up luxury-delay-1">
              <div className="flex items-center gap-2 mb-4">
                <Navigation className="h-5 w-5 text-purple-600" />
                <h2 className="luxury-heading-sm">
                  {isHebrew ? 'מעקב בזמן אמת' : 'Live GPS Tracking'}
                </h2>
              </div>
              
              {/* Map Container */}
              <div className="relative bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl h-96 flex items-center justify-center overflow-hidden border-2 border-purple-100">
                <div className="text-center z-10">
                  <div className="relative inline-block">
                    <MapPin className="h-16 w-16 mx-auto text-purple-600 mb-3 animate-bounce" />
                    <div className="absolute inset-0 bg-purple-400 blur-xl opacity-50 animate-pulse"></div>
                  </div>
                  <p className="luxury-text-body font-semibold text-purple-700">
                    {isHebrew ? 'מיקום נוכחי: רחוב בן יהודה, תל אביב' : 'Current Location: Ben Yehuda St, Tel Aviv'}
                  </p>
                  <p className="luxury-text-small mt-2">
                    {isHebrew ? 'מרחק נותר' : 'Distance Remaining'}: {distance} {isHebrew ? 'ק"מ' : 'km'}
                  </p>
                </div>
                
                {/* Animated route line decoration */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
                  <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-purple-500 rounded-full animate-ping"></div>
                  <div className="absolute bottom-1/4 right-1/4 w-2 h-2 bg-red-500 rounded-full shadow-lg shadow-red-500/50"></div>
                </div>
              </div>
            </div>

            {/* Trip Timeline */}
            <div className="luxury-glass-panel p-6 luxury-animate-slide-up luxury-delay-2">
              <h2 className="luxury-heading-sm mb-6">
                {isHebrew ? 'מצב הנסיעה' : 'Trip Progress'}
              </h2>
              
              <div className="relative">
                {timelineSteps.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-4 pb-8 last:pb-0">
                    {/* Progress Dot */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        step.status === 'completed' 
                          ? 'bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/50' 
                          : step.status === 'current'
                          ? 'bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg shadow-purple-500/50 animate-pulse'
                          : 'bg-white'
                      }`}>
                        {step.status === 'completed' ? (
                          <CheckCircle className="h-6 w-6 text-white" />
                        ) : step.status === 'current' ? (
                          <Circle className="h-6 w-6 text-white fill-white" />
                        ) : (
                          <Circle className="h-6 w-6 text-gray-400" />
                        )}
                      </div>
                      
                      {/* Connecting Line */}
                      {index < timelineSteps.length - 1 && (
                        <div className={`absolute left-1/2 top-10 w-0.5 h-8 -ml-px ${
                          step.status === 'completed' ? 'bg-gradient-to-b from-green-500 to-purple-400' : 'bg-white'
                        }`}></div>
                      )}
                    </div>
                    
                    {/* Step Info */}
                    <div className="flex-1 luxury-glass-minimal p-4 rounded-xl">
                      <h3 className="luxury-heading-sm text-base mb-1">{step.label}</h3>
                      <p className="luxury-text-small">{step.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trip Details */}
            <div className="luxury-glass-card luxury-shadow-md p-6 luxury-animate-slide-up luxury-delay-3">
              <div className="flex items-center gap-2 mb-4">
                <PawPrint className="h-5 w-5 text-purple-600" />
                <h2 className="luxury-heading-sm">
                  {isHebrew ? 'פרטי הנסיעה' : 'Trip Details'}
                </h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="luxury-text-small mb-1">
                    {isHebrew ? 'חיית מחמד' : 'Pet'}
                  </p>
                  <p className="luxury-heading-sm text-base">{petName}</p>
                </div>
                
                <div className="luxury-divider"></div>
                
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="luxury-text-small mb-1">
                      {isHebrew ? 'נקודת איסוף' : 'Pickup Location'}
                    </p>
                    <p className="luxury-text-body">{pickupAddress}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-red-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="luxury-text-small mb-1">
                      {isHebrew ? 'נקודת הורדה' : 'Dropoff Location'}
                    </p>
                    <p className="luxury-text-body">{dropoffAddress}</p>
                  </div>
                </div>
                
                <div className="luxury-divider"></div>
                
                <div>
                  <p className="luxury-text-small mb-2">
                    {isHebrew ? 'סוג שירות' : 'Service Type'}
                  </p>
                  <span className="luxury-badge">{serviceType}</span>
                </div>
                
                {specialInstructions && (
                  <>
                    <div className="luxury-divider"></div>
                    <div className="luxury-glass-panel p-4">
                      <p className="luxury-text-small mb-2 font-semibold">
                        {isHebrew ? 'הוראות מיוחדות' : 'Special Instructions'}
                      </p>
                      <p className="luxury-text-body">{specialInstructions}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Driver Info, Actions, Updates */}
          <div className="space-y-6">
            
            {/* Driver Info Card */}
            <div className="luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-scale-in luxury-delay-2">
              <div className="text-center mb-6">
                <div className="relative inline-block mb-4">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 p-1">
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                      <User className="h-12 w-12 text-gray-400" />
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full border-4 border-white flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                </div>
                
                <h3 className="luxury-heading-md mb-2">{driverName}</h3>
                
                <div className="inline-flex items-center gap-1 luxury-badge-gold px-4 py-2">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="font-bold">{driverRating}</span>
                  <span className="luxury-text-small">({isHebrew ? '245 נסיעות' : '245 trips'})</span>
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 luxury-glass-minimal p-3 rounded-lg">
                  <Car className="h-5 w-5 text-purple-600" />
                  <div className="flex-1">
                    <p className="luxury-text-small">
                      {isHebrew ? 'רכב' : 'Vehicle'}
                    </p>
                    <p className="luxury-text-body font-semibold">{vehicleModel}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 luxury-glass-minimal p-3 rounded-lg">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <span className="text-xs font-bold text-purple-600">#</span>
                  </div>
                  <div className="flex-1">
                    <p className="luxury-text-small">
                      {isHebrew ? 'לוחית רישוי' : 'License Plate'}
                    </p>
                    <p className="luxury-text-body font-semibold font-mono">{licensePlate}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <Button
                  className="luxury-btn-primary w-full flex items-center justify-center gap-2"
                  data-testid="button-call-driver"
                  onClick={() => {
                    toast({ title: isHebrew ? 'מחייג לנהג...' : 'Calling driver...', description: driverName });
                    window.location.href = 'tel:+972501234567';
                  }}
                >
                  <Phone className="h-5 w-5" />
                  {isHebrew ? 'התקשר לנהג' : 'Call Driver'}
                </Button>
                
                <Button
                  className="luxury-btn-secondary w-full flex items-center justify-center gap-2"
                  data-testid="button-message-driver"
                  onClick={() => setLocation(`/pettrek/chat/${tripId}`)}
                >
                  <MessageCircle className="h-5 w-5" />
                  {isHebrew ? 'שלח הודעה' : 'Send Message'}
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="luxury-glass-card luxury-shadow-md p-6 luxury-animate-scale-in luxury-delay-3">
              <h3 className="luxury-heading-sm mb-4">
                {isHebrew ? 'פעולות מהירות' : 'Quick Actions'}
              </h3>
              
              <div className="luxury-grid-3 gap-3">
                <Button
                  className="luxury-btn-secondary p-4 flex flex-col items-center gap-2 text-center"
                  data-testid="button-share-location"
                  onClick={async () => {
                    const shareData = {
                      title: isHebrew ? 'מיקום החיה שלי' : 'My Pet\'s Location',
                      text: isHebrew ? `מעקב אחר נסיעה #${tripId} — הגעה בעוד ${eta} דקות` : `Tracking trip #${tripId} — ETA ${eta} min`,
                      url: window.location.href,
                    };
                    if (navigator.share && navigator.canShare?.(shareData)) {
                      await navigator.share(shareData);
                    } else {
                      await navigator.clipboard.writeText(window.location.href);
                      toast({ title: isHebrew ? 'קישור הועתק' : 'Link copied', description: isHebrew ? 'שתף אותו עם המשפחה' : 'Share it with family' });
                    }
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                    <Share2 className="h-6 w-6 text-purple-600" />
                  </div>
                  <span className="luxury-text-small font-semibold">
                    {isHebrew ? 'שתף מיקום' : 'Share Location'}
                  </span>
                </Button>
                
                <Button
                  className="luxury-btn-secondary p-4 flex flex-col items-center gap-2 text-center"
                  data-testid="button-contact-support"
                  onClick={() => setLocation('/support')}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                    <Headphones className="h-6 w-6 text-purple-600" />
                  </div>
                  <span className="luxury-text-small font-semibold">
                    {isHebrew ? 'תמיכה' : 'Support'}
                  </span>
                </Button>
                
                <Button
                  className="luxury-btn-secondary p-4 flex flex-col items-center gap-2 text-center"
                  data-testid="button-view-receipt"
                  onClick={() => setLocation(`/pettrek/trips/${tripId}`)}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                    <Receipt className="h-6 w-6 text-purple-600" />
                  </div>
                  <span className="luxury-text-small font-semibold">
                    {isHebrew ? 'קבלה' : 'Receipt'}
                  </span>
                </Button>
              </div>
            </div>

            {/* Real-Time Updates Feed */}
            <div className="luxury-glass-panel p-6 luxury-animate-scale-in luxury-delay-4">
              <h3 className="luxury-heading-sm mb-4">
                {isHebrew ? 'עדכונים בזמן אמת' : 'Live Updates'}
              </h3>
              
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {realtimeUpdates.map((update, index) => (
                  <div 
                    key={index} 
                    className="luxury-glass-minimal luxury-hover-lift p-4 rounded-lg transition-all"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <p className="luxury-text-small text-purple-600 font-semibold mb-1">
                      {update.time}
                    </p>
                    <p className="luxury-text-body">
                      {update.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
