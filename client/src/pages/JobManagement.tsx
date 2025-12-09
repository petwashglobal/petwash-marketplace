import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Edit2, 
  Archive,
  Eye,
  EyeOff,
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  Users,
  Star,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  X,
  ChevronDown,
  Filter,
  RefreshCw,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Position {
  id: number;
  positionId: string;
  title: string;
  titleHe: string | null;
  department: string;
  roleType: string;
  shortDescription: string;
  shortDescriptionHe: string | null;
  fullDescription: string;
  fullDescriptionHe: string | null;
  location: string;
  locationType: string;
  employmentType: string;
  salaryRangeMin: string | null;
  salaryRangeMax: string | null;
  salaryCurrency: string;
  salaryPeriod: string;
  requirements: string[] | null;
  requirementsHe: string[] | null;
  qualifications: string[] | null;
  benefits: string[] | null;
  isActive: boolean;
  isFeatured: boolean;
  urgencyLevel: string;
  openPositions: number;
  requiresResume: boolean;
  requiresCoverLetter: boolean;
  requiresBackgroundCheck: boolean;
  requiresDrivingLicense: boolean;
  minimumAge: number;
  viewCount: number;
  applicationCount: number;
  createdAt: string;
  publishedAt: string | null;
  expiresAt: string | null;
}

const roleColors: Record<string, { bg: string; text: string; gradient: string }> = {
  walker: { bg: 'bg-pink-100', text: 'text-pink-700', gradient: 'from-pink-500 to-rose-600' },
  driver: { bg: 'bg-blue-100', text: 'text-blue-700', gradient: 'from-blue-500 to-indigo-600' },
  sitter: { bg: 'bg-purple-100', text: 'text-purple-700', gradient: 'from-purple-500 to-violet-600' },
  host: { bg: 'bg-amber-100', text: 'text-amber-700', gradient: 'from-amber-500 to-orange-600' },
  supplier: { bg: 'bg-emerald-100', text: 'text-emerald-700', gradient: 'from-emerald-500 to-teal-600' },
  admin: { bg: 'bg-slate-100', text: 'text-slate-700', gradient: 'from-slate-500 to-gray-600' },
  trainer: { bg: 'bg-yellow-100', text: 'text-yellow-700', gradient: 'from-yellow-500 to-amber-600' },
};

const defaultFormData = {
  title: '',
  titleHe: '',
  department: 'operations',
  roleType: 'walker',
  shortDescription: '',
  shortDescriptionHe: '',
  fullDescription: '',
  fullDescriptionHe: '',
  location: 'Tel Aviv, Israel',
  locationType: 'field',
  employmentType: 'contractor',
  salaryRangeMin: '',
  salaryRangeMax: '',
  salaryCurrency: 'ILS',
  salaryPeriod: 'hourly',
  requirements: '',
  requirementsHe: '',
  qualifications: '',
  benefits: '',
  isActive: true,
  isFeatured: false,
  urgencyLevel: 'normal',
  openPositions: 1,
  requiresResume: true,
  requiresCoverLetter: false,
  requiresBackgroundCheck: true,
  requiresDrivingLicense: false,
  minimumAge: 18,
};

export default function JobManagement() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isRTL = i18n.language === 'he' || i18n.language === 'ar';
  
  const [showEditor, setShowEditor] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [roleFilter, setRoleFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  
  const { data: positions, isLoading, refetch } = useQuery<Position[]>({
    queryKey: ['/api/careers/admin/positions', roleFilter, activeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (roleFilter !== 'all') params.append('roleType', roleFilter);
      if (activeFilter !== 'all') params.append('isActive', activeFilter);
      const response = await fetch(`/api/careers/admin/positions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch positions');
      return response.json();
    },
  });
  
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/careers/admin/positions', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: isRTL ? 'משרה נוצרה' : 'Position Created',
        description: isRTL ? 'המשרה נוצרה בהצלחה' : 'Job position created successfully',
      });
      setShowEditor(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: isRTL ? 'שגיאה' : 'Error',
        description: error.message || (isRTL ? 'יצירת המשרה נכשלה' : 'Failed to create position'),
        variant: 'destructive',
      });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest('PATCH', `/api/careers/admin/positions/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: isRTL ? 'משרה עודכנה' : 'Position Updated',
        description: isRTL ? 'המשרה עודכנה בהצלחה' : 'Job position updated successfully',
      });
      setShowEditor(false);
      setEditingPosition(null);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: isRTL ? 'שגיאה' : 'Error',
        description: error.message || (isRTL ? 'עדכון המשרה נכשל' : 'Failed to update position'),
        variant: 'destructive',
      });
    },
  });
  
  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/careers/admin/positions/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: isRTL ? 'משרה הועברה לארכיון' : 'Position Archived',
        description: isRTL ? 'המשרה הועברה לארכיון' : 'Job position archived successfully',
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: isRTL ? 'שגיאה' : 'Error',
        description: error.message || (isRTL ? 'העברה לארכיון נכשלה' : 'Failed to archive position'),
        variant: 'destructive',
      });
    },
  });
  
  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingPosition(null);
  };
  
  const handleEdit = (position: Position) => {
    setEditingPosition(position);
    setFormData({
      title: position.title || '',
      titleHe: position.titleHe || '',
      department: position.department || 'operations',
      roleType: position.roleType || 'walker',
      shortDescription: position.shortDescription || '',
      shortDescriptionHe: position.shortDescriptionHe || '',
      fullDescription: position.fullDescription || '',
      fullDescriptionHe: position.fullDescriptionHe || '',
      location: position.location || 'Tel Aviv, Israel',
      locationType: position.locationType || 'field',
      employmentType: position.employmentType || 'contractor',
      salaryRangeMin: position.salaryRangeMin || '',
      salaryRangeMax: position.salaryRangeMax || '',
      salaryCurrency: position.salaryCurrency || 'ILS',
      salaryPeriod: position.salaryPeriod || 'hourly',
      requirements: Array.isArray(position.requirements) ? position.requirements.join('\n') : '',
      requirementsHe: Array.isArray(position.requirementsHe) ? position.requirementsHe.join('\n') : '',
      qualifications: Array.isArray(position.qualifications) ? position.qualifications.join('\n') : '',
      benefits: Array.isArray(position.benefits) ? position.benefits.join('\n') : '',
      isActive: position.isActive ?? true,
      isFeatured: position.isFeatured ?? false,
      urgencyLevel: position.urgencyLevel || 'normal',
      openPositions: position.openPositions || 1,
      requiresResume: position.requiresResume ?? true,
      requiresCoverLetter: position.requiresCoverLetter ?? false,
      requiresBackgroundCheck: position.requiresBackgroundCheck ?? true,
      requiresDrivingLicense: position.requiresDrivingLicense ?? false,
      minimumAge: position.minimumAge || 18,
    });
    setShowEditor(true);
  };
  
  const handleSubmit = () => {
    const submitData = {
      ...formData,
      salaryRangeMin: formData.salaryRangeMin ? parseFloat(formData.salaryRangeMin) : null,
      salaryRangeMax: formData.salaryRangeMax ? parseFloat(formData.salaryRangeMax) : null,
      requirements: formData.requirements.split('\n').filter(r => r.trim()),
      requirementsHe: formData.requirementsHe.split('\n').filter(r => r.trim()),
      qualifications: formData.qualifications.split('\n').filter(r => r.trim()),
      benefits: formData.benefits.split('\n').filter(r => r.trim()),
    };
    
    if (editingPosition) {
      updateMutation.mutate({ id: editingPosition.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };
  
  const handleToggleActive = (position: Position) => {
    updateMutation.mutate({ id: position.id, data: { isActive: !position.isActive } });
  };

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isRTL ? 'ניהול משרות' : 'Job Advertisement Management'}
              </h1>
              <p className="text-gray-600 text-sm">
                {isRTL ? 'צור, ערוך ונהל פרסומי משרות פתוחות' : 'Create, edit and manage open job postings'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
                <RefreshCw className="w-4 h-4 me-2" />
                {isRTL ? 'רענן' : 'Refresh'}
              </Button>
              <Button 
                onClick={() => { resetForm(); setShowEditor(true); }}
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="button-create-job"
              >
                <Plus className="w-4 h-4 me-2" />
                {isRTL ? 'צור משרה חדשה' : 'Create New Job'}
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Filters */}
      <section className="py-4">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40" data-testid="select-role-filter">
                <Briefcase className="w-4 h-4 me-2" />
                <SelectValue placeholder={isRTL ? 'תפקיד' : 'Role Type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'כל התפקידים' : 'All Roles'}</SelectItem>
                <SelectItem value="walker">{isRTL ? 'מטייל כלבים' : 'Pet Walker'}</SelectItem>
                <SelectItem value="driver">{isRTL ? 'נהג' : 'Driver'}</SelectItem>
                <SelectItem value="sitter">{isRTL ? 'שומר חיות' : 'Pet Sitter'}</SelectItem>
                <SelectItem value="host">{isRTL ? 'מארח' : 'Pet Host'}</SelectItem>
                <SelectItem value="supplier">{isRTL ? 'ספק' : 'Supplier'}</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="w-36" data-testid="select-status-filter">
                <Filter className="w-4 h-4 me-2" />
                <SelectValue placeholder={isRTL ? 'סטטוס' : 'Status'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'הכל' : 'All'}</SelectItem>
                <SelectItem value="true">{isRTL ? 'פעיל' : 'Active'}</SelectItem>
                <SelectItem value="false">{isRTL ? 'לא פעיל' : 'Inactive'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
      
      {/* Jobs Grid */}
      <section className="pb-12">
        <div className="container mx-auto px-6">
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-gray-600">{isRTL ? 'טוען משרות...' : 'Loading jobs...'}</p>
            </div>
          ) : !positions?.length ? (
            <div className="text-center py-12">
              <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">{isRTL ? 'לא נמצאו משרות' : 'No jobs found'}</p>
              <Button 
                onClick={() => { resetForm(); setShowEditor(true); }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 me-2" />
                {isRTL ? 'צור משרה ראשונה' : 'Create First Job'}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {positions.map((position, index) => {
                  const roleStyle = roleColors[position.roleType] || roleColors.walker;
                  
                  return (
                    <motion.div
                      key={position.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className={`relative overflow-hidden ${!position.isActive ? 'opacity-60' : ''}`} data-testid={`card-job-${position.id}`}>
                        {/* Role gradient top bar */}
                        <div className={`h-2 bg-gradient-to-r ${roleStyle.gradient}`} />
                        
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">
                                {isRTL ? position.titleHe || position.title : position.title}
                              </CardTitle>
                              <p className="text-sm text-gray-500">{position.positionId}</p>
                            </div>
                            <div className="flex gap-1">
                              {position.isFeatured && (
                                <Badge className="bg-amber-100 text-amber-700 border-0">
                                  <Star className="w-3 h-3 me-1" />
                                  {isRTL ? 'מומלץ' : 'Featured'}
                                </Badge>
                              )}
                              {position.urgencyLevel === 'urgent' && (
                                <Badge className="bg-red-100 text-red-700 border-0">
                                  <Zap className="w-3 h-3 me-1" />
                                  {isRTL ? 'דחוף' : 'Urgent'}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-4">
                          <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {position.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {position.employmentType}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {position.openPositions} {isRTL ? 'משרות' : 'positions'}
                            </span>
                          </div>
                          
                          {(position.salaryRangeMin || position.salaryRangeMax) && (
                            <div className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                              <DollarSign className="w-4 h-4" />
                              {position.salaryCurrency} {position.salaryRangeMin}
                              {position.salaryRangeMax && ` - ${position.salaryRangeMax}`}
                              /{position.salaryPeriod}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <span>{position.viewCount} {isRTL ? 'צפיות' : 'views'}</span>
                            <span>{position.applicationCount} {isRTL ? 'מועמדויות' : 'applications'}</span>
                          </div>
                          
                          <div className="flex items-center justify-between pt-3 border-t">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={position.isActive}
                                onCheckedChange={() => handleToggleActive(position)}
                                data-testid={`switch-active-${position.id}`}
                              />
                              <span className="text-sm text-gray-600">
                                {position.isActive ? (isRTL ? 'פעיל' : 'Active') : (isRTL ? 'לא פעיל' : 'Inactive')}
                              </span>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(position)}
                                data-testid={`button-edit-${position.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => archiveMutation.mutate(position.id)}
                                className="text-red-600 hover:text-red-700"
                                data-testid={`button-archive-${position.id}`}
                              >
                                <Archive className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </section>
      
      {/* Job Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPosition 
                ? (isRTL ? 'ערוך משרה' : 'Edit Job Position')
                : (isRTL ? 'צור משרה חדשה' : 'Create New Job Position')}
            </DialogTitle>
            <DialogDescription>
              {isRTL ? 'מלא את כל הפרטים ליצירת פרסום משרה' : 'Fill in all details to create a job advertisement'}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">{isRTL ? 'פרטים בסיסיים' : 'Basic Info'}</TabsTrigger>
              <TabsTrigger value="description">{isRTL ? 'תיאור' : 'Description'}</TabsTrigger>
              <TabsTrigger value="requirements">{isRTL ? 'דרישות' : 'Requirements'}</TabsTrigger>
              <TabsTrigger value="settings">{isRTL ? 'הגדרות' : 'Settings'}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{isRTL ? 'כותרת (אנגלית)' : 'Title (English)'}</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Professional Pet Walker"
                    data-testid="input-title"
                  />
                </div>
                <div>
                  <Label>{isRTL ? 'כותרת (עברית)' : 'Title (Hebrew)'}</Label>
                  <Input
                    value={formData.titleHe}
                    onChange={(e) => setFormData({ ...formData, titleHe: e.target.value })}
                    placeholder="לדוגמה: מטייל כלבים מקצועי"
                    dir="rtl"
                    data-testid="input-title-he"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{isRTL ? 'סוג תפקיד' : 'Role Type'}</Label>
                  <Select value={formData.roleType} onValueChange={(v) => setFormData({ ...formData, roleType: v })}>
                    <SelectTrigger data-testid="select-role-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walker">{isRTL ? 'מטייל כלבים' : 'Pet Walker'}</SelectItem>
                      <SelectItem value="driver">{isRTL ? 'נהג' : 'Driver'}</SelectItem>
                      <SelectItem value="sitter">{isRTL ? 'שומר חיות' : 'Pet Sitter'}</SelectItem>
                      <SelectItem value="host">{isRTL ? 'מארח' : 'Pet Host'}</SelectItem>
                      <SelectItem value="supplier">{isRTL ? 'ספק' : 'Supplier'}</SelectItem>
                      <SelectItem value="trainer">{isRTL ? 'מאלף' : 'Trainer'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isRTL ? 'מחלקה' : 'Department'}</Label>
                  <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                    <SelectTrigger data-testid="select-department">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operations">{isRTL ? 'תפעול' : 'Operations'}</SelectItem>
                      <SelectItem value="logistics">{isRTL ? 'לוגיסטיקה' : 'Logistics'}</SelectItem>
                      <SelectItem value="care">{isRTL ? 'טיפול' : 'Care'}</SelectItem>
                      <SelectItem value="admin">{isRTL ? 'ניהול' : 'Admin'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{isRTL ? 'מיקום' : 'Location'}</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Tel Aviv, Israel"
                    data-testid="input-location"
                  />
                </div>
                <div>
                  <Label>{isRTL ? 'סוג מיקום' : 'Location Type'}</Label>
                  <Select value={formData.locationType} onValueChange={(v) => setFormData({ ...formData, locationType: v })}>
                    <SelectTrigger data-testid="select-location-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="field">{isRTL ? 'שטח' : 'Field Work'}</SelectItem>
                      <SelectItem value="onsite">{isRTL ? 'במשרד' : 'On-site'}</SelectItem>
                      <SelectItem value="remote">{isRTL ? 'מרחוק' : 'Remote'}</SelectItem>
                      <SelectItem value="hybrid">{isRTL ? 'היברידי' : 'Hybrid'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>{isRTL ? 'סוג העסקה' : 'Employment Type'}</Label>
                  <Select value={formData.employmentType} onValueChange={(v) => setFormData({ ...formData, employmentType: v })}>
                    <SelectTrigger data-testid="select-employment-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contractor">{isRTL ? 'קבלן עצמאי' : 'Contractor'}</SelectItem>
                      <SelectItem value="part-time">{isRTL ? 'חלקי' : 'Part-time'}</SelectItem>
                      <SelectItem value="full-time">{isRTL ? 'מלא' : 'Full-time'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isRTL ? 'רמת דחיפות' : 'Urgency Level'}</Label>
                  <Select value={formData.urgencyLevel} onValueChange={(v) => setFormData({ ...formData, urgencyLevel: v })}>
                    <SelectTrigger data-testid="select-urgency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">{isRTL ? 'רגיל' : 'Normal'}</SelectItem>
                      <SelectItem value="urgent">{isRTL ? 'דחוף' : 'Urgent'}</SelectItem>
                      <SelectItem value="critical">{isRTL ? 'קריטי' : 'Critical'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isRTL ? 'מספר משרות פתוחות' : 'Open Positions'}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.openPositions}
                    onChange={(e) => setFormData({ ...formData, openPositions: parseInt(e.target.value) || 1 })}
                    data-testid="input-open-positions"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>{isRTL ? 'שכר מינימום' : 'Min Salary'}</Label>
                  <Input
                    type="number"
                    value={formData.salaryRangeMin}
                    onChange={(e) => setFormData({ ...formData, salaryRangeMin: e.target.value })}
                    placeholder="50"
                    data-testid="input-salary-min"
                  />
                </div>
                <div>
                  <Label>{isRTL ? 'שכר מקסימום' : 'Max Salary'}</Label>
                  <Input
                    type="number"
                    value={formData.salaryRangeMax}
                    onChange={(e) => setFormData({ ...formData, salaryRangeMax: e.target.value })}
                    placeholder="100"
                    data-testid="input-salary-max"
                  />
                </div>
                <div>
                  <Label>{isRTL ? 'מטבע' : 'Currency'}</Label>
                  <Select value={formData.salaryCurrency} onValueChange={(v) => setFormData({ ...formData, salaryCurrency: v })}>
                    <SelectTrigger data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ILS">₪ ILS</SelectItem>
                      <SelectItem value="USD">$ USD</SelectItem>
                      <SelectItem value="EUR">€ EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isRTL ? 'תקופה' : 'Period'}</Label>
                  <Select value={formData.salaryPeriod} onValueChange={(v) => setFormData({ ...formData, salaryPeriod: v })}>
                    <SelectTrigger data-testid="select-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">{isRTL ? 'שעתי' : 'Hourly'}</SelectItem>
                      <SelectItem value="daily">{isRTL ? 'יומי' : 'Daily'}</SelectItem>
                      <SelectItem value="weekly">{isRTL ? 'שבועי' : 'Weekly'}</SelectItem>
                      <SelectItem value="monthly">{isRTL ? 'חודשי' : 'Monthly'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="description" className="space-y-4 mt-4">
              <div>
                <Label>{isRTL ? 'תיאור קצר (אנגלית)' : 'Short Description (English)'}</Label>
                <Textarea
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  placeholder="Brief summary shown in job listings..."
                  rows={2}
                  data-testid="textarea-short-desc"
                />
              </div>
              <div>
                <Label>{isRTL ? 'תיאור קצר (עברית)' : 'Short Description (Hebrew)'}</Label>
                <Textarea
                  value={formData.shortDescriptionHe}
                  onChange={(e) => setFormData({ ...formData, shortDescriptionHe: e.target.value })}
                  placeholder="תקציר קצר שמוצג ברשימת המשרות..."
                  rows={2}
                  dir="rtl"
                  data-testid="textarea-short-desc-he"
                />
              </div>
              <div>
                <Label>{isRTL ? 'תיאור מלא (אנגלית)' : 'Full Description (English)'}</Label>
                <Textarea
                  value={formData.fullDescription}
                  onChange={(e) => setFormData({ ...formData, fullDescription: e.target.value })}
                  placeholder="Complete job description with all details..."
                  rows={5}
                  data-testid="textarea-full-desc"
                />
              </div>
              <div>
                <Label>{isRTL ? 'תיאור מלא (עברית)' : 'Full Description (Hebrew)'}</Label>
                <Textarea
                  value={formData.fullDescriptionHe}
                  onChange={(e) => setFormData({ ...formData, fullDescriptionHe: e.target.value })}
                  placeholder="תיאור מלא של המשרה עם כל הפרטים..."
                  rows={5}
                  dir="rtl"
                  data-testid="textarea-full-desc-he"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="requirements" className="space-y-4 mt-4">
              <div>
                <Label>{isRTL ? 'דרישות (אנגלית, שורה אחת לכל דרישה)' : 'Requirements (English, one per line)'}</Label>
                <Textarea
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  placeholder={"Valid ID\nBackground check clearance\nMinimum 2 years experience"}
                  rows={4}
                  data-testid="textarea-requirements"
                />
              </div>
              <div>
                <Label>{isRTL ? 'דרישות (עברית, שורה אחת לכל דרישה)' : 'Requirements (Hebrew, one per line)'}</Label>
                <Textarea
                  value={formData.requirementsHe}
                  onChange={(e) => setFormData({ ...formData, requirementsHe: e.target.value })}
                  placeholder={"תעודת זהות בתוקף\nאישור בדיקת רקע\nמינימום 2 שנות ניסיון"}
                  rows={4}
                  dir="rtl"
                  data-testid="textarea-requirements-he"
                />
              </div>
              <div>
                <Label>{isRTL ? 'הכשרות מבוקשות (שורה אחת לכל הכשרה)' : 'Qualifications (one per line)'}</Label>
                <Textarea
                  value={formData.qualifications}
                  onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                  placeholder={"Pet first aid certification\nAnimal behavior training\nExperience with multiple breeds"}
                  rows={3}
                  data-testid="textarea-qualifications"
                />
              </div>
              <div>
                <Label>{isRTL ? 'הטבות (שורה אחת לכל הטבה)' : 'Benefits (one per line)'}</Label>
                <Textarea
                  value={formData.benefits}
                  onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                  placeholder={"Flexible schedule\nCompetitive pay\nFree pet products"}
                  rows={3}
                  data-testid="textarea-benefits"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-medium">{isRTL ? 'דרישות מועמדות' : 'Application Requirements'}</h3>
                  
                  <div className="flex items-center justify-between">
                    <Label>{isRTL ? 'נדרש קורות חיים' : 'Requires Resume'}</Label>
                    <Switch
                      checked={formData.requiresResume}
                      onCheckedChange={(v) => setFormData({ ...formData, requiresResume: v })}
                      data-testid="switch-requires-resume"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>{isRTL ? 'נדרש מכתב מקדים' : 'Requires Cover Letter'}</Label>
                    <Switch
                      checked={formData.requiresCoverLetter}
                      onCheckedChange={(v) => setFormData({ ...formData, requiresCoverLetter: v })}
                      data-testid="switch-requires-cover-letter"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>{isRTL ? 'נדרשת בדיקת רקע' : 'Requires Background Check'}</Label>
                    <Switch
                      checked={formData.requiresBackgroundCheck}
                      onCheckedChange={(v) => setFormData({ ...formData, requiresBackgroundCheck: v })}
                      data-testid="switch-requires-background"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>{isRTL ? 'נדרש רישיון נהיגה' : 'Requires Driving License'}</Label>
                    <Switch
                      checked={formData.requiresDrivingLicense}
                      onCheckedChange={(v) => setFormData({ ...formData, requiresDrivingLicense: v })}
                      data-testid="switch-requires-license"
                    />
                  </div>
                  
                  <div>
                    <Label>{isRTL ? 'גיל מינימלי' : 'Minimum Age'}</Label>
                    <Input
                      type="number"
                      min={18}
                      max={99}
                      value={formData.minimumAge}
                      onChange={(e) => setFormData({ ...formData, minimumAge: parseInt(e.target.value) || 18 })}
                      data-testid="input-min-age"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-medium">{isRTL ? 'הגדרות תצוגה' : 'Display Settings'}</h3>
                  
                  <div className="flex items-center justify-between">
                    <Label>{isRTL ? 'משרה פעילה' : 'Active Position'}</Label>
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                      data-testid="switch-is-active"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>{isRTL ? 'משרה מומלצת' : 'Featured Position'}</Label>
                    <Switch
                      checked={formData.isFeatured}
                      onCheckedChange={(v) => setFormData({ ...formData, isFeatured: v })}
                      data-testid="switch-is-featured"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => { setShowEditor(false); resetForm(); }}>
              <X className="w-4 h-4 me-2" />
              {isRTL ? 'ביטול' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || !formData.title || !formData.shortDescription || !formData.fullDescription}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-save-job"
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              ) : (
                <Save className="w-4 h-4 me-2" />
              )}
              {editingPosition ? (isRTL ? 'עדכן משרה' : 'Update Job') : (isRTL ? 'צור משרה' : 'Create Job')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
