import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { type Language } from "@/lib/i18n";
import {
  Users,
  UserCheck,
  Crown,
  UserPlus,
  Search,
  Filter,
  Download,
  Edit,
  Trash2,
  Eye,
  Mail,
  Phone,
  Calendar,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/PhoneInput";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { IntelligenceBadge } from "@/components/IntelligenceBadge";
import { useQuery as useIntelQuery } from "@tanstack/react-query";

/**
 * Fetches and renders the trust-score badge for a single user.
 * Self-contained so we avoid hooks-in-loops antipattern.
 */
function UserTrustBadge({ uid }: { uid: string }) {
  const { data } = useIntelQuery<{ trustScore: number; riskLevel: number; journeyState: string }>({
    queryKey: ['/api/admin/users', uid, 'intelligence'],
    queryFn: () =>
      fetch(`/api/admin/users/${uid}/intelligence`, { credentials: 'include' }).then(r =>
        r.ok ? r.json() : Promise.reject()
      ),
    staleTime: 120_000,
    retry: false,
  });

  if (!data) return null;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <IntelligenceBadge trustScore={data.trustScore} />
      <span className="text-[10px] text-muted-foreground capitalize">{data.journeyState?.replace(/_/g, ' ')}</span>
    </div>
  );
}

interface AdminUsersProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
}

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  profileImageUrl?: string;
  roles: string[];
  loyaltyTier: string;
  isClubMember: boolean;
  totalSpent: number;
  loyaltyPoints: number;
  createdAt: string;
  lastLogin?: string;
  status: 'active' | 'inactive' | 'suspended';
}

export default function AdminUsers({ language, onLanguageChange }: AdminUsersProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<{ firstName: string; lastName: string; phone: string; status: string; loyaltyTier: string }>({ firstName: '', lastName: '', phone: '', status: 'active', loyaltyTier: 'bronze' });
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['/api/admin/users'],
  });

  const allUsers = (usersData as any)?.users || [];
  const users = allUsers.filter((user: User) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(q);
      const matchEmail = (user.email || '').toLowerCase().includes(q);
      const matchPhone = (user.phone || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone) return false;
    }
    if (roleFilter !== 'all' && !user.roles?.includes(roleFilter)) return false;
    if (statusFilter !== 'all' && user.status !== statusFilter) return false;
    return true;
  });
  const stats = (usersData as any)?.stats || {
    total: 0,
    active: 0,
    premium: 0,
    newThisMonth: 0,
  };

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "User deleted",
        description: "User has been successfully removed",
      });
      setShowUserModal(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  // Update user role mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: any }) => {
      return apiRequest(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "User updated",
        description: "User has been successfully updated",
      });
    },
  });

  const getRoleBadgeVariant = (roles: string[]) => {
    if (roles.includes('admin')) return 'luxury-badge-gold';
    if (roles.includes('premium')) return 'luxury-badge';
    return 'luxury-badge';
  };

  const getStatusColor = (status: string) => {
    if (status === 'active') return 'luxury-badge-success';
    if (status === 'suspended') return 'luxury-badge luxury-badge-gold';
    return 'luxury-badge';
  };

  const handleExport = () => {
    // Export users to CSV
    const csv = [
      ['Email', 'Name', 'Role', 'Status', 'Loyalty Tier', 'Total Spent', 'Created At'].join(','),
      ...users.map((user: User) => [
        user.email,
        `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        user.roles.join(';'),
        user.status,
        user.loyaltyTier,
        user.totalSpent,
        user.createdAt,
      ].join(',')),
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleBulkAction = (action: string) => {
    if (selectedUsers.size === 0) {
      toast({
        title: "No users selected",
        description: "Please select users to perform bulk actions",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: `Bulk ${action}`,
      description: `${action} will be applied to ${selectedUsers.size} users`,
    });
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  if (isLoading) {
    return (
      <Layout language={language} onLanguageChange={onLanguageChange}>
        <div className="luxury-bg-mesh min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="luxury-spinner mx-auto mb-4"></div>
            <p className="luxury-text-body">Loading user management...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen luxury-bg-mesh py-8">
        <div className="luxury-container space-y-8">
          {/* Header */}
          <div className="luxury-animate-fade-in">
            <h1 className="luxury-heading-lg luxury-text-gradient flex items-center gap-4 mb-2">
              <div className="p-4 rounded-2xl luxury-bg-primary">
                <Users className="h-10 w-10 text-white" />
              </div>
              User Management
            </h1>
            <p className="luxury-text-body">
              Manage all platform users, roles, and permissions
            </p>
          </div>

          {/* Stats Cards */}
          <div className="luxury-grid-4">
            <div 
              className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-slide-up luxury-delay-1"
              data-testid="stat-total-users"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="luxury-heading-sm text-gray-700">Total Users</h3>
                <div className="p-3 rounded-full bg-gradient-to-br from-blue-100 to-blue-50">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient">{stats.total}</div>
              <p className="luxury-text-small mt-1">All registered users</p>
            </div>

            <div 
              className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-slide-up luxury-delay-2"
              data-testid="stat-active-users"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="luxury-heading-sm text-gray-700">Active</h3>
                <div className="p-3 rounded-full bg-gradient-to-br from-green-100 to-green-50">
                  <UserCheck className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient">{stats.active}</div>
              <p className="luxury-text-small mt-1">Currently active</p>
            </div>

            <div 
              className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-slide-up luxury-delay-3"
              data-testid="stat-premium-users"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="luxury-heading-sm text-gray-700">Premium</h3>
                <div className="p-3 rounded-full bg-gradient-to-br from-purple-100 to-purple-50">
                  <Crown className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient">{stats.premium}</div>
              <p className="luxury-text-small mt-1">Premium members</p>
            </div>

            <div 
              className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-slide-up luxury-delay-4"
              data-testid="stat-new-users"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="luxury-heading-sm text-gray-700">New This Month</h3>
                <div className="p-3 rounded-full bg-gradient-to-br from-orange-100 to-orange-50">
                  <UserPlus className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <div className="luxury-heading-lg luxury-text-gradient">{stats.newThisMonth}</div>
              <p className="luxury-text-small mt-1">Last 30 days</p>
            </div>
          </div>

          {/* Search & Filters Panel */}
          <div className="luxury-glass-panel luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-5">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search users by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 luxury-glass-minimal border-0 focus:ring-2 focus:ring-purple-400"
                  data-testid="input-search-users"
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48 luxury-glass-minimal border-0" data-testid="select-role-filter">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48 luxury-glass-minimal border-0" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={handleExport}
                className="luxury-btn-secondary"
                data-testid="button-export-users"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>

            {/* Role Filter Chips */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {['admin', 'premium', 'user', 'contractor', 'driver'].map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role === roleFilter ? 'all' : role)}
                  className={`luxury-badge ${
                    roleFilter === role ? 'luxury-badge-gold' : ''
                  } cursor-pointer hover:opacity-80 transition-opacity`}
                  data-testid={`chip-role-${role}`}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Actions Panel */}
          {selectedUsers.size > 0 && (
            <div className="luxury-glass-panel p-4 luxury-animate-slide-up flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="luxury-badge-gold">
                  {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleBulkAction('email')}
                  className="luxury-btn-secondary"
                  data-testid="button-bulk-email"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button
                  onClick={() => handleBulkAction('export')}
                  className="luxury-btn-secondary"
                  data-testid="button-bulk-export"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button
                  onClick={() => setSelectedUsers(new Set())}
                  variant="outline"
                  className="luxury-btn-ghost"
                  data-testid="button-clear-selection"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Users Table */}
          <div className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-6">
            <div className="p-6 border-b border-gray-100">
              <h2 className="luxury-heading-sm luxury-text-gradient">All Users</h2>
            </div>

            <div className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <p className="luxury-text-body text-gray-500">No users found</p>
                </div>
              ) : (
                users.map((user: User, index: number) => (
                  <div
                    key={user.id}
                    className={`luxury-glass-minimal luxury-hover-lift p-4 flex items-center gap-4 transition-all luxury-animate-fade-in luxury-delay-${Math.min(index % 5 + 1, 5)}`}
                    data-testid={`user-row-${user.id}`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="rounded border-gray-300"
                      data-testid={`checkbox-user-${user.id}`}
                    />

                    {/* Avatar */}
                    <Avatar className="h-12 w-12 border-2 border-purple-200">
                      <AvatarImage src={user.profileImageUrl} />
                      <AvatarFallback className="luxury-bg-primary text-white">
                        {user.firstName?.[0] || user.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="luxury-heading-sm truncate" data-testid={`text-name-${user.id}`}>
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.email}
                        </h3>
                        {user.isClubMember && (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <p className="luxury-text-small truncate" data-testid={`text-email-${user.id}`}>
                        <Mail className="h-3 w-3 inline mr-1" />
                        {user.email}
                      </p>
                      {user.phone && (
                        <p className="luxury-text-small truncate">
                          <Phone className="h-3 w-3 inline mr-1" />
                          {user.phone}
                        </p>
                      )}
                    </div>

                    {/* Role Badges */}
                    <div className="flex gap-2 flex-wrap">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className={`${getRoleBadgeVariant(user.roles)}`}
                          data-testid={`badge-role-${role}-${user.id}`}
                        >
                          {role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                          {role}
                        </span>
                      ))}
                    </div>

                    {/* Status Badge */}
                    <span className={getStatusColor(user.status)} data-testid={`badge-status-${user.id}`}>
                      {user.status === 'active' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {user.status === 'inactive' && <XCircle className="h-3 w-3 mr-1" />}
                      {user.status === 'suspended' && <Clock className="h-3 w-3 mr-1" />}
                      {user.status}
                    </span>

                    {/* Loyalty Tier */}
                    <div className="text-right min-w-24">
                      <p className="luxury-text-small font-semibold text-purple-600">
                        {user.loyaltyTier}
                      </p>
                      <p className="luxury-text-small">{user.loyaltyPoints} pts</p>
                    </div>

                    {/* Trust Score */}
                    <UserTrustBadge uid={user.id} />

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="luxury-btn-ghost h-8 w-8 p-0"
                          data-testid={`button-actions-${user.id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="luxury-glass-card">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserModal(true);
                          }}
                          data-testid={`action-view-${user.id}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserModal(true);
                          }}
                          data-testid={`action-edit-${user.id}`}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteUserMutation.mutate(user.id)}
                          className="text-red-600"
                          data-testid={`action-delete-${user.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {users.length > 0 && (
              <div className="p-6 border-t border-gray-100 flex items-center justify-between">
                <p className="luxury-text-small">
                  Showing {users.length} of {stats.total} users
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="luxury-btn-ghost" data-testid="button-prev-page">
                    Previous
                  </Button>
                  <Button variant="outline" className="luxury-btn-ghost" data-testid="button-next-page">
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Recent Activity Feed */}
          <div className="luxury-glass-panel p-6 luxury-animate-fade-in luxury-delay-7">
            <h2 className="luxury-heading-sm luxury-text-gradient mb-4">Recent Activity</h2>
            <div className="space-y-3">
              <div className="luxury-glass-minimal p-4 flex items-start gap-3">
                <UserPlus className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="luxury-text-small font-semibold">New user registered</p>
                  <p className="luxury-text-small text-gray-600">john.doe@example.com joined the platform</p>
                  <p className="luxury-text-small text-gray-500 mt-1">2 minutes ago</p>
                </div>
              </div>
              <div className="luxury-glass-minimal p-4 flex items-start gap-3">
                <Edit className="h-5 w-5 text-purple-600 mt-0.5" />
                <div className="flex-1">
                  <p className="luxury-text-small font-semibold">User role updated</p>
                  <p className="luxury-text-small text-gray-600">sarah.smith@example.com promoted to Admin</p>
                  <p className="luxury-text-small text-gray-500 mt-1">15 minutes ago</p>
                </div>
              </div>
              <div className="luxury-glass-minimal p-4 flex items-start gap-3">
                <Crown className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="luxury-text-small font-semibold">Premium upgrade</p>
                  <p className="luxury-text-small text-gray-600">mike.johnson@example.com upgraded to Premium tier</p>
                  <p className="luxury-text-small text-gray-500 mt-1">1 hour ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Detail Modal */}
        <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
          <DialogContent className="luxury-glass-card luxury-shadow-xl max-w-2xl" data-testid="modal-user-details">
            <DialogHeader>
              <DialogTitle className="luxury-heading-md luxury-text-gradient">
                User Details
              </DialogTitle>
              <DialogDescription className="luxury-text-body">
                View and manage user information
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <div className="space-y-6 py-4">
                {/* User Header */}
                <div className="luxury-glass-panel p-6 flex items-center gap-4">
                  <Avatar className="h-20 w-20 border-4 border-purple-200">
                    <AvatarImage src={selectedUser.profileImageUrl} />
                    <AvatarFallback className="luxury-bg-primary text-white text-2xl">
                      {selectedUser.firstName?.[0] || selectedUser.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="luxury-heading-sm mb-1">
                      {selectedUser.firstName && selectedUser.lastName
                        ? `${selectedUser.firstName} ${selectedUser.lastName}`
                        : selectedUser.email}
                    </h3>
                    <p className="luxury-text-small text-gray-600">{selectedUser.email}</p>
                    <div className="flex gap-2 mt-2">
                      {selectedUser.roles.map((role) => (
                        <span key={role} className={getRoleBadgeVariant(selectedUser.roles)}>
                          {role}
                        </span>
                      ))}
                      <span className={getStatusColor(selectedUser.status)}>
                        {selectedUser.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* User Info Sections */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="luxury-glass-panel p-4">
                    <p className="luxury-text-small text-gray-600 mb-1">Phone</p>
                    <p className="luxury-heading-sm">{selectedUser.phone || 'Not provided'}</p>
                  </div>
                  <div className="luxury-glass-panel p-4">
                    <p className="luxury-text-small text-gray-600 mb-1">Loyalty Tier</p>
                    <p className="luxury-heading-sm text-purple-600">{selectedUser.loyaltyTier}</p>
                  </div>
                  <div className="luxury-glass-panel p-4">
                    <p className="luxury-text-small text-gray-600 mb-1">Total Spent</p>
                    <p className="luxury-heading-sm">₪{selectedUser.totalSpent.toFixed(2)}</p>
                  </div>
                  <div className="luxury-glass-panel p-4">
                    <p className="luxury-text-small text-gray-600 mb-1">Loyalty Points</p>
                    <p className="luxury-heading-sm">{selectedUser.loyaltyPoints}</p>
                  </div>
                </div>

                {/* Activity Timeline */}
                <div className="luxury-glass-panel p-4">
                  <h4 className="luxury-heading-sm mb-3">Recent Activity</h4>
                  <div className="space-y-3">
                    <div className="luxury-glass-minimal p-3 flex items-start gap-3">
                      <Calendar className="h-4 w-4 text-purple-600 mt-0.5" />
                      <div>
                        <p className="luxury-text-small font-semibold">Joined Platform</p>
                        <p className="luxury-text-small text-gray-600">
                          {new Date(selectedUser.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {selectedUser.lastLogin && (
                      <div className="luxury-glass-minimal p-3 flex items-start gap-3">
                        <UserCheck className="h-4 w-4 text-green-600 mt-0.5" />
                        <div>
                          <p className="luxury-text-small font-semibold">Last Login</p>
                          <p className="luxury-text-small text-gray-600">
                            {new Date(selectedUser.lastLogin).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                onClick={() => setShowUserModal(false)}
                variant="outline"
                className="luxury-btn-ghost"
                data-testid="button-modal-close"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  if (selectedUser) {
                    deleteUserMutation.mutate(selectedUser.id);
                  }
                }}
                className="luxury-btn-primary bg-red-600 hover:bg-red-700"
                data-testid="button-modal-delete"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete User
              </Button>
              <Button
                onClick={() => {
                  if (selectedUser) {
                    setEditForm({
                      firstName: selectedUser.firstName || '',
                      lastName: selectedUser.lastName || '',
                      phone: selectedUser.phone || '',
                      status: selectedUser.status,
                      loyaltyTier: selectedUser.loyaltyTier,
                    });
                    setShowEditModal(true);
                  }
                }}
                className="luxury-btn-primary"
                data-testid="button-modal-edit"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {showEditModal && selectedUser && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-md" data-testid="dialog-edit-user">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user information for {selectedUser.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">First Name</label>
                  <Input value={editForm.firstName} onChange={(e) => setEditForm(f => ({ ...f, firstName: e.target.value }))} data-testid="input-edit-first-name" />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <Input value={editForm.lastName} onChange={(e) => setEditForm(f => ({ ...f, lastName: e.target.value }))} data-testid="input-edit-last-name" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <PhoneInput
                  value={editForm.phone}
                  onChange={(val) => setEditForm(f => ({ ...f, phone: val || '' }))}
                  defaultCountry="IL"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Loyalty Tier</label>
                <Select value={editForm.loyaltyTier} onValueChange={(v) => setEditForm(f => ({ ...f, loyaltyTier: v }))}>
                  <SelectTrigger data-testid="select-edit-tier"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                    <SelectItem value="diamond">Diamond</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                    <SelectItem value="crown">Crown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button
                disabled={updateUserMutation.isPending}
                onClick={() => {
                  updateUserMutation.mutate({ userId: selectedUser.id, updates: editForm }, {
                    onSuccess: () => {
                      setShowEditModal(false);
                      setShowUserModal(false);
                    },
                  });
                }}
                className="luxury-btn-primary"
                data-testid="button-save-edit"
              >
                {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </Layout>
  );
}
