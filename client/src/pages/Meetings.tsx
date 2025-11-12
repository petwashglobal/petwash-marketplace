import { Layout } from '@/components/Layout';
import { MeetingScheduler } from '@/components/MeetingScheduler';
import type { Language } from '@/lib/i18n';

interface MeetingsProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export default function Meetings({ language, onLanguageChange }: MeetingsProps) {
  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12">
        <MeetingScheduler language={language} />
      </div>
    </Layout>
  );
}
