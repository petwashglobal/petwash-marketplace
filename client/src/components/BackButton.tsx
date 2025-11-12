import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import type { Language } from "@/lib/i18n";

interface BackButtonProps {
  language: Language;
  className?: string;
}

export function BackButton({ language, className = "" }: BackButtonProps) {
  const [, navigate] = useLocation();
  
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/');
    }
  };

  return (
    <button
      onClick={handleBack}
      aria-label={language === 'he' ? 'חזור' : 'Back'}
      className={`back-btn flex items-center gap-1 text-gray-700 hover:text-blue-600 transition-colors ${className}`}
      data-testid="button-back"
    >
      <ChevronLeft className="w-5 h-5" />
      <span className="text-sm font-medium hidden sm:inline">
        {language === 'he' ? 'חזור' : 'Back'}
      </span>
    </button>
  );
}
