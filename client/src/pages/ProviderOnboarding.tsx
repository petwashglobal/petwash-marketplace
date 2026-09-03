import { useState, useEffect, useRef, useCallback } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import {
  initialRequestedServices,
  setRequestedProviderServices,
  clearRequestedProviderServices,
} from '@/lib/requestedProviderService';
import { useLanguage } from '@/lib/languageStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePicker } from '@/components/ui/date-picker';
import { GooglePlacesAutocomplete, type PlaceDetails } from '@/components/ui/google-places-autocomplete';
import { CityPicker, type CityPickerSelection } from '@/components/location/CityPicker';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2,
  AlertTriangle,
  Upload,
  Camera,
  CreditCard,
  Shield,
  Clock,
  Users,
  DollarSign,
  Star,
  ArrowRight,
  Loader2,
  X,
  // PR Phase A — Lucide icons replacing emoji in professional onboarding.
  Footprints,
  Home,
  Car,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getApiUrl } from '@/lib/apiConfig';
import { resolvePostLogin } from '@/lib/postLoginCoordinator';
import {
  PROVIDER_DECLARATION_TEXT,
  ENHANCED_REASON_LABELS,
  ENHANCED_VERIFICATION_REASONS,
  defaultReasonsForProviderTypes,
  type EnhancedVerificationReason,
} from '@shared/legal/providerDeclaration';

export default function ProviderOnboarding() {
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isHebrew = language === 'he';

  // Redirect to sign-in if not authenticated.
  // Phase C — also gate on role: if a logged-in user lands here who is
  // NOT trying to become a provider (their role is loyalty / staff /
  // admin / franchise_owner / approved provider), bounce to the
  // canonical post-login decider so they end up on the right page
  // for their actual status. Customers and provider-applicants stay
  // here so they can fill the KYC form.
  //
  // Issue #148 P1: the post-login decider lives on the SERVER at
  // /api/auth/post-login — it is NOT a client <Route>. The previous code
  // tried to navigate to a client path with the same name, which had no
  // <Route> match in App.tsx and caused this page to render briefly and
  // then disappear. We now POST to the API and navigate to the returned
  // nextUrl, mirroring the pattern in SignIn.tsx:160.
  useEffect(() => {
    if (user === null) {
      navigate('/sign-in?redirect=/provider-onboarding');
      return;
    }
    if (!user) return;

    const claims = (user as any)?.reloadUserInfo?.customAttributes
      ? (() => {
          try { return JSON.parse((user as any).reloadUserInfo.customAttributes); }
          catch { return {}; }
        })()
      : {};
    const role: string | undefined = claims?.role;
    // Roles that should NOT see the provider KYC form — INTERNAL/staff roles only.
    // 2026-07-25 (#148 P1): 'loyalty' was in this list, so a logged-in loyalty
    // member who opened provider onboarding saw the form mount and then get
    // bounced to /prestige/home — "appears briefly then disappears". But a member
    // becoming ALSO a provider is the intended additive both-roles flow (a
    // customer was never blocked either). Only genuinely-incompatible internal
    // roles are bounced; customer + loyalty + already-approved provider stay (the
    // last is harmless — the apply call returns 409 already-applied).
    const blockedRoles = new Set([
      'staff', 'admin', 'super_admin', 'management', 'franchise_owner',
    ]);
    if (!role || !blockedRoles.has(role)) return;

    let cancelled = false;
    (async () => {
      try {
        // PR-FRES-B: route through postLoginCoordinator so this blocked-role
        // bounce shares the in-flight Promise with any concurrent SignIn /
        // OneTap / Account-tap call instead of firing a duplicate request.
        const data = await resolvePostLogin();
        if (cancelled) return;
        // Lane A (CEO 2026-09-03): canonical customer workspace fallback.
        // /home is the marketing page — signed-in customers must land on
        // the workspace. The server post-login decider is the source of
        // truth; this fallback only fires if the server has no opinion.
        const nextUrl = data.nextUrl || data.redirectTo || '/pet-parent/home';
        navigate(nextUrl);
      } catch {
        if (cancelled) return;
        navigate('/pet-parent/home');
      }
    })();
    return () => { cancelled = true; };
  }, [user, navigate]);

  // Form state
  const [step, setStep] = useState(1);
  // Post-release 2026-09-03 (backlog P1): hydrate providerTypes from URL
  // + sessionStorage so "Become a Pet Sitter" (?type=sitter / ?role=sitter
  // / ?requestedService=pet_sitting) actually lands with sitter pre-picked.
  // Previously initialized [] and silently dropped the CTA intent.
  const [providerTypes, setProviderTypes] = useState<
    Array<'walker' | 'sitter' | 'station_operator' | 'driver' | 'trainer'>
  >(() => initialRequestedServices());

  // Toggle a provider type in the multi-select list. Persists the union so
  // a refresh mid-wizard doesn't demote picks.
  const toggleProviderType = (type: 'walker' | 'sitter' | 'station_operator' | 'driver' | 'trainer') => {
    setProviderTypes(prev => {
      const next = prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type];
      // Keep sessionStorage in sync with the additive-union model so
      // reload picks up the current selection, not just the URL intent.
      setRequestedProviderServices(next);
      return next;
    });
  };
  
  // Helper to check if a type is selected
  const hasProviderType = (type: 'walker' | 'sitter' | 'station_operator' | 'driver' | 'trainer') => 
    providerTypes.includes(type);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+972');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneOtpId, setPhoneOtpId] = useState<string | null>(null);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [phoneOtpSending, setPhoneOtpSending] = useState(false);
  const [phoneOtpVerifying, setPhoneOtpVerifying] = useState(false);
  const [phoneOtpError, setPhoneOtpError] = useState('');
  const [idNumber, setIdNumber] = useState('');
  // Structured ID (Provider ID Safety, CEO 2026-07-03): which document the number
  // is from + its expiry. No ID/passport IMAGE forced online — a real copy is
  // posted only if we ask at final acceptance.
  const [idDocumentType, setIdDocumentType] = useState('');
  const [idExpiry, setIdExpiry] = useState('');
  const [ageConfirmed18Plus, setAgeConfirmed18Plus] = useState(false);
  // Birthday carried over from signup (prefilled from whoami) — proves 18+ without
  // re-asking, and is sent to the server so the real-age path is used. (2026-07-27)
  const [dob, setDob] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('IL');
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  // Light client-side Israeli-ID checksum (the backend is the source of truth;
  // this is only to give immediate feedback). Mirrors server/lib/israeliId.ts.
  const isValidIsraeliIdClient = (id: string): boolean => {
    const digits = (id || '').replace(/\D/g, '');
    if (digits.length === 0 || digits.length > 9 || /^0+$/.test(digits)) return false;
    const padded = digits.padStart(9, '0');
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let n = parseInt(padded[i], 10) * ((i % 2) + 1);
      if (n > 9) n -= 9;
      sum += n;
    }
    return sum % 10 === 0;
  };
  // Treat a pure ≤9-digit string as an Israeli-ID candidate (passports/licences
  // contain letters and are left alone).
  const looksLikeIsraeliIdClient = (id: string): boolean => {
    const cleaned = (id || '').replace(/[\s-]/g, '');
    return /^\d+$/.test(cleaned) && cleaned.length > 0 && cleaned.length <= 9;
  };
  const israeliIdInvalid =
    !!idNumber && looksLikeIsraeliIdClient(idNumber) && !isValidIsraeliIdClient(idNumber);
  
  // Files
  const [selfiePhoto, setSelfiePhoto] = useState<File | null>(null);
  const [governmentId, setGovernmentId] = useState<File | null>(null);
  const [insuranceCert, setInsuranceCert] = useState<File | null>(null);
  const [businessLicense, setBusinessLicense] = useState<File | null>(null);

  // Role-specific certifications (2026 spec)
  const [petFirstAidCert, setPetFirstAidCert] = useState<File | null>(null);
  const [petFirstAidNumber, setPetFirstAidNumber] = useState('');
  const [petFirstAidExpiry, setPetFirstAidExpiry] = useState('');
  const [drivingLicenseFile, setDrivingLicenseFile] = useState<File | null>(null);
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('');
  const [drivingLicenseClass, setDrivingLicenseClass] = useState('');
  const [drivingLicenseExpiry, setDrivingLicenseExpiry] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  // Israeli business/tax classification captured at application time (compliance).
  const [taxStatus, setTaxStatus] = useState('');

  // Background check (2026 spec)
  const [residentialHistory, setResidentialHistory] = useState<string[]>(['']);
  const [backgroundCheckConsent, setBackgroundCheckConsent] = useState(false);

  // Role-specific declarations (2026 Legal Compliance)
  // Driver declarations (PetTrek)
  const [declarationValidLicense, setDeclarationValidLicense] = useState(false);
  const [declarationNoSuspension, setDeclarationNoSuspension] = useState(false);
  const [declarationUnderPointsLimit, setDeclarationUnderPointsLimit] = useState(false);
  const [declarationNoDrugsAlcohol, setDeclarationNoDrugsAlcohol] = useState(false);
  const [declarationValidVehicleInsurance, setDeclarationValidVehicleInsurance] = useState(false);
  const [declarationVehicleInspection, setDeclarationVehicleInspection] = useState(false);
  
  // Trainer declarations (Academy)
  const [declarationTrainingCertification, setDeclarationTrainingCertification] = useState(false);
  const [declarationAccreditedCourses, setDeclarationAccreditedCourses] = useState(false);
  const [declarationLiabilityInsurance, setDeclarationLiabilityInsurance] = useState(false);
  
  // Sitter/Walker declarations
  const [declarationPhysicallyFit, setDeclarationPhysicallyFit] = useState(false);
  const [declarationAnimalExperience, setDeclarationAnimalExperience] = useState(false);
  const [declarationFirstAidTraining, setDeclarationFirstAidTraining] = useState(false);
  
  // Universal declarations (all roles)
  const [declarationAccurateInfo, setDeclarationAccurateInfo] = useState(false);
  const [declarationAcceptTerms, setDeclarationAcceptTerms] = useState(false);

  // Israel-safe self-declaration (2026 spec). Mandatory for every provider.
  const [selfDeclarationNoConvictions, setSelfDeclarationNoConvictions] = useState(false);

  // CEO §73 #12 (2026-08-28): bank / payout target. Server side (migration
  // 0133 + /apply Zod + admin ProviderKycReview card) landed in commit
  // 22d8f24b1; this is the CLIENT wizard section that actually collects
  // the fields. All optional at intake — approval still needs manual
  // review — but a submit without an IBAN is a payout dead-end, so the
  // "Still needed" checklist below prompts before submit for anyone
  // who left it blank. Providers can also add it later via the
  // dashboard's payout settings.
  const [bankName, setBankName] = useState('');
  const [bankBranchCode, setBankBranchCode] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');

  // Provider can also opt into high-risk services explicitly. The defaults
  // derived from providerTypes are unioned with these picks server-side.
  const [enhancedReasons, setEnhancedReasons] = useState<EnhancedVerificationReason[]>([]);

  const declarationText = isHebrew ? PROVIDER_DECLARATION_TEXT.he : PROVIDER_DECLARATION_TEXT.en;
  const derivedDefaultReasons = defaultReasonsForProviderTypes(providerTypes);
  const effectiveEnhancedReasons = Array.from(
    new Set<EnhancedVerificationReason>([
      ...derivedDefaultReasons,
      ...enhancedReasons,
    ]),
  );
  const enhancedVerificationRequired = effectiveEnhancedReasons.length > 0;

  // State
  const [loading, setLoading] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [biometricScore, setBiometricScore] = useState<number | null>(null);

  // ── Draft save (Lane A audit 2026-08-26) ─────────────────────────────
  // A mid-form refresh on Step 1 lost every field the applicant had typed
  // because the wizard never called POST /api/provider-applications/draft.
  // Fire a debounced save whenever a Step 1 field is blurred or a picker
  // commits a value; show a subtle status so the applicant knows their
  // typing is safe. The server handler is idempotent (upserts by userId).
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleDraftSave = useCallback(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(async () => {
      if (!user) return;
      // Nothing worth persisting yet — don't create an empty draft row.
      if (!firstName && !lastName && !phoneNumber && !city && !dob) return;
      setDraftStatus('saving');
      try {
        const token = await user.getIdToken();
        const fullPhone = phoneNumber
          ? `${phoneCountryCode}${phoneNumber.replace(/^0/, '').replace(/\s+/g, '')}`
          : undefined;

        // CEO §31 — Step 2 + Step 3 state SAVES SERVER-SIDE. Migration 0131
        // added `draft_step2_step3` jsonb on provider_applicants for exactly
        // this. File uploads (selfie, ID, insurance cert, first-aid cert,
        // driving license, business license) stay client-only — a File
        // object can't be re-hydrated from JSON — so the applicant re-picks
        // them on resume, but every text/checkbox/select field survives.
        // idNumber intentionally EXCLUDED from the draft blob: it's raw
        // Israeli ID and only ever leaves the browser through the /apply
        // encrypt-at-rest path.
        // Every field lives under a stable JSON key. The reverse-hydrate
        // in the mount effect reads by the same key, so a rename here
        // requires the mirror in the setter block below. Names track the
        // actual state-var names in this file (verified 2026-08-28).
        const draftStep2Step3 = {
          step2: {
            idDocumentType,
            idExpiry,
            providerTypes,
            taxStatus,
            insurancePolicyNumber,
            insuranceProvider,
            insuranceExpiry,
            petFirstAidNumber,
            petFirstAidExpiry,
            drivingLicenseNumber,
            drivingLicenseClass,
            drivingLicenseExpiry,
            ageConfirmed18Plus,
          },
          step3: {
            residentialHistory,
            backgroundCheckConsent,
            selfDeclarationNoConvictions,
            enhancedReasons,
            // Six driver declarations
            declarationValidLicense,
            declarationNoSuspension,
            declarationUnderPointsLimit,
            declarationNoDrugsAlcohol,
            declarationValidVehicleInsurance,
            declarationVehicleInspection,
            // Three trainer declarations
            declarationTrainingCertification,
            declarationAccreditedCourses,
            declarationLiabilityInsurance,
            // Three walker/sitter declarations
            declarationPhysicallyFit,
            declarationAnimalExperience,
            declarationFirstAidTraining,
            // Two universal declarations
            declarationAccurateInfo,
            declarationAcceptTerms,
          },
          // CEO §73 #12 (2026-08-28): bank / payout target. These live at
          // the top level of the blob (not under step2/step3) because they
          // are collected on their own section at the end of step 3.
          // Mirror in the mount hydrate below.
          bank: {
            bankName,
            bankBranchCode,
            bankIban,
            bankAccountHolder,
          },
        };

        const res = await fetch(getApiUrl('/api/provider-applications/draft'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            phoneNumber: fullPhone,
            dateOfBirth: dob || undefined,
            city: city || undefined,
            country: country || undefined,
            draftStep2Step3,
          }),
        });
        if (!res.ok) throw new Error(`draft save ${res.status}`);
        setDraftStatus('saved');
      } catch {
        // 409 (already submitted) is handled here too — the UI shouldn't
        // continue prompting "saved" once the applicant has moved past draft.
        setDraftStatus('error');
      }
    }, 800);
    // Intentional wide dep list — every draft field triggers a debounced
    // resave. React linter is off here because the array is deliberately
    // large and hand-maintained to keep parity with the payload above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user, firstName, lastName, phoneNumber, phoneCountryCode, dob, city, country,
    idDocumentType, idExpiry, providerTypes, taxStatus,
    insurancePolicyNumber, insuranceProvider, insuranceExpiry,
    petFirstAidNumber, petFirstAidExpiry,
    drivingLicenseNumber, drivingLicenseClass, drivingLicenseExpiry,
    ageConfirmed18Plus,
    residentialHistory, backgroundCheckConsent, selfDeclarationNoConvictions,
    enhancedReasons,
    declarationValidLicense, declarationNoSuspension, declarationUnderPointsLimit,
    declarationNoDrugsAlcohol, declarationValidVehicleInsurance, declarationVehicleInspection,
    declarationTrainingCertification, declarationAccreditedCourses, declarationLiabilityInsurance,
    declarationPhysicallyFit, declarationAnimalExperience, declarationFirstAidTraining,
    declarationAccurateInfo, declarationAcceptTerms,
    // Bank / payout target fields — CEO §73 #12.
    bankName, bankBranchCode, bankIban, bankAccountHolder,
  ]);

  // Clean up the pending debounce on unmount so a fetch never fires against
  // a torn-down component.
  useEffect(() => () => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
  }, []);

  // Load an existing draft on mount and hydrate any field the applicant left
  // empty. Never overwrite typed input — every setter guards on `v || …`.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(getApiUrl('/api/provider-applications/draft'), {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        const d = data?.draft;
        if (cancelled || !d) return;
        setFirstName((v) => v || d.firstName || '');
        setLastName((v) => v || d.lastName || '');
        setCity((v) => v || d.city || '');
        if (d.dateOfBirth) setDob((v) => v || String(d.dateOfBirth).slice(0, 10));
        if (d.country) setCountry((v) => v || d.country);
        if (d.phoneNumber && !phoneNumber) {
          const raw = String(d.phoneNumber);
          const code = ['+972', '+1', '+44', '+61', '+49', '+33', '+7', '+91', '+55'].find((c) => raw.startsWith(c));
          if (code) { setPhoneCountryCode(code); setPhoneNumber(raw.slice(code.length)); }
          else setPhoneNumber(raw);
        }
        // CEO §31 hydrate — reverse-mirror of the payload assembled in
        // scheduleDraftSave. Every setter guards on `v || …` so a value
        // the applicant is CURRENTLY typing is never overwritten by a
        // late-arriving draft response.
        const s2 = d.draftStep2Step3?.step2;
        const s3 = d.draftStep2Step3?.step3;
        if (s2) {
          if (s2.idDocumentType) setIdDocumentType((v) => v || s2.idDocumentType);
          if (s2.idExpiry)       setIdExpiry((v) => v || s2.idExpiry);
          if (Array.isArray(s2.providerTypes) && s2.providerTypes.length) {
            setProviderTypes((v) => (v && v.length ? v : s2.providerTypes));
          }
          if (s2.taxStatus)              setTaxStatus((v) => v || s2.taxStatus);
          if (s2.insurancePolicyNumber)  setInsurancePolicyNumber((v) => v || s2.insurancePolicyNumber);
          if (s2.insuranceProvider)      setInsuranceProvider((v) => v || s2.insuranceProvider);
          if (s2.insuranceExpiry)        setInsuranceExpiry((v) => v || s2.insuranceExpiry);
          if (s2.petFirstAidNumber)      setPetFirstAidNumber((v) => v || s2.petFirstAidNumber);
          if (s2.petFirstAidExpiry)      setPetFirstAidExpiry((v) => v || s2.petFirstAidExpiry);
          if (s2.drivingLicenseNumber)   setDrivingLicenseNumber((v) => v || s2.drivingLicenseNumber);
          if (s2.drivingLicenseClass)    setDrivingLicenseClass((v) => v || s2.drivingLicenseClass);
          if (s2.drivingLicenseExpiry)   setDrivingLicenseExpiry((v) => v || s2.drivingLicenseExpiry);
          if (s2.ageConfirmed18Plus)     setAgeConfirmed18Plus((v) => v || !!s2.ageConfirmed18Plus);
        }
        if (s3) {
          if (Array.isArray(s3.residentialHistory) && s3.residentialHistory.length) {
            setResidentialHistory((v) => (v && v.some((x) => x.trim()) ? v : s3.residentialHistory));
          }
          if (s3.backgroundCheckConsent)       setBackgroundCheckConsent((v) => v || !!s3.backgroundCheckConsent);
          if (s3.selfDeclarationNoConvictions) setSelfDeclarationNoConvictions((v) => v || !!s3.selfDeclarationNoConvictions);
          if (Array.isArray(s3.enhancedReasons) && s3.enhancedReasons.length) {
            setEnhancedReasons((v) => (v && v.length ? v : s3.enhancedReasons));
          }
          // Six driver declarations
          if (s3.declarationValidLicense)          setDeclarationValidLicense((v) => v || !!s3.declarationValidLicense);
          if (s3.declarationNoSuspension)          setDeclarationNoSuspension((v) => v || !!s3.declarationNoSuspension);
          if (s3.declarationUnderPointsLimit)      setDeclarationUnderPointsLimit((v) => v || !!s3.declarationUnderPointsLimit);
          if (s3.declarationNoDrugsAlcohol)        setDeclarationNoDrugsAlcohol((v) => v || !!s3.declarationNoDrugsAlcohol);
          if (s3.declarationValidVehicleInsurance) setDeclarationValidVehicleInsurance((v) => v || !!s3.declarationValidVehicleInsurance);
          if (s3.declarationVehicleInspection)     setDeclarationVehicleInspection((v) => v || !!s3.declarationVehicleInspection);
          // Three trainer declarations
          if (s3.declarationTrainingCertification) setDeclarationTrainingCertification((v) => v || !!s3.declarationTrainingCertification);
          if (s3.declarationAccreditedCourses)     setDeclarationAccreditedCourses((v) => v || !!s3.declarationAccreditedCourses);
          if (s3.declarationLiabilityInsurance)    setDeclarationLiabilityInsurance((v) => v || !!s3.declarationLiabilityInsurance);
          // Three walker/sitter declarations
          if (s3.declarationPhysicallyFit)         setDeclarationPhysicallyFit((v) => v || !!s3.declarationPhysicallyFit);
          if (s3.declarationAnimalExperience)      setDeclarationAnimalExperience((v) => v || !!s3.declarationAnimalExperience);
          if (s3.declarationFirstAidTraining)      setDeclarationFirstAidTraining((v) => v || !!s3.declarationFirstAidTraining);
          // Two universal declarations
          if (s3.declarationAccurateInfo)          setDeclarationAccurateInfo((v) => v || !!s3.declarationAccurateInfo);
          if (s3.declarationAcceptTerms)           setDeclarationAcceptTerms((v) => v || !!s3.declarationAcceptTerms);
        }
        // CEO §73 #12: bank / payout target hydrates off draftStep2Step3.bank.
        // Same v-guarded setters as step2/step3 so an in-progress edit is
        // never clobbered by a stale draft read.
        const bk = d.draftStep2Step3?.bank;
        if (bk && typeof bk === 'object') {
          if (bk.bankName)          setBankName((v)          => v || bk.bankName);
          if (bk.bankBranchCode)    setBankBranchCode((v)    => v || bk.bankBranchCode);
          if (bk.bankIban)          setBankIban((v)          => v || bk.bankIban);
          if (bk.bankAccountHolder) setBankAccountHolder((v) => v || bk.bankAccountHolder);
        }
      } catch { /* best-effort load */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto-populate and auto-verify phone from Firebase user's already-verified number
  useEffect(() => {
    if (!user) return;
    if (user.phoneNumber && !phoneVerified) {
      // Firebase phone is already verified — extract number and skip OTP
      const raw = user.phoneNumber; // e.g. "+972501234567"
      const matchedCode = ['+972', '+1', '+44', '+61', '+49', '+33', '+7', '+91', '+55']
        .find(c => raw.startsWith(c));
      if (matchedCode) {
        setPhoneCountryCode(matchedCode);
        setPhoneNumber(raw.slice(matchedCode.length));
      } else {
        setPhoneNumber(raw);
      }
      setPhoneVerified(true);
    }
    // Pre-fill name from Firebase display name if not already set
    if (user.displayName && !firstName && !lastName) {
      const parts = user.displayName.trim().split(/\s+/);
      if (parts.length >= 2) {
        setFirstName(parts[0]);
        setLastName(parts.slice(1).join(' '));
      } else if (parts.length === 1) {
        setFirstName(parts[0]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Prefill from the DB user record (2026-07-25 fix): name/phone/city were given
  // at signup/complete-profile and live in `users`, but this form only read the
  // Firebase object — which often has no displayName — so a provider was re-asked
  // for what we already know. Fill any field still empty; never overwrite input.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl('/api/auth/whoami'), { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const u = data?.user;
        if (cancelled || !u) return;
        setFirstName((v) => v || u.firstName || '');
        setLastName((v) => v || u.lastName || '');
        setCity((v) => v || u.city || '');
        // Prefill the birthday given at signup + auto-satisfy the 18+ gate from it
        // (was re-asked as a checkbox even though we already hold the DOB). (2026-07-27)
        if (u.dateOfBirth) {
          const d = String(u.dateOfBirth).slice(0, 10);
          setDob((v) => v || d);
          const age = Math.floor((Date.now() - new Date(d).getTime()) / 31557600000);
          if (age >= 18) setAgeConfirmed18Plus(true);
        }
        // Trust a phone already verified at signup — don't force a re-OTP (which
        // dead-ends when Twilio SMS is disabled). (2026-07-27)
        if (u.phoneVerified) setPhoneVerified(true);
        if (u.phone && !phoneVerified) {
          const raw = String(u.phone);
          const code = ['+972', '+1', '+44', '+61', '+49', '+33', '+7', '+91', '+55'].find((c) => raw.startsWith(c));
          if (code) { setPhoneCountryCode(code); setPhoneNumber((v) => v || raw.slice(code.length)); }
          else setPhoneNumber((v) => v || raw);
        }
      } catch { /* prefill is best-effort */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Phone OTP Verification Handlers ──────────────────────────────────
  // PR Phase A: no flag emojis. ISO-2 code + dial code is the professional
  // pattern (matches Apple/Stripe/airline checkouts). Phase B replaces this
  // custom picker with the library-backed <PhoneInput /> already used in
  // /apply-provider, OnboardingVerification, and the join/* flows.
  const COUNTRY_CODES = [
    { code: '+972', label: 'IL +972', name: 'Israel' },
    { code: '+1',   label: 'US +1',   name: 'USA / Canada' },
    { code: '+44',  label: 'GB +44',  name: 'UK' },
    { code: '+61',  label: 'AU +61',  name: 'Australia' },
    { code: '+49',  label: 'DE +49',  name: 'Germany' },
    { code: '+33',  label: 'FR +33',  name: 'France' },
    { code: '+7',   label: 'RU +7',   name: 'Russia' },
    { code: '+91',  label: 'IN +91',  name: 'India' },
    { code: '+55',  label: 'BR +55',  name: 'Brazil' },
  ];

  const sendPhoneOtp = async () => {
    setPhoneOtpError('');
    if (!phoneNumber.trim() || phoneNumber.trim().length < 7) {
      setPhoneOtpError(isHebrew ? 'הזן מספר טלפון תקין' : 'Enter a valid phone number');
      return;
    }
    setPhoneOtpSending(true);
    try {
      const fullPhone = `${phoneCountryCode}${phoneNumber.replace(/^0/, '').replace(/\s+/g, '')}`;
      const token = await user?.getIdToken();
      const res = await fetch(getApiUrl('/api/provider/phone/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ phone: fullPhone, channel: 'sms' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // If the server is still starting up, show a friendlier message
        const rawMsg: string = data.message || '';
        const isStartingUp = res.status === 503 || rawMsg.toLowerCase().includes('starting up');
        // SMS provider off (Twilio not configured, #362) returns a raw code — show a
        // clear message instead of "SMS_PROVIDER_DISABLED". (2026-07-27)
        const isSmsDown = /disabled|not configured|SMS_PROVIDER|provider_disabled/i.test(rawMsg);
        const errorMsg = (isStartingUp || isSmsDown)
          ? (isHebrew ? 'אימות הטלפון אינו זמין כרגע. אם כבר אימתת טלפון בהרשמה — תוכל להמשיך; אחרת נסה שוב מאוחר יותר.' : 'Phone verification is temporarily unavailable. If you already verified a phone at signup you can continue; otherwise please try again later.')
          : rawMsg || (isHebrew ? 'שליחת קוד נכשלה' : 'Failed to send code');
        setPhoneOtpError(errorMsg);
        return;
      }
      setPhoneOtpId(data.otpId);
      toast({ title: isHebrew ? 'קוד נשלח ב-SMS' : 'SMS code sent', description: isHebrew ? `נשלח ל-${fullPhone}` : `Sent to ${fullPhone}` });
    } catch {
      setPhoneOtpError(isHebrew ? 'שגיאת רשת' : 'Network error');
    } finally {
      setPhoneOtpSending(false);
    }
  };

  const verifyPhoneOtp = async () => {
    setPhoneOtpError('');
    if (!phoneOtpId || phoneOtpCode.length !== 6) {
      setPhoneOtpError(isHebrew ? 'הזן קוד בן 6 ספרות' : 'Enter the 6-digit code');
      return;
    }
    setPhoneOtpVerifying(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(getApiUrl('/api/provider/phone/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ otpId: phoneOtpId, code: phoneOtpCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPhoneOtpError(data.message || (isHebrew ? 'קוד שגוי' : 'Wrong code'));
        return;
      }
      setPhoneVerified(true);
      toast({ title: isHebrew ? 'טלפון אומת בהצלחה' : 'Phone verified', description: isHebrew ? 'מספר הטלפון שלך אומת' : 'Your phone number is now verified' });
    } catch {
      setPhoneOtpError(isHebrew ? 'שגיאת רשת' : 'Network error');
    } finally {
      setPhoneOtpVerifying(false);
    }
  };

  const t = {
    // PR Phase A: Hebrew "Pet Wash" wrapped in U+2066/U+2069 (LTR isolate /
    // pop directional isolate) so iOS Safari renders the brand mark left-to-
    // right inside the Hebrew sentence. Matches the §0 brand mark "PetWash™".
    title: isHebrew ? 'הצטרפו לצוות ⁦PetWash™⁩' : 'Join the PetWash™ Team',
    subtitle: isHebrew ? 'הירשם כשותף עצמאי והתחל להרוויח' : 'Sign up as an independent contractor and start earning',
    providerTypeTitle: isHebrew ? 'סוג שותף' : 'Provider Type',
    walker: isHebrew ? 'מטייל כלבים (Walk My Pet)' : 'Dog Walker (Walk My Pet)',
    sitter: isHebrew ? 'שמרטף (The Sitter Suite)' : 'Pet Sitter (The Sitter Suite)',
    stationOperator: isHebrew ? 'מפעיל תחנת רחצה (K9000)' : 'Wash Station Operator (K9000)',
    personalInfo: isHebrew ? 'פרטים אישיים' : 'Personal Information',
    firstName: isHebrew ? 'שם פרטי' : 'First Name',
    lastName: isHebrew ? 'שם משפחה' : 'Last Name',
    phone: isHebrew ? 'טלפון' : 'Phone Number',
    idNumber: isHebrew ? 'תעודת זהות / פספורט / רישיון נהיגה' : 'ID / Passport / Driver\'s License Number',
    idNumberPlaceholder: isHebrew ? 'מספר תעודת זהות, פספורט או רישיון נהיגה' : 'ID, passport or driver\'s license number',
    idNumberInvalid: isHebrew ? 'מספר תעודת הזהות אינו תקין. בדוק ונסה שוב.' : 'This Israeli ID number is not valid. Please check and try again.',
    age18Confirm: isHebrew ? 'אני מאשר/ת שאני בן/בת 18 ומעלה' : 'I confirm that I am at least 18 years old',
    city: isHebrew ? 'עיר' : 'City',
    country: isHebrew ? 'מדינה' : 'Country',
    biometricKyc: isHebrew ? 'אימות ביומטרי (רמת בנקאות)' : 'Biometric Verification (Banking-Level)',
    kycDescription: isHebrew
      ? 'אנו דורשים אימות זהות מאובטח עם התאמת פנים באמצעות AI ברמת בנקאות'
      : 'Bank-grade identity verification with AI-powered face matching',
    selfiePhoto: isHebrew ? 'סלפי בזמן אמת' : 'Live Selfie Photo',
    governmentId: isHebrew ? 'תעודה ממשלתית' : 'Government ID',
    governmentIdDescription: isHebrew ? 'דרכון, ת.ז., או רישיון נהיגה' : 'Passport, National ID, or Driver\'s License',
    insuranceCert: isHebrew ? 'אישור ביטוח' : 'Insurance Certificate',
    insuranceCertOptional: isHebrew ? 'אופציונלי למטיילים ושמרטפים' : 'Optional for walkers/sitters',
    businessLicense: isHebrew ? 'רישיון עסק' : 'Business License',
    businessLicenseOptional: isHebrew ? 'נדרש למפעילי תחנות' : 'Required for station operators',
    uploadPhoto: isHebrew ? 'העלה תמונה' : 'Upload Photo',
    fileSelected: isHebrew ? 'קובץ נבחר' : 'File Selected',
    submit: isHebrew ? 'שלח בקשה' : 'Submit Application',
    submitting: isHebrew ? 'שולח...' : 'Submitting...',
    next: isHebrew ? 'הבא' : 'Next',
    back: isHebrew ? 'חזור' : 'Back',
    requirements: isHebrew ? 'דרישות' : 'Requirements',
    requirementsList: isHebrew ? [
      'אזרחות או אשרת עבודה בישראל/ארה"ב/אנגליה/אוסטרליה/קנדה',
      'גיל 18+ עם זהות ממשלתית תקפה',
      'טלפון חכם עם GPS',
      'ביטוח אחריות (למטיילים ושמרטפים)',
      'אין רקע פלילי הכולל בעלי חיים'
    ] : [
      'Citizenship or work permit in Israel/USA/UK/Australia/Canada',
      'Age 18+ with valid government ID',
      'Smartphone with GPS',
      'Liability insurance (for walkers/sitters)',
      'No criminal record involving animals'
    ],
    benefits: isHebrew ? 'יתרונות' : 'Benefits',
    benefitsList: isHebrew ? [
      'עבוד בזמנים שלך',
      'הכנס תחרותי (שעתי או לפרויקט)',
      'תשלומים מאובטחים דרך Nayax',
      'גישה לבסיס לקוחות',
      'תמיכה טכנית 24/7'
    ] : [
      'Work your own hours',
      'Competitive earnings (hourly or per project)',
      'Secure payments via Nayax',
      'Access to customer base',
      '24/7 technical support'
    ],
    applicationSuccess: isHebrew ? 'בקשה נשלחה בהצלחה!' : 'Application Submitted Successfully!',
    successMessage: isHebrew 
      ? 'תודה על הרישום. נבדוק את הבקשה תוך 24-48 שעות ונעדכן אותך במייל.'
      : 'Thank you for applying. We will review your application within 24-48 hours and notify you via email.',
    biometricMatch: isHebrew ? 'התאמת פנים' : 'Face Match',
    matchScore: isHebrew ? 'ציון התאמה' : 'Match Score',
    error: isHebrew ? 'שגיאה' : 'Error',
    loginRequired: isHebrew ? 'נדרשת התחברות' : 'Login Required',
    pleaseLogin: isHebrew ? 'אנא התחבר כדי להמשיך בהרשמה' : 'Please log in to continue with registration',
    backgroundCheck: isHebrew ? 'בדיקת רקע פלילי' : 'Background Check',
    backgroundCheckDescription: isHebrew 
      ? 'בדיקת רקע פלילי נדרשת לכל השותפים שלנו כדי להבטיח את בטיחות הלקוחות והחיות שלהם'
      : 'Criminal background check is required for all contractors to ensure the safety of our customers and their pets',
    residentialHistory: isHebrew ? 'היסטוריית מגורים (10 שנים אחרונות)' : 'Residential History (Last 10 Years)',
    residentialHistoryHelp: isHebrew 
      ? 'רשום את כל הכתובות בהן גרת ב-10 השנים האחרונות (עיר, מדינה)'
      : 'List all addresses where you\'ve lived in the last 10 years (city, country)',
    addAddress: isHebrew ? 'הוסף כתובת נוספת' : 'Add Another Address',
    consentTitle: isHebrew ? 'הסכמה לבדיקת רקע' : 'Background Check Consent',
    consentText: isHebrew 
      ? 'אני מסכים/ה שחברת ⁦PetWash™⁩ תבצע בדיקת רקע פלילי מקיפה כולל היסטוריית מגורים של 10 שנים. אני מבין/ה שהמידע ישמש אך ורק למטרות אימות זהות ובטיחות.'
      : 'I consent to ⁦PetWash™⁩ conducting a comprehensive criminal background check including 10-year residential history. I understand this information will be used solely for identity verification and safety purposes.',
    // Role-specific certifications
    petFirstAidCert: isHebrew ? 'תעודת עזרה ראשונה לחיות מחמד' : 'Pet First Aid Certificate',
    petFirstAidRequired: isHebrew ? 'נדרש לשמרטפים ומטיילים' : 'Required for sitters and walkers',
    certNumber: isHebrew ? 'מספר תעודה' : 'Certificate Number',
    expiryDate: isHebrew ? 'תאריך תפוגה' : 'Expiry Date',
    drivingLicense: isHebrew ? 'רישיון נהיגה' : 'Driving License',
    drivingLicenseRequired: isHebrew ? 'נדרש לנהגי PetTrek' : 'Required for PetTrek drivers',
    licenseNumber: isHebrew ? 'מספר רישיון' : 'License Number',
    licenseClass: isHebrew ? 'סוג רישיון' : 'License Class',
    insurancePolicy: isHebrew ? 'פוליסת ביטוח' : 'Insurance Policy',
    policyNumber: isHebrew ? 'מספר פוליסה' : 'Policy Number',
    provider: isHebrew ? 'חברת ביטוח' : 'Insurance Provider',
  };

  const handleSubmit = async () => {
    const traceId = 'PROV-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    console.log('[Provider Onboarding Trace]', { traceId, timestamp: new Date().toISOString() });
    if (!user) {
      toast({
        variant: 'destructive',
        title: t.loginRequired,
        description: t.pleaseLogin
      });
      return;
    }

    // Structured ID is the required minimum — NOT an uploaded image (privacy-first).
    if (!idNumber || !idDocumentType) {
      toast({
        variant: 'destructive',
        title: t.error,
        description: isHebrew
          ? 'נדרשים מספר תעודה וסוג המסמך (ת"ז / דרכון / רישיון). אין צורך להעלות תמונה.'
          : 'Your document number and type (ID / passport / licence) are required. No photo upload needed.',
      });
      return;
    }

    if (providerTypes.length === 0) {
      toast({
        variant: 'destructive',
        title: t.error,
        description: isHebrew ? 'יש לבחור לפחות סוג שותף אחד' : 'Please select at least one provider type'
      });
      return;
    }

    // Israel-safe self-declaration is mandatory.
    if (!selfDeclarationNoConvictions) {
      toast({
        variant: 'destructive',
        title: t.error,
        description: declarationText.checkboxLabel,
      });
      return;
    }

    setLoading(true);

    try {
      const idToken = await user.getIdToken(true);
      const formData = new FormData();
      
      formData.append('firstName', firstName);
      formData.append('lastName', lastName);
      // CEO product correction — do NOT drop the country code on submit.
      // The draft-save path at line 265 stores the full E.164 number, but
      // the /apply path used to send just `phoneNumber` (national digits,
      // no dial code). Non-IL providers got their number persisted without
      // the country code — subsequent SMS to that provider failed. Send
      // the same fully-qualified form as the draft path so the applicants
      // row and the applications row match. Empty country code (rare) falls
      // through to the raw phoneNumber for backward-compat.
      const submitPhone = phoneCountryCode
        ? `${phoneCountryCode}${phoneNumber.replace(/^0/, '').replace(/\s+/g, '')}`
        : phoneNumber;
      formData.append('phoneNumber', submitPhone);
      formData.append('phoneCountryCode', phoneCountryCode || '+972');
      formData.append('idNumber', idNumber);
      formData.append('kycDocumentType', idDocumentType);
      // identityType tells the server to encrypt-at-rest an Israeli national ID
      // instead of relying on a digit heuristic. (2026-07-27)
      formData.append('identityType', idDocumentType === 'national_id' ? 'israeli_id' : idDocumentType);
      if (idExpiry) formData.append('kycDocumentExpiry', idExpiry);
      // Send the birthday carried from signup so the server uses the real-age path
      // (18+ proven by DOB, not just the checkbox). (2026-07-27)
      if (dob) formData.append('dateOfBirth', dob);
      formData.append('ageConfirmed18Plus', ageConfirmed18Plus ? 'true' : 'false');
      formData.append('city', city);
      formData.append('country', country);
      formData.append('providerType', providerTypes[0]);
      formData.append('providerTypes', JSON.stringify(providerTypes));
      // Images are OPTIONAL now — only attach if the provider chose to add one.
      if (selfiePhoto) formData.append('selfiePhoto', selfiePhoto);
      if (governmentId) formData.append('governmentId', governmentId);
      
      formData.append('residentialHistory', JSON.stringify(residentialHistory.filter(addr => addr.trim())));
      formData.append('backgroundCheckConsent', backgroundCheckConsent.toString());

      // Israel-safe self-declaration (2026 spec)
      formData.append('selfDeclarationNoRelevantConvictions', selfDeclarationNoConvictions ? 'true' : 'false');
      formData.append('enhancedVerificationReasons', JSON.stringify(effectiveEnhancedReasons));

      const declarations: Record<string, boolean> = {
        declarationAccurateInfo,
        declarationAcceptTerms,
      };
      if (providerTypes.includes('driver')) {
        Object.assign(declarations, {
          declarationValidLicense,
          declarationNoSuspension,
          declarationUnderPointsLimit,
          declarationNoDrugsAlcohol,
          declarationValidVehicleInsurance,
          declarationVehicleInspection,
        });
      }
      if (providerTypes.includes('trainer')) {
        Object.assign(declarations, {
          declarationTrainingCertification,
          declarationAccreditedCourses,
          declarationLiabilityInsurance,
        });
      }
      if (providerTypes.includes('walker') || providerTypes.includes('sitter')) {
        Object.assign(declarations, {
          declarationPhysicallyFit,
          declarationAnimalExperience,
          declarationFirstAidTraining,
        });
      }
      formData.append('declarations', JSON.stringify(declarations));
      
      if (insuranceCert) formData.append('insuranceCert', insuranceCert);
      if (insurancePolicyNumber) formData.append('insurancePolicyNumber', insurancePolicyNumber);
      if (insuranceProvider) formData.append('insuranceProvider', insuranceProvider);
      if (insuranceExpiry) formData.append('insuranceExpiry', insuranceExpiry);
      if (taxStatus) formData.append('taxStatus', taxStatus);

      if (petFirstAidCert) formData.append('petFirstAidCert', petFirstAidCert);
      if (petFirstAidNumber) formData.append('petFirstAidNumber', petFirstAidNumber);
      if (petFirstAidExpiry) formData.append('petFirstAidExpiry', petFirstAidExpiry);
      
      if (drivingLicenseFile) formData.append('drivingLicenseFile', drivingLicenseFile);
      if (drivingLicenseNumber) formData.append('drivingLicenseNumber', drivingLicenseNumber);
      if (drivingLicenseClass) formData.append('drivingLicenseClass', drivingLicenseClass);
      if (drivingLicenseExpiry) formData.append('drivingLicenseExpiry', drivingLicenseExpiry);
      // CEO §73 #12 bank/payout — server (provider-onboarding.ts) reads
      // these off the request, canonicalises the IBAN (uppercase + strip
      // whitespace), and persists via the migration-window post-INSERT
      // UPDATE. Optional at intake so a rolling wizard update against an
      // older server never blocks submit.
      if (bankName)            formData.append('bankName',            bankName.trim());
      if (bankBranchCode)      formData.append('bankBranchCode',      bankBranchCode.trim());
      if (bankIban)            formData.append('bankIban',            bankIban.replace(/\s+/g, '').toUpperCase());
      if (bankAccountHolder)   formData.append('bankAccountHolder',   bankAccountHolder.trim());
      
      if (businessLicense) formData.append('businessLicense', businessLicense);
      formData.append('traceId', traceId);

      console.log('[ProviderOnboarding] Submitting application with fields:', {
        traceId,
        firstName, lastName, phoneNumber: '***', idNumber: idNumber ? 'present' : 'empty',
        city, country, providerType: providerTypes[0], providerTypes,
        hasSelfie: !!selfiePhoto, hasGovId: !!governmentId,
        backgroundCheckConsent, residentialHistoryCount: residentialHistory.filter(a => a.trim()).length,
      });

      const response = await fetch(getApiUrl('/api/provider-onboarding/apply'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData
      });

      const data = await response.json();
      console.log('[ProviderOnboarding] Response:', { traceId, status: response.status, ok: response.ok, data });

      if (response.ok) {
        setApplicationSubmitted(true);
        setBiometricScore(data.biometricMatchScore);
        // Post-release 2026-09-03 (backlog P1): the CTA intent was
        // consumed successfully. Clear the sessionStorage marker so a
        // return visit doesn't re-inject the same service.
        clearRequestedProviderServices();
        toast({
          title: t.applicationSuccess,
          description: t.successMessage
        });
        // Route the user to the canonical pending screen so a refresh
        // lands on the right URL. Prior behavior left the URL stuck on
        // /provider-onboarding after submit — an admin who opened the
        // same URL again would see the empty form. /provider/pending is
        // the state-aware landing that BecomeProviderResume routes to
        // (audit-fix C5) on every subsequent visit.
        // Delay slightly so the confetti card is visible before nav.
        setTimeout(() => navigate('/provider/pending'), 2500);
      } else {
        console.error('[ProviderOnboarding] Submit failed:', { traceId, status: response.status, error: data.error });
        // CEO §60 (2026-08-28) — map stable server error codes to
        // friendly HE/EN copy. NEVER surface a raw server .error
        // string to a human — those carry stack traces, Firebase
        // internal codes, or Zod issue lists that we don't want
        // rendered on a customer surface.
        const FRIENDLY: Record<string, { he: string; en: string }> = {
          PHONE_NOT_VERIFIED: {
            he: 'נדרש לאמת את מספר הטלפון שלך לפני שליחת הבקשה. עברו לאזור החשבון → אבטחה כדי לאמת.',
            en: 'Please verify your mobile number before submitting. Head to Account → Security to verify.',
          },
          VERIFY_LOOKUP_FAILED: {
            he: 'לא הצלחנו לבדוק את מצב האימות שלך כרגע. נסו שוב בעוד רגע.',
            en: 'We could not check your verification state right now. Please try again in a moment.',
          },
          ID_NUMBER_REQUIRED: {
            he: 'חסר מספר תעודת זהות / דרכון / רישיון נהיגה. חזרו לשלב הזהות והוסיפו אותו.',
            en: 'A national ID / passport / driver-license number is required. Return to the identity step to add it.',
          },
          APPLICATION_ALREADY_PROCESSED: {
            he: 'בקשה זו כבר עברה בדיקה. אין צורך לשלוח שוב.',
            en: 'This application has already been reviewed. No need to resubmit.',
          },
          APPLICATION_NOT_FOUND: {
            he: 'לא נמצאה בקשה מתאימה. נא להתחיל את התהליך מחדש.',
            en: 'No matching application was found. Please start the process again.',
          },
        };
        const friendly = FRIENDLY[String(data?.errorCode || '')];
        const description = friendly
          ? (isHebrew ? friendly.he : friendly.en)
          : (isHebrew ? 'שגיאה בשליחת בקשה' : 'Error submitting application');
        toast({
          variant: 'destructive',
          title: t.error,
          description,
        });
      }
    } catch (error: any) {
      console.error('[ProviderOnboarding] Submit exception:', { traceId, error: error?.message || error });
      // Network / parse failures never surface the raw error text.
      toast({
        variant: 'destructive',
        title: t.error,
        description: isHebrew ? 'שגיאה בשליחת בקשה. אנא נסו שוב בעוד רגע.' : 'Error submitting application. Please try again in a moment.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (applicationSubmitted) {
    return (
      <div className={`min-h-screen luxury-bg-mesh py-12 px-4 ${(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}`}>
        <div className="max-w-2xl mx-auto luxury-animate-fade-in">
          <div className="luxury-glass-card luxury-shadow-xl border-2 border-green-500/30 p-8">
            <div className="text-center mb-6">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mb-4 luxury-animate-scale-in">
                <CheckCircle2 className="h-12 w-12 text-white" />
              </div>
              <h2 className="luxury-heading-lg text-green-900 dark:text-green-100 mb-2">
                {t.applicationSuccess}
              </h2>
              <p className="luxury-text-body mt-2">
                {t.successMessage}
              </p>
            </div>
            <div className="space-y-6 luxury-animate-fade-in luxury-delay-2">
              {biometricScore !== null && (
                <div className="luxury-glass-card luxury-shadow-md p-6 border-2 border-[#D4AF37]/30">
                  <div className="flex items-center gap-3 mb-3">
                    <Shield className="h-6 w-6 text-[#B8932F]" />
                    <h3 className="luxury-heading-sm text-[#B8932F] dark:text-[#D4AF37]">
                      {t.biometricMatch}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#B8932F] dark:text-[#D4AF37]">{t.matchScore}:</span>
                    <span className="text-2xl font-bold text-[#B8932F] dark:text-[#D4AF37]">
                      {biometricScore.toFixed(1)}%
                    </span>
                  </div>
                  {biometricScore >= 75 && (
                    <p className="text-sm text-green-700 dark:text-green-400 mt-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {isHebrew ? 'אימות זהות הצליח!' : 'Identity verification successful!'}
                    </p>
                  )}
                </div>
              )}

              <div className="luxury-glass-panel p-6 space-y-3">
                <h3 className="luxury-heading-sm mb-1">
                  {isHebrew ? 'מה קורה עכשיו?' : 'What happens next?'}
                </h3>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
                  <Clock className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-900">
                      {isHebrew ? 'זמן בדיקה: עד 24 שעות עסקיות' : 'Review time: up to 24 business hours'}
                    </p>
                    <p className="text-xs text-green-700">
                      {isHebrew ? 'בדרך כלל מהר יותר' : 'Usually faster'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#D4AF37] border border-[#D4AF37]">
                  <Users className="h-5 w-5 text-[#B8932F] mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-[#B8932F]">
                    {isHebrew
                      ? 'תקבל הודעת אימייל ו-SMS ברגע שהבקשה תאושר'
                      : 'You will receive an email and SMS the moment your application is approved'}
                  </p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <DollarSign className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-900">
                    {isHebrew
                      ? 'לאחר האישור תוכל להתחיל לקבל הזמנות ולהרוויח מיד'
                      : 'Once approved, you can start accepting bookings and earning immediately'}
                  </p>
                </div>
              </div>

              <div className="text-center space-y-1 pt-2">
                <p className="text-sm font-medium text-gray-700">
                  {isHebrew ? 'יש שאלות?' : 'Have questions?'}
                </p>
                <a
                  href="mailto:support@petwash.co.il"
                  className="text-sm text-[#B8932F] underline underline-offset-2"
                >
                  support@petwash.co.il
                </a>
                <p className="text-xs text-gray-500">
                  {isHebrew ? 'נענה תוך שעה בשעות פעילות' : 'We reply within 1 hour during business hours'}
                </p>
              </div>

              {/* PRIMARY next step (CEO 2026-07-31): sign the declarations to go
                  live — the funnel now pushes providers straight into signing. */}
              <Link href="/provider-declarations">
                <Button className="luxury-btn-primary luxury-shadow-xl w-full py-4 mb-3" data-testid="button-sign-declarations">
                  {isHebrew ? 'חתמו על הצהרות הספק כדי להפעיל את החשבון ←' : 'Sign your provider declarations to activate →'}
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full py-3" data-testid="button-back-home">
                  {isHebrew ? 'חזרה לדף הבית' : 'Back to Home'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen luxury-bg-mesh py-12 px-4 ${(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}`}>
      {/* Close Button - Top Right */}
      <Button
        onClick={() => navigate('/')}
        className="fixed top-4 right-4 z-50 p-3 rounded-full bg-white/80 dark:bg-black/80 backdrop-blur-sm shadow-lg hover:bg-white dark:hover:bg-black transition-colors"
        aria-label={isHebrew ? 'סגור' : 'Close'}
        data-testid="button-close-onboarding"
      >
        <X className="w-5 h-5 text-gray-700 dark:text-black" />
      </Button>

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-4">
            {t.title}
          </h1>
          <p className="luxury-text-body">
            {t.subtitle}
          </p>
        </div>

        {/* Progress Steps - Luxury Gradient Circles */}
        <div className="flex items-center justify-center gap-2 md:gap-4 mb-8 px-4 luxury-animate-slide-up luxury-delay-1">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#B8932F]' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 1 ? 'bg-gradient-to-br from-[#D4AF37] to-[#B8932F] text-white luxury-shadow-lg' : 'bg-white text-gray-500'}`}>
              1
            </div>
            <span className="hidden lg:inline text-sm font-medium">{isHebrew ? 'פלטפורמה ופרטים' : 'Platform & Info'}</span>
          </div>
          <div className={`h-0.5 w-8 ${step >= 2 ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8932F]' : 'bg-gray-300'}`}></div>
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#B8932F]' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 2 ? 'bg-gradient-to-br from-[#D4AF37] to-[#B8932F] text-white luxury-shadow-lg' : 'bg-white text-gray-500'}`}>
              2
            </div>
            <span className="hidden lg:inline text-sm font-medium">{isHebrew ? 'מסמכים' : 'Documents'}</span>
          </div>
          <div className={`h-0.5 w-8 ${step >= 3 ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8932F]' : 'bg-gray-300'}`}></div>
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-[#B8932F]' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 3 ? 'bg-gradient-to-br from-[#D4AF37] to-[#B8932F] text-white luxury-shadow-lg' : 'bg-white text-gray-500'}`}>
              3
            </div>
            <span className="hidden lg:inline text-sm font-medium">{isHebrew ? 'רקע' : 'Background'}</span>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-xl p-8 luxury-animate-fade-in luxury-delay-2">
            {/* Step 1: Platform Selection & Personal Information */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="mb-6">
                    <Label className="luxury-heading-sm mb-3 block">{t.providerTypeTitle}</Label>
                    <p className="text-sm text-gray-500 mb-3">
                      {isHebrew ? 'ניתן לבחור יותר מפלטפורמה אחת' : 'You can select more than one platform'}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div
                        data-testid="provider-type-walker"
                        data-selected={hasProviderType('walker') ? 'true' : 'false'}
                        role="button"
                        aria-pressed={hasProviderType('walker')}
                        className={`luxury-glass-card p-4 cursor-pointer transition-all ${hasProviderType('walker') ? 'ring-2 ring-black bg-black/5' : ''}`}
                        onClick={() => toggleProviderType('walker')}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={hasProviderType('walker')} 
                            onCheckedChange={() => toggleProviderType('walker')}
                            id="walker"
                          />
                          <Label htmlFor="walker" className="cursor-pointer flex-1 text-center">
                            <Footprints className="w-6 h-6 mb-2 mx-auto text-gray-700" aria-hidden="true" />
                            <span className="font-semibold block">{t.walker}</span>
                          </Label>
                        </div>
                      </div>
                      <div
                        data-testid="provider-type-sitter"
                        data-selected={hasProviderType('sitter') ? 'true' : 'false'}
                        role="button"
                        aria-pressed={hasProviderType('sitter')}
                        className={`luxury-glass-card p-4 cursor-pointer transition-all ${hasProviderType('sitter') ? 'ring-2 ring-black bg-black/5' : ''}`}
                        onClick={() => toggleProviderType('sitter')}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={hasProviderType('sitter')} 
                            onCheckedChange={() => toggleProviderType('sitter')}
                            id="sitter"
                          />
                          <Label htmlFor="sitter" className="cursor-pointer flex-1 text-center">
                            <Home className="w-6 h-6 mb-2 mx-auto text-gray-700" aria-hidden="true" />
                            <span className="font-semibold block">{t.sitter}</span>
                          </Label>
                        </div>
                      </div>
                      <div
                        data-testid="provider-type-driver"
                        data-selected={hasProviderType('driver') ? 'true' : 'false'}
                        role="button"
                        aria-pressed={hasProviderType('driver')}
                        className={`luxury-glass-card p-4 cursor-pointer transition-all ${hasProviderType('driver') ? 'ring-2 ring-black bg-black/5' : ''}`}
                        onClick={() => toggleProviderType('driver')}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={hasProviderType('driver')} 
                            onCheckedChange={() => toggleProviderType('driver')}
                            id="driver"
                          />
                          <Label htmlFor="driver" className="cursor-pointer flex-1 text-center">
                            <Car className="w-6 h-6 mb-2 mx-auto text-gray-700" aria-hidden="true" />
                            <span className="font-semibold block">{isHebrew ? 'נהג PetTrek' : 'PetTrek Driver'}</span>
                          </Label>
                        </div>
                      </div>
                      <div
                        data-testid="provider-type-trainer"
                        data-selected={hasProviderType('trainer') ? 'true' : 'false'}
                        role="button"
                        aria-pressed={hasProviderType('trainer')}
                        className={`luxury-glass-card p-4 cursor-pointer transition-all ${hasProviderType('trainer') ? 'ring-2 ring-black bg-black/5' : ''}`}
                        onClick={() => toggleProviderType('trainer')}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={hasProviderType('trainer')} 
                            onCheckedChange={() => toggleProviderType('trainer')}
                            id="trainer"
                          />
                          <Label htmlFor="trainer" className="cursor-pointer flex-1 text-center">
                            <GraduationCap className="w-6 h-6 mb-2 mx-auto text-gray-700" aria-hidden="true" />
                            <span className="font-semibold block">{isHebrew ? 'מאלף כלבים' : 'Dog Trainer'}</span>
                          </Label>
                        </div>
                      </div>
                      {/* Removed 2026-06-18: public "Wash Station Operator (K9000)" provider
                          option — station operation is internal-only, not a marketplace role. */}
                    </div>
                  </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">{t.firstName}</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      onBlur={scheduleDraftSave}
                      className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">{t.lastName}</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      onBlur={scheduleDraftSave}
                      className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                {/* Draft-save indicator — silent when idle, subtle everywhere else.
                    Lane A audit 2026-08-26. */}
                {draftStatus !== 'idle' && (
                  <div
                    className="text-xs text-gray-500 -mt-2"
                    aria-live="polite"
                    data-testid="draft-status"
                  >
                    {draftStatus === 'saving' && (isHebrew ? 'שומר טיוטה…' : 'Saving draft…')}
                    {draftStatus === 'saved'  && (isHebrew ? 'הטיוטה נשמרה' : 'Draft saved')}
                    {draftStatus === 'error'  && (
                      <span className="text-amber-700">
                        {isHebrew ? 'שמירת הטיוטה נכשלה — נסה שוב' : 'Draft save failed — try again'}
                      </span>
                    )}
                  </div>
                )}

                {/* Phone with country code + OTP verification */}
                <div className="space-y-2">
                  <Label>
                    {t.phone}
                    {phoneVerified && (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-semibold ml-1">
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                        {isHebrew ? 'מאומת' : 'Verified'}
                      </span>
                    )}
                  </Label>
                  {!phoneVerified && (
                    <>
                      {/* PR Phase A: dir="ltr" locks logical order — country
                          selector LEFT, phone input RIGHT — in every language.
                          CEO rule: phone field groups never reverse in RTL. */}
                      <div dir="ltr" className="flex gap-2">
                        <Select value={phoneCountryCode} onValueChange={setPhoneCountryCode} disabled={!!phoneOtpId}>
                          <SelectTrigger className="w-[110px] h-12 bg-white border border-gray-200 rounded-xl text-sm flex-shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRY_CODES.map(({ code, label, name }) => (
                              <SelectItem key={code} value={code}>{label} {name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d\s\-]/g, ''))}
                          onBlur={scheduleDraftSave}
                          placeholder={isHebrew ? 'מספר טלפון' : 'Phone number'}
                          disabled={!!phoneOtpId}
                          className="flex-1 h-12 bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                          inputMode="tel"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={sendPhoneOtp}
                          disabled={phoneOtpSending || !!phoneOtpId || !phoneNumber.trim()}
                          className="h-12 px-4 text-sm border-[#C6A35B] text-[#C6A35B] hover:bg-[#C6A35B]/10 whitespace-nowrap flex-shrink-0"
                        >
                          {phoneOtpSending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isHebrew ? 'שלח קוד' : 'Send Code')}
                        </Button>
                      </div>
                      {phoneOtpId && (
                        <div className="flex gap-2 items-center animate-in slide-in-from-top-2">
                          <Input
                            value={phoneOtpCode}
                            onChange={(e) => setPhoneOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder={isHebrew ? 'קוד SMS בן 6 ספרות' : '6-digit SMS code'}
                            inputMode="numeric"
                            maxLength={6}
                            className="flex-1 h-12 bg-white !text-gray-900 border-2 border-[#C6A35B]/40 rounded-xl placeholder:text-gray-400 text-center text-lg font-mono tracking-widest"
                          />
                          <Button
                            type="button"
                            onClick={verifyPhoneOtp}
                            disabled={phoneOtpVerifying || phoneOtpCode.length !== 6}
                            className="h-12 px-5 bg-gradient-to-r from-[#C6A35B] to-[#E7C978] text-black font-bold rounded-xl whitespace-nowrap"
                          >
                            {phoneOtpVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : (isHebrew ? 'אמת' : 'Verify')}
                          </Button>
                          <button
                            type="button"
                            onClick={() => { setPhoneOtpId(null); setPhoneOtpCode(''); setPhoneOtpError(''); }}
                            className="text-gray-400 hover:text-gray-600 text-sm underline whitespace-nowrap"
                          >
                            {isHebrew ? 'שנה' : 'Change'}
                          </button>
                        </div>
                      )}
                      {phoneOtpError && (
                        <p className="text-red-500 text-xs flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                          {phoneOtpError}
                        </p>
                      )}
                      {!phoneOtpId && (
                        <p className="text-gray-400 text-xs">
                          {isHebrew ? 'יש לאמת את מספר הטלפון לפני המשך' : 'Phone verification required before proceeding'}
                        </p>
                      )}
                    </>
                  )}
                  {phoneVerified && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-green-700 text-sm font-medium">
                        {phoneCountryCode}{phoneNumber} {isHebrew ? '— אומת בהצלחה' : '— verified successfully'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="idNumber">{t.idNumber}</Label>
                  <Input
                    id="idNumber"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder={t.idNumberPlaceholder}
                    className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                    data-testid="input-id-number"
                  />
                  {israeliIdInvalid && (
                    <p className="text-sm text-red-600 mt-1" data-testid="error-id-number">
                      {t.idNumberInvalid}
                    </p>
                  )}
                </div>

                {/* Structured ID: which document + expiry. No image forced online. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="idDocumentType">{isHebrew ? 'סוג המסמך' : 'Document type'}</Label>
                    <select
                      id="idDocumentType"
                      value={idDocumentType}
                      onChange={(e) => setIdDocumentType(e.target.value)}
                      className="w-full bg-white text-gray-900 border border-gray-200 rounded-xl h-10 px-3"
                      data-testid="select-id-doc-type"
                    >
                      <option value="">{isHebrew ? 'בחר/י…' : 'Select…'}</option>
                      <option value="national_id">{isHebrew ? 'תעודת זהות' : 'National ID'}</option>
                      <option value="passport">{isHebrew ? 'דרכון' : 'Passport'}</option>
                      <option value="drivers_license">{isHebrew ? 'רישיון נהיגה' : 'Driving licence'}</option>
                      <option value="disability_certificate">{isHebrew ? 'תעודת נכות' : 'Disability card'}</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="idExpiry">{isHebrew ? 'תוקף (אם קיים)' : 'Expiry (if any)'}</Label>
                    <Input
                      id="idExpiry" type="date" value={idExpiry}
                      onChange={(e) => setIdExpiry(e.target.value)}
                      className="bg-white !text-gray-900 border border-gray-200 rounded-xl"
                      data-testid="input-id-expiry"
                    />
                  </div>
                </div>

                {/* Privacy-first note (CEO 2026-07-03): no forced online ID upload. */}
                <div className="rounded-xl border border-[#E7D38f] bg-[#FFFDF7] p-3 text-xs text-gray-600 leading-relaxed">
                  {isHebrew
                    ? '🔒 אין צורך להעלות תמונת תעודה עכשיו. די בפרטים המובנים (מספר, סוג ותוקף) ובהצהרות. אם נדרש אימות מוגבר בשלב האישור הסופי, תתבקש/י לשלוח עותק בדואר לכתובת הרשומה של PetWash — בטוח ופרטי.'
                    : '🔒 No need to upload an ID photo now. Your structured details (number, type, expiry) plus the declarations are enough. If enhanced verification is needed at final approval, we\'ll ask you to POST a copy to PetWash\'s registered office — safe and private.'}
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={ageConfirmed18Plus}
                    onCheckedChange={(checked) => setAgeConfirmed18Plus(!!checked)}
                    className="mt-1"
                    data-testid="checkbox-age-18"
                  />
                  <span className="text-sm text-gray-700">{t.age18Confirm}</span>
                </label>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">{t.city}</Label>
                    {country === 'IL' ? (
                      <>
                        {/* Israel: pick from the mapped city registry
                            (shared/data/israel-cities.ts, gabmic seed).
                            Same picker MyAccount / Shop / booker use so the
                            provider's city becomes a canonical value the
                            search + admin surfaces can trust. */}
                        <button
                          type="button"
                          onClick={() => setCityPickerOpen(true)}
                          className="w-full h-12 rounded-xl border-2 border-gray-200 bg-white text-base text-left px-4 flex items-center justify-between hover:border-amber-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition"
                          dir={isHebrew ? 'rtl' : 'ltr'}
                          data-testid="provider-onboarding-city-picker-open"
                        >
                          <span className={city ? 'text-gray-900' : 'text-gray-400'}>
                            {city || (isHebrew ? 'בחר עיר…' : 'Choose city…')}
                          </span>
                          <span className="text-xs text-gray-400">▾</span>
                        </button>
                        <CityPicker
                          open={cityPickerOpen}
                          onOpenChange={setCityPickerOpen}
                          value={null}
                          language={isHebrew ? 'he' : 'en'}
                          onChange={(sel: CityPickerSelection) => {
                            const displayCity = isHebrew
                              ? sel.hebrewName
                              : (sel.englishName || sel.hebrewName);
                            setCity(displayCity);
                            setCityPickerOpen(false);
                            scheduleDraftSave();
                          }}
                        />
                      </>
                    ) : (
                      // Non-Israel providers keep the free-text Google Places
                      // autocomplete restricted to the country picker's value
                      // so a US provider doesn't get IL city suggestions and
                      // vice-versa. Country restrictions map to lowercase ISO
                      // 3166-1 alpha-2 codes per the Places API.
                      <GooglePlacesAutocomplete
                        value={city}
                        onChange={(value, details) => {
                          setCity(details?.city || value);
                          if (details?.country === 'Israel') setCountry('IL');
                          else if (details?.country === 'United States') setCountry('USA');
                          else if (details?.country === 'United Kingdom') setCountry('UK');
                          else if (details?.country === 'Australia') setCountry('AUS');
                          else if (details?.country === 'Canada') setCountry('CAN');
                          scheduleDraftSave();
                        }}
                        placeholder={isHebrew ? 'התחל להקליד עיר...' : 'Start typing city...'}
                        country={
                          country === 'USA' ? ['us']
                            : country === 'UK' ? ['gb']
                            : country === 'AUS' ? ['au']
                            : country === 'CAN' ? ['ca']
                            : ['us', 'gb', 'au', 'ca']
                        }
                        inputClassName="bg-white !text-gray-900 border-2 border-gray-200 rounded-xl placeholder:text-gray-400 px-4 py-4 text-base min-h-[48px]"
                      />
                    )}
                  </div>
                  <div>
                    <Label htmlFor="country">{t.country}</Label>
                    <Select value={country} onValueChange={(v) => { setCountry(v); scheduleDraftSave(); }}>
                      <SelectTrigger className="w-full h-12 bg-white !text-gray-900 border border-gray-200 rounded-xl" data-testid="select-country">
                        <SelectValue placeholder={isHebrew ? 'בחר מדינה' : 'Select country'} />
                      </SelectTrigger>
                      <SelectContent>
                        <ScrollArea className="h-48">
                          <SelectItem value="IL">Israel (ישראל)</SelectItem>
                          <SelectItem value="USA">USA (ארצות הברית)</SelectItem>
                          <SelectItem value="UK">United Kingdom (בריטניה)</SelectItem>
                          <SelectItem value="AUS">Australia (אוסטרליה)</SelectItem>
                          <SelectItem value="CAN">Canada (קנדה)</SelectItem>
                          <SelectItem value="DE">Germany (גרמניה)</SelectItem>
                          <SelectItem value="FR">France (צרפת)</SelectItem>
                          <SelectItem value="IT">Italy (איטליה)</SelectItem>
                          <SelectItem value="ES">Spain (ספרד)</SelectItem>
                          <SelectItem value="NL">Netherlands (הולנד)</SelectItem>
                          <SelectItem value="BE">Belgium (בלגיה)</SelectItem>
                          <SelectItem value="CH">Switzerland (שווייץ)</SelectItem>
                          <SelectItem value="AT">Austria (אוסטריה)</SelectItem>
                          <SelectItem value="SE">Sweden (שוודיה)</SelectItem>
                          <SelectItem value="NO">Norway (נורבגיה)</SelectItem>
                          <SelectItem value="DK">Denmark (דנמרק)</SelectItem>
                          <SelectItem value="FI">Finland (פינלנד)</SelectItem>
                          <SelectItem value="IE">Ireland (אירלנד)</SelectItem>
                          <SelectItem value="PT">Portugal (פורטוגל)</SelectItem>
                          <SelectItem value="GR">Greece (יוון)</SelectItem>
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Step 1 live-missing checklist — CEO 2026-08-24: "all steps
                    become provider" was blocked by a silent disabled Next button. */}
                {(() => {
                  const missing: string[] = [];
                  if (!firstName)                                  missing.push(isHebrew ? 'שם פרטי' : 'First name');
                  if (!lastName)                                   missing.push(isHebrew ? 'שם משפחה' : 'Last name');
                  if (!phoneNumber)                                missing.push(isHebrew ? 'מספר טלפון' : 'Phone number');
                  if (phoneNumber && !phoneVerified)               missing.push(isHebrew ? 'אימות הטלפון (SMS)' : 'Phone verification (SMS code)');
                  if (!idNumber)                                   missing.push(isHebrew ? 'מספר תעודת זהות / דרכון' : 'ID / passport number');
                  if (idNumber && israeliIdInvalid)                missing.push(isHebrew ? 'מספר תעודת זהות ישראלי תקין' : 'Valid Israeli ID checksum');
                  if (!ageConfirmed18Plus)                         missing.push(isHebrew ? 'אישור גיל 18+' : '18+ age confirmation');
                  if (!city)                                       missing.push(isHebrew ? 'עיר מגורים' : 'City');
                  if (providerTypes.length === 0)                  missing.push(isHebrew ? 'לפחות תפקיד ספק אחד' : 'At least one provider role');
                  if (missing.length === 0) return null;
                  return (
                    <div className="my-3 p-3 rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-900/20">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-200" />
                        <strong className="text-amber-900 dark:text-amber-100 text-xs">
                          {isHebrew ? 'עדיין חסר כדי להמשיך:' : 'Still needed to continue:'}
                        </strong>
                      </div>
                      <ul className="list-disc ml-6 space-y-0.5 text-xs text-amber-900 dark:text-amber-100">
                        {missing.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    </div>
                  );
                })()}

                <div className="flex gap-4">
                  <Button
                    onClick={() => setStep(2)}
                    className="luxury-btn-primary luxury-shadow-xl flex-1"
                    disabled={!firstName || !lastName || !phoneNumber || !phoneVerified || !idNumber || israeliIdInvalid || !ageConfirmed18Plus || !city || providerTypes.length === 0}
                    data-testid="button-next-step2"
                  >
                    {t.next}
                    <ArrowRight className="h-5 w-5 ml-2 inline" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Biometric KYC */}
            {step === 2 && (
              <div className="space-y-6">
                <Alert>
                  <Shield className="h-5 w-5" />
                  <AlertDescription>
                    <strong>{t.biometricKyc}</strong>
                    <br />
                    {t.kycDescription}
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {/* Selfie Photo */}
                  <div>
                    <Label htmlFor="selfie" className="text-lg font-semibold flex items-center gap-2">
                      <Camera className="h-5 w-5" />
                      {t.selfiePhoto}
                    </Label>
                    <Input
                      id="selfie"
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={(e) => setSelfiePhoto(e.target.files?.[0] || null)}
                      className="mt-2 luxury-glass-minimal"
                      data-testid="input-selfie"
                    />
                    {selfiePhoto && (
                      <p className="text-sm text-green-600 mt-1 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {t.fileSelected}: {selfiePhoto.name}
                      </p>
                    )}
                  </div>

                  {/* Government ID */}
                  <div>
                    <Label htmlFor="governmentId" className="text-lg font-semibold flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      {t.governmentId}
                    </Label>
                    <p className="text-sm text-gray-500 mb-2">{t.governmentIdDescription}</p>
                    <Input
                      id="governmentId"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setGovernmentId(e.target.files?.[0] || null)}
                      className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                      data-testid="input-government-id"
                    />
                    {governmentId && (
                      <p className="text-sm text-green-600 mt-1 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {t.fileSelected}: {governmentId.name}
                      </p>
                    )}
                  </div>

                  {/* Insurance Certificate + Policy Details (Walkers/Sitters) */}
                  {(hasProviderType('walker') || hasProviderType('sitter')) && (
                    <>
                      <div className="luxury-glass-card luxury-shadow-md p-4 space-y-3 border-2 border-[#D4AF37]/20">
                        <Label htmlFor="insurance" className="text-lg font-semibold">
                          {t.insurancePolicy}
                        </Label>
                        <p className="text-sm text-gray-500">{t.insuranceCertOptional}</p>
                        
                        <div className="grid md:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="insurancePolicyNumber" className="text-sm">{t.policyNumber}</Label>
                            <Input
                              id="insurancePolicyNumber"
                              value={insurancePolicyNumber}
                              onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                              placeholder={isHebrew ? 'לדוגמה: POL-123456' : 'e.g. POL-123456'}
                              className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                              data-testid="input-insurance-policy-number"
                            />
                          </div>
                          <div>
                            <Label htmlFor="insuranceProvider" className="text-sm">{t.provider}</Label>
                            <Input
                              id="insuranceProvider"
                              value={insuranceProvider}
                              onChange={(e) => setInsuranceProvider(e.target.value)}
                              placeholder={isHebrew ? 'לדוגמה: כלל ביטוח' : 'e.g. Clal Insurance'}
                              className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                              data-testid="input-insurance-provider"
                            />
                          </div>
                        </div>

                        {/* Israeli business / tax classification — compliance: captured
                            at application time, not only after approval. */}
                        <div>
                          <Label htmlFor="taxStatus" className="text-sm">
                            {isHebrew ? 'סטטוס עוסק / מס' : 'Business / Tax Status'}
                          </Label>
                          <select
                            id="taxStatus"
                            value={taxStatus}
                            onChange={(e) => setTaxStatus(e.target.value)}
                            className="w-full bg-white text-gray-900 border border-gray-200 rounded-xl px-3 py-2"
                            data-testid="select-tax-status"
                          >
                            <option value="">{isHebrew ? 'בחר/י…' : 'Select…'}</option>
                            <option value="osek_patur">{isHebrew ? 'עוסק פטור' : 'Osek Patur (exempt dealer)'}</option>
                            <option value="osek_murshe">{isHebrew ? 'עוסק מורשה' : 'Osek Murshe (licensed dealer)'}</option>
                            <option value="company">{isHebrew ? 'חברה בע״מ' : 'Company (Ltd)'}</option>
                            <option value="not_registered">{isHebrew ? 'עדיין לא רשום/לא בטוח' : 'Not registered yet / unsure'}</option>
                          </select>
                        </div>

                        <div>
                          <Label htmlFor="insuranceExpiry" className="text-sm">{t.expiryDate}</Label>
                          <DatePicker
                            value={insuranceExpiry}
                            onChange={setInsuranceExpiry}
                            placeholder={isHebrew ? 'בחר תאריך תפוגה' : 'Select expiry date'}
                            minDate={new Date()}
                            language={language}
                            testId="input-insurance-expiry"
                            className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="insurance" className="text-sm">{t.insuranceCert}</Label>
                          <Input
                            id="insurance"
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => setInsuranceCert(e.target.files?.[0] || null)}
                            className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                            data-testid="input-insurance"
                          />
                          {insuranceCert && (
                            <p className="text-sm text-green-600 mt-1 flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" />
                              {t.fileSelected}: {insuranceCert.name}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Pet First Aid Certification (2026 Spec) */}
                      <div className="luxury-glass-card luxury-shadow-md p-4 space-y-3 border-2 border-green-400/20">
                        <Label htmlFor="petFirstAid" className="text-lg font-semibold">
                          {t.petFirstAidCert}
                        </Label>
                        <p className="text-sm text-gray-500">{t.petFirstAidRequired}</p>
                        
                        <div className="grid md:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="petFirstAidNumber" className="text-sm">{t.certNumber}</Label>
                            <Input
                              id="petFirstAidNumber"
                              value={petFirstAidNumber}
                              onChange={(e) => setPetFirstAidNumber(e.target.value)}
                              placeholder={isHebrew ? 'לדוגמה: PFA-2024-12345' : 'e.g. PFA-2024-12345'}
                              className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                              data-testid="input-pet-first-aid-number"
                            />
                          </div>
                          <div>
                            <Label htmlFor="petFirstAidExpiry" className="text-sm">{t.expiryDate}</Label>
                            <DatePicker
                              value={petFirstAidExpiry}
                              onChange={setPetFirstAidExpiry}
                              placeholder={isHebrew ? 'בחר תאריך תפוגה' : 'Select expiry date'}
                              minDate={new Date()}
                              language={language}
                              testId="input-pet-first-aid-expiry"
                              className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="petFirstAidCert" className="text-sm">{t.petFirstAidCert}</Label>
                          <Input
                            id="petFirstAidCert"
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => setPetFirstAidCert(e.target.files?.[0] || null)}
                            className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                            data-testid="input-pet-first-aid-cert"
                          />
                          {petFirstAidCert && (
                            <p className="text-sm text-green-600 mt-1 flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" />
                              {t.fileSelected}: {petFirstAidCert.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Removed 2026-06-18: Station-Operator business-license upload (the
                      operator provider type is no longer offered to the public). */}
                </div>

                {/* Step 2 live-missing checklist. Note that photo uploads are
                    OPTIONAL by design (CEO 2026-07-03 privacy-first — see server
                    provider-onboarding.ts:531). Only ID number + document type
                    are required to advance. */}
                {(() => {
                  const missing: string[] = [];
                  if (!idNumber)         missing.push(isHebrew ? 'מספר תעודת זהות / דרכון' : 'ID / passport number');
                  if (!idDocumentType)   missing.push(isHebrew ? 'סוג המסמך (תעודת זהות / דרכון / רישיון)' : 'Document type (ID / passport / license)');
                  if (missing.length === 0) return null;
                  return (
                    <div className="my-3 p-3 rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-900/20">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-200" />
                        <strong className="text-amber-900 dark:text-amber-100 text-xs">
                          {isHebrew ? 'עדיין חסר כדי להמשיך:' : 'Still needed to continue:'}
                        </strong>
                      </div>
                      <ul className="list-disc ml-6 space-y-0.5 text-xs text-amber-900 dark:text-amber-100">
                        {missing.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    </div>
                  );
                })()}

                <div className="flex gap-4">
                  <Button onClick={() => setStep(1)} className="luxury-btn-secondary" data-testid="button-back-step1">
                    {t.back}
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    className="luxury-btn-primary luxury-shadow-xl flex-1"
                    disabled={!idNumber || !idDocumentType}
                    data-testid="button-next-step3"
                  >
                    {t.next}
                    <ArrowRight className="h-5 w-5 ml-2 inline" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Declarations & Background Check (2026 Spec) */}
            {step === 3 && (
              <div className="space-y-6">
                <Alert className="border-[#D4AF37] bg-[#D4AF37] dark:bg-white">
                  <Shield className="h-5 w-5 text-[#B8932F]" />
                  <AlertDescription>
                    <strong className="text-[#B8932F] dark:text-[#D4AF37]">{t.backgroundCheck}</strong>
                    <br />
                    <span className="text-[#B8932F] dark:text-[#D4AF37]">{t.backgroundCheckDescription}</span>
                  </AlertDescription>
                </Alert>

                {/* Role-Specific Declarations - USA 2025 Compliance */}
                <div className="luxury-glass-card luxury-shadow-lg border-2 border-[#D4AF37]/30 p-6">
                  <h3 className="luxury-heading-sm text-[#B8932F] dark:text-[#D4AF37] mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {isHebrew ? 'הצהרות נדרשות' : 'Required Declarations'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {isHebrew
                      ? 'אנא סמן את כל ההצהרות הרלוונטיות לתפקיד שלך. מסמכים יאומתו ידנית על ידי צוות ⁦PetWash™⁩.'
                      : 'Please check all declarations relevant to your role. Documents will be manually verified by the PetWash™ team.'}
                  </p>

                  {/* Driver Declarations (PetTrek) */}
                  {/* CEO §35 (2026-08-28) — Driving-license inputs are
                      collected ONLY when the applicant selected 'driver'.
                      Prior state: hooks existed but no UI section rendered,
                      so drivers submitted empty licence fields. This block
                      shows number / class / expiry + a file upload
                      strictly for drivers. Sitter/walker/trainer applicants
                      never see it. */}
                  {hasProviderType('driver') && (
                    <div className="space-y-3 mb-4 p-4 bg-white rounded-lg border border-slate-200" data-testid="section-driving-license">
                      <h4 className="font-semibold text-[#063B22] flex items-center gap-2">
                        <Car className="w-4 h-4" aria-hidden="true" />
                        {isHebrew ? 'פרטי רישיון נהיגה' : 'Driving licence details'}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="block">
                          <span className="block text-xs font-semibold mb-1">
                            {isHebrew ? 'מספר רישיון' : 'Licence number'}
                          </span>
                          <input
                            type="text"
                            value={drivingLicenseNumber}
                            onChange={(e) => setDrivingLicenseNumber(e.target.value)}
                            onBlur={scheduleDraftSave}
                            className="w-full rounded-xl border border-[#ECE6D8] bg-white px-4 py-3 text-sm outline-none focus:border-[#D6B56D]"
                            data-testid="input-driving-license-number"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-xs font-semibold mb-1">
                            {isHebrew ? 'סוג רישיון' : 'Licence class'}
                          </span>
                          <input
                            type="text"
                            value={drivingLicenseClass}
                            onChange={(e) => setDrivingLicenseClass(e.target.value)}
                            onBlur={scheduleDraftSave}
                            placeholder={isHebrew ? 'לדוגמה: B' : 'e.g. B'}
                            className="w-full rounded-xl border border-[#ECE6D8] bg-white px-4 py-3 text-sm outline-none focus:border-[#D6B56D]"
                            data-testid="input-driving-license-class"
                          />
                        </label>
                        <label className="block md:col-span-2">
                          <span className="block text-xs font-semibold mb-1">
                            {isHebrew ? 'תוקף (תאריך)' : 'Expiry date'}
                          </span>
                          <input
                            type="date"
                            value={drivingLicenseExpiry}
                            onChange={(e) => setDrivingLicenseExpiry(e.target.value)}
                            onBlur={scheduleDraftSave}
                            className="w-full rounded-xl border border-[#ECE6D8] bg-white px-4 py-3 text-sm outline-none focus:border-[#D6B56D]"
                            data-testid="input-driving-license-expiry"
                          />
                        </label>
                        <label className="block md:col-span-2 text-xs">
                          <span className="block font-semibold mb-1">
                            {isHebrew ? 'צילום רישיון (אופציונלי)' : 'Licence photo (optional)'}
                          </span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => setDrivingLicenseFile(e.target.files?.[0] ?? null)}
                            className="w-full text-xs"
                            data-testid="input-driving-license-file"
                          />
                          {drivingLicenseFile && (
                            <span className="mt-1 inline-block text-[11px] text-gray-500">
                              {drivingLicenseFile.name}
                            </span>
                          )}
                        </label>
                      </div>
                    </div>
                  )}

                  {hasProviderType('driver') && (
                    <div className="space-y-3 mb-6 p-4 bg-[#D4AF37] dark:bg-white rounded-lg border border-[#D4AF37] dark:border-[#B8932F]">
                      <h4 className="font-semibold text-[#B8932F] dark:text-[#D4AF37] flex items-center gap-2">
                        <Car className="w-4 h-4" aria-hidden="true" />
                        {isHebrew ? 'הצהרות נהג (PetTrek)' : 'Driver Declarations (PetTrek)'}
                      </h4>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationValidLicense} onCheckedChange={(checked) => setDeclarationValidLicense(!!checked)} className="mt-1" data-testid="checkbox-valid-license" />
                        <span className="text-sm">{isHebrew ? 'יש לי רישיון נהיגה ישראלי בתוקף' : 'I have a valid Israeli driving license'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationNoSuspension} onCheckedChange={(checked) => setDeclarationNoSuspension(!!checked)} className="mt-1" data-testid="checkbox-no-suspension" />
                        <span className="text-sm">{isHebrew ? 'רישיון הנהיגה שלי לא נשלל ולא מותלה' : 'My driving license has not been suspended or revoked'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationUnderPointsLimit} onCheckedChange={(checked) => setDeclarationUnderPointsLimit(!!checked)} className="mt-1" data-testid="checkbox-points-limit" />
                        <span className="text-sm">{isHebrew ? 'יש לי פחות מ-12 נקודות ברישיון (לפי חוק)' : 'I have less than 12 points on my license (as per law)'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationNoDrugsAlcohol} onCheckedChange={(checked) => setDeclarationNoDrugsAlcohol(!!checked)} className="mt-1" data-testid="checkbox-no-drugs" />
                        <span className="text-sm">{isHebrew ? 'אני מתחייב לא לנהוג תחת השפעת סמים או אלכוהול' : 'I commit to never drive under influence of drugs or alcohol'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationValidVehicleInsurance} onCheckedChange={(checked) => setDeclarationValidVehicleInsurance(!!checked)} className="mt-1" data-testid="checkbox-vehicle-insurance" />
                        <span className="text-sm">{isHebrew ? 'יש לי ביטוח רכב תקף (ביטוח חובה + מקיף)' : 'I have valid vehicle insurance (mandatory + comprehensive)'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationVehicleInspection} onCheckedChange={(checked) => setDeclarationVehicleInspection(!!checked)} className="mt-1" data-testid="checkbox-vehicle-inspection" />
                        <span className="text-sm">{isHebrew ? 'לרכב שלי יש טסט שנתי בתוקף' : 'My vehicle has a valid annual inspection (טסט)'}</span>
                      </label>
                    </div>
                  )}

                  {/* Trainer Declarations (Academy) */}
                  {hasProviderType('trainer') && (
                    <div className="space-y-3 mb-6 p-4 bg-green-50 dark:bg-white rounded-lg border border-green-200 dark:border-green-800">
                      <h4 className="font-semibold text-green-900 dark:text-green-200 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" aria-hidden="true" />
                        {isHebrew ? 'הצהרות מאמן (Academy)' : 'Trainer Declarations (Academy)'}
                      </h4>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationTrainingCertification} onCheckedChange={(checked) => setDeclarationTrainingCertification(!!checked)} className="mt-1" data-testid="checkbox-training-cert" />
                        <span className="text-sm">{isHebrew ? 'יש לי תעודת אילוף כלבים מוכרת או ניסיון מוכח' : 'I have recognized pet training certification or proven experience'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationAccreditedCourses} onCheckedChange={(checked) => setDeclarationAccreditedCourses(!!checked)} className="mt-1" data-testid="checkbox-accredited-courses" />
                        <span className="text-sm">{isHebrew ? 'סיימתי קורסי אילוף מוסמכים' : 'I have completed accredited training courses'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationLiabilityInsurance} onCheckedChange={(checked) => setDeclarationLiabilityInsurance(!!checked)} className="mt-1" data-testid="checkbox-liability-insurance" />
                        <span className="text-sm">{isHebrew ? 'יש לי ביטוח אחריות מקצועית' : 'I carry professional liability insurance'}</span>
                      </label>
                    </div>
                  )}

                  {/* Sitter/Walker Declarations */}
                  {(hasProviderType('walker') || hasProviderType('sitter')) && (
                    <div className="space-y-3 mb-6 p-4 bg-[#D4AF37] dark:bg-[#B8932F]/20 rounded-lg border border-[#D4AF37] dark:border-[#B8932F]">
                      <h4 className="font-semibold text-[#B8932F] dark:text-[#D4AF37] flex items-center gap-2">
                        <Footprints className="w-4 h-4" aria-hidden="true" />
                        {isHebrew ? 'הצהרות שמרטף/מטייל' : 'Sitter/Walker Declarations'}
                      </h4>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationPhysicallyFit} onCheckedChange={(checked) => setDeclarationPhysicallyFit(!!checked)} className="mt-1" data-testid="checkbox-physically-fit" />
                        <span className="text-sm">{isHebrew ? 'אני כשיר/ה פיזית לטיפול בחיות מחמד' : 'I am physically fit to handle pets'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationAnimalExperience} onCheckedChange={(checked) => setDeclarationAnimalExperience(!!checked)} className="mt-1" data-testid="checkbox-animal-experience" />
                        <span className="text-sm">{isHebrew ? 'יש לי ניסיון בטיפול בחיות מחמד' : 'I have experience caring for animals'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationFirstAidTraining} onCheckedChange={(checked) => setDeclarationFirstAidTraining(!!checked)} className="mt-1" data-testid="checkbox-first-aid" />
                        <span className="text-sm">{isHebrew ? 'יש לי הכשרה בעזרה ראשונה לחיות מחמד (אופציונלי)' : 'I have pet first aid training (optional)'}</span>
                      </label>
                    </div>
                  )}

                  {/* Universal Declarations (All Roles) */}
                  <div className="space-y-3 p-4 bg-white dark:bg-white/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-black flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      {isHebrew ? 'הצהרות כלליות (חובה)' : 'General Declarations (Required)'}
                    </h4>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox checked={declarationAccurateInfo} onCheckedChange={(checked) => setDeclarationAccurateInfo(!!checked)} className="mt-1" data-testid="checkbox-accurate-info" />
                      <span className="text-sm">{isHebrew ? 'כל המידע שמסרתי נכון ומדויק' : 'All information I provided is true and accurate'}</span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox checked={declarationAcceptTerms} onCheckedChange={(checked) => setDeclarationAcceptTerms(!!checked)} className="mt-1" data-testid="checkbox-accept-terms" />
                      <span className="text-sm">{isHebrew ? 'אני מסכים/ה לתנאי השימוש ולהסכם קבלן עצמאי' : 'I agree to the Terms of Service and Independent Contractor Agreement'}</span>
                    </label>
                  </div>

                  {/* Israel-safe self-declaration (2026 spec). Mandatory.  */}
                  <div className="space-y-3 p-4 bg-[#D4AF37] dark:bg-[#B8932F]/20 rounded-lg border-2 border-[#D4AF37] dark:border-[#B8932F]">
                    <h4 className="font-semibold text-[#B8932F] dark:text-[#D4AF37] flex items-center gap-2">
                      <Shield className="w-4 h-4" aria-hidden="true" />
                      {declarationText.title}
                    </h4>
                    <p className="text-xs text-[#B8932F] dark:text-[#D4AF37]">
                      {declarationText.idRequiredNotice}
                    </p>
                    <p className="text-xs text-[#B8932F] dark:text-[#D4AF37]">
                      {declarationText.body}
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={selfDeclarationNoConvictions}
                        onCheckedChange={(checked) => setSelfDeclarationNoConvictions(!!checked)}
                        className="mt-1"
                        data-testid="checkbox-self-declaration-no-convictions"
                      />
                      <span className="text-sm text-[#B8932F] dark:text-[#D4AF37]">
                        {declarationText.checkboxLabel}
                      </span>
                    </label>

                    {/* Optional opt-in to high-risk service categories */}
                    <div className="mt-2 pt-3 border-t border-[#D4AF37] dark:border-[#B8932F]">
                      <p className="text-xs font-medium text-[#B8932F] dark:text-[#D4AF37] mb-2">
                        {isHebrew ? 'שירותים שאספק (סמן את כל הרלוונטיים):' : 'Services I will offer (tick all that apply):'}
                      </p>
                      {ENHANCED_VERIFICATION_REASONS.map((reason) => {
                        const checked = enhancedReasons.includes(reason);
                        const label = isHebrew ? ENHANCED_REASON_LABELS[reason].he : ENHANCED_REASON_LABELS[reason].en;
                        return (
                          <label key={reason} className="flex items-start gap-3 cursor-pointer mb-1">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                setEnhancedReasons((prev) =>
                                  c
                                    ? Array.from(new Set([...prev, reason]))
                                    : prev.filter((r) => r !== reason),
                                );
                              }}
                              className="mt-1"
                              data-testid={`checkbox-enhanced-${reason}`}
                            />
                            <span className="text-sm text-[#B8932F] dark:text-[#D4AF37]">{label}</span>
                          </label>
                        );
                      })}
                    </div>

                    {enhancedVerificationRequired && (
                      <div className="mt-2 p-2 rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-700">
                        <p className="text-xs text-amber-900 dark:text-amber-200 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
                          {declarationText.enhancedNotice}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Legal Notice - Israeli Law Compliance */}
                  <div className="mt-4 p-3 bg-white dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      <strong>{isHebrew ? 'הערה משפטית: ' : 'Legal Notice: '}</strong>
                      {isHebrew
                        ? 'בהתאם לחוק הגנת הפרטיות בישראל, איננו מבקשים מידע על עבר פלילי באופן ישיר. במקום זאת, אנו מסתמכים על הצהרות עצמיות ואימות מסמכים ידני. לפי סעיף 2 לחוק המרשם הפלילי, אין לדרוש גילוי מידע על הרשעות שנמחקו.'
                        : 'In accordance with Israeli Privacy Protection Law, we do not directly request criminal record information. Instead, we rely on self-declarations and manual document verification. Per Section 2 of the Criminal Registry Law, disclosure of expunged convictions cannot be required.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Residential History (10 years) - REQUIRED */}
                  <div>
                    <Label className="text-lg font-semibold">
                      {t.residentialHistory}
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <p className="text-sm text-gray-500 mb-3">{t.residentialHistoryHelp}</p>
                    
                    {residentialHistory.map((address, index) => (
                      <div key={index} className="mb-2">
                        <Input
                          value={address}
                          onChange={(e) => {
                            const newHistory = [...residentialHistory];
                            newHistory[index] = e.target.value;
                            setResidentialHistory(newHistory);
                          }}
                          placeholder={isHebrew 
                            ? `כתובת ${index + 1}: לדוגמה - תל אביב, ישראל (2018-2023)`
                            : `Address ${index + 1}: e.g. Tel Aviv, Israel (2018-2023)`
                          }
                          className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                          data-testid={`input-address-${index}`}
                        />
                      </div>
                    ))}
                    {residentialHistory.filter(a => a.trim()).length === 0 && (
                      <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        {isHebrew ? 'נדרשת לפחות כתובת מגורים אחת כדי להמשיך' : 'At least one address is required to continue'}
                      </p>
                    )}
                    
                    <Button
                      onClick={() => setResidentialHistory([...residentialHistory, ''])}
                      className="luxury-btn-secondary text-sm px-4 py-2 mt-2"
                      data-testid="button-add-address"
                    >
                      {t.addAddress}
                    </Button>
                  </div>

                  {/* Consent Checkbox */}
                  <div className="luxury-glass-card luxury-shadow-md border-2 border-yellow-400/30 p-6">
                    <h3 className="luxury-heading-sm text-yellow-900 dark:text-yellow-200 mb-3">
                      {t.consentTitle}
                    </h3>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backgroundCheckConsent}
                        onChange={(e) => setBackgroundCheckConsent(e.target.checked)}
                        className="mt-1"
                        data-testid="checkbox-background-consent"
                      />
                      <span className="text-sm text-yellow-800 dark:text-yellow-300">
                        {t.consentText}
                      </span>
                    </label>
                  </div>
                </div>

                {/* CEO §73 #12 (2026-08-28): Bank / Payout target.
                    Optional at intake — Israeli payouts must have this
                    before the first booking releases, but the applicant
                    can also fill it in via the dashboard's payout
                    settings later. Server persists via the
                    migration-window post-INSERT UPDATE (see
                    server/routes/provider-onboarding.ts). IBAN is
                    normalised on submit (strip whitespace, uppercase). */}
                <div className="luxury-glass-card luxury-shadow-md p-6" data-testid="section-bank-payout">
                  <h3 className="luxury-heading-sm mb-4" style={{ color: '#063B22' }}>
                    {isHebrew ? 'פרטי חשבון בנק לתשלום' : 'Bank / Payout details'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {isHebrew
                      ? 'לצורך העברת תשלומי הזמנות. אפשר להוסיף גם מאוחר יותר בהגדרות התשלום.'
                      : 'Where PetWash sends your booking payouts. Optional now — you can also add it later from your payout settings.'}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="block text-xs font-semibold mb-1">
                        {isHebrew ? 'שם הבנק' : 'Bank name'}
                      </span>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        onBlur={scheduleDraftSave}
                        placeholder={isHebrew ? 'בנק הפועלים' : 'e.g. Bank Hapoalim'}
                        className="w-full rounded-xl border border-[#ECE6D8] bg-white px-4 py-3 text-sm outline-none focus:border-[#D6B56D]"
                        data-testid="input-bank-name"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-semibold mb-1">
                        {isHebrew ? 'קוד סניף' : 'Branch code'}
                      </span>
                      <input
                        type="text"
                        value={bankBranchCode}
                        onChange={(e) => setBankBranchCode(e.target.value)}
                        onBlur={scheduleDraftSave}
                        placeholder={isHebrew ? 'למשל 604' : 'e.g. 604'}
                        className="w-full rounded-xl border border-[#ECE6D8] bg-white px-4 py-3 text-sm outline-none focus:border-[#D6B56D]"
                        data-testid="input-bank-branch"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="block text-xs font-semibold mb-1">IBAN</span>
                      <input
                        type="text"
                        dir="ltr"
                        value={bankIban}
                        onChange={(e) => setBankIban(e.target.value)}
                        onBlur={scheduleDraftSave}
                        placeholder="IL62 0080 4000 0000 1234 567"
                        className="w-full rounded-xl border border-[#ECE6D8] bg-white px-4 py-3 text-sm font-mono outline-none focus:border-[#D6B56D]"
                        data-testid="input-bank-iban"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="block text-xs font-semibold mb-1">
                        {isHebrew ? 'שם בעל החשבון' : 'Account holder name'}
                      </span>
                      <input
                        type="text"
                        value={bankAccountHolder}
                        onChange={(e) => setBankAccountHolder(e.target.value)}
                        onBlur={scheduleDraftSave}
                        placeholder={isHebrew ? 'כפי שמופיע במסמכי הבנק' : 'Exactly as on the bank record'}
                        className="w-full rounded-xl border border-[#ECE6D8] bg-white px-4 py-3 text-sm outline-none focus:border-[#D6B56D]"
                        data-testid="input-bank-holder"
                      />
                    </label>
                  </div>
                </div>

                {/* Live "missing requirements" checklist so users know EXACTLY why
                    the submit button is disabled — CEO 2026-08-24 fix: "declarations
                    all not as said go". Previously the button just sat greyed-out
                    with no signal about which checkbox was still missing. */}
                {(() => {
                  const missing: string[] = [];
                  if (residentialHistory.filter(a => a.trim()).length === 0) {
                    missing.push(isHebrew ? 'לפחות כתובת מגורים אחת' : 'At least one residential address');
                  }
                  if (!backgroundCheckConsent) {
                    missing.push(isHebrew ? 'הסכמה לבדיקת רקע' : 'Background-check consent');
                  }
                  if (!declarationAccurateInfo) {
                    missing.push(isHebrew ? 'הצהרה שהמידע נכון ומדויק' : 'Declaration that information is accurate');
                  }
                  if (!declarationAcceptTerms) {
                    missing.push(isHebrew ? 'הסכמה לתנאי השימוש והסכם קבלן' : 'Terms of Service + Contractor Agreement');
                  }
                  if (!selfDeclarationNoConvictions) {
                    missing.push(isHebrew ? 'הצהרה עצמית — ללא הרשעות רלוונטיות' : 'Self-declaration (no relevant convictions)');
                  }
                  if (hasProviderType('driver')) {
                    if (!declarationValidLicense)          missing.push(isHebrew ? 'רישיון נהיגה בתוקף (נהג)' : 'Valid driving license (driver)');
                    if (!declarationNoSuspension)          missing.push(isHebrew ? 'רישיון לא נשלל (נהג)' : 'License not suspended (driver)');
                    if (!declarationUnderPointsLimit)      missing.push(isHebrew ? 'מתחת ל-12 נקודות (נהג)' : 'Under 12 points on license (driver)');
                    if (!declarationNoDrugsAlcohol)        missing.push(isHebrew ? 'התחייבות ללא סמים/אלכוהול (נהג)' : 'No-drugs/alcohol commitment (driver)');
                    if (!declarationValidVehicleInsurance) missing.push(isHebrew ? 'ביטוח רכב בתוקף (נהג)' : 'Valid vehicle insurance (driver)');
                    if (!declarationVehicleInspection)     missing.push(isHebrew ? 'טסט שנתי בתוקף (נהג)' : 'Valid annual inspection (driver)');
                  }
                  if (hasProviderType('trainer')) {
                    if (!declarationTrainingCertification) missing.push(isHebrew ? 'תעודת/ניסיון אילוף (מאמן)' : 'Training certification/experience (trainer)');
                    if (!declarationAccreditedCourses)     missing.push(isHebrew ? 'קורסים מוסמכים (מאמן)' : 'Accredited courses completed (trainer)');
                    if (!declarationLiabilityInsurance)    missing.push(isHebrew ? 'ביטוח אחריות מקצועית (מאמן)' : 'Professional liability insurance (trainer)');
                  }
                  if (hasProviderType('walker') || hasProviderType('sitter')) {
                    if (!declarationPhysicallyFit)         missing.push(isHebrew ? 'כשירות פיזית (שמרטף/מטייל)' : 'Physically fit (walker/sitter)');
                    if (!declarationAnimalExperience)      missing.push(isHebrew ? 'ניסיון עם חיות מחמד (שמרטף/מטייל)' : 'Experience with pets (walker/sitter)');
                  }
                  if (missing.length === 0) return null;
                  return (
                    <div className="my-4 p-4 rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-900/20">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-200" />
                        <strong className="text-amber-900 dark:text-amber-100 text-sm">
                          {isHebrew ? 'עדיין חסרים כדי להגיש:' : 'Still needed before you can submit:'}
                        </strong>
                      </div>
                      <ul className="list-disc ml-6 space-y-1 text-xs text-amber-900 dark:text-amber-100">
                        {missing.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    </div>
                  );
                })()}

                <div className="flex gap-4">
                  <Button onClick={() => setStep(2)} className="luxury-btn-secondary" data-testid="button-back-step2">
                    {t.back}
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="luxury-btn-primary luxury-shadow-xl flex-1"
                    disabled={
                      loading ||
                      !backgroundCheckConsent ||
                      !declarationAccurateInfo ||
                      !declarationAcceptTerms ||
                      !selfDeclarationNoConvictions ||
                      residentialHistory.filter(addr => addr.trim()).length === 0 ||
                      // Driver-specific declarations (PetTrek)
                      (hasProviderType('driver') && (
                        !declarationValidLicense ||
                        !declarationNoSuspension ||
                        !declarationUnderPointsLimit ||
                        !declarationNoDrugsAlcohol ||
                        !declarationValidVehicleInsurance ||
                        !declarationVehicleInspection
                      )) ||
                      // Trainer-specific declarations (Academy)
                      (hasProviderType('trainer') && (
                        !declarationTrainingCertification ||
                        !declarationAccreditedCourses ||
                        !declarationLiabilityInsurance
                      )) ||
                      // Sitter/Walker-specific declarations
                      ((hasProviderType('walker') || hasProviderType('sitter')) && (
                        !declarationPhysicallyFit ||
                        !declarationAnimalExperience
                      ))
                    }
                    data-testid="button-submit-application"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2 inline" />
                        {t.submitting}
                      </>
                    ) : (
                      t.submit
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
