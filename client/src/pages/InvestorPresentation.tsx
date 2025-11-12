import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Rocket, TrendingUp, Shield, Zap, Globe, Users, DollarSign, 
  Award, Code, Database, Lock, Smartphone, Cloud, Brain,
  CreditCard, BarChart3, FileText, Wifi, QrCode, Heart,
  Building2, Target, Sparkles, CheckCircle2, Download
} from "lucide-react";

export default function InvestorPresentation() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const downloadPDF = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20"></div>
        <div className="container mx-auto px-4 py-20 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="text-8xl mb-6 animate-bounce">🐾</div>
            <h1 className="text-7xl font-black mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              PET WASH™
            </h1>
            <p className="text-3xl font-bold mb-4 text-purple-200">
              The World's Most Advanced Pet Care Platform
            </p>
            <p className="text-xl text-gray-300 mb-8">
              Enterprise SaaS + IoT Hardware + AI = Revolutionary Pet Care Ecosystem
            </p>
            <div className="flex gap-4 justify-center mb-8">
              <div className="bg-white/10 backdrop-blur px-6 py-3 rounded-full border border-purple-400">
                <span className="text-purple-300">Company #517145033</span>
              </div>
              <div className="bg-white/10 backdrop-blur px-6 py-3 rounded-full border border-blue-400">
                <span className="text-blue-300">Israel 🇮🇱 | Global 🌍</span>
              </div>
            </div>
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-xl px-12 py-6"
              onClick={downloadPDF}
            >
              <Download className="mr-2 w-6 h-6" />
              Download Presentation
            </Button>
          </div>
        </div>
      </div>

      {/* R&D Investment Highlight */}
      <div className="bg-gradient-to-r from-yellow-900/30 via-orange-900/30 to-red-900/30 py-16 border-y border-yellow-500/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-5xl font-black mb-6 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              YEARS OF R&D INVESTMENT
            </h2>
            <p className="text-2xl text-gray-200 mb-8 leading-relaxed">
              Pet Wash Ltd represents <strong className="text-yellow-400">years of dedicated research & development</strong> and 
              <strong className="text-orange-400"> substantial financial investment</strong> to create the world's most advanced pet care platform.
            </p>
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <div className="bg-white/10 backdrop-blur p-6 rounded-xl border border-yellow-500/50">
                <div className="text-4xl font-black text-yellow-400 mb-2">Years</div>
                <div className="text-gray-300">of dedicated R&D and platform development</div>
              </div>
              <div className="bg-white/10 backdrop-blur p-6 rounded-xl border border-orange-500/50">
                <div className="text-4xl font-black text-orange-400 mb-2">$$$</div>
                <div className="text-gray-300">Significant capital invested in technology & infrastructure</div>
              </div>
              <div className="bg-white/10 backdrop-blur p-6 rounded-xl border border-red-500/50">
                <div className="text-4xl font-black text-red-400 mb-2">World-Class</div>
                <div className="text-gray-300">Enterprise-grade platform built to perfection</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust & Credibility */}
      <div className="bg-gradient-to-r from-blue-900/30 via-indigo-900/30 to-purple-900/30 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-5xl font-black text-center mb-12 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              💎 TRUSTED EXCELLENCE
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border-blue-400/50">
                <CardHeader>
                  <CardTitle className="text-2xl text-blue-200 flex items-center gap-3">
                    <Shield className="w-8 h-8" />
                    Built on Trust
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-gray-300 space-y-3">
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                    <span><strong>Proven Track Record:</strong> Successfully deployed operational stations across Israel</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                    <span><strong>International Standards:</strong> Full CE, EMC, and safety certifications from Europe</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                    <span><strong>Legal Compliance:</strong> Registered company (#517145033) with all regulatory approvals</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                    <span><strong>Customer Trust:</strong> Growing user base with positive feedback and repeat customers</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-400/50">
                <CardHeader>
                  <CardTitle className="text-2xl text-purple-200 flex items-center gap-3">
                    <Award className="w-8 h-8" />
                    Professional Excellence
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-gray-300 space-y-3">
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                    <span><strong>Expert Development:</strong> Built by experienced full-stack architect with proven expertise</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                    <span><strong>Quality Assurance:</strong> Banking-level security standards and rigorous testing protocols</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                    <span><strong>Continuous Innovation:</strong> Ongoing R&D with latest technologies and best practices</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                    <span><strong>Global Vision:</strong> Strategic planning for international expansion and franchise growth</span>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Problem & Solution */}
      <div className="bg-slate-800/50 py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
            <Card className="bg-red-900/20 border-red-500/50">
              <CardHeader>
                <CardTitle className="text-3xl flex items-center gap-3 text-red-300">
                  <Target className="w-8 h-8" />
                  The Problem
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-300 space-y-3">
                <p>❌ No professional pet washing infrastructure in Israel</p>
                <p>❌ Expensive grooming salons ($50-100 per wash)</p>
                <p>❌ Home washing creates mess and uses excessive water</p>
                <p>❌ No accessibility options for disabled pet owners</p>
                <p>❌ Zero technology integration in pet care industry</p>
              </CardContent>
            </Card>

            <Card className="bg-green-900/20 border-green-500/50">
              <CardHeader>
                <CardTitle className="text-3xl flex items-center gap-3 text-green-300">
                  <Sparkles className="w-8 h-8" />
                  Our Solution
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-300 space-y-3">
                <p>✅ World-class K9000 certified equipment</p>
                <p>✅ Affordable self-service ($10-15 per wash)</p>
                <p>✅ Water-efficient professional systems</p>
                <p>✅ Wheelchair accessible, disability-friendly</p>
                <p>✅ Full enterprise SaaS platform + IoT + AI</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Technology Platform - THE BIG SHOWCASE */}
      <div className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-5xl font-black text-center mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            🚀 WORLD-CLASS TECHNOLOGY STACK
          </h2>
          <p className="text-center text-xl text-gray-300 mb-12">
            Enterprise-grade infrastructure built for global scale
          </p>

          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {/* Frontend */}
            <Card className="bg-gradient-to-br from-blue-900/40 to-blue-700/40 border-blue-400/50 hover:scale-105 transition-transform">
              <CardHeader>
                <Code className="w-12 h-12 text-blue-400 mb-2" />
                <CardTitle className="text-blue-200">Frontend</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-1">
                <p>• React 18 + TypeScript</p>
                <p>• Progressive Web App (PWA)</p>
                <p>• Bilingual (Hebrew RTL + English)</p>
                <p>• Mobile-first responsive design</p>
                <p>• Real-time dashboard</p>
              </CardContent>
            </Card>

            {/* Backend */}
            <Card className="bg-gradient-to-br from-purple-900/40 to-purple-700/40 border-purple-400/50 hover:scale-105 transition-transform">
              <CardHeader>
                <Database className="w-12 h-12 text-purple-400 mb-2" />
                <CardTitle className="text-purple-200">Backend</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-1">
                <p>• Node.js + Express.js</p>
                <p>• PostgreSQL + Drizzle ORM</p>
                <p>• WebSocket real-time</p>
                <p>• RESTful API architecture</p>
                <p>• Microservices ready</p>
              </CardContent>
            </Card>

            {/* Security */}
            <Card className="bg-gradient-to-br from-red-900/40 to-red-700/40 border-red-400/50 hover:scale-105 transition-transform">
              <CardHeader>
                <Lock className="w-12 h-12 text-red-400 mb-2" />
                <CardTitle className="text-red-200">Security</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-1">
                <p>• Banking-level WebAuthn</p>
                <p>• Face ID / Touch ID</p>
                <p>• Firebase Auth</p>
                <p>• 256-bit AES encryption</p>
                <p>• RBAC system</p>
              </CardContent>
            </Card>

            {/* AI */}
            <Card className="bg-gradient-to-br from-pink-900/40 to-pink-700/40 border-pink-400/50 hover:scale-105 transition-transform">
              <CardHeader>
                <Brain className="w-12 h-12 text-pink-400 mb-2" />
                <CardTitle className="text-pink-200">AI Assistant</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-1">
                <p>• Google Gemini 2.5 Flash</p>
                <p>• Bilingual chat support</p>
                <p>• Context-aware responses</p>
                <p>• Learning system</p>
                <p>• Privacy-first analytics</p>
              </CardContent>
            </Card>

            {/* Payments */}
            <Card className="bg-gradient-to-br from-green-900/40 to-green-700/40 border-green-400/50 hover:scale-105 transition-transform">
              <CardHeader>
                <CreditCard className="w-12 h-12 text-green-400 mb-2" />
                <CardTitle className="text-green-200">Payments</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-1">
                <p>• Nayax 4G terminals</p>
                <p>• QR code redemption</p>
                <p>• Contactless payments</p>
                <p>• Digital vouchers</p>
                <p>• Crypto-secure codes</p>
              </CardContent>
            </Card>

            {/* Banking */}
            <Card className="bg-gradient-to-br from-yellow-900/40 to-yellow-700/40 border-yellow-400/50 hover:scale-105 transition-transform">
              <CardHeader>
                <Building2 className="w-12 h-12 text-yellow-400 mb-2" />
                <CardTitle className="text-yellow-200">Banking</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-1">
                <p>• Mizrahi-Tefahot integration</p>
                <p>• Auto-reconciliation</p>
                <p>• Transaction matching</p>
                <p>• Financial reports</p>
                <p>• Audit trails</p>
              </CardContent>
            </Card>

            {/* Accounting */}
            <Card className="bg-gradient-to-br from-orange-900/40 to-orange-700/40 border-orange-400/50 hover:scale-105 transition-transform">
              <CardHeader>
                <FileText className="w-12 h-12 text-orange-400 mb-2" />
                <CardTitle className="text-orange-200">Bookkeeping</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-1">
                <p>• Israeli tax compliance</p>
                <p>• VAT automation</p>
                <p>• Income tax reports</p>
                <p>• National Insurance</p>
                <p>• Excel/PDF exports</p>
              </CardContent>
            </Card>

            {/* IoT */}
            <Card className="bg-gradient-to-br from-cyan-900/40 to-cyan-700/40 border-cyan-400/50 hover:scale-105 transition-transform">
              <CardHeader>
                <Wifi className="w-12 h-12 text-cyan-400 mb-2" />
                <CardTitle className="text-cyan-200">IoT Monitoring</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-1">
                <p>• Real-time station status</p>
                <p>• Offline detection</p>
                <p>• Inventory tracking</p>
                <p>• Predictive maintenance</p>
                <p>• Alert system</p>
              </CardContent>
            </Card>

            {/* Cloud */}
            <Card className="bg-gradient-to-br from-indigo-900/40 to-indigo-700/40 border-indigo-400/50 hover:scale-105 transition-transform">
              <CardHeader>
                <Cloud className="w-12 h-12 text-indigo-400 mb-2" />
                <CardTitle className="text-indigo-200">Cloud Infrastructure</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-1">
                <p>• Google Cloud Storage</p>
                <p>• Automated backups</p>
                <p>• CDN distribution</p>
                <p>• Firebase Firestore</p>
                <p>• Scalable hosting</p>
              </CardContent>
            </Card>

            {/* CRM */}
            <Card className="bg-gradient-to-br from-teal-900/40 to-teal-700/40 border-teal-400/50 hover:scale-105 transition-transform">
              <CardHeader>
                <Users className="w-12 h-12 text-teal-400 mb-2" />
                <CardTitle className="text-teal-200">CRM System</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-1">
                <p>• HubSpot integration</p>
                <p>• Customer tracking</p>
                <p>• Lead management</p>
                <p>• Email campaigns</p>
                <p>• Analytics dashboard</p>
              </CardContent>
            </Card>

            {/* Loyalty */}
            <Card className="bg-gradient-to-br from-rose-900/40 to-rose-700/40 border-rose-400/50 hover:scale-105 transition-transform">
              <CardHeader>
                <Heart className="w-12 h-12 text-rose-400 mb-2" />
                <CardTitle className="text-rose-200">VIP Loyalty</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-1">
                <p>• 5-tier program</p>
                <p>• Progressive discounts</p>
                <p>• Birthday bonuses</p>
                <p>• Points system</p>
                <p>• Referral rewards</p>
              </CardContent>
            </Card>

            {/* Mobile */}
            <Card className="bg-gradient-to-br from-violet-900/40 to-violet-700/40 border-violet-400/50 hover:scale-105 transition-transform">
              <CardHeader>
                <Smartphone className="w-12 h-12 text-violet-400 mb-2" />
                <CardTitle className="text-violet-200">Mobile PWA</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-1">
                <p>• Offline-capable</p>
                <p>• Push notifications</p>
                <p>• Add to home screen</p>
                <p>• Technician tools</p>
                <p>• GPS integration</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Unique Features */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-5xl font-black text-center mb-12 text-purple-300">
            ⚡ UNIQUE COMPETITIVE ADVANTAGES
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="bg-white/5 backdrop-blur p-6 rounded-xl border border-purple-500/30">
              <Award className="w-12 h-12 text-yellow-400 mb-3" />
              <h3 className="text-xl font-bold mb-2 text-purple-200">Only CE-Certified in Israel</h3>
              <p className="text-gray-300">Exclusive K9000 2.0 Twin import with full international safety certifications</p>
            </div>

            <div className="bg-white/5 backdrop-blur p-6 rounded-xl border border-blue-500/30">
              <Shield className="w-12 h-12 text-blue-400 mb-3" />
              <h3 className="text-xl font-bold mb-2 text-blue-200">Banking-Level Security</h3>
              <p className="text-gray-300">WebAuthn, Face ID, 256-bit encryption, RBAC, audit logging</p>
            </div>

            <div className="bg-white/5 backdrop-blur p-6 rounded-xl border border-green-500/30">
              <Globe className="w-12 h-12 text-green-400 mb-3" />
              <h3 className="text-xl font-bold mb-2 text-green-200">Wheelchair Accessible</h3>
              <p className="text-gray-300">Only disability-friendly pet washing solution in the region</p>
            </div>

            <div className="bg-white/5 backdrop-blur p-6 rounded-xl border border-pink-500/30">
              <Zap className="w-12 h-12 text-pink-400 mb-3" />
              <h3 className="text-xl font-bold mb-2 text-pink-200">Real-Time IoT</h3>
              <p className="text-gray-300">Live station monitoring, predictive maintenance, automated alerts</p>
            </div>

            <div className="bg-white/5 backdrop-blur p-6 rounded-xl border border-yellow-500/30">
              <QrCode className="w-12 h-12 text-yellow-400 mb-3" />
              <h3 className="text-xl font-bold mb-2 text-yellow-200">QR Code Integration</h3>
              <p className="text-gray-300">Secure voucher redemption with cryptographic verification</p>
            </div>

            <div className="bg-white/5 backdrop-blur p-6 rounded-xl border border-cyan-500/30">
              <BarChart3 className="w-12 h-12 text-cyan-400 mb-3" />
              <h3 className="text-xl font-bold mb-2 text-cyan-200">Israeli Tax Compliance</h3>
              <p className="text-gray-300">Automated VAT, income tax, national insurance reporting</p>
            </div>
          </div>
        </div>
      </div>

      {/* Market Opportunity */}
      <div className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-5xl font-black text-center mb-12 bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
            💰 MASSIVE MARKET OPPORTUNITY
          </h2>
          
          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-400/50 text-center">
              <CardContent className="pt-6">
                <div className="text-5xl font-black text-green-400 mb-2">2.5M</div>
                <div className="text-gray-300">Pet Dogs in Israel</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border-blue-400/50 text-center">
              <CardContent className="pt-6">
                <div className="text-5xl font-black text-blue-400 mb-2">$500M</div>
                <div className="text-gray-300">Pet Care Market (Israel)</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-400/50 text-center">
              <CardContent className="pt-6">
                <div className="text-5xl font-black text-purple-400 mb-2">$15</div>
                <div className="text-gray-300">Average Wash Revenue</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-900/40 to-yellow-900/40 border-orange-400/50 text-center">
              <CardContent className="pt-6">
                <div className="text-5xl font-black text-orange-400 mb-2">100+</div>
                <div className="text-gray-300">Franchise Locations (Goal)</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="bg-slate-800/50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-5xl font-black text-center mb-4 text-purple-300">
            👥 WORLD-CLASS LEADERSHIP TEAM
          </h2>
          <p className="text-xl text-center text-gray-300 mb-12 max-w-3xl mx-auto">
            Experienced professionals you can trust to deliver excellence and drive global growth
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border-purple-400/50">
              <CardHeader>
                <div className="text-6xl text-center mb-4">🎯</div>
                <CardTitle className="text-3xl text-purple-200 text-center">Nir Hadad</CardTitle>
                <p className="text-purple-300 text-center font-semibold">Founder & CEO</p>
              </CardHeader>
              <CardContent className="text-gray-300 space-y-3">
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <span><strong>Visionary Leader:</strong> Israeli & Australian citizenship with global perspective</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <span><strong>Technical Genius:</strong> Built entire enterprise platform independently from scratch</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <span><strong>Full-Stack Master:</strong> Expert in frontend, backend, IoT, AI, and cloud infrastructure</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <span><strong>Hardware Integration:</strong> Successfully deployed certified K9000 equipment from Australia</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <span><strong>Proven Executor:</strong> Years of R&D investment resulting in production-ready platform</span>
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border-blue-400/50">
              <CardHeader>
                <div className="text-6xl text-center mb-4">🚀</div>
                <CardTitle className="text-3xl text-blue-200 text-center">Ido Shakarzi</CardTitle>
                <p className="text-blue-300 text-center font-semibold">Shareholder & National Operations Director</p>
              </CardHeader>
              <CardContent className="text-gray-300 space-y-3">
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <span><strong>Strategic Growth:</strong> Expert in partnerships, expansion, and market penetration</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <span><strong>Legal & Compliance:</strong> Ensures full regulatory adherence and legal protection</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <span><strong>Franchise Expert:</strong> Building scalable franchise model for national expansion</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <span><strong>Operations Excellence:</strong> Coordinating nationwide rollout with precision</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <span><strong>Trusted Leadership:</strong> Committed shareholder invested in company success</span>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Why Invest */}
      <div className="bg-gradient-to-br from-slate-900 to-purple-900 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-5xl font-black text-center mb-12 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
            💎 WHY INVEST IN PET WASH LTD
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
            <Card className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-400/50">
              <CardHeader>
                <Rocket className="w-12 h-12 text-green-400 mb-2" />
                <CardTitle className="text-green-200">Proven R&D Investment</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-300">
                Years of development and substantial capital invested to create a production-ready, market-tested platform that works flawlessly.
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border-blue-400/50">
              <CardHeader>
                <Shield className="w-12 h-12 text-blue-400 mb-2" />
                <CardTitle className="text-blue-200">Trusted Team</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-300">
                Experienced leadership with proven track record. Nir built the entire platform solo - demonstrating exceptional capability and commitment.
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-400/50">
              <CardHeader>
                <TrendingUp className="w-12 h-12 text-purple-400 mb-2" />
                <CardTitle className="text-purple-200">Market Leadership</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-300">
                First and only CE-certified pet washing platform in Israel with enterprise SaaS, IoT, AI, and full automation - unmatched competitive advantage.
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Investment Ask */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-6xl font-black mb-6">🚀 READY TO SCALE GLOBALLY</h2>
          <p className="text-2xl mb-4 max-w-3xl mx-auto">
            Join us in revolutionizing the global pet care industry with world-class technology, 
            proven hardware, and a trusted team you can rely on.
          </p>
          <p className="text-xl mb-8 max-w-2xl mx-auto text-purple-100">
            <strong>Years of R&D investment</strong> have resulted in a production-ready platform. 
            Now it's time to <strong>scale globally</strong> with the right investment partner.
          </p>
          <div className="flex gap-6 justify-center flex-wrap">
            <Button 
              size="lg" 
              className="bg-white text-purple-600 hover:bg-gray-100 text-xl px-12 py-6"
              onClick={() => window.location.href = 'mailto:Nir.H@PetWash.co.il?subject=Investment Inquiry'}
            >
              📧 Contact for Investment
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white text-white hover:bg-white/20 text-xl px-12 py-6"
              onClick={downloadPDF}
            >
              <Download className="mr-2 w-6 h-6" />
              Download Full Deck
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-900 py-8 text-center text-gray-400">
        <p className="mb-2">Pet Wash Ltd (פט וואש בע"מ) • Company #517145033</p>
        <p className="mb-2">8 Uzi Chitman St, Rosh HaAyin, Israel</p>
        <p>Nir.H@PetWash.co.il • +61 419 773 360 • www.petwash.co.il</p>
      </div>
    </div>
  );
}
