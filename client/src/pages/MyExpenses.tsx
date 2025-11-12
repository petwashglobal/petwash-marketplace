import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { Calendar, DollarSign, FileText, Plus, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';

type Expense = {
  id: number;
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
  approverName: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

const statusConfig: Record<string, { label: string; labelHe: string; icon: any; variant: any }> = {
  draft: {
    label: 'Draft',
    labelHe: 'טיוטה',
    icon: FileText,
    variant: 'secondary',
  },
  pending: {
    label: 'Pending Approval',
    labelHe: 'ממתין לאישור',
    icon: Clock,
    variant: 'default',
  },
  approved: {
    label: 'Approved',
    labelHe: 'אושר',
    icon: CheckCircle2,
    variant: 'default',
  },
  rejected: {
    label: 'Rejected',
    labelHe: 'נדחה',
    icon: XCircle,
    variant: 'outline',
  },
};

const policyStatusConfig: Record<string, { label: string; variant: any }> = {
  compliant: { label: '✅ תקין', variant: 'default' },
  warning: { label: '⚠️ אזהרה', variant: 'secondary' },
  violation: { label: '❌ הפרה', variant: 'outline' },
};

export default function MyExpenses() {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const { data: expenses, isLoading } = useQuery<{ data: Expense[] }>({
    queryKey: ['/api/expenses', selectedStatus !== 'all' ? `?status=${selectedStatus}` : ''],
  });

  const expensesList = expenses?.data || [];

  const stats = {
    total: expensesList.length,
    pending: expensesList.filter(e => e.status === 'pending').length,
    approved: expensesList.filter(e => e.status === 'approved').length,
    rejected: expensesList.filter(e => e.status === 'rejected').length,
    draft: expensesList.filter(e => e.status === 'draft').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-white dark:from-black dark:via-gray-900 dark:to-black p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-black to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              ההוצאות שלי
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">My Expenses</p>
          </div>
          <Link href="/new-expense">
            <Button className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black border-2 border-black dark:border-white">
              <Plus className="mr-2" />
              הוצאה חדשה / New Expense
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="p-4 border-2 border-black dark:border-white text-center">
            <div className="text-3xl font-bold text-black dark:text-white">{stats.total}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">סה"כ / Total</div>
          </Card>
          <Card className="p-4 border-2 border-gray-400 dark:border-gray-600 text-center">
            <div className="text-3xl font-bold text-black dark:text-white">{stats.pending}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">ממתין / Pending</div>
          </Card>
          <Card className="p-4 border-2 border-gray-400 dark:border-gray-600 text-center">
            <div className="text-3xl font-bold text-black dark:text-white">{stats.approved}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">אושר / Approved</div>
          </Card>
          <Card className="p-4 border-2 border-gray-400 dark:border-gray-600 text-center">
            <div className="text-3xl font-bold text-black dark:text-white">{stats.rejected}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">נדחה / Rejected</div>
          </Card>
          <Card className="p-4 border-2 border-gray-400 dark:border-gray-600 text-center">
            <div className="text-3xl font-bold text-black dark:text-white">{stats.draft}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">טיוטה / Draft</div>
          </Card>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {['all', 'draft', 'pending', 'approved', 'rejected'].map((status) => (
            <Button
              key={status}
              onClick={() => setSelectedStatus(status)}
              variant={selectedStatus === status ? 'default' : 'outline'}
              className={selectedStatus === status 
                ? 'bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-white'
                : 'border-2 border-black dark:border-white text-black dark:text-white'
              }
            >
              {status === 'all' ? 'הכל / All' : statusConfig[status]?.labelHe || status}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-20 w-full" />
              </Card>
            ))}
          </div>
        ) : expensesList.length === 0 ? (
          <Card className="p-12 text-center border-2 border-black dark:border-white">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-bold mb-2 text-black dark:text-white">
              אין הוצאות
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              התחל על ידי הגשת הוצאה ראשונה
            </p>
            <Link href="/new-expense">
              <Button className="bg-black text-white dark:bg-white dark:text-black">
                <Plus className="mr-2" />
                הוצאה חדשה
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {expensesList.map((expense) => {
              const statusInfo = statusConfig[expense.status] || statusConfig.draft;
              const StatusIcon = statusInfo.icon;
              
              return (
                <Card key={expense.id} className="p-6 border-2 border-black dark:border-white hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <StatusIcon className="w-6 h-6 text-black dark:text-white" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={statusInfo.variant as any} className="text-sm">
                            {statusInfo.labelHe}
                          </Badge>
                          {expense.policyStatus !== 'compliant' && (
                            <Badge variant={policyStatusConfig[expense.policyStatus].variant as any}>
                              {policyStatusConfig[expense.policyStatus].label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {expense.category} • {new Date(expense.expenseDate).toLocaleDateString('he-IL')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-black dark:text-white">
                        ₪{parseFloat(expense.totalAmountILS).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        VAT: ₪{parseFloat(expense.vatAmountILS).toFixed(2)} ({(parseFloat(expense.vatRateApplied) * 100).toFixed(0)}%)
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    {expense.description}
                  </p>

                  {expense.policyViolations && expense.policyViolations.length > 0 && (
                    <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded border border-gray-300 dark:border-gray-700 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <span className="font-bold text-sm">הפרות מדיניות / Policy Violations:</span>
                      </div>
                      <ul className="text-sm space-y-1">
                        {expense.policyViolations.map((v: any, idx: number) => (
                          <li key={idx} className="text-gray-700 dark:text-gray-300">
                            • {v.messageHE || v.messageEN}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {expense.status === 'rejected' && expense.rejectionReason && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded border border-red-200 dark:border-red-800">
                      <div className="font-bold text-sm mb-1 text-red-900 dark:text-red-300">סיבת דחייה / Rejection Reason:</div>
                      <p className="text-sm text-red-800 dark:text-red-200">{expense.rejectionReason}</p>
                    </div>
                  )}

                  <Separator className="my-4 bg-gray-300 dark:bg-gray-700" />

                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <div>
                      {expense.approverName && (
                        <span>Approver: {expense.approverName}</span>
                      )}
                    </div>
                    <div>
                      Submitted: {expense.submittedAt ? new Date(expense.submittedAt).toLocaleDateString('he-IL') : 'Not submitted'}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
