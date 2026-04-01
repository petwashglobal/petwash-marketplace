import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Star,
  AlertTriangle,
  FileCheck,
  Car,
  Search,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ComplianceStatus = "approved" | "rejected" | "pending";

interface ContractorComplianceData {
  contractorId: string;
  contractorName: string;
  email: string;
  serviceType: string;
  complianceStatus: {
    identity: {
      status: "pending" | "approved" | "rejected" | "expired";
      biometricVerified: boolean;
      livenessCheck: {
        status: "passed" | "failed";
        riskScore: number;
        faceMatchScore: number;
      } | null;
    };
    criminal: {
      status: "clear" | "record_found" | "pending";
      blockingOffenses?: string[];
    };
    driver: {
      hasValidLicense: boolean;
      hasActiveBan: boolean;
      declaresCleanRecord: boolean;
      pointsOnLicense: number;
    } | null;
    ratings: {
      count: number;
      average: number;
    };
    incidents: {
      total: number;
      hasCritical: boolean;
    };
    latestDecision: {
      decision: "approved" | "rejected";
      score: number;
      reasons: string[];
      createdAt: string;
    } | null;
  };
}

export default function ComplianceView() {
  const [filterStatus, setFilterStatus] = useState<ComplianceStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch contractors from Global Compliance Brain API
  const { data, isLoading, error } = useQuery<{ contractors: ContractorComplianceData[]; total: number }>({
    queryKey: ["/api/compliance-brain/contractors/list"],
    refetchInterval: 60000, // Refresh every minute
  });

  const contractors = data?.contractors || [];

  const allContractors = contractors;

  const filteredContractors = allContractors.filter((c) => {
    const matchesStatus =
      filterStatus === "all" ||
      (c.complianceStatus.latestDecision?.decision === filterStatus) ||
      (filterStatus === "pending" && !c.complianceStatus.latestDecision);

    const matchesSearch =
      searchQuery === "" ||
      c.contractorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (contractor: ContractorComplianceData) => {
    const decision = contractor.complianceStatus.latestDecision?.decision;
    if (!decision) {
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </Badge>
      );
    }
    if (decision === "approved") {
      return (
        <Badge variant="outline" className="gap-1 border-green-500 text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-3 h-3" />
          Approved
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 border-red-500 text-red-700 dark:text-red-400">
        <XCircle className="w-3 h-3" />
        Rejected
      </Badge>
    );
  };

  const getIdentityBadge = (status: string, biometricVerified: boolean) => {
    if (status === "approved" && biometricVerified) {
      return (
        <Badge variant="outline" className="gap-1 border-green-500 text-green-700 dark:text-green-400">
          <FileCheck className="w-3 h-3" />
          Verified
        </Badge>
      );
    }
    if (status === "pending") {
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 border-orange-500 text-orange-700 dark:text-orange-400">
        <AlertTriangle className="w-3 h-3" />
          Incomplete
        </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-compliance-approved">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : allContractors.filter((c) => c.complianceStatus.latestDecision?.decision === "approved").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ready for assignments</p>
          </CardContent>
        </Card>

        <Card data-testid="card-compliance-rejected">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : allContractors.filter((c) => c.complianceStatus.latestDecision?.decision === "rejected").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Failed compliance checks</p>
          </CardContent>
        </Card>

        <Card data-testid="card-compliance-pending">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : allContractors.filter((c) => !c.complianceStatus.latestDecision).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting evaluation</p>
          </CardContent>
        </Card>

        <Card data-testid="card-compliance-critical">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical Incidents</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : allContractors.filter((c) => c.complianceStatus.incidents.hasCritical).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Require immediate review</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Contractor Compliance Dashboard</CardTitle>
          <CardDescription>
            Global Compliance Brain evaluation results for all contractors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-compliance-search"
              />
            </div>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-compliance-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center text-muted-foreground py-12">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin" />
              <p className="text-lg font-medium">Loading contractors...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center text-red-600 dark:text-red-400 py-12">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
              <p className="text-lg font-medium">Failed to load contractors</p>
              <p className="text-sm">{(error as any).message || "Unknown error"}</p>
            </div>
          )}

          {/* Contractors List */}
          {!isLoading && !error && (
            <div className="space-y-4">
              {filteredContractors.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No contractors found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              filteredContractors.map((contractor) => (
                <Card key={contractor.contractorId} className="overflow-hidden" data-testid={`card-contractor-${contractor.contractorId}`}>
                  <CardContent className="p-6">
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{contractor.contractorName}</h3>
                          <p className="text-sm text-muted-foreground">{contractor.email}</p>
                        </div>
                      </div>
                      {getStatusBadge(contractor)}
                    </div>

                    {/* Compliance Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                      {/* Identity Verification */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <FileCheck className="w-4 h-4" />
                          Identity
                        </div>
                        {getIdentityBadge(
                          contractor.complianceStatus.identity.status,
                          contractor.complianceStatus.identity.biometricVerified
                        )}
                        {contractor.complianceStatus.identity.livenessCheck && (
                          <p className="text-xs text-muted-foreground">
                            Face Match: {(contractor.complianceStatus.identity.livenessCheck.faceMatchScore * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>

                      {/* Criminal Background */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <ShieldCheck className="w-4 h-4" />
                          Background
                        </div>
                        {contractor.complianceStatus.criminal.status === "clear" ? (
                          <Badge variant="outline" className="gap-1 border-green-500 text-green-700 dark:text-green-400">
                            Clear
                          </Badge>
                        ) : contractor.complianceStatus.criminal.status === "pending" ? (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="w-3 h-3" />
                            Pending
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-red-500 text-red-700 dark:text-red-400">
                            <AlertTriangle className="w-3 h-3" />
                            Record Found
                          </Badge>
                        )}
                      </div>

                      {/* Driver Safety (if applicable) */}
                      {contractor.complianceStatus.driver ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Car className="w-4 h-4" />
                            Driver
                          </div>
                          {contractor.complianceStatus.driver.hasActiveBan ? (
                            <Badge variant="outline" className="gap-1 border-red-500 text-red-700 dark:text-red-400">
                              <XCircle className="w-3 h-3" />
                              Banned
                            </Badge>
                          ) : contractor.complianceStatus.driver.hasValidLicense ? (
                            <Badge variant="outline" className="gap-1 border-green-500 text-green-700 dark:text-green-400">
                              <CheckCircle2 className="w-3 h-3" />
                              Valid
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 border-orange-500 text-orange-700 dark:text-orange-400">
                              <AlertTriangle className="w-3 h-3" />
                              Invalid
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Points: {contractor.complianceStatus.driver.pointsOnLicense}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <Car className="w-4 h-4" />
                            Driver
                          </div>
                          <p className="text-xs text-muted-foreground">N/A</p>
                        </div>
                      )}

                      {/* Ratings */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Star className="w-4 h-4" />
                          Ratings
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            {contractor.complianceStatus.ratings.average.toFixed(1)}★
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            ({contractor.complianceStatus.ratings.count})
                          </span>
                        </div>
                        {contractor.complianceStatus.incidents.total > 0 && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            {contractor.complianceStatus.incidents.total} incident{contractor.complianceStatus.incidents.total > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Failure Codes */}
                    {contractor.complianceStatus.latestDecision?.decision === "rejected" &&
                      contractor.complianceStatus.latestDecision.reasons.length > 0 && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-medium text-red-900 dark:text-red-100">
                              Rejection Reasons:
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {contractor.complianceStatus.latestDecision.reasons.map((reason, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="border-red-500 text-red-700 dark:text-red-400 text-xs"
                              >
                                {reason.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                  </CardContent>
                </Card>
              ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
