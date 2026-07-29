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
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import {
  Plus,
  DollarSign,
  FileText,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Calendar,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Hebrew labels for DB codes (stored values stay English).
const STATUS_HE: Record<string, string> = { pending: "ממתין", scheduled: "מתוזמן", paid: "שולם", overdue: "באיחור", partial: "חלקי", cancelled: "בוטל", draft: "טיוטה", submitted: "הוגש", approved: "אושר" };
const CUST_TYPE_HE: Record<string, string> = { customer: "לקוח", franchise: "זכיין", partner: "שותף" };
const ACCT_TYPE_HE: Record<string, string> = { asset: "נכס", liability: "התחייבות", equity: "הון", revenue: "הכנסה", expense: "הוצאה" };
const lbl = (map: Record<string, string>, k?: string) => (k ? map[k] ?? k : "");

export default function FinanceDashboard() {
  const [showPayableDialog, setShowPayableDialog] = useState(false);
  const [showReceivableDialog, setShowReceivableDialog] = useState(false);
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);
  const [showTaxReturnDialog, setShowTaxReturnDialog] = useState(false);
  const [payableStatus, setPayableStatus] = useState("pending");
  const [receivableStatus, setReceivableStatus] = useState("pending");
  const [receivableCustomerType, setReceivableCustomerType] = useState("customer");
  const [ledgerAccountType, setLedgerAccountType] = useState("expense");
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [fiscalPeriod, setFiscalPeriod] = useState(new Date().getMonth() + 1);
  const [taxReturnStatus, setTaxReturnStatus] = useState("draft");
  const [taxReturnType, setTaxReturnType] = useState("vat");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [taxPeriod, setTaxPeriod] = useState("Q1");
  const { toast } = useToast();

  const { data: accountsPayable, isLoading: payablesLoading } = useQuery({
    queryKey: ["/api/enterprise/finance/accounts-payable"],
  });

  const { data: overduePayables } = useQuery({
    queryKey: ["/api/enterprise/finance/accounts-payable/overdue"],
  });

  const { data: accountsReceivable, isLoading: receivablesLoading } = useQuery({
    queryKey: ["/api/enterprise/finance/accounts-receivable"],
  });

  const { data: overdueReceivables } = useQuery({
    queryKey: ["/api/enterprise/finance/accounts-receivable/overdue"],
  });

  const { data: generalLedger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["/api/enterprise/finance/general-ledger"],
  });

  const trialBalanceUrl = `/api/enterprise/finance/general-ledger/trial-balance/${fiscalYear}/${fiscalPeriod}`;
  const { data: trialBalance, isLoading: trialBalanceLoading, isError: trialBalanceError, error: trialBalanceErrorMsg } = useQuery({
    queryKey: [trialBalanceUrl, fiscalYear, fiscalPeriod],
  });

  const { data: taxReturns, isLoading: taxReturnsLoading, isError: taxReturnsError } = useQuery({
    queryKey: ["/api/enterprise/finance/tax-returns"],
  });

  const { data: taxPayments, isLoading: taxPaymentsLoading } = useQuery({
    queryKey: ["/api/enterprise/finance/tax-payments"],
  });

  const { data: taxAuditLogs, isLoading: taxAuditLogsLoading } = useQuery({
    queryKey: ["/api/enterprise/finance/tax-audit-logs"],
  });

  const createPayableMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/finance/accounts-payable`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-payable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-payable/overdue"] });
      setShowPayableDialog(false);
      toast({ title: "בוצע", description: "חשבונית הספק נוצרה" });
    },
    onError: () => {
      toast({ title: "אופס", description: "יצירת חשבונית הספק נכשלה", variant: "destructive" });
    },
  });

  const createReceivableMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/finance/accounts-receivable`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-receivable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-receivable/overdue"] });
      setShowReceivableDialog(false);
      toast({ title: "בוצע", description: "חשבונית הלקוח נוצרה" });
    },
    onError: () => {
      toast({ title: "אופס", description: "יצירת חשבונית הלקוח נכשלה", variant: "destructive" });
    },
  });

  const createLedgerMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/finance/general-ledger`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/general-ledger"] });
      setShowLedgerDialog(false);
      toast({ title: "בוצע", description: "רישום היומן נוצר" });
    },
    onError: () => {
      toast({ title: "אופס", description: "יצירת הרישום נכשלה", variant: "destructive" });
    },
  });

  const createTaxReturnMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/finance/tax-returns`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/tax-returns"] });
      setShowTaxReturnDialog(false);
      toast({ title: "בוצע", description: "דוח המס נוצר" });
    },
    onError: () => {
      toast({ title: "אופס", description: "יצירת דוח המס נכשלה", variant: "destructive" });
    },
  });

  const payPayableMutation = useMutation({
    mutationFn: async ({ id, paymentDate, paymentMethod, paymentReference }: any) =>
      apiRequest(`/api/enterprise/finance/accounts-payable/${id}/pay`, { method: "POST", body: { paymentDate, paymentMethod, paymentReference } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-payable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-payable/overdue"] });
      toast({ title: "בוצע", description: "התשלום נרשם" });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ id, amount, paymentDate, paymentMethod }: any) =>
      apiRequest(`/api/enterprise/finance/accounts-receivable/${id}/payment`, { method: "POST", body: { amount, paymentDate, paymentMethod } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-receivable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-receivable/overdue"] });
      toast({ title: "בוצע", description: "התשלום נרשם" });
    },
  });

  const handleCreatePayable = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      invoiceNumber: formData.get("invoiceNumber"),
      supplierId: formData.get("supplierId") ? parseInt(formData.get("supplierId") as string) : undefined,
      invoiceDate: formData.get("invoiceDate"),
      dueDate: formData.get("dueDate"),
      amount: formData.get("amount"),
      currency: formData.get("currency") || "ILS",
      taxAmount: formData.get("taxAmount") || "0",
      totalAmount: formData.get("totalAmount"),
      paymentStatus: payableStatus,
      category: formData.get("category") || undefined,
      glAccountCode: formData.get("glAccountCode") || undefined,
      notes: formData.get("notes") || undefined,
    };
    createPayableMutation.mutate(data);
  };

  const handleCreateReceivable = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      invoiceNumber: formData.get("invoiceNumber"),
      customerId: formData.get("customerId"),
      customerType: receivableCustomerType,
      invoiceDate: formData.get("invoiceDate"),
      dueDate: formData.get("dueDate"),
      amount: formData.get("amount"),
      currency: formData.get("currency") || "ILS",
      taxAmount: formData.get("taxAmount") || "0",
      totalAmount: formData.get("totalAmount"),
      paymentStatus: receivableStatus,
      category: formData.get("category") || undefined,
      glAccountCode: formData.get("glAccountCode") || undefined,
      notes: formData.get("notes") || undefined,
    };
    createReceivableMutation.mutate(data);
  };

  const handleCreateLedger = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      entryNumber: formData.get("entryNumber"),
      entryDate: formData.get("entryDate"),
      accountCode: formData.get("accountCode"),
      accountName: formData.get("accountName"),
      accountType: ledgerAccountType,
      debit: formData.get("debit") || "0",
      credit: formData.get("credit") || "0",
      currency: formData.get("currency") || "ILS",
      description: formData.get("description"),
      fiscalYear: formData.get("fiscalYear") ? parseInt(formData.get("fiscalYear") as string) : new Date().getFullYear(),
      fiscalPeriod: formData.get("fiscalPeriod") ? parseInt(formData.get("fiscalPeriod") as string) : new Date().getMonth() + 1,
      referenceType: formData.get("referenceType") || undefined,
      referenceId: formData.get("referenceId") || undefined,
    };
    createLedgerMutation.mutate(data);
  };

  const handleCreateTaxReturn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      taxYear: parseInt(formData.get("taxYear") as string),
      taxPeriod: formData.get("taxPeriod"),
      taxType: taxReturnType,
      status: taxReturnStatus,
      dueDate: formData.get("dueDate"),
      grossSales: formData.get("grossSales") || "0",
      exemptSales: formData.get("exemptSales") || "0",
      taxableAmount: formData.get("taxableAmount") || "0",
      taxAmount: formData.get("taxAmount") || "0",
      taxRate: formData.get("taxRate") || "18",
      inputVat: formData.get("inputVat") || "0",
      outputVat: formData.get("outputVat") || "0",
      netTaxDue: formData.get("netTaxDue") || "0",
      notes: formData.get("notes") || undefined,
    };
    createTaxReturnMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      scheduled: "bg-[#D4AF37]",
      paid: "bg-green-500",
      overdue: "bg-red-500",
      partial: "bg-[#D4AF37]",
      cancelled: "bg-gray-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const totalPayablesAmount = accountsPayable?.reduce((sum: number, p: any) => sum + parseFloat(p.totalAmount || 0), 0) || 0;
  const totalReceivablesAmount = accountsReceivable?.reduce((sum: number, r: any) => sum + parseFloat(r.totalAmount || 0), 0) || 0;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">כספים והנהלת חשבונות</h1>
          <p className="text-muted-foreground">ספקים, לקוחות והנהלת החשבונות — הכול במקום אחד</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="luxury-grid-4">
        <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה״כ לספקים</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="luxury-heading-lg luxury-text-gradient" data-testid="metric-total-payables">
              ₪{totalPayablesAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">{accountsPayable?.length || 0} חשבוניות</p>
          </CardContent>
        </Card>
        <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה״כ מלקוחות</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="luxury-heading-lg luxury-text-gradient" data-testid="metric-total-receivables">
              ₪{totalReceivablesAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">{accountsReceivable?.length || 0} חשבוניות</p>
          </CardContent>
        </Card>
        <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">לספקים באיחור</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="luxury-heading-lg luxury-text-gradient" data-testid="metric-overdue-payables">{overduePayables?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">מלקוחות באיחור</CardTitle>
            <AlertTriangle className="h-4 w-4 text-[#D4AF37]" />
          </CardHeader>
          <CardContent>
            <div className="luxury-heading-lg luxury-text-gradient" data-testid="metric-overdue-receivables">{overdueReceivables?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payables" className="w-full">
        <TabsList>
          <TabsTrigger value="payables" data-testid="tab-payables">
            <FileText className="w-4 h-4 ml-2" />
            חשבונות לתשלום ({accountsPayable?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="receivables" data-testid="tab-receivables">
            <DollarSign className="w-4 h-4 ml-2" />
            חשבונות לקבל ({accountsReceivable?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="ledger" data-testid="tab-ledger">
            <FileText className="w-4 h-4 ml-2" />
            יומן חשבונות ({generalLedger?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <TrendingUp className="w-4 h-4 ml-2" />
            דוחות כספיים
          </TabsTrigger>
          <TabsTrigger value="tax-compliance" data-testid="tab-tax-compliance">
            <FileCheck className="w-4 h-4 ml-2" />
            מיסוי ותאימות
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payables" className="space-y-4">
          <div className="flex justify-end">
            <Button className="luxury-btn-primary" onClick={() => setShowPayableDialog(true)} data-testid="button-create-payable">
              <Plus className="w-4 h-4 ml-2" />
              חשבונית ספק
            </Button>
          </div>
          {payablesLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-32 bg-muted" />
              ))}
            </div>
          ) : accountsPayable?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">אין עדיין חשבונות לתשלום</h3>
                  <p className="text-muted-foreground mb-4">מוסיפים חשבונית כדי לעקוב אחר תשלומים לספקים</p>
                  <Button onClick={() => setShowPayableDialog(true)}>
                    <Plus className="w-4 h-4 ml-2" />
                    יצירת חשבונית ספק
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accountsPayable?.map((payable: any, idx: number) => (
                <Card key={payable.id} className={`luxury-glass-card luxury-hover-lift luxury-delay-${Math.min(idx + 1, 6)}`} data-testid={`payable-card-${payable.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{payable.invoiceNumber}</h4>
                          <Badge className={getStatusColor(payable.paymentStatus)}>{lbl(STATUS_HE, payable.paymentStatus)}</Badge>
                          {payable.category && <Badge variant="outline">{payable.category}</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span>מזהה ספק: {payable.supplierId}</span>
                          <span>סכום: ₪{parseFloat(payable.totalAmount).toFixed(2)}</span>
                          <span>לתשלום עד: {new Date(payable.dueDate).toLocaleDateString("he-IL")}</span>
                        </div>
                        {payable.notes && <p className="text-sm text-muted-foreground">{payable.notes}</p>}
                      </div>
                      <div className="flex gap-2">
                        {payable.paymentStatus === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              const paymentDate = new Date().toISOString().split('T')[0];
                              const paymentMethod = prompt("הכניסו אמצעי תשלום:");
                              if (paymentMethod) {
                                payPayableMutation.mutate({ id: payable.id, paymentDate, paymentMethod });
                              }
                            }}
                            data-testid={`button-pay-${payable.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4 ml-1" />
                            סמן כשולם
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="receivables" className="space-y-4">
          <div className="flex justify-end">
            <Button className="luxury-btn-primary" onClick={() => setShowReceivableDialog(true)} data-testid="button-create-receivable">
              <Plus className="w-4 h-4 ml-2" />
              חשבונית לקוח
            </Button>
          </div>
          {receivablesLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-32 bg-muted" />
              ))}
            </div>
          ) : accountsReceivable?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">אין עדיין חשבונות לקבל</h3>
                  <p className="text-muted-foreground mb-4">מוסיפים חשבונית כדי לעקוב אחר תשלומי לקוחות</p>
                  <Button onClick={() => setShowReceivableDialog(true)}>
                    <Plus className="w-4 h-4 ml-2" />
                    יצירת חשבונית לקוח
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accountsReceivable?.map((receivable: any, idx: number) => (
                <Card key={receivable.id} className={`luxury-glass-card luxury-hover-lift luxury-delay-${Math.min(idx + 1, 6)}`} data-testid={`receivable-card-${receivable.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{receivable.invoiceNumber}</h4>
                          <Badge className={getStatusColor(receivable.paymentStatus)}>{lbl(STATUS_HE, receivable.paymentStatus)}</Badge>
                          <Badge variant="outline">{lbl(CUST_TYPE_HE, receivable.customerType)}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span>לקוח: {receivable.customerId}</span>
                          <span>סכום: ₪{parseFloat(receivable.totalAmount).toFixed(2)}</span>
                          <span>שולם: ₪{parseFloat(receivable.paidAmount || 0).toFixed(2)}</span>
                          <span>לתשלום עד: {new Date(receivable.dueDate).toLocaleDateString("he-IL")}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {receivable.paymentStatus !== "paid" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              const amount = prompt("הכניסו סכום תשלום:");
                              if (amount) {
                                const paymentDate = new Date().toISOString().split('T')[0];
                                recordPaymentMutation.mutate({
                                  id: receivable.id,
                                  amount: parseFloat(amount),
                                  paymentDate,
                                  paymentMethod: "bank_transfer"
                                });
                              }
                            }}
                            data-testid={`button-record-payment-${receivable.id}`}
                          >
                            רישום תשלום
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ledger" className="space-y-4">
          <div className="flex justify-end">
            <Button className="luxury-btn-primary" onClick={() => setShowLedgerDialog(true)} data-testid="button-create-ledger">
              <Plus className="w-4 h-4 ml-2" />
              רישום חדש
            </Button>
          </div>
          {ledgerLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-32 bg-muted" />
              ))}
            </div>
          ) : generalLedger?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">אין עדיין רישומים ביומן</h3>
                  <p className="text-muted-foreground mb-4">מוסיפים רישומים להנהלת חשבונות כפולה</p>
                  <Button onClick={() => setShowLedgerDialog(true)}>
                    <Plus className="w-4 h-4 ml-2" />
                    יצירת רישום
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {generalLedger?.map((entry: any) => (
                <Card key={entry.id} data-testid={`ledger-card-${entry.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{entry.entryNumber}</h4>
                          <Badge variant="outline">{lbl(ACCT_TYPE_HE, entry.accountType)}</Badge>
                          {entry.isReconciled && <Badge className="bg-green-500">מותאם</Badge>}
                        </div>
                        <p className="text-sm mb-2">{entry.description}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>חשבון: {entry.accountCode} - {entry.accountName}</span>
                          <span>חובה: ₪{parseFloat(entry.debit || 0).toFixed(2)}</span>
                          <span>זכות: ₪{parseFloat(entry.credit || 0).toFixed(2)}</span>
                          <span>תאריך: {new Date(entry.entryDate).toLocaleDateString("he-IL")}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>מאזן בוחן</CardTitle>
              <p className="text-sm text-muted-foreground">יתרות חשבונות לתקופה חשבונאית נבחרת</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end">
                <div>
                  <Label htmlFor="fiscalYear">שנת כספים</Label>
                  <Input
                    id="fiscalYear"
                    type="number"
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(parseInt(e.target.value))}
                    className="w-32"
                    data-testid="input-fiscal-year"
                  />
                </div>
                <div>
                  <Label htmlFor="fiscalPeriod">תקופה (1-12)</Label>
                  <Input
                    id="fiscalPeriod"
                    type="number"
                    min="1"
                    max="12"
                    value={fiscalPeriod}
                    onChange={(e) => setFiscalPeriod(parseInt(e.target.value))}
                    className="w-32"
                    data-testid="input-fiscal-period"
                  />
                </div>
                <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: [trialBalanceUrl] })} data-testid="button-refresh-trial-balance">
                  רענון
                </Button>
              </div>

              {trialBalanceLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : trialBalanceError ? (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                      <h3 className="text-lg font-semibold mb-2 text-red-900">שגיאה בטעינת מאזן הבוחן</h3>
                      <p className="text-red-700">{(trialBalanceErrorMsg as any)?.message || "טעינת נתוני מאזן הבוחן נכשלה"}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : !trialBalance || !Array.isArray(trialBalance) || trialBalance.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">אין רישומים לתקופה זו</h3>
                  <p className="text-muted-foreground">צרו רישומי יומן ל-{fiscalYear}/{fiscalPeriod} כדי לראות את מאזן הבוחן</p>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden overflow-x-auto">
                    <table className="w-full" data-testid="trial-balance-table">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-right font-semibold">קוד חשבון</th>
                          <th className="px-4 py-3 text-right font-semibold">שם חשבון</th>
                          <th className="px-4 py-3 text-right font-semibold">סוג</th>
                          <th className="px-4 py-3 text-left font-semibold">חובה</th>
                          <th className="px-4 py-3 text-left font-semibold">זכות</th>
                          <th className="px-4 py-3 text-left font-semibold">יתרה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialBalance.map((account: any, idx: number) => (
                          <tr key={idx} className="border-t hover:bg-muted/50" data-testid={`trial-balance-row-${account.accountCode}`}>
                            <td className="px-4 py-3 font-mono">{account.accountCode}</td>
                            <td className="px-4 py-3">{account.accountName}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline">{lbl(ACCT_TYPE_HE, account.accountType)}</Badge>
                            </td>
                            <td className="px-4 py-3 text-left font-mono">₪{account.debit.toFixed(2)}</td>
                            <td className="px-4 py-3 text-left font-mono">₪{account.credit.toFixed(2)}</td>
                            <td className="px-4 py-3 text-left font-mono font-semibold">
                              ₪{account.balance.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted font-bold border-t-2">
                        <tr>
                          <td colSpan={3} className="px-4 py-3">סה״כ</td>
                          <td className="px-4 py-3 text-left font-mono" data-testid="total-debit">
                            ₪{trialBalance.reduce((sum: number, a: any) => sum + a.debit, 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-left font-mono" data-testid="total-credit">
                            ₪{trialBalance.reduce((sum: number, a: any) => sum + a.credit, 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-left font-mono" data-testid="total-balance">
                            ₪{trialBalance.reduce((sum: number, a: any) => sum + a.balance, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Balance Verification */}
                  {(() => {
                    const rows = Array.isArray(trialBalance) ? trialBalance : [];
                    const totalDebit = rows.reduce((sum: number, a: any) => sum + (a.debit || 0), 0);
                    const totalCredit = rows.reduce((sum: number, a: any) => sum + (a.credit || 0), 0);
                    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
                    return (
                      <Card className={isBalanced ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"} data-testid="balance-verification">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-3">
                            {isBalanced ? (
                              <CheckCircle2 className="w-6 h-6 text-green-600" />
                            ) : (
                              <AlertTriangle className="w-6 h-6 text-red-600" />
                            )}
                            <div>
                              <h4 className="font-semibold">
                                {isBalanced ? "✓ הספרים מאוזנים" : "⚠ הספרים אינם מאוזנים"}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {isBalanced
                                  ? `סך החובה (₪${totalDebit.toFixed(2)}) שווה לסך הזכות (₪${totalCredit.toFixed(2)})`
                                  : `הפרש: ₪${Math.abs(totalDebit - totalCredit).toFixed(2)} — בדקו את הרישומים`}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                      const trialBalanceTable = document.querySelector('[data-testid="balance-verification"]')?.closest('.space-y-6');
                      const tableEl = trialBalanceTable?.querySelector('table');
                      if (!tableEl) { toast({ title: "אין נתונים לייצוא", variant: "destructive" }); return; }
                      const safeYear = Number(fiscalYear);
                      const safePeriod = Number(fiscalPeriod);
                      const html = [
                        '<!DOCTYPE html><html dir="rtl"><head>',
                        `<title>Pet Wash Trial Balance - ${safeYear}/${safePeriod}</title>`,
                        '<style>body{font-family:system-ui,sans-serif;padding:40px;color:#1a1a1a;direction:rtl}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:start}th{background:#f5f5f5}tfoot{font-weight:bold;border-top:2px solid #333}@media print{body{padding:20px}}</style>',
                        '</head><body>',
                        '<h1>מאזן בוחן — PetWash</h1>',
                        `<p>תקופה: ${safeYear}/${safePeriod} | הופק: ${new Date().toLocaleDateString("he-IL")}</p>`,
                        tableEl.outerHTML,
                        '</body></html>'
                      ].join('');
                      const blob = new Blob([html], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const printWindow = window.open(url, '_blank');
                      if (printWindow) {
                        printWindow.addEventListener('load', () => {
                          printWindow.print();
                          URL.revokeObjectURL(url);
                        });
                      }
                    }}>
                      ייצוא ל-PDF
                    </Button>
                    <Button variant="outline" onClick={() => window.print()}>
                      הדפסה
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax-compliance" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowTaxReturnDialog(true)} data-testid="button-create-tax-return">
              <Plus className="w-4 h-4 ml-2" />
              דוח מס חדש
            </Button>
          </div>

          {/* Tax Returns Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                דוחות מס ({taxReturns?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {taxReturnsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : taxReturnsError ? (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                      <h3 className="text-lg font-semibold mb-2 text-red-900">שגיאה בטעינת דוחות המס</h3>
                      <p className="text-red-700">טעינת דוחות המס נכשלה</p>
                    </div>
                  </CardContent>
                </Card>
              ) : !taxReturns || !Array.isArray(taxReturns) || taxReturns.length === 0 ? (
                <div className="text-center py-12">
                  <FileCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">אין עדיין דוחות מס</h3>
                  <p className="text-muted-foreground mb-4">מוסיפים דוח מס למעקב מע״מ ומס חברות</p>
                  <Button onClick={() => setShowTaxReturnDialog(true)}>
                    <Plus className="w-4 h-4 ml-2" />
                    יצירת דוח מס
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {taxReturns.map((taxReturn: any) => (
                    <Card key={taxReturn.id} data-testid={`tax-return-card-${taxReturn.id}`} className="diamond-card border-metallic-gold">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-metallic-gold">{taxReturn.taxType.toUpperCase()} - {taxReturn.taxYear} {taxReturn.taxPeriod}</h4>
                              <Badge className={getStatusColor(taxReturn.status)}>{lbl(STATUS_HE, taxReturn.status)}</Badge>
                              {taxReturn.itaReferenceNumber && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  <ShieldCheck className="w-3 h-3 ml-1" />
                                  רשות המסים: {taxReturn.itaReferenceNumber}
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                              <span>מס נטו לתשלום: <span className="font-semibold text-metallic-gold">₪{parseFloat(taxReturn.netTaxDue || 0).toFixed(2)}</span></span>
                              <span>מועד הגשה: {new Date(taxReturn.dueDate).toLocaleDateString("he-IL")}</span>
                              <span>סכום חייב במס: ₪{parseFloat(taxReturn.taxableAmount || 0).toFixed(2)}</span>
                              <span>שיעור מס: <span className="text-metallic-gold font-semibold">{taxReturn.taxRate}% מע״מ</span></span>
                              {taxReturn.auditHash && (
                                <span className="col-span-2 text-xs">
                                  <ShieldCheck className="w-3 h-3 inline ml-1" />
                                  ביקורת בלוקצ׳יין: {taxReturn.auditHash.substring(0, 16)}...
                                </span>
                              )}
                            </div>
                            {taxReturn.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="default"
                                className="btn-luxury-gold"
                                onClick={async () => {
                                  try {
                                    await apiRequest(`/api/enterprise/finance/tax-returns/${taxReturn.id}/submit`, {
                                      method: 'POST',
                                      body: JSON.stringify({ submittedBy: 'admin' }),
                                    });
                                    await queryClient.invalidateQueries({ queryKey: ['/api/enterprise/finance/tax-returns'] });
                                    toast({ title: 'בוצע', description: 'דוח המס הוגש לרשות המסים' });
                                  } catch (error: any) {
                                    toast({
                                      title: 'אופס',
                                      description: error.message || 'הגשת דוח המס נכשלה',
                                      variant: 'destructive'
                                    });
                                  }
                                }}
                                data-testid={`button-submit-tax-return-${taxReturn.id}`}
                              >
                                <FileCheck className="w-4 h-4 ml-2" />
                                הגשה לרשות המסים
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tax Payments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                תשלומי מס אחרונים ({taxPayments?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {taxPaymentsLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : !taxPayments || !Array.isArray(taxPayments) || taxPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">לא נרשמו תשלומי מס</div>
              ) : (
                <div className="space-y-2">
                  {taxPayments.slice(0, 5).map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 border rounded" data-testid={`tax-payment-${payment.id}`}>
                      <div>
                        <p className="font-medium">₪{parseFloat(payment.amount).toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">{payment.paymentMethod} - {new Date(payment.paymentDate).toLocaleDateString("he-IL")}</p>
                      </div>
                      <Badge variant="outline">{payment.paymentType || 'מס'}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Trail Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                יומני ביקורת מס אחרונים ({taxAuditLogs?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {taxAuditLogsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : !taxAuditLogs || !Array.isArray(taxAuditLogs) || taxAuditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">אין עדיין יומני ביקורת</div>
              ) : (
                <div className="space-y-2">
                  {taxAuditLogs.slice(0, 10).map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-2 border-b last:border-0" data-testid={`tax-audit-log-${log.id}`}>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.entityType} #{log.entityId} - {new Date(log.timestamp).toLocaleString("he-IL")}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">{log.userId}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Payable Dialog */}
      <Dialog open={showPayableDialog} onOpenChange={setShowPayableDialog}>
        <DialogContent className="max-w-2xl" dir="rtl" data-testid="dialog-create-payable">
          <DialogHeader>
            <DialogTitle>חשבונית ספק חדשה</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePayable} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="invoiceNumber">מספר חשבונית *</Label>
                <Input id="invoiceNumber" name="invoiceNumber" required placeholder="INV-2025-0001" data-testid="input-invoice-number" />
              </div>
              <div>
                <Label htmlFor="supplierId">מזהה ספק *</Label>
                <Input id="supplierId" name="supplierId" type="number" required data-testid="input-supplier-id" />
              </div>
              <div>
                <Label>סטטוס</Label>
                <Select value={payableStatus} onValueChange={setPayableStatus}>
                  <SelectTrigger data-testid="select-payable-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">ממתין</SelectItem>
                    <SelectItem value="scheduled">מתוזמן</SelectItem>
                    <SelectItem value="overdue">באיחור</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="invoiceDate">תאריך חשבונית *</Label>
                <Input id="invoiceDate" name="invoiceDate" type="date" required data-testid="input-invoice-date" />
              </div>
              <div>
                <Label htmlFor="dueDate">מועד תשלום *</Label>
                <Input id="dueDate" name="dueDate" type="date" required data-testid="input-due-date" />
              </div>
              <div>
                <Label htmlFor="amount">סכום *</Label>
                <Input id="amount" name="amount" required data-testid="input-amount" />
              </div>
              <div>
                <Label htmlFor="taxAmount">מע״מ</Label>
                <Input id="taxAmount" name="taxAmount" defaultValue="0" data-testid="input-tax-amount" />
              </div>
              <div>
                <Label htmlFor="totalAmount">סה״כ *</Label>
                <Input id="totalAmount" name="totalAmount" required data-testid="input-total-amount" />
              </div>
              <div>
                <Label htmlFor="currency">מטבע</Label>
                <Input id="currency" name="currency" defaultValue="ILS" data-testid="input-currency" />
              </div>
              <div>
                <Label htmlFor="category">קטגוריה</Label>
                <Input id="category" name="category" placeholder="ציוד, שירותים וכו׳" data-testid="input-category" />
              </div>
              <div>
                <Label htmlFor="glAccountCode">קוד חשבון GL</Label>
                <Input id="glAccountCode" name="glAccountCode" data-testid="input-gl-account-code" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="notes">הערות</Label>
                <Textarea id="notes" name="notes" rows={2} data-testid="textarea-notes" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPayableDialog(false)}
                data-testid="button-cancel-payable"
              >
                ביטול
              </Button>
              <Button type="submit" disabled={createPayableMutation.isPending} data-testid="button-submit-payable">
                {createPayableMutation.isPending ? "יוצר..." : "יצירת חשבונית"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Receivable Dialog */}
      <Dialog open={showReceivableDialog} onOpenChange={setShowReceivableDialog}>
        <DialogContent className="max-w-2xl" dir="rtl" data-testid="dialog-create-receivable">
          <DialogHeader>
            <DialogTitle>חשבונית לקוח חדשה</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateReceivable} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="r-invoiceNumber">מספר חשבונית *</Label>
                <Input id="r-invoiceNumber" name="invoiceNumber" required placeholder="INV-CUST-2025-0001" data-testid="input-r-invoice-number" />
              </div>
              <div>
                <Label htmlFor="customerId">מזהה לקוח *</Label>
                <Input id="customerId" name="customerId" required data-testid="input-customer-id" />
              </div>
              <div>
                <Label>סוג לקוח</Label>
                <Select value={receivableCustomerType} onValueChange={setReceivableCustomerType}>
                  <SelectTrigger data-testid="select-customer-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">לקוח</SelectItem>
                    <SelectItem value="franchise">זכיין</SelectItem>
                    <SelectItem value="partner">שותף</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="r-invoiceDate">תאריך חשבונית *</Label>
                <Input id="r-invoiceDate" name="invoiceDate" type="date" required data-testid="input-r-invoice-date" />
              </div>
              <div>
                <Label htmlFor="r-dueDate">מועד תשלום *</Label>
                <Input id="r-dueDate" name="dueDate" type="date" required data-testid="input-r-due-date" />
              </div>
              <div>
                <Label htmlFor="r-amount">סכום *</Label>
                <Input id="r-amount" name="amount" required data-testid="input-r-amount" />
              </div>
              <div>
                <Label htmlFor="r-taxAmount">מע״מ</Label>
                <Input id="r-taxAmount" name="taxAmount" defaultValue="0" data-testid="input-r-tax-amount" />
              </div>
              <div>
                <Label htmlFor="r-totalAmount">סה״כ *</Label>
                <Input id="r-totalAmount" name="totalAmount" required data-testid="input-r-total-amount" />
              </div>
              <div>
                <Label>סטטוס</Label>
                <Select value={receivableStatus} onValueChange={setReceivableStatus}>
                  <SelectTrigger data-testid="select-receivable-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">ממתין</SelectItem>
                    <SelectItem value="partial">חלקי</SelectItem>
                    <SelectItem value="overdue">באיחור</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="r-category">קטגוריה</Label>
                <Input id="r-category" name="category" placeholder="שירותי שטיפה, דמי זיכיון וכו׳" data-testid="input-r-category" />
              </div>
              <div>
                <Label htmlFor="r-glAccountCode">קוד חשבון GL</Label>
                <Input id="r-glAccountCode" name="glAccountCode" data-testid="input-r-gl-account-code" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="r-notes">הערות</Label>
                <Textarea id="r-notes" name="notes" rows={2} data-testid="textarea-r-notes" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowReceivableDialog(false)}
                data-testid="button-cancel-receivable"
              >
                ביטול
              </Button>
              <Button type="submit" disabled={createReceivableMutation.isPending} data-testid="button-submit-receivable">
                {createReceivableMutation.isPending ? "יוצר..." : "יצירת חשבונית"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Ledger Entry Dialog */}
      <Dialog open={showLedgerDialog} onOpenChange={setShowLedgerDialog}>
        <DialogContent className="max-w-2xl" dir="rtl" data-testid="dialog-create-ledger">
          <DialogHeader>
            <DialogTitle>רישום יומן חדש</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateLedger} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="entryNumber">מספר רישום *</Label>
                <Input id="entryNumber" name="entryNumber" required placeholder="GL-2025-0001" data-testid="input-entry-number" />
              </div>
              <div>
                <Label htmlFor="entryDate">תאריך רישום *</Label>
                <Input id="entryDate" name="entryDate" type="date" required data-testid="input-entry-date" />
              </div>
              <div>
                <Label>סוג חשבון</Label>
                <Select value={ledgerAccountType} onValueChange={setLedgerAccountType}>
                  <SelectTrigger data-testid="select-account-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">נכס</SelectItem>
                    <SelectItem value="liability">התחייבות</SelectItem>
                    <SelectItem value="equity">הון</SelectItem>
                    <SelectItem value="revenue">הכנסה</SelectItem>
                    <SelectItem value="expense">הוצאה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="accountCode">קוד חשבון *</Label>
                <Input id="accountCode" name="accountCode" required placeholder="1000" data-testid="input-account-code" />
              </div>
              <div>
                <Label htmlFor="accountName">שם חשבון *</Label>
                <Input id="accountName" name="accountName" required data-testid="input-account-name" />
              </div>
              <div>
                <Label htmlFor="debit">חובה</Label>
                <Input id="debit" name="debit" defaultValue="0" data-testid="input-debit" />
              </div>
              <div>
                <Label htmlFor="credit">זכות</Label>
                <Input id="credit" name="credit" defaultValue="0" data-testid="input-credit" />
              </div>
              <div>
                <Label htmlFor="fiscalYear">שנת כספים</Label>
                <Input id="fiscalYear" name="fiscalYear" type="number" defaultValue={new Date().getFullYear()} data-testid="input-fiscal-year" />
              </div>
              <div>
                <Label htmlFor="fiscalPeriod">תקופה (1-12)</Label>
                <Input id="fiscalPeriod" name="fiscalPeriod" type="number" defaultValue={new Date().getMonth() + 1} min="1" max="12" data-testid="input-fiscal-period" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">תיאור *</Label>
                <Textarea id="description" name="description" required rows={2} data-testid="textarea-description" />
              </div>
              <div>
                <Label htmlFor="referenceType">סוג אסמכתא</Label>
                <Input id="referenceType" name="referenceType" placeholder="חשבונית, תשלום וכו׳" data-testid="input-reference-type" />
              </div>
              <div>
                <Label htmlFor="referenceId">מזהה אסמכתא</Label>
                <Input id="referenceId" name="referenceId" data-testid="input-reference-id" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowLedgerDialog(false)}
                data-testid="button-cancel-ledger"
              >
                ביטול
              </Button>
              <Button type="submit" disabled={createLedgerMutation.isPending} data-testid="button-submit-ledger">
                {createLedgerMutation.isPending ? "יוצר..." : "יצירת רישום"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Tax Return Dialog */}
      <Dialog open={showTaxReturnDialog} onOpenChange={setShowTaxReturnDialog}>
        <DialogContent className="max-w-2xl" dir="rtl" data-testid="dialog-create-tax-return">
          <DialogHeader>
            <DialogTitle>דוח מס חדש</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTaxReturn} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="taxYear">שנת מס *</Label>
                <Input id="taxYear" name="taxYear" type="number" defaultValue={new Date().getFullYear()} required data-testid="input-tax-year" />
              </div>
              <div>
                <Label htmlFor="taxPeriod">תקופת מס *</Label>
                <Select defaultValue={taxPeriod} onValueChange={setTaxPeriod}>
                  <SelectTrigger data-testid="select-tax-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1">רבעון 1 (ינ׳-מרץ)</SelectItem>
                    <SelectItem value="Q2">רבעון 2 (אפר׳-יוני)</SelectItem>
                    <SelectItem value="Q3">רבעון 3 (יולי-ספט׳)</SelectItem>
                    <SelectItem value="Q4">רבעון 4 (אוק׳-דצמ׳)</SelectItem>
                    <SelectItem value="M01">ינואר</SelectItem>
                    <SelectItem value="M02">פברואר</SelectItem>
                    <SelectItem value="M03">מרץ</SelectItem>
                    <SelectItem value="M04">אפריל</SelectItem>
                    <SelectItem value="M05">מאי</SelectItem>
                    <SelectItem value="M06">יוני</SelectItem>
                    <SelectItem value="M07">יולי</SelectItem>
                    <SelectItem value="M08">אוגוסט</SelectItem>
                    <SelectItem value="M09">ספטמבר</SelectItem>
                    <SelectItem value="M10">אוקטובר</SelectItem>
                    <SelectItem value="M11">נובמבר</SelectItem>
                    <SelectItem value="M12">דצמבר</SelectItem>
                    <SelectItem value="ANNUAL">שנתי</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="taxPeriod" value={taxPeriod} />
              </div>
              <div>
                <Label>סוג מס</Label>
                <Select value={taxReturnType} onValueChange={setTaxReturnType}>
                  <SelectTrigger data-testid="select-tax-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vat">מע״מ (18%)</SelectItem>
                    <SelectItem value="corporate">מס חברות</SelectItem>
                    <SelectItem value="income">מס הכנסה</SelectItem>
                    <SelectItem value="payroll">מס שכר</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>סטטוס</Label>
                <Select value={taxReturnStatus} onValueChange={setTaxReturnStatus}>
                  <SelectTrigger data-testid="select-tax-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">טיוטה</SelectItem>
                    <SelectItem value="pending">ממתין לאישור</SelectItem>
                    <SelectItem value="submitted">הוגש</SelectItem>
                    <SelectItem value="approved">אושר</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dueDate">מועד הגשה *</Label>
                <Input id="dueDate" name="dueDate" type="date" required data-testid="input-due-date" />
              </div>
              <div>
                <Label htmlFor="taxRate">שיעור מס (%)</Label>
                <Input id="taxRate" name="taxRate" type="number" step="0.01" defaultValue="18" data-testid="input-tax-rate" />
              </div>
              <div>
                <Label htmlFor="grossSales">מכירות ברוטו (₪)</Label>
                <Input id="grossSales" name="grossSales" defaultValue="0" data-testid="input-gross-sales" />
              </div>
              <div>
                <Label htmlFor="exemptSales">מכירות פטורות (₪)</Label>
                <Input id="exemptSales" name="exemptSales" defaultValue="0" data-testid="input-exempt-sales" />
              </div>
              <div>
                <Label htmlFor="taxableAmount">סכום חייב במס (₪)</Label>
                <Input id="taxableAmount" name="taxableAmount" defaultValue="0" data-testid="input-taxable-amount" />
              </div>
              <div>
                <Label htmlFor="taxAmount">סכום מס (₪)</Label>
                <Input id="taxAmount" name="taxAmount" defaultValue="0" data-testid="input-tax-amount" />
              </div>
              <div>
                <Label htmlFor="inputVat">מע״מ תשומות (₪)</Label>
                <Input id="inputVat" name="inputVat" defaultValue="0" data-testid="input-input-vat" />
              </div>
              <div>
                <Label htmlFor="outputVat">מע״מ עסקאות (₪)</Label>
                <Input id="outputVat" name="outputVat" defaultValue="0" data-testid="input-output-vat" />
              </div>
              <div>
                <Label htmlFor="netTaxDue">מס נטו לתשלום (₪) *</Label>
                <Input id="netTaxDue" name="netTaxDue" required data-testid="input-net-tax-due" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="notes">הערות</Label>
                <Textarea id="notes" name="notes" rows={2} data-testid="textarea-notes" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowTaxReturnDialog(false)}
                data-testid="button-cancel-tax-return"
              >
                ביטול
              </Button>
              <Button type="submit" disabled={createTaxReturnMutation.isPending} data-testid="button-submit-tax-return">
                {createTaxReturnMutation.isPending ? "יוצר..." : "יצירת דוח"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
