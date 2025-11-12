import { Layout } from '@/components/Layout';
import TrackMyPet from '@/components/TrackMyPet';
import { type Language } from '@/lib/i18n';

interface TrackMyPetLiveProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export default function TrackMyPetLive({ language, onLanguageChange }: TrackMyPetLiveProps) {
  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-pink-950/20">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <TrackMyPet />
        </div>
      </div>
    </Layout>
  );
}
