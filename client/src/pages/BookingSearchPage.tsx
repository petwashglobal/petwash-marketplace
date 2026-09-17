import { useTranslation } from 'react-i18next';
import BookingSearch from '@/components/booking/BookingSearch';
import { useSEO } from '@/lib/seo';

export default function BookingSearchPage() {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';

  // useSEO, not react-helmet-async: the app has no HelmetProvider, so <Helmet>
  // crashed this page for every visitor (live 2026-09-17, "reading 'add'").
  useSEO({
    title: isHebrew ? 'חפש שירותי חיות מחמד | ⁦PetWash™⁩' : 'Find Pet Services | ⁦PetWash™⁩',
    description: isHebrew
      ? 'מצא שומרי חיות מחמד, מטיילי כלבים, מטפחים ועוד באזור שלך. חיפוש לפי סוג חיה, מיקום, תאריך ומחיר.'
      : 'Find pet sitters, dog walkers, groomers and more in your area. Search by pet type, location, date and price.',
  });

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 pt-20 pb-12">
      <BookingSearch />
    </div>
  );
}
