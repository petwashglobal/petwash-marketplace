import { useState } from "react";
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
  MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { getApiUrl } from '@/lib/apiConfig';
import { useLanguage } from "@/lib/languageStore";

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
  const { t, dir, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isRTL = dir === "rtl";
  
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
      title: t("providerBanner.petSitter"),
      desc: t("providerBanner.petSitterDesc"),
      color: "from-pink-500 to-rose-600",
    },
    {
      id: "walker" as ProviderType,
      icon: Dog,
      title: t("providerBanner.dogWalker"),
      desc: t("providerBanner.dogWalkerDesc"),
      color: "from-emerald-500 to-teal-600",
    },
    {
      id: "driver" as ProviderType,
      icon: Car,
      title: t("providerBanner.petDriver"),
      desc: t("providerBanner.petDriverDesc"),
      color: "from-blue-500 to-indigo-600",
      comingSoon: true,
    },
    {
      id: "trainer" as ProviderType,
      icon: GraduationCap,
      title: t("providerBanner.petTrainer"),
      desc: t("providerBanner.petTrainerDesc"),
      color: "from-amber-500 to-orange-600",
    },
  ];

  const benefits = [
    {
      icon: DollarSign,
      title: t("providerBanner.flexibleIncome"),
      desc: t("providerBanner.flexibleIncomeDesc"),
    },
    {
      icon: Clock,
      title: t("providerBanner.flexibleHours"),
      desc: t("providerBanner.flexibleHoursDesc"),
    },
    {
      icon: Shield,
      title: t("providerBanner.fullInsurance"),
      desc: t("providerBanner.fullInsuranceDesc"),
    },
    {
      icon: Heart,
      title: t("providerBanner.supportiveCommunity"),
      desc: t("providerBanner.supportiveCommunityDesc"),
    },
  ];

  const requirements = [
    t("providerBanner.reqAge"),
    t("providerBanner.reqValidId"),
    t("providerBanner.reqPetExperience"),
    t("providerBanner.reqPolice"),
    t("providerBanner.reqAvailability"),
  ];

  const handleFileChange = (type: "id" | "certificate" | "insurance", file: File | null) => {
    if (file) {
      setDocuments((prev) => ({ ...prev, [type]: file }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast({
        title: t("providerBanner.fullNameRequired"),
        description: t("providerBanner.enterFullName"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({
        title: t("providerBanner.invalidEmail"),
        description: t("providerBanner.enterValidEmail"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.phone.trim() || formData.phone.replace(/\D/g, '').length < 9) {
      toast({
        title: t("providerBanner.invalidPhone"),
        description: t("providerBanner.enterValidPhone"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.city.trim()) {
      toast({
        title: t("providerBanner.cityRequired"),
        description: t("providerBanner.enterCity"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.aboutMe.trim() || formData.aboutMe.length < 20) {
      toast({
        title: t("providerBanner.tellAboutYourself"),
        description: t("providerBanner.writeMinChars"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.whyJoinPetWash.trim() || formData.whyJoinPetWash.length < 20) {
      toast({
        title: t("providerBanner.whyJoinTitle"),
        description: t("providerBanner.writeMinChars"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.agreeToTerms || !formData.agreeToPrivacy) {
      toast({
        title: t("providerBanner.agreementRequired"),
        description: t("providerBanner.agreeToTermsDesc"),
        variant: "destructive",
      });
      return;
    }

    if (!selectedType) {
      toast({
        title: t("providerBanner.selectServiceType"),
        description: t("providerBanner.selectServiceDesc"),
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

      const response = await fetch(getApiUrl("/api/provider-intake/submit"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: t("providerBanner.applicationSubmitted"),
          description: t("providerBanner.contactWithin48"),
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
        title: t("providerBanner.submissionError"),
        description: error.message || t("providerBanner.tryAgainLater"),
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
                {t("providerBanner.joinFamily")}
              </h3>
              <p className="text-gray-400 text-sm">
                {t("providerBanner.earnUpTo")}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold px-6 py-2 rounded-full shadow-lg shadow-cyan-500/25"
          >
            {t("providerBanner.applyNow")}
            <ArrowRight className={`w-4 h-4 ${isRTL ? "mr-2 rotate-180" : "ml-2"}`} />
          </Button>
        </div>
        
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-gray-200 text-gray-900">
            <ApplicationForm
              t={t}
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
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/20 via-transparent to-purple-500/20 pointer-events-none" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className={`${isRTL ? "lg:order-2" : ""}`}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 mb-6">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-400 font-medium text-sm">
                  {t("providerBanner.careerOpportunity")}
                </span>
              </div>
              
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
                {t("providerBanner.turnYourPetLove")}{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">{t("providerBanner.petLove")}</span>
                <br />{t("providerBanner.intoIncome")}
              </h2>
              
              <p className="text-gray-300 text-lg mb-8">
                {t("providerBanner.heroDescription")}
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
                {t("providerBanner.applyNow")}
                <ArrowRight className={`w-5 h-5 ${isRTL ? "mr-3 rotate-180" : "ml-3"}`} />
              </Button>
            </div>

            <div className={`${isRTL ? "lg:order-1" : ""}`}>
              <div className="grid grid-cols-2 gap-4">
                {providerTypes.map((type, idx) => (
                  <div
                    key={type.id}
                    role="button"
                    tabIndex={type.comingSoon ? -1 : 0}
                    onClick={() => {
                      if (type.comingSoon) return;
                      setSelectedType(type.id);
                      setIsFormOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !type.comingSoon) {
                        setSelectedType(type.id);
                        setIsFormOpen(true);
                      }
                    }}
                    className={`group p-6 rounded-2xl border transition-all duration-300 ${type.comingSoon ? 'cursor-default opacity-60 bg-white/3 border-white/5' : 'cursor-pointer bg-white/5 border-white/10 hover:border-cyan-500/50 hover:scale-105 hover:bg-white/10 active:scale-95'}`}
                  >
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${type.color} flex items-center justify-center mb-4 ${type.comingSoon ? '' : 'group-hover:scale-110'} transition-transform`}>
                      <type.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                      {type.title}
                      {type.comingSoon && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold tracking-wide">{isRTL ? 'בקרוב' : 'Coming Soon'}</span>}
                    </h3>
                    <p className="text-gray-400 text-sm">{type.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-gray-200 text-gray-900">
            <ApplicationForm
              t={t}
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
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-black/95 backdrop-blur-xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-purple-500/10 pointer-events-none" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 mb-6">
            <Wallet className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 font-medium text-sm">
              {t("providerBanner.extraIncomeOpportunity")}
            </span>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            {t("providerBanner.joinTheFamily")}
          </h2>
          
          <p className="text-gray-300 max-w-2xl mx-auto">
            {t("providerBanner.sectionDescription")}
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-10">
          {providerTypes.map((type) => (
            <div
              key={type.id}
              role="button"
              tabIndex={type.comingSoon ? -1 : 0}
              onClick={() => {
                if (type.comingSoon) return;
                setSelectedType(type.id);
                setIsFormOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !type.comingSoon) {
                  setSelectedType(type.id);
                  setIsFormOpen(true);
                }
              }}
              className={`group p-6 rounded-2xl border transition-all duration-300 ${type.comingSoon ? 'cursor-default opacity-60 bg-white/3 border-white/5' : 'cursor-pointer bg-white/5 border-white/10 hover:border-cyan-500/50 hover:scale-105 active:scale-95'}`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center mb-4`}>
                <type.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-white mb-1 flex items-center gap-2">
                {type.title}
                {type.comingSoon && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold tracking-wide">{isRTL ? 'בקרוב' : 'Coming Soon'}</span>}
              </h3>
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
            {t("providerBanner.applyNow")}
            <ArrowRight className={`w-5 h-5 ${isRTL ? "mr-3 rotate-180" : "ml-3"}`} />
          </Button>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-gray-200 text-gray-900">
          <ApplicationForm
            t={t}
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
  t,
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
  t: (key: string) => string;
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
          {t("providerBanner.partnerApplicationForm")}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6 mt-4" dir={isRTL ? "rtl" : "ltr"}>
        {platform === "all" && (
          <div>
            <Label className="text-gray-700 mb-3 block">
              {t("providerBanner.serviceType")}
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {providerTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  disabled={type.comingSoon}
                  onClick={() => { if (!type.comingSoon) setSelectedType(type.id); }}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    type.comingSoon
                      ? "border-gray-200 opacity-50 cursor-not-allowed"
                      : selectedType === type.id
                        ? "border-cyan-500 bg-cyan-50"
                        : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${type.color} flex items-center justify-center mb-2 mx-auto`}>
                    <type.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-gray-900 font-medium text-sm">{type.title}</div>
                  {type.comingSoon && <div className="text-amber-600 text-[10px] font-semibold mt-1">{isRTL ? 'בקרוב' : 'Coming Soon'}</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-700">{t("providerBanner.firstName")}</Label>
            <Input
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="bg-white border-gray-300 text-gray-900 mt-1"
              placeholder={t("providerBanner.firstNamePlaceholder")}
              required
            />
          </div>
          <div>
            <Label className="text-gray-700">{t("providerBanner.lastName")}</Label>
            <Input
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="bg-white border-gray-300 text-gray-900 mt-1"
              placeholder={t("providerBanner.lastNamePlaceholder")}
              required
            />
          </div>
        </div>

        <div>
          <Label className="text-gray-700 mb-2 block flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-600" />
            {t("providerBanner.serviceArea")}
          </Label>
          <GooglePlacesAutocomplete
            value={formData.city}
            onChange={(value, details) => {
              const cityName = details?.city || value;
              setFormData({ ...formData, city: cityName });
            }}
            placeholder={t("providerBanner.serviceAreaPlaceholder")}
            country={['il']}
            className="[&_input]:bg-white [&_input]:border-gray-300 [&_input]:text-gray-900 [&_input]:placeholder:text-gray-400"
          />
          <p className="text-xs text-gray-500 mt-1">
            {t("providerBanner.serviceAreaHint")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-700">{t("providerBanner.yearsExperience")}</Label>
            <Input
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              className="bg-white border-gray-300 text-gray-900 mt-1"
              placeholder={t("providerBanner.yearsExperiencePlaceholder")}
            />
          </div>
          <div className="flex items-end">
            <p className="text-xs text-gray-500 pb-2">
              {t("providerBanner.serviceAreaAffects")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-700">{t("providerBanner.email")}</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-white border-gray-300 text-gray-900 mt-1"
              placeholder="email@example.com"
              required
            />
          </div>
          <div>
            <Label className="text-gray-700">{t("providerBanner.phone")}</Label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="bg-white border-gray-300 text-gray-900 mt-1"
              placeholder="05X-XXX-XXXX"
              required
            />
          </div>
        </div>

        <div>
          <Label className="text-gray-700">{t("providerBanner.aboutYourself")}</Label>
          <Textarea
            value={formData.aboutMe}
            onChange={(e) => setFormData({ ...formData, aboutMe: e.target.value })}
            className="bg-white border-gray-300 text-gray-900 mt-1"
            placeholder={t("providerBanner.aboutYourselfPlaceholder")}
            rows={3}
          />
        </div>

        <div>
          <Label className="text-gray-700">{t("providerBanner.whyJoin")}</Label>
          <Textarea
            value={formData.whyJoinPetWash}
            onChange={(e) => setFormData({ ...formData, whyJoinPetWash: e.target.value })}
            className="bg-white border-gray-300 text-gray-900 mt-1"
            placeholder={t("providerBanner.whyJoinPlaceholder")}
            rows={2}
          />
        </div>

        <div className="space-y-3">
          <Label className="text-gray-700 block mb-2">{t("providerBanner.documentUpload")}</Label>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-300 hover:border-cyan-500 transition-colors">
              <label className="cursor-pointer block text-center">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm text-gray-500">
                  {t("providerBanner.idDocument")}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange("id", e.target.files?.[0] || null)}
                />
                {documents.id && (
                  <div className="mt-2 text-xs text-cyan-600 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {documents.id.name.slice(0, 15)}...
                  </div>
                )}
              </label>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-300 hover:border-cyan-500 transition-colors">
              <label className="cursor-pointer block text-center">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm text-gray-500">
                  {t("providerBanner.certificates")}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange("certificate", e.target.files?.[0] || null)}
                />
                {documents.certificate && (
                  <div className="mt-2 text-xs text-cyan-600 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {documents.certificate.name.slice(0, 15)}...
                  </div>
                )}
              </label>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-300 hover:border-cyan-500 transition-colors">
              <label className="cursor-pointer block text-center">
                <Shield className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm text-gray-500">
                  {t("providerBanner.insuranceOptional")}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange("insurance", e.target.files?.[0] || null)}
                />
                {documents.insurance && (
                  <div className="mt-2 text-xs text-cyan-600 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {documents.insurance.name.slice(0, 15)}...
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4 rounded-xl bg-gray-50">
          <Label className="text-gray-700 block">{t("providerBanner.additionalDetails")}</Label>
          
          <div className="flex items-center gap-3">
            <Checkbox
              id="hasVehicle"
              checked={formData.hasVehicle}
              onCheckedChange={(checked) => setFormData({ ...formData, hasVehicle: checked })}
              className="border-gray-300"
            />
            <label htmlFor="hasVehicle" className="text-gray-700 text-sm cursor-pointer">
              {t("providerBanner.hasVehicle")}
            </label>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="hasPetExperience"
              checked={formData.hasPetExperience}
              onCheckedChange={(checked) => setFormData({ ...formData, hasPetExperience: checked })}
              className="border-gray-300"
            />
            <label htmlFor="hasPetExperience" className="text-gray-700 text-sm cursor-pointer">
              {t("providerBanner.hasPetExperience")}
            </label>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="hasFirstAid"
              checked={formData.hasFirstAid}
              onCheckedChange={(checked) => setFormData({ ...formData, hasFirstAid: checked })}
              className="border-gray-300"
            />
            <label htmlFor="hasFirstAid" className="text-gray-700 text-sm cursor-pointer">
              {t("providerBanner.hasFirstAid")}
            </label>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-200">
          <h4 className="font-bold text-cyan-700 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4" />
            {t("providerBanner.acceptanceRequirements")}
          </h4>
          <ul className="space-y-2">
            {requirements.map((req, idx) => (
              <li key={idx} className="flex items-center gap-2 text-gray-700 text-sm">
                <CheckCircle2 className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                {req}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-50 border border-purple-200">
          <Checkbox
            id="agreeToTerms"
            checked={formData.agreeToTerms && formData.agreeToPrivacy}
            onCheckedChange={(checked) => setFormData({ ...formData, agreeToTerms: !!checked, agreeToPrivacy: !!checked })}
            className="border-purple-400 mt-1"
          />
          <label htmlFor="agreeToTerms" className="text-gray-700 text-sm cursor-pointer">
            {t("providerBanner.agreeToTerms")}
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
              {t("providerBanner.submitting")}
            </span>
          ) : (
            <>
              {t("providerBanner.submitApplication")}
              <ArrowRight className={`w-5 h-5 ${isRTL ? "mr-2 rotate-180" : "ml-2"}`} />
            </>
          )}
        </Button>
      </div>
    </>
  );
}
