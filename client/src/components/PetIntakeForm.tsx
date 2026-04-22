import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, AlertTriangle, FileText, PawPrint, Heart, Syringe, Phone } from 'lucide-react';

interface PetIntakeFormProps {
  open: boolean;
  onClose: () => void;
  onComplete: (submissionId: string) => void;
  petName: string;
  petSpecies?: string;
  bookingId?: string;
  language?: 'he' | 'en';
}

interface IntakeFormData {
  // Health status
  isHealthy: boolean;
  hasCurrentVaccinations: boolean;
  lastVaccinationDate: string;
  rabiesVaccineDate: string;
  hasKennelCoughVaccine: boolean;
  hasFleasOrTicks: boolean;
  hasRecentIllness: boolean;
  recentIllnessDetails: string;
  // Medical
  knownAllergies: string;
  currentMedications: string;
  chronicConditions: string;
  // Behavior
  isAggressive: boolean;
  aggressionDetails: string;
  isAnxious: boolean;
  isSeparationAnxious: boolean;
  specialNeeds: string;
  // Vet
  vetName: string;
  vetPhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  // Consent
  consentToTreatment: boolean;
  consentToEmergencyVet: boolean;
  consentToPhotos: boolean;
  signatureName: string;
}

const defaultForm: IntakeFormData = {
  isHealthy: true,
  hasCurrentVaccinations: true,
  lastVaccinationDate: '',
  rabiesVaccineDate: '',
  hasKennelCoughVaccine: false,
  hasFleasOrTicks: false,
  hasRecentIllness: false,
  recentIllnessDetails: '',
  knownAllergies: '',
  currentMedications: '',
  chronicConditions: '',
  isAggressive: false,
  aggressionDetails: '',
  isAnxious: false,
  isSeparationAnxious: false,
  specialNeeds: '',
  vetName: '',
  vetPhone: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  consentToTreatment: false,
  consentToEmergencyVet: false,
  consentToPhotos: true,
  signatureName: '',
};

export function PetIntakeForm({ open, onClose, onComplete, petName, petSpecies, bookingId, language = 'he' }: PetIntakeFormProps) {
  const { toast } = useToast();
  const isHebrew = language === 'he';
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<IntakeFormData>(defaultForm);
  const totalSteps = 4;

  const set = (field: keyof IntakeFormData, value: any) => setForm(f => ({ ...f, [field]: value }));

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/pets/intake-form', {
        ...form,
        petName,
        petSpecies,
        bookingId,
        submittedAt: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: isHebrew ? '✅ הטופס הוגש בהצלחה!' : '✅ Form submitted successfully!',
        description: isHebrew ? 'הצהרת הבריאות נשמרה בתיק הדיגיטלי' : 'Health declaration saved to digital file',
      });
      onComplete(data.submissionId || 'intake-' + Date.now());
    },
    onError: () => {
      toast({
        title: isHebrew ? 'שגיאה בהגשה' : 'Submission failed',
        variant: 'destructive',
      });
    },
  });

  const canProceed = () => {
    if (step === 4) {
      return form.consentToTreatment && form.consentToEmergencyVet && form.signatureName.trim().length > 2;
    }
    return true;
  };

  const stepTitle = [
    isHebrew ? '🐾 מצב בריאותי' : '🐾 Health Status',
    isHebrew ? '💉 חיסונים ורפואה' : '💉 Vaccinations & Medical',
    isHebrew ? '🧠 התנהגות וצרכים' : '🧠 Behavior & Needs',
    isHebrew ? '✍️ הסכמה וחתימה' : '✍️ Consent & Signature',
  ][step - 1];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <PawPrint className="w-5 h-5" />
            {isHebrew ? `טופס קבלה — ${petName}` : `Intake Form — ${petName}`}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            {isHebrew
              ? 'הצהרת בריאות חובה לפני קבלת שירות. יש להשלים את כל הסעיפים בכנות.'
              : 'Required health declaration before service. Please complete all sections honestly.'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex gap-1.5 mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i < step ? 'bg-black' : 'bg-white'}`} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-4">{isHebrew ? `שלב ${step} מתוך ${totalSteps}` : `Step ${step} of ${totalSteps}`} — <span className="font-semibold text-gray-700">{stepTitle}</span></p>

        {/* ── Step 1: Health status ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white">
              <Label className="text-sm font-medium">{isHebrew ? `${petName} בריא/ה כרגע` : `${petName} is currently healthy`}</Label>
              <Switch checked={form.isHealthy} onCheckedChange={v => set('isHealthy', v)} />
            </div>
            {!form.isHealthy && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                <p className="text-xs text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {isHebrew ? 'חיות מחמד חולות אינן מתקבלות לשירות ללא אישור וטרינר.' : 'Sick pets are not accepted for service without vet clearance.'}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white">
              <Label className="text-sm font-medium">{isHebrew ? 'פרעושים / קרציות' : 'Fleas / Ticks detected'}</Label>
              <Switch checked={form.hasFleasOrTicks} onCheckedChange={v => set('hasFleasOrTicks', v)} />
            </div>
            {form.hasFleasOrTicks && (
              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 text-xs">
                {isHebrew ? '⚠️ נדרש טיפול בפרעושים לפני השירות' : '⚠️ Flea/tick treatment required before service'}
              </Badge>
            )}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white">
              <Label className="text-sm font-medium">{isHebrew ? 'מחלה לאחרונה (30 יום)' : 'Recent illness (last 30 days)'}</Label>
              <Switch checked={form.hasRecentIllness} onCheckedChange={v => set('hasRecentIllness', v)} />
            </div>
            {form.hasRecentIllness && (
              <Textarea
                value={form.recentIllnessDetails}
                onChange={e => set('recentIllnessDetails', e.target.value)}
                placeholder={isHebrew ? 'פרט את המחלה, תאריך, ואם קיבל/ה טיפול...' : 'Describe illness, date, whether treated...'}
                className="text-sm"
                rows={2}
              />
            )}
          </div>
        )}

        {/* ── Step 2: Vaccinations & Medical ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white">
              <Label className="text-sm font-medium">{isHebrew ? 'חיסונים בתוקף' : 'Vaccinations up to date'}</Label>
              <Switch checked={form.hasCurrentVaccinations} onCheckedChange={v => set('hasCurrentVaccinations', v)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{isHebrew ? 'תאריך חיסון אחרון' : 'Last vaccination date'}</Label>
              <Input type="date" value={form.lastVaccinationDate} onChange={e => set('lastVaccinationDate', e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{isHebrew ? 'תאריך חיסון כלבת (קנין / חתולים)' : 'Rabies vaccine date (dogs/cats)'}</Label>
              <Input type="date" value={form.rabiesVaccineDate} onChange={e => set('rabiesVaccineDate', e.target.value)} className="text-sm" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white">
              <Label className="text-sm font-medium">{isHebrew ? 'חיסון שיעול הכלבות (Bordetella)' : 'Kennel cough (Bordetella) vaccine'}</Label>
              <Switch checked={form.hasKennelCoughVaccine} onCheckedChange={v => set('hasKennelCoughVaccine', v)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-400" />{isHebrew ? 'אלרגיות ידועות' : 'Known allergies'}</Label>
              <Input value={form.knownAllergies} onChange={e => set('knownAllergies', e.target.value)} placeholder={isHebrew ? 'למשל: ניקל, שמפו, אבק...' : 'e.g. nickel, shampoo, dust...'} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{isHebrew ? 'תרופות נוכחיות' : 'Current medications'}</Label>
              <Textarea value={form.currentMedications} onChange={e => set('currentMedications', e.target.value)} placeholder={isHebrew ? 'שם התרופה + מינון...' : 'Drug name + dosage...'} rows={2} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{isHebrew ? 'מצבים כרוניים' : 'Chronic conditions'}</Label>
              <Input value={form.chronicConditions} onChange={e => set('chronicConditions', e.target.value)} placeholder={isHebrew ? 'סוכרת, מחלת לב, קשיי שמיעה...' : 'Diabetes, heart condition, hearing loss...'} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{isHebrew ? 'שם הווטרינר' : 'Vet name'}</Label>
              <Input value={form.vetName} onChange={e => set('vetName', e.target.value)} placeholder={isHebrew ? 'ד"ר...' : 'Dr...'} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{isHebrew ? 'טלפון הווטרינר' : 'Vet phone'}</Label>
              <Input type="tel" value={form.vetPhone} onChange={e => set('vetPhone', e.target.value)} placeholder="050-000-0000" className="text-sm" />
            </div>
          </div>
        )}

        {/* ── Step 3: Behavior ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white">
              <Label className="text-sm font-medium">{isHebrew ? 'נוטה לתוקפנות' : 'Shows aggression'}</Label>
              <Switch checked={form.isAggressive} onCheckedChange={v => set('isAggressive', v)} />
            </div>
            {form.isAggressive && (
              <Textarea
                value={form.aggressionDetails}
                onChange={e => set('aggressionDetails', e.target.value)}
                placeholder={isHebrew ? 'כלפי מי? מתי? כיצד? (חשוב לבטיחות הצוות)' : 'Toward whom? When? How? (important for staff safety)'}
                rows={2}
                className="text-sm border-red-200"
              />
            )}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white">
              <Label className="text-sm font-medium">{isHebrew ? 'חרד/ה או לחוץ/ה בסביבה חדשה' : 'Anxious/stressed in new environments'}</Label>
              <Switch checked={form.isAnxious} onCheckedChange={v => set('isAnxious', v)} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white">
              <Label className="text-sm font-medium">{isHebrew ? 'חרדת פרידה' : 'Separation anxiety'}</Label>
              <Switch checked={form.isSeparationAnxious} onCheckedChange={v => set('isSeparationAnxious', v)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{isHebrew ? 'צרכים מיוחדים / הערות נוספות' : 'Special needs / additional notes'}</Label>
              <Textarea
                value={form.specialNeeds}
                onChange={e => set('specialNeeds', e.target.value)}
                placeholder={isHebrew ? 'מה חשוב שהצוות ידע על חיית המחמד שלך?' : 'What should our team know about your pet?'}
                rows={3}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{isHebrew ? 'איש קשר לחירום' : 'Emergency contact'}</Label>
              <Input value={form.emergencyContactName} onChange={e => set('emergencyContactName', e.target.value)} placeholder={isHebrew ? 'שם מלא' : 'Full name'} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{isHebrew ? 'טלפון לחירום' : 'Emergency phone'}</Label>
              <Input type="tel" value={form.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)} placeholder="050-000-0000" className="text-sm" />
            </div>
          </div>
        )}

        {/* ── Step 4: Consent & Signature ── */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-xl border border-gray-100 space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consentTreatment"
                  checked={form.consentToTreatment}
                  onChange={e => set('consentToTreatment', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-black"
                />
                <label htmlFor="consentTreatment" className="text-xs text-gray-700 leading-relaxed cursor-pointer">
                  {isHebrew
                    ? `אני מאשר/ת כי ${petName} במצב בריאותי טוב ומתאים לקבלת שירות. אני מרשה לצוות PetWash™ לטפל בחיית המחמד שלי בהתאם לתנאי השירות.`
                    : `I confirm that ${petName} is in good health and fit for service. I authorize the PetWash™ team to care for my pet in accordance with the service terms.`}
                </label>
              </div>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consentEmergency"
                  checked={form.consentToEmergencyVet}
                  onChange={e => set('consentToEmergencyVet', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-black"
                />
                <label htmlFor="consentEmergency" className="text-xs text-gray-700 leading-relaxed cursor-pointer">
                  {isHebrew
                    ? 'במקרה חירום רפואי, אני מרשה ל-PetWash™ לפנות לטיפול וטרינרי דחוף. אני אישית אחראי/ת לעלויות הטיפול.'
                    : 'In a medical emergency, I authorize PetWash™ to seek urgent veterinary care. I am personally responsible for the cost of treatment.'}
                </label>
              </div>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consentPhotos"
                  checked={form.consentToPhotos}
                  onChange={e => set('consentToPhotos', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-black"
                />
                <label htmlFor="consentPhotos" className="text-xs text-gray-700 leading-relaxed cursor-pointer">
                  {isHebrew
                    ? 'אני מסכים/ה שתצולמנה תמונות ווידאו של חיית המחמד שלי לצורכי שיתוף ושיווק (ניתן לביטול בכל עת).'
                    : 'I agree that photos/videos of my pet may be taken for sharing and marketing purposes (revocable anytime).'}
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {isHebrew ? 'חתימה דיגיטלית — הקלד שמך המלא' : 'Digital Signature — Type your full name'}
              </Label>
              <Input
                value={form.signatureName}
                onChange={e => set('signatureName', e.target.value)}
                placeholder={isHebrew ? 'שם מלא...' : 'Full name...'}
                className="text-base font-semibold"
                style={{ fontFamily: 'cursive', fontSize: 18 }}
              />
              <p className="text-[10px] text-gray-400">
                {isHebrew
                  ? 'הקלדת שמך מהווה חתימה דיגיטלית מחייבת בהתאם לחוק עסקאות אלקטרוניות תשסא-2001'
                  : 'Typing your name constitutes a binding digital signature per the Electronic Transactions Law 5761-2001'}
              </p>
            </div>

            {!form.consentToTreatment || !form.consentToEmergencyVet || form.signatureName.trim().length < 3 ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {isHebrew ? 'יש לאשר את כל ההסכמות ולחתום כדי להמשיך' : 'All consents and signature are required to proceed'}
              </div>
            ) : (
              <div className="p-3 bg-green-50 rounded-xl border border-green-100 text-xs text-green-700 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {isHebrew ? 'מוכן להגשה — לחץ "הגש טופס" להשלמה' : 'Ready to submit — click "Submit Form" to complete'}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-2 mt-6">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1 rounded-xl">
              {isHebrew ? 'חזור' : 'Back'}
            </Button>
          )}
          {step < totalSteps ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              style={{ background: '#000000' }}
              className="flex-1 text-white rounded-xl"
            >
              {isHebrew ? 'המשך' : 'Next'}
            </Button>
          ) : (
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={!canProceed() || submitMutation.isPending}
              style={{ background: canProceed() ? '#000000' : undefined }}
              className="flex-1 text-white rounded-xl"
            >
              {submitMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{isHebrew ? 'שולח...' : 'Submitting...'}</>
                : <><Heart className="w-4 h-4 mr-2" />{isHebrew ? 'הגש טופס' : 'Submit Form'}</>}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
