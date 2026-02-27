import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/Layout";
import { type Language, t } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Book, Download, ArrowLeft, Shield } from "lucide-react";
import { Link } from "wouter";
import AuthHealthCheck from "@/components/admin/AuthHealthCheck";

interface AdminHelpGuideProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export default function AdminHelpGuide({ language, onLanguageChange }: AdminHelpGuideProps) {
  const [guideContent, setGuideContent] = useState<string>("");

  useEffect(() => {
    fetch('/docs/ADMIN_HELP_GUIDE.md')
      .then(res => res.text())
      .then(content => setGuideContent(content))
      .catch(err => console.error('Failed to load admin help guide:', err));
  }, []);

  const downloadGuide = () => {
    const blob = new Blob([guideContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ADMIN_HELP_GUIDE.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen luxury-bg-mesh flex flex-col">
        <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Card className="mb-6 luxury-glass-card luxury-shadow-xl border-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg shadow-lg">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl font-bold luxury-text-gradient">
                      {t('admin.help.maintenanceTitle', language)}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {language === 'he' 
                        ? 'Firebase, Authentication, CAPTCHA, WebAuthn ותצורות מתקדמות'
                        : 'Firebase, Authentication, CAPTCHA, WebAuthn & Advanced Configuration'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadGuide}
                    className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {t('common.download', language)}
                  </Button>
                  <Link href="/admin/users">
                    <Button variant="outline" size="sm" className="border-gray-300">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      {t('common.back', language)}
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
          </Card>

          <AuthHealthCheck />

          <Card className="shadow-xl">
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-680px)] rounded-b-lg">
                <div className="prose prose-lg max-w-none p-8 dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {guideContent}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-50 border-blue-200 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <a href="#authentication-architecture-overview" className="block">
                  <h3 className="font-semibold text-blue-900 mb-1">Architecture</h3>
                  <p className="text-sm text-blue-700">
                    {t('admin.help.systemStructure', language)}
                  </p>
                </a>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-amber-200 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <a href="#troubleshooting-guide" className="block">
                  <h3 className="font-semibold text-amber-900 mb-1">Troubleshooting</h3>
                  <p className="text-sm text-amber-700">
                    {t('admin.help.commonIssues', language)}
                  </p>
                </a>
              </CardContent>
            </Card>
            
            <Card className="bg-emerald-50 border-emerald-200 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <a href="#firebase-console-configuration" className="block">
                  <h3 className="font-semibold text-emerald-900 mb-1">Configuration</h3>
                  <p className="text-sm text-emerald-700">
                    {t('admin.help.firebaseSetup', language)}
                  </p>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      </div>
    </Layout>
  );
}
