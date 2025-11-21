import { useLanguage } from '@/lib/languageStore';
import { useFranchiseId } from '@/hooks/useFranchiseId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { trackFranchiseReportDownloaded } from '@/lib/analytics';
import { t } from '@/lib/i18n';

export default function FranchiseReports() {
  const { language, dir } = useLanguage();
  const { franchiseId } = useFranchiseId();

  const handleDownload = (type: 'excel' | 'pdf', period: string) => {
    if (!franchiseId) return;
    trackFranchiseReportDownloaded(franchiseId, type, period);
    window.open(`/api/franchise/reports/export/${type}?franchiseId=${franchiseId}&period=monthly&date=${period}`, '_blank');
  };

  return (
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-3">
            {t('reports.title', language)}
          </h1>
          <p className="luxury-text-body">
            {t('reports.description', language)}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-1">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="luxury-heading-md">{t('reports.monthlyReport', language)}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => handleDownload('excel', new Date().toISOString().slice(0, 7))}
                className="w-full luxury-btn-primary flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t('reports.downloadExcel', language)}
              </button>
              <button
                onClick={() => handleDownload('pdf', new Date().toISOString().slice(0, 7))}
                className="w-full luxury-btn-secondary flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {t('reports.downloadPDF', language)}
              </button>
            </CardContent>
          </div>

          <div className="luxury-glass-card shadow-lg luxury-animate-fade-in luxury-delay-2">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="luxury-heading-md">{t('reports.dailyReport', language)}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => handleDownload('excel', new Date().toISOString().slice(0, 10))}
                className="w-full luxury-btn-primary flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t('reports.downloadExcel', language)}
              </button>
              <button
                onClick={() => handleDownload('pdf', new Date().toISOString().slice(0, 10))}
                className="w-full luxury-btn-secondary flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {t('reports.downloadPDF', language)}
              </button>
            </CardContent>
          </div>
        </div>
      </div>
    </div>
  );
}
