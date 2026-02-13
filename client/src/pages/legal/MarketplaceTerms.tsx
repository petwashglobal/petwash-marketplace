import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketplaceLegalContent } from "@/components/legal/MarketplaceLegalContent";
import { InsuranceAndProtection } from "@/components/legal/InsuranceAndProtection";
import { ProviderIncomeOpportunity } from "@/components/legal/ProviderIncomeOpportunity";
import { ComprehensiveLegalTerms } from "@/components/legal/ComprehensiveLegalTerms";
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
  ArrowRight,
  Heart,
  TrendingUp,
  BadgeCheck,
  Scale
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function MarketplaceTerms() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he' || i18n.language === 'ar';
  const isHebrew = i18n.language === 'he';
  const [activeTab, setActiveTab] = useState("insurance");

  const mainTabs = [
    { 
      id: "insurance", 
      label: isHebrew ? "ביטוח והגנות" : "Insurance & Protection", 
      icon: Shield,
      description: isHebrew ? "כיסוי ביטוחי מלא, תהליך תביעות, הגנות" : "Full insurance coverage, claims process, protections"
    },
    { 
      id: "legal", 
      label: isHebrew ? "תנאים משפטיים" : "Legal Terms", 
      icon: Scale,
      description: isHebrew ? "שיפוי, כוח עליון, דין חל, בוררות, פרטיות" : "Indemnification, force majeure, governing law, arbitration, privacy"
    },
    { 
      id: "provider", 
      label: isHebrew ? "מידע לספקים" : "Provider Info", 
      icon: UserCheck,
      description: isHebrew ? "הסכם ספק, מס, ציות, זכויות וחובות" : "Provider agreement, tax, compliance, rights & obligations"
    },
    { 
      id: "customer", 
      label: isHebrew ? "הגנות לקוח" : "Customer Protection", 
      icon: Heart,
      description: isHebrew ? "נאמנות, ביטולים, החזרים, יישוב סכסוכים" : "Escrow, cancellations, refunds, dispute resolution"
    },
    { 
      id: "income", 
      label: isHebrew ? "הזדמנות הכנסה" : "Income Opportunity", 
      icon: TrendingUp,
      description: isHebrew ? "פוטנציאל הרווח, תעריפים, תרחישי הכנסה" : "Earning potential, rates, income scenarios"
    },
    { 
      id: "all-terms", 
      label: isHebrew ? "כל התנאים" : "All Terms", 
      icon: FileText,
      description: isHebrew ? "כל המסמכים המשפטיים במקום אחד" : "All legal documents in one place"
    },
  ];

  const legalSubTabs = [
    { id: "platform-terms", label: isHebrew ? "תנאי פלטפורמה" : "Platform Terms", icon: FileText },
    { id: "provider-agreement", label: isHebrew ? "הסכם ספק" : "Provider Agreement", icon: UserCheck },
    { id: "customer-terms", label: isHebrew ? "תנאי לקוח" : "Customer Terms", icon: Shield },
    { id: "pricing-disclosure", label: isHebrew ? "גילוי מחירים" : "Pricing", icon: CreditCard },
    { id: "escrow-policy", label: isHebrew ? "נאמנות" : "Escrow", icon: Wallet },
    { id: "cancellation-policy", label: isHebrew ? "ביטולים" : "Cancellation", icon: Calendar },
    { id: "liability-disclaimer", label: isHebrew ? "אחריות" : "Liability", icon: AlertTriangle },
    { id: "israeli-compliance", label: isHebrew ? "ציות ישראלי" : "Israeli Compliance", icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black" dir={isRTL ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-[url('/assets/noise.png')] opacity-5 pointer-events-none" />
      
      <div className="relative container mx-auto px-4 py-12 max-w-6xl">
        <Link href="/services">
          <Button variant="ghost" className="mb-6 text-white/70 hover:text-white">
            {isRTL ? (
              <>
                {isHebrew ? "חזרה לשירותים" : "Back to Services"}
                <ArrowRight className="w-4 h-4 mr-2" />
              </>
            ) : (
              <>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Services
              </>
            )}
          </Button>
        </Link>

        <div className="text-center mb-12">
          <Badge className="bg-emerald-500/20 text-emerald-400 mb-4">
            <BadgeCheck className="w-4 h-4 mr-1" />
            {isHebrew ? "מאובטח ומוגן" : "Secure & Protected"}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            {isHebrew ? "ביטוח, הגנות ותנאי שימוש" : "Insurance, Protection & Terms"}
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            {isHebrew 
              ? "כל מה שצריך לדעת על ההגנות, הביטוח והתנאים של ⁦Pet Wash™⁩ Marketplace"
              : "Everything you need to know about ⁦Pet Wash™⁩ Marketplace protections, insurance and terms"}
          </p>
          <p className="text-sm text-white/40 mt-4">
            {isHebrew ? "עודכן לאחרונה: ינואר 2026" : "Last updated: January 2026"}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex flex-wrap justify-center gap-2 bg-transparent mb-8 h-auto">
            {mainTabs.map((tab) => (
              <TabsTrigger 
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-white data-[state=active]:text-black bg-white/10 text-white/70 hover:bg-white/20 px-4 py-2 rounded-full transition-all flex items-center gap-2"
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="insurance">
            <InsuranceAndProtection variant="full" />
          </TabsContent>

          <TabsContent value="legal">
            <ComprehensiveLegalTerms section="all" />
          </TabsContent>

          <TabsContent value="provider">
            <div className="space-y-8">
              <InsuranceAndProtection variant="provider" />
              <MarketplaceLegalContent section="provider-agreement" />
            </div>
          </TabsContent>

          <TabsContent value="customer">
            <div className="space-y-8">
              <InsuranceAndProtection variant="customer" />
              <ComprehensiveLegalTerms section="consumer-rights" />
              <ComprehensiveLegalTerms section="escrow-structure" />
              <MarketplaceLegalContent section="customer-terms" />
              <MarketplaceLegalContent section="cancellation-policy" />
            </div>
          </TabsContent>

          <TabsContent value="income">
            <ProviderIncomeOpportunity />
          </TabsContent>

          <TabsContent value="all-terms">
            <div className="space-y-12">
              <div>
                <h3 className="text-xl font-semibold text-white mb-6 text-center">
                  {isHebrew ? "תנאים משפטיים מלאים" : "Comprehensive Legal Terms"}
                </h3>
                <ComprehensiveLegalTerms section="all" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-6 text-center">
                  {isHebrew ? "תנאי שירות הפלטפורמה" : "Platform Service Terms"}
                </h3>
                <div className="mb-6">
                  <div className="flex flex-wrap justify-center gap-2">
                    {legalSubTabs.map((tab) => (
                      <Button
                        key={tab.id}
                        variant="outline"
                        size="sm"
                        className="border-white/20 text-white/70 hover:bg-white/10"
                        onClick={() => {
                          const element = document.getElementById(tab.id);
                          element?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        <tab.icon className="w-3 h-3 mr-1" />
                        {tab.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-8">
                  {legalSubTabs.map((tab) => (
                    <div key={tab.id} id={tab.id}>
                      <MarketplaceLegalContent section={tab.id as any} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-16 text-center space-y-4">
          <p className="text-sm text-white/40">
            {isHebrew 
              ? "לשאלות נוספות ניתן לפנות לצוות התמיכה שלנו"
              : "For additional questions, please contact our support team"}
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/contact">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                {isHebrew ? "צור קשר" : "Contact Us"}
              </Button>
            </Link>
            <Link href="/become-provider">
              <Button className="bg-white text-black hover:bg-white/90">
                {isHebrew ? "הצטרף כספק" : "Join as Provider"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
