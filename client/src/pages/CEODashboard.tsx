import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/apiConfig";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Crown, Gift, Send, Sparkles, Shield } from "lucide-react";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { routeGuard } from "@/lib/auth-guardian-2025";
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { useLocation } from 'wouter';

export default function CEODashboard() {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState('100');
  const [message, setMessage] = useState('');
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // 2FA state
  const [requestId, setRequestId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeExpiry, setCodeExpiry] = useState<number | null>(null);

  const isCEO = user?.email === 'nirhadad1@gmail.com' || user?.email === 'nir.h@petwash.co.il';

  // Auth Guardian route protection
  useEffect(() => {
    if (user) {
      routeGuard({
        adminOnly: true,
        onDeny: () => {
          setLocation('/');
        }
      });
    }
  }, [user, setLocation]);

  // Step 1: Request 2FA code
  const handleRequestCode = async () => {
    if (!recipientEmail || !recipientName || !amount) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsRequestingCode(true);

    try {
      const response = await fetch(getApiUrl('/api/admin/ceo/request-voucher'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientEmail,
          recipientName,
          amount: parseFloat(amount),
          message: message || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to request verification code');
      }

      const data = await response.json();

      setRequestId(data.requestId);
      setCodeExpiry(Date.now() + (data.expiresIn * 1000));

      toast({
        title: "📱 Security Code Sent!",
        description: "Check your mobile phone (+972 549 833 355) for the 6-digit verification code",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send code",
        variant: "destructive"
      });
    } finally {
      setIsRequestingCode(false);
    }
  };

  // Step 2: Verify code and issue voucher
  const handleVerifyAndIssue = async () => {
    if (!requestId || !verificationCode) {
      toast({
        title: "Missing Code",
        description: "Please enter the 6-digit verification code",
        variant: "destructive"
      });
      return;
    }

    setIsVerifying(true);

    try {
      const response = await fetch(getApiUrl('/api/admin/ceo/issue-free-voucher'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          requestId,
          verificationCode
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Invalid verification code');
      }

      const data = await response.json();

      toast({
        title: "✅ Voucher Issued!",
        description: `₪${amount} gift card sent to ${recipientEmail}`,
      });

      // Reset form
      setRecipientEmail('');
      setRecipientName('');
      setAmount('100');
      setMessage('');
      setRequestId(null);
      setVerificationCode('');
      setCodeExpiry(null);
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Invalid code",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isCEO) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center">
        <div className="text-center px-6">
          <Crown className="w-16 h-16 mx-auto mb-4 text-[#D4AF37]" />
          <h1 className="text-2xl font-semibold mb-2">CEO Access Required</h1>
          <p className="text-black/55">This dashboard is only accessible to the CEO.</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell
      role="ceo"
      title="CEO Suite"
      subtitle="Welcome back, Nir Hadad — Founder &amp; CEO of PetWash™"
      actions={<Crown className="w-7 h-7 text-[#D4AF37]" />}
    >
      {/* Issue Complimentary Gift Card */}
      <div className="max-w-2xl mx-auto">
        <Card className="border-black/10 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <Gift className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <CardTitle className="text-black text-2xl">Issue Complimentary Gift Card</CardTitle>
                <CardDescription className="text-black/55">
                  Send a complimentary PetWash™ gift card to anyone.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="recipientEmail" className="text-black">Recipient Email *</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="mt-1"
                  data-testid="input-recipient-email"
                />
              </div>

              <div>
                <Label htmlFor="recipientName" className="text-black">Recipient Name *</Label>
                <Input
                  id="recipientName"
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="John Smith"
                  className="mt-1"
                  data-testid="input-recipient-name"
                />
              </div>

              <div>
                <Label htmlFor="amount" className="text-black">Amount (₪) *</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100"
                  className="mt-1"
                  data-testid="input-voucher-amount"
                />
              </div>

              <div>
                <Label htmlFor="message" className="text-black">Personal Message (Optional)</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a personal message..."
                  rows={4}
                  className="mt-1 resize-none"
                  data-testid="input-personal-message"
                />
              </div>
            </div>

            {/* Step 1: Request verification code */}
            {!requestId && (
              <Button
                onClick={handleRequestCode}
                disabled={isRequestingCode}
                className="w-full h-12 text-base font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
                data-testid="button-request-code"
              >
                {isRequestingCode ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5 mr-2" />
                    Request Security Code
                  </>
                )}
              </Button>
            )}

            {/* Step 2: Enter verification code and issue */}
            {requestId && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-emerald-700 mt-0.5" />
                  <div className="text-sm text-emerald-900">
                    <p className="font-semibold mb-1">🔐 2FA Required</p>
                    <p className="text-emerald-800">
                      Check your mobile phone (+972 549 833 355) for a 6-digit security code.
                      This extra layer protects against unauthorized access.
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="verificationCode" className="text-black">6-Digit Verification Code *</Label>
                  <Input
                    id="verificationCode"
                    type="text"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="mt-1 text-center text-2xl font-mono tracking-widest"
                    data-testid="input-verification-code"
                  />
                </div>

                <Button
                  onClick={handleVerifyAndIssue}
                  disabled={isVerifying || verificationCode.length !== 6}
                  className="w-full h-12 text-base font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
                  data-testid="button-verify-issue"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Verify &amp; Issue Gift Card
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="bg-black/[0.03] border border-black/10 rounded-lg p-4 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#D4AF37] mt-0.5" />
              <div className="text-sm text-black/70">
                <p className="font-semibold mb-1 text-black">🔒 Enhanced Security</p>
                <p>
                  Every complimentary voucher requires mobile 2FA verification sent to your phone.
                  This prevents unauthorized issuance even if your account is compromised.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
