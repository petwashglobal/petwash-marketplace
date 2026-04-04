import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dog, Moon, MapPin, Scissors, GraduationCap, Home, Clock, Eye,
  Plus, Trash2, Loader2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Info, AlertCircle, Globe,
} from 'lucide-react';

interface Addon {
  id: string;
  label: string;
  price: number;
  enabled: boolean;
}

interface ServiceConfig {
  enabled: boolean;
  basePrice: number | null;
  addons: Addon[];
}

type ServicesConfig = Record<string, ServiceConfig>;

const SERVICE_META: Record<string, { label: string; description: string; icon: any; color: string }> = {
  petsitting:   { label: 'Pet Sitting',    description: 'Stay at client\'s home while they\'re away', icon: Home,         color: 'text-indigo-600' },
  boarding:     { label: 'Boarding',       description: 'Pet stays at your home overnight',           icon: Moon,         color: 'text-blue-600' },
  daycare:      { label: 'Day Care',       description: 'Full-day care at your home',                 icon: Clock,        color: 'text-green-600' },
  dogwalking:   { label: 'Dog Walking',    description: 'Solo or group walks',                        icon: MapPin,       color: 'text-amber-600' },
  grooming:     { label: 'Grooming',       description: 'Bath, haircut and styling',                  icon: Scissors,     color: 'text-pink-600' },
  pettraining:  { label: 'Training',       description: 'Obedience and behaviour sessions',           icon: GraduationCap,color: 'text-purple-600' },
  housesitting: { label: 'House Sitting',  description: 'House check-ins while client travels',       icon: Home,         color: 'text-teal-600' },
  dropinvisit:  { label: 'Drop-In Visit',  description: 'Short home visit to feed/play',              icon: Dog,          color: 'text-orange-600' },
};

const ALL_SERVICE_IDS = Object.keys(SERVICE_META);

const DEFAULT_ADDONS: Record<string, Addon[]> = {
  boarding:   [{ id: 'extra_pet', label: 'Additional pet', price: 60, enabled: true }],
  daycare:    [{ id: 'extra_pet', label: 'Additional pet', price: 50, enabled: true }],
  dogwalking: [{ id: 'extra_dog', label: 'Additional dog', price: 30, enabled: true }, { id: 'gps_report', label: 'GPS walk report', price: 10, enabled: false }],
  grooming:   [{ id: 'blow_dry', label: 'Blow dry', price: 40, enabled: true }, { id: 'nail_trim', label: 'Nail trim', price: 20, enabled: true }],
};

function buildDefault(): ServicesConfig {
  return Object.fromEntries(
    ALL_SERVICE_IDS.map(id => [id, {
      enabled: false,
      basePrice: null,
      addons: DEFAULT_ADDONS[id] ?? [],
    }])
  );
}

function fetchWithAuth(url: string, opts?: RequestInit) {
  return fetch(url, { ...opts, credentials: 'include' }).then(r => r.json());
}

export default function POSServices() {
  const { toast } = useToast();
  const [config, setConfig] = useState<ServicesConfig>(buildDefault());
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['/api/provider-profile/services'],
    queryFn: () => fetchWithAuth('/api/provider-profile/services'),
  });

  useEffect(() => {
    if (data?.servicesConfig) {
      const merged = buildDefault();
      for (const [id, cfg] of Object.entries(data.servicesConfig as ServicesConfig)) {
        if (merged[id]) merged[id] = { ...merged[id], ...cfg };
      }
      setConfig(merged);
    }
  }, [data]);

  const [saveError, setSaveError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth('/api/provider-profile/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }),
    onSuccess: (res: any) => {
      if (!res.success) {
        const msg = res.error || 'Validation failed';
        const details = res.details ? JSON.stringify(res.details) : '';
        setSaveError(details || msg);
        toast({ title: msg, variant: 'destructive' });
        return;
      }
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ['/api/provider-profile/services'] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-profile/me'] });
      setDirty(false);
      toast({ title: 'Services saved', description: `${Object.values(config).filter(s => s.enabled).length} service(s) now visible on your profile.` });
    },
    onError: (err: any) => {
      setSaveError(err?.message || 'Network error');
      toast({ title: 'Failed to save services', variant: 'destructive' });
    },
  });

  function update(serviceId: string, patch: Partial<ServiceConfig>) {
    setConfig(prev => ({ ...prev, [serviceId]: { ...prev[serviceId], ...patch } }));
    setDirty(true);
  }

  function updateAddon(serviceId: string, addonIdx: number, patch: Partial<Addon>) {
    setConfig(prev => {
      const addons = [...(prev[serviceId].addons ?? [])];
      addons[addonIdx] = { ...addons[addonIdx], ...patch };
      return { ...prev, [serviceId]: { ...prev[serviceId], addons } };
    });
    setDirty(true);
  }

  function addAddon(serviceId: string) {
    const newAddon: Addon = { id: `addon_${Date.now()}`, label: '', price: 0, enabled: true };
    setConfig(prev => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], addons: [...(prev[serviceId].addons ?? []), newAddon] },
    }));
    setDirty(true);
  }

  function removeAddon(serviceId: string, addonIdx: number) {
    setConfig(prev => {
      const addons = (prev[serviceId].addons ?? []).filter((_, i) => i !== addonIdx);
      return { ...prev, [serviceId]: { ...prev[serviceId], addons } };
    });
    setDirty(true);
  }

  const enabledCount = Object.values(config).filter(s => s.enabled).length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Your Services</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {enabledCount === 0 ? 'No services enabled yet' : `${enabledCount} service${enabledCount !== 1 ? 's' : ''} active`}
          </p>
        </div>
        {dirty && (
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors flex items-center gap-2 disabled:opacity-60">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save
          </button>
        )}
      </div>

      {/* How pricing works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-800 space-y-0.5">
          <p className="font-semibold">What clients see vs what you earn</p>
          <p>Clients see your base price on your public profile. You receive the base price minus a 15% platform commission. VAT (18%) applies to the commission portion only.</p>
          <p className="text-blue-600 font-medium">Your net = base price × 82.3%</p>
        </div>
      </div>

      {/* Visibility explainer */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
        <Globe className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
        <div className="text-xs text-green-800">
          <p className="font-semibold">Public vs private</p>
          <p>Services you <span className="font-semibold">enable</span> with a price set appear on your public profile and in search results. Disabled services are hidden from clients but your settings are saved.</p>
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div className="text-xs text-red-800">
            <p className="font-semibold mb-0.5">Could not save services</p>
            <p className="font-mono text-[10px] text-red-600 break-all">{saveError}</p>
          </div>
        </div>
      )}

      {/* Service cards */}
      <div className="space-y-3">
        {ALL_SERVICE_IDS.map(serviceId => {
          const meta = SERVICE_META[serviceId];
          const svc = config[serviceId];
          const Icon = meta.icon;
          const isExpanded = expandedService === serviceId;

          return (
            <div key={serviceId} className={`bg-white border rounded-xl overflow-hidden transition-all ${svc.enabled ? 'border-amber-200' : 'border-gray-200'}`}>
              {/* Service header row */}
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${svc.enabled ? 'bg-amber-50' : 'bg-white'}`}>
                    <Icon className={`w-5 h-5 ${svc.enabled ? meta.color : 'text-gray-300'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${svc.enabled ? 'text-gray-900' : 'text-gray-400'}`}>{meta.label}</p>
                      {svc.enabled && svc.basePrice != null && (
                        <span className="flex items-center gap-0.5 text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
                          <Globe className="w-2.5 h-2.5" /> Public
                        </span>
                      )}
                      {svc.enabled && svc.basePrice == null && (
                        <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                          <AlertCircle className="w-2.5 h-2.5" /> No price
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{meta.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {svc.enabled && svc.basePrice != null && (
                      <span className="text-sm font-bold text-green-700">₪{svc.basePrice}</span>
                    )}
                    <button
                      onClick={() => update(serviceId, { enabled: !svc.enabled })}
                      className="transition-colors"
                      title={svc.enabled ? 'Disable service' : 'Enable service'}>
                      {svc.enabled
                        ? <ToggleRight className="w-7 h-7 text-amber-500" />
                        : <ToggleLeft className="w-7 h-7 text-gray-300" />}
                    </button>
                    {svc.enabled && (
                      <button onClick={() => setExpandedService(isExpanded ? null : serviceId)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded editor */}
              {svc.enabled && isExpanded && (
                <div className="border-t border-gray-100 p-4 space-y-4 bg-white">
                  {/* Base price */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Base price (₪ / booking)
                    </label>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₪</span>
                      <input
                        type="number" min="0" step="5"
                        value={svc.basePrice ?? ''}
                        onChange={e => update(serviceId, { basePrice: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="e.g. 150"
                        className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 bg-white font-medium"
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                    {svc.basePrice != null && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        Your net after 15% commission + VAT: ₪{(svc.basePrice * 0.823).toFixed(0)}
                      </p>
                    )}
                  </div>

                  {/* Add-ons */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-700">Add-ons</label>
                      <button onClick={() => addAddon(serviceId)}
                        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium">
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                    {(!svc.addons || svc.addons.length === 0) ? (
                      <p className="text-xs text-gray-400 italic">No add-ons for this service</p>
                    ) : (
                      <div className="space-y-2">
                        {svc.addons.map((addon, addonIdx) => (
                          <div key={addon.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-2.5">
                            <button onClick={() => updateAddon(serviceId, addonIdx, { enabled: !addon.enabled })}
                              className="shrink-0 transition-colors">
                              {addon.enabled
                                ? <ToggleRight className="w-5 h-5 text-amber-400" />
                                : <ToggleLeft className="w-5 h-5 text-gray-300" />}
                            </button>
                            <input
                              type="text"
                              value={addon.label}
                              onChange={e => updateAddon(serviceId, addonIdx, { label: e.target.value })}
                              placeholder="Add-on name"
                              className="flex-1 text-xs border-0 outline-none bg-transparent font-medium text-gray-800 placeholder-gray-400"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs text-gray-400">₪</span>
                              <input
                                type="number" min="0" step="5"
                                value={addon.price}
                                onChange={e => updateAddon(serviceId, addonIdx, { price: Number(e.target.value) })}
                                className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1 text-center font-medium focus:outline-none focus:border-amber-400 bg-white"
                              />
                            </div>
                            <button onClick={() => removeAddon(serviceId, addonIdx)}
                              className="p-1 text-gray-300 hover:text-red-400 transition-colors shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Public visibility note */}
                  {svc.basePrice != null ? (
                    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-xl p-2.5 border border-green-200">
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span><span className="font-semibold">Public:</span> This service is visible on your profile and in search results once saved.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl p-2.5 border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span><span className="font-semibold">Not public yet:</span> Set a base price above to make this service visible to clients.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom save */}
      {dirty && (
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full py-3 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save Services
        </button>
      )}
    </div>
  );
}
