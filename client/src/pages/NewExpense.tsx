import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Upload, DollarSign, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ReceiptCameraUpload } from '@/components/ReceiptCameraUpload';

const expenseCategories = [
  { value: 'meals', label: 'ארוחות / Meals', labelEn: 'Meals' },
  { value: 'travel', label: 'נסיעות / Travel', labelEn: 'Travel' },
  { value: 'office_supplies', label: 'ציוד משרדי / Office Supplies', labelEn: 'Office Supplies' },
  { value: 'training', label: 'הכשרה / Training', labelEn: 'Training' },
  { value: 'accommodation', label: 'לינה / Accommodation', labelEn: 'Accommodation' },
  { value: 'mileage', label: 'קילומטראז / Mileage', labelEn: 'Mileage' },
  { value: 'entertainment', label: 'בידור/אירוח / Entertainment', labelEn: 'Entertainment' },
  { value: 'other', label: 'אחר / Other', labelEn: 'Other' },
];

const expenseFormSchema = z.object({
  expenseDate: z.string().min(1, 'Date required'),
  totalAmountILS: z.string().min(1, 'Amount required').refine((val) => parseFloat(val) > 0, 'Amount must be positive'),
  category: z.string().min(1, 'Category required'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  mileageKm: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export default function NewExpense() {
  const { toast } = useToast();
  const [vatDetails, setVatDetails] = useState<{
    netAmount: number;
    vatAmount: number;
    vatRate: number;
  } | null>(null);

  const { data: taxRates } = useQuery({
    queryKey: ['/api/config/tax-rates'],
  });

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    mode: 'onChange',
    defaultValues: {
      expenseDate: new Date().toISOString().split('T')[0],
      totalAmountILS: '',
      category: 'other',
      description: '',
      mileageKm: '',
    },
  });

  const totalAmount = parseFloat(form.watch('totalAmountILS') || '0');
  const category = form.watch('category');

  useEffect(() => {
    if (totalAmount > 0 && taxRates?.data && category) {
      const categoryToVATMap: Record<string, string> = {
        'flight': 'exempt',
        'international_travel': 'zero_rate',
        'export': 'zero_rate',
        'education': 'exempt',
        'health': 'exempt',
        'meals': 'standard',
        'office_supplies': 'standard',
        'entertainment': 'standard',
        'accommodation': 'standard',
        'training': 'standard',
        'mileage': 'exempt',
        'travel': 'standard',
        'other': 'standard',
      };

      const vatCategory = categoryToVATMap[category] || 'standard';
      
      const categoryRate = taxRates.data.find(
        (rate: any) => rate.taxType === 'vat' && rate.category === vatCategory
      );
      
      if (categoryRate) {
        const rate = parseFloat(categoryRate.rate);
        const netAmount = totalAmount / (1 + rate);
        const vatAmount = totalAmount - netAmount;
        
        setVatDetails({
          netAmount: parseFloat(netAmount.toFixed(2)),
          vatAmount: parseFloat(vatAmount.toFixed(2)),
          vatRate: rate * 100,
        });
      }
    } else {
      setVatDetails(null);
    }
  }, [totalAmount, taxRates, category]);

  const submitExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormValues) => {
      return apiRequest('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          totalAmountILS: parseFloat(data.totalAmountILS),
          mileageKm: data.mileageKm ? parseFloat(data.mileageKm) : null,
        }),
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/pending-approval'] });
      
      if (response.validation?.isValid) {
        toast({
          title: '✅ הוצאה נשלחה בהצלחה',
          description: 'ההוצאה נשלחה לאישור',
        });
      } else {
        toast({
          title: '⚠️ הוצאה נשמרה כטיוטה',
          description: 'ישנן הפרות מדיניות. אנא תקן ונסה שוב.',
        });
      }
      
      form.reset();
      setVatDetails(null);
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה בשליחת הוצאה',
        description: error.message || 'נסה שוב מאוחר יותר',
      });
    },
  });

  const onSubmit = (data: ExpenseFormValues) => {
    submitExpenseMutation.mutate(data);
  };

  return (
    <div className="min-h-screen luxury-bg-mesh p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-2">
            הגשת הוצאה חדשה
          </h1>
          <p className="luxury-text-body">
            Israeli Employee Expense Management • 2025 FinTech Architecture
          </p>
        </div>

        <Card className="p-8 luxury-glass-card luxury-shadow-xl luxury-animate-slide-up luxury-delay-1">
          {/* Camera-First Receipt Upload - 2025 Mandate */}
          <div className="mb-8 p-6 luxury-glass-card luxury-shadow-xl rounded-xl">
            <h3 className="luxury-heading-md mb-4 flex items-center gap-2">
              📸 העלאת קבלה / Receipt Upload
              <Badge variant="default" className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">
                Camera-First
              </Badge>
            </h3>
            <ReceiptCameraUpload
              onDataExtracted={(data) => {
                // Auto-fill form with OCR data
                if (data.date) {
                  form.setValue('expenseDate', data.date);
                }
                if (data.amount) {
                  form.setValue('totalAmountILS', data.amount.toString());
                }
                // You can add more auto-fill logic here if needed
              }}
              language="he"
            />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="expenseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="luxury-heading-sm flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      תאריך ההוצאה / Expense Date
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        className="luxury-glass-minimal text-lg"
                        data-testid="input-expense-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="totalAmountILS"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="luxury-heading-sm flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      סכום כולל (₪) / Total Amount (ILS)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        className="luxury-glass-minimal luxury-heading-lg luxury-text-gradient"
                        data-testid="input-total-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {vatDetails && (
                <Alert className="bg-gray-100 dark:bg-gray-900 border-2 border-black dark:border-white">
                  <Info className="w-5 h-5" />
                  <AlertDescription>
                    <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">מע"מ ({vatDetails.vatRate}%):</span>
                        <span className="font-bold ml-2">₪{vatDetails.vatAmount.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">נטו (ללא מע"מ):</span>
                        <span className="font-bold ml-2">₪{vatDetails.netAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black dark:text-white text-lg font-bold">
                      קטגוריה / Category
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-2 border-black dark:border-white text-black dark:text-white">
                          <SelectValue placeholder="בחר קטגוריה" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {expenseCategories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {category === 'mileage' && (
                <FormField
                  control={form.control}
                  name="mileageKm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black dark:text-white text-lg font-bold">
                        קילומטרים / Kilometers
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          {...field}
                          className="border-2 border-black dark:border-white text-black dark:text-white"
                          data-testid="input-mileage"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black dark:text-white text-lg font-bold">
                      תיאור / Description
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="לדוגמה: ארוחת צהריים עם לקוח פוטנציאלי..."
                        rows={4}
                        {...field}
                        className="border-2 border-black dark:border-white text-black dark:text-white resize-none"
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator className="bg-black dark:bg-white" />

              <div className="flex justify-center">
                <Button
                  type="submit"
                  disabled={submitExpenseMutation.isPending}
                  className="w-full max-w-md bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black font-bold text-lg py-6 border-2 border-black dark:border-white transition-all"
                  data-testid="button-submit-expense"
                >
                  {submitExpenseMutation.isPending ? 'שולח...' : 'שלח הוצאה / Submit Expense'}
                </Button>
              </div>
            </form>
          </Form>
        </Card>

        {taxRates?.data && (
          <Card className="mt-6 p-6 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
            <h3 className="font-bold mb-4 text-black dark:text-white">
              📊 שיעורי מס עדכניים / Current Tax Rates
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {taxRates.data.map((rate: any, idx: number) => (
                <Badge key={idx} variant="outline" className="justify-between p-2">
                  <span>{rate.descriptionHe || rate.description}</span>
                  <span className="font-bold">{rate.ratePercent}%</span>
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
