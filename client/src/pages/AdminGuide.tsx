import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
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

  const formatMarkdownToHTML = (markdown: string) => {
    let html = markdown;
    
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-4xl font-bold text-gray-900 mb-6 mt-8">$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-3xl font-bold text-gray-800 mb-4 mt-8 border-b-2 border-blue-600 pb-2">$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-2xl font-semibold text-gray-700 mb-3 mt-6">$1</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4 class="text-xl font-semibold text-gray-600 mb-2 mt-4">$1</h4>');
    
    html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-gray-900">$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/gim, '<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-blue-600">$1</code>');
    
    html = html.replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li.*<\/li>)/gi, '<ul class="list-disc list-inside space-y-1 mb-4">$1</ul>');
    
    html = html.replace(/^\| (.+) \|$/gim, (match) => {
      const cells = match.slice(2, -2).split('|').map(cell => cell.trim());
      return '<tr>' + cells.map(cell => `<td class="border border-gray-300 px-4 py-2">${cell}</td>`).join('') + '</tr>';
    });
    html = html.replace(/(<tr>.*<\/tr>)/gi, '<table class="w-full border-collapse border border-gray-300 mb-6">$1</table>');
    
    html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1 <ExternalLink class="inline w-3 h-3" /></a>');
    
    html = html.replace(/^(?!<[hl]|<ul|<table|<code)(.*$)/gim, '<p class="mb-4 text-gray-700 leading-relaxed">$1</p>');
    
    html = html.replace(/✅/g, '<span class="text-green-600">✅</span>');
    html = html.replace(/❌/g, '<span class="text-red-600">❌</span>');
    html = html.replace(/🔐/g, '<span>🔐</span>');
    html = html.replace(/📧/g, '<span>📧</span>');
    html = html.replace(/🔗/g, '<span>🔗</span>');
    html = html.replace(/🚫/g, '<span>🚫</span>');
    
    return html;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header language={language} onLanguageChange={onLanguageChange} />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <Link href="/admin/users">
                <Button variant="ghost" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  {t('admin.guide.backToAdmin')}
                </Button>
              </Link>
              <Button onClick={downloadGuide} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                {t('admin.guide.downloadGuide')}
              </Button>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Book className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {t('admin.guide.quickStartTitle')}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('admin.guide.subtitle')}
                </p>
              </div>
            </div>
          </div>

          {/* Guide Content */}
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-b">
              <CardTitle className="flex items-center gap-2">
                <Book className="w-5 h-5" />
                {t('admin.guide.guideContents')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-300px)] p-8">
                {guideContent ? (
                  <div 
                    className="prose prose-blue max-w-none
                      prose-headings:font-bold
                      prose-h1:text-4xl prose-h1:mb-6 prose-h1:mt-8
                      prose-h2:text-3xl prose-h2:mb-4 prose-h2:mt-8 prose-h2:border-b-2 prose-h2:border-blue-600 prose-h2:pb-2
                      prose-h3:text-2xl prose-h3:mb-3 prose-h3:mt-6
                      prose-h4:text-xl prose-h4:mb-2 prose-h4:mt-4
                      prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                      prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                      prose-code:bg-gray-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:text-blue-600
                      prose-pre:bg-gray-900 prose-pre:text-gray-100
                      prose-ul:list-disc prose-ul:list-inside prose-ul:space-y-1 prose-ul:mb-4
                      prose-ol:list-decimal prose-ol:list-inside prose-ol:space-y-1 prose-ol:mb-4
                      prose-li:ml-4
                      prose-table:w-full prose-table:border-collapse prose-table:border prose-table:border-gray-300 prose-table:mb-6
                      prose-th:border prose-th:border-gray-300 prose-th:bg-gray-100 prose-th:px-4 prose-th:py-2 prose-th:font-bold
                      prose-td:border prose-td:border-gray-300 prose-td:px-4 prose-td:py-2
                      prose-strong:font-bold prose-strong:text-gray-900
                      prose-blockquote:border-l-4 prose-blockquote:border-blue-600 prose-blockquote:pl-4 prose-blockquote:italic
                    "
                    dangerouslySetInnerHTML={{ __html: formatMarkdownToHTML(guideContent) }}
                  />
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

          {/* Quick Links */}
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

          {/* Support Contact */}
          <Card className="mt-6 bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700">
            <CardContent className="p-6">
              <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
                {t('admin.guide.needHelp')}{' '}
                <a href="mailto:Support@PetWash.co.il" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  Support@PetWash.co.il
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer language={language} />
    </div>
  );
}
