import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import {
  FileText,
  Plus,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  Download,
  Upload,
  Calendar,
  Award,
  Clock
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PolicyDocument {
  id: number;
  policyId: string;
  title: string;
  titleHe?: string;
  category: string;
  description?: string;
  documentUrl: string;
  version: string;
  effectiveDate: string;
  expiryDate?: string;
  requiresAcknowledgment: boolean;
  targetAudience: string;
  department?: string;
  isActive: boolean;
  createdBy?: number;
  approvedBy?: number;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ComplianceCertification {
  id: number;
  employeeId: number;
  certificationType: string;
  certificateNumber?: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate: string;
  certificateUrl?: string;
  status: string;
  reminderSent: boolean;
  createdAt: string;
}

// Hebrew labels for DB codes (stored values stay English).
const CAT_HE: Record<string, string> = { HR: "משאבי אנוש", Security: "אבטחה", Operations: "תפעול", Legal: "משפטי", IT: "מערכות מידע" };
const AUDIENCE_HE: Record<string, string> = { all_employees: "כל העובדים", managers: "מנהלים", specific_department: "מחלקה מסוימת" };
const CERT_STATUS_HE: Record<string, string> = { active: "בתוקף", expired: "פג תוקף", expiring: "לקראת תפוגה", revoked: "בוטלה" };
const lbl = (map: Record<string, string>, k?: string) => (k ? map[k] ?? k : "");

const EMPTY_POLICY_FORM = {
  policyId: "",
  title: "",
  titleHe: "",
  category: "HR",
  description: "",
  documentUrl: "",
  version: "1.0",
  effectiveDate: "",
  targetAudience: "all_employees",
};

export default function PolicyManagementDashboard() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_POLICY_FORM });
  const { toast } = useToast();

  // Fetch policy documents
  const { data: allPolicies, isLoading: policiesLoading, isError: policiesError } = useQuery<PolicyDocument[]>({
    queryKey: ['/api/enterprise/policy/documents']
  });

  // Fetch compliance certifications
  const { data: certifications, isLoading: certsLoading, isError: certsError } = useQuery<ComplianceCertification[]>({
    queryKey: ['/api/enterprise/policy/certifications']
  });

  // Fetch expiring certifications. Was a bare fetch() with NO auth (no Bearer/
  // App-Check/credentials) → the requireAdmin+MFA endpoint 401'd → "Expiring Soon"
  // KPI was permanently 0 and the alert never fired. Use the default authed
  // fetcher (query param carried in the queryKey URL). (2026-07-27)
  const { data: expiringCerts } = useQuery<ComplianceCertification[]>({
    queryKey: ['/api/enterprise/policy/certifications/expiring?days=30']
  });

  // Filter policies by category and search
  const filteredPolicies = Array.isArray(allPolicies)
    ? allPolicies.filter(policy => {
        const matchesCategory = selectedCategory === 'all' || policy.category === selectedCategory;
        const matchesSearch = !searchQuery ||
          policy.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          policy.policyId.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      })
    : [];

  // Get category counts
  const categories = Array.isArray(allPolicies)
    ? allPolicies.reduce((acc: Record<string, number>, policy) => {
        acc[policy.category] = (acc[policy.category] || 0) + 1;
        return acc;
      }, {})
    : {};

  const activePolicies = Array.isArray(allPolicies) ? allPolicies.filter(p => p.isActive).length : 0;
  const pendingAcknowledgments = Array.isArray(allPolicies) ? allPolicies.filter(p => p.requiresAcknowledgment && p.isActive).length : 0;
  const expiringCount = Array.isArray(expiringCerts) ? expiringCerts.length : 0;

  // Create a new policy document via the existing endpoint.
  const createPolicyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/enterprise/policy/documents', {
        policyId: form.policyId.trim(),
        title: form.title.trim(),
        titleHe: form.titleHe.trim() || undefined,
        category: form.category,
        description: form.description.trim() || undefined,
        documentUrl: form.documentUrl.trim(),
        version: form.version.trim(),
        effectiveDate: form.effectiveDate,
        targetAudience: form.targetAudience,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprise/policy/documents'] });
      toast({ title: "המדיניות נוצרה", description: "המסמך נוסף בהצלחה." });
      setForm({ ...EMPTY_POLICY_FORM });
      setCreateOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "לא הצלחנו ליצור מדיניות", description: err?.message || "בדקו את השדות ונסו שוב.", variant: "destructive" });
    },
  });

  const handleCreatePolicy = () => {
    if (!form.policyId.trim() || !form.title.trim() || !form.documentUrl.trim() || !form.version.trim() || !form.effectiveDate) {
      toast({ title: "חסרים שדות חובה", description: "מזהה, כותרת, קישור למסמך, גרסה ותאריך תוקף הם שדות חובה.", variant: "destructive" });
      return;
    }
    createPolicyMutation.mutate();
  };

  // Client-side CSV export of the policy documents currently loaded.
  const handleExport = () => {
    const rows = Array.isArray(allPolicies) ? allPolicies : [];
    if (rows.length === 0) {
      toast({ title: "אין מה לייצא", description: "לא נטענו מסמכים.", variant: "destructive" });
      return;
    }
    const headers = ["policyId", "title", "category", "version", "effectiveDate", "expiryDate", "targetAudience", "isActive"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map(p => headers.map(h => esc((p as any)[h])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `policies-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title="מדיניות ותאימות"
      subtitle="ניהול גרסאות, אישורי עובדים ומעקב תאימות"
    >
      <div className="min-h-screen p-6" dir="rtl" data-testid="policy-management-dashboard">
      {/* Header */}
      <div className="mb-8 luxury-animate-fade-in">
        <div className="flex items-center justify-end">
          <div className="flex gap-2">
            <Button className="luxury-btn-secondary px-4 py-2" data-testid="button-export" onClick={handleExport}>
              <Download className="w-4 h-4 ml-2 inline" />
              ייצוא
            </Button>
            <Button className="luxury-btn-primary luxury-shadow-xl px-4 py-2" data-testid="button-create-policy" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 ml-2 inline" />
              מדיניות חדשה
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 luxury-animate-slide-up luxury-delay-1">
        <div className="luxury-glass-card luxury-hover-lift luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-2" data-testid="card-total-policies">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="luxury-text-small opacity-70">מסמכי מדיניות</h3>
            <FileText className="w-4 h-4 text-[#B8932F]" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#B8932F]" data-testid="text-total-policies">
              {Array.isArray(allPolicies) ? allPolicies.length : 0}
            </div>
            <p className="luxury-text-small opacity-70 mt-1">
              {activePolicies} פעילים
            </p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-hover-lift luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-3" data-testid="card-pending-acks">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="luxury-text-small opacity-70">אישורים ממתינים</h3>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600" data-testid="text-pending-acks">
              {pendingAcknowledgments}
            </div>
            <p className="luxury-text-small opacity-70 mt-1">ממתינים לחתימת עובדים</p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-hover-lift luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-4" data-testid="card-certifications">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="luxury-text-small opacity-70">הסמכות</h3>
            <Award className="w-4 h-4 text-[#B8932F]" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#B8932F]" data-testid="text-total-certifications">
              {Array.isArray(certifications) ? certifications.length : 0}
            </div>
            <p className="luxury-text-small opacity-70 mt-1">
              {Array.isArray(certifications) ? certifications.filter(c => c.status === 'active').length : 0} בתוקף
            </p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-hover-lift luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-5" data-testid="card-expiring">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="luxury-text-small opacity-70">פגות תוקף בקרוב</h3>
            <Clock className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600" data-testid="text-expiring-count">
              {expiringCount}
            </div>
            <p className="luxury-text-small opacity-70 mt-1">ב-30 הימים הקרובים</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="mb-6 flex gap-4 luxury-animate-fade-in luxury-delay-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש מדיניות לפי שם או מזהה..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="luxury-glass-minimal pr-10 w-full"
            data-testid="input-search-policies"
          />
        </div>
        <Button className="luxury-btn-secondary px-4 py-2" data-testid="button-advanced-filter">
          <Filter className="w-4 h-4 ml-2 inline" />
          מסננים
        </Button>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="policies" className="space-y-6">
        <TabsList className="bg-gradient-to-r from-gray-100 to-gray-50 p-1">
          <TabsTrigger value="policies" className="data-[state=active]:bg-metallic-gold/20 data-[state=active]:text-metallic-gold" data-testid="tab-policies">
            <FileText className="w-4 h-4 ml-2" />
            מסמכי מדיניות
          </TabsTrigger>
          <TabsTrigger value="certifications" className="data-[state=active]:bg-metallic-platinum/20 data-[state=active]:text-metallic-platinum" data-testid="tab-certifications">
            <Award className="w-4 h-4 ml-2" />
            הסמכות ותאימות
          </TabsTrigger>
        </TabsList>

        {/* Policies Tab */}
        <TabsContent value="policies" data-testid="content-policies">
          {policiesError && (
            <Alert variant="destructive" data-testid="alert-policies-error">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                טעינת המסמכים נכשלה. נסו שוב.
              </AlertDescription>
            </Alert>
          )}

          {/* Category Filter */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <Button
              onClick={() => setSelectedCategory('all')}
              className={selectedCategory === 'all' ? 'luxury-badge-primary px-4 py-2' : 'luxury-badge-secondary px-4 py-2'}
              data-testid="filter-category-all"
            >
              הכול ({Array.isArray(allPolicies) ? allPolicies.length : 0})
            </Button>
            {Object.entries(categories).map(([category, count]) => (
              <Button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={selectedCategory === category ? 'luxury-badge-primary px-4 py-2' : 'luxury-badge-secondary px-4 py-2'}
                data-testid={`filter-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {lbl(CAT_HE, category)} ({count})
              </Button>
            ))}
          </div>

          {/* Policies Grid */}
          <div className="luxury-grid-3">
            {policiesLoading ? (
              <p className="luxury-text-body opacity-70 col-span-full text-center py-8">טוען מסמכים...</p>
            ) : filteredPolicies.length === 0 ? (
              <p className="luxury-text-body opacity-70 col-span-full text-center py-8" data-testid="text-no-policies">
                לא נמצאו מסמכים
              </p>
            ) : (
              filteredPolicies.map((policy, idx) => (
                <div key={policy.id} className={`luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-${idx % 6 + 7}`} data-testid={`card-policy-${policy.id}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="luxury-badge-secondary px-2 py-1 text-xs">{policy.policyId}</span>
                        {policy.isActive ? (
                          <span className="luxury-badge-verified px-2 py-1 text-xs">פעיל</span>
                        ) : (
                          <span className="luxury-badge-secondary px-2 py-1 text-xs">לא פעיל</span>
                        )}
                      </div>
                      <h3 className="luxury-heading-sm text-[#B8932F] mb-1">{policy.titleHe || policy.title}</h3>
                      <p className="luxury-text-small opacity-70">{lbl(CAT_HE, policy.category)}</p>
                    </div>
                    <Shield className="w-5 h-5 text-[#B8932F]" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between luxury-text-small">
                      <span className="opacity-70">גרסה:</span>
                      <span className="font-medium">{policy.version}</span>
                    </div>
                    <div className="flex items-center justify-between luxury-text-small">
                      <span className="opacity-70">בתוקף מ:</span>
                      <span className="font-medium">
                        {new Date(policy.effectiveDate).toLocaleDateString("he-IL")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between luxury-text-small">
                      <span className="opacity-70">קהל יעד:</span>
                      <span className="luxury-badge-secondary px-2 py-1 text-xs">{lbl(AUDIENCE_HE, policy.targetAudience)}</span>
                    </div>
                    {policy.requiresAcknowledgment && (
                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-2 luxury-text-small text-amber-600">
                          <AlertTriangle className="w-3 h-3" />
                          דורש אישור עובד
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button className="luxury-btn-secondary flex-1 py-2" data-testid={`button-view-policy-${policy.id}`}>
                        צפייה
                      </Button>
                      <Button className="luxury-btn-secondary py-2 px-4" data-testid={`button-edit-policy-${policy.id}`}>
                        עריכה
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Certifications Tab */}
        <TabsContent value="certifications" data-testid="content-certifications">
          {certsError && (
            <Alert variant="destructive" data-testid="alert-certifications-error">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                טעינת ההסמכות נכשלה. נסו שוב.
              </AlertDescription>
            </Alert>
          )}

          {/* Expiring Certifications Alert */}
          {expiringCount > 0 && (
            <Alert className="mb-6 border-amber-300 bg-white" data-testid="alert-expiring-certs">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <span className="font-semibold">{expiringCount} הסמכות</span> פגות תוקף ב-30 הימים הקרובים. חדשו כדי לשמור על תאימות.
              </AlertDescription>
            </Alert>
          )}

          {/* Certifications List */}
          <div className="space-y-4">
            {certsLoading ? (
              <p className="text-muted-foreground text-center py-8">טוען הסמכות...</p>
            ) : !Array.isArray(certifications) || certifications.length === 0 ? (
              <p className="text-muted-foreground text-center py-8" data-testid="text-no-certifications">
                לא נמצאו הסמכות
              </p>
            ) : (
              certifications.map((cert) => (
                <Card key={cert.id} className="glass-card hover-glow-blue" data-testid={`card-cert-${cert.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Award className="w-5 h-5 text-metallic-platinum" />
                          <div>
                            <h3 className="font-semibold text-lg text-metallic-platinum">
                              {cert.certificationType.replace(/_/g, ' ').toUpperCase()}
                            </h3>
                            <p className="text-sm text-muted-foreground">מס׳ עובד: {cert.employeeId}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground block mb-1">הונפק ע״י</span>
                            <span className="font-medium">{cert.issuedBy}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">תאריך הנפקה</span>
                            <span className="font-medium">{new Date(cert.issuedDate).toLocaleDateString("he-IL")}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">תאריך תפוגה</span>
                            <span className={`font-medium ${new Date(cert.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'text-red-600' : ''}`}>
                              {new Date(cert.expiryDate).toLocaleDateString("he-IL")}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">סטטוס</span>
                            <Badge className={cert.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700'}>
                              {lbl(CERT_STATUS_HE, cert.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" data-testid={`button-view-cert-${cert.id}`}>
                          צפייה
                        </Button>
                        <Button size="sm" variant="outline" data-testid={`button-renew-cert-${cert.id}`}>
                          חידוש
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Policy dialog — wired to POST /api/enterprise/policy/documents */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl" data-testid="dialog-create-policy">
          <DialogHeader>
            <DialogTitle>מסמך מדיניות חדש</DialogTitle>
            <DialogDescription>רישום מסמך מדיניות / תאימות חדש.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div>
              <Label htmlFor="policy-id">מזהה מדיניות *</Label>
              <Input id="policy-id" placeholder="POL-HR-001" value={form.policyId} onChange={(e) => setForm(f => ({ ...f, policyId: e.target.value }))} data-testid="input-policy-id" />
            </div>
            <div>
              <Label htmlFor="policy-version">גרסה *</Label>
              <Input id="policy-version" placeholder="1.0" value={form.version} onChange={(e) => setForm(f => ({ ...f, version: e.target.value }))} data-testid="input-policy-version" />
            </div>
            <div>
              <Label htmlFor="policy-title">כותרת *</Label>
              <Input id="policy-title" placeholder="מדיניות הגנת מידע" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} data-testid="input-policy-title" />
            </div>
            <div>
              <Label htmlFor="policy-title-he">כותרת (עברית)</Label>
              <Input id="policy-title-he" value={form.titleHe} onChange={(e) => setForm(f => ({ ...f, titleHe: e.target.value }))} data-testid="input-policy-title-he" />
            </div>
            <div>
              <Label>קטגוריה *</Label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="select-policy-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HR">משאבי אנוש</SelectItem>
                  <SelectItem value="Security">אבטחה</SelectItem>
                  <SelectItem value="Operations">תפעול</SelectItem>
                  <SelectItem value="Legal">משפטי</SelectItem>
                  <SelectItem value="IT">מערכות מידע</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>קהל יעד *</Label>
              <Select value={form.targetAudience} onValueChange={(v) => setForm(f => ({ ...f, targetAudience: v }))}>
                <SelectTrigger data-testid="select-policy-audience"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_employees">כל העובדים</SelectItem>
                  <SelectItem value="managers">מנהלים</SelectItem>
                  <SelectItem value="specific_department">מחלקה מסוימת</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="policy-effective">בתוקף מתאריך *</Label>
              <Input id="policy-effective" type="date" value={form.effectiveDate} onChange={(e) => setForm(f => ({ ...f, effectiveDate: e.target.value }))} data-testid="input-policy-effective" />
            </div>
            <div>
              <Label htmlFor="policy-url">קישור למסמך *</Label>
              <Input id="policy-url" placeholder="https://…" value={form.documentUrl} onChange={(e) => setForm(f => ({ ...f, documentUrl: e.target.value }))} data-testid="input-policy-url" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="policy-description">תיאור</Label>
              <Textarea id="policy-description" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} data-testid="input-policy-description" />
            </div>
          </div>
          <DialogFooter>
            <Button className="luxury-btn-ghost" onClick={() => setCreateOpen(false)} data-testid="button-cancel-policy">ביטול</Button>
            <Button className="luxury-btn-primary" onClick={handleCreatePolicy} disabled={createPolicyMutation.isPending} data-testid="button-submit-policy">
              {createPolicyMutation.isPending ? "יוצר…" : "יצירת מדיניות"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </LuxuryPageWrapper>
  );
}
