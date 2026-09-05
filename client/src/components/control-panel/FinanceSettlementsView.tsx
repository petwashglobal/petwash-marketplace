import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  TrendingUp,
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
type PartnerType = "city" | "council" | "mall" | "licensed_operator" | "location_partner" | "sponsor";

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

interface SettlementsResponse {
  settlements?: Settlement[];
}

export default function FinanceSettlementsView() {
  const [periodFilter, setPeriodFilter] = useState<string>("current");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  // Fetch settlements — bake filters into URL, default queryFn drops
  // queryKey[1+]. Prior behaviour: dashboard showed unfiltered settlements
  // regardless of period/status chip. (Wider-hidden-dead-code hunt 2026-08-21.)
  const settlementsQs = new URLSearchParams();
  if (periodFilter && periodFilter !== 'all') settlementsQs.set('period', periodFilter);
  if (statusFilter && statusFilter !== 'all') settlementsQs.set('status', statusFilter);
  const { data: settlementsData, isLoading: settlementsLoading, error: settlementsError } = useQuery<SettlementsResponse>({
    queryKey: [settlementsQs.toString()
      ? `/api/finance/settlements?${settlementsQs.toString()}`
      : "/api/finance/settlements"],
  });

  // CONTRACT FIX (Lane E D12): `GET /api/finance/commissions` has NO handler
  // anywhere on the server — verified across all three /api/finance mounts
  // (routes/finance.ts, routes/finance/settlements.ts, routes/finance/money-flow.ts)
  // and every other router. The query is removed rather than pointed somewhere
  // else, because no route owns contractor commissions today. The panel below
  // now says so instead of rendering the "No recent commissions" empty state,
  // which read as "there were none" when the truth is "we never asked anyone".

  // The `/api/finance/summary` query is removed too: nothing on this screen can
  // honestly consume it (see the note below), and leaving a fetch whose result
  // is discarded is how the ₪0.00 illusion survived review in the first place.

  const settlements = (settlementsData?.settlements || []) as Settlement[];

  // ── FABRICATED MONEY, NOW REMOVED ─────────────────────────────────────────
  // This screen used to read `summaryData?.summary` and fall back to a literal
  // { totalRevenue: "0.00", totalCommissions: "0.00", totalVAT: "0.00" }.
  // `GET /api/finance/summary` answers { kpis, network, ownership, stationCount }
  // — there is NO `summary` key on that response and there never has been. So
  // the optional chain was ALWAYS undefined and the fallback ALWAYS fired: the
  // executive Finance screen displayed a hard "₪0.00" for revenue, commissions
  // and VAT, on a 200 response, with no error state to give it away. Zeroes
  // presented as fact for money nobody measured.
  //
  // The four figures are instead totalled from the settlement rows actually
  // loaded — `settlements` carries grossRevenue, petwashShare and vatAmount per
  // row — and the cards are labelled with that scope, because a filtered,
  // paginated page of settlements is NOT a network total and must not be
  // dressed up as one. When settlements cannot be loaded the cards say so
  // rather than showing a zero.
  const sumField = (rows: Settlement[], field: 'grossRevenue' | 'petwashShare' | 'vatAmount') =>
    rows.reduce((acc, r) => acc + (parseFloat(r[field] ?? '0') || 0), 0);
  const money = (n: number) => n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const settlementsUnavailable = !!settlementsError;
  const summaryScopeNote = settlementsLoading
    ? 'Loading…'
    : `Across the ${settlements.length} settlement${settlements.length === 1 ? '' : 's'} shown`;
  const totals = {
    revenue: money(sumField(settlements, 'grossRevenue')),
    commissions: money(sumField(settlements, 'petwashShare')),
    vat: money(sumField(settlements, 'vatAmount')),
    pending: settlements.filter((s) => s.status === 'pending').length,
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
      paid: "bg-[#D4AF37] text-black dark:bg-[#B8932F] dark:text-[#D4AF37]",
    };
    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {status}
      </Badge>
    );
  };

  const exportSettlement = (settlementId: string) => {
    window.open(`/api/finance/settlements/${settlementId}/export`, '_blank');
    toast({
      title: "Exporting Settlement",
      description: `CSV download started for settlement ${settlementId}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card data-testid="card-total-revenue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Settled Gross Revenue</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {settlementsUnavailable ? (
              <div className="text-sm font-medium text-destructive">Unavailable</div>
            ) : (
              <div className="text-2xl font-bold">₪{totals.revenue}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {settlementsUnavailable ? "Settlements could not be loaded" : summaryScopeNote}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-commissions">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">PetWash Share</CardTitle>
            <Receipt className="w-4 h-4 text-[#B8932F]" />
          </CardHeader>
          <CardContent>
            {settlementsUnavailable ? (
              <div className="text-sm font-medium text-destructive">Unavailable</div>
            ) : (
              <div className="text-2xl font-bold">₪{totals.commissions}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {settlementsUnavailable ? "Settlements could not be loaded" : summaryScopeNote}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-vat">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">VAT</CardTitle>
            <FileText className="w-4 h-4 text-[#B8932F]" />
          </CardHeader>
          <CardContent>
            {settlementsUnavailable ? (
              <div className="text-sm font-medium text-destructive">Unavailable</div>
            ) : (
              <div className="text-2xl font-bold">₪{totals.vat}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {settlementsUnavailable ? "Settlements could not be loaded" : summaryScopeNote}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-settlements">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Settlements</CardTitle>
            <Clock className="w-4 h-4 text-[#B8932F]" />
          </CardHeader>
          <CardContent>
            {settlementsUnavailable ? (
              <div className="text-sm font-medium text-destructive">Unavailable</div>
            ) : (
              <div className="text-2xl font-bold">{totals.pending}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {settlementsUnavailable ? "Settlements could not be loaded" : "Awaiting approval, in the settlements shown"}
            </p>
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
                Monthly revenue sharing with approved cities, councils, sites, and operators
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
                      <TableCell className="text-right font-mono text-[#B8932F]">
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

      {/* Recent Commissions — HONEST UNAVAILABLE STATE.
          This panel used to render `commissions.length === 0` as
          "No recent commissions". That is a claim about the business, and it
          was false: the list was empty because GET /api/finance/commissions
          404s (no handler exists on any /api/finance mount), not because no
          commissions were earned. Marketplace commissions have no read API
          today, so the panel now says exactly that. It stays visible rather
          than being deleted so the missing capability is not forgotten. */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Contractor Commissions</CardTitle>
          <CardDescription>Latest marketplace commissions with Israeli VAT</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8" data-testid="commissions-unavailable">
            <Receipt className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="font-medium">Commission data is not available</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              No API currently serves contractor commissions. This panel is intentionally
              blank rather than showing an empty list, which would wrongly imply that no
              commissions were earned. Per-settlement figures are shown above.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
