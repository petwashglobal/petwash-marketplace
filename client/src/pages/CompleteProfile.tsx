import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { PhoneInput } from "@/components/PhoneInput";
import { Loader2, UserCircle, Gift, Crown } from "lucide-react";
import { getApiUrl } from "@/lib/apiConfig";
import { useToast } from "@/hooks/use-toast";

const ROLE_CONFIG: Record<string, {
  titleHe: string;
  titleEn: string;
  subtitleHe: string;
  subtitleEn: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  requiresDob: boolean;
  requiresPhone: boolean;
}> = {
  customer: {
    titleHe: "השלמת פרופיל",
    titleEn: "Complete Your Profile",
    subtitleHe: "מלאו את הפרטים כדי להתחיל",
    subtitleEn: "Fill in your details to get started",
    icon: UserCircle,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    requiresDob: false,
    requiresPhone: false,
  },
  loyalty: {
    titleHe: "הצטרפות לתוכנית הנאמנות",
    titleEn: "Join Our Loyalty Program",
    subtitleHe: "מלאו את הפרטים לקבלת הטבות בלעדיות וברכת יום הולדת",
    subtitleEn: "Fill in your details for exclusive perks and birthday rewards",
    icon: Crown,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    requiresDob: true,
    requiresPhone: false,
  },
  provider: {
    titleHe: "השלמת פרטים אישיים",
    titleEn: "Complete Personal Details",
    subtitleHe: "פרטים בסיסיים לפני תחילת תהליך ההרשמה כספק",
    subtitleEn: "Basic details before starting your provider application",
    icon: UserCircle,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    requiresDob: false,
    requiresPhone: true,
  },
  staff: {
    titleHe: "השלמת פרופיל צוות",
    titleEn: "Complete Staff Profile",
    subtitleHe: "מלאו את הפרטים לבקשת גישה",
    subtitleEn: "Fill in your details for access request",
    icon: UserCircle,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    requiresDob: false,
    requiresPhone: false,
  },
};

export default function CompleteProfile() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const lang = localStorage.getItem("i18nextLng") || "he";
  const isHe = lang === "he";
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string>("customer");

  useEffect(() => {
    const intent = localStorage.getItem("signup_intent");
    if (intent && ROLE_CONFIG[intent]) {
      setRole(intent);
    }

    (async () => {
      try {
        const res = await fetch(getApiUrl("/api/user/profile"), { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const serverRole = data?.role || data?.user?.role;
          if (serverRole && ROLE_CONFIG[serverRole]) {
            setRole(serverRole);
          }
        }
      } catch {}
    })();
  }, []);

  const config = ROLE_CONFIG[role] || ROLE_CONFIG.customer;
  const IconComp = config.icon;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("IL");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const handlePlaceSelect = (place: PlaceDetails) => {
    if (place.street) setAddress(place.street);
    if (place.city) setCity(place.city);
    if (place.postalCode) setPostalCode(place.postalCode);
    if (place.country) setCountry(place.country);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast({ variant: "destructive", title: isHe ? "שם פרטי ושם משפחה נדרשים" : "First and last name required" });
      return;
    }
    if (config.requiresPhone && !phone) {
      toast({ variant: "destructive", title: isHe ? "מספר טלפון נדרש לספקים" : "Phone number required for providers" });
      return;
    }
    if (config.requiresDob && !dateOfBirth) {
      toast({ variant: "destructive", title: isHe ? "תאריך לידה נדרש לתוכנית הנאמנות" : "Date of birth required for loyalty program" });
      return;
    }
    if (!termsAccepted || !privacyAccepted) {
      toast({ variant: "destructive", title: isHe ? "יש לאשר את התנאים ומדיניות הפרטיות" : "Please accept terms and privacy policy" });
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, any> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone,
        address,
        city,
        postalCode,
        country,
        termsAccepted,
        privacyAccepted,
        marketingConsent,
      };

      if (config.requiresDob && dateOfBirth) {
        payload.dateOfBirth = dateOfBirth;
      }

      const res = await fetch(getApiUrl("/api/auth/complete-profile"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        toast({ title: isHe ? "הפרופיל נשמר בהצלחה!" : "Profile saved!" });
        const postLoginRes = await fetch(getApiUrl("/api/auth/post-login"), {
          method: "POST",
          credentials: "include",
        });
        const postLoginData = await postLoginRes.json();
        navigate(postLoginData.redirectTo || "/home");
      } else {
        toast({ variant: "destructive", title: data.error || "Error saving profile" });
      }
    } catch (err) {
      toast({ variant: "destructive", title: isHe ? "שגיאה בשמירת הפרופיל" : "Error saving profile" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4" dir={isHe ? "rtl" : "ltr"}>
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className={`mx-auto ${config.iconBg} p-3 rounded-full w-fit mb-4`}>
            <IconComp className={`h-10 w-10 ${config.iconColor}`} />
          </div>
          <CardTitle className="text-2xl">
            {isHe ? config.titleHe : config.titleEn}
          </CardTitle>
          <p className="text-gray-500 text-sm mt-1">
            {isHe ? config.subtitleHe : config.subtitleEn}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isHe ? "שם פרטי" : "First Name"}</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={isHe ? "שם פרטי" : "First name"}
                  required
                />
              </div>
              <div>
                <Label>{isHe ? "שם משפחה" : "Last Name"}</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={isHe ? "שם משפחה" : "Last name"}
                  required
                />
              </div>
            </div>

            <div>
              <Label>{isHe ? "טלפון נייד" : "Mobile Phone"}</Label>
              <PhoneInput
                value={phone}
                onChange={(val) => setPhone(val || "")}
                defaultCountry="IL"
              />
            </div>

            {config.requiresDob && (
              <div>
                <Label className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-amber-500" />
                  {isHe ? "תאריך לידה" : "Date of Birth"}
                  <span className="text-red-500 text-xs">*</span>
                </Label>
                <Input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  required
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {isHe
                    ? "נדרש לקבלת ברכת יום הולדת והטבה מיוחדת"
                    : "Required for birthday greeting and special reward"}
                </p>
              </div>
            )}

            <div>
              <Label>{isHe ? "כתובת" : "Address"}</Label>
              <GooglePlacesAutocomplete
                onPlaceSelect={handlePlaceSelect}
                placeholder={isHe ? "הקלידו כתובת..." : "Start typing address..."}
                country={["il"]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isHe ? "עיר" : "City"}</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder={isHe ? "עיר" : "City"} />
              </div>
              <div>
                <Label>{isHe ? "מיקוד" : "Postal Code"}</Label>
                <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder={isHe ? "מיקוד" : "Postal code"} />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(val) => setTermsAccepted(!!val)}
                />
                <Label htmlFor="terms" className="text-sm leading-snug cursor-pointer">
                  {isHe
                    ? "אני מסכים/ה לתנאי השימוש של Pet Wash™"
                    : "I agree to Pet Wash™ Terms of Service"}
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="privacy"
                  checked={privacyAccepted}
                  onCheckedChange={(val) => setPrivacyAccepted(!!val)}
                />
                <Label htmlFor="privacy" className="text-sm leading-snug cursor-pointer">
                  {isHe
                    ? "אני מסכים/ה למדיניות הפרטיות"
                    : "I agree to the Privacy Policy"}
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="marketing"
                  checked={marketingConsent}
                  onCheckedChange={(val) => setMarketingConsent(!!val)}
                />
                <Label htmlFor="marketing" className="text-sm leading-snug cursor-pointer">
                  {isHe
                    ? "אני מעוניין/ת לקבל עדכונים ומבצעים (אופציונלי)"
                    : "I'd like to receive updates and promotions (optional)"}
                </Label>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isHe ? "המשך" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
