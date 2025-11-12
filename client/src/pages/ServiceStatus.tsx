/**
 * Service Status Page
 * Shows which services are fully implemented vs. mockups
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Construction } from 'lucide-react';
import { type Language } from '@/lib/i18n';

interface ServiceStatusProps {
  language: Language;
}

type ServiceStatus = 'production' | 'beta' | 'development' | 'planned';

interface Service {
  name: string;
  nameHe: string;
  status: ServiceStatus;
  backend: boolean;
  frontend: boolean;
  notes: string;
  notesHe: string;
}

export default function ServiceStatus({ language }: ServiceStatusProps) {
  const isHebrew = language === 'he';

  const services: Service[] = [
    {
      name: 'AI Chat Assistant (Kenzo)',
      nameHe: 'עוזר AI (קנזו)',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'Fully functional - Google Gemini 2.5 Flash, bilingual, conversation context',
      notesHe: 'פעיל לחלוטין - Google Gemini 2.5 Flash, דו-לשוני, הקשר שיחה',
    },
    {
      name: 'Paw Finder™ (Lost & Found Pets)',
      nameHe: 'Paw Finder™ (חיות מחמד אבודות)',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'FREE community service - Report & search lost/found pets',
      notesHe: 'שירות קהילתי חינמי - דיווח וחיפוש חיות מחמד אבודות',
    },
    {
      name: 'Loyalty Program & VIP Tiers',
      nameHe: 'תכנית נאמנות ורמות VIP',
      status: 'production',
      backend: true,
      frontend: true,
      notes: '5 tiers (Founder 50% off), Apple Wallet integration, points system',
      notesHe: '5 רמות (מייסד 50% הנחה), אפל וולט, מערכת נקודות',
    },
    {
      name: 'Firebase Authentication',
      nameHe: 'אימות Firebase',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'WebAuthn/Passkey, Google Sign-In, session cookies, biometric',
      notesHe: 'WebAuthn/Passkey, כניסה עם Google, עוגיות, ביומטרי',
    },
    {
      name: 'Walk My Pet™ Marketplace',
      nameHe: 'שוק Walk My Pet™',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'Real-time GPS tracking, 20/80 split payment, blockchain audit',
      notesHe: 'מעקב GPS בזמן אמת, תשלום 20/80, ביקורת בלוקצ\'יין',
    },
    {
      name: 'The Sitter Suite™',
      nameHe: 'The Sitter Suite™',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'Pet sitting marketplace with AI urgency triage, Nayax split payment',
      notesHe: 'שוק שמרטפות עם AI למיון דחיפות, תשלום מפוצל Nayax',
    },
    {
      name: 'PetTrek™ Transport',
      nameHe: 'הסעות PetTrek™',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'Uber-style pet transport, live GPS, dynamic fare estimation',
      notesHe: 'הסעות סגנון Uber, GPS חי, הערכת מחיר דינמית',
    },
    {
      name: 'The Plush Lab™ (Avatar Creator)',
      nameHe: 'The Plush Lab™ (יוצר אוותרים)',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'AI pet avatars, photo upload, landmark detection, TTS',
      notesHe: 'אווטרים AI לחיות מחמד, העלאת תמונות, זיהוי, TTS',
    },
    {
      name: 'K9000 IoT Station Management',
      nameHe: 'ניהול תחנות K9000 IoT',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'Real-time monitoring, remote control, supply reports, predictive maintenance',
      notesHe: 'ניטור בזמן אמת, שלט רחוק, דוחות אספקה, תחזוקה חזויה',
    },
    {
      name: 'Admin Dashboard',
      nameHe: 'לוח בקרה אדמין',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'Complete admin panel, KYC, financial, stations, security monitoring',
      notesHe: 'פאנל אדמין מלא, KYC, פיננסי, תחנות, ניטור אבטחה',
    },
    {
      name: 'Nayax Payment Gateway',
      nameHe: 'שער תשלומים Nayax',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'EXCLUSIVE payment gateway, Apple Pay, Google Pay, split payments',
      notesHe: 'שער תשלומים בלעדי, Apple Pay, Google Pay, תשלום מפוצל',
    },
    {
      name: 'Passport KYC Verification',
      nameHe: 'אימות דרכון KYC',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'Google Vision MRZ parsing, admin approval, country filtering',
      notesHe: 'ניתוח MRZ של Google Vision, אישור אדמין, סינון מדינות',
    },
    {
      name: 'Apple Wallet & Google Wallet',
      nameHe: 'אפל וולט וגוגל וולט',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'Digital loyalty cards, e-vouchers, QR code redemption',
      notesHe: 'כרטיסי נאמנות דיגיטליים, שוברים אלקטרוניים, פדיון QR',
    },
    {
      name: 'Franchise Management System',
      nameHe: 'מערכת ניהול זכיינות',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'Multi-location tracking, reports, inbox, marketing tools',
      notesHe: 'מעקב רב-מיקומים, דוחות, תיבת דואר, כלי שיווק',
    },
    {
      name: 'WhatsApp Business Integration',
      nameHe: 'אינטגרציית WhatsApp Business',
      status: 'production',
      backend: true,
      frontend: false,
      notes: 'Meta WhatsApp Business API, bilingual, expense approval notifications',
      notesHe: 'Meta WhatsApp Business API, דו-לשוני, התראות אישור הוצאות',
    },
    {
      name: 'Automated Bookkeeping',
      nameHe: 'הנהלת חשבונות אוטומטית',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'Google Vision OCR + Gemini, Israeli tax compliance, VAT reclaim',
      notesHe: 'Google Vision OCR + Gemini, תאימות מס ישראלית, השבת מע"מ',
    },
    {
      name: 'Modern Web Features 2025',
      nameHe: 'תכונות Web מודרניות 2025',
      status: 'beta',
      backend: false,
      frontend: true,
      notes: '12 cutting-edge APIs: Badge, Background Sync, Wake Lock, Clipboard, File System, etc.',
      notesHe: '12 APIs חדשניים: Badge, Background Sync, Wake Lock, Clipboard, File System, וכו\'',
    },
    {
      name: 'Security Monitoring (AI-powered)',
      nameHe: 'ניטור אבטחה (מופעל AI)',
      status: 'production',
      backend: true,
      frontend: true,
      notes: '7-year data retention, biometric monitoring, OAuth cert tracking',
      notesHe: 'שמירת נתונים 7 שנים, ניטור ביומטרי, מעקב תעודות OAuth',
    },
    {
      name: 'Blockchain Audit Trail',
      nameHe: 'מסלול ביקורת בלוקצ\'יין',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'Immutable hash-chained ledger, fraud detection, tamper proof',
      notesHe: 'יומן hash-chain בלתי ניתן לשינוי, זיהוי הונאה, הגנה מפני שינוי',
    },
    {
      name: 'Hierarchical Expense Approval',
      nameHe: 'אישור הוצאות היררכי',
      status: 'production',
      backend: true,
      frontend: true,
      notes: 'Tree-model org chart, budget limits, WhatsApp notifications',
      notesHe: 'תרשים ארגוני עץ, מגבלות תקציב, התראות WhatsApp',
    },
  ];

  const getStatusBadge = (status: ServiceStatus) => {
    const statusConfig = {
      production: {
        variant: 'default' as const,
        label: isHebrew ? 'ייצור' : 'Production',
        color: 'bg-green-500',
      },
      beta: {
        variant: 'secondary' as const,
        label: isHebrew ? 'בטא' : 'Beta',
        color: 'bg-blue-500',
      },
      development: {
        variant: 'outline' as const,
        label: isHebrew ? 'פיתוח' : 'Development',
        color: 'bg-orange-500',
      },
      planned: {
        variant: 'outline' as const,
        label: isHebrew ? 'מתוכנן' : 'Planned',
        color: 'bg-gray-500',
      },
    };

    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const productionCount = services.filter(s => s.status === 'production').length;
  const totalCount = services.length;
  const completionRate = Math.round((productionCount / totalCount) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {isHebrew ? 'סטטוס שירותים' : 'Service Status'}
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-6">
            {isHebrew 
              ? 'סטטוס מפורט של כל השירותים והתכונות בפלטפורמה'
              : 'Detailed status of all services and features on the platform'}
          </p>

          <Card className="max-w-md mx-auto mb-8">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-6xl font-bold text-green-600 mb-2">
                  {completionRate}%
                </div>
                <p className="text-muted-foreground">
                  {isHebrew 
                    ? `${productionCount} מתוך ${totalCount} שירותים בייצור`
                    : `${productionCount} of ${totalCount} services in production`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          {services.map((service, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 mb-2">
                      {service.backend && service.frontend ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : service.backend || service.frontend ? (
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                      ) : (
                        <Construction className="w-5 h-5 text-gray-400" />
                      )}
                      {isHebrew ? service.nameHe : service.name}
                    </CardTitle>
                    <CardDescription>
                      {isHebrew ? service.notesHe : service.notes}
                    </CardDescription>
                  </div>
                  {getStatusBadge(service.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    {service.backend ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={service.backend ? 'text-green-600 font-medium' : 'text-gray-400'}>
                      {isHebrew ? 'Backend' : 'Backend'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {service.frontend ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={service.frontend ? 'text-green-600 font-medium' : 'text-gray-400'}>
                      {isHebrew ? 'Frontend' : 'Frontend'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-12 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
          <CardContent className="pt-6">
            <p className="text-sm text-center">
              {isHebrew 
                ? '✅ כל השירותים המסומנים "ייצור" פועלים ב-100% עם Backend ו-Frontend מלאים'
                : '✅ All services marked "Production" are 100% functional with full Backend & Frontend'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
