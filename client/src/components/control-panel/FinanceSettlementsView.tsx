import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  Download,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Building2,
  Receipt,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type SettlementStatus = "pending" | "approved" | "paid";
type PartnerType = "city" | "council" | "mall" | "franchise" | "sponsor";

interface Settlement {
  id: string;
  partnerId: string;
  partnerName?: string;
  partnerType?: PartnerType;
  periodStart: string;
  periodEnd: string;
  grossRevenue: string;
  partnerShare: string;
  petwashShare: string;
  vatAmount: string;
  status: SettlementStatus;
  createdAt: string;
}

interface Commission {
  commissionId: string;
  providerId: string;
  providerName?: string;
  customerPaidAmount: string;
  commissionRate: string;
  commissionAmount: string;
  vatAmount: string;
  providerPayout: string;
  status: string;
  createdAt: string;
}

export default function FinanceSettlementsView() {
  const [periodFilter, setPeriodFilter] = useState<string>("current");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  // Fetch settlements
  const { data: settlementsData, isLoading: settlementsLoading } = useQuery({
    queryKey: ["/api/finance/settlements", periodFilter, statusFilter],
  });

  // Fetch commissions
  const { data: commissionsData } = useQuery({
    queryKey: ["/api/finance/commissions", "recent"],
  });

  // Fetch financial summary
  const { data: summaryData } = useQuery({
    queryKey: ["/api/finance/summary"],
  });

  const settlements = (settlementsData?.settlements || []) as Settlement[];
  const commissions = (commissionsData?.commissions || []) as Commission[];
  const summary = summaryData?.summary || {
    totalRevenue: "0.00",
    totalCommissions: "0.00",
    totalVAT: "0.00",
    pendingSettlements: 0,
  };

  const getStatusBadge = (status: SettlementStatus) => {
    const variants: Record<SettlementStatus, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      approved: "default",
      paid: "default",
    };
    const colors: Record<SettlementStatus, string> = {
      pending: "",
      approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      paid: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    };
    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {status}
      </Badge>
    );
  };

  const exportSettlement = (settlementId: string) => {
    // TODO: Trigger CSV export
    toast({
      title: "Exporting Settlement",
      description: `Generating CSV for settlement ${settlementId}...`,
    });
  };

  const downloadInvoice = (commissionId: string, language: "he" | "en" = "he") => {
    window.open(`/api/contractor-invoices/${commissionId}/generate?lang=${language}`, "_blank");
    toast({
      title: "Generating Invoice",
      description: `Creating ${language === "he" ? "Hebrew" : "English"} tax invoice...`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card data-testid="card-total-revenue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₪{summary.totalRevenue}</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-commissions">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Commissions</CardTitle>
            <Receipt className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₪{summary.totalCommissions}</div>
            <p className="text-xs text-muted-foreground mt-1">Contractor payouts</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-vat">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">VAT (18%)</CardTitle>
            <FileText className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₪{summary.totalVAT}</div>
            <p className="text-xs text-muted-foreground mt-1">Israeli tax compliance</p>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-settlements">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Settlements</CardTitle>
            <Clock className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.pendingSettlements}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Partner Settlements */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Partner Settlements</CardTitle>
              <CardDescription>
                Monthly revenue sharing with cities, councils, and franchises
              </CardDescription>
            </div>
            <Button variant="outline" data-testid="button-generate-settlements">
              <Calendar className="w-4 h-4 mr-2" />
              Generate Monthly
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label>Period</Label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger data-testid="select-period-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Month</SelectItem>
                  <SelectItem value="last">Last Month</SelectItem>
                  <SelectItem value="all">All Periods</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {settlementsLoading ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-spin" />
              <p className="text-muted-foreground">Loading settlements...</p>
            </div>
          ) : settlements.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No settlements found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Run monthly settlement job to generate
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Gross Revenue</TableHead>
                    <TableHead className="text-right">Partner Share</TableHead>
                    <TableHead className="text-right">PetWash Share</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.map((settlement) => (
                    <TableRow key={settlement.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{settlement.partnerName || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">
                              {settlement.partnerType}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(settlement.periodStart).toLocaleDateString()} -{" "}
                          {new Date(settlement.periodEnd).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ₪{parseFloat(settlement.grossRevenue).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        ₪{parseFloat(settlement.partnerShare).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-blue-600">
                        ₪{parseFloat(settlement.petwashShare).toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(settlement.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => exportSettlement(settlement.id)}
                          data-testid={`button-export-${settlement.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Commissions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Contractor Commissions</CardTitle>
          <CardDescription>Latest marketplace commissions with Israeli VAT</CardDescription>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No recent commissions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {commissions.slice(0, 10).map((commission) => (
                <Card key={commission.commissionId} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{commission.providerName || "Provider"}</span>
                          <Badge variant="outline" className="text-xs">
                            {commission.commissionRate}% commission
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Customer paid: ₪{commission.customerPaidAmount}</span>
                          <span>VAT: ₪{commission.vatAmount}</span>
                          <span className="text-green-600 font-medium">
                            Provider payout: ₪{commission.providerPayout}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadInvoice(commission.commissionId, "he")}
                          data-testid={`button-invoice-he-${commission.commissionId}`}
                        >
                          חשבונית (HE)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadInvoice(commission.commissionId, "en")}
                          data-testid={`button-invoice-en-${commission.commissionId}`}
                        >
                          Invoice (EN)
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
