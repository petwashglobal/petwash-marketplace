import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Upload, Check, Shield, Clock, Download, Mail, AlertCircle, Loader2
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface DigitalSignature {
  id: number;
  signerName: string;
  signerTitle: string;
  signatureImageUrl: string;
  isActive: boolean;
  createdAt: string;
}

interface SignedDocument {
  id: number;
  documentType: string;
  documentTitle: string;
  signedBy: string;
  signedDate: string;
  status: string;
  documentHash: string;
}

export default function DocumentSigning() {
  const { toast } = useToast();
  const { user: firebaseUser } = useFirebaseAuth();
  const queryClient = useQueryClient();

  // Form state
  const [documentType, setDocumentType] = useState<string>('contract');
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentDescription, setDocumentDescription] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');

  // Fetch user's signatures
  const { data: signaturesData, isLoading: signaturesLoading } = useQuery<{ signatures: DigitalSignature[] }>({
    queryKey: ['/api/signatures'],
    enabled: !!firebaseUser,
  });

  // Fetch signed documents
  const { data: documentsData } = useQuery<{ documents: SignedDocument[] }>({
    queryKey: ['/api/signatures/documents'],
    enabled: !!firebaseUser,
  });

  const activeSignature = signaturesData?.signatures?.find(s => s.isActive);

  // Sign document mutation
  const signDocumentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/signatures/documents/sign', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/signatures/documents'] });
      toast({
        title: '✅ Document Signed Successfully',
        description: 'Your signature has been applied and the document is ready.',
      });
      // Reset form
      setDocumentTitle('');
      setDocumentDescription('');
      setRecipientName('');
      setRecipientEmail('');
      setCcEmails('');
      setDocumentUrl('');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Signing Failed',
        description: error.message,
      });
    },
  });

  const handleSignDocument = (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeSignature) {
      toast({
        variant: 'destructive',
        title: 'No Signature Found',
        description: 'Please upload your digital signature first.',
      });
      return;
    }

    signDocumentMutation.mutate({
      signatureId: activeSignature.id,
      documentType,
      documentTitle,
      documentDescription,
      originalDocumentUrl: documentUrl,
      signedDocumentUrl: documentUrl, // In production, this would be processed with signature overlay
      signedBy: activeSignature.signerName,
      signedByTitle: activeSignature.signerTitle,
      recipientName,
      recipientEmail,
      ccEmails: ccEmails || undefined,
      signedDate: new Date().toISOString(),
      emailSentTo: recipientEmail,
    });
  };

  return (
    <Layout>
      <div className="min-h-screen bg-white dark:bg-black p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-light text-black dark:text-white mb-4 tracking-tight">
              PetWash™ E-Signature
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm uppercase tracking-widest">
              Enterprise Digital Signature System
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Signature Status */}
            <div className="lg:col-span-1">
              <Card className="border border-gray-200 dark:border-gray-800 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(255,255,255,0.05)] backdrop-blur-xl bg-white/95 dark:bg-black/95">
                <CardHeader className="border-b border-gray-100 dark:border-gray-900">
                  <CardTitle className="text-xl font-light tracking-wide flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Your Signature
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {signaturesLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                    </div>
                  ) : activeSignature ? (
                    <div className="space-y-4">
                      <img
                        src={activeSignature.signatureImageUrl}
                        alt="Digital Signature"
                        className="w-full h-32 object-contain bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4"
                      />
                      <div>
                        <p className="text-sm font-medium text-black dark:text-white">
                          {activeSignature.signerName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {activeSignature.signerTitle}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        <Check className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        No digital signature found
                      </p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200">
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Signature
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Upload Your Digital Signature</DialogTitle>
                            <DialogDescription>
                              Contact your system administrator to upload your signature image.
                            </DialogDescription>
                          </DialogHeader>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Document Signing Form */}
            <div className="lg:col-span-2">
              <Card className="border border-gray-200 dark:border-gray-800 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(255,255,255,0.05)] backdrop-blur-xl bg-white/95 dark:bg-black/95">
                <CardHeader className="border-b border-gray-100 dark:border-gray-900">
                  <CardTitle className="text-xl font-light tracking-wide flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Sign New Document
                  </CardTitle>
                  <CardDescription className="text-gray-500 dark:text-gray-400 mt-2">
                    Apply your digital signature to legal documents with cryptographic audit trail
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <form onSubmit={handleSignDocument} className="space-y-6">
                    <div>
                      <Label className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">
                        Document Type
                      </Label>
                      <Select value={documentType} onValueChange={setDocumentType}>
                        <SelectTrigger className="h-14 mt-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contract">Contract / Agreement</SelectItem>
                          <SelectItem value="invoice">Invoice / Receipt</SelectItem>
                          <SelectItem value="authorization">Authorization Letter</SelectItem>
                          <SelectItem value="legal_notice">Legal Notice</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">
                        Document Title
                      </Label>
                      <Input
                        value={documentTitle}
                        onChange={(e) => setDocumentTitle(e.target.value)}
                        placeholder="e.g., Supplier Agreement - ABC Corp"
                        className="h-14 mt-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white"
                        required
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">
                        Description
                      </Label>
                      <Textarea
                        value={documentDescription}
                        onChange={(e) => setDocumentDescription(e.target.value)}
                        placeholder="Brief description of the document..."
                        className="min-h-24 mt-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">
                          Recipient Name
                        </Label>
                        <Input
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="John Doe"
                          className="h-14 mt-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">
                          Recipient Email
                        </Label>
                        <Input
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="john@example.com"
                          className="h-14 mt-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">
                        CC Emails (optional)
                      </Label>
                      <Input
                        value={ccEmails}
                        onChange={(e) => setCcEmails(e.target.value)}
                        placeholder="email1@example.com, email2@example.com"
                        className="h-14 mt-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium tracking-wide uppercase text-gray-700 dark:text-gray-300">
                        Document URL (Temporary - For Demo)
                      </Label>
                      <Input
                        value={documentUrl}
                        onChange={(e) => setDocumentUrl(e.target.value)}
                        placeholder="https://storage.googleapis.com/..."
                        className="h-14 mt-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white"
                        required
                      />
                    </div>

                    <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                      <Button
                        type="submit"
                        disabled={!activeSignature || signDocumentMutation.isPending}
                        className="w-full h-16 text-base font-medium tracking-wide uppercase bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 shadow-[0_4px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.1)] transition-all duration-200 rounded-lg"
                        data-testid="button-sign-document"
                      >
                        {signDocumentMutation.isPending ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                            Signing...
                          </>
                        ) : (
                          <>
                            <Check className="w-5 h-5 mr-3" />
                            Sign Document
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Recent Documents */}
          {documentsData?.documents && documentsData.documents.length > 0 && (
            <Card className="mt-8 border border-gray-200 dark:border-gray-800 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(255,255,255,0.05)] backdrop-blur-xl bg-white/95 dark:bg-black/95">
              <CardHeader className="border-b border-gray-100 dark:border-gray-900">
                <CardTitle className="text-xl font-light tracking-wide flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Recent Signed Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {documentsData.documents.slice(0, 10).map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-black dark:text-white">{doc.documentTitle}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Signed by {doc.signedBy} on {new Date(doc.signedDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {doc.documentType}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
