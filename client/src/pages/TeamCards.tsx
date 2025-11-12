import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share2, Smartphone, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/languageStore";

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
      const response = await fetch('/api/wallet/business-card', {
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
      const response = await fetch('/api/google-wallet/business-card', {
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Users className="w-12 h-12 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {isHebrew ? 'כרטיסי הביקור הדיגיטליים שלנו' : 'Our Digital Business Cards'}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {isHebrew 
              ? 'הוסף את כרטיסי הביקור שלנו ל-Apple Wallet או Google Wallet. שתף בקלות דרך QR, AirDrop, NFC או NameDrop!'
              : 'Add our business cards to Apple Wallet or Google Wallet. Share easily via QR, AirDrop, NFC, or NameDrop!'}
          </p>
          
          {/* Features */}
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-sm">
              <Smartphone className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">
                {isHebrew ? 'שיתוף מהיר' : 'Quick Share'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-sm">
              <Share2 className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">
                {isHebrew ? 'AirDrop & NFC' : 'AirDrop & NFC'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-sm">
              <Download className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium">
                {isHebrew ? 'תמיד זמין' : 'Always Available'}
              </span>
            </div>
          </div>
        </div>

        {/* Team Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMembers.map((member, index) => (
            <Card key={index} className="hover:shadow-xl transition-shadow">
              <CardHeader className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
                <CardTitle className="text-2xl">{member.name}</CardTitle>
                <CardDescription className="text-indigo-100">
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

                {/* Wallet Buttons */}
                <div className="space-y-2">
                  {isIOS && (
                    <Button 
                      onClick={() => handleAppleWallet(member)}
                      className="w-full bg-black hover:bg-gray-800 text-white"
                      data-testid={`button-apple-wallet-${member.name.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {isHebrew ? 'הוסף ל-Apple Wallet' : 'Add to Apple Wallet'}
                    </Button>
                  )}
                  
                  {isAndroid && (
                    <Button 
                      onClick={() => handleGoogleWallet(member)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      data-testid={`button-google-wallet-${member.name.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {isHebrew ? 'הוסף ל-Google Wallet' : 'Add to Google Wallet'}
                    </Button>
                  )}

                  {!isIOS && !isAndroid && (
                    <>
                      <Button 
                        onClick={() => handleAppleWallet(member)}
                        className="w-full bg-black hover:bg-gray-800 text-white"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {isHebrew ? 'Apple Wallet' : 'Apple Wallet'}
                      </Button>
                      <Button 
                        onClick={() => handleGoogleWallet(member)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {isHebrew ? 'Google Wallet' : 'Google Wallet'}
                      </Button>
                    </>
                  )}
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
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            {isHebrew ? 'איך להשתמש בכרטיסי ביקור דיגיטליים' : 'How to Use Digital Business Cards'}
          </h2>
          <div className="grid md:grid-cols-2 gap-6 text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="font-semibold mb-2 text-indigo-600">
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
              <h3 className="font-semibold mb-2 text-blue-600">
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
