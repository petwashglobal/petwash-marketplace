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
import { Plus, Building2, FileText, CheckCircle, XCircle } from "lucide-react";
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function JvPartnersDashboard() {
  const [view, setView] = useState<"all" | "active">("active");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [partnerType, setPartnerType] = useState<string>("strategic");
  const { toast} = useToast();

  const { data: partners, isLoading } = useQuery({
    queryKey: ["/api/enterprise/corporate/jv-partners", view],
    queryFn: async () => {
      const endpoint = view === "active" 
        ? "/api/enterprise/corporate/jv-partners/active"
        : "/api/enterprise/corporate/jv-partners";
      const response = await fetch(endpoint, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch JV partners");
      return response.json();
    },
  });

  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ["/api/enterprise/corporate/jv-partners", selectedPartner?.id, "contracts"],
    queryFn: async () => {
      if (!selectedPartner) return null;
      const response = await fetch(`/api/enterprise/corporate/jv-partners/${selectedPartner.id}/contracts`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch contracts");
      return response.json();
    },
    enabled: !!selectedPartner,
  });

  const createPartnerMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/enterprise/corporate/jv-partners`, { method: "POST", body: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/corporate/jv-partners"] });
      setShowCreateDialog(false);
      toast({ title: "Success", description: "JV Partner created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create JV partner", variant: "destructive" });
    },
  });

  const handleCreatePartner = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      partnerName: formData.get("partnerName"),
      partnerType: partnerType,
      contactName: formData.get("contactName"),
      contactEmail: formData.get("contactEmail"),
      country: formData.get("country"),
      isActive: true,
    };
    createPartnerMutation.mutate(data);
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
    <LuxuryPageWrapper
      variant="dashboard"
      title="Joint Venture Partners"
      subtitle="Manage strategic JV partnerships and revenue sharing agreements"
    >
      <div className="container mx-auto" data-testid="jv-partners-dashboard">
      <div className="flex justify-end items-center mb-8 luxury-animate-fade-in">
        <Button className="luxury-btn-primary luxury-shadow-xl px-6 py-3" onClick={() => setShowCreateDialog(true)} data-testid="button-add-partner">
          <Plus className="w-4 h-4 mr-2 inline" />
          Add Partner
        </Button>
      </div>

      <div className="flex gap-2 mb-6 luxury-animate-fade-in luxury-delay-1">
        <Button
          className={view === "active" ? "luxury-btn-primary px-6 py-2" : "luxury-btn-secondary px-6 py-2"}
          onClick={() => setView("active")}
          data-testid="button-view-active"
        >
          Active Partners
        </Button>
        <Button
          className={view === "all" ? "luxury-btn-primary px-6 py-2" : "luxury-btn-secondary px-6 py-2"}
          onClick={() => setView("all")}
          data-testid="button-view-all"
        >
          All Partners
        </Button>
      </div>

      {partners?.length === 0 ? (
        <div className="luxury-glass-card luxury-shadow-lg p-12 text-center luxury-animate-fade-in luxury-delay-2">
          <Building2 className="w-12 h-12 mx-auto text-purple-600 mb-4" />
          <h3 className="luxury-heading-md mb-2">No JV partners yet</h3>
          <p className="luxury-text-body">
            Start by adding your first joint venture partner
          </p>
        </div>
      ) : (
        <div className="luxury-grid-3 luxury-animate-slide-up luxury-delay-2">
          {partners?.map((partner: any, idx: number) => (
            <div key={partner.id} className={`luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-${idx + 3}`} data-testid={`card-partner-${partner.id}`}>
              <div className="mb-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="luxury-heading-sm" data-testid={`text-partner-name-${partner.id}`}>
                    {partner.partnerName}
                  </h3>
                  {partner.isActive ? (
                    <span className="luxury-badge-premium px-3 py-1" data-testid={`badge-status-${partner.id}`}>
                      <CheckCircle className="w-3 h-3 mr-1 inline" />
                      Active
                    </span>
                  ) : (
                    <span className="luxury-badge-secondary px-3 py-1" data-testid={`badge-status-${partner.id}`}>
                      <XCircle className="w-3 h-3 mr-1 inline" />
                      Inactive
                    </span>
                  )}
                </div>
                <p className="luxury-text-small text-purple-600" data-testid={`text-partner-type-${partner.id}`}>
                  {partner.partnerType}
                </p>
              </div>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="luxury-text-small opacity-70">Country:</span>
                  <span className="luxury-text-small font-medium" data-testid={`text-country-${partner.id}`}>
                    {partner.country || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="luxury-text-small opacity-70">Contact:</span>
                  <span className="luxury-text-small font-medium" data-testid={`text-contact-${partner.id}`}>
                    {partner.contactName || "N/A"}
                  </span>
                </div>
                {partner.contactEmail && (
                  <div className="flex justify-between">
                    <span className="luxury-text-small opacity-70">Email:</span>
                    <span className="luxury-text-small font-medium" data-testid={`text-email-${partner.id}`}>
                      {partner.contactEmail}
                    </span>
                  </div>
                )}
              </div>
              <Button 
                className="luxury-btn-secondary w-full py-2"
                onClick={() => setSelectedPartner(partner)}
                data-testid={`button-view-contracts-${partner.id}`}
              >
                <FileText className="w-4 h-4 mr-2 inline" />
                View Contracts ({partner.contractCount || 0})
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent data-testid="dialog-create-partner">
          <DialogHeader>
            <DialogTitle>Add New JV Partner</DialogTitle>
            <DialogDescription>Create a new joint venture partnership agreement</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePartner} className="space-y-4">
            <div>
              <Label htmlFor="partnerName" className="luxury-text-small font-medium mb-1 block">Partner Name *</Label>
              <Input id="partnerName" name="partnerName" required className="luxury-glass-minimal" data-testid="input-partner-name" />
            </div>
            <div>
              <Label htmlFor="partnerType" className="luxury-text-small font-medium mb-1 block">Partner Type</Label>
              <Select value={partnerType} onValueChange={setPartnerType}>
                <SelectTrigger className="luxury-glass-minimal" data-testid="select-partner-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strategic">Strategic</SelectItem>
                  <SelectItem value="licensing">Licensing</SelectItem>
                  <SelectItem value="distribution">Distribution</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="contactName" className="luxury-text-small font-medium mb-1 block">Contact Name</Label>
              <Input id="contactName" name="contactName" className="luxury-glass-minimal" data-testid="input-contact-name" />
            </div>
            <div>
              <Label htmlFor="contactEmail" className="luxury-text-small font-medium mb-1 block">Contact Email</Label>
              <Input id="contactEmail" name="contactEmail" type="email" className="luxury-glass-minimal" data-testid="input-contact-email" />
            </div>
            <div>
              <Label htmlFor="country" className="luxury-text-small font-medium mb-1 block">Country</Label>
              <Input id="country" name="country" className="luxury-glass-minimal" data-testid="input-country" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" className="luxury-btn-secondary px-6 py-2" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" className="luxury-btn-primary luxury-shadow-lg px-6 py-2" disabled={createPartnerMutation.isPending} data-testid="button-submit-partner">
                {createPartnerMutation.isPending ? "Creating..." : "Create Partner"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPartner} onOpenChange={() => setSelectedPartner(null)}>
        <DialogContent data-testid="dialog-view-contracts">
          <DialogHeader>
            <DialogTitle>{selectedPartner?.partnerName} - Contracts</DialogTitle>
            <DialogDescription>Revenue sharing agreements and contracts</DialogDescription>
          </DialogHeader>
          {contractsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : contracts?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No contracts found for this partner
            </div>
          ) : (
            <div className="space-y-3">
              {contracts?.map((contract: any) => (
                <Card key={contract.id} data-testid={`contract-${contract.id}`}>
                  <CardContent className="pt-4">
                    <h4 className="font-semibold">{contract.title}</h4>
                    <p className="text-sm text-muted-foreground">{contract.contractType}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Start:</span> {new Date(contract.startDate).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="text-muted-foreground">End:</span> {new Date(contract.endDate).toLocaleDateString()}
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
        </DialogContent>
      </Dialog>
      </div>
    </LuxuryPageWrapper>
  );
}
