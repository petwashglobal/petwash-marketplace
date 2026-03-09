import { useState } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import {
  Camera, Star, Shield, Award, MapPin, Globe,
  Dog, MapPinned, Scissors, GraduationCap, Building2,
  CheckCircle2, ChevronRight, Edit3,
} from 'lucide-react';

const LANGUAGES = ['Hebrew', 'English', 'Arabic', 'Russian', 'French', 'Spanish'];
const SERVICE_AREAS = ['Tel Aviv', 'Jerusalem', 'Haifa', 'Raanana', 'Petah Tikva', 'Rishon LeZion', 'Netanya', 'Beer Sheva'];

const PLATFORM_SERVICES = [
  {
    id: 'petsitter', name: 'PetSitter', icon: Dog, color: 'text-amber-600', bg: 'bg-amber-50',
    services: ['Home Sitting', 'Boarding', 'Drop-in Visits', 'Day Care'],
  },
  {
    id: 'walkpet', name: 'Walk My Pet', icon: MapPinned, color: 'text-blue-600', bg: 'bg-blue-50',
    services: ['30-min Walk', '60-min Walk', 'Group Walk', 'Puppy Walk'],
  },
  {
    id: 'petwash', name: 'PetWash', icon: Scissors, color: 'text-teal-600', bg: 'bg-teal-50',
    services: ['Basic Wash', 'Full Groom', 'Nail Trim', 'De-shed Treatment'],
  },
  {
    id: 'academy', name: 'Academy', icon: GraduationCap, color: 'text-purple-600', bg: 'bg-purple-50',
    services: ['Puppy Training', 'Obedience', 'Behavior Correction', 'Agility'],
  },
];

const BUSINESS_TYPES = [
  { id: 'individual', label: 'Individual' },
  { id: 'osek_patur', label: 'Osek Patur' },
  { id: 'osek_murshe', label: 'Osek Murshe' },
  { id: 'company', label: 'Company' },
];

export default function POSProfile() {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'basic' | 'services' | 'business' | 'badges'>('basic');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState(['Hebrew', 'English']);
  const [serviceAreas, setServiceAreas] = useState(['Tel Aviv', 'Raanana']);
  const [radius, setRadius] = useState(10);
  const [businessType, setBusinessType] = useState('individual');
  const [businessName, setBusinessName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [services, setServices] = useState<Record<string, { active: boolean; price: string; description: string }>>({});
  const [experience, setExperience] = useState('2');

  const toggleLanguage = (lang: string) => {
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  };
  const toggleArea = (area: string) => {
    setServiceAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  };
  const toggleService = (platformId: string, svc: string) => {
    const key = `${platformId}_${svc}`;
    setServices(prev => ({
      ...prev,
      [key]: { active: !prev[key]?.active, price: prev[key]?.price || '', description: prev[key]?.description || '' }
    }));
  };

  const handleSave = () => {
    toast({ title: 'Profile saved', description: 'Your profile has been updated.' });
  };

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
            <span className="text-2xl font-bold text-amber-600">{(displayName || user?.email || 'P').charAt(0).toUpperCase()}</span>
          </div>
          <button className="absolute -bottom-1 -end-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shadow-sm">
            <Camera className="w-3 h-3 text-white" />
          </button>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-base font-semibold text-gray-900">{displayName || 'Your Name'}</p>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xs text-gray-500">{user?.email}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />4.9</span>
            <span className="text-xs text-gray-400">23 reviews</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">47 jobs</span>
          </div>
        </div>
        <button onClick={() => setActiveTab('basic')} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <Edit3 className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {[
          { id: 'basic', label: 'Basic' },
          { id: 'services', label: 'Services' },
          { id: 'business', label: 'Business' },
          { id: 'badges', label: 'Badges' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Basic info */}
      {activeTab === 'basic' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                placeholder="Tell clients about yourself, your experience, and your love for pets..."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400 resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Years of Experience</label>
              <select value={experience} onChange={e => setExperience(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400">
                {['<1', '1', '2', '3', '5', '7', '10+'].map(v => <option key={v} value={v}>{v} years</option>)}
              </select>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" /> Languages
            </p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(lang => (
                <button key={lang} onClick={() => toggleLanguage(lang)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    languages.includes(lang) ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500" /> Service Areas
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {SERVICE_AREAS.map(area => (
                <button key={area} onClick={() => toggleArea(area)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    serviceAreas.includes(area) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {area}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Travel radius: {radius} km</label>
              <input type="range" min={1} max={50} value={radius} onChange={e => setRadius(Number(e.target.value))}
                className="w-full accent-amber-500" />
            </div>
          </div>
        </div>
      )}

      {/* Services per platform */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          {PLATFORM_SERVICES.map(platform => {
            const Icon = platform.icon;
            return (
              <div key={platform.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className={`px-4 py-3 flex items-center gap-2 border-b border-gray-100 ${platform.bg}`}>
                  <Icon className={`w-4 h-4 ${platform.color}`} />
                  <p className="text-sm font-semibold text-gray-900">{platform.name}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {platform.services.map(svc => {
                    const key = `${platform.id}_${svc}`;
                    const entry = services[key];
                    return (
                      <div key={svc} className="px-4 py-3">
                        <div className="flex items-center gap-3 mb-2">
                          <Switch checked={!!entry?.active} onCheckedChange={() => toggleService(platform.id, svc)} />
                          <span className="text-sm font-medium text-gray-800">{svc}</span>
                        </div>
                        {entry?.active && (
                          <div className="flex gap-2 ms-9">
                            <input
                              value={entry.price}
                              onChange={e => setServices(prev => ({ ...prev, [key]: { ...prev[key], price: e.target.value } }))}
                              placeholder="Price ₪"
                              className="w-24 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400"
                            />
                            <input
                              value={entry.description}
                              onChange={e => setServices(prev => ({ ...prev, [key]: { ...prev[key], description: e.target.value } }))}
                              placeholder="Short description..."
                              className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Business details */}
      {activeTab === 'business' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" /> Business Type
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {BUSINESS_TYPES.map(bt => (
                <button key={bt.id} onClick={() => setBusinessType(bt.id)}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    businessType === bt.id ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {bt.label}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {businessType !== 'individual' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Business Name</label>
                    <input value={businessName} onChange={e => setBusinessName(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">VAT Number (מס׳ עוסק)</label>
                    <input value={vatNumber} onChange={e => setVatNumber(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400 font-mono" />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Bank Account for Payouts</label>
                <input value={bankAccount} onChange={e => setBankAccount(e.target.value)}
                  placeholder="IBAN or account number"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400 font-mono" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Badges */}
      {activeTab === 'badges' && (
        <div className="space-y-3">
          {[
            { label: 'Identity Verified', sub: 'Government ID confirmed', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50', status: 'verified' },
            { label: 'Insurance Holder', sub: 'Professional liability coverage', icon: Award, color: 'text-green-600', bg: 'bg-green-50', status: 'pending' },
            { label: 'Premium Provider', sub: '100+ completed jobs', icon: Star, color: 'text-amber-600', bg: 'bg-amber-50', status: 'locked' },
            { label: 'Background Check', sub: 'Police clearance on file', icon: CheckCircle2, color: 'text-teal-600', bg: 'bg-teal-50', status: 'pending' },
          ].map(badge => {
            const Icon = badge.icon;
            const statusColors: Record<string, string> = {
              verified: 'bg-green-100 text-green-700',
              pending: 'bg-amber-100 text-amber-700',
              locked: 'bg-gray-100 text-gray-500',
            };
            return (
              <div key={badge.label} className={`bg-white border rounded-xl p-4 flex items-center gap-3 ${badge.status === 'verified' ? 'border-green-200' : 'border-gray-200'}`}>
                <div className={`w-10 h-10 ${badge.bg} rounded-xl flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${badge.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{badge.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{badge.sub}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusColors[badge.status]}`}>
                  {badge.status}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={handleSave}
        className="w-full py-3 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors">
        Save Profile
      </button>
    </div>
  );
}
