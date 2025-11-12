import { useLanguage } from '@/lib/languageStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileImage, FileVideo } from 'lucide-react';

export default function FranchiseMarketing() {
  const { language, dir } = useLanguage();

  return (
    <div className="min-h-screen bg-white p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {language === 'he' ? 'חומרי שיווק' : 'Marketing Materials'}
          </h1>
          <p className="text-gray-600">
            {language === 'he' ? 'גישה לחומרי מיתוג ושיווק של PetWash™' : 'Access to PetWash™ branding and marketing materials'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{language === 'he' ? 'חומרים זמינים' : 'Available Materials'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-center py-8">
              {language === 'he' ? 'חומרי שיווק יהיו זמינים בקרוב' : 'Marketing materials coming soon'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
