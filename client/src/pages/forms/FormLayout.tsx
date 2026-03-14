import { Link } from 'wouter';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FormLayoutProps {
  title: string;
  titleHe: string;
  description: string;
  descriptionHe: string;
  icon: string;
  children: React.ReactNode;
  isRtl?: boolean;
}

export function FormLayout({ title, titleHe, description, descriptionHe, icon, children, isRtl }: FormLayoutProps) {
  const rtl = isRtl ?? (typeof window !== 'undefined' && document.documentElement.dir === 'rtl');
  return (
    <div className="min-h-screen bg-[#0a0a0a]" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#C6A35B]/20 bg-[#111] px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/forms">
            <Button variant="ghost" size="sm" className="text-[#C6A35B] hover:bg-[#C6A35B]/10 gap-1">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">All Forms</span>
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">{title}</h1>
              <p className="text-xs text-[#C6A35B]/70">{titleHe}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6 bg-[#1a1a1a] rounded-xl border border-[#C6A35B]/20 p-5">
          <p className="text-gray-300 text-sm leading-relaxed">{description}</p>
          <p className="text-[#C6A35B]/60 text-xs mt-1">{descriptionHe}</p>
        </div>
        {children}
      </div>

      <footer className="border-t border-[#C6A35B]/10 mt-12 py-6 px-4 text-center">
        <p className="text-xs text-gray-600">PetWash™ · <Link href="https://petwash.co.il" className="text-[#C6A35B]/50 hover:text-[#C6A35B]">petwash.co.il</Link></p>
      </footer>
    </div>
  );
}

interface FormSuccessProps {
  title: string;
  subtitle: string;
  detail: string;
  refId?: string;
  onReset: () => void;
}

export function FormSuccess({ title, subtitle, detail, refId, onReset }: FormSuccessProps) {
  return (
    <div className="text-center py-16">
      <CheckCircle2 className="h-16 w-16 text-[#C6A35B] mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-gray-300 mb-1">{subtitle}</p>
      {refId && <p className="text-xs text-[#C6A35B]/70 font-mono mb-2">Ref: {refId}</p>}
      <p className="text-sm text-gray-500 mb-8">{detail}</p>
      <Button onClick={onReset} variant="outline" className="border-[#C6A35B]/30 text-[#C6A35B] hover:bg-[#C6A35B]/10">
        Submit Another
      </Button>
    </div>
  );
}

interface FieldProps {
  label: string;
  labelHe?: string;
  required?: boolean;
  children: React.ReactNode;
}
export function Field({ label, labelHe, required, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-200">
        {label}
        {labelHe && <span className="text-[#C6A35B]/60 text-xs mr-1"> / {labelHe}</span>}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

export function FormSection({ title }: { title: string }) {
  return (
    <div className="col-span-full">
      <h3 className="text-sm font-semibold text-[#C6A35B] uppercase tracking-wider mb-1 mt-2 flex items-center gap-2">
        <span className="h-px flex-1 bg-[#C6A35B]/20" />
        {title}
        <span className="h-px flex-1 bg-[#C6A35B]/20" />
      </h3>
    </div>
  );
}

export const inputCls = "bg-[#1a1a1a] border-[#C6A35B]/20 text-white placeholder:text-gray-600 focus:border-[#C6A35B]/60 focus:ring-[#C6A35B]/20 h-10 px-3 rounded-lg w-full text-sm";
export const textareaCls = "bg-[#1a1a1a] border-[#C6A35B]/20 text-white placeholder:text-gray-600 focus:border-[#C6A35B]/60 focus:ring-[#C6A35B]/20 px-3 py-2 rounded-lg w-full text-sm resize-none";
export const selectCls = "bg-[#1a1a1a] border border-[#C6A35B]/20 text-white rounded-lg h-10 px-3 w-full text-sm focus:border-[#C6A35B]/60 focus:outline-none";

export function SubmitButton({ loading, label = 'Submit' }: { loading: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-gradient-to-r from-[#C6A35B] to-[#E7C978] hover:from-[#D4AF37] hover:to-[#C6A35B] text-black font-bold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? 'Submitting...' : label}
    </button>
  );
}
