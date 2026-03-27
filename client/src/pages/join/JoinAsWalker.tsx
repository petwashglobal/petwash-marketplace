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
import { Badge } from "@/components/ui/badge";
import { Check, Dog, MapPin, Wrench, BadgeDollarSign, Loader2, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { FaGoogle } from "react-icons/fa";
import { PhoneInput } from "@/components/PhoneInput";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";

const SPECIALIZATIONS = [
  { id: "large_breeds", label: "Large Breeds", labelHe: "גזעים גדולים" },
  { id: "puppies", label: "Puppies", labelHe: "גורים" },
  { id: "senior_dogs", label: "Senior Dogs", labelHe: "כלבים מבוגרים" },
  { id: "reactive_dogs", label: "Reactive Dogs", labelHe: "כלבים ריאקטיביים" },
  { id: "small_breeds", label: "Small Breeds", labelHe: "גזעים קטנים" },
  { id: "multi_dog", label: "Multi-Dog Walks", labelHe: "טיולים קבוצתיים" },
];

const CERTIFICATIONS = [
  { id: "pet_first_aid", label: "Pet First Aid", labelHe: "עזרה ראשונה לחיות" },
  { id: "dog_training", label: "Dog Training", labelHe: "אילוף כלבים" },
  { id: "canine_cpr", label: "Canine CPR", labelHe: "החייאה לכלבים" },
  { id: "professional_dog_walker", label: "Certified Dog Walker", labelHe: "מטייל כלבים מוסמך" },
];

type Step = 1 | 2 | 3 | 4;

export default function JoinAsWalker() {
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
    serviceRadiusKm: 5,
    maxDogsPerWalk: 3,
    specializations: [] as string[],
    yearsOfExperience: 1,
    certifications: [] as string[],
    hasFirstAidKit: false,
    hasBodyCamera: false,
    hasCarTransport: false,
    baseHourlyRate: 80,
    minimumMinutes: 30,
    bio: "",
    agreeToTerms: false,
    agreeToBackground: false,
  });

  function update(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleArrayItem(field: "specializations" | "certifications", id: string) {
    setForm(prev => {
      const arr = prev[field];
      return { ...prev, [field]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
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
      toast({ title: "Sign-in failed", description: "Could not sign in with Google. Try again.", variant: "destructive" });
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit() {
    if (!user) { toast({ title: "Please sign in first", variant: "destructive" }); return; }
    if (!form.agreeToTerms || !form.agreeToBackground) { toast({ title: "Please accept all agreements", variant: "destructive" }); return; }

    const captchaToken = await executeReCaptcha('provider_register');
    if (!captchaToken) {
      toast({ title: "Security check failed", description: "Please try again in a moment.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/walk-my-pet/walkers/register", {
        userId: user.uid,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        dateOfBirth: form.dateOfBirth,
        idNumber: form.idNumber,
        city: form.city,
        streetAddress: form.streetAddress,
        postalCode: form.postalCode || null,
        country: form.country,
        currentLatitude: form.lat ? String(form.lat) : null,
        currentLongitude: form.lng ? String(form.lng) : null,
        serviceRadiusKm: form.serviceRadiusKm,
        specializations: form.specializations,
        yearsOfExperience: form.yearsOfExperience,
        certifications: form.certifications,
        hasFirstAidKit: form.hasFirstAidKit,
        hasBodyCamera: form.hasBodyCamera,
        hasCarTransport: form.hasCarTransport,
        baseHourlyRate: String(form.baseHourlyRate),
        minimumMinutes: form.minimumMinutes,
        bio: form.bio,
        verificationStatus: "pending",
        currency: "ILS",
        displayName: `${form.firstName} ${form.lastName}`,
        isAvailable: false,
        isActive: true,
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
    { num: 1, icon: <Dog className="h-4 w-4" />, label: "Personal Info" },
    { num: 2, icon: <MapPin className="h-4 w-4" />, label: "Service Details" },
    { num: 3, icon: <Wrench className="h-4 w-4" />, label: "Equipment & Skills" },
    { num: 4, icon: <BadgeDollarSign className="h-4 w-4" />, label: "Pricing & Legal" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Dog className="h-4 w-4" /> Walk My Pet™
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Become a Dog Walker</h1>
          <p className="text-slate-600">Set your own schedule, walk dogs in your neighbourhood, and earn on your terms.</p>
        </div>

        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step === s.num ? "bg-blue-600 text-white shadow-lg" : step > s.num ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-400"}`}>
                  {step > s.num ? <Check className="h-4 w-4" /> : s.icon}
                </div>
                <span className={`text-xs mt-1 hidden sm:block ${step === s.num ? "text-blue-600 font-medium" : "text-slate-400"}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 mx-2 ${step > s.num ? "bg-blue-400" : "bg-slate-200"}`} />}
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
                  <Input value={form.firstName} onChange={e => update("firstName", e.target.value)} placeholder="Yael" className="mt-1" />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input value={form.lastName} onChange={e => update("lastName", e.target.value)} placeholder="Cohen" className="mt-1" />
                </div>
              </div>

              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="yael@example.com" className="mt-1" />
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
                <p className="text-xs text-slate-500 mt-1">Used to define your walking radius. Only your neighbourhood is shown publicly.</p>
              </div>

              <div>
                <Label>Tell us about yourself</Label>
                <textarea
                  value={form.bio}
                  onChange={e => update("bio", e.target.value)}
                  placeholder="Share your love for dogs and your walking experience..."
                  rows={3}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Your Walking Service</h2>
              <div>
                <Label>Service Radius (km) — How far will you travel to pick up dogs?</Label>
                <div className="flex items-center gap-4 mt-2">
                  <input type="range" min={1} max={20} value={form.serviceRadiusKm} onChange={e => update("serviceRadiusKm", Number(e.target.value))} className="flex-1" />
                  <Badge variant="secondary" className="min-w-[4rem] justify-center text-base">{form.serviceRadiusKm} km</Badge>
                </div>
              </div>
              <div>
                <Label>Max Dogs Per Walk</Label>
                <div className="flex gap-3 mt-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => update("maxDogsPerWalk", n)} className={`w-12 h-12 rounded-full text-sm font-semibold border-2 transition-all ${form.maxDogsPerWalk === n ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:border-blue-400"}`}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-3 block">Dog Specializations (select all that apply)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SPECIALIZATIONS.map(s => (
                    <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.specializations.includes(s.id) ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`}>
                      <Checkbox checked={form.specializations.includes(s.id)} onCheckedChange={() => toggleArrayItem("specializations", s.id)} />
                      <div>
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-slate-500">{s.labelHe}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Equipment & Experience</h2>
              <div>
                <Label>Years of Dog Walking Experience</Label>
                <div className="flex gap-3 mt-2">
                  {[0, 1, 2, 3, 5, 7, 10].map(n => (
                    <button key={n} onClick={() => update("yearsOfExperience", n)} className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${form.yearsOfExperience === n ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:border-blue-400"}`}>{n === 0 ? "New" : `${n}+`}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-3 block">Certifications (select all you hold)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CERTIFICATIONS.map(c => (
                    <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.certifications.includes(c.id) ? "border-green-500 bg-green-50" : "border-slate-200 hover:border-green-300"}`}>
                      <Checkbox checked={form.certifications.includes(c.id)} onCheckedChange={() => toggleArrayItem("certifications", c.id)} />
                      <div>
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-xs text-slate-500">{c.labelHe}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-3 block">Equipment & Features</Label>
                <div className="space-y-3">
                  {[
                    { field: "hasFirstAidKit", label: "First Aid Kit", desc: "I carry a pet first aid kit on every walk", icon: "🩺" },
                    { field: "hasBodyCamera", label: "Body Camera", desc: "I use a camera for walk documentation & safety", icon: "📷" },
                    { field: "hasCarTransport", label: "Car Transport", desc: "I can pick up & drop off dogs by car", icon: "🚗" },
                  ].map(item => (
                    <label key={item.field} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${form[item.field as keyof typeof form] ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`}>
                      <span className="text-2xl">{item.icon}</span>
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
                <Label>Your Hourly Rate (₪)</Label>
                <p className="text-xs text-slate-500 mt-1 mb-2">Average walker earns ₪60–₪120/hr. You keep 85%.</p>
                <div className="flex items-center gap-4">
                  <input type="range" min={40} max={200} step={5} value={form.baseHourlyRate} onChange={e => update("baseHourlyRate", Number(e.target.value))} className="flex-1" />
                  <div className="bg-blue-600 text-white rounded-xl px-4 py-2 text-lg font-bold min-w-[80px] text-center">₪{form.baseHourlyRate}</div>
                </div>
              </div>
              <div>
                <Label>Minimum Walk Duration</Label>
                <div className="flex gap-3 mt-2">
                  {[30, 45, 60, 90].map(n => (
                    <button key={n} onClick={() => update("minimumMinutes", n)} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${form.minimumMinutes === n ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:border-blue-400"}`}>{n} min</button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={form.agreeToTerms} onCheckedChange={v => update("agreeToTerms", v)} className="mt-0.5" />
                  <span className="text-sm text-slate-700">I agree to the <span className="text-blue-600 underline cursor-pointer">Walk My Pet™ Terms of Service</span> and understand the 15% platform commission.</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={form.agreeToBackground} onCheckedChange={v => update("agreeToBackground", v)} className="mt-0.5" />
                  <span className="text-sm text-slate-700">I consent to a background check and verification process before my profile goes live.</span>
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
              <Button variant="ghost" onClick={() => navigate("/walk-my-pet")}>Cancel</Button>
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
              }} className="bg-blue-600 hover:bg-blue-700">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting || !user} className="bg-blue-600 hover:bg-blue-700 min-w-[160px]">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...</> : "Submit Application"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
