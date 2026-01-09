import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketplaceLegalContent } from "@/components/legal/MarketplaceLegalContent";
import { 
  FileText, 
  UserCheck, 
  Shield, 
  CreditCard, 
  Wallet, 
  Calendar, 
  AlertTriangle,
  Globe,
  ArrowLeft,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function MarketplaceTerms() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he' || i18n.language === 'ar';
  const isHebrew = i18n.language === 'he';
  const [activeTab, setActiveTab] = useState("all");

  const tabs = [
    { id: "all", label: isHebrew ? "הכל" : "All", icon: FileText },
    { id: "platform-terms", label: isHebrew ? "תנאי פלטפורמה" : "Platform Terms", icon: FileText },
    { id: "provider-agreement", label: isHebrew ? "הסכם ספק" : "Provider Agreement", icon: UserCheck },
    { id: "customer-terms", label: isHebrew ? "תנאי לקוח" : "Customer Terms", icon: Shield },
    { id: "pricing-disclosure", label: isHebrew ? "גילוי מחירים" : "Pricing", icon: CreditCard },
    { id: "escrow-policy", label: isHebrew ? "נאמנות" : "Escrow", icon: Wallet },
    { id: "cancellation-policy", label: isHebrew ? "ביטולים" : "Cancellation", icon: Calendar },
    { id: "liability-disclaimer", label: isHebrew ? "אחריות" : "Liability", icon: AlertTriangle },
    { id: "israeli-compliance", label: isHebrew ? "ציות" : "Compliance", icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black" dir={isRTL ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-[url('/assets/noise.png')] opacity-5 pointer-events-none" />
      
      <div className="relative container mx-auto px-4 py-12 max-w-6xl">
        <Link href="/marketplace">
          <Button variant="ghost" className="mb-6 text-white/70 hover:text-white">
            {isRTL ? (
              <>
                {isHebrew ? "חזרה לשוק" : "Back to Marketplace"}
                <ArrowRight className="w-4 h-4 mr-2" />
              </>
            ) : (
              <>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Marketplace
              </>
            )}
          </Button>
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            {isHebrew ? "תנאי שימוש ומסמכים משפטיים" : "Terms of Service & Legal"}
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            {isHebrew 
              ? "כל המידע המשפטי, התנאים והמדיניות של Pet Wash™ Marketplace"
              : "All legal information, terms and policies for Pet Wash™ Marketplace"}
          </p>
          <p className="text-sm text-white/40 mt-4">
            {isHebrew ? "עודכן לאחרונה: ינואר 2026" : "Last updated: January 2026"}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex flex-wrap justify-center gap-2 bg-transparent mb-8 h-auto">
            {tabs.map((tab) => (
              <TabsTrigger 
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-white data-[state=active]:text-black bg-white/10 text-white/70 hover:bg-white/20 px-4 py-2 rounded-full transition-all"
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all">
            <MarketplaceLegalContent />
          </TabsContent>

          {tabs.filter(t => t.id !== "all").map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              <MarketplaceLegalContent section={tab.id as any} />
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-16 text-center">
          <p className="text-sm text-white/40">
            {isHebrew 
              ? "לשאלות נוספות ניתן לפנות לצוות התמיכה שלנו"
              : "For additional questions, please contact our support team"}
          </p>
          <Link href="/contact">
            <Button variant="outline" className="mt-4 border-white/20 text-white hover:bg-white/10">
              {isHebrew ? "צור קשר" : "Contact Us"}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
