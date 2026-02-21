import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  DollarSign,
  Clock,
  Shield,
  Heart,
  CheckCircle2,
  Briefcase,
  Car,
  GraduationCap,
  Dog,
  Home,
  ArrowRight,
  Wallet,
} from "lucide-react";
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
  const isRTL = dir === "rtl";
  
  const navigateToOnboarding = () => {
    setLocation("/become-provider");
  };

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

  if (variant === "compact") {
    return (
      <div className={`bg-emerald-50 border border-emerald-200 rounded-2xl p-6 ${className}`}>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">
                {t("providerBanner.joinFamily")}
              </h3>
              <p className="text-gray-600 text-sm">
                {t("providerBanner.earnUpTo")}
              </p>
            </div>
          </div>
          <Button
            onClick={navigateToOnboarding}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold px-6 py-2 rounded-full shadow-lg shadow-cyan-500/25"
          >
            {t("providerBanner.applyNow")}
            <ArrowRight className={`w-4 h-4 ${isRTL ? "mr-2 rotate-180" : "ml-2"}`} />
          </Button>
        </div>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <section className={`relative overflow-hidden bg-white ${className}`}>
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className={`${isRTL ? "lg:order-2" : ""}`}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 mb-6">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-medium text-sm">
                  {t("providerBanner.careerOpportunity")}
                </span>
              </div>
              
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 leading-tight">
                {t("providerBanner.turnYourPetLove")}{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">{t("providerBanner.petLove")}</span>
                <br />{t("providerBanner.intoIncome")}
              </h2>
              
              <p className="text-gray-600 text-lg mb-8">
                {t("providerBanner.heroDescription")}
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {benefits.map((benefit, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <benefit.icon className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{benefit.title}</div>
                      <div className="text-gray-500 text-xs">{benefit.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={navigateToOnboarding}
                size="lg"
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold px-8 py-6 text-lg rounded-2xl shadow-2xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 hover:scale-105"
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
                      if (!type.comingSoon) navigateToOnboarding();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !type.comingSoon) navigateToOnboarding();
                    }}
                    className={`group p-6 rounded-2xl border transition-all duration-300 ${type.comingSoon ? 'cursor-default opacity-60 bg-gray-50 border-gray-100' : 'cursor-pointer bg-gray-50 border-gray-200 hover:border-emerald-400 hover:scale-105 hover:bg-gray-100 active:scale-95'}`}
                  >
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${type.color} flex items-center justify-center mb-4 ${type.comingSoon ? '' : 'group-hover:scale-110'} transition-transform`}>
                      <type.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                      {type.title}
                      {type.comingSoon && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold tracking-wide">{isRTL ? 'בקרוב' : 'Coming Soon'}</span>}
                    </h3>
                    <p className="text-gray-500 text-sm">{type.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`relative overflow-hidden py-16 bg-white ${className}`}>
      <div className="relative z-10 max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 mb-6">
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span className="text-emerald-700 font-medium text-sm">
              {t("providerBanner.extraIncomeOpportunity")}
            </span>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
            {t("providerBanner.joinTheFamily")}
          </h2>
          
          <p className="text-gray-600 max-w-2xl mx-auto">
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
                if (!type.comingSoon) navigateToOnboarding();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !type.comingSoon) navigateToOnboarding();
              }}
              className={`group p-6 rounded-2xl border transition-all duration-300 ${type.comingSoon ? 'cursor-default opacity-60 bg-gray-50 border-gray-100' : 'cursor-pointer bg-gray-50 border-gray-200 hover:border-emerald-400 hover:scale-105 active:scale-95'}`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center mb-4`}>
                <type.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                {type.title}
                {type.comingSoon && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold tracking-wide">{isRTL ? 'בקרוב' : 'Coming Soon'}</span>}
              </h3>
              <p className="text-gray-500 text-sm">{type.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-center gap-2 text-gray-700">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>{benefit.title}</span>
              </div>
            ))}
          </div>
          
          <Button
            onClick={navigateToOnboarding}
            size="lg"
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold px-10 py-6 text-lg rounded-2xl shadow-2xl shadow-emerald-500/25"
          >
            {t("providerBanner.applyNow")}
            <ArrowRight className={`w-5 h-5 ${isRTL ? "mr-3 rotate-180" : "ml-3"}`} />
          </Button>
        </div>
      </div>
    </section>
  );
}

