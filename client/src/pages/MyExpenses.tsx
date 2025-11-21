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
    <div className="min-h-screen luxury-bg-mesh p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 luxury-animate-fade-in">
          <div>
            <h1 className="luxury-heading-xl">
              ההוצאות שלי
            </h1>
            <p className="luxury-text-body mt-1">My Expenses</p>
          </div>
          <Link href="/new-expense">
            <Button className="luxury-btn-primary">
              <Plus className="mr-2" />
              הוצאה חדשה / New Expense
            </Button>
          </Link>
        </div>

        <div className="luxury-grid-5 luxury-gap-md mb-8">
          <Card className="p-4 luxury-glass-card luxury-hover-lift text-center luxury-animate-slide-up luxury-delay-1">
            <div className="luxury-heading-lg luxury-text-gradient">{stats.total}</div>
            <div className="luxury-text-small">סה"כ / Total</div>
          </Card>
          <Card className="p-4 luxury-glass-card luxury-hover-lift text-center luxury-animate-slide-up luxury-delay-2">
            <div className="luxury-heading-lg">{stats.pending}</div>
            <div className="luxury-text-small">ממתין / Pending</div>
          </Card>
          <Card className="p-4 luxury-glass-card luxury-hover-lift text-center luxury-animate-slide-up luxury-delay-3">
            <div className="luxury-heading-lg">{stats.approved}</div>
            <div className="luxury-text-small">אושר / Approved</div>
          </Card>
          <Card className="p-4 luxury-glass-card luxury-hover-lift text-center luxury-animate-slide-up luxury-delay-4">
            <div className="luxury-heading-lg">{stats.rejected}</div>
            <div className="luxury-text-small">נדחה / Rejected</div>
          </Card>
          <Card className="p-4 luxury-glass-card luxury-hover-lift text-center luxury-animate-slide-up luxury-delay-5">
            <div className="luxury-heading-lg">{stats.draft}</div>
            <div className="luxury-text-small">טיוטה / Draft</div>
          </Card>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap luxury-animate-fade-in luxury-delay-2">
          {['all', 'draft', 'pending', 'approved', 'rejected'].map((status, idx) => (
            <Button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={selectedStatus === status ? 'luxury-btn-primary' : 'luxury-btn-secondary'}
            >
              {status === 'all' ? 'הכל / All' : statusConfig[status]?.labelHe || status}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 luxury-glass-card">
                <Skeleton className="h-20 w-full" />
              </Card>
            ))}
          </div>
        ) : expensesList.length === 0 ? (
          <Card className="p-12 text-center luxury-glass-card luxury-shadow-xl luxury-animate-fade-in">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="luxury-heading-lg mb-2">
              אין הוצאות
            </h3>
            <p className="luxury-text-body mb-6">
              התחל על ידי הגשת הוצאה ראשונה
            </p>
            <Link href="/new-expense">
              <Button className="luxury-btn-primary">
                <Plus className="mr-2" />
                הוצאה חדשה
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {expensesList.map((expense, idx) => {
              const statusInfo = statusConfig[expense.status] || statusConfig.draft;
              const StatusIcon = statusInfo.icon;
              
              return (
                <Card key={expense.id} className={`p-6 luxury-glass-minimal luxury-hover-lift luxury-animate-slide-up luxury-delay-${Math.min(idx % 10, 10)}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <StatusIcon className="w-6 h-6 text-violet-600" />
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
                      <div className="luxury-heading-lg luxury-text-gradient">
                        ₪{parseFloat(expense.totalAmountILS).toFixed(2)}
                      </div>
                      <div className="luxury-text-small">
                        VAT: ₪{parseFloat(expense.vatAmountILS).toFixed(2)} ({(parseFloat(expense.vatRateApplied) * 100).toFixed(0)}%)
                      </div>
                    </div>
                  </div>

                  <p className="luxury-text-body mb-4">
                    {expense.description}
                  </p>

                  {expense.policyViolations && expense.policyViolations.length > 0 && (
                    <div className="luxury-glass-card p-4 rounded border-2 border-amber-500/50 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="luxury-heading-sm">הפרות מדיניות / Policy Violations:</span>
                      </div>
                      <ul className="text-sm space-y-1">
                        {expense.policyViolations.map((v: any, idx: number) => (
                          <li key={idx} className="luxury-text-body">
                            • {v.messageHE || v.messageEN}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {expense.status === 'rejected' && expense.rejectionReason && (
                    <div className="luxury-glass-card p-4 rounded border-2 border-red-500/50 mb-4">
                      <div className="luxury-heading-sm mb-1 text-red-600">סיבת דחייה / Rejection Reason:</div>
                      <p className="luxury-text-body text-red-600">{expense.rejectionReason}</p>
                    </div>
                  )}

                  <Separator className="my-4" />

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
