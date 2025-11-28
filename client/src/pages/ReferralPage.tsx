/**
 * PetWash™ Referral Page - "חבר מביא חבר"
 * Premium Hebrew marketing page with luxury design
 * 
 * Features:
 * - Personal referral link + QR code
 * - Progress towards next tier
 * - Share via WhatsApp, SMS, Email, Copy
 * - Referral history with status
 * - Credits balance display
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Copy, Share2, Gift, Users, Trophy, ChevronRight, Check, Clock, Coins } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import QRCode from "qrcode.react";

interface ReferralStats {
  userId: string;
  referralCode: string;
  referralLink: string;
  stats: {
    totalInvites: number;
    successfulInvites: number;
    pendingInvites: number;
    totalCreditsGrantedILS: number;
    levelId: "BRONZE" | "SILVER" | "GOLD" | "DIAMOND";
  } | null;
}

interface ReferralHistoryItem {
  id: string;
  status: "PENDING_SIGNUP" | "SIGNED_UP" | "WAITING_FIRST_PAYMENT" | "COMPLETED" | "REJECTED";
  createdAt: string;
  toEmail?: string;
  toPhone?: string;
  referrerCreditILS?: number;
}

const LEVEL_CONFIG = {
  BRONZE: { 
    label: "ברונזה", 
    labelEn: "Bronze",
    color: "bg-amber-700", 
    textColor: "text-amber-700",
    minSuccessful: 0, 
    nextLevel: "SILVER", 
    nextAt: 5,
    icon: "🥉"
  },
  SILVER: { 
    label: "כסף", 
    labelEn: "Silver",
    color: "bg-gray-400", 
    textColor: "text-gray-500",
    minSuccessful: 5, 
    nextLevel: "GOLD", 
    nextAt: 10,
    icon: "🥈"
  },
  GOLD: { 
    label: "זהב", 
    labelEn: "Gold",
    color: "bg-yellow-500", 
    textColor: "text-yellow-600",
    minSuccessful: 10, 
    nextLevel: "DIAMOND", 
    nextAt: 25,
    icon: "🥇"
  },
  DIAMOND: { 
    label: "יהלום", 
    labelEn: "Diamond",
    color: "bg-cyan-400", 
    textColor: "text-cyan-500",
    minSuccessful: 25, 
    nextLevel: null, 
    nextAt: null,
    icon: "💎"
  },
};

const STATUS_CONFIG = {
  PENDING_SIGNUP: { label: "ממתין להרשמה", color: "bg-gray-100 text-gray-600", icon: Clock },
  SIGNED_UP: { label: "נרשם", color: "bg-blue-100 text-blue-600", icon: Users },
  WAITING_FIRST_PAYMENT: { label: "ממתין לתשלום", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  COMPLETED: { label: "הושלם!", color: "bg-green-100 text-green-700", icon: Check },
  REJECTED: { label: "נדחה", color: "bg-red-100 text-red-600", icon: Clock },
};

export default function ReferralPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const { data: referralData, isLoading } = useQuery<ReferralStats>({
    queryKey: ["/api/referral/link"],
  });

  const stats = referralData?.stats;
  const currentLevel = stats?.levelId || "BRONZE";
  const levelConfig = LEVEL_CONFIG[currentLevel];
  const successfulCount = stats?.successfulInvites || 0;
  
  const progressToNext = levelConfig.nextAt 
    ? Math.min(100, ((successfulCount - levelConfig.minSuccessful) / (levelConfig.nextAt - levelConfig.minSuccessful)) * 100)
    : 100;

  const copyLink = async () => {
    if (!referralData?.referralLink) return;
    
    try {
      await navigator.clipboard.writeText(referralData.referralLink);
      setCopied(true);
      toast({
        title: "הקישור הועתק!",
        description: "שתף את הקישור עם חברים",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "שגיאה",
        description: "לא ניתן להעתיק",
        variant: "destructive",
      });
    }
  };

  const shareWhatsApp = () => {
    if (!referralData?.referralLink) return;
    const text = encodeURIComponent(
      `🐾 היי! קבל ₪25 קרדיט ב-Pet Wash™ עם הקישור שלי:\n${referralData.referralLink}\n\nשטיפת חיות מחמד אורגנית פרימיום 🧼✨`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const shareEmail = () => {
    if (!referralData?.referralLink) return;
    const subject = encodeURIComponent("קבל ₪25 קרדיט ב-Pet Wash™!");
    const body = encodeURIComponent(
      `היי,\n\nרציתי להמליץ לך על Pet Wash™ - שירות שטיפת חיות מחמד אורגני פרימיום!\n\nעם הקישור האישי שלי תקבל ₪25 קרדיט להזמנה הראשונה:\n${referralData.referralLink}\n\nלהתראות,`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const shareSMS = () => {
    if (!referralData?.referralLink) return;
    const text = encodeURIComponent(
      `קבל ₪25 קרדיט ב-Pet Wash™! ${referralData.referralLink}`
    );
    window.open(`sms:?body=${text}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center" dir="rtl">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50" dir="rtl">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-40 h-40 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-60 h-60 bg-yellow-300 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
            <Gift className="w-5 h-5" />
            <span className="font-medium">תוכנית חבר מביא חבר</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Heebo', sans-serif" }}>
            הזמן חברים, קבל <span className="text-yellow-300">₪25</span>
          </h1>
          
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            שתף את הקישור האישי שלך עם חברים. כשהם ישלמו בפעם הראשונה - 
            גם אתה וגם הם תקבלו ₪25 קרדיט!
          </p>

          {/* Referral Code Display */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 max-w-md mx-auto border border-white/20">
            <p className="text-sm text-white/70 mb-2">הקוד האישי שלך</p>
            <div className="text-3xl font-mono font-bold tracking-wider mb-4">
              {referralData?.referralCode || "--------"}
            </div>
            
            <div className="flex gap-2 justify-center flex-wrap">
              <Button 
                onClick={copyLink}
                variant="secondary"
                className="bg-white text-emerald-600 hover:bg-gray-100"
                data-testid="btn-copy-link"
              >
                {copied ? <Check className="w-4 h-4 ml-2" /> : <Copy className="w-4 h-4 ml-2" />}
                {copied ? "הועתק!" : "העתק קישור"}
              </Button>
              
              <Button 
                onClick={shareWhatsApp}
                className="bg-green-500 hover:bg-green-600"
                data-testid="btn-share-whatsapp"
              >
                <SiWhatsapp className="w-4 h-4 ml-2" />
                WhatsApp
              </Button>
              
              <Button 
                onClick={() => setShowQR(!showQR)}
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                data-testid="btn-show-qr"
              >
                QR
              </Button>
            </div>

            {showQR && referralData?.referralLink && (
              <div className="mt-4 bg-white p-4 rounded-xl inline-block">
                <QRCode 
                  value={referralData.referralLink} 
                  size={150}
                  level="H"
                  includeMargin
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              <div className="text-2xl font-bold">{stats?.totalInvites || 0}</div>
              <div className="text-sm text-gray-500">הזמנות נשלחו</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
              <div className="text-2xl font-bold">{stats?.pendingInvites || 0}</div>
              <div className="text-sm text-gray-500">ממתינים</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="p-4 text-center">
              <Check className="w-8 h-8 mx-auto text-green-500 mb-2" />
              <div className="text-2xl font-bold">{stats?.successfulInvites || 0}</div>
              <div className="text-sm text-gray-500">הצליחו</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="p-4 text-center">
              <Coins className="w-8 h-8 mx-auto text-amber-500 mb-2" />
              <div className="text-2xl font-bold">₪{stats?.totalCreditsGrantedILS || 0}</div>
              <div className="text-sm text-gray-500">קרדיט שהרווחת</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Level Progress */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="bg-white shadow-lg border-0 overflow-hidden">
          <div className={`h-2 ${levelConfig.color}`} />
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{levelConfig.icon}</span>
                <div>
                  <div className="text-xl font-bold">{levelConfig.label}</div>
                  <div className="text-sm text-gray-500">{levelConfig.labelEn} Level</div>
                </div>
              </div>
              {levelConfig.nextLevel && (
                <div className="text-left">
                  <div className="text-sm text-gray-500">הבא:</div>
                  <div className="font-bold">{LEVEL_CONFIG[levelConfig.nextLevel].label}</div>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {levelConfig.nextAt && (
              <>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>{successfulCount} הפניות מוצלחות</span>
                  <span>עוד {levelConfig.nextAt - successfulCount} לדרגה הבאה</span>
                </div>
                <Progress value={progressToNext} className="h-3" />
              </>
            )}
            {!levelConfig.nextLevel && (
              <div className="text-center py-4">
                <Trophy className="w-12 h-12 mx-auto text-cyan-400 mb-2" />
                <p className="text-lg font-medium">הגעת לדרגה הגבוהה ביותר!</p>
                <p className="text-gray-500">אתה אלוף ההפניות של Pet Wash™</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-center mb-8">איך זה עובד?</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Share2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="font-bold mb-2">1. שתף את הקישור</h3>
            <p className="text-gray-600 text-sm">
              שלח לחברים את הקישור האישי שלך דרך WhatsApp, SMS או אימייל
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-bold mb-2">2. חברים נרשמים ומשלמים</h3>
            <p className="text-gray-600 text-sm">
              כשהחבר שלך משלם בפעם הראשונה (מינימום ₪20), שניכם מקבלים קרדיט
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="font-bold mb-2">3. קבלו ₪25 כל אחד</h3>
            <p className="text-gray-600 text-sm">
              הקרדיט יתווסף אוטומטית לחשבון שלך ושל החבר. ניתן לשימוש בכל שירותי Pet Wash™
            </p>
          </div>
        </div>
      </div>

      {/* Share Buttons Row */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="bg-gradient-to-r from-gray-50 to-white border-0 shadow-lg">
          <CardContent className="p-6">
            <h3 className="font-bold text-lg mb-4 text-center">שתף עכשיו</h3>
            <div className="flex flex-wrap justify-center gap-3">
              <Button 
                onClick={shareWhatsApp}
                className="bg-green-500 hover:bg-green-600 text-white"
                size="lg"
              >
                <SiWhatsapp className="w-5 h-5 ml-2" />
                WhatsApp
              </Button>
              
              <Button 
                onClick={shareSMS}
                variant="outline"
                size="lg"
              >
                SMS
              </Button>
              
              <Button 
                onClick={shareEmail}
                variant="outline"
                size="lg"
              >
                אימייל
              </Button>
              
              <Button 
                onClick={copyLink}
                variant="outline"
                size="lg"
              >
                <Copy className="w-4 h-4 ml-2" />
                העתק קישור
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Terms */}
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-sm text-gray-500">
        <p>
          * קרדיט יינתן רק לאחר תשלום ראשון של ₪20 לפחות בפועל.
          ניתן לצבור עד ₪1,000 קרדיט סה"כ ו-₪200 ביום.
          הקרדיט תקף לשנה מיום קבלתו. 
          <a href="/legal/referral-terms" className="text-emerald-600 hover:underline mr-1">תנאים מלאים</a>
        </p>
      </div>
    </div>
  );
}
