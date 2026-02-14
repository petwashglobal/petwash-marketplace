import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Calendar, MapPin, Search, Dog, Cat, Bird, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface UnifiedSearchWidgetProps {
  variant?: "hero" | "compact" | "floating";
  className?: string;
}

const petTypes = [
  { id: "dog", label: "Dog", labelHe: "כלב", icon: Dog },
  { id: "cat", label: "Cat", labelHe: "חתול", icon: Cat },
  { id: "bird", label: "Bird", labelHe: "ציפור", icon: Bird },
  { id: "other", label: "Other", labelHe: "אחר", icon: Dog },
];

const services = [
  { id: "pet-boarding", label: "Pet Boarding", labelHe: "פנסיון", route: "/sitter-suite" },
  { id: "house-sitting", label: "House Sitting", labelHe: "שמרטפות בבית", route: "/sitter-suite" },
  { id: "doggy-daycare", label: "Doggy Daycare", labelHe: "מעון יום", route: "/sitter-suite" },
  { id: "walk-my-pet", label: "Walk My Pet", labelHe: "טיול כלבים", route: "/walk-my-pet" },
  { id: "pettrek", label: "PetTrek Transport (Coming Soon)", labelHe: "הסעות (בקרוב)", route: "/pettrek", comingSoon: true },
  { id: "academy", label: "Pet Wash Academy", labelHe: "אילוף", route: "/academy" },
  { id: "k9000", label: "K9000 Smart Hub", labelHe: "עמדת שטיפה", route: "/k9000" },
];

export function UnifiedSearchWidget({ variant = "hero", className }: UnifiedSearchWidgetProps) {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const isRTL = i18n.language === "he";

  const [petType, setPetType] = useState<string>("");
  const [service, setService] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const handleSearch = () => {
    const selectedService = services.find(s => s.id === service);
    if (selectedService && !('comingSoon' in selectedService && selectedService.comingSoon)) {
      const params = new URLSearchParams();
      if (petType) params.set("pet", petType);
      if (location) params.set("location", location);
      if (startDate) params.set("start", format(startDate, "yyyy-MM-dd"));
      if (endDate) params.set("end", format(endDate, "yyyy-MM-dd"));
      
      navigate(`${selectedService.route}?${params.toString()}`);
    } else {
      navigate("/services");
    }
  };

  if (variant === "compact") {
    return (
      <Card className={cn(
        "p-4 bg-white/95 backdrop-blur-sm border border-emerald-100 shadow-lg",
        className
      )}>
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={service} onValueChange={setService}>
            <SelectTrigger className="w-[180px] border-emerald-200" data-testid="select-service-compact">
              <SelectValue placeholder={isRTL ? "בחר שירות" : "Select service"} />
            </SelectTrigger>
            <SelectContent>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {isRTL ? s.labelHe : s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[150px]">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
            <input
              type="text"
              placeholder={isRTL ? "מיקום" : "Location"}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-emerald-200 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              data-testid="input-location-compact"
            />
          </div>

          <Button 
            onClick={handleSearch}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6"
            data-testid="button-search-compact"
          >
            <Search className="h-4 w-4 mr-2" />
            {isRTL ? "חפש" : "Search"}
          </Button>
        </div>
      </Card>
    );
  }

  if (variant === "floating") {
    return (
      <div className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl",
        className
      )}>
        <Card className="p-4 bg-white/98 backdrop-blur-md border border-emerald-200 shadow-2xl rounded-2xl">
          <div className="flex flex-wrap gap-3 items-center justify-center">
            <Select value={service} onValueChange={setService}>
              <SelectTrigger className="w-[160px] border-emerald-200 rounded-xl" data-testid="select-service-floating">
                <SelectValue placeholder={isRTL ? "שירות" : "Service"} />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {isRTL ? s.labelHe : s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
              <input
                type="text"
                placeholder={isRTL ? "מיקום" : "Location"}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-[140px] pl-10 pr-3 py-2 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                data-testid="input-location-floating"
              />
            </div>

            <Button 
              onClick={handleSearch}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-8 rounded-xl"
              data-testid="button-search-floating"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <Card className={cn(
      "p-6 md:p-8 bg-white border-0 shadow-2xl rounded-3xl",
      className
    )}>
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 
            className="text-2xl md:text-3xl font-light tracking-wide text-gray-900"
            style={{ fontFamily: "'Didot', 'Bodoni MT', 'Playfair Display', serif" }}
          >
            {isRTL ? "מצא טיפול מושלם לחיית המחמד שלך" : "Find Perfect Care for Your Pet"}
          </h2>
          <p className="text-gray-500 mt-2 text-sm">
            {isRTL 
              ? "אלפי מטפלים מאומתים ברחבי ישראל"
              : "Thousands of verified caregivers across Israel"
            }
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Dog className="h-4 w-4 text-emerald-600" />
              {isRTL ? "סוג חיית מחמד" : "Pet Type"}
            </label>
            <Select value={petType} onValueChange={setPetType}>
              <SelectTrigger className="w-full border-gray-200 rounded-xl h-12 hover:border-emerald-400 transition-colors" data-testid="select-pet-type">
                <SelectValue placeholder={isRTL ? "בחר" : "Select"} />
              </SelectTrigger>
              <SelectContent>
                {petTypes.map((pet) => (
                  <SelectItem key={pet.id} value={pet.id}>
                    <div className="flex items-center gap-2">
                      <pet.icon className="h-4 w-4 text-emerald-600" />
                      {isRTL ? pet.labelHe : pet.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <ChevronDown className="h-4 w-4 text-emerald-600" />
              {isRTL ? "סוג שירות" : "Service Type"}
            </label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger className="w-full border-gray-200 rounded-xl h-12 hover:border-emerald-400 transition-colors" data-testid="select-service">
                <SelectValue placeholder={isRTL ? "בחר שירות" : "Select service"} />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {isRTL ? s.labelHe : s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" />
              {isRTL ? "מיקום" : "Location"}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={isRTL ? "תל אביב, רמת גן..." : "Tel Aviv, Ramat Gan..."}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl h-12 focus:ring-2 focus:ring-emerald-500 focus:border-transparent hover:border-emerald-400 transition-colors"
                data-testid="input-location"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-600" />
              {isRTL ? "תאריכים" : "Dates"}
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal border-gray-200 rounded-xl h-12 hover:border-emerald-400 transition-colors"
                  data-testid="button-dates"
                >
                  {startDate ? (
                    endDate ? (
                      <>
                        {format(startDate, "MMM d")} - {format(endDate, "MMM d")}
                      </>
                    ) : (
                      format(startDate, "PPP")
                    )
                  ) : (
                    <span className="text-gray-400">
                      {isRTL ? "בחר תאריכים" : "Select dates"}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={{ from: startDate, to: endDate }}
                  onSelect={(range) => {
                    setStartDate(range?.from);
                    setEndDate(range?.to);
                  }}
                  numberOfMonths={2}
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="pt-4">
          <Button 
            onClick={handleSearch}
            className="w-full h-14 text-lg font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            data-testid="button-search"
          >
            <Search className="h-5 w-5 mr-2" />
            {isRTL ? "חפש מטפלים" : "Search Caregivers"}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            {isRTL ? "₪25,000 ערבות" : "₪25,000 Guarantee"}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            {isRTL ? "מטפלים מאומתים" : "Verified Caregivers"}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            {isRTL ? "תמיכה 24/7" : "24/7 Support"}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default UnifiedSearchWidget;
