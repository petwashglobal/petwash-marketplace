import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Smartphone, Download, Apple, CheckCircle, QrCode, Zap, Shield } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";
import { SiAndroid } from "react-icons/si";
import { useLocation } from "wouter";

export default function WalletDownload() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [, setLocation] = useLocation();

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <div className="min-h-screen luxury-bg-mesh">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="text-center mb-16 luxury-animate-fade-in">
            <div className="flex items-center justify-center gap-4 mb-6">
              <Smartphone className="w-16 h-16 text-blue-600 dark:text-blue-400" />
            </div>
            
            <h1 className="luxury-heading-xl mb-6">
              {isHebrew ? 'כרטיס ה-VIP שלך ב-Wallet' : 'Your VIP Card in Wallet'}
            </h1>
            
            <p className="luxury-text-body max-w-3xl mx-auto mb-8">
              {isHebrew 
                ? 'הורד את כרטיס ה-VIP והביקור הדיגיטלי שלך ישירות ל-Apple Wallet או Google Wallet. תמיד זמין, תמיד מאובטח.'
                : 'Download your VIP loyalty and digital business cards directly to Apple Wallet or Google Wallet. Always available, always secure.'}
            </p>

            {/* Device Detection Banner */}
            {isIOS && (
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-black text-white rounded-full text-lg font-medium shadow-lg">
                <Apple className="w-6 h-6" />
                <span>{isHebrew ? 'נמצא iPhone - מוכן ל-Apple Wallet!' : 'iPhone Detected - Ready for Apple Wallet!'}</span>
              </div>
            )}
            
            {isAndroid && (
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-full text-lg font-medium shadow-lg">
                <SiAndroid className="w-6 h-6" />
                <span>{isHebrew ? 'נמצא Android - מוכן ל-Google Wallet!' : 'Android Detected - Ready for Google Wallet!'}</span>
              </div>
            )}
          </div>

          {/* Coming Soon Banner */}
          <div className="flex flex-col items-center justify-center mb-16 luxury-animate-fade-in luxury-delay-1">
            <div className="relative w-full max-w-2xl">
              {/* Premium Glass Card */}
              <div 
                className="relative overflow-hidden rounded-3xl p-8 sm:p-12 text-center"
                style={{
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,248,250,0.95) 100%)',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5)',
                  border: '1px solid rgba(198,166,100,0.2)',
                }}
              >
                {/* Holographic Shimmer */}
                <div 
                  className="absolute inset-0 opacity-30 pointer-events-none"
                  style={{
                    background: 'linear-gradient(125deg, transparent 0%, rgba(198,166,100,0.2) 25%, transparent 50%, rgba(198,166,100,0.15) 75%, transparent 100%)',
                    backgroundSize: '200% 200%',
                    animation: 'shimmer 3s ease-in-out infinite',
                  }}
                />
                
                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 mb-6">
                    <Smartphone className="w-10 h-10 text-amber-600" />
                  </div>
                  
                  <div className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-sm font-semibold mb-4">
                    {isHebrew ? 'בקרוב' : 'COMING SOON'}
                  </div>
                  
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                    {isHebrew ? 'Apple Wallet & Google Wallet' : 'Apple Wallet & Google Wallet'}
                  </h2>
                  
                  <p className="text-gray-600 max-w-md mx-auto mb-8">
                    {isHebrew 
                      ? 'אנחנו עובדים על אינטגרציה מלאה עם Apple Wallet ו-Google Wallet. הכרטיסים הדיגיטליים שלכם יהיו זמינים בקרוב!'
                      : "We're working on full integration with Apple Wallet and Google Wallet. Your digital cards will be available soon!"}
                  </p>

                  {/* View Loyalty Dashboard Link */}
                  <button 
                    onClick={() => setLocation('/loyalty/dashboard')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-black text-white font-medium hover:bg-gray-900 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    data-testid="link-loyalty-dashboard"
                  >
                    <CreditCard className="w-5 h-5" />
                    {isHebrew ? 'צפייה בכרטיס ה-VIP שלי' : 'View My VIP Card'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="luxury-glass-card luxury-hover-glow luxury-shadow-xl luxury-animate-fade-in luxury-delay-2">
              <CardHeader>
                <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900 rounded-2xl flex items-center justify-center mb-4">
                  <CreditCard className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-xl">
                  {isHebrew ? 'כרטיס VIP יוקרתי' : 'Luxury VIP Card'}
                </CardTitle>
                <CardDescription>
                  {isHebrew 
                    ? 'עיצוב בסגנון כרטיס בנק פרימיום עם עדכוני נקודות בזמן אמת'
                    : 'Premium bank-card style design with real-time points updates'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{isHebrew ? 'עדכונים אוטומטיים' : 'Automatic updates'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{isHebrew ? '4 רמות VIP' : '4 VIP tiers'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{isHebrew ? 'הנחות בלעדיות' : 'Exclusive discounts'}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="luxury-glass-card luxury-hover-glow luxury-shadow-xl luxury-animate-fade-in luxury-delay-3">
              <CardHeader>
                <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900 rounded-2xl flex items-center justify-center mb-4">
                  <QrCode className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-xl">
                  {isHebrew ? 'QR מהיר' : 'Quick QR Scan'}
                </CardTitle>
                <CardDescription>
                  {isHebrew 
                    ? 'סרוק בתחנות Pet Wash לתשלום מיידי עם ההנחה שלך'
                    : 'Scan at Pet Wash stations for instant payment with your discount'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{isHebrew ? 'תשלום ללא מגע' : 'Contactless payment'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{isHebrew ? 'תואם Nayax' : 'Nayax compatible'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{isHebrew ? 'גישה מהירה' : 'Lock screen access'}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="luxury-glass-card luxury-hover-glow luxury-shadow-xl luxury-animate-fade-in luxury-delay-4">
              <CardHeader>
                <div className="w-14 h-14 bg-pink-100 dark:bg-pink-900 rounded-2xl flex items-center justify-center mb-4">
                  <Shield className="w-8 h-8 text-pink-600 dark:text-pink-400" />
                </div>
                <CardTitle className="text-xl">
                  {isHebrew ? 'מאובטח לחלוטין' : 'Totally Secure'}
                </CardTitle>
                <CardDescription>
                  {isHebrew 
                    ? 'הצפנה ברמת בנק עם אימות קריפטוגרפי'
                    : 'Bank-level encryption with cryptographic authentication'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{isHebrew ? 'הצפנה 256-bit' : '256-bit encryption'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{isHebrew ? 'אימות Firebase' : 'Firebase auth'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{isHebrew ? 'תקן ISO 27001' : 'ISO 27001 compliant'}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* How It Works */}
          <div className="mt-20 max-w-4xl mx-auto luxury-animate-fade-in luxury-delay-5">
            <h2 className="luxury-heading-lg text-center mb-12">
              {isHebrew ? 'איך זה עובד?' : 'How It Works?'}
            </h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 luxury-btn-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 luxury-shadow-md">
                  1
                </div>
                <h3 className="luxury-heading-sm mb-2">
                  {isHebrew ? 'לחץ להורדה' : 'Click Download'}
                </h3>
                <p className="luxury-text-body">
                  {isHebrew 
                    ? 'בחר Apple Wallet או Google Wallet לפי המכשיר שלך'
                    : 'Choose Apple Wallet or Google Wallet for your device'}
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 luxury-btn-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 luxury-shadow-md">
                  2
                </div>
                <h3 className="luxury-heading-sm mb-2">
                  {isHebrew ? 'התחבר לחשבון' : 'Sign In'}
                </h3>
                <p className="luxury-text-body">
                  {isHebrew 
                    ? 'התחבר כדי לקבל את כרטיס ה-VIP האישי שלך'
                    : 'Sign in to get your personalized VIP card'}
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 luxury-btn-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 luxury-shadow-md">
                  3
                </div>
                <h3 className="luxury-heading-sm mb-2">
                  {isHebrew ? 'השתמש בתחנות' : 'Use at Stations'}
                </h3>
                <p className="luxury-text-body">
                  {isHebrew 
                    ? 'סרוק את ה-QR מהכרטיס שלך בתחנות Pet Wash'
                    : 'Scan the QR from your card at Pet Wash stations'}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-20 text-center luxury-animate-fade-in luxury-delay-6">
            <div className="inline-block p-8 luxury-glass-card luxury-shadow-xl rounded-3xl">
              <h3 className="luxury-heading-lg mb-4">
                {isHebrew ? 'מוכן להתחיל?' : 'Ready to Start?'}
              </h3>
              <p className="luxury-text-body mb-6">
                {isHebrew 
                  ? 'הצטרף לאלפי לקוחות VIP שכבר נהנים מחוויית Wallet דיגיטלית'
                  : 'Join thousands of VIP customers already enjoying the digital Wallet experience'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="luxury-btn-primary luxury-shadow-xl text-lg px-8 py-6"
                  onClick={() => setLocation('/loyalty/dashboard')}
                  data-testid="button-get-started"
                >
                  <Download className="w-5 h-5 mr-2" />
                  {isHebrew ? 'התחל עכשיו' : 'Get Started Now'}
                </Button>
                
                <Button 
                  size="lg" 
                  variant="outline"
                  className="luxury-btn-secondary text-lg px-8 py-6"
                  onClick={() => setLocation('/team-cards')}
                  data-testid="button-team-cards"
                >
                  {isHebrew ? 'כרטיסי הצוות שלנו' : 'Our Team Cards'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
