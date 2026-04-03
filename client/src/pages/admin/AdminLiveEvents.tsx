/**
 * Admin Live Events — real-time stream of marketplace events via /ws/match
 *
 * Shows matching.started, provider.accepted, and provider.arriving events
 * as they happen across the entire platform.
 *
 * Route: /admin/live-events
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Radio, Zap, CheckCircle, Navigation2, Search, Trash2, Wifi, WifiOff, FlaskConical
} from 'lucide-react';
import { format } from 'date-fns';

interface LiveEvent {
  id: string;
  type: 'MATCHING_STARTED' | 'PROVIDER_ACCEPTED' | 'PROVIDER_ARRIVING';
  requestId?: string;
  serviceType?: string;
  totalCandidates?: number;
  providerId?: string;
  ownerId?: string;
  newStatus?: string;
  eta?: string | null;
  timestamp: string;
  receivedAt: Date;
}

const EVENT_CONFIG: Record<LiveEvent['type'], {
  icon: React.ElementType;
  color: string;
  bg: string;
  labelEn: string;
}> = {
  MATCHING_STARTED:  { icon: Search,     color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20',   labelEn: 'Matching Started' },
  PROVIDER_ACCEPTED: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', labelEn: 'Provider Accepted' },
  PROVIDER_ARRIVING: { icon: Navigation2, color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/20', labelEn: 'Provider Arriving' },
};

function EventRow({ event }: { event: LiveEvent }) {
  const cfg = EVENT_CONFIG[event.type];
  const Icon = cfg.icon;

  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-xl border border-transparent transition-all luxury-animate-fade-in', cfg.bg)}>
      <div className={cn('mt-0.5 flex-shrink-0', cfg.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {cfg.labelEn}
          </span>
          {event.serviceType && (
            <Badge className="text-[10px] h-4 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border-0">
              {event.serviceType}
            </Badge>
          )}
          {event.requestId && (
            <span className="text-[10px] text-gray-400 font-mono">
              #{event.requestId.slice(-6)}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-4 gap-y-0.5">
          {event.type === 'MATCHING_STARTED' && event.totalCandidates !== undefined && (
            <span>{event.totalCandidates} candidates</span>
          )}
          {event.providerId && <span>Provider: {event.providerId.slice(-8)}</span>}
          {event.ownerId && <span>Customer: {event.ownerId.slice(-8)}</span>}
          {event.eta && <span>ETA: {event.eta}</span>}
          {event.newStatus && <span>Status → {event.newStatus}</span>}
        </div>
      </div>
      <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">
        {format(event.receivedAt, 'HH:mm:ss')}
      </span>
    </div>
  );
}

export default function AdminLiveEvents() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [firing, setFiring] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pausedRef = useRef(false);

  pausedRef.current = paused;

  const addEvent = useCallback((evt: Omit<LiveEvent, 'id' | 'receivedAt'>) => {
    if (pausedRef.current) return;
    setEvents(prev => [{
      ...evt,
      id: `${Date.now()}-${Math.random()}`,
      receivedAt: new Date(),
    }, ...prev].slice(0, 200));
  }, []);

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/match`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'SUBSCRIBE_ADMIN' }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === 'MATCHING_STARTED') {
          addEvent({
            type: 'MATCHING_STARTED',
            serviceType: msg.serviceType,
            totalCandidates: msg.totalCandidates,
            timestamp: msg.timestamp,
          });
        } else if (msg.type === 'PROVIDER_ACCEPTED') {
          addEvent({
            type: 'PROVIDER_ACCEPTED',
            requestId: msg.requestId,
            serviceType: msg.serviceType,
            providerId: msg.providerId,
            ownerId: msg.ownerId,
            newStatus: msg.newStatus,
            timestamp: msg.timestamp,
          });
        } else if (msg.type === 'PROVIDER_ARRIVING') {
          addEvent({
            type: 'PROVIDER_ARRIVING',
            requestId: msg.requestId,
            serviceType: msg.serviceType,
            providerId: msg.providerId,
            ownerId: msg.ownerId,
            eta: msg.eta,
            timestamp: msg.timestamp,
          });
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => {
      ws.close();
    };
  }, [addEvent]);

  const fireTestEvents = useCallback(async () => {
    setFiring(true);
    try {
      await fetch('/api/internal/fire-live-events', { method: 'POST' });
    } finally {
      setTimeout(() => setFiring(false), 1200);
    }
  }, []);

  const accepted  = events.filter(e => e.type === 'PROVIDER_ACCEPTED').length;
  const arriving  = events.filter(e => e.type === 'PROVIDER_ARRIVING').length;
  const matching  = events.filter(e => e.type === 'MATCHING_STARTED').length;

  return (
    <Layout>
      <div className="luxury-container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl luxury-bg-primary flex items-center justify-center">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="luxury-heading-md luxury-text-gradient">Live Marketplace Events</h1>
              <p className="text-sm text-muted-foreground">Real-time stream · last 200 events</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full', connected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
              {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {connected ? 'Connected' : 'Disconnected'}
              {connected && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fireTestEvents}
              disabled={firing}
              className="border-violet-300 text-violet-700 hover:bg-violet-50"
            >
              <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
              {firing ? 'Firing…' : 'Fire test events'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaused(p => !p)}
              className={paused ? 'border-amber-300 text-amber-700' : ''}
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              {paused ? 'Resume' : 'Pause'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setEvents([])}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Matching Started', value: matching, icon: Search,     color: 'text-blue-600' },
            { label: 'Provider Accepted', value: accepted, icon: CheckCircle, color: 'text-emerald-600' },
            { label: 'Provider Arriving', value: arriving, icon: Navigation2, color: 'text-amber-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="luxury-glass-card p-4 flex items-center gap-3">
              <Icon className={cn('h-5 w-5 flex-shrink-0', color)} />
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Event feed */}
        <div className="luxury-glass-card luxury-shadow-lg">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Event Feed
              {paused && (
                <span className="ml-2 text-amber-600 text-xs font-normal">(paused)</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{events.length} events</p>
          </div>

          <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Radio className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 font-medium">Waiting for events...</p>
                <p className="text-xs text-gray-400 mt-1">
                  {connected
                    ? 'Events will appear here as they happen across the platform'
                    : 'WebSocket disconnected — check server status'}
                </p>
              </div>
            ) : (
              events.map(evt => <EventRow key={evt.id} event={evt} />)
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
