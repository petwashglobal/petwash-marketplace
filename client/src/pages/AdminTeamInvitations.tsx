import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { type Language, t } from "@/lib/i18n";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  UserPlus, 
  Mail, 
  CheckCircle, 
  Ban, 
  Users,
  Wrench,
  TrendingUp,
  DollarSign,
  Briefcase,
  Shield,
  Settings,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type EmployeeRole, type EmployeeStatus } from "@shared/firestore-schema";

interface EmployeeProfile {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  role: EmployeeRole;
  stations: string[];
  status: EmployeeStatus;
  employeeId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

interface InviteFormData {
  fullName: string;
  email: string;
  phone?: string;
  role: EmployeeRole;
  employeeId?: string;
  notes?: string;
}

interface AdminTeamInvitationsProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

const departmentInfo = {
  admin: { 
    icon: Shield, 
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    label: { en: 'Admin', he: 'מנהל מערכת' },
    description: { en: 'Full system access', he: 'גישה מלאה למערכת' }
  },
  ops: { 
    icon: Settings, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    label: { en: 'Operations', he: 'תפעול' },
    description: { en: 'Operations management', he: 'ניהול תפעול' }
  },
  manager: { 
    icon: Users, 
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    label: { en: 'Station Manager', he: 'מנהל תחנה' },
    description: { en: 'Station management', he: 'ניהול תחנות' }
  },
  maintenance: { 
    icon: Wrench, 
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    label: { en: 'Maintenance', he: 'תחזוקה' },
    description: { en: 'Technical maintenance', he: 'תחזוקה טכנית' }
  },
  support: { 
    icon: Users, 
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    label: { en: 'Customer Support', he: 'תמיכת לקוחות' },
    description: { en: 'Customer service', he: 'שירות לקוחות' }
  },
  marketing: { 
    icon: TrendingUp, 
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    label: { en: 'Marketing', he: 'שיווק' },
    description: { en: 'Marketing & campaigns', he: 'שיווק וקמפיינים' }
  },
  accounts: { 
    icon: DollarSign, 
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    label: { en: 'Accounts', he: 'הנה"ח' },
    description: { en: 'Finance & accounting', he: 'כספים וחשבונאות' }
  },
  subcontractors: { 
    icon: Briefcase, 
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    label: { en: 'Subcontractors', he: 'קבלנים משנה' },
    description: { en: 'External contractors', he: 'קבלנים חיצוניים' }
  },
};

const statusLabels = {
  active: { en: 'Active', he: 'פעיל' },
  suspended: { en: 'Suspended', he: 'מושעה' },
  inactive: { en: 'Inactive', he: 'לא פעיל' },
};

export default function AdminTeamInvitations({ language, onLanguageChange }: AdminTeamInvitationsProps) {
  const { toast } = useToast();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [formData, setFormData] = useState<InviteFormData>({
    fullName: '',
    email: '',
    phone: '',
    role: 'maintenance',
    employeeId: '',
    notes: '',
  });

  const { data: employeesData, isLoading } = useQuery<{ employees: EmployeeProfile[] }>({
    queryKey: ['/api/employees'],
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      const res = await apiRequest('POST', '/api/employees', data);
      return res.json();
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      const uid = response?.uid;
      
      if (uid) {
        sendInviteMutation.mutate(uid);
      }
      
      setIsInviteDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('common.error', language),
        description: error.message || t('admin.team.inviteFailed', language),
      });
    },
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (uid: string) => {
      const res = await apiRequest('POST', `/api/employees/${uid}/send-invite`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t('admin.team.memberAdded', language),
        description: t('admin.team.emailSent', language),
      });
    },
  });

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      role: 'maintenance',
      employeeId: '',
      notes: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEmployeeMutation.mutate(formData);
  };

  const employees = employeesData?.employees || [];
  const departmentCounts = employees.reduce((acc, emp) => {
    acc[emp.role] = (acc[emp.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-purple-50">
      <Header 
        language={language} 
        onLanguageChange={onLanguageChange}
      />

      <main className="flex-grow container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {t('admin.teamInvitations.title', language)}
          </h1>
          <p className="text-lg text-gray-600">
            {t('admin.team.subtitle', language)}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-4 lg:grid-cols-4 mb-8">
          {Object.entries(departmentInfo).map(([key, info]) => {
            const Icon = info.icon;
            const count = departmentCounts[key] || 0;
            return (
              <Card key={key} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${info.bgColor}`}>
                      <Icon className={`w-5 h-5 ${info.color}`} />
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <h3 className="font-semibold text-sm text-gray-900">
                    {info.label[language]}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {info.description[language]}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>
                  {t('admin.team.members', language)}
                </CardTitle>
                <CardDescription>
                  {t('admin.team.totalMembers', language).replace('{{count}}', employees.length.toString())}
                </CardDescription>
              </div>
              <Button 
                onClick={() => setIsInviteDialogOpen(true)}
                className="gap-2"
                data-testid="button-invite-member"
              >
                <UserPlus className="w-4 h-4" />
                {t('admin.team.inviteMember', language)}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {t('admin.team.noMembers', language)}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name', language)}</TableHead>
                    <TableHead>{t('common.email', language)}</TableHead>
                    <TableHead>{t('common.department', language)}</TableHead>
                    <TableHead>{t('common.status', language)}</TableHead>
                    <TableHead>{t('common.actions', language)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => {
                    const deptInfo = departmentInfo[employee.role];
                    const DeptIcon = deptInfo.icon;
                    return (
                      <TableRow key={employee.uid} data-testid={`row-employee-${employee.uid}`}>
                        <TableCell className="font-medium">
                          {employee.fullName}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {employee.email}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded ${deptInfo.bgColor}`}>
                              <DeptIcon className={`w-3.5 h-3.5 ${deptInfo.color}`} />
                            </div>
                            <span className="text-sm">
                              {deptInfo.label[language]}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={employee.status === 'active' ? 'default' : 'secondary'}
                            className={
                              employee.status === 'active' 
                                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                : employee.status === 'suspended'
                                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }
                          >
                            {statusLabels[employee.status][language]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sendInviteMutation.mutate(employee.uid)}
                            disabled={sendInviteMutation.isPending}
                            className="gap-2"
                            data-testid={`button-resend-${employee.uid}`}
                          >
                            <Mail className="w-4 h-4" />
                            {t('common.resend', language)}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <DialogHeader>
            <DialogTitle>
              {t('admin.team.inviteNew', language)}
            </DialogTitle>
            <DialogDescription>
              {t('admin.team.inviteDesc', language)}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('common.fullName', language)}</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                placeholder="John Doe"
                data-testid="input-fullname"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('common.email', language)} *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="example@petwash.co.il"
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('common.phone', language)}</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+972-50-1234567"
                data-testid="input-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">{t('common.department', language)} *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: any) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger data-testid="select-department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(departmentInfo).map(([key, info]) => {
                    const Icon = info.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${info.color}`} />
                          <span>{info.label[language]}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employeeId">{t('common.employeeId', language)}</Label>
              <Input
                id="employeeId"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                placeholder="EMP-001"
                data-testid="input-employeeid"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('common.notes', language)}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('common.notesPlaceholder', language)}
                rows={3}
                data-testid="input-notes"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteDialogOpen(false)}
                disabled={createEmployeeMutation.isPending}
                data-testid="button-cancel"
              >
                {t('common.cancel', language)}
              </Button>
              <Button
                type="submit"
                disabled={createEmployeeMutation.isPending}
                className="gap-2"
                data-testid="button-send-invite"
              >
                {createEmployeeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('common.sending', language)}
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    {t('common.sendInvitation', language)}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Footer language={language} />
    </div>
  );
}
