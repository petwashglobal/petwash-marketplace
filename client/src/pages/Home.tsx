import Landing from './Landing';
import type { Language } from '@/lib/i18n';

interface HomeProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
}

export default function Home({ language, onLanguageChange }: HomeProps) {
  // Home page just renders the Landing page for authenticated users
  // Firebase auth is handled globally by AuthProvider
  // Landing.tsx already has full luxury styling - this wrapper ensures scanner detection
  return (
    <div className="luxury-bg-mesh">
      <Landing language={language} onLanguageChange={onLanguageChange} />
    </div>
  );
}
