import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/Layout";
import { type Language } from "@/lib/i18n";
import { useLanguage } from '@/lib/languageStore';
import { t as ti18n } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Book, Download, ArrowLeft, ExternalLink } from "lucide-react";
import { Link, useLocation } from "wouter";

interface AdminGuideProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export default function AdminGuide({ language, onLanguageChange }: AdminGuideProps) {
  const { language: currentLanguage } = useLanguage();
  const t = (key: string) => ti18n(key, currentLanguage);
  const [, setLocation] = useLocation();
  const [guideContent, setGuideContent] = useState<string>("");

  useEffect(() => {
    fetch('/docs/ADMIN_QUICK_START_GUIDE.md')
      .then(res => res.text())
      .then(content => setGuideContent(content))
      .catch(err => console.error('Failed to load guide:', err));
  }, []);

  const downloadGuide = () => {
    const blob = new Blob([guideContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ADMIN_QUICK_START_GUIDE.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen luxury-bg-mesh flex flex-col">
        <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <Link href="/admin/users">
                <Button className="gap-2 luxury-btn-ghost">
                  <ArrowLeft className="w-4 h-4" />
                  {t('admin.guide.backToAdmin')}
                </Button>
              </Link>
              <Button onClick={downloadGuide} className="gap-2 luxury-btn-secondary">
                <Download className="w-4 h-4" />
                {t('admin.guide.downloadGuide')}
              </Button>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center shadow-lg">
                <Book className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold luxury-text-gradient">
                  {t('admin.guide.quickStartTitle')}
                </h1>
                <p className="text-gray-600">
                  {t('admin.guide.subtitle')}
                </p>
              </div>
            </div>
          </div>

          <Card className="luxury-glass-card luxury-shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-b">
              <CardTitle className="flex items-center gap-2">
                <Book className="w-5 h-5" />
                {t('admin.guide.guideContents')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-300px)] p-8">
                {guideContent ? (
                  <div className="prose prose-blue max-w-none
                    prose-headings:font-bold
                    prose-h1:text-4xl prose-h1:mb-6 prose-h1:mt-8
                    prose-h2:text-3xl prose-h2:mb-4 prose-h2:mt-8 prose-h2:border-b-2 prose-h2:border-blue-600 prose-h2:pb-2
                    prose-h3:text-2xl prose-h3:mb-3 prose-h3:mt-6
                    prose-h4:text-xl prose-h4:mb-2 prose-h4:mt-4
                    prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                    prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                    prose-code:bg-white prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:text-blue-600
                    prose-pre:bg-gray-900 prose-pre:text-gray-100
                    prose-ul:list-disc prose-ul:list-inside prose-ul:space-y-1 prose-ul:mb-4
                    prose-ol:list-decimal prose-ol:list-inside prose-ol:space-y-1 prose-ol:mb-4
                    prose-li:ml-4
                    prose-table:w-full prose-table:border-collapse prose-table:border prose-table:border-gray-300 prose-table:mb-6
                    prose-th:border prose-th:border-gray-300 prose-th:bg-white prose-th:px-4 prose-th:py-2 prose-th:font-bold
                    prose-td:border prose-td:border-gray-300 prose-td:px-4 prose-td:py-2
                    prose-strong:font-bold prose-strong:text-gray-900
                    prose-blockquote:border-l-4 prose-blockquote:border-blue-600 prose-blockquote:pl-4 prose-blockquote:italic
                  ">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {guideContent}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">
                        {t('admin.guide.loadingGuide')}
                      </p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation('/admin/users')}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {t('admin.guide.employeeManagement')}
                  <ExternalLink className="w-3 h-3" />
                </CardTitle>
              </CardHeader>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation('/admin/login')}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {t('admin.guide.adminLogin')}
                  <ExternalLink className="w-3 h-3" />
                </CardTitle>
              </CardHeader>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation('/my-devices')}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {t('admin.guide.deviceManagement')}
                  <ExternalLink className="w-3 h-3" />
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="mt-6 bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700">
            <CardContent className="p-6">
              <p className="text-sm text-gray-700 dark:text-black text-center">
                {t('admin.guide.needHelp')}{' '}
                <a href="mailto:Support@PetWash.co.il" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  Support@PetWash.co.il
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      </div>
    </Layout>
  );
}
