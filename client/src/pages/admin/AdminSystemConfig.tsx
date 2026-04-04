/**
 * AdminSystemConfig — System Intelligence Control Panel
 * Route: /admin/system-config
 *
 * Toggles:
 *  • CAPTCHA strict mode
 *  • SMS required for registration
 *  • Step-up MFA enforcement
 *  • Matching radius
 *  • New provider boost
 *  • Recovery automation (signup + booking)
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, ShieldOff, MessageSquare, Clock, MapPin,
  Star, Mail, BookOpen, RefreshCw, Loader2, AlertTriangle,
  CheckCircle2, RotateCcw, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SystemConfigMap {
  'captcha.strict_mode': boolean;
  'sms.required_for_registration': boolean;
  'step_up.enabled': boolean;
  'step_up.threshold_seconds': number;
  'matching.default_radius_km': number;
  'matching.boost_new_providers': boolean;
  'recovery.signup_reminder_enabled': boolean;
  'recovery.booking_followup_enabled': boolean;
}

interface AuditEntry {
  key: string;
  from: unknown;
  to: unknown;
  by: string;
  at: string;
}

interface ConfigResponse {
  ok: boolean;
  config: SystemConfigMap;
  meta: {
    lastUpdated: string;
    auditLog: AuditEntry[];
    defaults: SystemConfigMap;
  };
}

const TOGGLE_DEFS = [
  {
    section: 'Auth Friction',
    items: [
      {
        key: 'captcha.strict_mode' as keyof SystemConfigMap,
        label: 'CAPTCHA Strict Mode',
        labelHe: 'מצב CAPTCHA מחמיר',
        desc: 'When ON: failed CAPTCHA hard-blocks the request. When OFF (recommended): logs and allows.',
        icon: Shield,
        danger: true,
      },
      {
        key: 'sms.required_for_registration' as keyof SystemConfigMap,
        label: 'SMS OTP at Registration',
        labelHe: 'OTP SMS ברישום',
        desc: 'When ON: phone verification required upfront. OFF (recommended): only required for payouts and risky actions.',
        icon: MessageSquare,
        danger: true,
      },
      {
        key: 'step_up.enabled' as keyof SystemConfigMap,
        label: 'Step-Up MFA Enforcement',
        labelHe: 'אכיפת Step-Up MFA',
        desc: 'When ON: sessions older than 2h on sensitive actions require fresh login. OFF: logs but allows.',
        icon: Clock,
        danger: true,
      },
    ],
  },
  {
    section: 'Smart Matching',
    items: [
      {
        key: 'matching.boost_new_providers' as keyof SystemConfigMap,
        label: 'Boost New Providers',
        labelHe: 'הגברת ספקים חדשים',
        desc: 'New providers (0 completed bookings) get a 50-point floor score to appear mid-list rather than bottom.',
        icon: Star,
        danger: false,
      },
    ],
  },
  {
    section: 'Recovery Automation',
    items: [
      {
        key: 'recovery.signup_reminder_enabled' as keyof SystemConfigMap,
        label: 'Incomplete Signup Reminders',
        labelHe: 'תזכורות רישום לא שלם',
        desc: 'Hourly scan: users who started registration but never completed it receive one follow-up email.',
        icon: Mail,
        danger: false,
      },
      {
        key: 'recovery.booking_followup_enabled' as keyof SystemConfigMap,
        label: 'Abandoned Booking Follow-Up',
        labelHe: 'מעקב הזמנות נטושות',
        desc: 'Every 30 min: pending booking requests older than 45 min receive one follow-up email to the owner.',
        icon: BookOpen,
        danger: false,
      },
    ],
  },
];

const NUMBER_FIELDS: Array<{
  key: keyof SystemConfigMap;
  label: string;
  desc: string;
  unit: string;
  min: number;
  max: number;
  icon: any;
}> = [
  {
    key: 'step_up.threshold_seconds',
    label: 'Step-Up Session Age Threshold',
    desc: 'Sessions older than this (seconds) trigger step-up MFA on sensitive actions.',
    unit: 'sec',
    min: 300,
    max: 86400,
    icon: Clock,
  },
  {
    key: 'matching.default_radius_km',
    label: 'Default Matching Radius',
    desc: 'Providers further than this distance are excluded from results when user location is known.',
    unit: 'km',
    min: 1,
    max: 100,
    icon: MapPin,
  },
];

export default function AdminSystemConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAudit, setShowAudit] = useState(false);
  const [localNumbers, setLocalNumbers] = useState<Partial<Record<keyof SystemConfigMap, number>>>({});

  const { data, isLoading, error } = useQuery<ConfigResponse>({
    queryKey: ['/api/admin/system-config'],
  });

  const patchMutation = useMutation({
    mutationFn: (changes: Partial<SystemConfigMap>) =>
      apiRequest('PATCH', '/api/admin/system-config', changes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/system-config'] });
      toast({ title: 'Config updated', description: 'Change applied immediately.', variant: 'default' });
    },
    onError: () => {
      toast({ title: 'Update failed', description: 'Could not apply change.', variant: 'destructive' });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/system-config/reset', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/system-config'] });
      setLocalNumbers({});
      toast({ title: 'Reset complete', description: 'All values restored to defaults.' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-6 h-6 text-gray-400" />
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6 text-center">
        <AlertTriangle className="mx-auto w-8 h-8 text-red-500 mb-3" />
        <p className="text-gray-500">Failed to load system config.</p>
      </div>
    );
  }

  const cfg = data.config;
  const meta = data.meta;
  const hasNonDefault = JSON.stringify(cfg) !== JSON.stringify(meta.defaults);

  function toggleBool(key: keyof SystemConfigMap) {
    const current = cfg[key];
    if (typeof current !== 'boolean') return;
    patchMutation.mutate({ [key]: !current } as any);
  }

  function saveNumber(key: keyof SystemConfigMap) {
    const val = localNumbers[key];
    if (val == null) return;
    patchMutation.mutate({ [key]: val } as any);
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 space-y-8" dir="ltr">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Intelligence Controls</h1>
          <p className="text-sm text-gray-500 mt-1">
            Runtime toggles — take effect immediately, reset on server restart.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasNonDefault && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              Modified from defaults
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending || !hasNonDefault}
            className="gap-2"
          >
            {resetMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RotateCcw className="w-3 h-3" />
            )}
            Reset to defaults
          </Button>
        </div>
      </div>

      {/* Last updated */}
      <p className="text-xs text-gray-400">
        Last updated: {new Date(meta.lastUpdated).toLocaleString('he-IL')}
      </p>

      {/* Toggle sections */}
      {TOGGLE_DEFS.map((section) => (
        <div key={section.section} className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {section.section}
          </h2>
          <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {section.items.map(({ key, label, labelHe, desc, icon: Icon, danger }) => {
              const value = cfg[key] as boolean;
              const isOn = value === true;
              const isRisky = danger && isOn;
              return (
                <div
                  key={key}
                  className={`flex items-start gap-4 p-4 bg-white hover:bg-white transition-colors ${
                    isRisky ? 'border-l-4 border-l-amber-400' : ''
                  }`}
                >
                  <div className={`mt-0.5 p-2 rounded-lg ${isOn ? 'bg-amber-100 text-amber-700' : 'bg-white text-gray-400'}`}>
                    {isOn ? <Icon className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{label}</span>
                      <span className="text-xs text-gray-400">{labelHe}</span>
                      {isRisky && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5">
                          friction active
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                  <button
                    onClick={() => toggleBool(key)}
                    disabled={patchMutation.isPending}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 mt-0.5 ${
                      isOn ? 'bg-amber-500' : 'bg-white'
                    } ${patchMutation.isPending ? 'opacity-50' : ''}`}
                    role="switch"
                    aria-checked={isOn}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        isOn ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Number fields */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Thresholds
        </h2>
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {NUMBER_FIELDS.map(({ key, label, desc, unit, min, max, icon: Icon }) => {
            const dbValue = cfg[key] as number;
            const localValue = localNumbers[key];
            const displayValue = localValue ?? dbValue;
            const isDirty = localValue != null && localValue !== dbValue;

            return (
              <div key={key} className="flex items-start gap-4 p-4 bg-white">
                <div className="mt-0.5 p-2 rounded-lg bg-blue-50 text-blue-500">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900 text-sm">{label}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={displayValue}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!isNaN(v)) setLocalNumbers(prev => ({ ...prev, [key]: v }));
                    }}
                    className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <span className="text-xs text-gray-400">{unit}</span>
                  {isDirty && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveNumber(key)}
                      disabled={patchMutation.isPending}
                      className="h-7 px-2 text-xs gap-1 text-green-700 border-green-300"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Save
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit log */}
      <div className="space-y-2">
        <button
          onClick={() => setShowAudit(v => !v)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          {showAudit ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Audit log ({meta.auditLog.length} recent changes)
        </button>
        {showAudit && meta.auditLog.length > 0 && (
          <div className="rounded-xl border border-gray-100 overflow-hidden text-xs font-mono">
            <div className="grid grid-cols-4 gap-4 bg-white px-4 py-2 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
              <span>Key</span><span>From</span><span>To</span><span>By / When</span>
            </div>
            {meta.auditLog.slice().reverse().map((entry, i) => (
              <div
                key={i}
                className="grid grid-cols-4 gap-4 px-4 py-2 border-t border-gray-100 text-gray-600 hover:bg-white"
              >
                <span className="truncate">{entry.key}</span>
                <span className="text-red-500">{String(entry.from)}</span>
                <span className="text-green-600">{String(entry.to)}</span>
                <span className="text-gray-400 truncate">
                  {entry.by} · {new Date(entry.at).toLocaleTimeString('he-IL')}
                </span>
              </div>
            ))}
          </div>
        )}
        {showAudit && meta.auditLog.length === 0 && (
          <p className="text-xs text-gray-400 pl-1">No changes since last server start.</p>
        )}
      </div>
    </div>
  );
}
