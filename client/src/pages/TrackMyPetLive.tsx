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
      <div className="min-h-screen luxury-bg-mesh">
        <div className="luxury-container py-12">
          <div className="luxury-glass-card luxury-shadow-xl p-8 luxury-animate-scale-in">
            <TrackMyPet />
          </div>
        </div>
      </div>
    </Layout>
  );
}
