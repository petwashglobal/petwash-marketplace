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
    <div className="container mx-auto py-8" data-testid="jv-partners-dashboard">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">
            Joint Venture Partners
          </h1>
          <p className="text-muted-foreground mt-2" data-testid="page-description">
            Manage strategic JV partnerships and revenue sharing agreements
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-partner">
          <Plus className="w-4 h-4 mr-2" />
          Add Partner
        </Button>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={view === "active" ? "default" : "outline"}
          onClick={() => setView("active")}
          data-testid="button-view-active"
        >
          Active Partners
        </Button>
        <Button
          variant={view === "all" ? "default" : "outline"}
          onClick={() => setView("all")}
          data-testid="button-view-all"
        >
          All Partners
        </Button>
      </div>

      {partners?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No JV partners yet</h3>
            <p className="text-muted-foreground">
              Start by adding your first joint venture partner
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {partners?.map((partner: any) => (
            <Card key={partner.id} data-testid={`card-partner-${partner.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl" data-testid={`text-partner-name-${partner.id}`}>
                    {partner.partnerName}
                  </CardTitle>
                  {partner.isActive ? (
                    <Badge variant="default" data-testid={`badge-status-${partner.id}`}>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" data-testid={`badge-status-${partner.id}`}>
                      <XCircle className="w-3 h-3 mr-1" />
                      Inactive
                    </Badge>
                  )}
                </div>
                <CardDescription data-testid={`text-partner-type-${partner.id}`}>
                  {partner.partnerType}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Country:</span>
                    <span className="font-medium" data-testid={`text-country-${partner.id}`}>
                      {partner.country || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contact:</span>
                    <span className="font-medium" data-testid={`text-contact-${partner.id}`}>
                      {partner.contactName || "N/A"}
                    </span>
                  </div>
                  {partner.contactEmail && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium text-xs" data-testid={`text-email-${partner.id}`}>
                        {partner.contactEmail}
                      </span>
                    </div>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => setSelectedPartner(partner)}
                  data-testid={`button-view-contracts-${partner.id}`}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Contracts ({partner.contractCount || 0})
                </Button>
              </CardContent>
            </Card>
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
              <Label htmlFor="partnerName">Partner Name *</Label>
              <Input id="partnerName" name="partnerName" required data-testid="input-partner-name" />
            </div>
            <div>
              <Label htmlFor="partnerType">Partner Type</Label>
              <Select value={partnerType} onValueChange={setPartnerType}>
                <SelectTrigger data-testid="select-partner-type">
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
              <Label htmlFor="contactName">Contact Name</Label>
              <Input id="contactName" name="contactName" data-testid="input-contact-name" />
            </div>
            <div>
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input id="contactEmail" name="contactEmail" type="email" data-testid="input-contact-email" />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" data-testid="input-country" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createPartnerMutation.isPending} data-testid="button-submit-partner">
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
  );
}
