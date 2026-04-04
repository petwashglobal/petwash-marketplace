import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import {
  Shield, AlertTriangle, UserX, MapPin, Phone,
  Clock, CheckCircle2, ChevronRight, X, Info,
  Siren, BookOpen, Heart,
} from 'lucide-react';

const INCIDENT_TYPES = [
  'Aggressive or threatening behavior',
  'Property damage',
  'Pet injury during service',
  'Payment dispute',
  'No-show client',
  'Unsafe conditions at location',
  'Harassment',
  'Fraud or scam attempt',
  'Other',
];

export default function POSSafety() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'report' | 'block' | 'emergency' | 'guidelines'>('report');

  // Report state
  const [reportIncidentType, setReportIncidentType] = useState('');
  const [reportBookingRef, setReportBookingRef] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Block state
  const [blockSearch, setBlockSearch] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockedClients, setBlockedClients] = useState<{ name: string; reason: string; date: string }[]>([
    { name: 'Anonymous Client', reason: 'Threatening behavior', date: 'Feb 2026' }
  ]);
  const [blockAddress, setBlockAddress] = useState('');
  const [blockedAddresses, setBlockedAddresses] = useState<string[]>([]);

  // Safety settings
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [checkInEnabled, setCheckInEnabled] = useState(false);
  const [checkInDuration, setCheckInDuration] = useState('120');

  // Emergency contacts
  const [contacts, setContacts] = useState([
    { name: '', phone: '' },
    { name: '', phone: '' },
  ]);

  const handleReport = async () => {
    if (!reportIncidentType || !reportDescription) {
      toast({ title: 'Please fill in incident type and description', variant: 'destructive' }); return;
    }
    setReportSubmitting(true);
    await new Promise(r => setTimeout(r, 1200));
    setReportSubmitting(false);
    toast({ title: 'Report submitted', description: 'Our safety team will review your report within 24 hours.' });
    setReportIncidentType(''); setReportBookingRef(''); setReportDescription('');
  };

  const handleBlockClient = () => {
    if (!blockSearch) { toast({ title: 'Enter client name or ID', variant: 'destructive' }); return; }
    setBlockedClients(prev => [...prev, { name: blockSearch, reason: blockReason || 'Not specified', date: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }]);
    setBlockSearch(''); setBlockReason('');
    toast({ title: 'Client blocked', description: 'This client can no longer book with you.' });
  };

  const handleBlockAddress = () => {
    if (!blockAddress) return;
    setBlockedAddresses(prev => [...prev, blockAddress]);
    setBlockAddress('');
    toast({ title: 'Address blocked' });
  };

  const updateContact = (i: number, field: 'name' | 'phone', value: string) => {
    setContacts(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  const handleSafetySettings = () => {
    toast({ title: 'Safety settings saved' });
  };

  return (
    <div className="space-y-5">
      {/* Emergency banner */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
          <Siren className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-800">Emergency: Call 100 (Police) or 101 (Ambulance)</p>
          <p className="text-xs text-red-600 mt-0.5">Always call emergency services first in a life-threatening situation</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl p-1 gap-0.5 overflow-x-auto">
        {[
          { id: 'report', label: 'Report', icon: AlertTriangle },
          { id: 'block', label: 'Block', icon: UserX },
          { id: 'emergency', label: 'Emergency', icon: Phone },
          { id: 'guidelines', label: 'Guidelines', icon: BookOpen },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}>
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Report a client */}
      {activeTab === 'report' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">Reports are reviewed by our safety team within 24 hours. For immediate threats, call emergency services.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Incident Type *</label>
              <select value={reportIncidentType} onChange={e => setReportIncidentType(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400">
                <option value="">Select incident type...</option>
                {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Booking Reference (optional)</label>
              <input value={reportBookingRef} onChange={e => setReportBookingRef(e.target.value)}
                placeholder="e.g. #PW-2847"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400 font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Description *</label>
              <textarea value={reportDescription} onChange={e => setReportDescription(e.target.value)} rows={4}
                placeholder="Describe what happened in detail..."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400 resize-none" />
            </div>
            <button onClick={handleReport} disabled={reportSubmitting}
              className="w-full py-3 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {reportSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </div>
      )}

      {/* Block clients & addresses */}
      {activeTab === 'block' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <UserX className="w-4 h-4 text-red-500" /> Block a Client
            </h3>
            <input value={blockSearch} onChange={e => setBlockSearch(e.target.value)}
              placeholder="Client name or booking reference"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400" />
            <input value={blockReason} onChange={e => setBlockReason(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400" />
            <button onClick={handleBlockClient}
              className="w-full py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
              Block Client
            </button>
          </div>

          {blockedClients.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">Blocked Clients ({blockedClients.length})</p>
              </div>
              <div className="divide-y divide-gray-100">
                {blockedClients.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                      <UserX className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.reason} · {c.date}</p>
                    </div>
                    <button onClick={() => setBlockedClients(prev => prev.filter((_, idx) => idx !== i))}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" /> Block an Address
            </h3>
            <div className="flex gap-2">
              <input value={blockAddress} onChange={e => setBlockAddress(e.target.value)}
                placeholder="Enter address to block"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400" />
              <button onClick={handleBlockAddress} className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors">
                Block
              </button>
            </div>
            {blockedAddresses.length > 0 && (
              <div className="space-y-1.5">
                {blockedAddresses.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-orange-50 rounded-lg px-3 py-2">
                    <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="text-xs text-orange-800 flex-1 truncate">{a}</span>
                    <button onClick={() => setBlockedAddresses(prev => prev.filter((_, idx) => idx !== i))}>
                      <X className="w-3.5 h-3.5 text-orange-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Safety toggle */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Verified clients only</p>
              <p className="text-xs text-gray-500">Only accept bookings from ID-verified clients</p>
            </div>
            <Switch checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
          </div>
        </div>
      )}

      {/* Emergency contacts & check-in */}
      {activeTab === 'emergency' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" /> Emergency Contacts
            </h3>
            <p className="text-xs text-gray-500 mb-3">These contacts will be notified if you trigger an emergency alert during an active job.</p>
            <div className="space-y-3">
              {contacts.map((contact, i) => (
                <div key={i} className="space-y-2">
                  <p className="text-xs font-medium text-gray-600">Contact {i + 1}</p>
                  <div className="flex gap-2">
                    <input value={contact.name} onChange={e => updateContact(i, 'name', e.target.value)}
                      placeholder="Name"
                      className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400" />
                    <input value={contact.phone} onChange={e => updateContact(i, 'phone', e.target.value)}
                      placeholder="Phone"
                      type="tel"
                      className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Safety Check-in Timer</p>
                <p className="text-xs text-gray-500 mt-0.5">Platform alerts if you don't check in during active job</p>
              </div>
              <Switch checked={checkInEnabled} onCheckedChange={setCheckInEnabled} />
            </div>
            {checkInEnabled && (
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Alert after</label>
                <select value={checkInDuration} onChange={e => setCheckInDuration(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400">
                  {[['30', '30 minutes'], ['60', '1 hour'], ['120', '2 hours'], ['180', '3 hours']].map(([v, l]) => (
                    <option key={v} value={v}>{l} of no check-in</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button onClick={handleSafetySettings}
            className="w-full py-3 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors">
            Save Emergency Settings
          </button>
        </div>
      )}

      {/* Safety guidelines */}
      {activeTab === 'guidelines' && (
        <div className="space-y-3">
          {[
            {
              title: 'Before Every Job', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50',
              items: ['Verify client identity matches booking', 'Confirm pet details and any special needs', 'Check the service address before arrival', 'Ensure your emergency contacts are up to date']
            },
            {
              title: 'During the Job', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50',
              items: ['Always stay on the service platform chat', 'Take photos at start and end of service', 'Report any injuries or incidents immediately', 'Do not share personal contact details']
            },
            {
              title: 'If You Feel Unsafe', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50',
              items: ['Leave the situation immediately if threatened', 'Call 100 (Police) for immediate danger', 'Contact PetWash Safety team: safety@petwash.co.il', 'Document the incident with photos/notes']
            },
            {
              title: 'Pet Safety', icon: Heart, color: 'text-pink-600', bg: 'bg-pink-50',
              items: ['Report pet injuries to owner and platform immediately', 'Know the nearest 24h vet clinic in your area', 'Never leave a pet unattended in a vehicle', 'Follow the care instructions provided by the owner']
            },
          ].map(section => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className={`px-4 py-3 flex items-center gap-2 border-b border-gray-100 ${section.bg}`}>
                  <Icon className={`w-4 h-4 ${section.color}`} />
                  <p className="text-sm font-semibold text-gray-900">{section.title}</p>
                </div>
                <ul className="px-4 py-3 space-y-2">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0 mt-1.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
