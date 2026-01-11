import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  DollarSign,
  Clock,
  Shield,
  Heart,
  Upload,
  CheckCircle2,
  Star,
  Users,
  Briefcase,
  Car,
  GraduationCap,
  Dog,
  Home,
  ArrowRight,
  FileText,
  Wallet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ProviderType = "sitter" | "walker" | "driver" | "trainer";

interface ProviderRegistrationBannerProps {
  variant?: "hero" | "section" | "compact";
  platform?: ProviderType | "all";
  className?: string;
}

export default function ProviderRegistrationBanner({
  variant = "section",
  platform = "all",
  className = "",
}: ProviderRegistrationBannerProps) {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isRTL = i18n.language === "he" || i18n.language === "ar";
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ProviderType | "">(
    platform !== "all" ? platform : ""
  );
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "",
    experience: "",
    aboutMe: "",
    whyJoinPetWash: "",
    hasVehicle: false,
    hasPetExperience: false,
    hasFirstAid: false,
    agreeToTerms: false,
    agreeToPrivacy: false,
  });
  const [documents, setDocuments] = useState<{
    id?: File;
    certificate?: File;
    insurance?: File;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const providerTypes = [
    {
      id: "sitter" as ProviderType,
      icon: Home,
      title: isRTL ? "שמרטף/ית חיות מחמד" : "Pet Sitter",
      desc: isRTL ? "שמרו על חיות מחמד בבית שלכם או בבית הלקוח" : "Care for pets at your home or client's home",
      color: "from-pink-500 to-rose-600",
    },
    {
      id: "walker" as ProviderType,
      icon: Dog,
      title: isRTL ? "מוליך/ת כלבים" : "Dog Walker",
      desc: isRTL ? "הוליכו כלבים לטיולים יומיים" : "Take dogs on daily walks",
      color: "from-emerald-500 to-teal-600",
    },
    {
      id: "driver" as ProviderType,
      icon: Car,
      title: isRTL ? "נהג/ת הסעות חיות מחמד" : "Pet Transport Driver",
      desc: isRTL ? "הסיעו חיות מחמד בבטחה ובנוחות" : "Transport pets safely and comfortably",
      color: "from-blue-500 to-indigo-600",
    },
    {
      id: "trainer" as ProviderType,
      icon: GraduationCap,
      title: isRTL ? "מאלף/ת חיות מחמד" : "Pet Trainer",
      desc: isRTL ? "אלפו והדריכו חיות מחמד" : "Train and guide pets",
      color: "from-amber-500 to-orange-600",
    },
  ];

  const benefits = [
    {
      icon: DollarSign,
      title: isRTL ? "הכנסה גמישה" : "Flexible Income",
      desc: isRTL ? "עד ₪200+ לשעה" : "Up to ₪200+/hour",
    },
    {
      icon: Clock,
      title: isRTL ? "שעות גמישות" : "Flexible Hours",
      desc: isRTL ? "עבדו מתי שנוח לכם" : "Work when you want",
    },
    {
      icon: Shield,
      title: isRTL ? "ביטוח מלא" : "Full Insurance",
      desc: isRTL ? "כיסוי ביטוחי מקיף" : "Comprehensive coverage",
    },
    {
      icon: Heart,
      title: isRTL ? "קהילה תומכת" : "Supportive Community",
      desc: isRTL ? "חלק ממשפחת Pet Wash™" : "Part of Pet Wash™ family",
    },
  ];

  const requirements = [
    isRTL ? "גיל 18 ומעלה" : "Age 18+",
    isRTL ? "תעודת זהות תקפה" : "Valid ID",
    isRTL ? "ניסיון עם חיות מחמד (מועדף)" : "Pet experience (preferred)",
    isRTL ? "אישור משטרה נקי" : "Clean police clearance",
    isRTL ? "זמינות לפחות 10 שעות בשבוע" : "At least 10 hours/week availability",
  ];

  const handleFileChange = (type: "id" | "certificate" | "insurance", file: File | null) => {
    if (file) {
      setDocuments((prev) => ({ ...prev, [type]: file }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast({
        title: isRTL ? "שם מלא נדרש" : "Full Name Required",
        description: isRTL ? "אנא הזינו שם פרטי ומשפחה" : "Please enter first and last name",
        variant: "destructive",
      });
      return;
    }

    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({
        title: isRTL ? "אימייל לא תקין" : "Invalid Email",
        description: isRTL ? "אנא הזינו כתובת אימייל תקינה" : "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (!formData.phone.trim() || formData.phone.replace(/\D/g, '').length < 9) {
      toast({
        title: isRTL ? "מספר טלפון לא תקין" : "Invalid Phone Number",
        description: isRTL ? "אנא הזינו מספר טלפון תקין" : "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    if (!formData.city.trim()) {
      toast({
        title: isRTL ? "עיר מגורים נדרשת" : "City Required",
        description: isRTL ? "אנא הזינו את עיר מגוריכם" : "Please enter your city",
        variant: "destructive",
      });
      return;
    }

    if (!formData.aboutMe.trim() || formData.aboutMe.length < 20) {
      toast({
        title: isRTL ? "ספרו על עצמכם" : "Tell Us About Yourself",
        description: isRTL ? "אנא כתבו לפחות 20 תווים" : "Please write at least 20 characters",
        variant: "destructive",
      });
      return;
    }

    if (!formData.whyJoinPetWash.trim() || formData.whyJoinPetWash.length < 20) {
      toast({
        title: isRTL ? "למה אתם רוצים להצטרף?" : "Why Do You Want to Join?",
        description: isRTL ? "אנא כתבו לפחות 20 תווים" : "Please write at least 20 characters",
        variant: "destructive",
      });
      return;
    }

    if (!formData.agreeToTerms || !formData.agreeToPrivacy) {
      toast({
        title: isRTL ? "נדרשת הסכמה לתנאים" : "Agreement Required",
        description: isRTL ? "יש לאשר את תנאי השימוש ומדיניות הפרטיות" : "Please agree to the terms and privacy policy",
        variant: "destructive",
      });
      return;
    }

    if (!selectedType) {
      toast({
        title: isRTL ? "בחרו סוג שירות" : "Select Service Type",
        description: isRTL ? "יש לבחור את סוג השירות שברצונכם להציע" : "Please select the type of service you want to offer",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber: formData.phone.trim(),
        city: formData.city.trim(),
        providerType: selectedType,
        selectedPlatforms: [selectedType],
        yearsExperience: formData.experience || "0",
        hasOwnTransport: formData.hasVehicle,
        hasPetFirstAid: formData.hasFirstAid,
        hasInsurance: false,
        aboutMe: formData.aboutMe.trim(),
        whyJoinPetWash: formData.whyJoinPetWash.trim(),
        agreeToTerms: formData.agreeToTerms,
        agreeToPrivacy: formData.agreeToPrivacy,
        agreeToContractorStatus: true,
      };

      const response = await fetch("/api/provider-intake/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: isRTL ? "הבקשה נשלחה בהצלחה! 🎉" : "Application Submitted! 🎉",
          description: isRTL 
            ? "נציג מטעמנו יחזור אליכם תוך 48 שעות" 
            : "Our team will contact you within 48 hours",
        });
        setIsFormOpen(false);
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          city: "",
          experience: "",
          aboutMe: "",
          whyJoinPetWash: "",
          hasVehicle: false,
          hasPetExperience: false,
          hasFirstAid: false,
          agreeToTerms: false,
          agreeToPrivacy: false,
        });
        setDocuments({});
      } else {
        throw new Error(result.error || "Failed to submit");
      }
    } catch (error: any) {
      toast({
        title: isRTL ? "שגיאה בשליחה" : "Submission Error",
        description: error.message || (isRTL ? "אנא נסו שוב מאוחר יותר" : "Please try again later"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (variant === "compact") {
    return (
      <div className={`bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 border border-cyan-500/30 rounded-2xl p-6 backdrop-blur-xl ${className}`}>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">
                {isRTL ? "הצטרפו למשפחת Pet Wash™" : "Join Pet Wash™ Family"}
              </h3>
              <p className="text-gray-400 text-sm">
                {isRTL ? "הרוויחו עד ₪200+ לשעה" : "Earn up to ₪200+/hour"}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold px-6 py-2 rounded-full shadow-lg shadow-cyan-500/25"
          >
            {isRTL ? "הגשת מועמדות" : "Apply Now"}
            <ArrowRight className={`w-4 h-4 ${isRTL ? "mr-2 rotate-180" : "ml-2"}`} />
          </Button>
        </div>
        
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
            <ApplicationForm
              isRTL={isRTL}
              selectedType={selectedType}
              setSelectedType={setSelectedType}
              formData={formData}
              setFormData={setFormData}
              documents={documents}
              handleFileChange={handleFileChange}
              handleSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              providerTypes={providerTypes}
              requirements={requirements}
              platform={platform}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <section className={`relative overflow-hidden ${className}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/20 via-transparent to-purple-500/20" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className={`${isRTL ? "lg:order-2" : ""}`}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 mb-6">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-400 font-medium text-sm">
                  {isRTL ? "הזדמנות קריירה" : "Career Opportunity"}
                </span>
              </div>
              
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
                {isRTL ? (
                  <>
                    הפכו את <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">אהבת החיות</span>
                    <br />למקור הכנסה
                  </>
                ) : (
                  <>
                    Turn Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Pet Love</span>
                    <br />Into Income
                  </>
                )}
              </h2>
              
              <p className="text-gray-300 text-lg mb-8">
                {isRTL 
                  ? "הצטרפו למשפחת Pet Wash™ בתור שותפים חיצוניים והרוויחו הכנסה נוספת בשעות הפנויות שלכם. אנחנו מחפשים שמרטפים, מוליכי כלבים, נהגים ומאלפים."
                  : "Join the Pet Wash™ family as external partners and earn extra income during your free time. We're looking for pet sitters, dog walkers, drivers, and trainers."}
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {benefits.map((benefit, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400/20 to-purple-400/20 flex items-center justify-center">
                      <benefit.icon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{benefit.title}</div>
                      <div className="text-gray-400 text-xs">{benefit.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => setIsFormOpen(true)}
                size="lg"
                className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold px-8 py-6 text-lg rounded-2xl shadow-2xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300 hover:scale-105"
              >
                {isRTL ? "הגישו מועמדות עכשיו" : "Apply Now"}
                <ArrowRight className={`w-5 h-5 ${isRTL ? "mr-3 rotate-180" : "ml-3"}`} />
              </Button>
            </div>

            <div className={`${isRTL ? "lg:order-1" : ""}`}>
              <div className="grid grid-cols-2 gap-4">
                {providerTypes.map((type, idx) => (
                  <div
                    key={type.id}
                    onClick={() => {
                      setSelectedType(type.id);
                      setIsFormOpen(true);
                    }}
                    className="group cursor-pointer p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/50 transition-all duration-300 hover:scale-105 hover:bg-white/10"
                  >
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${type.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <type.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="font-bold text-white mb-2">{type.title}</h3>
                    <p className="text-gray-400 text-sm">{type.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
            <ApplicationForm
              isRTL={isRTL}
              selectedType={selectedType}
              setSelectedType={setSelectedType}
              formData={formData}
              setFormData={setFormData}
              documents={documents}
              handleFileChange={handleFileChange}
              handleSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              providerTypes={providerTypes}
              requirements={requirements}
              platform={platform}
            />
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  return (
    <section className={`relative overflow-hidden py-16 ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-black/95 backdrop-blur-xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-purple-500/10" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 mb-6">
            <Wallet className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 font-medium text-sm">
              {isRTL ? "הזדמנות הכנסה נוספת" : "Extra Income Opportunity"}
            </span>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            {isRTL ? "הצטרפו למשפחת Pet Wash™" : "Join the Pet Wash™ Family"}
          </h2>
          
          <p className="text-gray-300 max-w-2xl mx-auto">
            {isRTL 
              ? "הפכו את אהבת החיות שלכם להכנסה נוספת. הצטרפו כשותפים חיצוניים והיו חלק מהמהפכה בטיפול בחיות מחמד."
              : "Turn your love for pets into extra income. Join as external partners and be part of the pet care revolution."}
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-10">
          {providerTypes.map((type) => (
            <div
              key={type.id}
              onClick={() => {
                setSelectedType(type.id);
                setIsFormOpen(true);
              }}
              className="group cursor-pointer p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/50 transition-all duration-300 hover:scale-105"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center mb-4`}>
                <type.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-white mb-1">{type.title}</h3>
              <p className="text-gray-400 text-sm">{type.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-center gap-2 text-gray-300">
                <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                <span>{benefit.title}</span>
              </div>
            ))}
          </div>
          
          <Button
            onClick={() => setIsFormOpen(true)}
            size="lg"
            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold px-10 py-6 text-lg rounded-2xl shadow-2xl shadow-cyan-500/25"
          >
            {isRTL ? "הגישו מועמדות עכשיו" : "Apply Now"}
            <ArrowRight className={`w-5 h-5 ${isRTL ? "mr-3 rotate-180" : "ml-3"}`} />
          </Button>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
          <ApplicationForm
            isRTL={isRTL}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            formData={formData}
            setFormData={setFormData}
            documents={documents}
            handleFileChange={handleFileChange}
            handleSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            providerTypes={providerTypes}
            requirements={requirements}
            platform={platform}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ApplicationForm({
  isRTL,
  selectedType,
  setSelectedType,
  formData,
  setFormData,
  documents,
  handleFileChange,
  handleSubmit,
  isSubmitting,
  providerTypes,
  requirements,
  platform,
}: {
  isRTL: boolean;
  selectedType: ProviderType | "";
  setSelectedType: (type: ProviderType | "") => void;
  formData: any;
  setFormData: any;
  documents: any;
  handleFileChange: (type: "id" | "certificate" | "insurance", file: File | null) => void;
  handleSubmit: () => void;
  isSubmitting: boolean;
  providerTypes: any[];
  requirements: string[];
  platform: ProviderType | "all";
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl font-black text-center">
          {isRTL ? "טופס הרשמה לשותפים" : "Partner Application Form"}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6 mt-4" dir={isRTL ? "rtl" : "ltr"}>
        {platform === "all" && (
          <div>
            <Label className="text-gray-300 mb-3 block">
              {isRTL ? "סוג השירות *" : "Service Type *"}
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {providerTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedType === type.id
                      ? "border-cyan-500 bg-cyan-500/20"
                      : "border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${type.color} flex items-center justify-center mb-2 mx-auto`}>
                    <type.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-white font-medium text-sm">{type.title}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-300">{isRTL ? "שם פרטי *" : "First Name *"}</Label>
            <Input
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder={isRTL ? "הזינו שם פרטי" : "Enter first name"}
              required
            />
          </div>
          <div>
            <Label className="text-gray-300">{isRTL ? "שם משפחה *" : "Last Name *"}</Label>
            <Input
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder={isRTL ? "הזינו שם משפחה" : "Enter last name"}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-300">{isRTL ? "עיר מגורים *" : "City *"}</Label>
            <Input
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder={isRTL ? "הזינו עיר" : "Enter city"}
              required
            />
          </div>
          <div>
            <Label className="text-gray-300">{isRTL ? "שנות ניסיון" : "Years of Experience"}</Label>
            <Input
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder={isRTL ? "לדוגמה: 2-5" : "e.g., 2-5"}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-300">{isRTL ? "אימייל *" : "Email *"}</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder="email@example.com"
              required
            />
          </div>
          <div>
            <Label className="text-gray-300">{isRTL ? "טלפון *" : "Phone *"}</Label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder="05X-XXX-XXXX"
              required
            />
          </div>
        </div>

        <div>
          <Label className="text-gray-300">{isRTL ? "ספרו על עצמכם *" : "About Yourself *"}</Label>
          <Textarea
            value={formData.aboutMe}
            onChange={(e) => setFormData({ ...formData, aboutMe: e.target.value })}
            className="bg-gray-800 border-gray-700 text-white mt-1"
            placeholder={isRTL ? "ספרו על עצמכם ועל הניסיון שלכם עם חיות מחמד (לפחות 20 תווים)..." : "Tell us about yourself and your experience with pets (at least 20 characters)..."}
            rows={3}
          />
        </div>

        <div>
          <Label className="text-gray-300">{isRTL ? "למה אתם רוצים להצטרף? *" : "Why do you want to join Pet Wash? *"}</Label>
          <Textarea
            value={formData.whyJoinPetWash}
            onChange={(e) => setFormData({ ...formData, whyJoinPetWash: e.target.value })}
            className="bg-gray-800 border-gray-700 text-white mt-1"
            placeholder={isRTL ? "מה מושך אתכם בעבודה עם חיות מחמד? (לפחות 20 תווים)" : "What attracts you to working with pets? (at least 20 characters)"}
            rows={2}
          />
        </div>

        <div className="space-y-3">
          <Label className="text-gray-300 block mb-2">{isRTL ? "העלאת מסמכים" : "Document Upload"}</Label>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-gray-800 border border-dashed border-gray-600 hover:border-cyan-500 transition-colors">
              <label className="cursor-pointer block text-center">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm text-gray-400">
                  {isRTL ? "תעודת זהות" : "ID Document"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange("id", e.target.files?.[0] || null)}
                />
                {documents.id && (
                  <div className="mt-2 text-xs text-cyan-400 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {documents.id.name.slice(0, 15)}...
                  </div>
                )}
              </label>
            </div>

            <div className="p-4 rounded-xl bg-gray-800 border border-dashed border-gray-600 hover:border-cyan-500 transition-colors">
              <label className="cursor-pointer block text-center">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm text-gray-400">
                  {isRTL ? "תעודות/הסמכות" : "Certificates"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange("certificate", e.target.files?.[0] || null)}
                />
                {documents.certificate && (
                  <div className="mt-2 text-xs text-cyan-400 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {documents.certificate.name.slice(0, 15)}...
                  </div>
                )}
              </label>
            </div>

            <div className="p-4 rounded-xl bg-gray-800 border border-dashed border-gray-600 hover:border-cyan-500 transition-colors">
              <label className="cursor-pointer block text-center">
                <Shield className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm text-gray-400">
                  {isRTL ? "ביטוח (אופציונלי)" : "Insurance (optional)"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange("insurance", e.target.files?.[0] || null)}
                />
                {documents.insurance && (
                  <div className="mt-2 text-xs text-cyan-400 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {documents.insurance.name.slice(0, 15)}...
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4 rounded-xl bg-gray-800/50">
          <Label className="text-gray-300 block">{isRTL ? "פרטים נוספים" : "Additional Details"}</Label>
          
          <div className="flex items-center gap-3">
            <Checkbox
              id="hasVehicle"
              checked={formData.hasVehicle}
              onCheckedChange={(checked) => setFormData({ ...formData, hasVehicle: checked })}
              className="border-gray-600"
            />
            <label htmlFor="hasVehicle" className="text-gray-300 text-sm cursor-pointer">
              {isRTL ? "יש לי רכב פרטי" : "I have a personal vehicle"}
            </label>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="hasPetExperience"
              checked={formData.hasPetExperience}
              onCheckedChange={(checked) => setFormData({ ...formData, hasPetExperience: checked })}
              className="border-gray-600"
            />
            <label htmlFor="hasPetExperience" className="text-gray-300 text-sm cursor-pointer">
              {isRTL ? "יש לי ניסיון מקצועי עם חיות מחמד" : "I have professional pet experience"}
            </label>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="hasFirstAid"
              checked={formData.hasFirstAid}
              onCheckedChange={(checked) => setFormData({ ...formData, hasFirstAid: checked })}
              className="border-gray-600"
            />
            <label htmlFor="hasFirstAid" className="text-gray-300 text-sm cursor-pointer">
              {isRTL ? "יש לי הכשרה בעזרה ראשונה" : "I have first aid training"}
            </label>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
          <h4 className="font-bold text-cyan-400 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4" />
            {isRTL ? "תנאי קבלה" : "Acceptance Requirements"}
          </h4>
          <ul className="space-y-2">
            {requirements.map((req, idx) => (
              <li key={idx} className="flex items-center gap-2 text-gray-300 text-sm">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                {req}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
          <Checkbox
            id="agreeToTerms"
            checked={formData.agreeToTerms && formData.agreeToPrivacy}
            onCheckedChange={(checked) => setFormData({ ...formData, agreeToTerms: !!checked, agreeToPrivacy: !!checked })}
            className="border-purple-500 mt-1"
          />
          <label htmlFor="agreeToTerms" className="text-gray-300 text-sm cursor-pointer">
            {isRTL 
              ? "אני מאשר/ת את תנאי השימוש ומדיניות הפרטיות של Pet Wash™. אני מבין/ה שזו הרשמה למועמדות ולא התחייבות לקבלה."
              : "I agree to Pet Wash™ terms of service and privacy policy. I understand this is an application, not a guarantee of acceptance."}
          </label>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold py-6 text-lg rounded-xl"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {isRTL ? "שולח..." : "Submitting..."}
            </span>
          ) : (
            <>
              {isRTL ? "שלחו את המועמדות" : "Submit Application"}
              <ArrowRight className={`w-5 h-5 ${isRTL ? "mr-2 rotate-180" : "ml-2"}`} />
            </>
          )}
        </Button>
      </div>
    </>
  );
}
