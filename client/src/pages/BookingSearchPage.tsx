import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import BookingSearch from '@/components/booking/BookingSearch';

export default function BookingSearchPage() {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';

  return (
    <>
      <Helmet>
        <title>{isHebrew ? 'חפש שירותי חיות מחמד | Pet Wash™' : 'Find Pet Services | Pet Wash™'}</title>
        <meta 
          name="description" 
          content={isHebrew 
            ? 'מצא שומרי חיות מחמד, מטיילי כלבים, מטפחים ועוד באזור שלך. חיפוש לפי סוג חיה, מיקום, תאריך ומחיר.'
            : 'Find pet sitters, dog walkers, groomers and more in your area. Search by pet type, location, date and price.'
          } 
        />
      </Helmet>
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pt-20 pb-12">
        <BookingSearch />
      </div>
    </>
  );
}
