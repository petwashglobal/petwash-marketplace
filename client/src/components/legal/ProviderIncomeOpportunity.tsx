import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Calendar, 
  Clock, 
  DollarSign,
  Users,
  Star,
  Heart,
  Home,
  Car,
  Dog,
  Scissors,
  GraduationCap,
  Sparkles,
  Calculator,
  Gift,
  CheckCircle2
} from "lucide-react";

interface ProviderIncomeOpportunityProps {
  className?: string;
}

export function ProviderIncomeOpportunity({ className = "" }: ProviderIncomeOpportunityProps) {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';
  const isRTL = isHebrew;

  const earningPotential = {
    title: isHebrew ? "הזדמנות הכנסה עם Pet Wash™" : "Earning Opportunity with Pet Wash™",
    subtitle: isHebrew 
      ? "הפוך את אהבתך לחיות למקור הכנסה נוסף - בשעות שמתאימות לך"
      : "Turn your love for pets into extra income - on your own schedule",
    platforms: [
      {
        icon: Home,
        name: isHebrew ? "The Sitter Suite™" : "The Sitter Suite™",
        service: isHebrew ? "אירוח לילה" : "Overnight Stays",
        rateRange: "₪120 - ₪350",
        perUnit: isHebrew ? "ללילה" : "per night",
        example: isHebrew 
          ? "שבוע אירוח = ₪840 - ₪2,450"
          : "1 week stay = ₪840 - ₪2,450",
        popular: true
      },
      {
        icon: Dog,
        name: isHebrew ? "Walk My Pet™" : "Walk My Pet™",
        service: isHebrew ? "הליכות כלבים" : "Dog Walking",
        rateRange: "₪40 - ₪80",
        perUnit: isHebrew ? "להליכה (30-60 דק')" : "per walk (30-60 min)",
        example: isHebrew 
          ? "10 הליכות בשבוע = ₪400 - ₪800"
          : "10 walks/week = ₪400 - ₪800",
        popular: true
      },
      {
        icon: Car,
        name: isHebrew ? "PetTrek™" : "PetTrek™",
        service: isHebrew ? "הסעות חיות מחמד" : "Pet Transport",
        rateRange: "₪50 - ₪150",
        perUnit: isHebrew ? "לנסיעה" : "per trip",
        example: isHebrew 
          ? "5 נסיעות בשבוע = ₪250 - ₪750"
          : "5 trips/week = ₪250 - ₪750",
        popular: false
      },
      {
        icon: Users,
        name: isHebrew ? "Daycare™" : "Daycare™",
        service: isHebrew ? "גן יום לכלבים" : "Dog Daycare",
        rateRange: "₪80 - ₪150",
        perUnit: isHebrew ? "ליום" : "per day",
        example: isHebrew 
          ? "20 ימים בחודש = ₪1,600 - ₪3,000"
          : "20 days/month = ₪1,600 - ₪3,000",
        popular: true
      },
      {
        icon: Scissors,
        name: isHebrew ? "Groomers™" : "Groomers™",
        service: isHebrew ? "טיפוח ותספורות" : "Grooming & Styling",
        rateRange: "₪100 - ₪400",
        perUnit: isHebrew ? "לטיפול" : "per session",
        example: isHebrew 
          ? "15 טיפולים בחודש = ₪1,500 - ₪6,000"
          : "15 sessions/month = ₪1,500 - ₪6,000",
        popular: false
      },
      {
        icon: GraduationCap,
        name: isHebrew ? "Training Academy™" : "Training Academy™",
        service: isHebrew ? "אילוף כלבים" : "Dog Training",
        rateRange: "₪150 - ₪400",
        perUnit: isHebrew ? "לשיעור" : "per lesson",
        example: isHebrew 
          ? "10 שיעורים בשבוע = ₪1,500 - ₪4,000"
          : "10 lessons/week = ₪1,500 - ₪4,000",
        popular: false
      }
    ],
    additionalEarnings: [
      {
        icon: Heart,
        title: isHebrew ? "תוספת לחיית מחמד נוספת" : "Additional Pet Surcharge",
        description: isHebrew 
          ? "הוסף ₪30-80 לכל חיית מחמד נוספת מאותו בית"
          : "Add ₪30-80 for each additional pet from same household"
      },
      {
        icon: Sparkles,
        title: isHebrew ? "שירותים נלווים" : "Add-On Services",
        description: isHebrew 
          ? "הצע רחצה, סירוק, מתן תרופות, עדכוני תמונות - כל אחד ₪20-50+"
          : "Offer bathing, brushing, medication, photo updates - each ₪20-50+"
      },
      {
        icon: Calendar,
        title: isHebrew ? "תעריפי חג וסופ\"ש" : "Holiday & Weekend Rates",
        description: isHebrew 
          ? "תוספת 20-30% בחגים ובסופי שבוע - הביקוש הגבוה ביותר"
          : "20-30% premium on holidays & weekends - highest demand periods"
      },
      {
        icon: Gift,
        title: isHebrew ? "בונוס הפניות" : "Referral Bonus",
        description: isHebrew 
          ? "קבל ₪100 על כל ספק חדש שמצטרף דרכך"
          : "Earn ₪100 for every new Provider who joins through you"
      }
    ],
    incomeScenarios: [
      {
        level: isHebrew ? "פעילות בזמן פנוי" : "Part-Time Side Hustle",
        hours: isHebrew ? "5-10 שעות/שבוע" : "5-10 hours/week",
        monthlyRange: "₪1,500 - ₪4,000",
        description: isHebrew 
          ? "מושלם למי שעובד במשרה מלאה ורוצה הכנסה נוספת"
          : "Perfect for full-time workers wanting extra income"
      },
      {
        level: isHebrew ? "פעילות קבועה" : "Regular Activity",
        hours: isHebrew ? "15-25 שעות/שבוע" : "15-25 hours/week",
        monthlyRange: "₪5,000 - ₪12,000",
        description: isHebrew 
          ? "אידיאלי לסטודנטים, הורים בבית, או עובדים במשרה חלקית"
          : "Ideal for students, stay-at-home parents, or part-time workers"
      },
      {
        level: isHebrew ? "עיסוק עיקרי" : "Full-Time Career",
        hours: isHebrew ? "35+ שעות/שבוע" : "35+ hours/week",
        monthlyRange: "₪15,000 - ₪30,000+",
        description: isHebrew 
          ? "לספקים מקצועיים שזה העיסוק המרכזי שלהם"
          : "For professional Providers making this their main occupation"
      }
    ],
    whyJoin: [
      {
        icon: Clock,
        title: isHebrew ? "גמישות מלאה" : "Full Flexibility",
        description: isHebrew 
          ? "אתה קובע את הזמינות שלך - עבוד כשנוח לך"
          : "You set your availability - work when it suits you"
      },
      {
        icon: DollarSign,
        title: isHebrew ? "אתה קובע את המחיר" : "You Set Your Rates",
        description: isHebrew 
          ? "קבע תעריפים משלך - הרווח 85% מכל הזמנה"
          : "Set your own rates - earn 85% of every booking"
      },
      {
        icon: Users,
        title: isHebrew ? "לקוחות מגיעים אליך" : "Customers Come to You",
        description: isHebrew 
          ? "אנחנו משקיעים במשיכת לקוחות - אתה רק צריך לספק שירות מעולה"
          : "We invest in attracting customers - you just provide great service"
      },
      {
        icon: Star,
        title: isHebrew ? "ביקורות בונות מוניטין" : "Reviews Build Reputation",
        description: isHebrew 
          ? "ביקורות טובות = יותר הזמנות = יותר הכנסה"
          : "Good reviews = more bookings = more income"
      }
    ],
    commission: {
      rate: "15%",
      description: isHebrew 
        ? "עמלת פלטפורמה אחידה - כוללת עיבוד תשלומים, ביטוח, שיווק ותמיכה"
        : "Flat platform fee - includes payment processing, insurance, marketing & support",
      providerKeeps: "85%",
      providerKeepsLabel: isHebrew ? "אתה מקבל" : "You Keep"
    },
    disclaimer: isHebrew 
      ? "הכנסות משוערות בלבד. ההכנסה בפועל תלויה במיקום, ניסיון, דירוגים, עונתיות וזמינות."
      : "Estimated earnings only. Actual income depends on location, experience, ratings, seasonality and availability."
  };

  return (
    <div className={`space-y-8 ${className}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className="text-center">
        <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 mb-4">
          <TrendingUp className="w-4 h-4 mr-1" />
          {isHebrew ? "הזדמנות הכנסה" : "Income Opportunity"}
        </Badge>
        <h2 className="text-3xl font-bold text-white mb-3">{earningPotential.title}</h2>
        <p className="text-lg text-white/60 max-w-2xl mx-auto">{earningPotential.subtitle}</p>
      </div>

      <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-green-400" />
              {isHebrew ? "פוטנציאל הכנסה לפי פלטפורמה" : "Earning Potential by Platform"}
            </span>
            <Badge className="bg-green-500/20 text-green-400 text-lg">
              {earningPotential.commission.providerKeepsLabel}: {earningPotential.commission.providerKeeps}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {earningPotential.platforms.map((platform, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-xl border transition-all hover:scale-[1.02] ${
                  platform.popular 
                    ? "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30" 
                    : "bg-white/5 border-white/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <platform.icon className={`w-5 h-5 ${platform.popular ? "text-green-400" : "text-white/60"}`} />
                  <span className="font-medium text-white">{platform.name}</span>
                  {platform.popular && (
                    <Badge className="bg-green-500/20 text-green-400 text-xs">
                      {isHebrew ? "פופולרי" : "Popular"}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-white/60 mb-2">{platform.service}</p>
                <div className="text-2xl font-bold text-white mb-1">{platform.rateRange}</div>
                <p className="text-xs text-white/40 mb-2">{platform.perUnit}</p>
                <div className="pt-2 border-t border-white/10">
                  <p className="text-sm text-green-400">{platform.example}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            {isHebrew ? "דרכים להגדיל הכנסה" : "Ways to Boost Earnings"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {earningPotential.additionalEarnings.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
              <item.icon className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-white mb-1">{item.title}</h4>
                <p className="text-sm text-white/60">{item.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            {isHebrew ? "תרחישי הכנסה" : "Income Scenarios"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {earningPotential.incomeScenarios.map((scenario, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                <h4 className="font-semibold text-purple-400 mb-1">{scenario.level}</h4>
                <p className="text-xs text-white/40 mb-3">{scenario.hours}</p>
                <div className="text-3xl font-bold text-white mb-2">{scenario.monthlyRange}</div>
                <p className="text-xs text-white/50">{isHebrew ? "לחודש" : "per month"}</p>
                <p className="text-sm text-white/60 mt-3">{scenario.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
            {isHebrew ? "למה להצטרף ל-Pet Wash™?" : "Why Join Pet Wash™?"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {earningPotential.whyJoin.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <item.icon className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-white mb-1">{item.title}</h4>
                <p className="text-sm text-white/60">{item.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
        <p className="text-sm text-amber-400">{earningPotential.disclaimer}</p>
      </div>
    </div>
  );
}

export default ProviderIncomeOpportunity;
