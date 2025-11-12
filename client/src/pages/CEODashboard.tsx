import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Crown, Gift, Send, Sparkles, Shield } from "lucide-react";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { routeGuard } from "@/lib/auth-guardian-2025";

export default function CEODashboard() {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
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
          window.location.href = '/';
        }
      });
    }
  }, [user]);

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
      const response = await fetch('/api/admin/ceo/request-voucher', {
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
      const response = await fetch('/api/admin/ceo/issue-free-voucher', {
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
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Crown className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
          <h1 className="text-2xl font-bold mb-2">CEO Access Required</h1>
          <p className="text-gray-400">This dashboard is only accessible to the CEO</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Premium Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-yellow-600/20 via-yellow-600/5 to-transparent blur-3xl animate-float"></div>
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-purple-600/20 via-purple-600/5 to-transparent blur-3xl animate-float-delayed"></div>
        <div className="absolute bottom-0 left-1/2 w-[700px] h-[700px] bg-gradient-radial from-pink-600/20 via-pink-600/5 to-transparent blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px]"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Crown className="w-12 h-12 text-yellow-500" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              CEO Dashboard
            </h1>
          </div>
          <p className="text-gray-400">Welcome back, Nir Hadad - Founder & CEO of PetWash™</p>
        </div>

        {/* Issue Free Voucher Card */}
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white/5 backdrop-blur-xl border-white/20 shadow-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-purple-600">
                  <Gift className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-white text-2xl">Issue Complimentary Gift Card</CardTitle>
                  <CardDescription className="text-gray-400">
                    Send free PetWash™ gift cards to anyone
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="recipientEmail" className="text-white">Recipient Email *</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                    data-testid="input-recipient-email"
                  />
                </div>

                <div>
                  <Label htmlFor="recipientName" className="text-white">Recipient Name *</Label>
                  <Input
                    id="recipientName"
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="John Smith"
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                    data-testid="input-recipient-name"
                  />
                </div>

                <div>
                  <Label htmlFor="amount" className="text-white">Amount (₪) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100"
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                    data-testid="input-voucher-amount"
                  />
                </div>

                <div>
                  <Label htmlFor="message" className="text-white">Personal Message (Optional)</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a personal message..."
                    rows={4}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 resize-none"
                    data-testid="input-personal-message"
                  />
                </div>
              </div>

              {/* Step 1: Request verification code */}
              {!requestId && (
                <Button
                  onClick={handleRequestCode}
                  disabled={isRequestingCode}
                  className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-yellow-500 via-purple-600 to-pink-600 hover:opacity-90 transition-opacity"
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
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
                    <Shield className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div className="text-sm text-yellow-200">
                      <p className="font-semibold mb-1">🔐 2FA Required</p>
                      <p className="text-yellow-300">
                        Check your mobile phone (+972 549 833 355) for a 6-digit security code.
                        This extra layer protects against unauthorized access.
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="verificationCode" className="text-white">6-Digit Verification Code *</Label>
                    <Input
                      id="verificationCode"
                      type="text"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 text-center text-2xl font-mono tracking-widest"
                      data-testid="input-verification-code"
                    />
                  </div>

                  <Button
                    onClick={handleVerifyAndIssue}
                    disabled={isVerifying || verificationCode.length !== 6}
                    className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-green-500 via-emerald-600 to-teal-600 hover:opacity-90 transition-opacity"
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
                        Verify & Issue Gift Card
                      </>
                    )}
                  </Button>
                </div>
              )}

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-400 mt-0.5" />
                <div className="text-sm text-purple-200">
                  <p className="font-semibold mb-1">🔒 Enhanced Security</p>
                  <p className="text-purple-300">
                    Every free voucher requires mobile 2FA verification sent to your phone. 
                    This prevents unauthorized issuance even if your account is compromised.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
