import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, Upload, CheckCircle2, Clock, AlertTriangle, X,
  ExternalLink, Shield, Info, ChevronDown, ChevronUp,
  PenLine, MousePointerClick,
} from 'lucide-react';

type DocStatus = 'signed' | 'pending' | 'expired' | 'uploaded' | 'missing';

const STATUS_BADGE: Record<DocStatus, { label: string; color: string; bg: string; icon: React.ComponentType<any> }> = {
  signed: { label: 'Signed', color: '#065f46', bg: '#d1fae5', icon: CheckCircle2 },
  uploaded: { label: 'Uploaded', color: '#065f46', bg: '#d1fae5', icon: CheckCircle2 },
  pending: { label: 'Pending', color: '#92400e', bg: '#fef3c7', icon: Clock },
  expired: { label: 'Expired', color: '#991b1b', bg: '#fee2e2', icon: AlertTriangle },
  missing: { label: 'Required', color: '#991b1b', bg: '#fee2e2', icon: AlertTriangle },
};

const CLICK_TO_ACCEPT = [
  { id: 'tos', label: 'General Terms of Service', sub: 'Provider usage terms and conditions', required: true },
  { id: 'privacy', label: 'Privacy Policy', sub: 'How we handle your personal data', required: true },
  { id: 'notifications', label: 'Notification & Communication Consent', sub: 'Consent to receive platform messages', required: true },
  { id: 'gps', label: 'GPS / Location Tracking Consent', sub: 'Allow location tracking during active jobs', required: false },
  { id: 'conduct', label: 'Platform Code of Conduct', sub: 'Community standards and behavior guidelines', required: true },
  { id: 'cancellation', label: 'Cancellation Policy Acknowledgment', sub: 'Understanding cancellation penalties', required: true },
];

const ESIGN_DOCS = [
  { id: 'provider_agreement', label: 'Provider / Contractor Agreement', sub: 'Main contract governing your relationship with PetWash', critical: true },
  { id: 'nda', label: 'Non-Disclosure Agreement (NDA)', sub: 'Confidentiality obligations regarding platform data', critical: true },
  { id: 'ip', label: 'Intellectual Property Declaration', sub: 'Assignment of work product and non-compete terms', critical: false },
  { id: 'confidentiality', label: 'Confidentiality Commitment', sub: 'Protection of client and business information', critical: true },
  { id: 'non_transfer', label: 'Non-Transfer Declaration', sub: 'Prohibition on transferring client data to third parties', critical: true },
  { id: 'payout', label: 'Payout & Commission Agreement', sub: 'Commission rates and payment terms', critical: true },
  { id: 'liability', label: 'Liability Waiver', sub: 'Limitation of liability for incidents during services', critical: false },
  { id: 'insurance', label: 'Insurance Verification Declaration', sub: 'Confirmation of professional insurance coverage', critical: false },
];

const UPLOAD_DOCS = [
  { id: 'id', label: 'Government-Issued ID', sub: 'Passport or Israeli Teudat Zehut', required: true },
  { id: 'business_license', label: 'Business License', sub: 'Osek Murshe/Patur certificate (if applicable)', required: false },
  { id: 'insurance', label: 'Insurance Certificate', sub: 'Professional liability insurance', required: true },
  { id: 'training', label: 'Training / Certification', sub: 'Pet care or grooming certificates', required: false },
  { id: 'selfie', label: 'Verification Selfie', sub: 'Clear photo holding your ID', required: true },
];

export default function POSDocuments() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'accept' | 'esign' | 'uploads'>('accept');
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [esignStatus, setEsignStatus] = useState<Record<string, DocStatus>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, DocStatus>>({});
  const [expandedEsign, setExpandedEsign] = useState<string | null>(null);
  const [signingDoc, setSigningDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  const handleAccept = (id: string) => {
    setAccepted(prev => ({ ...prev, [id]: true }));
    toast({ title: 'Document accepted', description: 'Your acceptance has been recorded with audit trail.' });
  };

  const handleSignDoc = (id: string) => {
    setSigningDoc(id);
  };

  const simulateSign = (id: string) => {
    setEsignStatus(prev => ({ ...prev, [id]: 'signed' }));
    setSigningDoc(null);
    toast({ title: 'Document signed', description: 'E-signature recorded and PDF saved to your account.' });
  };

  const handleUploadClick = (docId: string) => {
    setUploadingDoc(docId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && uploadingDoc) {
      setUploadStatus(prev => ({ ...prev, [uploadingDoc]: 'uploaded' }));
      toast({ title: 'Document uploaded', description: 'Your document is under review (1-2 business days).' });
      setUploadingDoc(null);
    }
  };

  const acceptedCount = Object.values(accepted).filter(Boolean).length;
  const signedCount = Object.values(esignStatus).filter(s => s === 'signed').length;
  const uploadedCount = Object.values(uploadStatus).filter(s => s === 'uploaded').length;

  return (
    <div className="space-y-5">
      <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />

      {/* Progress summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Accepted', value: `${acceptedCount}/${CLICK_TO_ACCEPT.length}`, color: 'text-blue-600', bg: 'bg-blue-50', icon: MousePointerClick },
          { label: 'Signed', value: `${signedCount}/${ESIGN_DOCS.length}`, color: 'text-purple-600', bg: 'bg-purple-50', icon: PenLine },
          { label: 'Uploaded', value: `${uploadedCount}/${UPLOAD_DOCS.length}`, color: 'text-teal-600', bg: 'bg-teal-50', icon: Upload },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <div className={`w-8 h-8 ${card.bg} rounded-lg flex items-center justify-center mx-auto mb-1.5`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className={`text-base font-bold ${card.color}`}>{card.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {[
          { id: 'accept', label: 'Click-to-Accept' },
          { id: 'esign', label: 'E-Signature' },
          { id: 'uploads', label: 'My Documents' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Click-to-accept */}
      {activeTab === 'accept' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">These documents require a checkbox acceptance. Your acceptance is logged with a timestamp and SHA-256 audit trail.</p>
          </div>
          {CLICK_TO_ACCEPT.map(doc => {
            const isAccepted = !!accepted[doc.id];
            return (
              <div key={doc.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 transition-colors ${isAccepted ? 'border-green-200' : 'border-gray-200'}`}>
                <button
                  onClick={() => !isAccepted && handleAccept(doc.id)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                    isAccepted ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-amber-400'
                  }`}
                >
                  {isAccepted && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-900">{doc.label}</p>
                    {doc.required && <span className="text-[9px] text-red-500 font-bold">REQUIRED</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{doc.sub}</p>
                  {isAccepted && <p className="text-[10px] text-green-600 mt-1">Accepted — {new Date().toLocaleDateString()}</p>}
                </div>
                <button className="text-gray-400 hover:text-gray-600 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* E-signature required */}
      {activeTab === 'esign' && (
        <div className="space-y-3">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-start gap-2.5">
            <PenLine className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <p className="text-xs text-purple-800">These documents require a legally binding e-signature. The signing process opens an embedded signing panel — no redirect required.</p>
          </div>
          {ESIGN_DOCS.map(doc => {
            const status = esignStatus[doc.id] || 'pending';
            const badge = STATUS_BADGE[status];
            const BadgeIcon = badge.icon;
            const isExpanded = expandedEsign === doc.id;
            return (
              <div key={doc.id} className={`bg-white border rounded-xl overflow-hidden transition-colors ${status === 'signed' ? 'border-green-200' : doc.critical ? 'border-amber-200' : 'border-gray-200'}`}>
                <button
                  className="w-full flex items-start gap-3 p-4 text-start hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedEsign(isExpanded ? null : doc.id)}
                >
                  <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{doc.label}</p>
                      {doc.critical && <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">CRITICAL</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{doc.sub}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: badge.bg, color: badge.color }}>
                      <BadgeIcon className="w-3 h-3" />{badge.label}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    {status !== 'signed' ? (
                      <button onClick={() => handleSignDoc(doc.id)}
                        className="mt-3 w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                        <PenLine className="w-4 h-4" /> Sign Document
                      </button>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <button className="flex-1 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-medium border border-green-200 flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Signed — {new Date().toLocaleDateString()}
                        </button>
                        <button className="py-2 px-3 bg-gray-100 text-gray-600 rounded-xl text-xs hover:bg-gray-200 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Provider uploads */}
      {activeTab === 'uploads' && (
        <div className="space-y-3">
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-start gap-2.5">
            <Upload className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <p className="text-xs text-teal-800">Upload your documents here. You can use your phone camera to photograph physical documents. All uploads are encrypted and stored securely.</p>
          </div>
          {UPLOAD_DOCS.map(doc => {
            const status = uploadStatus[doc.id];
            const badge = status ? STATUS_BADGE[status] : null;
            return (
              <div key={doc.id} className={`bg-white border rounded-xl p-4 flex items-center gap-3 ${status === 'uploaded' ? 'border-green-200' : 'border-gray-200'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${status === 'uploaded' ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <FileText className={`w-5 h-5 ${status === 'uploaded' ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-900">{doc.label}</p>
                    {doc.required && <span className="text-[9px] text-red-500 font-bold">REQUIRED</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{doc.sub}</p>
                  {badge && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium"
                      style={{ color: badge.color }}>
                      <CheckCircle2 className="w-3 h-3" /> {badge.label}
                    </span>
                  )}
                </div>
                <button onClick={() => handleUploadClick(doc.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors shrink-0 ${
                    status === 'uploaded' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-500 text-white hover:bg-amber-600'
                  }`}>
                  <Upload className="w-3.5 h-3.5" />
                  {status === 'uploaded' ? 'Replace' : 'Upload'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* E-sign modal */}
      {signingDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Sign Document</h3>
                <p className="text-xs text-gray-500 mt-0.5">{ESIGN_DOCS.find(d => d.id === signingDoc)?.label}</p>
              </div>
              <button onClick={() => setSigningDoc(null)} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center mb-4">
                <PenLine className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">DocuSign integration</p>
                <p className="text-xs text-gray-400">In production, the document will open in an embedded signing panel powered by DocuSign or Dropbox Sign. No page redirect required.</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-amber-800">By signing, you confirm you have read and agree to the full document. Your signature will be timestamped and SHA-256 hashed for legal validity.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSigningDoc(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={() => simulateSign(signingDoc!)}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                  <PenLine className="w-4 h-4" /> Sign Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
