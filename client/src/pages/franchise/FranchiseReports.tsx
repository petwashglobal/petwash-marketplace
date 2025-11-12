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
    <div className="min-h-screen bg-white p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('reports.title', language)}
          </h1>
          <p className="text-gray-600">
            {t('reports.description', language)}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('reports.monthlyReport', language)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => handleDownload('excel', new Date().toISOString().slice(0, 7))}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {t('reports.downloadExcel', language)}
              </Button>
              <Button
                onClick={() => handleDownload('pdf', new Date().toISOString().slice(0, 7))}
                variant="outline"
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                {t('reports.downloadPDF', language)}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('reports.dailyReport', language)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => handleDownload('excel', new Date().toISOString().slice(0, 10))}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {t('reports.downloadExcel', language)}
              </Button>
              <Button
                onClick={() => handleDownload('pdf', new Date().toISOString().slice(0, 10))}
                variant="outline"
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                {t('reports.downloadPDF', language)}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
