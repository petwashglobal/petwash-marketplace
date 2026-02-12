import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Language } from '@/lib/i18n';
import { Mail, Phone, CheckCircle2, ArrowRight, ArrowLeft, Shield, Loader2, RefreshCw } from 'lucide-react';

interface OnboardingVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (tokens: { emailToken: string; smsToken: string; email: string; phone: string }) => void;
  language: Language;
  initialEmail?: string;
  initialPhone?: string;
  mode?: 'customer' | 'provider';
}

type Step = 'email_input' | 'email_code' | 'phone_input' | 'phone_code' | 'complete';

const texts = {
  he: {
    title: 'אימות חשבון',
    subtitle: 'אנא אמתו את האימייל ומספר הטלפון שלכם',
    emailStep: 'אימות אימייל',
    phoneStep: 'אימות טלפון',
    complete: 'אימות הושלם',
    enterEmail: 'הזינו כתובת אימייל',
    emailPlaceholder: 'your@email.com',
    sendEmailCode: 'שליחת קוד אימות',
    enterEmailCode: 'הזינו את הקוד שנשלח לאימייל שלכם',
    enterPhone: 'הזינו מספר טלפון',
    phonePlaceholder: '050-1234567',
    sendSmsCode: 'שליחת קוד SMS',
    enterSmsCode: 'הזינו את הקוד שנשלח ב-SMS',
    verify: 'אימות',
    resend: 'שליחה מחדש',
    resendIn: 'שליחה מחדש בעוד',
    seconds: 'שניות',
    emailVerified: 'אימייל אומת בהצלחה!',
    phoneVerified: 'טלפון אומת בהצלחה!',
    allVerified: 'כל האימותים הושלמו בהצלחה!',
    continue: 'המשך',
    back: 'חזרה',
    step: 'שלב',
    of: 'מתוך',
    securityNote: 'פרטיכם מוגנים בהצפנה מקצה לקצה',
    codeSentTo: 'קוד נשלח אל',
    codeExpiry: 'הקוד תקף ל-10 דקות',
  },
  en: {
    title: 'Account Verification',
    subtitle: 'Please verify your email and phone number',
    emailStep: 'Email Verification',
    phoneStep: 'Phone Verification',
    complete: 'Verification Complete',
    enterEmail: 'Enter your email address',
    emailPlaceholder: 'your@email.com',
    sendEmailCode: 'Send Verification Code',
    enterEmailCode: 'Enter the code sent to your email',
    enterPhone: 'Enter your phone number',
    phonePlaceholder: '050-1234567',
    sendSmsCode: 'Send SMS Code',
    enterSmsCode: 'Enter the code sent via SMS',
    verify: 'Verify',
    resend: 'Resend Code',
    resendIn: 'Resend in',
    seconds: 'seconds',
    emailVerified: 'Email verified successfully!',
    phoneVerified: 'Phone verified successfully!',
    allVerified: 'All verifications completed successfully!',
    continue: 'Continue',
    back: 'Back',
    step: 'Step',
    of: 'of',
    securityNote: 'Your details are protected with end-to-end encryption',
    codeSentTo: 'Code sent to',
    codeExpiry: 'Code valid for 10 minutes',
  },
};

function getTexts(language: Language) {
  if (language === 'he' || language === 'ar') return texts.he;
  return texts.en;
}

export function OnboardingVerification({
  isOpen,
  onClose,
  onVerified,
  language,
  initialEmail = '',
  initialPhone = '',
  mode = 'customer',
}: OnboardingVerificationProps) {
  const { toast } = useToast();
  const isRTL = language === 'he' || language === 'ar';
  const t = getTexts(language);

  const [step, setStep] = useState<Step>('email_input');
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [emailCode, setEmailCode] = useState(['', '', '', '', '', '']);
  const [smsCode, setSmsCode] = useState(['', '', '', '', '', '']);
  const [emailToken, setEmailToken] = useState('');
  const [smsToken, setSmsToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const emailInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const smsInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
    if (initialPhone) setPhone(initialPhone);
  }, [initialEmail, initialPhone]);

  const handleCodeInput = useCallback((
    value: string,
    index: number,
    codes: string[],
    setCodes: (c: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (!/^\d*$/.test(value)) return;
    const newCodes = [...codes];
    newCodes[index] = value.slice(-1);
    setCodes(newCodes);

    if (value && index < 5) {
      refs.current[index + 1]?.focus();
    }
  }, []);

  const handleCodeKeyDown = useCallback((
    e: React.KeyboardEvent,
    index: number,
    codes: string[],
    setCodes: (c: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === 'Backspace' && !codes[index] && index > 0) {
      const newCodes = [...codes];
      newCodes[index - 1] = '';
      setCodes(newCodes);
      refs.current[index - 1]?.focus();
    }
  }, []);

  const handleCodePaste = useCallback((
    e: React.ClipboardEvent,
    setCodes: (c: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCodes(pasted.split(''));
      refs.current[5]?.focus();
    }
  }, []);

  const sendEmailCode = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: isRTL ? 'אנא הזינו אימייל תקין' : 'Please enter a valid email', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/onboarding-verification/send-email-code', { email, language });
      const data = await res.json();
      if (data.success) {
        setStep('email_code');
        setCountdown(60);
        toast({ title: data.message });
      } else {
        toast({ title: data.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: isRTL ? 'שגיאה בשליחת קוד' : 'Failed to send code', variant: 'destructive' });
    }
    setLoading(false);
  };

  const verifyEmailCode = async () => {
    const code = emailCode.join('');
    if (code.length !== 6) {
      toast({ title: isRTL ? 'אנא הזינו קוד בן 6 ספרות' : 'Please enter 6-digit code', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/onboarding-verification/verify-email-code', { email, code, language });
      const data = await res.json();
      if (data.success) {
        setEmailToken(data.verificationToken);
        setStep('phone_input');
        toast({ title: t.emailVerified });
      } else {
        toast({ title: data.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: isRTL ? 'שגיאה באימות' : 'Verification failed', variant: 'destructive' });
    }
    setLoading(false);
  };

  const sendSmsCode = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      toast({ title: isRTL ? 'אנא הזינו מספר טלפון תקין' : 'Please enter a valid phone number', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/onboarding-verification/send-sms-code', { phone, language });
      const data = await res.json();
      if (data.success) {
        setStep('phone_code');
        setCountdown(60);
        toast({ title: data.message });
      } else {
        toast({ title: data.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: isRTL ? 'שגיאה בשליחת SMS' : 'Failed to send SMS', variant: 'destructive' });
    }
    setLoading(false);
  };

  const verifySmsCode = async () => {
    const code = smsCode.join('');
    if (code.length !== 6) {
      toast({ title: isRTL ? 'אנא הזינו קוד בן 6 ספרות' : 'Please enter 6-digit code', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/onboarding-verification/verify-sms-code', { phone, code, language });
      const data = await res.json();
      if (data.success) {
        setSmsToken(data.verificationToken);
        setStep('complete');
        toast({ title: t.phoneVerified });
      } else {
        toast({ title: data.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: isRTL ? 'שגיאה באימות' : 'Verification failed', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleComplete = () => {
    onVerified({ emailToken, smsToken, email, phone });
  };

  const stepNumber = step === 'email_input' || step === 'email_code' ? 1 : step === 'phone_input' || step === 'phone_code' ? 2 : 3;
  const totalSteps = 3;

  const renderCodeInputs = (
    codes: string[],
    setCodes: (c: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => (
    <div className="flex gap-2 sm:gap-3 justify-center" dir="ltr">
      {codes.map((digit, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={e => handleCodeInput(e.target.value, i, codes, setCodes, refs)}
          onKeyDown={e => handleCodeKeyDown(e, i, codes, setCodes, refs)}
          onPaste={e => handleCodePaste(e, setCodes, refs)}
          className="w-11 h-14 sm:w-13 sm:h-16 text-center text-2xl font-bold border-2 rounded-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all duration-200"
          style={{
            borderColor: digit ? '#1a1a1a' : '#d1d5db',
            background: digit ? '#f8f9fa' : '#ffffff',
            fontFamily: "'Courier New', monospace",
          }}
        />
      ))}
    </div>
  );

  const ProgressBar = () => (
    <div className="flex items-center gap-1 mb-8">
      {[1, 2, 3].map(s => (
        <div key={s} className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: s < stepNumber ? '100%' : s === stepNumber ? '50%' : '0%',
              background: s <= stepNumber ? 'linear-gradient(90deg, #1a1a1a, #c9a96e)' : '#e5e7eb',
            }}
          />
        </div>
      ))}
    </div>
  );

  const StepIndicator = ({ icon, label, verified }: { icon: any; label: string; verified: boolean }) => (
    <div className="flex items-center gap-3 mb-6">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{
          background: verified ? 'linear-gradient(135deg, #16a34a, #22c55e)' : 'linear-gradient(135deg, #1a1a1a, #374151)',
        }}
      >
        {verified ? <CheckCircle2 className="w-5 h-5 text-white" /> : icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-black">{label}</p>
        <p className="text-xs text-gray-500">{t.step} {stepNumber} {t.of} {totalSteps}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md mx-auto bg-white border-0 shadow-2xl overflow-hidden p-0"
        style={{ borderRadius: '2px', zIndex: 1000 }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="p-6 sm:p-8">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-2xl font-bold text-black" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {t.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-1">
              {t.subtitle}
            </DialogDescription>
          </DialogHeader>

          <ProgressBar />

          {step === 'email_input' && (
            <div className="space-y-5">
              <StepIndicator icon={<Mail className="w-5 h-5 text-white" />} label={t.emailStep} verified={false} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.enterEmail}</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="h-12 text-base border-2 focus:border-black"
                  style={{ borderRadius: '2px' }}
                  dir="ltr"
                />
              </div>
              <Button
                onClick={sendEmailCode}
                disabled={loading || !email}
                className="w-full h-12 text-base font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #1a1a1a, #374151)', borderRadius: '2px' }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <span className="flex items-center gap-2">
                    {t.sendEmailCode}
                    {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </span>
                )}
              </Button>
            </div>
          )}

          {step === 'email_code' && (
            <div className="space-y-5">
              <StepIndicator icon={<Mail className="w-5 h-5 text-white" />} label={t.emailStep} verified={false} />
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">{t.enterEmailCode}</p>
                <p className="text-xs text-gray-400">{t.codeSentTo} <strong dir="ltr">{email}</strong></p>
              </div>
              {renderCodeInputs(emailCode, setEmailCode, emailInputRefs)}
              <p className="text-xs text-center text-gray-400">{t.codeExpiry}</p>
              <Button
                onClick={verifyEmailCode}
                disabled={loading || emailCode.join('').length !== 6}
                className="w-full h-12 text-base font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #1a1a1a, #374151)', borderRadius: '2px' }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t.verify}
              </Button>
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-gray-400">{t.resendIn} {countdown} {t.seconds}</p>
                ) : (
                  <button
                    onClick={sendEmailCode}
                    className="text-sm text-black font-medium underline flex items-center gap-1 mx-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t.resend}
                  </button>
                )}
              </div>
              <button
                onClick={() => { setStep('email_input'); setEmailCode(['', '', '', '', '', '']); }}
                className="text-sm text-gray-500 underline flex items-center gap-1 mx-auto"
              >
                {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                {t.back}
              </button>
            </div>
          )}

          {step === 'phone_input' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-green-600">{t.emailVerified}</span>
              </div>
              <StepIndicator icon={<Phone className="w-5 h-5 text-white" />} label={t.phoneStep} verified={false} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.enterPhone}</label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={t.phonePlaceholder}
                  className="h-12 text-base border-2 focus:border-black"
                  style={{ borderRadius: '2px' }}
                  dir="ltr"
                />
              </div>
              <Button
                onClick={sendSmsCode}
                disabled={loading || !phone}
                className="w-full h-12 text-base font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #1a1a1a, #374151)', borderRadius: '2px' }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <span className="flex items-center gap-2">
                    {t.sendSmsCode}
                    {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </span>
                )}
              </Button>
            </div>
          )}

          {step === 'phone_code' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-green-600">{t.emailVerified}</span>
              </div>
              <StepIndicator icon={<Phone className="w-5 h-5 text-white" />} label={t.phoneStep} verified={false} />
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">{t.enterSmsCode}</p>
                <p className="text-xs text-gray-400">{t.codeSentTo} <strong dir="ltr">{phone}</strong></p>
              </div>
              {renderCodeInputs(smsCode, setSmsCode, smsInputRefs)}
              <p className="text-xs text-center text-gray-400">{t.codeExpiry}</p>
              <Button
                onClick={verifySmsCode}
                disabled={loading || smsCode.join('').length !== 6}
                className="w-full h-12 text-base font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #1a1a1a, #374151)', borderRadius: '2px' }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t.verify}
              </Button>
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-gray-400">{t.resendIn} {countdown} {t.seconds}</p>
                ) : (
                  <button
                    onClick={sendSmsCode}
                    className="text-sm text-black font-medium underline flex items-center gap-1 mx-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t.resend}
                  </button>
                )}
              </div>
              <button
                onClick={() => { setStep('phone_input'); setSmsCode(['', '', '', '', '', '']); }}
                className="text-sm text-gray-500 underline flex items-center gap-1 mx-auto"
              >
                {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                {t.back}
              </button>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-6 text-center py-4">
              <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-black mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {t.allVerified}
                </h3>
                <div className="flex flex-col gap-2 items-center mt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-600" dir="ltr">{email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-600" dir="ltr">{phone}</span>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleComplete}
                className="w-full h-12 text-base font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)', borderRadius: '2px' }}
              >
                <span className="flex items-center gap-2">
                  {t.continue}
                  {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </span>
              </Button>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-100">
            <Shield className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-[11px] text-gray-400">{t.securityNote}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
