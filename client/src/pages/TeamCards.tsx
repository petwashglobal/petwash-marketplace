import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share2, Smartphone, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/languageStore";
import { getApiUrl } from '@/lib/apiConfig';

// Team members from business cards
const teamMembers = [
  {
    name: "Nir Hadad",
    title: "Founder & CEO",
    company: "PetWash™ Ltd",
    email: "Nir.H@petwash.co.il",
    phone: "+972 549 833 355",
    mobile: "+61 419 773 360",
    website: "https://www.petwash.co.il",
    socialMedia: {
      tiktok: "@petwash",
      instagram: "@petwash",
      facebook: "PetWashOfficial"
    }
  },
  {
    name: "Ido Shakarzi",
    title: "Director",
    company: "PetWash™ Ltd",
    email: "Ido.S@PetWash.co.il",
    phone: "+972 55-8813036",
    website: "https://www.petwash.co.il",
    socialMedia: {
      tiktok: "@petwash",
      instagram: "@petwash",
      facebook: "PetWashOfficial"
    }
  },
  {
    name: "Tom Hane",
    title: "Director",
    company: "PetWash™ Ltd",
    email: "Tom.H@PetWash.co.il",
    phone: "+972 52-6012166",
    website: "https://www.petwash.co.il",
    socialMedia: {
      tiktok: "@petwash",
      instagram: "@petwash",
      facebook: "PetWashOfficial"
    }
  }
];

export default function TeamCards() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const handleAppleWallet = async (member: typeof teamMembers[0]) => {
    try {
      const response = await fetch(getApiUrl('/api/wallet/business-card'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member)
      });

      if (!response.ok) throw new Error('Failed to generate business card');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PetWash_${member.name.replace(/\s+/g, '_')}.pkpass`;
      a.click();

      toast({
        title: isHebrew ? 'הצלחה!' : 'Success!',
        description: isHebrew 
          ? `כרטיס ביקור של ${member.name} נוסף ל-Apple Wallet`
          : `${member.name}'s business card added to Apple Wallet`
      });
    } catch (error) {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew 
          ? 'לא הצלחנו ליצור כרטיס ביקור'
          : 'Failed to create business card',
        variant: 'destructive'
      });
    }
  };

  const handleGoogleWallet = async (member: typeof teamMembers[0]) => {
    try {
      const response = await fetch(getApiUrl('/api/google-wallet/business-card'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member)
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);

      // Open Google Wallet save page
      window.open(data.saveUrl, '_blank');

      toast({
        title: isHebrew ? 'הצלחה!' : 'Success!',
        description: isHebrew 
          ? `כרטיס ביקור של ${member.name} נוסף ל-Google Wallet`
          : `${member.name}'s business card added to Google Wallet`
      });
    } catch (error) {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew 
          ? 'לא הצלחנו ליצור כרטיס ביקור'
          : 'Failed to create business card',
        variant: 'destructive'
      });
    }
  };

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <div className="min-h-screen luxury-bg-mesh p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 luxury-animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Users className="w-12 h-12 text-indigo-600" />
          </div>
          <h1 className="luxury-heading-xl mb-4">
            {isHebrew ? 'כרטיסי הביקור הדיגיטליים שלנו' : 'Our Digital Business Cards'}
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            {isHebrew 
              ? 'הוסף את כרטיסי הביקור שלנו ל-Apple Wallet או Google Wallet. שתף בקלות דרך QR, AirDrop, NFC או NameDrop!'
              : 'Add our business cards to Apple Wallet or Google Wallet. Share easily via QR, AirDrop, NFC, or NameDrop!'}
          </p>
          
          {/* Features */}
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <div className="luxury-badge luxury-badge-success luxury-animate-scale-in luxury-delay-1">
              <Smartphone className="w-5 h-5" />
              <span className="text-sm font-medium">
                {isHebrew ? 'שיתוף מהיר' : 'Quick Share'}
              </span>
            </div>
            <div className="luxury-badge luxury-animate-scale-in luxury-delay-2">
              <Share2 className="w-5 h-5" />
              <span className="text-sm font-medium">
                {isHebrew ? 'AirDrop & NFC' : 'AirDrop & NFC'}
              </span>
            </div>
            <div className="luxury-badge luxury-badge-gold luxury-animate-scale-in luxury-delay-3">
              <Download className="w-5 h-5" />
              <span className="text-sm font-medium">
                {isHebrew ? 'תמיד זמין' : 'Always Available'}
              </span>
            </div>
          </div>
        </div>

        {/* Team Cards */}
        <div className="luxury-grid-3 luxury-gap-lg">
          {teamMembers.map((member, index) => (
            <Card key={index} className={`luxury-glass-card luxury-hover-lift luxury-animate-slide-up luxury-delay-${index + 1}`}>
              <CardHeader className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-t-3xl">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/10 backdrop-blur-sm border-4 border-white/20 flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">{member.name.charAt(0)}</span>
                </div>
                <CardTitle className="text-2xl text-center">{member.name}</CardTitle>
                <CardDescription className="text-indigo-100 text-center">
                  {member.title}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {/* Contact Info */}
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Email:</span>
                    <br />
                    <a href={`mailto:${member.email}`} className="text-indigo-600 hover:underline">
                      {member.email}
                    </a>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Phone:</span>
                    <br />
                    <a href={`tel:${member.phone}`} className="text-indigo-600 hover:underline">
                      {member.phone}
                    </a>
                  </div>
                  {member.mobile && (
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Mobile:</span>
                      <br />
                      <a href={`tel:${member.mobile}`} className="text-indigo-600 hover:underline">
                        {member.mobile}
                      </a>
                    </div>
                  )}
                </div>

                {/* Wallet Buttons - Coming Soon */}
                <div className="space-y-2">
                  <div className="text-center py-3 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-500">
                    {isHebrew ? '🚀 Wallet בקרוב...' : '🚀 Wallet Coming Soon...'}
                  </div>
                </div>

                {/* Sharing Instructions */}
                <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t">
                  {isHebrew 
                    ? '💡 שתף דרך QR, AirDrop, NFC או NameDrop (iOS 17+)'
                    : '💡 Share via QR, AirDrop, NFC, or NameDrop (iOS 17+)'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-12 luxury-glass-card luxury-shadow-lg p-8 luxury-animate-fade-in luxury-delay-5">
          <h2 className="luxury-heading-lg mb-4">
            {isHebrew ? 'איך להשתמש בכרטיסי ביקור דיגיטליים' : 'How to Use Digital Business Cards'}
          </h2>
          <div className="luxury-grid-2 luxury-gap-lg luxury-text-body">
            <div>
              <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
                {isHebrew ? '📱 Apple Wallet (iPhone/iPad)' : '📱 Apple Wallet (iPhone/iPad)'}
              </h3>
              <ul className="space-y-1 text-sm">
                <li>• {isHebrew ? 'לחץ "הוסף ל-Apple Wallet"' : 'Tap "Add to Apple Wallet"'}</li>
                <li>• {isHebrew ? 'הכרטיס מתווסף אוטומטית' : 'Card adds automatically'}</li>
                <li>• {isHebrew ? 'שתף דרך QR או AirDrop' : 'Share via QR or AirDrop'}</li>
                <li>• {isHebrew ? 'תמיכה ב-NameDrop (iOS 17+)' : 'NameDrop support (iOS 17+)'}</li>
              </ul>
            </div>
            <div>
              <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
                {isHebrew ? '🤖 Google Wallet (Android)' : '🤖 Google Wallet (Android)'}
              </h3>
              <ul className="space-y-1 text-sm">
                <li>• {isHebrew ? 'לחץ "הוסף ל-Google Wallet"' : 'Tap "Add to Google Wallet"'}</li>
                <li>• {isHebrew ? 'הכרטיס נשמר באפליקציה' : 'Card saves in app'}</li>
                <li>• {isHebrew ? 'גישה מהירה מנעילת המסך' : 'Quick access from lock screen'}</li>
                <li>• {isHebrew ? 'תמיכה ב-NFC' : 'NFC support'}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
