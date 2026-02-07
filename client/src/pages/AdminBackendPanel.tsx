import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Briefcase,
  UserCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Crown,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  LayoutDashboard,
} from "lucide-react";

type TabType = "overview" | "members" | "providers" | "staff";

interface Stats {
  members: number;
  providers: number;
  applicants: number;
  staff: number;
  pendingApplicants: number;
  pendingStaff: number;
}

interface Member {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  country: string;
  loyalty_tier: string;
  is_club_member: boolean;
  created_at: string;
  roles: string[];
}

interface Provider {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  service_types: string[];
  status: string;
  stage: string;
  city: string;
  country_code: string;
  years_experience: number;
  submitted_at: string;
  approved_at: string;
  rejected_at: string;
  rejection_reason: string;
}

interface StaffApp {
  id: number;
  application_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  application_type: string;
  status: string;
  city: string;
  country: string;
  submitted_at: string;
  reviewed_at: string;
  approved_at: string;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { color: string; icon: any }> = {
    pending: { color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
    approved: { color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle },
    rejected: { color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
    active: { color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle },
    interview: { color: "bg-blue-100 text-blue-800 border-blue-200", icon: AlertCircle },
    review: { color: "bg-purple-100 text-purple-800 border-purple-200", icon: AlertCircle },
  };
  const variant = variants[status?.toLowerCase()] || variants.pending;
  const Icon = variant.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${variant.color}`}>
      <Icon className="w-3 h-3" />
      {status || "unknown"}
    </span>
  );
}

function LoyaltyBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    bronze: "bg-orange-100 text-orange-800 border-orange-200",
    silver: "bg-gray-100 text-gray-700 border-gray-200",
    gold: "bg-yellow-100 text-yellow-800 border-yellow-200",
    platinum: "bg-slate-100 text-slate-800 border-slate-200",
    diamond: "bg-cyan-100 text-cyan-800 border-cyan-200",
    elite: "bg-purple-100 text-purple-800 border-purple-200",
    royal: "bg-indigo-100 text-indigo-800 border-indigo-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[tier?.toLowerCase()] || colors.bronze}`}>
      <Crown className="w-3 h-3" />
      {tier || "Bronze"}
    </span>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminBackendPanel() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [providerSearch, setProviderSearch] = useState("");
  const [providerStatus, setProviderStatus] = useState("");
  const [providerPage, setProviderPage] = useState(1);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffStatus, setStaffStatus] = useState("");
  const [staffPage, setStaffPage] = useState(1);

  const statsQuery = useQuery<Stats>({
    queryKey: ["/api/admin-panel/stats"],
  });

  const membersQuery = useQuery<{ members: Member[]; total: number }>({
    queryKey: ["/api/admin-panel/members", memberSearch, memberPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (memberSearch) params.set("search", memberSearch);
      params.set("page", String(memberPage));
      const res = await fetch(`/api/admin-panel/members?${params}`);
      return res.json();
    },
    enabled: activeTab === "members" || activeTab === "overview",
  });

  const providersQuery = useQuery<{ providers: Provider[]; total: number }>({
    queryKey: ["/api/admin-panel/providers", providerSearch, providerStatus, providerPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (providerSearch) params.set("search", providerSearch);
      if (providerStatus) params.set("status", providerStatus);
      params.set("page", String(providerPage));
      const res = await fetch(`/api/admin-panel/providers?${params}`);
      return res.json();
    },
    enabled: activeTab === "providers" || activeTab === "overview",
  });

  const staffQuery = useQuery<{ staff: StaffApp[]; total: number }>({
    queryKey: ["/api/admin-panel/staff", staffSearch, staffStatus, staffPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (staffSearch) params.set("search", staffSearch);
      if (staffStatus) params.set("status", staffStatus);
      params.set("page", String(staffPage));
      const res = await fetch(`/api/admin-panel/staff?${params}`);
      return res.json();
    },
    enabled: activeTab === "staff" || activeTab === "overview",
  });

  const stats = statsQuery.data;

  const tabs = [
    { id: "overview" as TabType, label: "Overview", icon: LayoutDashboard },
    { id: "members" as TabType, label: "Members", icon: Users, count: stats?.members },
    { id: "providers" as TabType, label: "Providers", icon: Briefcase, count: stats?.applicants },
    { id: "staff" as TabType, label: "Staff", icon: UserCheck, count: stats?.staff },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Pet Wash™ Backend</h1>
              <p className="text-xs text-gray-500">Admin Control Panel</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                statsQuery.refetch();
                membersQuery.refetch();
                providersQuery.refetch();
                staffQuery.refetch();
              }}
              className="text-[#c6a664]"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? "bg-[#c6a664] text-white shadow-md"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.id ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto">
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Card className="border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("members")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats?.members ?? "—"}</p>
                      <p className="text-xs text-gray-500">Members</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("providers")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats?.applicants ?? "—"}</p>
                      <p className="text-xs text-gray-500">Providers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("staff")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                      <UserCheck className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats?.staff ?? "—"}</p>
                      <p className="text-xs text-gray-500">Staff Apps</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-amber-100 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-700">{stats?.pendingApplicants ?? "—"}</p>
                      <p className="text-xs text-gray-500">Pending Providers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-amber-100 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-700">{stats?.pendingStaff ?? "—"}</p>
                      <p className="text-xs text-gray-500">Pending Staff</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#c6a664]/10 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-[#c6a664]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats?.providers ?? "—"}</p>
                      <p className="text-xs text-gray-500">Active Providers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {membersQuery.data && membersQuery.data.members.length > 0 && (
              <Card className="border border-gray-100 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Recent Members
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-50">
                    {membersQuery.data.members.slice(0, 5).map((m) => (
                      <div key={m.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{m.first_name} {m.last_name}</p>
                          <p className="text-xs text-gray-500">{m.email}</p>
                        </div>
                        <div className="text-right">
                          <LoyaltyBadge tier={m.loyalty_tier} />
                          <p className="text-xs text-gray-400 mt-1">{formatDate(m.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === "members" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, phone..."
                  value={memberSearch}
                  onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(1); }}
                  className="pl-10 bg-gray-50 border-gray-200"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">{membersQuery.data?.total ?? 0} total members</p>

            <div className="space-y-2">
              {membersQuery.isLoading ? (
                <div className="text-center py-8 text-gray-400">Loading members...</div>
              ) : membersQuery.data?.members.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No members found</div>
              ) : (
                membersQuery.data?.members.map((m) => (
                  <Card key={m.id} className="border border-gray-100 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{m.first_name} {m.last_name}</p>
                          <LoyaltyBadge tier={m.loyalty_tier} />
                        </div>
                        {m.roles && m.roles.length > 0 && (
                          <Badge variant="outline" className="text-xs">{Array.isArray(m.roles) ? m.roles.join(", ") : m.roles}</Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex items-center gap-2"><Mail className="w-3 h-3" />{m.email}</div>
                        {m.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3" />{m.phone}</div>}
                        {m.country && <div className="flex items-center gap-2"><MapPin className="w-3 h-3" />{m.country}</div>}
                        <div className="flex items-center gap-2"><Calendar className="w-3 h-3" />Joined {formatDate(m.created_at)}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {membersQuery.data && membersQuery.data.total > 20 && (
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" disabled={memberPage === 1} onClick={() => setMemberPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </Button>
                <span className="text-xs text-gray-500">Page {memberPage} of {Math.ceil(membersQuery.data.total / 20)}</span>
                <Button variant="outline" size="sm" disabled={memberPage >= Math.ceil(membersQuery.data.total / 20)} onClick={() => setMemberPage(p => p + 1)}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "providers" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search providers..."
                  value={providerSearch}
                  onChange={(e) => { setProviderSearch(e.target.value); setProviderPage(1); }}
                  className="pl-10 bg-gray-50 border-gray-200"
                />
              </div>
              <Select value={providerStatus} onValueChange={(v) => { setProviderStatus(v === "all" ? "" : v); setProviderPage(1); }}>
                <SelectTrigger className="w-32 bg-gray-50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-gray-500">{providersQuery.data?.total ?? 0} total providers</p>

            <div className="space-y-2">
              {providersQuery.isLoading ? (
                <div className="text-center py-8 text-gray-400">Loading providers...</div>
              ) : providersQuery.data?.providers.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No providers found</div>
              ) : (
                providersQuery.data?.providers.map((p) => (
                  <Card key={p.id} className="border border-gray-100 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{p.first_name} {p.last_name}</p>
                          <StatusBadge status={p.status} />
                        </div>
                        {p.stage && <Badge variant="outline" className="text-xs">{p.stage}</Badge>}
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex items-center gap-2"><Mail className="w-3 h-3" />{p.email}</div>
                        {p.phone_number && <div className="flex items-center gap-2"><Phone className="w-3 h-3" />{p.phone_number}</div>}
                        {(p.city || p.country_code) && <div className="flex items-center gap-2"><MapPin className="w-3 h-3" />{[p.city, p.country_code].filter(Boolean).join(", ")}</div>}
                        {p.service_types && p.service_types.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.service_types.map((s, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{s}</span>
                            ))}
                          </div>
                        )}
                        {p.years_experience != null && <p className="text-xs text-gray-500">{p.years_experience} yrs experience</p>}
                        <div className="flex items-center gap-2"><Calendar className="w-3 h-3" />Applied {formatDate(p.submitted_at)}</div>
                        {p.rejection_reason && (
                          <p className="text-xs text-red-500 mt-1">Reason: {p.rejection_reason}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {providersQuery.data && providersQuery.data.total > 20 && (
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" disabled={providerPage === 1} onClick={() => setProviderPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </Button>
                <span className="text-xs text-gray-500">Page {providerPage} of {Math.ceil(providersQuery.data.total / 20)}</span>
                <Button variant="outline" size="sm" disabled={providerPage >= Math.ceil(providersQuery.data.total / 20)} onClick={() => setProviderPage(p => p + 1)}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "staff" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search staff..."
                  value={staffSearch}
                  onChange={(e) => { setStaffSearch(e.target.value); setStaffPage(1); }}
                  className="pl-10 bg-gray-50 border-gray-200"
                />
              </div>
              <Select value={staffStatus} onValueChange={(v) => { setStaffStatus(v === "all" ? "" : v); setStaffPage(1); }}>
                <SelectTrigger className="w-32 bg-gray-50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-gray-500">{staffQuery.data?.total ?? 0} total staff applications</p>

            <div className="space-y-2">
              {staffQuery.isLoading ? (
                <div className="text-center py-8 text-gray-400">Loading staff...</div>
              ) : staffQuery.data?.staff.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No staff applications found</div>
              ) : (
                staffQuery.data?.staff.map((s) => (
                  <Card key={s.id} className="border border-gray-100 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{s.first_name} {s.last_name}</p>
                          <StatusBadge status={s.status} />
                        </div>
                        {s.application_type && <Badge variant="outline" className="text-xs">{s.application_type}</Badge>}
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex items-center gap-2"><Mail className="w-3 h-3" />{s.email}</div>
                        {s.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3" />{s.phone}</div>}
                        {(s.city || s.country) && <div className="flex items-center gap-2"><MapPin className="w-3 h-3" />{[s.city, s.country].filter(Boolean).join(", ")}</div>}
                        <div className="flex items-center gap-2"><Calendar className="w-3 h-3" />Applied {formatDate(s.submitted_at)}</div>
                        {s.reviewed_at && <p className="text-xs text-gray-500">Reviewed {formatDate(s.reviewed_at)}</p>}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {staffQuery.data && staffQuery.data.total > 20 && (
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" disabled={staffPage === 1} onClick={() => setStaffPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </Button>
                <span className="text-xs text-gray-500">Page {staffPage} of {Math.ceil(staffQuery.data.total / 20)}</span>
                <Button variant="outline" size="sm" disabled={staffPage >= Math.ceil(staffQuery.data.total / 20)} onClick={() => setStaffPage(p => p + 1)}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
