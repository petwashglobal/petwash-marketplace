import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Clock, AlertTriangle, DollarSign, Calendar, User, FileText } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type Expense = {
  id: number;
  employeeName: string;
  employeeEmail: string;
  expenseDate: string;
  totalAmountILS: string;
  netAmountILS: string;
  vatAmountILS: string;
  vatRateApplied: string;
  category: string;
  description: string;
  status: string;
  policyStatus: string;
  policyViolations: any[];
  submittedAt: string | null;
  createdAt: string;
};

const categoryLabels: Record<string, string> = {
  meals: 'ארוחות / Meals',
  travel: 'נסיעות / Travel',
  office_supplies: 'ציוד משרדי / Office',
  training: 'הכשרה / Training',
  accommodation: 'לינה / Accommodation',
  mileage: 'קילומטראז / Mileage',
  entertainment: 'בידור / Entertainment',
  other: 'אחר / Other',
};

export default function ApproveExpenses() {
  const { toast } = useToast();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: pendingExpenses, isLoading } = useQuery<{ data: Expense[] }>({
    queryKey: ['/api/expenses/pending-approval'],
  });

  const approveMutation = useMutation({
    mutationFn: async (expenseId: number) => {
      return apiRequest(`/api/expenses/${expenseId}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/pending-approval'] });
      toast({
        title: '✅ הוצאה אושרה',
        description: 'ההוצאה אושרה בהצלחה',
      });
      setSelectedExpense(null);
      setActionType(null);
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה באישור הוצאה',
        description: error.message || 'נסה שוב',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ expenseId, reason }: { expenseId: number; reason: string }) => {
      return apiRequest(`/api/expenses/${expenseId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ rejectionReason: reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/pending-approval'] });
      toast({
        title: '❌ הוצאה נדחתה',
        description: 'ההוצאה נדחתה והוחזרה לעובד',
      });
      setSelectedExpense(null);
      setActionType(null);
      setRejectionReason('');
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה בדחיית הוצאה',
        description: error.message || 'נסה שוב',
      });
    },
  });

  const handleApprove = () => {
    if (selectedExpense) {
      approveMutation.mutate(selectedExpense.id);
    }
  };

  const handleReject = () => {
    if (selectedExpense && rejectionReason.trim()) {
      rejectMutation.mutate({
        expenseId: selectedExpense.id,
        reason: rejectionReason.trim(),
      });
    } else {
      toast({
        title: 'נדרשת סיבת דחייה',
        description: 'אנא הזן סיבה לדחיית ההוצאה',
      });
    }
  };

  const openDialog = (expense: Expense, action: 'approve' | 'reject') => {
    setSelectedExpense(expense);
    setActionType(action);
  };

  const closeDialog = () => {
    setSelectedExpense(null);
    setActionType(null);
    setRejectionReason('');
  };

  const expensesList = pendingExpenses?.data || [];
  const totalPendingAmount = expensesList.reduce(
    (sum, exp) => sum + parseFloat(exp.totalAmountILS),
    0
  );

  return (
    <div className="min-h-screen luxury-bg-mesh p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-2">
            אישור הוצאות עובדים
          </h1>
          <p className="luxury-text-body">
            Approve Employee Expenses • Manager Dashboard
          </p>
        </div>

        <div className="luxury-grid-3 luxury-gap-md mb-8">
          <Card className="p-6 luxury-glass-card luxury-hover-lift text-center luxury-animate-slide-up luxury-delay-1">
            <Clock className="w-8 h-8 mx-auto mb-2 text-violet-600" />
            <div className="luxury-heading-lg">{expensesList.length}</div>
            <div className="luxury-text-small">הוצאות ממתינות / Pending</div>
          </Card>
          <Card className="p-6 luxury-glass-card luxury-hover-lift text-center luxury-animate-slide-up luxury-delay-2">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-violet-600" />
            <div className="luxury-heading-lg luxury-text-gradient">
              ₪{totalPendingAmount.toFixed(2)}
            </div>
            <div className="luxury-text-small">סה"כ סכום / Total Amount</div>
          </Card>
          <Card className="p-6 luxury-glass-card luxury-hover-lift text-center luxury-animate-slide-up luxury-delay-3">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-600" />
            <div className="luxury-heading-lg">
              {expensesList.filter(e => e.policyStatus === 'violation').length}
            </div>
            <div className="luxury-text-small">הפרות מדיניות / Violations</div>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-32 w-full" />
              </Card>
            ))}
          </div>
        ) : expensesList.length === 0 ? (
          <Card className="p-12 text-center luxury-glass-card luxury-shadow-xl luxury-animate-fade-in">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-600" />
            <h3 className="luxury-heading-lg mb-2">
              אין הוצאות ממתינות
            </h3>
            <p className="luxury-text-body">
              כל ההוצאות אושרו או נדחו
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {expensesList.map((expense, idx) => (
              <Card key={expense.id} className={`p-6 luxury-glass-minimal luxury-hover-lift luxury-animate-slide-up luxury-delay-${Math.min(idx % 10, 10)}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg border-4 border-white/20 shadow-lg">
                      {expense.employeeName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h3 className="luxury-heading-md mb-1">
                        {expense.employeeName || 'Unknown Employee'}
                      </h3>
                      <p className="luxury-text-small">{expense.employeeEmail}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-white dark:bg-white text-black dark:text-black">
                          {categoryLabels[expense.category] || expense.category}
                        </Badge>
                        {expense.policyStatus === 'violation' && (
                          <Badge className="bg-black text-white dark:bg-white dark:text-black">⚠️ הפרת מדיניות</Badge>
                        )}
                        {expense.policyStatus === 'warning' && (
                          <Badge variant="secondary">⚠️ אזהרה</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="luxury-heading-lg luxury-text-gradient">
                      ₪{parseFloat(expense.totalAmountILS).toFixed(2)}
                    </div>
                    <div className="luxury-text-small mt-1">
                      VAT: ₪{parseFloat(expense.vatAmountILS).toFixed(2)} ({(parseFloat(expense.vatRateApplied) * 100).toFixed(0)}%)
                    </div>
                    <div className="luxury-text-small">
                      Net: ₪{parseFloat(expense.netAmountILS).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2 luxury-text-small">
                    <Calendar className="w-4 h-4" />
                    {new Date(expense.expenseDate).toLocaleDateString('he-IL')}
                  </div>
                  <p className="luxury-text-body">
                    {expense.description}
                  </p>
                </div>

                {expense.policyViolations && expense.policyViolations.length > 0 && (
                  <Alert className="mb-4 luxury-glass-card border-2 border-amber-500/50">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <AlertDescription>
                      <div className="luxury-heading-sm mb-2">Policy Violations:</div>
                      <ul className="text-sm space-y-1">
                        {expense.policyViolations.map((v: any, idx: number) => (
                          <li key={idx} className="luxury-text-body">
                            • {v.messageHE || v.messageEN}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <Separator className="my-4" />

                <div className="flex justify-between items-center">
                  <div className="luxury-text-small">
                    Submitted: {expense.submittedAt ? new Date(expense.submittedAt).toLocaleDateString('he-IL') : 'Unknown'}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => openDialog(expense, 'reject')}
                      className="luxury-btn-danger"
                      data-testid={`button-reject-${expense.id}`}
                    >
                      <XCircle className="mr-2 w-4 h-4" />
                      דחה / Reject
                    </Button>
                    <Button
                      onClick={() => openDialog(expense, 'approve')}
                      className="luxury-btn-primary"
                      data-testid={`button-approve-${expense.id}`}
                    >
                      <CheckCircle2 className="mr-2 w-4 h-4" />
                      אשר / Approve
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!selectedExpense && !!actionType} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent className="luxury-glass-card luxury-shadow-xl">
            <DialogHeader>
              <DialogTitle className="luxury-heading-lg">
                {actionType === 'approve' ? '✅ אישור הוצאה' : '❌ דחיית הוצאה'}
              </DialogTitle>
              <DialogDescription className="luxury-text-body">
                {actionType === 'approve'
                  ? 'Approve Expense - This will process the expense for payment'
                  : 'Reject Expense - Provide a reason for rejection'}
              </DialogDescription>
            </DialogHeader>

            {selectedExpense && (
              <div className="space-y-4">
                <Card className="p-4 luxury-glass-minimal">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="luxury-text-small">Employee:</span>
                      <p className="luxury-heading-sm">{selectedExpense.employeeName}</p>
                    </div>
                    <div>
                      <span className="luxury-text-small">Amount:</span>
                      <p className="luxury-heading-md luxury-text-gradient">
                        ₪{parseFloat(selectedExpense.totalAmountILS).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="luxury-text-small">Category:</span>
                      <p className="luxury-heading-sm">
                        {categoryLabels[selectedExpense.category]}
                      </p>
                    </div>
                    <div>
                      <span className="luxury-text-small">Date:</span>
                      <p className="luxury-heading-sm">
                        {new Date(selectedExpense.expenseDate).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                  </div>
                </Card>

                {actionType === 'reject' && (
                  <div>
                    <label className="luxury-heading-sm mb-2 block">
                      סיבת דחייה / Rejection Reason:
                    </label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="לדוגמה: חסרה קבלה, סכום גבוה מדי..."
                      rows={4}
                      className="luxury-glass-minimal resize-none"
                      data-testid="input-rejection-reason"
                    />
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <Button
                    onClick={closeDialog}
                    className="luxury-btn-secondary"
                  >
                    ביטול / Cancel
                  </Button>
                  {actionType === 'approve' ? (
                    <Button
                      onClick={handleApprove}
                      disabled={approveMutation.isPending}
                      className="luxury-btn-primary"
                      data-testid="button-confirm-approve"
                    >
                      {approveMutation.isPending ? 'מאשר...' : '✅ אשר הוצאה'}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleReject}
                      disabled={rejectMutation.isPending || !rejectionReason.trim()}
                      className="luxury-btn-danger"
                      data-testid="button-confirm-reject"
                    >
                      {rejectMutation.isPending ? 'דוחה...' : '❌ דחה הוצאה'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
