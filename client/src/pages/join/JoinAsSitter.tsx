import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { auth } from "@/lib/firebase";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { signInWithGoogle } from "@/lib/auth-guardian-2025";
import { apiRequest } from "@/lib/queryClient";
import { executeReCaptcha } from "@/components/ReCaptcha";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Home, Heart, DollarSign, Loader2, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { FaGoogle } from "react-icons/fa";
import { PhoneInput } from "@/components/PhoneInput";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";

const PET_TYPES = [
  { id: "dogs", label: "Dogs", emoji: "🐕" },
  { id: "cats", label: "Cats", emoji: "🐈" },
  { id: "rabbits", label: "Rabbits", emoji: "🐇" },
  { id: "birds", label: "Birds", emoji: "🦜" },
  { id: "small_animals", label: "Small Animals", emoji: "🐹" },
  { id: "exotic", label: "Exotic Pets", emoji: "🦎" },
];

const HOME_TYPES = [
  { id: "apartment", label: "Apartment", labelHe: "דירה" },
  { id: "house", label: "House", labelHe: "בית" },
  { id: "studio", label: "Studio", labelHe: "סטודיו" },
  { id: "farm", label: "Farm / Rural", labelHe: "חוה / כפר" },
];

const YARD_SIZES = [
  { id: "none", label: "No Yard", labelHe: "ללא חצר" },
  { id: "small", label: "Small (balcony/patio)", labelHe: "קטן (מרפסת)" },
  { id: "medium", label: "Medium Yard", labelHe: "חצר בינונית" },
  { id: "large", label: "Large Yard", labelHe: "חצר גדולה" },
];

type Step = 1 | 2 | 3 | 4;

export default function JoinAsSitter() {
  const { user } = useFirebaseAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: user?.email || "",
    phone: "",
    dateOfBirth: "",
    idNumber: "",
    addressDisplay: "",
    streetAddress: "",
    city: "",
    postalCode: "",
    country: "Israel",
    lat: null as number | null,
    lng: null as number | null,
    homeType: "apartment",
    yardSize: "none",
    smokingStatus: "non_smoker",
    hasOtherPets: false,
    otherPetsDetails: "",
    yearsOfExperience: 1,
    acceptedPetTypes: [] as string[],
    maxPetsAccepted: 2,
    overnightAccepted: true,
    dropInAccepted: true,
    daycareAccepted: false,
    pricePerDayCents: 15000,
    bio: "",
    agreeToTerms: false,
    agreeToPrivacy: false,
  });

  function update(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function togglePetType(id: string) {
    setForm(prev => {
      const arr = prev.acceptedPetTypes;
      return { ...prev, acceptedPetTypes: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
    });
  }

  function handleAddressSelect(val: string, details?: PlaceDetails) {
    update("addressDisplay", val);
    if (details) {
      update("city", details.city || "");
      const streetParts = [details.street, details.streetNumber].filter(Boolean);
      update("streetAddress", streetParts.join(" ") || val);
      update("postalCode", details.postalCode || "");
      update("country", details.country || "Israel");
      update("lat", details.lat ?? null);
      update("lng", details.lng ?? null);
    }
  }

  // Pre-fill form from Google user after redirect sign-in completes
  useEffect(() => {
    if (user && !form.email) {
      setForm(prev => ({
        ...prev,
        email: prev.email || user.email || "",
        firstName: prev.firstName || user.displayName?.split(" ")[0] || "",
        lastName: prev.lastName || user.displayName?.split(" ").slice(1).join(" ") || "",
      }));
    }
  }, [user?.uid]);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      // Uses signInWithRedirect on iOS Safari, signInWithPopup elsewhere
      await signInWithGoogle();
      // Popup path: fill form from auth.currentUser (redirect path navigates away before here)
      const currentUser = auth.currentUser;
      if (currentUser) {
        setForm(prev => ({
          ...prev,
          email: prev.email || currentUser.email || "",
          firstName: prev.firstName || currentUser.displayName?.split(" ")[0] || "",
          lastName: prev.lastName || currentUser.displayName?.split(" ").slice(1).join(" ") || "",
        }));
      }
    } catch {
      toast({ title: "Sign-in failed", description: "Could not sign in with Google.", variant: "destructive" });
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit() {
    if (!user) { toast({ title: "Please sign in first", variant: "destructive" }); return; }
    if (!form.agreeToTerms || !form.agreeToPrivacy) { toast({ title: "Please accept all agreements", variant: "destructive" }); return; }
    if (form.acceptedPetTypes.length === 0) { toast({ title: "Please select at least one pet type you accept", variant: "destructive" }); return; }

    const captchaToken = await executeReCaptcha('provider_register');
    if (!captchaToken) {
      toast({ title: "Security check failed", description: "Please try again in a moment.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/sitter-suite/sitters", {
        userId: user.uid,
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
        idNumber: form.idNumber,
        email: form.email,
        phone: form.phone,
        streetAddress: form.streetAddress,
        city: form.city,
        postalCode: form.postalCode || null,
        country: form.country,
        latitude: form.lat ? String(form.lat) : null,
        longitude: form.lng ? String(form.lng) : null,
        homeType: form.homeType,
        yardSize: form.yardSize,
        smokingStatus: form.smokingStatus,
        hasOtherPets: form.hasOtherPets,
        otherPetsDetails: form.hasOtherPets ? form.otherPetsDetails : null,
        yearsOfExperience: form.yearsOfExperience,
        specializations: form.acceptedPetTypes,
        bio: form.bio,
        pricePerDayCents: form.pricePerDayCents,
        isActive: false,
        verificationStatus: "pending",
        captchaToken,
      });
      navigate('/provider/pending');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast({ title: "Could not submit application", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const steps = [
    { num: 1, icon: <Heart className="h-4 w-4" />, label: "Personal Info" },
    { num: 2, icon: <Home className="h-4 w-4" />, label: "Your Home" },
    { num: 3, icon: "🐾", label: "What You Offer" },
    { num: 4, icon: <DollarSign className="h-4 w-4" />, label: "Pricing & Legal" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-purple-600 text-white rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Home className="h-4 w-4" /> Sitter Suite™
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Become a Pet Sitter</h1>
          <p className="text-slate-600">Welcome pets into your home, set your own rates, and build a loyal client base.</p>
        </div>

        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step === s.num ? "bg-purple-600 text-white shadow-lg" : step > s.num ? "bg-purple-100 text-purple-600" : "bg-slate-200 text-slate-400"}`}>
                  {step > s.num ? <Check className="h-4 w-4" /> : typeof s.icon === "string" ? <span>{s.icon}</span> : s.icon}
                </div>
                <span className={`text-xs mt-1 hidden sm:block ${step === s.num ? "text-purple-600 font-medium" : "text-slate-400"}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 mx-2 ${step > s.num ? "bg-purple-400" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {!user && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <p className="text-amber-800 text-sm mb-3">Sign in to save your application</p>
              <Button onClick={handleGoogleSignIn} disabled={googleLoading} variant="outline" className="w-full border-slate-300 bg-white hover:bg-gray-50 text-gray-800">
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FaGoogle className="h-4 w-4 mr-2 text-red-500" />}
                Continue with Google
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Your Personal Information</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name *</Label>
                  <Input value={form.firstName} onChange={e => update("firstName", e.target.value)} placeholder="Noa" className="mt-1" />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input value={form.lastName} onChange={e => update("lastName", e.target.value)} placeholder="Levi" className="mt-1" />
                </div>
              </div>

              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="noa@example.com" className="mt-1" />
              </div>

              <div>
                <Label>Phone Number * / מספר טלפון</Label>
                <div className="mt-1">
                  <PhoneInput
                    value={form.phone}
                    onChange={(val: string) => update("phone", val)}
                    defaultCountry="IL"
                    placeholder="+972 50 000 0000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date of Birth * / תאריך לידה</Label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={e => update("dateOfBirth", e.target.value)}
                    max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5" />
                    Israeli ID / Passport * / ת.ז.
                  </Label>
                  <Input
                    value={form.idNumber}
                    onChange={e => update("idNumber", e.target.value)}
                    placeholder="123456789"
                    className="mt-1"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div>
                <Label>Home Address * / כתובת בית</Label>
                <div className="mt-1">
                  <GooglePlacesAutocomplete
                    value={form.addressDisplay}
                    onChange={handleAddressSelect}
                    placeholder="Start typing your address / הזן כתובת..."
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Exact address stays private — only your neighbourhood is shown publicly.</p>
              </div>

              <div>
                <Label>About You</Label>
                <textarea
                  value={form.bio}
                  onChange={e => update("bio", e.target.value)}
                  placeholder="Tell pet owners about yourself, your experience, and your love for animals..."
                  rows={3}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div>
                <Label>Years of Pet Care Experience</Label>
                <div className="flex gap-3 mt-2">
                  {[0, 1, 2, 3, 5, 10].map(n => (
                    <button key={n} onClick={() => update("yearsOfExperience", n)} className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${form.yearsOfExperience === n ? "bg-purple-600 text-white border-purple-600" : "border-slate-300 text-slate-600 hover:border-purple-400"}`}>
                      {n === 0 ? "New" : `${n}+`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Your Home Environment</h2>
              <div>
                <Label className="mb-3 block">Home Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {HOME_TYPES.map(h => (
                    <button key={h.id} onClick={() => update("homeType", h.id)} className={`p-3 rounded-xl border-2 text-left transition-all ${form.homeType === h.id ? "border-purple-500 bg-purple-50" : "border-slate-200 hover:border-purple-300"}`}>
                      <p className="font-medium text-sm">{h.label}</p>
                      <p className="text-xs text-slate-500">{h.labelHe}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-3 block">Outdoor / Yard Access</Label>
                <div className="grid grid-cols-2 gap-3">
                  {YARD_SIZES.map(y => (
                    <button key={y.id} onClick={() => update("yardSize", y.id)} className={`p-3 rounded-xl border-2 text-left transition-all ${form.yardSize === y.id ? "border-purple-500 bg-purple-50" : "border-slate-200 hover:border-purple-300"}`}>
                      <p className="font-medium text-sm">{y.label}</p>
                      <p className="text-xs text-slate-500">{y.labelHe}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-3 block">Smoking Status in Your Home</Label>
                <div className="flex gap-3">
                  {[{ id: "non_smoker", label: "Non-Smoker" }, { id: "outdoor_only", label: "Outdoor Only" }, { id: "smoker", label: "Smoker" }].map(s => (
                    <button key={s.id} onClick={() => update("smokingStatus", s.id)} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${form.smokingStatus === s.id ? "bg-purple-600 text-white border-purple-600" : "border-slate-300 text-slate-600 hover:border-purple-400"}`}>{s.label}</button>
                  ))}
                </div>
              </div>
              <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${form.hasOtherPets ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:border-amber-300"}`}>
                <Checkbox checked={form.hasOtherPets} onCheckedChange={v => update("hasOtherPets", v)} className="mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">I have pets of my own at home</p>
                  <p className="text-xs text-slate-500">Owners will see this on your profile</p>
                  {form.hasOtherPets && (
                    <Input value={form.otherPetsDetails} onChange={e => update("otherPetsDetails", e.target.value)} placeholder="e.g., 1 friendly labrador, 2 cats" className="mt-2 text-xs" />
                  )}
                </div>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">What You Offer</h2>
              <div>
                <Label className="mb-3 block">Pet Types You Accept</Label>
                <div className="grid grid-cols-3 gap-3">
                  {PET_TYPES.map(p => (
                    <button key={p.id} onClick={() => togglePetType(p.id)} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${form.acceptedPetTypes.includes(p.id) ? "border-purple-500 bg-purple-50" : "border-slate-200 hover:border-purple-300"}`}>
                      <span className="text-2xl">{p.emoji}</span>
                      <span className="text-xs font-medium">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Maximum Pets at One Time</Label>
                <div className="flex gap-3 mt-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => update("maxPetsAccepted", n)} className={`w-12 h-12 rounded-full text-sm font-semibold border-2 transition-all ${form.maxPetsAccepted === n ? "bg-purple-600 text-white border-purple-600" : "border-slate-300 text-slate-600 hover:border-purple-400"}`}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-3 block">Services You Offer</Label>
                <div className="space-y-3">
                  {[
                    { field: "overnightAccepted", label: "Overnight Boarding", desc: "Pets stay with you overnight (24h)", emoji: "🌙" },
                    { field: "dropInAccepted", label: "Drop-In Visits", desc: "Short visits to pet's home", emoji: "🏠" },
                    { field: "daycareAccepted", label: "Doggy Daycare", desc: "Pets stay during the day while owners work", emoji: "☀️" },
                  ].map(item => (
                    <label key={item.field} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${form[item.field as keyof typeof form] ? "border-purple-500 bg-purple-50" : "border-slate-200 hover:border-purple-300"}`}>
                      <span className="text-2xl">{item.emoji}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                      <Checkbox checked={!!form[item.field as keyof typeof form]} onCheckedChange={v => update(item.field, v)} />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Pricing & Agreements</h2>
              <div>
                <Label>Price Per Day / Night (₪)</Label>
                <p className="text-xs text-slate-500 mt-1 mb-2">Average sitter earns ₪100–₪250/day. You keep 85%.</p>
                <div className="flex items-center gap-4">
                  <input type="range" min={5000} max={50000} step={1000} value={form.pricePerDayCents} onChange={e => update("pricePerDayCents", Number(e.target.value))} className="flex-1" />
                  <div className="bg-purple-600 text-white rounded-xl px-4 py-2 text-lg font-bold min-w-[100px] text-center">₪{(form.pricePerDayCents / 100).toFixed(0)}</div>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={form.agreeToTerms} onCheckedChange={v => update("agreeToTerms", v)} className="mt-0.5" />
                  <span className="text-sm text-slate-700">I agree to the <span className="text-purple-600 underline cursor-pointer">Sitter Suite™ Terms of Service</span> and understand the 15% platform commission.</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={form.agreeToPrivacy} onCheckedChange={v => update("agreeToPrivacy", v)} className="mt-0.5" />
                  <span className="text-sm text-slate-700">I consent to a home verification visit and agree to the <span className="text-purple-600 underline cursor-pointer">Privacy Policy</span>.</span>
                </label>
              </div>
            </div>
          )}

          {step === 4 && (
            <p className="text-center text-[11px] text-slate-400 mt-6">
              Protected by Google reCAPTCHA —{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Privacy</a>
              {" · "}
              <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Terms</a>
            </p>
          )}

          <div className="flex justify-between mt-4 pt-6 border-t">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(s => (s - 1) as Step)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => navigate("/sitter-suite")}>Cancel</Button>
            )}
            {step < 4 ? (
              <Button onClick={() => {
                if (step === 1) {
                  if (!form.firstName || !form.lastName || !form.email || !form.phone) {
                    toast({ title: "Please fill in name, email, and phone", variant: "destructive" }); return;
                  }
                  if (!form.dateOfBirth) {
                    toast({ title: "Date of birth is required / נדרש תאריך לידה", variant: "destructive" }); return;
                  }
                  if (!form.idNumber) {
                    toast({ title: "Israeli ID / Passport number is required / נדרשת תעודת זהות", variant: "destructive" }); return;
                  }
                  if (!form.city) {
                    toast({ title: "Please select your home address", variant: "destructive" }); return;
                  }
                }
                setStep(s => (s + 1) as Step);
              }} className="bg-purple-600 hover:bg-purple-700">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting || !user} className="bg-purple-600 hover:bg-purple-700 min-w-[160px]">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...</> : "Submit Application"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
