import { useState } from "react";
import { useLocation } from "wouter";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, GraduationCap, Star, MapPin, DollarSign, Loader2, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { FaGoogle } from "react-icons/fa";
import { PhoneInput } from "@/components/PhoneInput";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";

const SPECIALTIES = [
  { id: "obedience", label: "Basic Obedience", labelHe: "ציות בסיסי", emoji: "🎯" },
  { id: "puppy_training", label: "Puppy Training", labelHe: "אילוף גורים", emoji: "🐾" },
  { id: "behavioral_modification", label: "Behavioral Issues", labelHe: "בעיות התנהגות", emoji: "🧠" },
  { id: "agility", label: "Agility", labelHe: "אג'יליטי", emoji: "🏃" },
  { id: "therapy_training", label: "Therapy / Emotional Support", labelHe: "כלב טיפולי", emoji: "❤️" },
  { id: "protection", label: "Protection Training", labelHe: "אילוף שמירה", emoji: "🛡️" },
  { id: "sport", label: "Sport & Competition", labelHe: "ספורט ותחרויות", emoji: "🏆" },
  { id: "trick_training", label: "Tricks & Performance", labelHe: "טריקים", emoji: "✨" },
];

const SERVICE_TYPES = [
  { id: "in_home", label: "At Client's Home", desc: "You travel to the client", emoji: "🏠" },
  { id: "park", label: "At a Park / Outdoor", desc: "Sessions in open spaces", emoji: "🌳" },
  { id: "station", label: "At My Location", desc: "Clients come to you", emoji: "📍" },
];

const LANGUAGES = [
  { id: "he", label: "Hebrew", labelNative: "עברית" },
  { id: "en", label: "English", labelNative: "English" },
  { id: "ar", label: "Arabic", labelNative: "العربية" },
  { id: "ru", label: "Russian", labelNative: "Русский" },
];

type Step = 1 | 2 | 3 | 4;

export default function JoinAsTrainer() {
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
    bio: "",
    yearsOfExperience: 1,
    specialties: [] as string[],
    certificationNames: "",
    serviceTypes: [] as string[],
    serviceArea: "",
    hourlyRate: 150,
    languages: ["he"] as string[],
    groupSessionsAvailable: false,
    maxGroupSize: 5,
    agreeToTerms: false,
    agreeToBackground: false,
  });

  function update(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleSpecialty(id: string) {
    setForm(prev => {
      const arr = prev.specialties;
      return { ...prev, specialties: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
    });
  }

  function toggleServiceType(id: string) {
    setForm(prev => {
      const arr = prev.serviceTypes;
      return { ...prev, serviceTypes: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
    });
  }

  function toggleLanguage(id: string) {
    setForm(prev => {
      const arr = prev.languages;
      return { ...prev, languages: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
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

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setForm(prev => ({
        ...prev,
        email: result.user.email || "",
        firstName: result.user.displayName?.split(" ")[0] || "",
        lastName: result.user.displayName?.split(" ").slice(1).join(" ") || "",
      }));
      await apiRequest("POST", "/api/auth/session", {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      });
    } catch {
      toast({ title: "הכניסה נכשלה / Sign-in failed", description: "לא ניתן להתחבר עם Google / Could not sign in with Google.", variant: "destructive" });
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit() {
    if (!user) { toast({ title: "יש להתחבר תחילה / Please sign in first", variant: "destructive" }); return; }
    if (!form.agreeToTerms || !form.agreeToBackground) { toast({ title: "יש לאשר את כל ההסכמות / Please accept all agreements", variant: "destructive" }); return; }
    if (form.specialties.length === 0) { toast({ title: "יש לבחור לפחות התמחות אחת / Please select at least one specialty", variant: "destructive" }); return; }
    if (form.serviceTypes.length === 0) { toast({ title: "יש לבחור לפחות סוג שירות אחד / Please select at least one service type", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/academy/trainers/register", {
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
        latitude: form.lat ? String(form.lat) : null,
        longitude: form.lng ? String(form.lng) : null,
        bio: form.bio,
        specialties: form.specialties,
        yearsOfExperience: form.yearsOfExperience,
        hourlyRate: String(form.hourlyRate),
        serviceTypes: form.serviceTypes,
        serviceArea: form.serviceArea || form.city,
        languages: form.languages,
      });
      navigate('/provider/pending');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast({ title: "שגיאה בשליחת הבקשה / Could not submit application", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const steps = [
    { num: 1, icon: <GraduationCap className="h-4 w-4" />, label: "Personal Info" },
    { num: 2, icon: <Star className="h-4 w-4" />, label: "Your Expertise" },
    { num: 3, icon: <MapPin className="h-4 w-4" />, label: "Sessions & Area" },
    { num: 4, icon: <DollarSign className="h-4 w-4" />, label: "Pricing & Legal" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-600 text-white rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <GraduationCap className="h-4 w-4" /> Pet Wash Academy™
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Become a Certified Trainer</h1>
          <p className="text-slate-600">Share your expertise, build a client base, and make a difference in pets' lives.</p>
        </div>

        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step === s.num ? "bg-emerald-600 text-white shadow-lg" : step > s.num ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-400"}`}>
                  {step > s.num ? <Check className="h-4 w-4" /> : s.icon}
                </div>
                <span className={`text-xs mt-1 hidden sm:block ${step === s.num ? "text-emerald-600 font-medium" : "text-slate-400"}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 mx-2 ${step > s.num ? "bg-emerald-400" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {!user && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <p className="text-amber-800 text-sm mb-3">Sign in to save your application</p>
              <Button onClick={handleGoogleSignIn} disabled={googleLoading} variant="outline" className="w-full border-slate-300">
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
                  <Input value={form.firstName} onChange={e => update("firstName", e.target.value)} placeholder="Avi" className="mt-1" />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input value={form.lastName} onChange={e => update("lastName", e.target.value)} placeholder="Ben-David" className="mt-1" />
                </div>
              </div>

              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="avi@example.com" className="mt-1" />
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
                <Label>Base Location * / מיקום בסיס</Label>
                <div className="mt-1">
                  <GooglePlacesAutocomplete
                    value={form.addressDisplay}
                    onChange={handleAddressSelect}
                    placeholder="Start typing your city or address / הזן עיר או כתובת..."
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Used to match you with clients in your area. Only your city is shown publicly.</p>
              </div>

              <div>
                <Label>Professional Bio</Label>
                <textarea
                  value={form.bio}
                  onChange={e => update("bio", e.target.value)}
                  placeholder="Tell potential clients about your training philosophy, experience, and approach..."
                  rows={4}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Your Expertise</h2>
              <div>
                <Label className="mb-3 block">Training Specialties (select all that apply)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SPECIALTIES.map(s => (
                    <button key={s.id} onClick={() => toggleSpecialty(s.id)} className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${form.specialties.includes(s.id) ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-300"}`}>
                      <span className="text-xl">{s.emoji}</span>
                      <div>
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-slate-500">{s.labelHe}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Years of Professional Training Experience</Label>
                <div className="flex gap-3 mt-2">
                  {[0, 1, 2, 3, 5, 8, 10].map(n => (
                    <button key={n} onClick={() => update("yearsOfExperience", n)} className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${form.yearsOfExperience === n ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-300 text-slate-600 hover:border-emerald-400"}`}>{n === 0 ? "New" : `${n}+`}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Certifications & Qualifications</Label>
                <textarea
                  value={form.certificationNames}
                  onChange={e => update("certificationNames", e.target.value)}
                  placeholder="List your certifications, diplomas, or notable training credentials (e.g., CPDT-KA, Karen Pryor Academy, etc.)"
                  rows={3}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <p className="text-xs text-slate-500 mt-1">You'll be able to upload certificate documents after your application is accepted.</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Session Types & Location</h2>
              <div>
                <Label className="mb-3 block">Where Do You Train? (select all that apply)</Label>
                <div className="space-y-3">
                  {SERVICE_TYPES.map(s => (
                    <button key={s.id} onClick={() => toggleServiceType(s.id)} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${form.serviceTypes.includes(s.id) ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-300"}`}>
                      <span className="text-2xl">{s.emoji}</span>
                      <div>
                        <p className="font-medium text-sm">{s.label}</p>
                        <p className="text-xs text-slate-500">{s.desc}</p>
                      </div>
                      <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center ${form.serviceTypes.includes(s.id) ? "border-emerald-500 bg-emerald-500" : "border-slate-300"}`}>
                        {form.serviceTypes.includes(s.id) && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Service Area</Label>
                <Input value={form.serviceArea} onChange={e => update("serviceArea", e.target.value)} placeholder="e.g., Jerusalem and surroundings, Central Israel" className="mt-1" />
              </div>
              <div>
                <Label className="mb-3 block">Languages You Train In</Label>
                <div className="flex gap-3 flex-wrap">
                  {LANGUAGES.map(l => (
                    <button key={l.id} onClick={() => toggleLanguage(l.id)} className={`px-4 py-2 rounded-xl border-2 transition-all ${form.languages.includes(l.id) ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:border-emerald-300"}`}>
                      <p className="text-sm font-medium">{l.label}</p>
                      <p className="text-xs">{l.labelNative}</p>
                    </button>
                  ))}
                </div>
              </div>
              <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${form.groupSessionsAvailable ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-emerald-300"}`}>
                <Checkbox checked={form.groupSessionsAvailable} onCheckedChange={v => update("groupSessionsAvailable", v)} className="mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">I offer group training sessions</p>
                  <p className="text-xs text-slate-500">More efficient; allows more clients per time slot</p>
                </div>
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Pricing & Agreements</h2>
              <div>
                <Label>Hourly Session Rate (₪)</Label>
                <p className="text-xs text-slate-500 mt-1 mb-2">Certified trainers in Israel typically charge ₪100–₪300/hr. You keep 85%.</p>
                <div className="flex items-center gap-4">
                  <input type="range" min={60} max={400} step={10} value={form.hourlyRate} onChange={e => update("hourlyRate", Number(e.target.value))} className="flex-1" />
                  <div className="bg-emerald-600 text-white rounded-xl px-4 py-2 text-lg font-bold min-w-[100px] text-center">₪{form.hourlyRate}/hr</div>
                </div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4">
                <p className="text-sm font-medium text-emerald-800 mb-1">💡 Certification Bonus</p>
                <p className="text-sm text-emerald-700">Once your credentials are verified, you'll receive a gold <strong>Certified Trainer</strong> badge that increases bookings by up to 40%.</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={form.agreeToTerms} onCheckedChange={v => update("agreeToTerms", v)} className="mt-0.5" />
                  <span className="text-sm text-slate-700">I agree to the <span className="text-emerald-600 underline cursor-pointer">Academy™ Terms of Service</span> and understand the 15% platform commission.</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={form.agreeToBackground} onCheckedChange={v => update("agreeToBackground", v)} className="mt-0.5" />
                  <span className="text-sm text-slate-700">I consent to credential verification and background screening before my profile goes live.</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(s => (s - 1) as Step)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => navigate("/academy")}>Cancel</Button>
            )}
            {step < 4 ? (
              <Button onClick={() => {
                if (step === 1) {
                  if (!form.firstName || !form.lastName || !form.email || !form.phone) {
                    toast({ title: "יש למלא שם, אימייל וטלפון / Please fill in name, email, and phone", variant: "destructive" }); return;
                  }
                  if (!form.dateOfBirth) {
                    toast({ title: "נדרש תאריך לידה / Date of birth is required", variant: "destructive" }); return;
                  }
                  if (!form.idNumber) {
                    toast({ title: "נדרשת תעודת זהות / Israeli ID or Passport required", variant: "destructive" }); return;
                  }
                  if (!form.city) {
                    toast({ title: "יש לבחור מיקום בסיס / Please select your base location", variant: "destructive" }); return;
                  }
                }
                if (step === 2 && form.specialties.length === 0) {
                  toast({ title: "יש לבחור לפחות התמחות אחת / Please select at least one specialty", variant: "destructive" }); return;
                }
                setStep(s => (s + 1) as Step);
              }} className="bg-emerald-600 hover:bg-emerald-700">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting || !user} className="bg-emerald-600 hover:bg-emerald-700 min-w-[160px]">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...</> : "Submit Application"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
