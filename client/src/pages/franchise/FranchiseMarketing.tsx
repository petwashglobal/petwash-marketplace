import { useLanguage } from '@/lib/languageStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileImage, FileVideo } from 'lucide-react';

export default function FranchiseMarketing() {
  const { language, dir } = useLanguage();

  return (
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-3">
            {language === 'he' ? 'חומרי שיווק' : 'Marketing Materials'}
          </h1>
          <p className="luxury-text-body">
            {language === 'he' ? 'גישה לחומרי מיתוג ושיווק של ⁦PetWash™⁩' : 'Access to ⁦PetWash™⁩ branding and marketing materials'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-1">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <FileImage className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="luxury-heading-md">
                  {language === 'he' ? 'תמונות ולוגואים' : 'Images & Logos'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="luxury-text-body text-center py-8">
                {language === 'he' ? 'בקרוב' : 'Coming Soon'}
              </p>
            </CardContent>
          </div>

          <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-2">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <FileVideo className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="luxury-heading-md">
                  {language === 'he' ? 'סרטוני שיווק' : 'Marketing Videos'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="luxury-text-body text-center py-8">
                {language === 'he' ? 'בקרוב' : 'Coming Soon'}
              </p>
            </CardContent>
          </div>

          <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-3">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Download className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="luxury-heading-md">
                  {language === 'he' ? 'קבצי עיצוב' : 'Design Files'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="luxury-text-body text-center py-8">
                {language === 'he' ? 'בקרוב' : 'Coming Soon'}
              </p>
            </CardContent>
          </div>
        </div>
      </div>
    </div>
  );
}
