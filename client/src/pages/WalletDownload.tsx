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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20"></div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-4 mb-6">
              <Smartphone className="w-16 h-16 text-blue-600 dark:text-blue-400" />
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              {isHebrew ? 'כרטיס ה-VIP שלך ב-Wallet' : 'Your VIP Card in Wallet'}
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-8">
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

          {/* Main CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            {/* Apple Wallet Button */}
            <a 
              href="/loyalty/dashboard" 
              className="group relative"
              data-testid="link-apple-wallet-download"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-black via-gray-800 to-black rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <div className="relative flex items-center gap-4 px-8 py-6 bg-black rounded-2xl hover:bg-gray-900 transition-all duration-200 shadow-2xl">
                <Apple className="w-12 h-12 text-white" />
                <div className="text-left">
                  <div className="text-sm text-gray-300">{isHebrew ? 'הורד ב-' : 'Download on the'}</div>
                  <div className="text-2xl font-bold text-white">Apple Wallet</div>
                </div>
              </div>
            </a>

            {/* Google Wallet Button */}
            <a 
              href="/loyalty/dashboard" 
              className="group relative"
              data-testid="link-google-wallet-download"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <div className="relative flex items-center gap-4 px-8 py-6 bg-blue-600 rounded-2xl hover:bg-blue-700 transition-all duration-200 shadow-2xl">
                <SiAndroid className="w-12 h-12 text-white" />
                <div className="text-left">
                  <div className="text-sm text-blue-100">{isHebrew ? 'הורד ב-' : 'Download on'}</div>
                  <div className="text-2xl font-bold text-white">Google Wallet</div>
                </div>
              </div>
            </a>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="border-2 border-blue-200 dark:border-blue-800 hover:shadow-xl transition-shadow">
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

            <Card className="border-2 border-purple-200 dark:border-purple-800 hover:shadow-xl transition-shadow">
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

            <Card className="border-2 border-pink-200 dark:border-pink-800 hover:shadow-xl transition-shadow">
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
          <div className="mt-20 max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12 text-gray-900 dark:text-white">
              {isHebrew ? 'איך זה עובד?' : 'How It Works?'}
            </h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  1
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  {isHebrew ? 'לחץ להורדה' : 'Click Download'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {isHebrew 
                    ? 'בחר Apple Wallet או Google Wallet לפי המכשיר שלך'
                    : 'Choose Apple Wallet or Google Wallet for your device'}
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  2
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  {isHebrew ? 'התחבר לחשבון' : 'Sign In'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {isHebrew 
                    ? 'התחבר כדי לקבל את כרטיס ה-VIP האישי שלך'
                    : 'Sign in to get your personalized VIP card'}
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  3
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  {isHebrew ? 'השתמש בתחנות' : 'Use at Stations'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {isHebrew 
                    ? 'סרוק את ה-QR מהכרטיס שלך בתחנות Pet Wash'
                    : 'Scan the QR from your card at Pet Wash stations'}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-20 text-center">
            <div className="inline-block p-8 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl">
              <h3 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? 'מוכן להתחיל?' : 'Ready to Start?'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {isHebrew 
                  ? 'הצטרף לאלפי לקוחות VIP שכבר נהנים מחוויית Wallet דיגיטלית'
                  : 'Join thousands of VIP customers already enjoying the digital Wallet experience'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-lg px-8 py-6"
                  onClick={() => setLocation('/loyalty/dashboard')}
                  data-testid="button-get-started"
                >
                  <Download className="w-5 h-5 mr-2" />
                  {isHebrew ? 'התחל עכשיו' : 'Get Started Now'}
                </Button>
                
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8 py-6"
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
