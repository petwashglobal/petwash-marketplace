import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import {
  Settings, Bell, Shield, Dog, Power, Zap, Moon, Sun,
  UserCheck, UserX, Navigation, Clock, Phone, MessageSquare,
  CreditCard, FileText, Save,
} from 'lucide-react';

export default function POSSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'operational' | 'notifications' | 'privacy' | 'pets'>('operational');

  // Operational
  const [autoAccept, setAutoAccept] = useState(false);
  const [manualApproval, setManualApproval] = useState(true);
  const [instantBooking, setInstantBooking] = useState(true);
  const [weekendJobs, setWeekendJobs] = useState(false);
  const [nightJobs, setNightJobs] = useState(false);
  const [newClients, setNewClients] = useState(true);
  const [returningOnly, setReturningOnly] = useState(false);
  const [maxDistance, setMaxDistance] = useState(15);
  const [minNotice, setMinNotice] = useState('2');

  // Notifications
  const [pushNotifs, setPushNotifs] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsEmergency, setSmsEmergency] = useState(true);
  const [chatNotifs, setChatNotifs] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [documentAlerts, setDocumentAlerts] = useState(true);

  // Privacy
  const [hidePhone, setHidePhone] = useState(true);
  const [platformOnly, setPlatformOnly] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Pet restrictions
  const [dogsOnly, setDogsOnly] = useState(false);
  const [catsAllowed, setCatsAllowed] = useState(true);
  const [smallPets, setSmallPets] = useState(true);
  const [noAggressive, setNoAggressive] = useState(true);
  const [maxPets, setMaxPets] = useState('3');

  const handleSave = () => {
    toast({ title: 'Settings saved', description: 'All preferences have been updated.' });
  };

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5 overflow-x-auto">
        {[
          { id: 'operational', label: 'Operations', icon: Settings },
          { id: 'notifications', label: 'Alerts', icon: Bell },
          { id: 'privacy', label: 'Privacy', icon: Shield },
          { id: 'pets', label: 'Pets', icon: Dog },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}>
              <Icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Operational toggles */}
      {activeTab === 'operational' && (
        <div className="space-y-3">
          <ToggleCard
            label="Auto-accept jobs"
            sub="Automatically accept all incoming requests"
            value={autoAccept}
            onChange={(v) => { setAutoAccept(v); if (v) setManualApproval(false); }}
            icon={Zap}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
          <ToggleCard
            label="Manual approval required"
            sub="Review each request before accepting"
            value={manualApproval}
            onChange={(v) => { setManualApproval(v); if (v) setAutoAccept(false); }}
            icon={UserCheck}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
          />
          <ToggleCard
            label="Instant booking"
            sub="Clients can book without waiting for approval"
            value={instantBooking}
            onChange={setInstantBooking}
            icon={Power}
            iconColor="text-green-600"
            iconBg="bg-green-50"
          />
          <ToggleCard
            label="Weekend jobs"
            sub="Accept bookings on Friday & Saturday"
            value={weekendJobs}
            onChange={setWeekendJobs}
            icon={Sun}
            iconColor="text-orange-500"
            iconBg="bg-orange-50"
          />
          <ToggleCard
            label="Night jobs"
            sub="Accept bookings after 20:00"
            value={nightJobs}
            onChange={setNightJobs}
            icon={Moon}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50"
          />
          <ToggleCard
            label="Accept new clients"
            sub="Allow first-time clients to book"
            value={newClients}
            onChange={(v) => { setNewClients(v); if (!v) setReturningOnly(true); }}
            icon={UserCheck}
            iconColor="text-teal-600"
            iconBg="bg-teal-50"
          />
          <ToggleCard
            label="Returning clients only"
            sub="Only accept clients you've worked with before"
            value={returningOnly}
            onChange={(v) => { setReturningOnly(v); if (v) setNewClients(false); }}
            icon={UserX}
            iconColor="text-purple-600"
            iconBg="bg-purple-50"
          />

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-red-500" /> Maximum travel distance
            </p>
            <div className="flex items-center gap-3">
              <input type="range" min={1} max={50} value={maxDistance}
                onChange={e => setMaxDistance(Number(e.target.value))}
                className="flex-1 accent-amber-500" />
              <span className="text-sm font-bold text-gray-900 w-14 text-end">{maxDistance} km</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" /> Minimum advance notice
            </p>
            <select value={minNotice} onChange={e => setMinNotice(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400">
              {[['1', '1 hour'], ['2', '2 hours'], ['4', '4 hours'], ['8', '8 hours'], ['24', '24 hours'], ['48', '48 hours']].map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Notification settings */}
      {activeTab === 'notifications' && (
        <div className="space-y-3">
          <ToggleCard label="Push notifications" sub="Real-time alerts on your device" value={pushNotifs} onChange={setPushNotifs} icon={Bell} iconColor="text-amber-600" iconBg="bg-amber-50" />
          <ToggleCard label="Email notifications" sub="Summary emails for key events" value={emailNotifs} onChange={setEmailNotifs} icon={MessageSquare} iconColor="text-blue-600" iconBg="bg-blue-50" />
          <ToggleCard label="SMS — emergency only" sub="Text alerts for urgent situations" value={smsEmergency} onChange={setSmsEmergency} icon={Phone} iconColor="text-red-600" iconBg="bg-red-50" />
          <ToggleCard label="Chat message alerts" sub="Notifications when clients message you" value={chatNotifs} onChange={setChatNotifs} icon={MessageSquare} iconColor="text-teal-600" iconBg="bg-teal-50" />
          <ToggleCard label="Payment alerts" sub="Notify when funds arrive or change" value={paymentAlerts} onChange={setPaymentAlerts} icon={CreditCard} iconColor="text-green-600" iconBg="bg-green-50" />
          <ToggleCard label="Document alerts" sub="Notify before documents expire" value={documentAlerts} onChange={setDocumentAlerts} icon={FileText} iconColor="text-purple-600" iconBg="bg-purple-50" />
        </div>
      )}

      {/* Privacy settings */}
      {activeTab === 'privacy' && (
        <div className="space-y-3">
          <ToggleCard
            label="Hide phone from clients"
            sub="Clients can only contact you through the platform"
            value={hidePhone}
            onChange={setHidePhone}
            icon={Phone}
            iconColor="text-gray-600"
            iconBg="bg-gray-100"
          />
          <ToggleCard
            label="Platform messaging only"
            sub="Do not share personal contact details"
            value={platformOnly}
            onChange={setPlatformOnly}
            icon={MessageSquare}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
          />
          <ToggleCard
            label="Verified clients only"
            sub="Only accept bookings from ID-verified clients"
            value={verifiedOnly}
            onChange={setVerifiedOnly}
            icon={Shield}
            iconColor="text-green-600"
            iconBg="bg-green-50"
          />
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-800 mb-1">Privacy note</p>
            <p className="text-xs text-amber-700">Your personal information is never shared with clients without your explicit consent. The platform acts as an intermediary for all communications.</p>
          </div>
        </div>
      )}

      {/* Pet restrictions */}
      {activeTab === 'pets' && (
        <div className="space-y-3">
          <ToggleCard label="Dogs only" sub="Only accept dog-related bookings" value={dogsOnly} onChange={setDogsOnly} icon={Dog} iconColor="text-amber-600" iconBg="bg-amber-50" />
          <ToggleCard label="Cats welcome" sub="Accept cat-related bookings" value={catsAllowed} onChange={setCatsAllowed} icon={Dog} iconColor="text-teal-600" iconBg="bg-teal-50" />
          <ToggleCard label="Small pets only" sub="Only accept pets under 15kg" value={smallPets} onChange={setSmallPets} icon={Dog} iconColor="text-blue-600" iconBg="bg-blue-50" />
          <ToggleCard label="No aggressive breeds" sub="Decline bookings with restricted breeds" value={noAggressive} onChange={setNoAggressive} icon={Shield} iconColor="text-red-600" iconBg="bg-red-50" />

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Dog className="w-4 h-4 text-amber-500" /> Maximum pets per booking
            </p>
            <select value={maxPets} onChange={e => setMaxPets(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400">
              {['1', '2', '3', '4', '5', '6+'].map(v => <option key={v} value={v}>{v} {v === '1' ? 'pet' : 'pets'}</option>)}
            </select>
          </div>
        </div>
      )}

      <button onClick={handleSave}
        className="w-full py-3 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2">
        <Save className="w-4 h-4" /> Save Settings
      </button>
    </div>
  );
}

function ToggleCard({
  label, sub, value, onChange, icon: Icon, iconColor, iconBg
}: {
  label: string; sub: string; value: boolean; onChange: (v: boolean) => void;
  icon: React.ComponentType<any>; iconColor: string; iconBg: string;
}) {
  return (
    <div className={`bg-white border rounded-xl p-4 flex items-center gap-3 transition-colors ${value ? 'border-amber-300' : 'border-gray-200'}`}>
      <div className={`w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
