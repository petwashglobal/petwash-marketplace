import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, Loader2, Plus, Send, Clock, CheckCircle2, XCircle, FileText, Calendar } from "lucide-react";

const expenseFormSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  description: z.string().min(10, "Please provide a detailed description (min 10 characters)"),
  vendor: z.string().min(1, "Vendor/supplier name is required"),
  amountBeforeVat: z.string().min(1, "Amount is required"),
  vatAmount: z.string().optional(),
  totalAmount: z.string().min(1, "Total amount is required"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  receiptNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
  taxMonth: z.string().min(1, "Tax month is required"),
  taxYear: z.string().min(1, "Tax year is required"),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

const EXPENSE_CATEGORIES = [
  { value: "fuel", label: "Fuel & Transportation" },
  { value: "client_meals", label: "Client Lunch/Dinner" },
  { value: "equipment", label: "Equipment & Technology" },
  { value: "travel_overseas", label: "Overseas Work Trip" },
  { value: "travel_domestic", label: "Domestic Work Trip" },
  { value: "office_supplies", label: "Office Supplies" },
  { value: "utilities", label: "Utilities" },
  { value: "rent", label: "Rent & Leasing" },
  { value: "maintenance", label: "Maintenance & Repairs" },
  { value: "marketing", label: "Marketing & Advertising" },
  { value: "professional_services", label: "Professional Services" },
  { value: "insurance", label: "Insurance" },
  { value: "training", label: "Training & Development" },
  { value: "other", label: "Other Business Expense" },
];

const PAYMENT_METHODS = [
  { value: "company_card", label: "Company Credit Card" },
  { value: "personal_card", label: "Personal Card (Reimbursement)" },
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "check", label: "Check" },
];

export default function EmployeeExpenses() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch employee's expense history
  const { data: expensesData, isLoading: isLoadingExpenses } = useQuery({
    queryKey: ['/api/accounting/expenses/my-expenses'],
  });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      category: "",
      subcategory: "",
      description: "",
      vendor: "",
      amountBeforeVat: "",
      vatAmount: "",
      totalAmount: "",
      paymentMethod: "",
      receiptNumber: "",
      invoiceNumber: "",
      notes: "",
      taxMonth: String(new Date().getMonth() + 1),
      taxYear: String(new Date().getFullYear()),
    },
  });

  const submitExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      return await apiRequest("/api/accounting/expenses/employee-submit", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "✅ Expense Submitted",
        description: "Your expense has been submitted for approval. Nir and Ido will review it shortly.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/expenses"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error submitting expense",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ExpenseFormData) => {
    setIsSubmitting(true);
    await submitExpenseMutation.mutateAsync(data);
    setIsSubmitting(false);
  };

  const calculateVAT = () => {
    const amountBeforeVat = parseFloat(form.getValues("amountBeforeVat") || "0");
    if (amountBeforeVat > 0) {
      const vatAmount = Math.round(amountBeforeVat * 0.18 * 100) / 100;
      const totalAmount = Math.round((amountBeforeVat + vatAmount) * 100) / 100;
      form.setValue("vatAmount", String(vatAmount));
      form.setValue("totalAmount", String(totalAmount));
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-light text-black dark:text-white mb-4 tracking-tight">
            PetWash™ Expense Center
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm uppercase tracking-widest">
            7-Star Employee Expense Management
          </p>
        </div>

        <Card className="border border-gray-200 dark:border-gray-800 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(255,255,255,0.05)] backdrop-blur-xl bg-white/95 dark:bg-black/95">
          <CardHeader className="border-b border-gray-100 dark:border-gray-900 bg-gradient-to-b from-white to-gray-50/50 dark:from-black dark:to-gray-900/50 rounded-t-lg p-8">
            <CardTitle className="text-2xl font-light text-black dark:text-white tracking-wide">Submit New Expense</CardTitle>
            <CardDescription className="text-gray-500 dark:text-gray-400 mt-2">
              Fill in the expense details below. Each expense is tracked with cryptographic audit signatures for 7-year legal compliance.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 md:p-12">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem data-testid="form-item-category">
                        <FormLabel className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">Expense Category *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category" className="h-14 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white hover:border-black dark:hover:border-white transition-all duration-200">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map((cat) => (
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

                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem data-testid="form-item-payment">
                        <FormLabel className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">Payment Method *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-payment" className="h-14 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white hover:border-black dark:hover:border-white transition-all duration-200">
                              <SelectValue placeholder="How was this paid?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PAYMENT_METHODS.map((method) => (
                              <SelectItem key={method.value} value={method.value}>
                                {method.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="vendor"
                  render={({ field }) => (
                    <FormItem data-testid="form-item-vendor">
                      <FormLabel className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">Vendor/Supplier Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-vendor"
                          placeholder="e.g., Paz Gas Station, Dell Technologies, Hotel Dan..."
                          className="h-14 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white placeholder:text-gray-400 hover:border-black dark:hover:border-white focus:border-black dark:focus:border-white transition-all duration-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem data-testid="form-item-description">
                      <FormLabel className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">Detailed Description *</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          data-testid="textarea-description"
                          placeholder="Provide full details: purpose, date, location, who attended (if meal), project/client name..."
                          className="min-h-28 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white placeholder:text-gray-400 hover:border-black dark:hover:border-white focus:border-black dark:focus:border-white transition-all duration-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="amountBeforeVat"
                    render={({ field }) => (
                      <FormItem data-testid="form-item-amount-before-vat">
                        <FormLabel className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">Amount Before VAT *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-amount-before-vat"
                            type="number"
                            step="0.01"
                            placeholder="₪0.00"
                            className="h-14 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white placeholder:text-gray-400 hover:border-black dark:hover:border-white focus:border-black dark:focus:border-white transition-all duration-200"
                            onBlur={calculateVAT}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vatAmount"
                    render={({ field }) => (
                      <FormItem data-testid="form-item-vat-amount">
                        <FormLabel className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">VAT Amount (18%)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-vat-amount"
                            type="number"
                            step="0.01"
                            placeholder="Auto-calculated"
                            className="h-14 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400"
                            readOnly
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="totalAmount"
                    render={({ field }) => (
                      <FormItem data-testid="form-item-total-amount">
                        <FormLabel className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">Total Amount *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-total-amount"
                            type="number"
                            step="0.01"
                            placeholder="₪0.00"
                            className="h-14 border border-black dark:border-white rounded-lg bg-white dark:bg-black text-black dark:text-white placeholder:text-gray-400 font-semibold text-lg hover:border-black dark:hover:border-white focus:border-black dark:focus:border-white transition-all duration-200"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="receiptNumber"
                    render={({ field }) => (
                      <FormItem data-testid="form-item-receipt">
                        <FormLabel>Receipt Number</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-receipt-number"
                            placeholder="Optional"
                            className="h-12 border-2"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                      <FormItem data-testid="form-item-invoice">
                        <FormLabel>Invoice Number</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-invoice-number"
                            placeholder="Optional"
                            className="h-12 border-2"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="taxMonth"
                    render={({ field }) => (
                      <FormItem data-testid="form-item-tax-month">
                        <FormLabel>Tax Month *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tax-month" className="h-12 border-2">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                              <SelectItem key={month} value={String(month)}>
                                {new Date(2025, month - 1, 1).toLocaleDateString("en-US", { month: "long" })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem data-testid="form-item-notes">
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          data-testid="textarea-notes"
                          placeholder="Any additional information..."
                          className="border-2"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4 pt-8 border-t border-gray-200 dark:border-gray-800 mt-8">
                  <Button
                    type="submit"
                    data-testid="button-submit-expense"
                    className="flex-1 h-16 text-base font-medium tracking-wide uppercase bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 shadow-[0_4px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.1)] transition-all duration-200 rounded-lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Check className="mr-3 h-5 w-5" />
                        Submit Expense
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 tracking-wide">
            Your supervisor will receive WhatsApp notification • Cryptographic audit signature applied
          </p>
        </div>
      </div>
    </div>
  );
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="bg-white dark:bg-black text-black dark:text-white border-2">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "approved":
      return (
        <Badge variant="outline" className="bg-white dark:bg-black text-black dark:text-white border-2">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="outline" className="bg-white dark:bg-black text-black dark:text-white border-2">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return null;
  }
};
