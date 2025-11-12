import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, FileText, CheckCircle, XCircle, Star, DollarSign, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SuppliersDashboard() {
  const [view, setView] = useState<"all" | "active">("active");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [detailView, setDetailView] = useState<"contracts" | "payments" | "quality">("contracts");
  const [supplierType, setSupplierType] = useState<string>("shampoo");
  const { toast } = useToast();

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["/api/enterprise/corporate/suppliers", view],
    queryFn: async () => {
      const endpoint = view === "active" 
        ? "/api/enterprise/corporate/suppliers/active"
        : "/api/enterprise/corporate/suppliers";
      const response = await fetch(endpoint, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch suppliers");
      return response.json();
    },
  });

  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ["/api/enterprise/corporate/suppliers", selectedSupplier?.id, "contracts"],
    queryFn: async () => {
      if (!selectedSupplier) return null;
      const response = await fetch(`/api/enterprise/corporate/suppliers/${selectedSupplier.id}/contracts`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch contracts");
      return response.json();
    },
    enabled: !!selectedSupplier,
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/enterprise/corporate/suppliers", selectedSupplier?.id, "payments"],
    queryFn: async () => {
      if (!selectedSupplier) return null;
      const response = await fetch(`/api/enterprise/corporate/suppliers/${selectedSupplier.id}/payments`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
    enabled: !!selectedSupplier,
  });

  const { data: qualityScores, isLoading: qualityLoading } = useQuery({
    queryKey: ["/api/enterprise/corporate/suppliers", selectedSupplier?.id, "quality-scores"],
    queryFn: async () => {
      if (!selectedSupplier) return null;
      const response = await fetch(`/api/enterprise/corporate/suppliers/${selectedSupplier.id}/quality-scores`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch quality scores");
      return response.json();
    },
    enabled: !!selectedSupplier,
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/enterprise/corporate/suppliers`, { method: "POST", body: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/corporate/suppliers"] });
      setShowCreateDialog(false);
      toast({ title: "Success", description: "Supplier created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create supplier", variant: "destructive" });
    },
  });

  const handleCreateSupplier = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      companyName: formData.get("companyName"),
      legalName: formData.get("legalName"),
      country: formData.get("country"),
      primaryContact: formData.get("primaryContact"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      supplierType: supplierType,
      paymentTerms: formData.get("paymentTerms") || "Net 30",
      isActive: true,
      isApproved: false,
      onboardedAt: new Date().toISOString().split('T')[0],
    };
    createSupplierMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-4">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">
            Supplier Management
          </h1>
          <p className="text-muted-foreground mt-2" data-testid="page-description">
            Manage vendor registry, contracts, payment tracking, and quality scorecards
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-supplier">
          <Plus className="w-4 h-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={view === "active" ? "default" : "outline"}
          onClick={() => setView("active")}
          data-testid="button-view-active"
        >
          Active Suppliers
        </Button>
        <Button
          variant={view === "all" ? "default" : "outline"}
          onClick={() => setView("all")}
          data-testid="button-view-all"
        >
          All Suppliers
        </Button>
      </div>

      {suppliers?.length === 0 ? (
        <Card data-testid="empty-state">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No suppliers found. Add your first supplier to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {suppliers?.map((supplier: any) => (
            <Card key={supplier.id} data-testid={`supplier-card-${supplier.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      {supplier.companyName}
                    </CardTitle>
                    <CardDescription>{supplier.supplierType}</CardDescription>
                  </div>
                  {supplier.isActive && (
                    <Badge variant="default">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="text-sm font-medium">{supplier.primaryContact}</p>
                  <p className="text-sm">{supplier.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="text-sm">{supplier.country}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Payment Terms</p>
                  <p className="text-sm font-medium">{supplier.paymentTerms || "Net 30"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Quality Score</p>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-medium">{supplier.qualityScore || "Not rated"}/10</span>
                  </div>
                </div>
                {!supplier.isApproved && (
                  <Badge variant="secondary">
                    <XCircle className="w-3 h-3 mr-1" />
                    Pending Approval
                  </Badge>
                )}
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => setSelectedSupplier(supplier)}
                  data-testid={`button-view-contracts-${supplier.id}`}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Contracts
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent data-testid="dialog-create-supplier">
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
            <DialogDescription>Register a new vendor to your supplier network</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSupplier} className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name *</Label>
              <Input id="companyName" name="companyName" required data-testid="input-company-name" />
            </div>
            <div>
              <Label htmlFor="legalName">Legal Name</Label>
              <Input id="legalName" name="legalName" data-testid="input-legal-name" />
            </div>
            <div>
              <Label htmlFor="supplierType">Supplier Type</Label>
              <Select value={supplierType} onValueChange={setSupplierType}>
                <SelectTrigger data-testid="select-supplier-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shampoo">Shampoo & Products</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="logistics">Logistics</SelectItem>
                  <SelectItem value="IT">IT Services</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="primaryContact">Primary Contact *</Label>
              <Input id="primaryContact" name="primaryContact" required data-testid="input-primary-contact" />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required data-testid="input-email" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" data-testid="input-phone" />
            </div>
            <div>
              <Label htmlFor="country">Country *</Label>
              <Input id="country" name="country" required data-testid="input-country" />
            </div>
            <div>
              <Label htmlFor="paymentTerms">Payment Terms</Label>
              <Input id="paymentTerms" name="paymentTerms" placeholder="Net 30" data-testid="input-payment-terms" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createSupplierMutation.isPending} data-testid="button-submit-supplier">
                {createSupplierMutation.isPending ? "Creating..." : "Create Supplier"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSupplier} onOpenChange={() => setSelectedSupplier(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-supplier-details">
          <DialogHeader>
            <DialogTitle>{selectedSupplier?.companyName}</DialogTitle>
            <DialogDescription>Contracts, Payments, and Quality Scorecards</DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="contracts" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="contracts" data-testid="tab-contracts">
                <FileText className="w-4 h-4 mr-2" />
                Contracts
              </TabsTrigger>
              <TabsTrigger value="payments" data-testid="tab-payments">
                <DollarSign className="w-4 h-4 mr-2" />
                Payments
              </TabsTrigger>
              <TabsTrigger value="quality" data-testid="tab-quality">
                <TrendingUp className="w-4 h-4 mr-2" />
                Quality
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contracts" className="mt-4">
              {contractsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : contracts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No contracts found for this supplier
                </div>
              ) : (
                <div className="space-y-3">
                  {contracts?.map((contract: any) => (
                    <Card key={contract.id} data-testid={`contract-${contract.id}`}>
                      <CardContent className="pt-4">
                        <h4 className="font-semibold">{contract.title}</h4>
                        <p className="text-sm text-muted-foreground">{contract.contractNumber}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Start:</span> {new Date(contract.startDate).toLocaleDateString()}
                          </div>
                          <div>
                            <span className="text-muted-foreground">End:</span> {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : "Ongoing"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Value:</span> {contract.totalValue ? `${contract.currency} ${parseFloat(contract.totalValue).toLocaleString()}` : "N/A"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Schedule:</span> {contract.paymentSchedule || "Per delivery"}
                          </div>
                          <div className="col-span-2">
                            <Badge variant={contract.status === "active" ? "default" : "secondary"}>
                              {contract.status}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              {paymentsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : payments?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No payment records found for this supplier
                </div>
              ) : (
                <div className="space-y-3">
                  {payments?.map((payment: any) => (
                    <Card key={payment.id} data-testid={`payment-${payment.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold">{payment.invoiceNumber}</h4>
                            <p className="text-sm text-muted-foreground">
                              Due: {new Date(payment.dueDate).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant={
                            payment.paymentStatus === "paid" ? "default" : 
                            payment.paymentStatus === "overdue" ? "destructive" : 
                            "secondary"
                          }>
                            {payment.paymentStatus}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Amount:</span>{" "}
                            {payment.currency} {parseFloat(payment.amount).toLocaleString()}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Invoice Date:</span>{" "}
                            {new Date(payment.invoiceDate).toLocaleDateString()}
                          </div>
                          {payment.paidAt && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Paid:</span>{" "}
                              {new Date(payment.paidAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="quality" className="mt-4">
              {qualityLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : qualityScores?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No quality evaluations found for this supplier
                </div>
              ) : (
                <div className="space-y-3">
                  {qualityScores?.map((score: any) => (
                    <Card key={score.id} data-testid={`quality-${score.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold">
                              Evaluation - {new Date(score.evaluationDate).toLocaleDateString()}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Evaluated by: {score.evaluatedBy || "System"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            <span className="text-lg font-bold">{parseFloat(score.overallScore).toFixed(1)}</span>
                            <span className="text-muted-foreground">/10</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Quality:</span> {parseFloat(score.qualityScore).toFixed(1)}/10
                          </div>
                          <div>
                            <span className="text-muted-foreground">Delivery:</span> {parseFloat(score.deliveryScore).toFixed(1)}/10
                          </div>
                          <div>
                            <span className="text-muted-foreground">Price:</span> {parseFloat(score.priceScore).toFixed(1)}/10
                          </div>
                          <div>
                            <span className="text-muted-foreground">Service:</span> {parseFloat(score.serviceScore).toFixed(1)}/10
                          </div>
                        </div>
                        {score.comments && (
                          <p className="text-sm mt-2 italic text-muted-foreground">{score.comments}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
