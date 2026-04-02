import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Brain,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Calculator,
  Zap,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { useLocation } from 'wouter';

interface FinancialCheckResult {
  verdict: 'CLEAN' | 'SUSPICIOUS' | 'FRAUD_DETECTED';
  confidence: number;
  riskScore: number;
  reasoning: string;
  anomalies: string[];
  mathCheck: {
    vatCorrect: boolean;
    commissionCorrect: boolean;
    totalCorrect: boolean;
    details: string;
  };
  recommendation: string;
  timestamp: string;
}

export default function GeminiFinancialMonitor() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    transactionId: '',
    amount: '',
    vat: '',
    commission: '',
    total: '',
    customerId: '',
    providerId: '',
    serviceType: 'dog_wash',
    notes: '',
  });
  const [result, setResult] = useState<FinancialCheckResult | null>(null);

  const { mutate: runCheck, isPending } = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest('POST', '/api/admin/financial-check', data);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const vatAmount = form.amount ? (parseFloat(form.amount) * 0.18).toFixed(2) : '';
  const suggestedTotal = form.amount ? (parseFloat(form.amount) * 1.18).toFixed(2) : '';

  const verdictColor = {
    CLEAN: 'text-green-600 bg-green-50 border-green-200',
    SUSPICIOUS: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    FRAUD_DETECTED: 'text-red-600 bg-red-50 border-red-200',
  };

  const verdictIcon = {
    CLEAN: <CheckCircle2 className="w-6 h-6 text-green-600" />,
    SUSPICIOUS: <AlertTriangle className="w-6 h-6 text-yellow-600" />,
    FRAUD_DETECTED: <XCircle className="w-6 h-6 text-red-600" />,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6" dir="ltr">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/admin/dashboard')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Gemini Financial Safety Monitor</h1>
                <p className="text-purple-300 text-sm">AI-powered transaction validation · VAT 18% · ILS</p>
              </div>
            </div>
          </div>
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 gap-1">
            <Zap className="w-3 h-3" />
            Gemini 2.5 Flash
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-purple-400" />
                Transaction Details
              </CardTitle>
              <CardDescription className="text-purple-300">
                Enter transaction data for Gemini AI analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-purple-200 text-xs">Transaction ID</Label>
                  <Input
                    value={form.transactionId}
                    onChange={e => setForm(f => ({ ...f, transactionId: e.target.value }))}
                    placeholder="TXN-001"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-purple-400"
                    data-testid="input-txn-id"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-purple-200 text-xs">Service Type</Label>
                  <select
                    value={form.serviceType}
                    onChange={e => setForm(f => ({ ...f, serviceType: e.target.value }))}
                    className="w-full h-9 rounded-md bg-white/10 border border-white/20 text-white text-sm px-3 focus:border-purple-400 outline-none"
                    data-testid="select-service-type"
                  >
                    <option value="dog_wash" className="bg-slate-800">Dog Wash</option>
                    <option value="dog_walking" className="bg-slate-800">Dog Walking</option>
                    <option value="pet_sitting" className="bg-slate-800">Pet Sitting</option>
                    <option value="grooming" className="bg-slate-800">Grooming</option>
                    <option value="k9000" className="bg-slate-800">K9000 Station</option>
                    <option value="plush_lab" className="bg-slate-800">Plush Lab</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-purple-200 text-xs">Customer ID</Label>
                  <Input
                    value={form.customerId}
                    onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                    placeholder="usr_123"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-purple-400"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-purple-200 text-xs">Provider ID</Label>
                  <Input
                    value={form.providerId}
                    onChange={e => setForm(f => ({ ...f, providerId: e.target.value }))}
                    placeholder="prv_456"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-purple-400"
                  />
                </div>
              </div>

              <Separator className="bg-white/10" />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-purple-200 text-xs">Base Amount (ILS)</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="100.00"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-purple-400"
                    data-testid="input-amount"
                  />
                  {form.amount && (
                    <p className="text-xs text-purple-400">Suggested VAT (18%): ₪{vatAmount}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-purple-200 text-xs">VAT Charged (ILS)</Label>
                  <Input
                    type="number"
                    value={form.vat}
                    onChange={e => setForm(f => ({ ...f, vat: e.target.value }))}
                    placeholder="18.00"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-purple-400"
                    data-testid="input-vat"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-purple-200 text-xs">Commission (ILS)</Label>
                  <Input
                    type="number"
                    value={form.commission}
                    onChange={e => setForm(f => ({ ...f, commission: e.target.value }))}
                    placeholder="15.00"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-purple-400"
                    data-testid="input-commission"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-purple-200 text-xs">Total Charged (ILS)</Label>
                  <Input
                    type="number"
                    value={form.total}
                    onChange={e => setForm(f => ({ ...f, total: e.target.value }))}
                    placeholder="118.00"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-purple-400"
                    data-testid="input-total"
                  />
                  {form.amount && (
                    <p className="text-xs text-purple-400">Expected total: ₪{suggestedTotal}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-purple-200 text-xs">Additional Notes (optional)</Label>
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Describe anything unusual about this transaction..."
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-purple-400 resize-none"
                  rows={3}
                />
              </div>

              <Button
                onClick={() => runCheck(form)}
                disabled={isPending || !form.amount || !form.total}
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-medium shadow-lg"
                data-testid="button-run-check"
              >
                {isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Analyzing with Gemini AI...</>
                ) : (
                  <><Brain className="w-4 h-4 mr-2" />Run Financial Safety Check</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="space-y-4">
            {!result && !isPending && (
              <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                <CardContent className="pt-10 pb-10 text-center">
                  <ShieldAlert className="w-12 h-12 text-purple-400 mx-auto mb-4 opacity-50" />
                  <p className="text-purple-300 font-medium">Ready for Analysis</p>
                  <p className="text-purple-400 text-sm mt-1">
                    Enter transaction details and click Run to validate with Gemini AI
                  </p>
                </CardContent>
              </Card>
            )}

            {isPending && (
              <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                <CardContent className="pt-10 pb-10 text-center">
                  <Brain className="w-12 h-12 text-purple-400 mx-auto mb-4 animate-pulse" />
                  <p className="text-white font-medium">Gemini AI Processing...</p>
                  <p className="text-purple-300 text-sm mt-1">Verifying VAT math · Checking anomalies · Assessing fraud risk</p>
                </CardContent>
              </Card>
            )}

            {result && (
              <>
                <Alert className={`border ${verdictColor[result.verdict]}`}>
                  <div className="flex items-start gap-3">
                    {verdictIcon[result.verdict]}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg">{result.verdict.replace('_', ' ')}</span>
                        <Badge variant="outline" className="text-xs">
                          {result.confidence}% confidence
                        </Badge>
                      </div>
                      <AlertDescription className="text-sm">{result.reasoning}</AlertDescription>
                    </div>
                  </div>
                </Alert>

                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                      Risk Score: {result.riskScore}/100
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="w-full bg-white/10 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          result.riskScore < 30 ? 'bg-green-500' :
                          result.riskScore < 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${result.riskScore}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className={`p-2 rounded-lg text-xs font-medium ${result.mathCheck.vatCorrect ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {result.mathCheck.vatCorrect ? '✓' : '✗'} VAT 18%
                      </div>
                      <div className={`p-2 rounded-lg text-xs font-medium ${result.mathCheck.commissionCorrect ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {result.mathCheck.commissionCorrect ? '✓' : '✗'} Commission
                      </div>
                      <div className={`p-2 rounded-lg text-xs font-medium ${result.mathCheck.totalCorrect ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {result.mathCheck.totalCorrect ? '✓' : '✗'} Total
                      </div>
                    </div>

                    <p className="text-purple-300 text-xs">{result.mathCheck.details}</p>
                  </CardContent>
                </Card>

                {result.anomalies.length > 0 && (
                  <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        Anomalies Detected ({result.anomalies.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {result.anomalies.map((a, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-yellow-400 mt-0.5">⚠</span>
                          <span className="text-yellow-200">{a}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm">AI Recommendation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-purple-200 text-sm">{result.recommendation}</p>
                    <p className="text-purple-400 text-xs mt-2">Analysis at {new Date(result.timestamp).toLocaleTimeString()}</p>
                  </CardContent>
                </Card>

                <Button
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10"
                  onClick={() => { setResult(null); setForm(f => ({ ...f, transactionId: '', amount: '', vat: '', commission: '', total: '' })); }}
                  data-testid="button-new-check"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  New Check
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
