import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { type Language, t } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Book, Download, ArrowLeft, ExternalLink, Shield } from "lucide-react";
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

  const formatMarkdownToHTML = (markdown: string) => {
    let html = markdown;
    
    // Headers
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-4xl font-bold text-gray-900 mb-6 mt-8">$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-3xl font-bold text-gray-800 mb-4 mt-8 border-b-2 border-emerald-600 pb-2">$2</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-2xl font-semibold text-gray-700 mb-3 mt-6">$3</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4 class="text-xl font-semibold text-gray-600 mb-2 mt-4">$4</h4>');
    
    // Bold, italic, code
    html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-gray-900">$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/gim, '<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-emerald-600">$1</code>');
    
    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/gim, '<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4"><code>$2</code></pre>');
    
    // Lists
    html = html.replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li.*<\/li>)/gi, '<ul class="list-disc list-inside space-y-1 mb-4">$1</ul>');
    
    // Tables (simplified)
    html = html.replace(/^\| (.+) \|$/gim, (match) => {
      const cells = match.slice(2, -2).split('|').map(cell => cell.trim());
      return '<tr>' + cells.map(cell => `<td class="border border-gray-300 px-4 py-2">${cell}</td>`).join('') + '</tr>';
    });
    html = html.replace(/(<tr>.*<\/tr>)/gi, '<table class="w-full border-collapse border border-gray-300 mb-6 text-sm">$1</table>');
    
    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" class="text-emerald-600 hover:underline font-medium" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Paragraphs
    html = html.replace(/^(?!<[hl]|<ul|<table|<code|<pre)(.*$)/gim, '<p class="mb-4 text-gray-700 leading-relaxed">$1</p>');
    
    // Emojis and symbols
    html = html.replace(/✅/g, '<span class="text-green-600">✅</span>');
    html = html.replace(/❌/g, '<span class="text-red-600">❌</span>');
    html = html.replace(/⚠️/g, '<span class="text-yellow-600">⚠️</span>');
    html = html.replace(/🔐/g, '<span>🔐</span>');
    html = html.replace(/🔧/g, '<span>🔧</span>');
    html = html.replace(/📧/g, '<span>📧</span>');
    html = html.replace(/🔗/g, '<span>🔗</span>');
    html = html.replace(/🚫/g, '<span>🚫</span>');
    html = html.replace(/📋/g, '<span>📋</span>');
    html = html.replace(/🏗️/g, '<span>🏗️</span>');
    html = html.replace(/🛠️/g, '<span>🛠️</span>');
    html = html.replace(/🎯/g, '<span>🎯</span>');
    html = html.replace(/🔍/g, '<span>🔍</span>');
    html = html.replace(/⚙️/g, '<span>⚙️</span>');
    html = html.replace(/🚀/g, '<span>🚀</span>');
    html = html.replace(/📞/g, '<span>📞</span>');
    html = html.replace(/📚/g, '<span>📚</span>');
    
    return html;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:bg-gray-900 flex flex-col">
      <Header language={language} onLanguageChange={onLanguageChange} />
      
      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header Card */}
          <Card className="mb-6 border-2 border-emerald-500 shadow-lg bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900 dark:to-green-900">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-600 rounded-lg">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white">
                      {t('admin.help.maintenanceTitle', language)}
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
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

          {/* Auth Health Check & Diagnostics */}
          <AuthHealthCheck />

          {/* Guide Content */}
          <Card className="shadow-xl">
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-680px)] rounded-b-lg">
                <div 
                  className="prose prose-lg max-w-none p-8 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: formatMarkdownToHTML(guideContent) }}
                />
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Quick Links Footer */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-50 border-blue-200 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <a href="#authentication-architecture-overview" className="block">
                  <h3 className="font-semibold text-blue-900 mb-1">🏗️ Architecture</h3>
                  <p className="text-sm text-blue-700">
                    {t('admin.help.systemStructure', language)}
                  </p>
                </a>
              </CardContent>
            </Card>
            
            <Card className="bg-amber-50 border-amber-200 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <a href="#troubleshooting-guide" className="block">
                  <h3 className="font-semibold text-amber-900 mb-1">🔧 Troubleshooting</h3>
                  <p className="text-sm text-amber-700">
                    {t('admin.help.commonIssues', language)}
                  </p>
                </a>
              </CardContent>
            </Card>
            
            <Card className="bg-emerald-50 border-emerald-200 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <a href="#firebase-console-configuration" className="block">
                  <h3 className="font-semibold text-emerald-900 mb-1">⚙️ Configuration</h3>
                  <p className="text-sm text-emerald-700">
                    {t('admin.help.firebaseSetup', language)}
                  </p>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <Footer language={language} />
    </div>
  );
}
