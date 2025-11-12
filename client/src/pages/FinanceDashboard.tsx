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
      toast({ title: "Success", description: "Accounts payable created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create accounts payable", variant: "destructive" });
    },
  });

  const createReceivableMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/finance/accounts-receivable`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-receivable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-receivable/overdue"] });
      setShowReceivableDialog(false);
      toast({ title: "Success", description: "Accounts receivable created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create accounts receivable", variant: "destructive" });
    },
  });

  const createLedgerMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/finance/general-ledger`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/general-ledger"] });
      setShowLedgerDialog(false);
      toast({ title: "Success", description: "General ledger entry created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create general ledger entry", variant: "destructive" });
    },
  });

  const createTaxReturnMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/finance/tax-returns`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/tax-returns"] });
      setShowTaxReturnDialog(false);
      toast({ title: "Success", description: "Tax return created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create tax return", variant: "destructive" });
    },
  });

  const payPayableMutation = useMutation({
    mutationFn: async ({ id, paymentDate, paymentMethod, paymentReference }: any) =>
      apiRequest(`/api/enterprise/finance/accounts-payable/${id}/pay`, { method: "POST", body: { paymentDate, paymentMethod, paymentReference } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-payable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-payable/overdue"] });
      toast({ title: "Success", description: "Payment recorded successfully" });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ id, amount, paymentDate, paymentMethod }: any) =>
      apiRequest(`/api/enterprise/finance/accounts-receivable/${id}/payment`, { method: "POST", body: { amount, paymentDate, paymentMethod } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-receivable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/finance/accounts-receivable/overdue"] });
      toast({ title: "Success", description: "Payment recorded successfully" });
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
      scheduled: "bg-blue-500",
      paid: "bg-green-500",
      overdue: "bg-red-500",
      partial: "bg-orange-500",
      cancelled: "bg-gray-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const totalPayablesAmount = accountsPayable?.reduce((sum: number, p: any) => sum + parseFloat(p.totalAmount || 0), 0) || 0;
  const totalReceivablesAmount = accountsReceivable?.reduce((sum: number, r: any) => sum + parseFloat(r.totalAmount || 0), 0) || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Finance & Accounting</h1>
          <p className="text-muted-foreground">Manage accounts payable, receivable, and general ledger</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payables</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="metric-total-payables">
              ₪{totalPayablesAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">{accountsPayable?.length || 0} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receivables</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="metric-total-receivables">
              ₪{totalReceivablesAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">{accountsReceivable?.length || 0} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Payables</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="metric-overdue-payables">{overduePayables?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Receivables</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="metric-overdue-receivables">{overdueReceivables?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payables" className="w-full">
        <TabsList>
          <TabsTrigger value="payables" data-testid="tab-payables">
            <FileText className="w-4 h-4 mr-2" />
            Accounts Payable ({accountsPayable?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="receivables" data-testid="tab-receivables">
            <DollarSign className="w-4 h-4 mr-2" />
            Accounts Receivable ({accountsReceivable?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="ledger" data-testid="tab-ledger">
            <FileText className="w-4 h-4 mr-2" />
            General Ledger ({generalLedger?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <TrendingUp className="w-4 h-4 mr-2" />
            Financial Reports
          </TabsTrigger>
          <TabsTrigger value="tax-compliance" data-testid="tab-tax-compliance">
            <FileCheck className="w-4 h-4 mr-2" />
            Tax Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payables" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowPayableDialog(true)} data-testid="button-create-payable">
              <Plus className="w-4 h-4 mr-2" />
              New Payable
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
                  <h3 className="text-lg font-semibold mb-2">No accounts payable yet</h3>
                  <p className="text-muted-foreground mb-4">Create payables to track supplier invoices</p>
                  <Button onClick={() => setShowPayableDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Payable
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accountsPayable?.map((payable: any) => (
                <Card key={payable.id} data-testid={`payable-card-${payable.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{payable.invoiceNumber}</h4>
                          <Badge className={getStatusColor(payable.paymentStatus)}>{payable.paymentStatus}</Badge>
                          {payable.category && <Badge variant="outline">{payable.category}</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span>Supplier ID: {payable.supplierId}</span>
                          <span>Amount: ₪{parseFloat(payable.totalAmount).toFixed(2)}</span>
                          <span>Due: {new Date(payable.dueDate).toLocaleDateString()}</span>
                        </div>
                        {payable.notes && <p className="text-sm text-muted-foreground">{payable.notes}</p>}
                      </div>
                      <div className="flex gap-2">
                        {payable.paymentStatus === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              const paymentDate = new Date().toISOString().split('T')[0];
                              const paymentMethod = prompt("Enter payment method:");
                              if (paymentMethod) {
                                payPayableMutation.mutate({ id: payable.id, paymentDate, paymentMethod });
                              }
                            }}
                            data-testid={`button-pay-${payable.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Mark Paid
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
            <Button onClick={() => setShowReceivableDialog(true)} data-testid="button-create-receivable">
              <Plus className="w-4 h-4 mr-2" />
              New Receivable
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
                  <h3 className="text-lg font-semibold mb-2">No accounts receivable yet</h3>
                  <p className="text-muted-foreground mb-4">Create receivables to track customer invoices</p>
                  <Button onClick={() => setShowReceivableDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Receivable
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accountsReceivable?.map((receivable: any) => (
                <Card key={receivable.id} data-testid={`receivable-card-${receivable.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{receivable.invoiceNumber}</h4>
                          <Badge className={getStatusColor(receivable.paymentStatus)}>{receivable.paymentStatus}</Badge>
                          <Badge variant="outline">{receivable.customerType}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span>Customer: {receivable.customerId}</span>
                          <span>Amount: ₪{parseFloat(receivable.totalAmount).toFixed(2)}</span>
                          <span>Paid: ₪{parseFloat(receivable.paidAmount || 0).toFixed(2)}</span>
                          <span>Due: {new Date(receivable.dueDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {receivable.paymentStatus !== "paid" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              const amount = prompt("Enter payment amount:");
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
                            Record Payment
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
            <Button onClick={() => setShowLedgerDialog(true)} data-testid="button-create-ledger">
              <Plus className="w-4 h-4 mr-2" />
              New Entry
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
                  <h3 className="text-lg font-semibold mb-2">No ledger entries yet</h3>
                  <p className="text-muted-foreground mb-4">Create entries for double-entry bookkeeping</p>
                  <Button onClick={() => setShowLedgerDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Entry
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
                          <Badge variant="outline">{entry.accountType}</Badge>
                          {entry.isReconciled && <Badge className="bg-green-500">Reconciled</Badge>}
                        </div>
                        <p className="text-sm mb-2">{entry.description}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Account: {entry.accountCode} - {entry.accountName}</span>
                          <span>Debit: ₪{parseFloat(entry.debit || 0).toFixed(2)}</span>
                          <span>Credit: ₪{parseFloat(entry.credit || 0).toFixed(2)}</span>
                          <span>Date: {new Date(entry.entryDate).toLocaleDateString()}</span>
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
              <CardTitle>Trial Balance Report</CardTitle>
              <p className="text-sm text-muted-foreground">View account balances for a specific fiscal period</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end">
                <div>
                  <Label htmlFor="fiscalYear">Fiscal Year</Label>
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
                  <Label htmlFor="fiscalPeriod">Fiscal Period (1-12)</Label>
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
                  Refresh
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
                      <h3 className="text-lg font-semibold mb-2 text-red-900">Error Loading Trial Balance</h3>
                      <p className="text-red-700">{(trialBalanceErrorMsg as any)?.message || "Failed to load trial balance data"}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : !trialBalance || !Array.isArray(trialBalance) || trialBalance.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No entries for this period</h3>
                  <p className="text-muted-foreground">Create general ledger entries for {fiscalYear}/{fiscalPeriod} to see the trial balance</p>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full" data-testid="trial-balance-table">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Account Code</th>
                          <th className="px-4 py-3 text-left font-semibold">Account Name</th>
                          <th className="px-4 py-3 text-left font-semibold">Type</th>
                          <th className="px-4 py-3 text-right font-semibold">Debit</th>
                          <th className="px-4 py-3 text-right font-semibold">Credit</th>
                          <th className="px-4 py-3 text-right font-semibold">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialBalance.map((account: any, idx: number) => (
                          <tr key={idx} className="border-t hover:bg-muted/50" data-testid={`trial-balance-row-${account.accountCode}`}>
                            <td className="px-4 py-3 font-mono">{account.accountCode}</td>
                            <td className="px-4 py-3">{account.accountName}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline">{account.accountType}</Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">₪{account.debit.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono">₪{account.credit.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold">
                              ₪{account.balance.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted font-bold border-t-2">
                        <tr>
                          <td colSpan={3} className="px-4 py-3">TOTALS</td>
                          <td className="px-4 py-3 text-right font-mono" data-testid="total-debit">
                            ₪{trialBalance.reduce((sum: number, a: any) => sum + a.debit, 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono" data-testid="total-credit">
                            ₪{trialBalance.reduce((sum: number, a: any) => sum + a.credit, 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono" data-testid="total-balance">
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
                                {isBalanced ? "✓ Books are Balanced" : "⚠ Books are Imbalanced"}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {isBalanced
                                  ? `Total debits (₪${totalDebit.toFixed(2)}) equal total credits (₪${totalCredit.toFixed(2)})`
                                  : `Difference: ₪${Math.abs(totalDebit - totalCredit).toFixed(2)} - Please review entries`}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => toast({ title: "Export feature coming soon", description: "PDF export will be available in the next iteration" })}>
                      Export to PDF
                    </Button>
                    <Button variant="outline" onClick={() => window.print()}>
                      Print Report
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
              <Plus className="w-4 h-4 mr-2" />
              New Tax Return
            </Button>
          </div>

          {/* Tax Returns Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Tax Returns ({taxReturns?.length || 0})
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
                      <h3 className="text-lg font-semibold mb-2 text-red-900">Error Loading Tax Returns</h3>
                      <p className="text-red-700">Failed to load tax returns data</p>
                    </div>
                  </CardContent>
                </Card>
              ) : !taxReturns || !Array.isArray(taxReturns) || taxReturns.length === 0 ? (
                <div className="text-center py-12">
                  <FileCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No tax returns yet</h3>
                  <p className="text-muted-foreground mb-4">Create tax returns to track Israeli VAT and corporate tax compliance</p>
                  <Button onClick={() => setShowTaxReturnDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Tax Return
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
                              <Badge className={getStatusColor(taxReturn.status)}>{taxReturn.status}</Badge>
                              {taxReturn.itaReferenceNumber && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  <ShieldCheck className="w-3 h-3 mr-1" />
                                  ITA: {taxReturn.itaReferenceNumber}
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                              <span>Net Tax Due: <span className="font-semibold text-metallic-gold">₪{parseFloat(taxReturn.netTaxDue || 0).toFixed(2)}</span></span>
                              <span>Due Date: {new Date(taxReturn.dueDate).toLocaleDateString()}</span>
                              <span>Taxable Amount: ₪{parseFloat(taxReturn.taxableAmount || 0).toFixed(2)}</span>
                              <span>Tax Rate: <span className="text-metallic-gold font-semibold">{taxReturn.taxRate}% VAT</span></span>
                              {taxReturn.auditHash && (
                                <span className="col-span-2 text-xs">
                                  <ShieldCheck className="w-3 h-3 inline mr-1" />
                                  Blockchain Audit: {taxReturn.auditHash.substring(0, 16)}...
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
                                    await apiRequest(`/api/finance/tax-returns/${taxReturn.id}/submit`, {
                                      method: 'POST',
                                      body: JSON.stringify({ submittedBy: 'admin' }),
                                    });
                                    await queryClient.invalidateQueries({ queryKey: ['/api/finance/tax-returns'] });
                                    toast({ title: 'Success', description: 'Tax return submitted to ITA' });
                                  } catch (error: any) {
                                    toast({ 
                                      title: 'Error', 
                                      description: error.message || 'Failed to submit tax return',
                                      variant: 'destructive'
                                    });
                                  }
                                }}
                                data-testid={`button-submit-tax-return-${taxReturn.id}`}
                              >
                                <FileCheck className="w-4 h-4 mr-2" />
                                Submit to ITA
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
                Recent Tax Payments ({taxPayments?.length || 0})
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
                <div className="text-center py-8 text-muted-foreground">No tax payments recorded</div>
              ) : (
                <div className="space-y-2">
                  {taxPayments.slice(0, 5).map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 border rounded" data-testid={`tax-payment-${payment.id}`}>
                      <div>
                        <p className="font-medium">₪{parseFloat(payment.amount).toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">{payment.paymentMethod} - {new Date(payment.paymentDate).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="outline">{payment.paymentType || 'tax'}</Badge>
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
                Recent Tax Audit Logs ({taxAuditLogs?.length || 0})
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
                <div className="text-center py-8 text-muted-foreground">No audit logs yet</div>
              ) : (
                <div className="space-y-2">
                  {taxAuditLogs.slice(0, 10).map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-2 border-b last:border-0" data-testid={`tax-audit-log-${log.id}`}>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.entityType} #{log.entityId} - {new Date(log.timestamp).toLocaleString()}
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
        <DialogContent className="max-w-2xl" data-testid="dialog-create-payable">
          <DialogHeader>
            <DialogTitle>Create Accounts Payable</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePayable} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="invoiceNumber">Invoice Number *</Label>
                <Input id="invoiceNumber" name="invoiceNumber" required placeholder="INV-2025-0001" data-testid="input-invoice-number" />
              </div>
              <div>
                <Label htmlFor="supplierId">Supplier ID *</Label>
                <Input id="supplierId" name="supplierId" type="number" required data-testid="input-supplier-id" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={payableStatus} onValueChange={setPayableStatus}>
                  <SelectTrigger data-testid="select-payable-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="invoiceDate">Invoice Date *</Label>
                <Input id="invoiceDate" name="invoiceDate" type="date" required data-testid="input-invoice-date" />
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date *</Label>
                <Input id="dueDate" name="dueDate" type="date" required data-testid="input-due-date" />
              </div>
              <div>
                <Label htmlFor="amount">Amount *</Label>
                <Input id="amount" name="amount" required data-testid="input-amount" />
              </div>
              <div>
                <Label htmlFor="taxAmount">Tax Amount</Label>
                <Input id="taxAmount" name="taxAmount" defaultValue="0" data-testid="input-tax-amount" />
              </div>
              <div>
                <Label htmlFor="totalAmount">Total Amount *</Label>
                <Input id="totalAmount" name="totalAmount" required data-testid="input-total-amount" />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" name="currency" defaultValue="ILS" data-testid="input-currency" />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" placeholder="supplies, utilities, etc." data-testid="input-category" />
              </div>
              <div>
                <Label htmlFor="glAccountCode">GL Account Code</Label>
                <Input id="glAccountCode" name="glAccountCode" data-testid="input-gl-account-code" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
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
                Cancel
              </Button>
              <Button type="submit" disabled={createPayableMutation.isPending} data-testid="button-submit-payable">
                {createPayableMutation.isPending ? "Creating..." : "Create Payable"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Receivable Dialog */}
      <Dialog open={showReceivableDialog} onOpenChange={setShowReceivableDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-receivable">
          <DialogHeader>
            <DialogTitle>Create Accounts Receivable</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateReceivable} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="r-invoiceNumber">Invoice Number *</Label>
                <Input id="r-invoiceNumber" name="invoiceNumber" required placeholder="INV-CUST-2025-0001" data-testid="input-r-invoice-number" />
              </div>
              <div>
                <Label htmlFor="customerId">Customer ID *</Label>
                <Input id="customerId" name="customerId" required data-testid="input-customer-id" />
              </div>
              <div>
                <Label>Customer Type</Label>
                <Select value={receivableCustomerType} onValueChange={setReceivableCustomerType}>
                  <SelectTrigger data-testid="select-customer-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="franchise">Franchise</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="r-invoiceDate">Invoice Date *</Label>
                <Input id="r-invoiceDate" name="invoiceDate" type="date" required data-testid="input-r-invoice-date" />
              </div>
              <div>
                <Label htmlFor="r-dueDate">Due Date *</Label>
                <Input id="r-dueDate" name="dueDate" type="date" required data-testid="input-r-due-date" />
              </div>
              <div>
                <Label htmlFor="r-amount">Amount *</Label>
                <Input id="r-amount" name="amount" required data-testid="input-r-amount" />
              </div>
              <div>
                <Label htmlFor="r-taxAmount">Tax Amount</Label>
                <Input id="r-taxAmount" name="taxAmount" defaultValue="0" data-testid="input-r-tax-amount" />
              </div>
              <div>
                <Label htmlFor="r-totalAmount">Total Amount *</Label>
                <Input id="r-totalAmount" name="totalAmount" required data-testid="input-r-total-amount" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={receivableStatus} onValueChange={setReceivableStatus}>
                  <SelectTrigger data-testid="select-receivable-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="r-category">Category</Label>
                <Input id="r-category" name="category" placeholder="wash_services, franchise_fees, etc." data-testid="input-r-category" />
              </div>
              <div>
                <Label htmlFor="r-glAccountCode">GL Account Code</Label>
                <Input id="r-glAccountCode" name="glAccountCode" data-testid="input-r-gl-account-code" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="r-notes">Notes</Label>
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
                Cancel
              </Button>
              <Button type="submit" disabled={createReceivableMutation.isPending} data-testid="button-submit-receivable">
                {createReceivableMutation.isPending ? "Creating..." : "Create Receivable"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Ledger Entry Dialog */}
      <Dialog open={showLedgerDialog} onOpenChange={setShowLedgerDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-ledger">
          <DialogHeader>
            <DialogTitle>Create General Ledger Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateLedger} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="entryNumber">Entry Number *</Label>
                <Input id="entryNumber" name="entryNumber" required placeholder="GL-2025-0001" data-testid="input-entry-number" />
              </div>
              <div>
                <Label htmlFor="entryDate">Entry Date *</Label>
                <Input id="entryDate" name="entryDate" type="date" required data-testid="input-entry-date" />
              </div>
              <div>
                <Label>Account Type</Label>
                <Select value={ledgerAccountType} onValueChange={setLedgerAccountType}>
                  <SelectTrigger data-testid="select-account-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="liability">Liability</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="accountCode">Account Code *</Label>
                <Input id="accountCode" name="accountCode" required placeholder="1000" data-testid="input-account-code" />
              </div>
              <div>
                <Label htmlFor="accountName">Account Name *</Label>
                <Input id="accountName" name="accountName" required data-testid="input-account-name" />
              </div>
              <div>
                <Label htmlFor="debit">Debit</Label>
                <Input id="debit" name="debit" defaultValue="0" data-testid="input-debit" />
              </div>
              <div>
                <Label htmlFor="credit">Credit</Label>
                <Input id="credit" name="credit" defaultValue="0" data-testid="input-credit" />
              </div>
              <div>
                <Label htmlFor="fiscalYear">Fiscal Year</Label>
                <Input id="fiscalYear" name="fiscalYear" type="number" defaultValue={new Date().getFullYear()} data-testid="input-fiscal-year" />
              </div>
              <div>
                <Label htmlFor="fiscalPeriod">Fiscal Period (1-12)</Label>
                <Input id="fiscalPeriod" name="fiscalPeriod" type="number" defaultValue={new Date().getMonth() + 1} min="1" max="12" data-testid="input-fiscal-period" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" name="description" required rows={2} data-testid="textarea-description" />
              </div>
              <div>
                <Label htmlFor="referenceType">Reference Type</Label>
                <Input id="referenceType" name="referenceType" placeholder="invoice, payment, etc." data-testid="input-reference-type" />
              </div>
              <div>
                <Label htmlFor="referenceId">Reference ID</Label>
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
                Cancel
              </Button>
              <Button type="submit" disabled={createLedgerMutation.isPending} data-testid="button-submit-ledger">
                {createLedgerMutation.isPending ? "Creating..." : "Create Entry"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Tax Return Dialog */}
      <Dialog open={showTaxReturnDialog} onOpenChange={setShowTaxReturnDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-tax-return">
          <DialogHeader>
            <DialogTitle>Create Tax Return</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTaxReturn} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="taxYear">Tax Year *</Label>
                <Input id="taxYear" name="taxYear" type="number" defaultValue={new Date().getFullYear()} required data-testid="input-tax-year" />
              </div>
              <div>
                <Label htmlFor="taxPeriod">Tax Period *</Label>
                <Select defaultValue={taxPeriod} onValueChange={setTaxPeriod}>
                  <SelectTrigger data-testid="select-tax-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1">Q1 (Jan-Mar)</SelectItem>
                    <SelectItem value="Q2">Q2 (Apr-Jun)</SelectItem>
                    <SelectItem value="Q3">Q3 (Jul-Sep)</SelectItem>
                    <SelectItem value="Q4">Q4 (Oct-Dec)</SelectItem>
                    <SelectItem value="M01">January</SelectItem>
                    <SelectItem value="M02">February</SelectItem>
                    <SelectItem value="M03">March</SelectItem>
                    <SelectItem value="M04">April</SelectItem>
                    <SelectItem value="M05">May</SelectItem>
                    <SelectItem value="M06">June</SelectItem>
                    <SelectItem value="M07">July</SelectItem>
                    <SelectItem value="M08">August</SelectItem>
                    <SelectItem value="M09">September</SelectItem>
                    <SelectItem value="M10">October</SelectItem>
                    <SelectItem value="M11">November</SelectItem>
                    <SelectItem value="M12">December</SelectItem>
                    <SelectItem value="ANNUAL">Annual</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="taxPeriod" value={taxPeriod} />
              </div>
              <div>
                <Label>Tax Type</Label>
                <Select value={taxReturnType} onValueChange={setTaxReturnType}>
                  <SelectTrigger data-testid="select-tax-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vat">VAT (18% Israeli)</SelectItem>
                    <SelectItem value="corporate">Corporate Tax</SelectItem>
                    <SelectItem value="income">Income Tax</SelectItem>
                    <SelectItem value="payroll">Payroll Tax</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={taxReturnStatus} onValueChange={setTaxReturnStatus}>
                  <SelectTrigger data-testid="select-tax-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending Review</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date *</Label>
                <Input id="dueDate" name="dueDate" type="date" required data-testid="input-due-date" />
              </div>
              <div>
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input id="taxRate" name="taxRate" type="number" step="0.01" defaultValue="18" data-testid="input-tax-rate" />
              </div>
              <div>
                <Label htmlFor="grossSales">Gross Sales (₪)</Label>
                <Input id="grossSales" name="grossSales" defaultValue="0" data-testid="input-gross-sales" />
              </div>
              <div>
                <Label htmlFor="exemptSales">Exempt Sales (₪)</Label>
                <Input id="exemptSales" name="exemptSales" defaultValue="0" data-testid="input-exempt-sales" />
              </div>
              <div>
                <Label htmlFor="taxableAmount">Taxable Amount (₪)</Label>
                <Input id="taxableAmount" name="taxableAmount" defaultValue="0" data-testid="input-taxable-amount" />
              </div>
              <div>
                <Label htmlFor="taxAmount">Tax Amount (₪)</Label>
                <Input id="taxAmount" name="taxAmount" defaultValue="0" data-testid="input-tax-amount" />
              </div>
              <div>
                <Label htmlFor="inputVat">Input VAT (₪)</Label>
                <Input id="inputVat" name="inputVat" defaultValue="0" data-testid="input-input-vat" />
              </div>
              <div>
                <Label htmlFor="outputVat">Output VAT (₪)</Label>
                <Input id="outputVat" name="outputVat" defaultValue="0" data-testid="input-output-vat" />
              </div>
              <div>
                <Label htmlFor="netTaxDue">Net Tax Due (₪) *</Label>
                <Input id="netTaxDue" name="netTaxDue" required data-testid="input-net-tax-due" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
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
                Cancel
              </Button>
              <Button type="submit" disabled={createTaxReturnMutation.isPending} data-testid="button-submit-tax-return">
                {createTaxReturnMutation.isPending ? "Creating..." : "Create Tax Return"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
