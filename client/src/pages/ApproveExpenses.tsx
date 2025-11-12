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
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-white dark:from-black dark:via-gray-900 dark:to-black p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-black to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-2">
            אישור הוצאות עובדים
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Approve Employee Expenses • Manager Dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 border-2 border-black dark:border-white text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-black dark:text-white" />
            <div className="text-3xl font-bold text-black dark:text-white">{expensesList.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">הוצאות ממתינות / Pending</div>
          </Card>
          <Card className="p-6 border-2 border-black dark:border-white text-center">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-black dark:text-white" />
            <div className="text-3xl font-bold text-black dark:text-white">
              ₪{totalPendingAmount.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">סה"כ סכום / Total Amount</div>
          </Card>
          <Card className="p-6 border-2 border-black dark:border-white text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-black dark:text-white" />
            <div className="text-3xl font-bold text-black dark:text-white">
              {expensesList.filter(e => e.policyStatus === 'violation').length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">הפרות מדיניות / Violations</div>
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
          <Card className="p-12 text-center border-2 border-black dark:border-white">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-600" />
            <h3 className="text-xl font-bold mb-2 text-black dark:text-white">
              אין הוצאות ממתינות
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              כל ההוצאות אושרו או נדחו
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {expensesList.map((expense) => (
              <Card key={expense.id} className="p-6 border-2 border-black dark:border-white hover:shadow-xl transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-bold text-lg">
                      {expense.employeeName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-black dark:text-white mb-1">
                        {expense.employeeName || 'Unknown Employee'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{expense.employeeEmail}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-gray-200 dark:bg-gray-800 text-black dark:text-white">
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
                    <div className="text-4xl font-bold text-black dark:text-white">
                      ₪{parseFloat(expense.totalAmountILS).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      VAT: ₪{parseFloat(expense.vatAmountILS).toFixed(2)} ({(parseFloat(expense.vatRateApplied) * 100).toFixed(0)}%)
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Net: ₪{parseFloat(expense.netAmountILS).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2 text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="w-4 h-4" />
                    {new Date(expense.expenseDate).toLocaleDateString('he-IL')}
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">
                    {expense.description}
                  </p>
                </div>

                {expense.policyViolations && expense.policyViolations.length > 0 && (
                  <Alert className="mb-4 bg-gray-100 dark:bg-gray-900 border-2 border-black dark:border-white">
                    <AlertTriangle className="w-4 h-4 text-black dark:text-white" />
                    <AlertDescription>
                      <div className="font-bold mb-2 text-sm text-black dark:text-white">Policy Violations:</div>
                      <ul className="text-sm space-y-1">
                        {expense.policyViolations.map((v: any, idx: number) => (
                          <li key={idx} className="text-gray-700 dark:text-gray-300">
                            • {v.messageHE || v.messageEN}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <Separator className="my-4 bg-gray-300 dark:bg-gray-700" />

                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Submitted: {expense.submittedAt ? new Date(expense.submittedAt).toLocaleDateString('he-IL') : 'Unknown'}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => openDialog(expense, 'reject')}
                      variant="outline"
                      className="border-2 border-black dark:border-white text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900"
                      data-testid={`button-reject-${expense.id}`}
                    >
                      <XCircle className="mr-2 w-4 h-4" />
                      דחה / Reject
                    </Button>
                    <Button
                      onClick={() => openDialog(expense, 'approve')}
                      className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black border-2 border-black dark:border-white"
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
          <DialogContent className="border-2 border-black dark:border-white bg-white dark:bg-black">
            <DialogHeader>
              <DialogTitle className="text-2xl text-black dark:text-white">
                {actionType === 'approve' ? '✅ אישור הוצאה' : '❌ דחיית הוצאה'}
              </DialogTitle>
              <DialogDescription>
                {actionType === 'approve'
                  ? 'Approve Expense - This will process the expense for payment'
                  : 'Reject Expense - Provide a reason for rejection'}
              </DialogDescription>
            </DialogHeader>

            {selectedExpense && (
              <div className="space-y-4">
                <Card className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Employee:</span>
                      <p className="font-bold text-black dark:text-white">{selectedExpense.employeeName}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                      <p className="font-bold text-black dark:text-white text-lg">
                        ₪{parseFloat(selectedExpense.totalAmountILS).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Category:</span>
                      <p className="font-bold text-black dark:text-white">
                        {categoryLabels[selectedExpense.category]}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Date:</span>
                      <p className="font-bold text-black dark:text-white">
                        {new Date(selectedExpense.expenseDate).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                  </div>
                </Card>

                {actionType === 'reject' && (
                  <div>
                    <label className="text-sm font-bold mb-2 block text-black dark:text-white">
                      סיבת דחייה / Rejection Reason:
                    </label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="לדוגמה: חסרה קבלה, סכום גבוה מדי..."
                      rows={4}
                      className="border-2 border-black dark:border-white text-black dark:text-white resize-none"
                      data-testid="input-rejection-reason"
                    />
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <Button
                    onClick={closeDialog}
                    variant="outline"
                    className="border-2 border-gray-400 dark:border-gray-600"
                  >
                    ביטול / Cancel
                  </Button>
                  {actionType === 'approve' ? (
                    <Button
                      onClick={handleApprove}
                      disabled={approveMutation.isPending}
                      className="bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-white"
                      data-testid="button-confirm-approve"
                    >
                      {approveMutation.isPending ? 'מאשר...' : '✅ אשר הוצאה'}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleReject}
                      disabled={rejectMutation.isPending || !rejectionReason.trim()}
                      className="bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-white"
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
