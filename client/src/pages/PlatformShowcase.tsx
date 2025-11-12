import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, Sparkles, Brain, Globe, Smartphone, Lock, 
  TrendingUp, Zap, Database, Cloud, CheckCircle2, 
  Rocket, Crown, Award, Star, Target, Users,
  DollarSign, BarChart3, Fingerprint, Wallet,
  MessageSquare, Bot, Camera, FileText, MapPin,
  Heart, GraduationCap, HandHeart, TreePine, Gift
} from "lucide-react";

export default function PlatformShowcase() {
  const features = [
    {
      category: "🎯 Multi-Division Ecosystem",
      icon: <Crown className="h-8 w-8" />,
      color: "from-purple-500 to-pink-500",
      items: [
        "Pet Wash Hub™ - Premium organic washing stations",
        "Walk My Pet™ - Real-time GPS dog walking marketplace (20%/80% split)",
        "The Sitter Suite™ - AI-powered pet sitting with urgency triage",
        "PetTrek™ - Uber-style pet transport with dynamic fare estimation",
        "K9000 IoT Stations - Cloud-managed wash bays with remote control",
        "The Plush Lab™ - AI avatar creator with custom animations",
        "Enterprise Division - Global franchise & B2B operations"
      ]
    },
    {
      category: "🤖 Artificial Intelligence",
      icon: <Brain className="h-8 w-8" />,
      color: "from-blue-500 to-cyan-500",
      items: [
        "Google Gemini 2.5 Flash - Multilingual AI chat with Kenzo mascot",
        "AI Triage System - Automatic urgency scoring for pet sitting requests",
        "Predictive Maintenance - IoT station health monitoring",
        "Content Moderation - AI-powered safety for social features",
        "Automated Bookkeeping - Google Vision OCR + Gemini receipt processing",
        "Quality Monitoring - 7-year data retention with automated code review",
        "Real-time Emotion Detection - Avatar animation sync"
      ]
    },
    {
      category: "🔐 Enterprise Security",
      icon: <Shield className="h-8 w-8" />,
      color: "from-red-500 to-orange-500",
      items: [
        "Banking-level Biometric Auth - WebAuthn Level 2 + Passkey support",
        "Firebase Authentication - Multi-factor with session cookies",
        "Israeli Privacy Law 2025 - Full compliance with GDPR standards",
        "AES-256-GCM Encryption - Field-level for PII data",
        "Blockchain Audit Trail - Immutable transaction ledger with hash chains",
        "Rate Limiting - 5 types across 37+ protected endpoints",
        "HSTS + CSP - Enterprise-grade security headers (A+ SSL rating)",
        "Penetration Test Tracking - DPO system with incident reporting"
      ]
    },
    {
      category: "💳 Payment & Finance",
      icon: <DollarSign className="h-8 w-8" />,
      color: "from-green-500 to-emerald-500",
      items: [
        "Nayax Israel - EXCLUSIVE payment gateway (Apple/Google Pay)",
        "Split Payment System - Automatic commission distribution",
        "Israeli Tax Compliance - 18% VAT with automatic reclaim system",
        "Bank Reconciliation - Mizrahi-Tefahot API integration",
        "Automated Monthly Invoicing - Tax authority API filing",
        "E-Voucher System - Apple Wallet + Google Wallet integration",
        "5-Tier Loyalty Program - Progressive discounts (Founder 50% off)",
        "Special Discounts - Disability (15% extra) & Senior (10% extra) programs"
      ]
    },
    {
      category: "🌍 Global & Localization",
      icon: <Globe className="h-8 w-8" />,
      color: "from-indigo-500 to-purple-500",
      items: [
        "6-Language Support - Hebrew, English, Arabic, Russian, French, Spanish",
        "RTL/LTR Auto-Detection - IP-based language selection",
        "165 Currency Support - Real-time exchange rates",
        "Multi-Country Legal - 5 countries' compliance frameworks",
        "Google Cloud Translation - 100+ language pairs",
        "Direction-Aware Layouts - Consistent UX across all languages",
        "Israeli Market Focus - Hebrew-first with English brand touches"
      ]
    },
    {
      category: "📱 Mobile & Real-Time",
      icon: <Smartphone className="h-8 w-8" />,
      color: "from-pink-500 to-rose-500",
      items: [
        "Progressive Web App - Field technician dedicated PWA",
        "Real-time GPS Tracking - Live pet location with check-in/check-out",
        "WebSocket Server - IoT telemetry + live updates (1000 connections)",
        "Live Activity ETA - Countdown for pet transport arrivals",
        "Mobile OAuth2 - Seamless authentication flow",
        "Push Notifications - FCM for instant alerts",
        "Track My Pet Widget - Owner dashboard with vital monitoring"
      ]
    },
    {
      category: "🎨 User Experience",
      icon: <Sparkles className="h-8 w-8" />,
      color: "from-yellow-500 to-amber-500",
      items: [
        "Liquid Glass Design - 2025/2026 volumetric styling trends",
        "Apple-Style Animations - Spring physics with glassmorphism",
        "Multi-Avatar System - Pure CSS 3D (Kenzo dog + Human cube)",
        "Responsive Mobile-First - Consistent across all devices",
        "Dark Mode Ready - Theme system with localStorage sync",
        "Finger-Friendly Controls - Touch-optimized date selectors",
        "Premium Brand Identity - Official TM logo with luxury aesthetics"
      ]
    },
    {
      category: "📊 Analytics & Monitoring",
      icon: <BarChart3 className="h-8 w-8" />,
      color: "from-violet-500 to-purple-500",
      items: [
        "Sentry Error Tracking - Production monitoring with releases",
        "Google Analytics 4 - Complete user journey tracking",
        "Microsoft Clarity - Heatmaps and session recordings",
        "Facebook Pixel + TikTok Pixel - Multi-platform ad tracking",
        "Prometheus Metrics - Custom application performance metrics",
        "Winston Logging - Structured logs with 7-year retention",
        "Health Monitoring - Real-time station status dashboard"
      ]
    },
    {
      category: "🔧 Advanced Features",
      icon: <Zap className="h-8 w-8" />,
      color: "from-cyan-500 to-blue-500",
      items: [
        "Passport KYC Verification - Google Vision MRZ parsing with admin approval",
        "Digital Wallet Cards - Apple Wallet + Google Wallet for loyalty",
        "QR Code Redemption - E-gift voucher validation at stations",
        "WhatsApp Business - Twilio-powered bilingual messaging",
        "Email Marketing - SendGrid luxury templates with CSV exports",
        "Document Signing - E-signature system for legal contracts",
        "Social Platform - Instagram-style 'PetWash Circle' with AI moderation"
      ]
    },
    {
      category: "☁️ Infrastructure",
      icon: <Cloud className="h-8 w-8" />,
      color: "from-gray-600 to-slate-600",
      items: [
        "Google Cloud Storage - Automated code & Firestore backups",
        "Neon PostgreSQL - Serverless database with Drizzle ORM",
        "Firebase Firestore - Real-time document database",
        "Redis Caching - In-memory with graceful fallback",
        "GCE Deployment - Google Cloud Engine hosting",
        "Let's Encrypt SSL - Auto-renewal with HSTS preload",
        "CDN Assets - Optimized delivery with compression"
      ]
    },
    {
      category: "🏢 Enterprise Management",
      icon: <Users className="h-8 w-8" />,
      color: "from-teal-500 to-green-500",
      items: [
        "Hierarchical Approvals - Tree-model org chart with budget limits",
        "CRM Integration - HubSpot with lead management",
        "Franchise Dashboard - Multi-location tracking and reporting",
        "Station Inventory - Low stock alerts with utility renewal tracking",
        "Employee Onboarding - Role-based access control (RBAC)",
        "Automated Reporting - Daily/monthly revenue with email delivery",
        "Data Integrity Checks - Weekly validation with alerts"
      ]
    },
    {
      category: "🚀 Innovation & Scale",
      icon: <Rocket className="h-8 w-8" />,
      color: "from-orange-500 to-red-500",
      items: [
        "20+ Background Jobs - Scheduled tasks with Israel timezone",
        "257+ API Endpoints - RESTful architecture with versioning",
        "95+ Frontend Routes - Lazy loading with code splitting",
        "Blockchain-Style Ledger - Hash-chained immutable records",
        "Dynamic Pricing - Surge pricing with real-time fare estimation",
        "Job Dispatch System - Accept/decline with 3-second polling",
        "Future: AirTag Integration - Apple Find My network support"
      ]
    },
    {
      category: "📱 Paw-Connect™ Mobile (Coming 2026)",
      icon: <Smartphone className="h-8 w-8" />,
      color: "from-rose-500 to-pink-500",
      items: [
        "React Native + Expo - Cross-platform iOS/Android/Web",
        "7-Star Luxury Design - Dark-theme with Moti animations",
        "Direct Support Chat - Professional help desk integration (+972549833355)",
        "M2M Luxury Inbox - Member-to-member DMs with opt-in approval",
        "Paw Finder™ - FREE lost pet assistance with community rewards (no fees)",
        "Social Sharing - One-tap to Facebook/Instagram/TikTok with branded assets",
        "Microservices Backend - Auth, Chat, Feed, Notifications (WebSocket/Firebase)"
      ]
    }
  ];

  const stats = [
    { label: "API Endpoints", value: "257+", icon: <Database /> },
    { label: "Frontend Routes", value: "95+", icon: <MapPin /> },
    { label: "Languages", value: "6", icon: <Globe /> },
    { label: "Currencies", value: "165", icon: <DollarSign /> },
    { label: "Background Jobs", value: "20+", icon: <Zap /> },
    { label: "Security Compliance", value: "A+", icon: <Shield /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-blue-600/10 to-pink-600/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center space-y-6">
            <Badge className="text-lg px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
              <Award className="h-5 w-5 mr-2 inline" />
              World-Class Technology Platform
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 bg-clip-text text-transparent">
              Pet Wash™ Platform
            </h1>
            
            <p className="text-2xl md:text-3xl text-slate-600 dark:text-slate-300 max-w-4xl mx-auto">
              The Most Advanced Multi-Division Pet Care Ecosystem in the World
            </p>
            
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-3xl mx-auto">
              7-Star luxury platform combining AI, blockchain, real-time IoT, enterprise security, 
              and innovative features that don't exist anywhere else in the pet care industry.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-16">
            {stats.map((stat, index) => (
              <Card key={index} className="p-6 text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur border-slate-200 dark:border-slate-700">
                <div className="flex justify-center mb-3 text-purple-600 dark:text-purple-400">
                  {stat.icon}
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {stat.label}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card key={index} className="relative overflow-hidden group hover:shadow-2xl transition-all duration-300 border-slate-200 dark:border-slate-700">
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
              
              <div className="relative p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${feature.color} text-white`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {feature.category}
                  </h3>
                </div>
                
                <ul className="space-y-2">
                  {feature.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* ALL THE GOOD THINGS WE ARE DOING - 7-STAR ULTRA-MODERN SECTION */}
      <div className="relative py-24 overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-teal-900/20">
        {/* Decorative Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.15),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(5,150,105,0.15),transparent_50%)]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white mb-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <Heart className="h-6 w-6 fill-white animate-pulse" />
              <span className="font-bold text-lg">Making a Difference</span>
              <Heart className="h-6 w-6 fill-white animate-pulse" />
            </div>
            
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
                ❤️ All The Good Things We Are Doing
              </span>
            </h2>
            
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 max-w-4xl mx-auto leading-relaxed">
              Building a better world for pets, people, and our planet — one wash at a time
            </p>
          </div>

          {/* Impact Grid - 7-Star Design */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Global Shelter Donations */}
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur-lg opacity-25 group-hover:opacity-50 transition-all duration-300" />
              <Card className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-2 border-green-200 dark:border-green-700 p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Globe className="h-10 w-10 text-white drop-shadow-md" strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  🌍 Global Shelter Donations
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Supporting animals worldwide with monthly contributions to shelters and rescue organizations across the globe
                </p>
                <Badge className="mt-4 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                  Active Monthly Program
                </Badge>
              </Card>
            </div>

            {/* Disability Discount */}
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur-lg opacity-25 group-hover:opacity-50 transition-all duration-300" />
              <Card className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-2 border-blue-200 dark:border-blue-700 p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <HandHeart className="h-10 w-10 text-white drop-shadow-md" strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  🤝 Disability Discount Program
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                  Additional 15% discount for approved members (הנחת נכות) — because accessibility is a human right
                </p>
                <Badge className="mt-4 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                  +15% Extra Discount
                </Badge>
              </Card>
            </div>

            {/* Senior Citizens */}
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur-lg opacity-25 group-hover:opacity-50 transition-all duration-300" />
              <Card className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-2 border-purple-200 dark:border-purple-700 p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Gift className="h-10 w-10 text-white drop-shadow-md" strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  👵 Senior Citizen Benefits
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Extra 10% discount for pensioners with government certificate — honoring our elders
                </p>
                <Badge className="mt-4 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                  +10% Senior Discount
                </Badge>
              </Card>
            </div>

            {/* FREE Paw Finder */}
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl blur-lg opacity-25 group-hover:opacity-50 transition-all duration-300" />
              <Card className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-2 border-red-200 dark:border-red-700 p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Heart className="h-10 w-10 text-white drop-shadow-md fill-white" strokeWidth={2} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  🆓 FREE Paw Finder™
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Lost pet reunions with ZERO fees or commissions — reuniting families is priceless
                </p>
                <Badge className="mt-4 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                  100% FREE Forever
                </Badge>
              </Card>
            </div>

            {/* Environmental Sustainability */}
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-teal-600 to-green-600 rounded-2xl blur-lg opacity-25 group-hover:opacity-50 transition-all duration-300" />
              <Card className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-2 border-teal-200 dark:border-teal-700 p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-green-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <TreePine className="h-10 w-10 text-white drop-shadow-md" strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  🌿 Environmental Sustainability
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Organic products, eco-friendly operations, and carbon-neutral goals by 2030
                </p>
                <Badge className="mt-4 bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100">
                  Carbon Neutral 2030
                </Badge>
              </Card>
            </div>

            {/* Community Education */}
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-600 to-yellow-600 rounded-2xl blur-lg opacity-25 group-hover:opacity-50 transition-all duration-300" />
              <Card className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-2 border-amber-200 dark:border-amber-700 p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <GraduationCap className="h-10 w-10 text-white drop-shadow-md" strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  📚 Community Education
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  FREE workshops on pet care and animal welfare — knowledge should be accessible to all
                </p>
                <Badge className="mt-4 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
                  Free Workshops
                </Badge>
              </Card>
            </div>
          </div>

          {/* Legacy Mission Statement */}
          <div className="mt-16 text-center">
            <div className="relative inline-block">
              <div className="absolute -inset-4 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 rounded-3xl blur-2xl opacity-20" />
              <Card className="relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-2 border-green-300 dark:border-green-600 p-10 rounded-3xl shadow-2xl">
                <div className="flex justify-center mb-6">
                  <div className="flex gap-2">
                    <Heart className="h-12 w-12 text-red-500 fill-red-500 animate-pulse" />
                    <Sparkles className="h-12 w-12 text-yellow-500 fill-yellow-500" />
                    <Heart className="h-12 w-12 text-red-500 fill-red-500 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent mb-4">
                  Our Legacy Mission
                </h3>
                <p className="text-xl md:text-2xl text-slate-700 dark:text-slate-200 leading-relaxed max-w-4xl mx-auto">
                  Building a better world for our children and grand-grandchildren — 
                  where every pet is loved, every person is valued, and our planet thrives 🌍
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white space-y-6">
          <Star className="h-16 w-16 mx-auto" />
          <h2 className="text-4xl font-bold">
            Innovation That Sets Industry Standards
          </h2>
          <p className="text-xl opacity-90">
            Pet Wash™ combines cutting-edge technology with luxury service delivery.
            <br />
            Built with 2025 standards. Ready for global expansion.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Badge className="text-lg px-6 py-3 bg-white/20 backdrop-blur border-white/30">
              🏆 Enterprise-Grade Security
            </Badge>
            <Badge className="text-lg px-6 py-3 bg-white/20 backdrop-blur border-white/30">
              🤖 AI-Powered Intelligence
            </Badge>
            <Badge className="text-lg px-6 py-3 bg-white/20 backdrop-blur border-white/30">
              🌍 Global-Ready Platform
            </Badge>
            <Badge className="text-lg px-6 py-3 bg-white/20 backdrop-blur border-white/30">
              ⚡ Real-Time Everything
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
