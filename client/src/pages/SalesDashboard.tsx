import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users, TrendingUp, DollarSign, Calendar, Phone, Mail, Briefcase } from "lucide-react";
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import { PhoneInput } from "@/components/PhoneInput";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Hebrew labels for DB codes (stored values stay English).
const LEAD_STATUS_HE: Record<string, string> = { new: "חדש", contacted: "נוצר קשר", qualified: "מתאים", nurturing: "בטיפוח", converted: "הומר", lost: "אבוד" };
const LEAD_SOURCE_HE: Record<string, string> = { website: "אתר", referral: "הפניה", social_media: "רשתות חברתיות", google_ads: "גוגל אדס", cold_call: "שיחה קרה" };
const OPP_STATUS_HE: Record<string, string> = { open: "פתוחה", won: "נסגרה בהצלחה", lost: "אבודה", on_hold: "בהמתנה" };
const lbl = (map: Record<string, string>, k?: string) => (k ? map[k] ?? k : "");

export default function SalesDashboard() {
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState(false);
  const [showCreateOpportunityDialog, setShowCreateOpportunityDialog] = useState(false);
  const [leadSource, setLeadSource] = useState("website");
  const [leadStatus, setLeadStatus] = useState("new");
  const [opportunityStatus, setOpportunityStatus] = useState("open");
  const [phoneValue, setPhoneValue] = useState('');
  const { toast } = useToast();

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["/api/enterprise/sales/leads"],
  });

  const { data: opportunities, isLoading: opportunitiesLoading } = useQuery({
    queryKey: ["/api/enterprise/sales/opportunities"],
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: any) => apiRequest(`/api/enterprise/sales/leads`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/sales/leads"] });
      setShowCreateLeadDialog(false);
      toast({ title: "בוצע", description: "הליד נוצר" });
    },
    onError: () => {
      toast({ title: "אופס", description: "יצירת הליד נכשלה", variant: "destructive" });
    },
  });

  const createOpportunityMutation = useMutation({
    mutationFn: async (data: any) => apiRequest(`/api/enterprise/sales/opportunities`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/sales/opportunities"] });
      setShowCreateOpportunityDialog(false);
      toast({ title: "בוצע", description: "ההזדמנות נוצרה" });
    },
    onError: () => {
      toast({ title: "אופס", description: "יצירת ההזדמנות נכשלה", variant: "destructive" });
    },
  });

  const updateLeadStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/enterprise/sales/leads/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/sales/leads"] });
      toast({ title: "בוצע", description: "סטטוס הליד עודכן" });
    },
  });

  const updateOpportunityStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/enterprise/sales/opportunities/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/sales/opportunities"] });
      toast({ title: "בוצע", description: "סטטוס ההזדמנות עודכן" });
    },
  });

  const handleCreateLead = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      company: formData.get("company"),
      jobTitle: formData.get("jobTitle"),
      leadSource,
      leadStatus,
      notes: formData.get("notes"),
    };
    createLeadMutation.mutate(data);
  };

  const handleCreateOpportunity = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      description: formData.get("description"),
      estimatedValue: formData.get("estimatedValue"),
      status: opportunityStatus,
      expectedCloseDate: formData.get("expectedCloseDate"),
      assignedTo: formData.get("assignedTo"),
      dealStageId: parseInt(formData.get("dealStageId") as string) || 1,
    };
    createOpportunityMutation.mutate(data);
  };

  const getLeadStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-[#D4AF37]",
      contacted: "bg-yellow-500",
      qualified: "bg-green-500",
      nurturing: "bg-[#D4AF37]",
      converted: "bg-emerald-500",
      lost: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getOpportunityStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-[#D4AF37]",
      won: "bg-green-500",
      lost: "bg-red-500",
      on_hold: "bg-yellow-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(num);
  };

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title="ניהול מכירות"
      subtitle="לידים והזדמנויות — הכול במקום אחד"
    >
      <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-end items-center">
        <div className="flex gap-2">
          <Button className="luxury-btn-primary" onClick={() => setShowCreateLeadDialog(true)} data-testid="button-create-lead">
            <Plus className="w-4 h-4 ml-2" />
            ליד חדש
          </Button>
          <Button onClick={() => setShowCreateOpportunityDialog(true)} variant="outline" data-testid="button-create-opportunity">
            <Plus className="w-4 h-4 ml-2" />
            הזדמנות חדשה
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="luxury-grid-4">
        <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה״כ לידים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="luxury-heading-lg luxury-text-gradient">{leads?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">הזדמנויות פעילות</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="luxury-heading-lg luxury-text-gradient">{opportunities?.filter((o: any) => o.status === "open").length || 0}</div>
          </CardContent>
        </Card>
        <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">שווי צנרת</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="luxury-heading-lg luxury-text-gradient">
              {formatCurrency(opportunities?.reduce((sum: number, o: any) => sum + parseFloat(o.estimatedValue || 0), 0) || 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">עסקאות שנסגרו</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="luxury-heading-lg luxury-text-gradient">{opportunities?.filter((o: any) => o.status === "won").length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leads" className="w-full">
        <TabsList>
          <TabsTrigger value="leads" data-testid="tab-leads">
            <Users className="w-4 h-4 ml-2" />
            לידים ({leads?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="opportunities" data-testid="tab-opportunities">
            <TrendingUp className="w-4 h-4 ml-2" />
            הזדמנויות ({opportunities?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          {leadsLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-32 bg-muted" />
              ))}
            </div>
          ) : leads?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">אין עדיין לידים</h3>
                  <p className="text-muted-foreground mb-4">פותחים ליד ראשון ומתחילים לעקוב</p>
                  <Button onClick={() => setShowCreateLeadDialog(true)}>
                    <Plus className="w-4 h-4 ml-2" />
                    ליד חדש
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {leads?.map((lead: any, idx: number) => (
                <Card key={lead.id} className={`luxury-glass-card luxury-hover-lift luxury-delay-${Math.min(idx + 1, 6)}`} data-testid={`lead-card-${lead.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {lead.firstName} {lead.lastName}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">{lead.company || "ללא חברה"}</p>
                      </div>
                      <Select
                        value={lead.leadStatus}
                        onValueChange={(status) => updateLeadStatusMutation.mutate({ id: lead.id, status })}
                      >
                        <SelectTrigger className="w-40" data-testid={`select-lead-status-${lead.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">חדש</SelectItem>
                          <SelectItem value="contacted">נוצר קשר</SelectItem>
                          <SelectItem value="qualified">מתאים</SelectItem>
                          <SelectItem value="nurturing">בטיפוח</SelectItem>
                          <SelectItem value="converted">הומר</SelectItem>
                          <SelectItem value="lost">אבוד</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                      {lead.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                      <div>
                        <div className="text-muted-foreground">מקור</div>
                        <div className="font-medium">{lbl(LEAD_SOURCE_HE, lead.leadSource)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">ניקוד</div>
                        <div className="font-medium">{lead.leadScore || 0}/100</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-4">
          {opportunitiesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-48 bg-muted" />
              ))}
            </div>
          ) : opportunities?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">אין עדיין הזדמנויות</h3>
                  <p className="text-muted-foreground mb-4">פותחים הזדמנות מכירה ראשונה</p>
                  <Button onClick={() => setShowCreateOpportunityDialog(true)}>
                    <Plus className="w-4 h-4 ml-2" />
                    הזדמנות חדשה
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="luxury-grid-3">
              {opportunities?.map((opp: any, idx: number) => (
                <Card key={opp.id} className={`luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-delay-${Math.min(idx + 1, 6)}`} data-testid={`opportunity-card-${opp.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{opp.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{opp.description || "ללא תיאור"}</p>
                      </div>
                      <Badge className={getOpportunityStatusColor(opp.status)}>{lbl(OPP_STATUS_HE, opp.status)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">שווי:</span>
                      <span className="text-lg font-bold">{formatCurrency(opp.estimatedValue)}</span>
                    </div>
                    {opp.expectedCloseDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>סגירה צפויה: {new Date(opp.expectedCloseDate).toLocaleDateString("he-IL")}</span>
                      </div>
                    )}
                    {opp.winProbability && (
                      <div className="text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">סיכוי לסגירה</span>
                          <span className="font-medium">{opp.winProbability}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${opp.winProbability}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <Select
                      value={opp.status}
                      onValueChange={(status) => updateOpportunityStatusMutation.mutate({ id: opp.id, status })}
                    >
                      <SelectTrigger className="w-full" data-testid={`select-opportunity-status-${opp.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">פתוחה</SelectItem>
                        <SelectItem value="won">נסגרה בהצלחה</SelectItem>
                        <SelectItem value="lost">אבודה</SelectItem>
                        <SelectItem value="on_hold">בהמתנה</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Lead Dialog */}
      <Dialog open={showCreateLeadDialog} onOpenChange={setShowCreateLeadDialog}>
        <DialogContent className="max-w-2xl" dir="rtl" data-testid="dialog-create-lead">
          <DialogHeader>
            <DialogTitle>ליד חדש</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateLead} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">שם פרטי *</Label>
                <Input id="firstName" name="firstName" required data-testid="input-first-name" />
              </div>
              <div>
                <Label htmlFor="lastName">שם משפחה *</Label>
                <Input id="lastName" name="lastName" required data-testid="input-last-name" />
              </div>
              <div>
                <Label htmlFor="email">אימייל *</Label>
                <Input id="email" name="email" type="email" required data-testid="input-email" />
              </div>
              <div>
                <Label htmlFor="phone">טלפון</Label>
                <PhoneInput value={phoneValue} onChange={(val) => setPhoneValue(val || '')} defaultCountry="IL" />
                <input type="hidden" name="phone" value={phoneValue} />
              </div>
              <div>
                <Label htmlFor="company">חברה</Label>
                <Input id="company" name="company" data-testid="input-company" />
              </div>
              <div>
                <Label htmlFor="jobTitle">תפקיד</Label>
                <Input id="jobTitle" name="jobTitle" data-testid="input-job-title" />
              </div>
              <div>
                <Label>מקור הליד</Label>
                <Select value={leadSource} onValueChange={setLeadSource}>
                  <SelectTrigger data-testid="select-lead-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">אתר</SelectItem>
                    <SelectItem value="referral">הפניה</SelectItem>
                    <SelectItem value="social_media">רשתות חברתיות</SelectItem>
                    <SelectItem value="google_ads">גוגל אדס</SelectItem>
                    <SelectItem value="cold_call">שיחה קרה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>סטטוס</Label>
                <Select value={leadStatus} onValueChange={setLeadStatus}>
                  <SelectTrigger data-testid="select-lead-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">חדש</SelectItem>
                    <SelectItem value="contacted">נוצר קשר</SelectItem>
                    <SelectItem value="qualified">מתאים</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="notes">הערות</Label>
              <Textarea id="notes" name="notes" rows={3} data-testid="textarea-notes" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateLeadDialog(false)} data-testid="button-cancel-lead">
                ביטול
              </Button>
              <Button type="submit" disabled={createLeadMutation.isPending} data-testid="button-submit-lead">
                {createLeadMutation.isPending ? "יוצר..." : "יצירת ליד"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Opportunity Dialog */}
      <Dialog open={showCreateOpportunityDialog} onOpenChange={setShowCreateOpportunityDialog}>
        <DialogContent className="max-w-2xl" dir="rtl" data-testid="dialog-create-opportunity">
          <DialogHeader>
            <DialogTitle>הזדמנות חדשה</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOpportunity} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">שם ההזדמנות *</Label>
                <Input id="name" name="name" required data-testid="input-opportunity-name" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">תיאור</Label>
                <Textarea id="description" name="description" rows={2} data-testid="textarea-description" />
              </div>
              <div>
                <Label htmlFor="estimatedValue">שווי משוער (₪) *</Label>
                <Input id="estimatedValue" name="estimatedValue" type="number" step="0.01" required data-testid="input-estimated-value" />
              </div>
              <div>
                <Label htmlFor="expectedCloseDate">תאריך סגירה צפוי</Label>
                <Input id="expectedCloseDate" name="expectedCloseDate" type="date" data-testid="input-expected-close-date" />
              </div>
              <div>
                <Label htmlFor="assignedTo">משויך ל</Label>
                <Input id="assignedTo" name="assignedTo" placeholder="מזהה מנהל" data-testid="input-assigned-to" />
              </div>
              <div>
                <Label htmlFor="dealStageId">שלב בעסקה</Label>
                <Input id="dealStageId" name="dealStageId" type="number" defaultValue="1" data-testid="input-deal-stage-id" />
              </div>
              <div className="col-span-2">
                <Label>סטטוס</Label>
                <Select value={opportunityStatus} onValueChange={setOpportunityStatus}>
                  <SelectTrigger data-testid="select-opportunity-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">פתוחה</SelectItem>
                    <SelectItem value="on_hold">בהמתנה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateOpportunityDialog(false)} data-testid="button-cancel-opportunity">
                ביטול
              </Button>
              <Button type="submit" disabled={createOpportunityMutation.isPending} data-testid="button-submit-opportunity">
                {createOpportunityMutation.isPending ? "יוצר..." : "יצירת הזדמנות"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </LuxuryPageWrapper>
  );
}
