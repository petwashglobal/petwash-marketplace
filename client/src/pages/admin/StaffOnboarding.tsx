/**
 * Staff Onboarding Management
 * 
 * Admin interface for:
 * - Reviewing staff applications
 * - Approving/rejecting applications
 * - Viewing expense fraud alerts
 * - Monitoring GPS-verified logbook
 * - Managing franchise prepayment orders
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle, XCircle, Clock, DollarSign, MapPin, FileText, Users } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function StaffOnboarding() {
  const { toast } = useToast();
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<any>(null);

  // Fetch pending applications
  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ['/api/staff/applications'],
  });

  // Fetch suspicious expenses
  const { data: suspiciousExpenses } = useQuery({
    queryKey: ['/api/staff/expenses', { verificationStatus: 'suspicious' }],
  });

  // Fetch pending expenses
  const { data: pendingExpenses } = useQuery({
    queryKey: ['/api/staff/expenses', { status: 'pending' }],
  });

  // Fetch unpaid franchise orders
  const { data: unpaidOrders } = useQuery({
    queryKey: ['/api/franchise/orders', { paymentStatus: 'payment_required' }],
  });

  // Approve application mutation
  const approveApplication = useMutation({
    mutationFn: async (applicationId: number) => {
      return apiRequest(`/api/staff/applications/${applicationId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewedBy: 'admin' }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Application Approved',
        description: 'Applicant has been notified and can begin onboarding.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/applications'] });
    },
  });

  // Reject application mutation
  const rejectApplication = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: number; reason: string }) => {
      return apiRequest(`/api/staff/applications/${applicationId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewedBy: 'admin', reason }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Application Rejected',
        description: 'Applicant has been notified of the decision.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/applications'] });
      setRejectionReason('');
      setSelectedApplication(null);
    },
  });

  // Approve expense mutation
  const approveExpense = useMutation({
    mutationFn: async (expenseId: number) => {
      return apiRequest(`/api/staff/expenses/${expenseId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approvedBy: 'admin' }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Expense Approved',
        description: 'Payment will be processed according to schedule.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/expenses'] });
    },
  });

  // Reject expense mutation
  const rejectExpense = useMutation({
    mutationFn: async ({ expenseId, reason }: { expenseId: number; reason: string }) => {
      return apiRequest(`/api/staff/expenses/${expenseId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ approvedBy: 'admin', reason }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Expense Rejected',
        description: 'Employee has been notified.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/expenses'] });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      under_review: 'secondary',
      approved: 'default',
      rejected: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto py-8" data-testid="staff-onboarding-admin">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" data-testid="page-title">Staff Onboarding Management</h1>
        <p className="text-muted-foreground mt-2" data-testid="page-description">
          Review applications, monitor expenses, prevent fraud
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Applications</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending-applications">
              {applications?.applications?.filter((a: any) => a.status === 'pending').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspicious Expenses</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="stat-suspicious-expenses">
              {suspiciousExpenses?.expenses?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending-expenses">
              {pendingExpenses?.expenses?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid Orders</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-unpaid-orders">
              {unpaidOrders?.orders?.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="applications" className="space-y-4">
        <TabsList data-testid="main-tabs">
          <TabsTrigger value="applications" data-testid="tab-applications">
            Applications ({applications?.applications?.filter((a: any) => a.status === 'pending').length || 0})
          </TabsTrigger>
          <TabsTrigger value="fraud-alerts" data-testid="tab-fraud-alerts">
            Fraud Alerts ({suspiciousExpenses?.expenses?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-expenses">
            Expenses ({pendingExpenses?.expenses?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders">
            Franchise Orders ({unpaidOrders?.orders?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Applications Tab */}
        <TabsContent value="applications" data-testid="applications-tab">
          <Card>
            <CardHeader>
              <CardTitle>Pending Staff Applications</CardTitle>
              <CardDescription>Review and approve new contractor applications</CardDescription>
            </CardHeader>
            <CardContent>
              {applicationsLoading ? (
                <div className="text-center py-8" data-testid="applications-loading">Loading...</div>
              ) : !applications?.applications?.length ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="no-applications">
                  No applications found
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.applications
                    .filter((app: any) => ['pending', 'under_review', 'documents_required'].includes(app.status))
                    .map((app: any) => (
                    <Card key={app.id} data-testid={`application-${app.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg" data-testid={`applicant-name-${app.id}`}>
                              {app.firstName} {app.lastName}
                            </CardTitle>
                            <CardDescription>
                              {app.applicationType} • Applied {new Date(app.submittedAt).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(app.status)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label className="text-muted-foreground">Email</Label>
                            <p data-testid={`applicant-email-${app.id}`}>{app.email}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Phone</Label>
                            <p data-testid={`applicant-phone-${app.id}`}>{app.phone}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">City</Label>
                            <p data-testid={`applicant-city-${app.id}`}>{app.city}, {app.country}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Referral Source</Label>
                            <p data-testid={`applicant-referral-${app.id}`}>{app.referralSource || 'N/A'}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => approveApplication.mutate(app.id)}
                            disabled={approveApplication.isPending}
                            className="flex-1"
                            data-testid={`approve-button-${app.id}`}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </Button>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="destructive"
                                onClick={() => setSelectedApplication(app)}
                                className="flex-1"
                                data-testid={`reject-button-${app.id}`}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Reject Application</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                                  <Textarea
                                    id="rejection-reason"
                                    placeholder="Explain why this application is being rejected..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="mt-2"
                                    data-testid="rejection-reason-input"
                                  />
                                </div>
                                <Button
                                  onClick={() => {
                                    if (!rejectionReason) {
                                      toast({
                                        title: 'Rejection reason required',
                                        variant: 'destructive',
                                      });
                                      return;
                                    }
                                    rejectApplication.mutate({
                                      applicationId: selectedApplication.id,
                                      reason: rejectionReason,
                                    });
                                  }}
                                  disabled={rejectApplication.isPending}
                                  variant="destructive"
                                  className="w-full"
                                  data-testid="confirm-reject-button"
                                >
                                  Confirm Rejection
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fraud Alerts Tab */}
        <TabsContent value="fraud-alerts" data-testid="fraud-alerts-tab">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Suspicious Expense Alerts
              </CardTitle>
              <CardDescription>
                AI-detected fraud indicators requiring immediate review
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!suspiciousExpenses?.expenses?.length ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="no-fraud-alerts">
                  ✅ No suspicious expenses detected
                </div>
              ) : (
                <div className="space-y-4">
                  {suspiciousExpenses.expenses.map((expense: any) => (
                    <Card key={expense.id} className="border-destructive" data-testid={`fraud-expense-${expense.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg text-destructive">
                              Fraud Score: {expense.fraudScore}/100
                            </CardTitle>
                            <CardDescription>
                              Employee {expense.employeeId} • {expense.expenseType}
                            </CardDescription>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">₪{expense.amount}</div>
                            <div className="text-sm text-muted-foreground">{expense.currency}</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-destructive font-semibold">⚠️ Fraud Flags:</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {expense.fraudFlags?.map((flag: string) => (
                                <Badge key={flag} variant="destructive" data-testid={`fraud-flag-${flag}`}>
                                  {flag}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {expense.receiptUrl && (
                            <div>
                              <Label>Receipt Image:</Label>
                              <img 
                                src={expense.receiptUrl} 
                                alt="Receipt" 
                                className="mt-2 max-w-md border rounded"
                                data-testid={`receipt-image-${expense.id}`}
                              />
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button
                              onClick={() => approveExpense.mutate(expense.id)}
                              variant="outline"
                              className="flex-1"
                              data-testid={`approve-expense-${expense.id}`}
                            >
                              Approve Anyway
                            </Button>
                            <Button
                              onClick={() => rejectExpense.mutate({ 
                                expenseId: expense.id, 
                                reason: 'Fraudulent receipt detected by AI' 
                              })}
                              variant="destructive"
                              className="flex-1"
                              data-testid={`reject-expense-${expense.id}`}
                            >
                              Reject as Fraud
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
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" data-testid="expenses-tab">
          <Card>
            <CardHeader>
              <CardTitle>Pending Expense Approvals</CardTitle>
              <CardDescription>Review and approve staff expense claims</CardDescription>
            </CardHeader>
            <CardContent>
              {!pendingExpenses?.expenses?.length ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="no-pending-expenses">
                  No pending expenses
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingExpenses.expenses.map((expense: any) => (
                    <Card key={expense.id} data-testid={`expense-${expense.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">₪{expense.amount}</CardTitle>
                            <CardDescription>{expense.expenseType} • Employee {expense.employeeId}</CardDescription>
                          </div>
                          {expense.fraudScore && (
                            <Badge variant={Number(expense.fraudScore) > 50 ? 'destructive' : 'secondary'}>
                              Fraud Score: {expense.fraudScore}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-4">{expense.description}</p>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => approveExpense.mutate(expense.id)}
                            className="flex-1"
                            data-testid={`approve-expense-button-${expense.id}`}
                          >
                            Approve
                          </Button>
                          <Button
                            onClick={() => rejectExpense.mutate({ 
                              expenseId: expense.id, 
                              reason: 'Not approved' 
                            })}
                            variant="outline"
                            className="flex-1"
                            data-testid={`reject-expense-button-${expense.id}`}
                          >
                            Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Franchise Orders Tab */}
        <TabsContent value="orders" data-testid="orders-tab">
          <Card>
            <CardHeader>
              <CardTitle>Franchise Prepayment Required</CardTitle>
              <CardDescription>Orders pending payment confirmation</CardDescription>
            </CardHeader>
            <CardContent>
              {!unpaidOrders?.orders?.length ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="no-unpaid-orders">
                  All orders paid ✅
                </div>
              ) : (
                <div className="space-y-4">
                  {unpaidOrders.orders.map((order: any) => (
                    <Card key={order.id} data-testid={`order-${order.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">Order #{order.id}</CardTitle>
                            <CardDescription>Franchise {order.franchiseId} • {order.orderType}</CardDescription>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">${order.totalAmount}</div>
                            <Badge variant="destructive">Payment Required</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          ⚠️ Order cannot be processed until payment is confirmed
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
