/**
 * Paw Finder™ - FREE Community Service
 * Help reunite lost pets with their owners
 * NO platform fees - Pet Wash™ only connects owners and finders
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { type Language } from '@/lib/i18n';
import { kenzoAvatarService } from '@/services/KenzoAvatarChatService';
import { AIChatAssistant } from '@/components/AIChatAssistant';
import {
  Search,
  Heart,
  MapPin,
  Camera,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle2,
  Gift,
  Sparkles,
  Bot
} from 'lucide-react';

interface PawFinderProps {
  language: Language;
}

export default function PawFinder({ language }: PawFinderProps) {
  const { toast } = useToast();
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [reportType, setReportType] = useState<'lost' | 'found' | null>(null);
  const [formData, setFormData] = useState({
    petName: '',
    petType: '',
    breed: '',
    color: '',
    location: '',
    lastSeen: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    description: '',
    reward: '',
  });

  const isHebrew = language === 'he';

  const handleAskKenzo = async () => {
    setShowAIAssistant(true);
    
    // Pre-fill Kenzo with context about lost pet
    if (formData.petName || formData.petType) {
      const context = isHebrew 
        ? `היי קנזו! אני מחפש ${formData.petType || 'חיית מחמד'} ${formData.petName ? `בשם ${formData.petName}` : ''}. אתה יכול לעזור לי?`
        : `Hi Kenzo! I'm looking for a ${formData.petType || 'pet'} ${formData.petName ? `named ${formData.petName}` : ''}. Can you help me?`;
      
      toast({
        title: isHebrew ? "קנזו מוכן לעזור! 🐾" : "Kenzo is ready to help! 🐾",
        description: isHebrew 
          ? "שאל אותו כל דבר על חיפוש חיות מחמד אבודות"
          : "Ask him anything about finding lost pets",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/paw-finder/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          reportType,
          language,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: isHebrew ? "דיווח נשלח בהצלחה! ✅" : "Report Submitted Successfully! ✅",
          description: data.message,
        });
        
        // Reset form
        setFormData({
          petName: '',
          petType: '',
          breed: '',
          color: '',
          location: '',
          lastSeen: '',
          contactName: '',
          contactPhone: '',
          contactEmail: '',
          description: '',
          reward: '',
        });
        setReportType(null);
      } else {
        throw new Error(data.error || 'Failed to submit report');
      }
    } catch (error: any) {
      toast({
        title: isHebrew ? "שגיאה" : "Error",
        description: error.message || (isHebrew ? "נכשל לשלוח דיווח" : "Failed to submit report"),
        variant: "destructive",
      });
    }
  };

  const content = {
    title: isHebrew ? "Paw Finder™ - מחפשים חיית מחמד שאבדה" : "Paw Finder™ - Find Your Lost Pet",
    subtitle: isHebrew 
      ? "שירות קהילתי חינמי - Pet Wash™ מחברת בין בעלים למוצאים"
      : "FREE Community Service - Pet Wash™ Connects Owners & Finders",
    free: isHebrew ? "חינמי לחלוטין" : "Completely FREE",
    noFees: isHebrew ? "ללא עמלות פלטפורמה" : "No Platform Fees",
    community: isHebrew ? "שירות קהילתי" : "Community Service",
    askKenzo: isHebrew ? "שאל את קנזו על חיפוש חיות מחמד" : "Ask Kenzo About Finding Pets",
    kenzoHelp: isHebrew 
      ? "קנזו, עוזר ה-AI שלנו, יכול לתת לך טיפים למצוא חיית מחמד אבודה, לעזור במילוי הדיווח, ולתת עצות"
      : "Kenzo, our AI assistant, can give you tips for finding lost pets, help fill out the report, and provide advice",
    reportLost: isHebrew ? "דיווח על חיית מחמד שאבדה" : "Report Lost Pet",
    reportFound: isHebrew ? "דיווח על חיית מחמד שנמצאה" : "Report Found Pet",
    howItWorks: isHebrew ? "איך זה עובד?" : "How It Works?",
    step1Title: isHebrew ? "דווח על החיה" : "Report Your Pet",
    step1Desc: isHebrew ? "מלא את הפרטים על חיית המחמד שאבדה או נמצאה" : "Fill in details about the lost or found pet",
    step2Title: isHebrew ? "נשלח התראות" : "We Send Alerts",
    step2Desc: isHebrew ? "נודיע לכל האזור דרך אפליקציית Paw-Connect" : "We'll notify the entire area through the Paw-Connect app",
    step3Title: isHebrew ? "התחברות ישירה" : "Direct Connection",
    step3Desc: isHebrew ? "בעלים ומוצאים מתקשרים ישירות - ללא עמלות" : "Owners and finders connect directly - no fees",
    petName: isHebrew ? "שם חיית המחמד" : "Pet Name",
    petType: isHebrew ? "סוג החיה" : "Pet Type",
    breed: isHebrew ? "גזע" : "Breed",
    color: isHebrew ? "צבע" : "Color",
    location: isHebrew ? "מיקום אחרון" : "Last Seen Location",
    lastSeen: isHebrew ? "נראה לאחרונה" : "Last Seen Date",
    contactName: isHebrew ? "שם איש קשר" : "Contact Name",
    contactPhone: isHebrew ? "טלפון" : "Phone",
    contactEmail: isHebrew ? "אימייל" : "Email",
    description: isHebrew ? "תיאור מפורט" : "Detailed Description",
    reward: isHebrew ? "פרס (אופציונלי)" : "Reward (Optional)",
    submit: isHebrew ? "שלח דיווח" : "Submit Report",
    cancel: isHebrew ? "ביטול" : "Cancel",
  };

  return (
    <div className="min-h-screen luxury-bg-mesh py-12 px-4">
      <div className="container mx-auto max-w-6xl luxury-animate-fade-in">
        {/* Luxury Hero */}
        <div className="text-center mb-12 luxury-animate-slide-up">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Search className="w-14 h-14 text-purple-600" />
            <Heart className="w-12 h-12 text-red-500 animate-pulse" />
          </div>
          <h1 className="luxury-heading-xl mb-6">
            {content.title}
          </h1>
          <p className="luxury-text-body max-w-3xl mx-auto mb-8">
            {content.subtitle}
          </p>
          
          <div className="flex gap-4 justify-center flex-wrap luxury-gap-md">
            <div className="luxury-badge-success">
              <Gift className="w-4 h-4 mr-2" />
              {content.free}
            </div>
            <div className="luxury-badge-success">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {content.noFees}
            </div>
            <div className="luxury-badge">
              <Heart className="w-4 h-4 mr-2" />
              {content.community}
            </div>
          </div>
        </div>

        {/* Ask Kenzo AI Assistant */}
        <div className="luxury-glass-card luxury-shadow-xl mb-8 luxury-animate-slide-up luxury-delay-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 luxury-heading-md luxury-text-gradient">
              <Bot className="w-6 h-6" />
              <Sparkles className="w-5 h-5 text-yellow-500" />
              {content.askKenzo}
            </CardTitle>
            <CardDescription className="luxury-text-body">{content.kenzoHelp}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleAskKenzo}
              className="w-full luxury-btn-primary"
              size="lg"
            >
              <Bot className="w-5 h-5 mr-2" />
              {isHebrew ? "פתח צ'אט עם קנזו 🐾" : "Open Chat with Kenzo 🐾"}
            </Button>
          </CardContent>
        </div>

        {/* How It Works */}
        <div className="luxury-grid-3 mb-12">
          <div className="luxury-glass-card luxury-hover-lift luxury-animate-scale-in luxury-delay-2">
            <CardHeader>
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/50 dark:to-blue-900/50 flex items-center justify-center mb-4 luxury-shadow-md">
                <AlertCircle className="w-7 h-7 text-purple-600" />
              </div>
              <CardTitle className="luxury-heading-sm luxury-text-gradient">1. {content.step1Title}</CardTitle>
              <CardDescription className="luxury-text-body">{content.step1Desc}</CardDescription>
            </CardHeader>
          </div>

          <div className="luxury-glass-card luxury-hover-lift luxury-animate-scale-in luxury-delay-3">
            <CardHeader>
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/50 dark:to-blue-900/50 flex items-center justify-center mb-4 luxury-shadow-md">
                <MapPin className="w-7 h-7 text-purple-600" />
              </div>
              <CardTitle className="luxury-heading-sm luxury-text-gradient">2. {content.step2Title}</CardTitle>
              <CardDescription className="luxury-text-body">{content.step2Desc}</CardDescription>
            </CardHeader>
          </div>

          <div className="luxury-glass-card luxury-hover-lift luxury-animate-scale-in luxury-delay-4">
            <CardHeader>
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/50 dark:to-blue-900/50 flex items-center justify-center mb-4 luxury-shadow-md">
                <Heart className="w-7 h-7 text-green-600" />
              </div>
              <CardTitle className="luxury-heading-sm luxury-text-gradient">3. {content.step3Title}</CardTitle>
              <CardDescription className="luxury-text-body">{content.step3Desc}</CardDescription>
            </CardHeader>
          </div>
        </div>

        {/* Report Selection */}
        {!reportType ? (
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div 
              className="luxury-glass-card luxury-hover-lift luxury-animate-scale-in luxury-delay-5 cursor-pointer"
              onClick={() => setReportType('lost')}
            >
              <CardHeader className="text-center">
                <Search className="w-20 h-20 mx-auto mb-6 text-red-500" />
                <CardTitle className="luxury-heading-md luxury-text-gradient mb-3">{content.reportLost}</CardTitle>
                <CardDescription className="luxury-text-body">
                  {isHebrew ? "חיית המחמד שלי אבדה" : "I've lost my pet"}
                </CardDescription>
              </CardHeader>
            </div>

            <div 
              className="luxury-glass-card luxury-hover-lift luxury-animate-scale-in luxury-delay-6 cursor-pointer"
              onClick={() => setReportType('found')}
            >
              <CardHeader className="text-center">
                <Heart className="w-20 h-20 mx-auto mb-6 text-green-500" />
                <CardTitle className="luxury-heading-md luxury-text-gradient mb-3">{content.reportFound}</CardTitle>
                <CardDescription className="luxury-text-body">
                  {isHebrew ? "מצאתי חיית מחמד" : "I've found a pet"}
                </CardDescription>
              </CardHeader>
            </div>
          </div>
        ) : (
          /* Report Form */
          <div className="max-w-3xl mx-auto luxury-glass-card luxury-shadow-xl luxury-animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 luxury-heading-md luxury-text-gradient">
                {reportType === 'lost' ? (
                  <>
                    <Search className="w-6 h-6 text-red-500" />
                    {content.reportLost}
                  </>
                ) : (
                  <>
                    <Heart className="w-6 h-6 text-green-500" />
                    {content.reportFound}
                  </>
                )}
              </CardTitle>
              <CardDescription className="luxury-text-body">
                {isHebrew 
                  ? "מלא את כל הפרטים לעזור לנו למצוא את חיית המחמד"
                  : "Fill in all details to help us find the pet"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {content.petName} *
                    </label>
                    <Input
                      required
                      value={formData.petName}
                      onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                      placeholder={isHebrew ? "לדוגמה: מקס" : "e.g., Max"}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {content.petType} *
                    </label>
                    <Input
                      required
                      value={formData.petType}
                      onChange={(e) => setFormData({ ...formData, petType: e.target.value })}
                      placeholder={isHebrew ? "כלב, חתול, ארנב..." : "Dog, Cat, Rabbit..."}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {content.breed}
                    </label>
                    <Input
                      value={formData.breed}
                      onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                      placeholder={isHebrew ? "גזע החיה" : "Pet breed"}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {content.color}
                    </label>
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder={isHebrew ? "צבע החיה" : "Pet color"}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      {content.location} *
                    </label>
                    <Input
                      required
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder={isHebrew ? "כתובת מדויקת" : "Exact address"}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {content.lastSeen}
                    </label>
                    <Input
                      type="datetime-local"
                      value={formData.lastSeen}
                      onChange={(e) => setFormData({ ...formData, lastSeen: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {content.contactName} *
                    </label>
                    <Input
                      required
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <Phone className="w-4 h-4 inline mr-1" />
                      {content.contactPhone} *
                    </label>
                    <Input
                      required
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      placeholder="+972-XX-XXX-XXXX"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      <Mail className="w-4 h-4 inline mr-1" />
                      {content.contactEmail}
                    </label>
                    <Input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      {content.description} *
                    </label>
                    <Textarea
                      required
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={isHebrew 
                        ? "תאר את חיית המחמד, סימנים מיוחדים, התנהגות..."
                        : "Describe the pet, special marks, behavior..."}
                      rows={4}
                    />
                  </div>

                  {reportType === 'lost' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2">
                        <Gift className="w-4 h-4 inline mr-1" />
                        {content.reward}
                      </label>
                      <Input
                        value={formData.reward}
                        onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                        placeholder={isHebrew ? "פרס למוצא (אופציונלי)" : "Reward for finder (optional)"}
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button 
                    type="submit" 
                    className="flex-1 luxury-btn-primary"
                    size="lg"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    {content.submit}
                  </Button>
                  <Button 
                    type="button"
                    className="luxury-btn-secondary"
                    onClick={() => setReportType(null)}
                    size="lg"
                  >
                    {content.cancel}
                  </Button>
                </div>
              </form>
            </CardContent>
          </div>
        )}

        {/* Important Note */}
        <div className="max-w-3xl mx-auto mt-8 luxury-glass-card luxury-shadow-lg bg-gradient-to-br from-yellow-50/80 to-orange-50/80 dark:from-yellow-950/50 dark:to-orange-950/50 luxury-animate-fade-in luxury-delay-7">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Heart className="w-6 h-6 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="luxury-heading-sm luxury-text-gradient mb-2">
                  {isHebrew ? "שירות קהילתי חינמי 100%" : "100% Free Community Service"}
                </p>
                <p className="luxury-text-body">
                  {isHebrew 
                    ? "Pet Wash™ מחברת בין בעלים למוצאים בחינם. אין עמלות פלטפורמה. בעלים משלמים למוצאים ישירות אם רוצים. אנחנו כאן כדי לעזור לקהילה! 🐾"
                    : "Pet Wash™ connects owners and finders for free. No platform fees. Owners pay finders directly if they wish. We're here to help the community! 🐾"}
                </p>
              </div>
            </div>
          </CardContent>
        </div>
      </div>

      {/* Kenzo AI Assistant */}
      {showAIAssistant && (
        <AIChatAssistant 
          language={language}
          isOpen={showAIAssistant}
          onClose={() => setShowAIAssistant(false)}
        />
      )}
    </div>
  );
}
