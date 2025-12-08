import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  XCircle,
  FileText,
  MapPin,
  Calendar,
  ChevronRight,
  AlertCircle,
  Search,
  Eye,
  RefreshCw,
  Upload,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const statusConfig: Record<string, { color: string; bgColor: string; icon: any; label: string; labelHe: string }> = {
  draft: { color: 'text-gray-600', bgColor: 'bg-gray-100', icon: FileText, label: 'Draft', labelHe: 'טיוטה' },
  pending: { color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Clock, label: 'Pending Review', labelHe: 'בהמתנה לבדיקה' },
  under_review: { color: 'text-amber-600', bgColor: 'bg-amber-100', icon: Eye, label: 'Under Review', labelHe: 'בבדיקה' },
  interview_scheduled: { color: 'text-purple-600', bgColor: 'bg-purple-100', icon: Calendar, label: 'Interview Scheduled', labelHe: 'ראיון נקבע' },
  approved: { color: 'text-emerald-600', bgColor: 'bg-emerald-100', icon: CheckCircle2, label: 'Approved', labelHe: 'אושר' },
  rejected: { color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle, label: 'Not Selected', labelHe: 'לא נבחר' },
  withdrawn: { color: 'text-gray-500', bgColor: 'bg-gray-100', icon: XCircle, label: 'Withdrawn', labelHe: 'נמשך' },
};

const roleColors: Record<string, string> = {
  walker: 'from-pink-500 to-rose-600',
  driver: 'from-blue-500 to-indigo-600',
  sitter: 'from-purple-500 to-violet-600',
  host: 'from-amber-500 to-orange-600',
  supplier: 'from-emerald-500 to-teal-600',
  admin: 'from-slate-500 to-gray-600',
  trainer: 'from-yellow-500 to-amber-600',
};

interface Application {
  id: number;
  applicationId: string;
  positionId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  reviewStage: string | null;
  createdAt: string;
  submittedAt: string | null;
  positionTitle: string;
  positionTitleHe: string | null;
  roleType: string;
  location: string;
  documents: Array<{ documentType: string; fileName: string; uploadedAt: string | null }>;
}

export default function MyApplications() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isRTL = i18n.language === 'he' || i18n.language === 'ar';
  
  const [email, setEmail] = useState('');
  const [searchedEmail, setSearchedEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const { data: applications, isLoading, refetch, isRefetching } = useQuery<Application[]>({
    queryKey: ['/api/careers/my-applications', searchedEmail],
    queryFn: async () => {
      const response = await fetch(`/api/careers/my-applications?email=${encodeURIComponent(searchedEmail)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch applications');
      }
      return response.json();
    },
    enabled: !!searchedEmail,
  });
  
  const handleSearch = () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: isRTL ? 'שגיאה' : 'Error',
        description: isRTL ? 'אנא הזן כתובת אימייל תקינה' : 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }
    setSearchedEmail(email);
    setIsSearching(true);
  };
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white py-16">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto"
          >
            <Badge className="bg-white/20 text-white border-white/30 mb-4">
              {isRTL ? 'לוח המועמדות שלי' : 'My Applications Dashboard'}
            </Badge>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Didot, Georgia, serif' }}>
              {isRTL ? 'עקוב אחר המועמדויות שלך' : 'Track Your Applications'}
            </h1>
            
            <p className="text-lg text-emerald-100 mb-8">
              {isRTL 
                ? 'הזן את האימייל שלך לצפייה בסטטוס המועמדויות שלך'
                : 'Enter your email to view your application status'}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <Input
                type="email"
                placeholder={isRTL ? 'הזן את האימייל שלך' : 'Enter your email'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/60 focus:border-white"
                data-testid="input-search-email"
              />
              <Button 
                onClick={handleSearch}
                className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold"
                disabled={isLoading || isRefetching}
                data-testid="button-search-applications"
              >
                {isLoading || isRefetching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 me-2" />
                    {isRTL ? 'חפש' : 'Search'}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* Applications List */}
      <section className="py-12">
        <div className="container mx-auto px-6">
          {!isSearching ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
                <Briefcase className="w-10 h-10 text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                {isRTL ? 'הזן את האימייל שלך למעלה' : 'Enter Your Email Above'}
              </h2>
              <p className="text-gray-600 max-w-md mx-auto">
                {isRTL 
                  ? 'הזן את כתובת האימייל שבה השתמשת להגשת המועמדות שלך לצפייה בסטטוס'
                  : 'Enter the email address you used when submitting your application to view your status'}
              </p>
            </motion.div>
          ) : isLoading ? (
            <div className="text-center py-16">
              <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-gray-600">{isRTL ? 'טוען...' : 'Loading...'}</p>
            </div>
          ) : !applications || applications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-amber-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                {isRTL ? 'לא נמצאו מועמדויות' : 'No Applications Found'}
              </h2>
              <p className="text-gray-600 max-w-md mx-auto mb-6">
                {isRTL 
                  ? `לא נמצאו מועמדויות עבור ${searchedEmail}`
                  : `No applications found for ${searchedEmail}`}
              </p>
              <Link href="/careers">
                <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-browse-positions">
                  {isRTL ? 'עיין במשרות פתוחות' : 'Browse Open Positions'}
                  <ChevronRight className="w-4 h-4 ms-2" />
                </Button>
              </Link>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {isRTL ? 'המועמדויות שלי' : 'My Applications'}
                  </h2>
                  <p className="text-gray-600">
                    {isRTL 
                      ? `נמצאו ${applications.length} מועמדויות עבור ${searchedEmail}`
                      : `Found ${applications.length} application(s) for ${searchedEmail}`}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  data-testid="button-refresh"
                >
                  <RefreshCw className={`w-4 h-4 me-2 ${isRefetching ? 'animate-spin' : ''}`} />
                  {isRTL ? 'רענן' : 'Refresh'}
                </Button>
              </div>
              
              <AnimatePresence>
                {applications.map((app, index) => {
                  const status = statusConfig[app.status] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  
                  return (
                    <motion.div
                      key={app.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="overflow-hidden hover:shadow-lg transition-shadow" data-testid={`card-application-${app.id}`}>
                        <div className={`h-2 bg-gradient-to-r ${roleColors[app.roleType] || 'from-emerald-500 to-teal-600'}`} />
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-bold text-gray-900">
                                  {isRTL ? app.positionTitleHe || app.positionTitle : app.positionTitle}
                                </h3>
                                <Badge className={`${status.bgColor} ${status.color} border-0`}>
                                  <StatusIcon className="w-3 h-3 me-1" />
                                  {isRTL ? status.labelHe : status.label}
                                </Badge>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {app.location}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {isRTL ? 'הוגש: ' : 'Applied: '}{formatDate(app.submittedAt || app.createdAt)}
                                </span>
                                {app.documents.length > 0 && (
                                  <span className="flex items-center gap-1 text-emerald-600">
                                    <FileText className="w-4 h-4" />
                                    {app.documents.length} {isRTL ? 'מסמכים' : 'document(s)'}
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-sm text-gray-500">
                                {isRTL ? 'מזהה מועמדות: ' : 'Application ID: '}{app.applicationId}
                              </p>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                              {app.status === 'draft' && (
                                <Link href="/careers">
                                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid={`button-resume-${app.id}`}>
                                    {isRTL ? 'המשך מועמדות' : 'Resume Application'}
                                    <ChevronRight className="w-4 h-4 ms-2" />
                                  </Button>
                                </Link>
                              )}
                              {app.status !== 'draft' && app.documents.length === 0 && (
                                <Button variant="outline" className="w-full" data-testid={`button-upload-docs-${app.id}`}>
                                  <Upload className="w-4 h-4 me-2" />
                                  {isRTL ? 'העלה מסמכים' : 'Upload Documents'}
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {/* Status Timeline for non-draft applications */}
                          {app.status !== 'draft' && (
                            <div className="mt-6 pt-4 border-t">
                              <div className="flex items-center justify-between relative">
                                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2" />
                                
                                {['pending', 'under_review', 'interview_scheduled', 'approved'].map((step, idx) => {
                                  const stepStatus = statusConfig[step];
                                  const StepIcon = stepStatus.icon;
                                  const isActive = ['pending', 'under_review', 'interview_scheduled', 'approved'].indexOf(app.status) >= idx;
                                  const isCurrent = app.status === step;
                                  
                                  return (
                                    <div key={step} className="flex flex-col items-center relative z-10">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        isCurrent ? stepStatus.bgColor : isActive ? 'bg-emerald-100' : 'bg-gray-100'
                                      } ${isCurrent ? 'ring-2 ring-offset-2 ring-emerald-500' : ''}`}>
                                        <StepIcon className={`w-4 h-4 ${
                                          isCurrent ? stepStatus.color : isActive ? 'text-emerald-600' : 'text-gray-400'
                                        }`} />
                                      </div>
                                      <span className={`text-xs mt-1 ${isCurrent ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                                        {isRTL ? stepStatus.labelHe : stepStatus.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              
              <div className="text-center pt-8">
                <Link href="/careers">
                  <Button variant="outline" data-testid="button-view-more-positions">
                    {isRTL ? 'צפה במשרות נוספות' : 'View More Positions'}
                    <ChevronRight className="w-4 h-4 ms-2" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
