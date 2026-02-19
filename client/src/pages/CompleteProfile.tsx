import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { PhoneInput } from "@/components/PhoneInput";
import { Loader2, UserCircle } from "lucide-react";
import { getApiUrl } from "@/lib/apiConfig";
import { useToast } from "@/hooks/use-toast";

export default function CompleteProfile() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const lang = localStorage.getItem("i18nextLng") || "he";
  const isHe = lang === "he";
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
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
    if (!phone) {
      toast({ variant: "destructive", title: isHe ? "מספר טלפון נדרש" : "Phone number required" });
      return;
    }
    if (!termsAccepted || !privacyAccepted) {
      toast({ variant: "destructive", title: isHe ? "יש לאשר את התנאים ומדיניות הפרטיות" : "Please accept terms and privacy policy" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/auth/complete-profile"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
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
        }),
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
          <div className="mx-auto bg-blue-100 p-3 rounded-full w-fit mb-4">
            <UserCircle className="h-10 w-10 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">
            {isHe ? "השלמת פרופיל" : "Complete Your Profile"}
          </CardTitle>
          <p className="text-gray-500 text-sm mt-1">
            {isHe ? "מלאו את הפרטים כדי להתחיל" : "Fill in your details to get started"}
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
