import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
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

interface WhoamiUser {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  profilePictureUrl?: string;
}

interface WhoamiResponse {
  user: WhoamiUser;
  profileStatus: string;
  requiredFields: string[];
  role: string;
}

function getRoleConfig(role: string) {
  switch (role) {
    case "loyalty":
      return {
        titleHe: "הצטרפות לתוכנית הנאמנות",
        titleEn: "Join Our Loyalty Program",
        subtitleHe: "מלאו את הפרטים לקבלת הטבות בלעדיות וברכת יום הולדת",
        subtitleEn: "Fill in your details for exclusive perks and birthday rewards",
        icon: Crown,
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
      };
    case "provider":
      return {
        titleHe: "השלמת פרטים אישיים",
        titleEn: "Complete Personal Details",
        subtitleHe: "פרטים בסיסיים לפני תחילת תהליך ההרשמה כספק",
        subtitleEn: "Basic details before starting your provider application",
        icon: UserCircle,
        iconBg: "bg-green-100",
        iconColor: "text-green-600",
      };
    case "staff":
      return {
        titleHe: "השלמת פרופיל צוות",
        titleEn: "Complete Staff Profile",
        subtitleHe: "מלאו את הפרטים לבקשת גישה",
        subtitleEn: "Fill in your details for access request",
        icon: UserCircle,
        iconBg: "bg-purple-100",
        iconColor: "text-purple-600",
      };
    default:
      return {
        titleHe: "השלמת פרופיל",
        titleEn: "Complete Your Profile",
        subtitleHe: "מלאו את הפרטים כדי להתחיל",
        subtitleEn: "Fill in your details to get started",
        icon: UserCircle,
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
      };
  }
}

export default function CompleteProfile() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const fromParam = new URLSearchParams(searchString).get("from") || null;
  const { toast } = useToast();
  const lang = localStorage.getItem("i18nextLng") || "he";
  const isHe = lang === "he";

  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState("customer");
  const [requiredFields, setRequiredFields] = useState<string[]>([]);

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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(getApiUrl("/api/auth/whoami"), { credentials: "include" });
        if (!res.ok) {
          toast({ variant: "destructive", title: isHe ? "שגיאה בטעינת הפרופיל" : "Failed to load profile" });
          return;
        }
        const data: WhoamiResponse = await res.json();

        setRole(data.role || "customer");
        setRequiredFields(data.requiredFields || []);

        if (data.user) {
          if (data.user.firstName) setFirstName(data.user.firstName);
          if (data.user.lastName) setLastName(data.user.lastName);
          if (data.user.phone) setPhone(data.user.phone);
        }
      } catch {
        toast({ variant: "destructive", title: isHe ? "שגיאה בטעינת הפרופיל" : "Failed to load profile" });
      } finally {
        setInitialLoading(false);
      }
    })();
  }, []);

  const config = getRoleConfig(role);
  const IconComp = config.icon;

  const needs = (field: string) => requiredFields.includes(field);

  const handlePlaceSelect = (place: PlaceDetails) => {
    if (place.street) setAddress(place.street);
    if (place.city) setCity(place.city);
    if (place.postalCode) setPostalCode(place.postalCode);
    if (place.country) setCountry(place.country);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (needs("firstName") && !firstName.trim()) {
      toast({ variant: "destructive", title: isHe ? "שם פרטי נדרש" : "First name is required" });
      return;
    }
    if (needs("lastName") && !lastName.trim()) {
      toast({ variant: "destructive", title: isHe ? "שם משפחה נדרש" : "Last name is required" });
      return;
    }
    if (needs("phone") && !phone) {
      toast({ variant: "destructive", title: isHe ? "מספר טלפון נדרש" : "Phone number is required" });
      return;
    }
    if (needs("dateOfBirth") && !dateOfBirth) {
      toast({ variant: "destructive", title: isHe ? "תאריך לידה נדרש" : "Date of birth is required" });
      return;
    }
    if (needs("termsAcceptedAt") && (!termsAccepted || !privacyAccepted)) {
      toast({ variant: "destructive", title: isHe ? "יש לאשר את התנאים ומדיניות הפרטיות" : "Please accept terms and privacy policy" });
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        address,
        city,
        postalCode,
        country,
        marketingConsent,
      };

      if (needs("firstName")) payload.firstName = firstName.trim();
      if (needs("lastName")) payload.lastName = lastName.trim();
      if (needs("phone")) payload.phone = phone;
      if (needs("dateOfBirth")) payload.dateOfBirth = dateOfBirth;
      if (needs("termsAcceptedAt")) {
        payload.termsAccepted = termsAccepted;
        payload.privacyAccepted = privacyAccepted;
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
        // Restore booking or page context that was interrupted by the profile-completion redirect.
        // ?from= param is set by post-login when it redirects here (e.g. /booking/123).
        // Server nextUrl takes priority only if it is not /complete-profile itself (avoid loops).
        const serverNext = postLoginData.nextUrl || postLoginData.redirectTo;
        const isLoop = serverNext && serverNext.startsWith('/complete-profile');
        navigate(fromParam || (!isLoop ? serverNext : null) || "/home");
      } else {
        toast({ variant: "destructive", title: data.error || "Error saving profile" });
      }
    } catch {
      toast({ variant: "destructive", title: isHe ? "שגיאה בשמירת הפרופיל" : "Error saving profile" });
    } finally {
      setSubmitting(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

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
            {(needs("firstName") || needs("lastName")) && (
              <div className="grid grid-cols-2 gap-4">
                {needs("firstName") && (
                  <div>
                    <Label>{isHe ? "שם פרטי" : "First Name"}</Label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={isHe ? "שם פרטי" : "First name"}
                      required
                    />
                  </div>
                )}
                {needs("lastName") && (
                  <div>
                    <Label>{isHe ? "שם משפחה" : "Last Name"}</Label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder={isHe ? "שם משפחה" : "Last name"}
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {needs("phone") && (
              <div>
                <Label>{isHe ? "טלפון נייד" : "Mobile Phone"}</Label>
                <PhoneInput
                  value={phone}
                  onChange={(val) => setPhone(val || "")}
                  defaultCountry="IL"
                />
              </div>
            )}

            {needs("dateOfBirth") && (
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
                {role === "loyalty" && (
                  <p className="text-xs text-gray-400 mt-1">
                    {isHe
                      ? "נדרש לקבלת ברכת יום הולדת והטבה מיוחדת"
                      : "Required for birthday greeting and special reward"}
                  </p>
                )}
              </div>
            )}

            <div>
              <Label>{isHe ? "כתובת" : "Address"}</Label>
              <GooglePlacesAutocomplete
                value={address}
                onChange={(val) => setAddress(val)}
                onPlaceSelected={handlePlaceSelect}
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
              {needs("termsAcceptedAt") && (
                <>
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
                </>
              )}
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

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isHe ? "המשך" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
