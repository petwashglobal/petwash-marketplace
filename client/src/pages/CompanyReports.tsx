import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Globe, Building2, TrendingUp } from "lucide-react";

export default function CompanyReports() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const downloadReport = async (language: 'hebrew' | 'english') => {
    try {
      const response = await fetch(`/api/company-reports/${language}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const filename = language === 'hebrew' 
        ? 'PetWash_Company_Report_Hebrew.md'
        : 'PetWash_Company_Report_English.md';
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Failed to download report. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">📊</div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Pet Wash™ Company Reports
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Comprehensive platform overview, technology stack, and business intelligence
          </p>
        </div>

        {/* Report Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
          {/* English Report */}
          <Card className="hover:shadow-2xl transition-all duration-300">
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                <Globe className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-3xl">English Report</CardTitle>
              <CardDescription className="text-lg">
                Full company documentation in English
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">Company Overview</div>
                    <div className="text-gray-600 text-sm">Complete business profile & leadership</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">Technology Platform</div>
                    <div className="text-gray-600 text-sm">Full-stack architecture & features</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">Business Model</div>
                    <div className="text-gray-600 text-sm">Market position & expansion vision</div>
                  </div>
                </div>
              </div>
              
              <Button 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                size="lg"
                onClick={() => downloadReport('english')}
              >
                <Download className="w-4 h-4 mr-2" />
                Download English Report
              </Button>
            </CardContent>
          </Card>

          {/* Hebrew Report */}
          <Card className="hover:shadow-2xl transition-all duration-300" dir="rtl">
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <Globe className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-3xl">דוח בעברית</CardTitle>
              <CardDescription className="text-lg">
                תיעוד מלא של החברה בעברית
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3 flex-row-reverse">
                  <Building2 className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                  <div className="text-right">
                    <div className="font-semibold text-sm">סקירת החברה</div>
                    <div className="text-gray-600 text-sm">פרופיל עסקי מלא והנהגה</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 flex-row-reverse">
                  <FileText className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                  <div className="text-right">
                    <div className="font-semibold text-sm">פלטפורמת טכנולוגיה</div>
                    <div className="text-gray-600 text-sm">ארכיטקטורה מלאה ותכונות</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 flex-row-reverse">
                  <TrendingUp className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div className="text-right">
                    <div className="font-semibold text-sm">מודל עסקי</div>
                    <div className="text-gray-600 text-sm">מיצוב בשוק וחזון התרחבות</div>
                  </div>
                </div>
              </div>
              
              <Button 
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                size="lg"
                onClick={() => downloadReport('hebrew')}
              >
                <Download className="w-4 h-4 mr-2" />
                הורד דוח בעברית
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* What's Included Section */}
        <Card className="max-w-5xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">📋 What's Included in These Reports</CardTitle>
            <CardDescription>
              Comprehensive documentation for investors, partners, and stakeholders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-lg mb-3 text-blue-900">Company Information</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Registration details (Company #517145033)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Leadership team & shareholders
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Business model & market position
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Competitive advantages
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-3 text-purple-900">Technology Platform</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Full-stack architecture documentation
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Advanced features & integrations
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Security & compliance systems
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    AI & IoT capabilities
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-3 text-green-900">Hardware & Equipment</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    K9000 2.0 Twin specifications
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    International certifications (CE, EMC)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Import documentation
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Safety & accessibility features
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-3 text-orange-900">Growth & Vision</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Global expansion strategy
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Franchise opportunities
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Market leadership position
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Sustainability initiatives
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Section */}
        <div className="max-w-5xl mx-auto mt-12 p-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200 text-center">
          <h2 className="text-2xl font-bold mb-3">Need More Information?</h2>
          <p className="text-gray-600 mb-6">
            For investor inquiries, partnership opportunities, or additional documentation
          </p>
          <Button 
            variant="outline"
            size="lg"
            onClick={() => window.location.href = 'mailto:Nir.H@PetWash.co.il?subject=Company Reports Inquiry'}
          >
            📧 Contact Nir Hadad (CEO)
          </Button>
        </div>
      </div>
    </div>
  );
}
