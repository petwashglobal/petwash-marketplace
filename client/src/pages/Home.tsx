import Landing from './Landing';
import type { Language } from '@/lib/i18n';

interface HomeProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
}

export default function Home({ language, onLanguageChange }: HomeProps) {
  // Home page just renders the Landing page for authenticated users
  // Firebase auth is handled globally by AuthProvider
  return <Landing language={language} onLanguageChange={onLanguageChange} />;
}
