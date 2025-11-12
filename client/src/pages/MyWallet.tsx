import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Briefcase, Download, Apple, Shield, Zap, CheckCircle2, Smartphone, Sparkles, Building2, FileCheck, Award, Crown, Mail, Star, TrendingUp } from "lucide-react";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { SiAndroid } from "react-icons/si";
import { WalletConsentDialog } from "@/components/WalletConsentDialog";
import { useWalletTelemetry } from "@/hooks/useWalletTelemetry";

export default function MyWallet() {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const [isDownloadingVIP, setIsDownloadingVIP] = useState(false);
  const [isDownloadingBusiness, setIsDownloadingBusiness] = useState(false);
  const [isEmailingCards, setIsEmailingCards] = useState(false);
  const [showVIPConsent, setShowVIPConsent] = useState(false);
  const [showBusinessConsent, setShowBusinessConsent] = useState(false);
  const [telemetryToken, setTelemetryToken] = useState<string | null>(null);

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  
  // Role detection
  const isNirHadad = user?.displayName === 'Nir Hadad' || user?.email === 'nirhadad1@gmail.com' || user?.email === 'nir.h@petwash.co.il';
  const isIdoShakarzi = user?.displayName === 'Ido Shakarzi' || user?.email?.toLowerCase().includes('ido');
  const isCEO = isNirHadad; // Only Nir Hadad is CEO
  const isDirector = isIdoShakarzi; // Ido is National Operations Director
  const isExecutive = isCEO || isDirector;

  // Initialize telemetry tracking
  const { trackClick, trackPopupBlocked } = useWalletTelemetry({
    token: telemetryToken || undefined,
    platform: 'apple',
    onSuccess: () => {
      toast({
        title: "✅ Success!",
        description: "Pass added to your wallet",
      });
    }
  });

  const handleDownloadVIPCard = async () => {
    // Show consent dialog first
    setShowVIPConsent(true);
  };

  const handleVIPConsentAccepted = async () => {
    setIsDownloadingVIP(true);
    
    try {
      // Step 1: Prepare telemetry session
      const prepareResponse = await fetch('/api/wallet/vip-card/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!prepareResponse.ok) {
        if (prepareResponse.status === 401) {
          window.location.href = '/signin';
          return;
        }
        throw new Error('Failed to prepare VIP card');
      }

      const { telemetryToken: token, downloadUrl } = await prepareResponse.json();
      setTelemetryToken(token);

      // Track click for telemetry
      trackClick();

      // Step 2: Download with telemetry token
      const response = await fetch(downloadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to generate VIP card');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PetWash_VIP_Card.pkpass';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "✅ Downloaded!",
        description: "Open the file to add to your Wallet",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsDownloadingVIP(false);
    }
  };

  const handleDownloadBusinessCard = async () => {
    // Show consent dialog first
    setShowBusinessConsent(true);
  };

  const handleBusinessConsentAccepted = async () => {
    setIsDownloadingBusiness(true);
    
    try {
      // Get executive details
      let title = 'VIP Member';
      let phone = '';
      
      if (isNirHadad) {
        title = 'CEO & Founder';
        phone = '+972 549 833 355';
      } else if (isIdoShakarzi) {
        title = 'National Operations Director';
        phone = '+972 50 XXX XXXX'; // Ido's phone
      }

      const response = await fetch('/api/wallet/my-business-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title,
          phone
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/signin';
          return;
        }
        throw new Error('Failed to generate business card');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PetWash_Business_Card.pkpass';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "✅ Downloaded!",
        description: "Open the file to add to your Wallet",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsDownloadingBusiness(false);
    }
  };

  const handleEmailCards = async () => {
    setIsEmailingCards(true);
    
    try {
      // Get executive email
      const executiveEmail = isExecutive ? (isNirHadad ? 'nir.h@petwash.co.il' : user?.email) : undefined;
      
      const response = await fetch('/api/wallet/email-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: executiveEmail
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/signin';
          return;
        }
        const error = await response.json();
        throw new Error(error.message || 'Failed to email cards');
      }

      const data = await response.json();

      toast({
        title: "📧 Sent!",
        description: `Direct wallet links sent to ${data.email}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsEmailingCards(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Ultra-Premium Background with Glassmorphism */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Radial gradient mesh - Apple style */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-purple-600/30 via-purple-600/10 to-transparent blur-3xl animate-float"></div>
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-pink-600/30 via-pink-600/10 to-transparent blur-3xl animate-float-delayed"></div>
        <div className="absolute bottom-0 left-1/2 w-[700px] h-[700px] bg-gradient-radial from-blue-600/30 via-blue-600/10 to-transparent blur-3xl"></div>
        
        {/* Subtle grid overlay - Tesla cybertruck inspired */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16 relative z-10">
        {/* Luxury Header with Official Logo */}
        <div className="text-center mb-8 sm:mb-16">
          {/* Official PetWash™ Logo in Bordered Box with Social Media */}
          <div className="max-w-md mx-auto mb-8 sm:mb-12 p-6 sm:p-8 border-2 border-white/10 rounded-2xl bg-white/5 backdrop-blur-xl">
            <div className="flex justify-center mb-6">
              <div className="relative group">
                {/* Logo glow effect */}
                <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-3xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500"></div>
                <img 
                  src="/brand/petwash-logo-official.png" 
                  alt="Pet Wash™ - Premium Organic Pet Care"
                  className="relative h-12 sm:h-16 md:h-20 w-auto object-contain drop-shadow-2xl"
                />
              </div>
            </div>
            
            {/* Social Media Icons */}
            <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/10">
              <a 
                href="https://www.instagram.com/petwash.co.il" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300 hover:scale-110"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a 
                href="https://www.facebook.com/petwash.co.il" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300 hover:scale-110"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a 
                href="https://wa.me/972549833355" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300 hover:scale-110"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Premium Badge */}
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 mb-6 sm:mb-8">
            <Award className="w-5 h-5 text-amber-400" />
            <span className="text-sm sm:text-base font-light tracking-wider">PREMIUM DIGITAL WALLET</span>
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>

          {/* Title - Louis Vuitton inspired typography */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-light tracking-tight mb-6 sm:mb-8">
            <span className="block bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">
              Exclusive Access
            </span>
          </h1>

          <p className="text-sm sm:text-lg md:text-xl font-extralight text-gray-400 mb-8 sm:mb-10 tracking-wide max-w-2xl mx-auto px-4">
            Your digital identity • Crafted with precision • Engineered for excellence
          </p>

          {user && (
            <div className="inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-white/5 backdrop-blur-xl rounded-full border border-white/10">
              <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
              <p className="text-sm sm:text-lg">
                <span className="text-gray-400 font-light">Welcome,</span>{' '}
                <span className="text-white font-medium">{user.displayName || user.email}</span>
              </p>
            </div>
          )}

          {isIOS && (
            <div className="inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 mt-6 bg-white/10 backdrop-blur-xl rounded-full border border-white/20">
              <Apple className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-sm sm:text-base font-light tracking-wide">Optimized for iPhone</span>
            </div>
          )}
        </div>

        {/* Premium Email CTA - Above Cards */}
        <div className="mb-12 sm:mb-16">
          <Card className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent backdrop-blur-2xl hover:border-white/20 transition-all duration-500">
            {/* Animated gradient border */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 opacity-0 hover:opacity-100 transition-opacity duration-500"></div>
            
            <CardContent className="p-6 sm:p-10 relative">
              <div className="flex flex-col lg:flex-row items-center gap-6 sm:gap-8">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/50">
                    <Mail className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                </div>
                
                <div className="flex-1 text-center lg:text-left">
                  <h3 className="text-xl sm:text-2xl font-medium mb-2">Instant Wallet Access</h3>
                  <p className="text-sm sm:text-base text-gray-400 font-light">
                    Tap the button below to receive direct links to add both cards to Apple Wallet instantly • No downloads • No hassle
                  </p>
                </div>
                
                <Button 
                  onClick={handleEmailCards}
                  disabled={isEmailingCards}
                  className="flex-shrink-0 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:via-amber-600 hover:to-amber-700 text-black font-semibold px-8 sm:px-12 py-6 sm:py-8 text-base sm:text-lg rounded-2xl shadow-2xl shadow-amber-500/50 hover:shadow-amber-500/70 transition-all duration-300 hover:scale-105 border-0"
                  data-testid="button-email-cards"
                >
                  {isEmailingCards ? (
                    <>
                      <Zap className="w-5 h-5 sm:w-6 sm:h-6 mr-2 animate-pulse" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                      Email Direct Links
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Physical Credit Cards - Silk Finish */}
        <div className="space-y-8 sm:space-y-12 mb-16 sm:mb-20">
          {/* VIP Loyalty Card - Titanium Silk */}
          <div className="credit-card-wrapper">
            <div className="credit-card group relative aspect-[1.586/1] max-w-2xl mx-auto rounded-[20px] overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-700 hover:scale-[1.02]">
              {/* Card Background - Frosted Titanium */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-50 to-white"></div>
              
              {/* Silk Texture Overlay */}
              <div className="absolute inset-0 opacity-40" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`,
                backgroundSize: '100px 100px'
              }}></div>
              
              {/* Holographic shine effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 via-transparent to-pink-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1500 blur-sm"></div>
              
              {/* Card Content */}
              <div className="relative h-full p-6 sm:p-8 md:p-10 flex flex-col justify-between text-gray-900">
                {/* Top Row: Logo + Crown */}
                <div className="flex items-start justify-between">
                  <img 
                    src="/brand/petwash-logo-official.png" 
                    alt="Pet Wash™"
                    className="h-8 sm:h-10 md:h-12 w-auto object-contain opacity-90"
                  />
                  <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500 drop-shadow-lg" />
                </div>
                
                {/* Middle: Card Type */}
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-black/5 backdrop-blur-sm rounded-full">
                    <CreditCard className="w-4 h-4 text-gray-700" />
                    <span className="text-xs sm:text-sm font-medium tracking-wider text-gray-700">VIP LOYALTY CARD</span>
                  </div>
                </div>
                
                {/* Bottom Row: User Info + Chip */}
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm text-gray-600 font-light tracking-wide uppercase">Member</p>
                    <p className="text-base sm:text-lg md:text-xl font-medium tracking-wide text-gray-900 drop-shadow-sm">
                      {user?.displayName || 'VIP Member'}
                    </p>
                  </div>
                  
                  {/* EMV Chip Effect */}
                  <div className="w-10 h-8 sm:w-12 sm:h-10 bg-gradient-to-br from-amber-400 via-amber-300 to-amber-500 rounded-md shadow-lg" style={{
                    background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2), 0 2px 8px rgba(253,160,133,0.4)'
                  }}>
                    <div className="w-full h-full grid grid-cols-3 gap-[2px] p-1">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="bg-amber-600/30 rounded-[1px]"></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Download Button Overlay */}
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 bg-gradient-to-t from-black/60 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500">
                <Button 
                  onClick={handleDownloadVIPCard}
                  disabled={isDownloadingVIP}
                  className="w-full bg-white/95 hover:bg-white text-gray-900 py-5 sm:py-6 text-sm sm:text-base font-semibold rounded-xl shadow-xl backdrop-blur-xl border-0"
                  data-testid="button-download-vip-card"
                >
                  {isDownloadingVIP ? (
                    <>
                      <Zap className="w-5 h-5 mr-2 animate-pulse" />
                      Creating Your Card...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Add to Apple Wallet
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Card Features Below */}
            <div className="max-w-2xl mx-auto mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: CheckCircle2, text: "Real-time Updates", color: "text-green-400" },
                { icon: Shield, text: "AI Protection", color: "text-blue-400" },
                { icon: Zap, text: "QR Payment", color: "text-purple-400" },
                { icon: Smartphone, text: "Geo Alerts", color: "text-pink-400" }
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-gray-400">
                  <feature.icon className={`w-4 h-4 ${feature.color}`} />
                  <span className="text-xs font-light">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Business Card - Rose Gold Silk */}
          <div className="credit-card-wrapper">
            <div className="credit-card group relative aspect-[1.586/1] max-w-2xl mx-auto rounded-[20px] overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-700 hover:scale-[1.02]">
              {/* Card Background - Rose Gold */}
              <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-rose-50 to-white"></div>
              
              {/* Silk Texture Overlay */}
              <div className="absolute inset-0 opacity-40" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`,
                backgroundSize: '100px 100px'
              }}></div>
              
              {/* Holographic shine effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-pink-400/10 via-transparent to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1500 blur-sm"></div>
              
              {/* Card Content */}
              <div className="relative h-full p-6 sm:p-8 md:p-10 flex flex-col justify-between text-gray-900">
                {/* Top Row: Logo + Star */}
                <div className="flex items-start justify-between">
                  <img 
                    src="/brand/petwash-logo-official.png" 
                    alt="Pet Wash™"
                    className="h-8 sm:h-10 md:h-12 w-auto object-contain opacity-90"
                  />
                  <Star className="w-6 h-6 sm:w-8 sm:h-8 text-pink-500 drop-shadow-lg fill-pink-500" />
                </div>
                
                {/* Middle: Card Type */}
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-black/5 backdrop-blur-sm rounded-full">
                    <Briefcase className="w-4 h-4 text-gray-700" />
                    <span className="text-xs sm:text-sm font-medium tracking-wider text-gray-700">BUSINESS CARD</span>
                  </div>
                </div>
                
                {/* Bottom Row: User Info */}
                <div className="space-y-1">
                  <p className="text-base sm:text-lg md:text-xl font-medium tracking-wide text-gray-900 drop-shadow-sm">
                    {user?.displayName || 'VIP Member'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 font-light tracking-wide">
                    {isCEO ? 'CEO & Founder' : 'VIP Member'}
                  </p>
                  <p className="text-xs text-gray-500 font-light">
                    Pet Wash™ Ltd • Premium Organic Pet Care
                  </p>
                </div>
              </div>
              
              {/* Download Button Overlay */}
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 bg-gradient-to-t from-black/60 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500">
                <Button 
                  onClick={handleDownloadBusinessCard}
                  disabled={isDownloadingBusiness}
                  className="w-full bg-white/95 hover:bg-white text-gray-900 py-5 sm:py-6 text-sm sm:text-base font-semibold rounded-xl shadow-xl backdrop-blur-xl border-0"
                  data-testid="button-download-business-card"
                >
                  {isDownloadingBusiness ? (
                    <>
                      <Zap className="w-5 h-5 mr-2 animate-pulse" />
                      Creating Your Card...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Add to Apple Wallet
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Card Features Below */}
            <div className="max-w-2xl mx-auto mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: CheckCircle2, text: "AirDrop Share", color: "text-green-400" },
                { icon: Shield, text: "Encrypted", color: "text-blue-400" },
                { icon: Zap, text: "QR Code", color: "text-purple-400" },
                { icon: Smartphone, text: "Universal", color: "text-pink-400" }
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-gray-400">
                  <feature.icon className={`w-4 h-4 ${feature.color}`} />
                  <span className="text-xs font-light">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* KYB Section for Partners & Franchises */}
        {isCEO && (
          <div className="mb-16 sm:mb-20">
            <div className="text-center mb-8 sm:mb-12">
              <div className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-blue-600/10 backdrop-blur-xl rounded-full border border-blue-400/20 mb-4 sm:mb-6">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                <span className="text-xs sm:text-sm font-light tracking-wider text-blue-300">ENTERPRISE SUITE</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-light mb-3 sm:mb-4">Partner & Franchise Portal</h2>
              <p className="text-sm sm:text-base text-gray-400 font-light max-w-2xl mx-auto">
                Advanced KYB verification • Secure onboarding • Global franchise management
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
              {/* KYB Verification */}
              <Card className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-blue-600/10 via-blue-600/5 to-transparent backdrop-blur-2xl">
                <CardHeader className="p-5 sm:p-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center mb-4 shadow-xl shadow-blue-500/30">
                    <FileCheck className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-medium mb-2">KYB Verification</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-gray-400 font-light">
                    Automated business verification for partners and franchisees
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 sm:p-6 pt-0">
                  <Button 
                    variant="outline"
                    className="w-full bg-blue-600/10 hover:bg-blue-600/20 border-blue-400/30 text-blue-300 text-xs sm:text-sm py-4 sm:py-5"
                    data-testid="button-kyb-verify"
                  >
                    Start Verification
                  </Button>
                </CardContent>
              </Card>

              {/* Franchise Management */}
              <Card className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-purple-600/10 via-purple-600/5 to-transparent backdrop-blur-2xl">
                <CardHeader className="p-5 sm:p-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center mb-4 shadow-xl shadow-purple-500/30">
                    <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-medium mb-2">Franchise Portal</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-gray-400 font-light">
                    Manage global franchise operations and compliance
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 sm:p-6 pt-0">
                  <Button 
                    variant="outline"
                    className="w-full bg-purple-600/10 hover:bg-purple-600/20 border-purple-400/30 text-purple-300 text-xs sm:text-sm py-4 sm:py-5"
                    data-testid="button-franchise-portal"
                  >
                    Access Portal
                  </Button>
                </CardContent>
              </Card>

              {/* Partner Analytics */}
              <Card className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-amber-600/10 via-amber-600/5 to-transparent backdrop-blur-2xl">
                <CardHeader className="p-5 sm:p-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl flex items-center justify-center mb-4 shadow-xl shadow-amber-500/30">
                    <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-medium mb-2">Analytics Suite</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-gray-400 font-light">
                    Real-time insights and performance metrics
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 sm:p-6 pt-0">
                  <Button 
                    variant="outline"
                    className="w-full bg-amber-600/10 hover:bg-amber-600/20 border-amber-400/30 text-amber-300 text-xs sm:text-sm py-4 sm:py-5"
                    data-testid="button-analytics"
                  >
                    View Analytics
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-8 sm:pt-12 border-t border-white/10">
          <p className="text-xs sm:text-sm text-gray-500 font-light">
            Pet Wash™ Ltd • Premium Organic Pet Care • Est. 2024
          </p>
          <p className="text-xs text-gray-600 font-light mt-2">
            Crafted with precision • Protected by AI • Loved by pets worldwide
          </p>
        </div>
      </div>

      {/* Custom Animations & Credit Card Styles */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-20px) translateX(10px); }
          66% { transform: translateY(10px) translateX(-10px); }
        }
        
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(15px) translateX(-15px); }
          66% { transform: translateY(-10px) translateX(10px); }
        }
        
        .animate-float {
          animation: float 15s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 20s ease-in-out infinite;
        }
        
        .bg-gradient-radial {
          background-image: radial-gradient(circle, var(--tw-gradient-stops));
        }
        
        /* Physical Credit Card Effects */
        .credit-card {
          transform-style: preserve-3d;
          perspective: 1000px;
        }
        
        .credit-card::before {
          content: '';
          position: absolute;
          inset: -2px;
          background: linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1));
          border-radius: 20px;
          z-index: -1;
          opacity: 0.6;
        }
        
        .credit-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.1) 0%,
            transparent 50%,
            rgba(255, 255, 255, 0.05) 100%
          );
          border-radius: 20px;
          pointer-events: none;
        }
        
        .shadow-3xl {
          box-shadow: 
            0 20px 60px rgba(0, 0, 0, 0.15),
            0 10px 30px rgba(0, 0, 0, 0.1),
            0 0 1px rgba(0, 0, 0, 0.1);
        }
      `}</style>
      
      {/* Wallet Consent Dialogs */}
      <WalletConsentDialog
        isOpen={showVIPConsent}
        onClose={() => setShowVIPConsent(false)}
        onAccept={handleVIPConsentAccepted}
        passType="vip"
        platform={isIOS ? "apple" : "google"}
      />
      
      <WalletConsentDialog
        isOpen={showBusinessConsent}
        onClose={() => setShowBusinessConsent(false)}
        onAccept={handleBusinessConsentAccepted}
        passType="business"
        platform={isIOS ? "apple" : "google"}
      />
    </div>
  );
}
