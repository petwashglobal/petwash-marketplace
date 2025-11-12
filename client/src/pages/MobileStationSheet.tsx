import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { ArrowLeft, MapPin, ExternalLink, Copy, Package, AlertTriangle, FileText, QrCode, Plus, Minus, Phone, Mail, Droplets } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';

interface Station {
  id: string;
  serialNumber: string;
  name: string;
  status: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    country: string;
  };
  council?: string;
  geo?: {
    lat: number;
    lng: number;
  };
  utilities?: {
    insurance?: { provider: string; policyNumber?: string; renewalDate?: string };
    electricity?: { provider: string; accountNumber?: string; meterId?: string };
    water?: { provider: string; accountNumber?: string };
    council?: {
      name?: string;
      contactPerson?: string;
      role?: string;
      phone?: string;
      email?: string;
      notes?: string;
    };
  };
  nayax?: {
    terminalId?: string;
  };
  thresholds?: {
    minStock: {
      shampoo: number;
      conditioner: number;
      disinfectant: number;
    };
  };
  photos?: string[];
}

interface InventoryItem {
  name: string;
  unit: string;
  qty: number;
  reorderLevel: number;
  lastRefillAt?: string;
  notes?: string;
}

interface StationDetailsResponse {
  station: Station;
  inventory: Record<string, InventoryItem>;
  events: any[];
}

export default function MobileStationSheet() {
  const [, params] = useRoute('/s/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const stationId = params?.id;

  const [activeTab, setActiveTab] = useState('overview');
  const [showQR, setShowQR] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showSetDialog, setShowSetDialog] = useState(false);
  const [currentSku, setCurrentSku] = useState<string | null>(null);
  const [setQty, setSetQty] = useState('');
  const [setReorderLevel, setSetReorderLevel] = useState('');
  const [setNotes, setSetNotes] = useState('');

  const { data, isLoading } = useQuery<StationDetailsResponse>({
    queryKey: [`/api/admin/stations/${stationId}`],
    enabled: !!stationId,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      return apiRequest('POST', `/api/admin/stations/${stationId}/note`, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/stations/${stationId}`] });
      toast({ title: 'Note added ✓' });
      setShowNoteDialog(false);
      setNoteText('');
    },
  });

  const adjustInventoryMutation = useMutation({
    mutationFn: async ({ sku, delta }: { sku: string; delta: number }) => {
      return apiRequest('POST', `/api/admin/stations/${stationId}/inventory/adjust`, { sku, delta });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/stations/${stationId}`] });
      toast({ title: 'Saved ✓' });
    },
    onError: () => {
      toast({ title: 'Failed to update', variant: 'destructive' });
    },
  });

  const setInventoryMutation = useMutation({
    mutationFn: async ({ sku, qty, reorderLevel, notes }: { sku: string; qty: number; reorderLevel?: number; notes?: string }) => {
      return apiRequest('POST', `/api/admin/stations/${stationId}/inventory/set`, { sku, qty, reorderLevel, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/stations/${stationId}`] });
      toast({ title: 'Saved ✓' });
      setShowSetDialog(false);
      setCurrentSku(null);
      setSetQty('');
      setSetReorderLevel('');
      setSetNotes('');
    },
    onError: () => {
      toast({ title: 'Failed to update', variant: 'destructive' });
    },
  });

  if (!stationId) {
    setLocation('/m');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">Loading station...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.station) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="font-semibold mb-2">Station Not Found</p>
          <Button onClick={() => setLocation('/m')} variant="outline">
            Back to Hub
          </Button>
        </Card>
      </div>
    );
  }

  const station = data.station;
  const inventory = data.inventory || {};
  const fullAddress = [
    station.address.line1,
    station.address.line2,
    station.address.city,
    station.address.postcode,
    station.council,
    station.address.country
  ].filter(Boolean).join(', ');

  const copyAddress = () => {
    navigator.clipboard.writeText(fullAddress);
    toast({ title: 'Address copied!' });
  };

  const openMap = (type: 'google' | 'apple' | 'waze') => {
    if (!station.geo) {
      toast({ title: 'No coordinates available', variant: 'destructive' });
      return;
    }

    const { lat, lng } = station.geo;
    let url = '';

    switch (type) {
      case 'google':
        url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        break;
      case 'apple':
        url = `http://maps.apple.com/?daddr=${lat},${lng}`;
        break;
      case 'waze':
        url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
        break;
    }

    window.open(url, '_blank');
  };

  const getStockStatus = (qty: number, reorderLevel: number) => {
    if (qty === 0) return 'critical';
    if (qty < reorderLevel / 2) return 'low';
    if (qty < reorderLevel) return 'warning';
    return 'good';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'installing': return 'bg-blue-500';
      case 'maintenance': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysUntilRenewal = (dateString?: string) => {
    if (!dateString) return null;
    const days = Math.ceil((new Date(dateString).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const handleQuickAdjust = (sku: string, delta: number) => {
    adjustInventoryMutation.mutate({ sku, delta });
  };

  const openSetDialog = (sku: string, item: InventoryItem) => {
    setCurrentSku(sku);
    setSetQty(item.qty.toString());
    setSetReorderLevel(item.reorderLevel.toString());
    setSetNotes(item.notes || '');
    setShowSetDialog(true);
  };

  const handleSet = () => {
    if (!currentSku) return;
    
    const qty = parseInt(setQty, 10);
    const reorderLevel = parseInt(setReorderLevel, 10);
    
    if (isNaN(qty) || qty < 0) {
      toast({ title: 'Invalid quantity', variant: 'destructive' });
      return;
    }
    
    if (isNaN(reorderLevel) || reorderLevel < 0) {
      toast({ title: 'Invalid reorder level', variant: 'destructive' });
      return;
    }
    
    setInventoryMutation.mutate({ 
      sku: currentSku, 
      qty, 
      reorderLevel, 
      notes: setNotes.trim() || undefined 
    });
  };

  const councilContact = station.utilities?.council;
  const hasMissingCouncilInfo = !councilContact || (!councilContact.name && !councilContact.contactPerson);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/m')}
            className="p-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-gray-900">{station.serialNumber}</h1>
              <Badge className={`${getStatusColor(station.status)} text-white border-0`}>
                {station.status}
              </Badge>
            </div>
            {station.name && <p className="text-sm text-gray-500">{station.name}</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-[65px] z-40 bg-white border-b border-gray-200">
          <TabsList className="w-full justify-start rounded-none h-12 bg-transparent p-0">
            <TabsTrigger 
              value="overview" 
              className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
              data-testid="tab-overview"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="inventory" 
              className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
              data-testid="tab-inventory"
            >
              Inventory
            </TabsTrigger>
            <TabsTrigger 
              value="utilities" 
              className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
              data-testid="tab-utilities"
            >
              Utilities
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab - Enterprise KPI Dashboard */}
        <TabsContent value="overview" className="px-0 py-0 mt-0">
          <div className="min-h-screen bg-[#0B0B0B]">
            {/* Header */}
            <div className="border-b border-[#2A2A2A] px-4 py-3 sticky top-0 bg-[#0B0B0B] z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-medium text-[#EDEDED]">Station Overview</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#666666]">{station.serialNumber}</span>
                  <div className={`w-2 h-2 rounded-full ${station.status === 'online' ? 'bg-[#00F57A]' : 'bg-[#EF4444]'}`} />
                </div>
              </div>
            </div>

            {/* KPI Grid */}
            <div className="p-4 space-y-3">
              {/* Today's Washes */}
              <div className="p-4 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] text-[#666666]">Today's Washes</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1F1F1F] text-[#A0A0A0]">Live</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-semibold text-[#EDEDED] tabular-nums">0</span>
                  <span className="text-[13px] text-[#A0A0A0]">cycles</span>
                </div>
                <div className="mt-2 h-1 bg-[#1F1F1F] rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-[#00F57A]" />
                </div>
              </div>

              {/* 7-Day Trend */}
              <div className="p-4 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] text-[#666666]">7-Day Volume</span>
                  <span className="text-[11px] text-[#A0A0A0]">—</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-semibold text-[#EDEDED] tabular-nums">—</span>
                  <span className="text-[13px] text-[#A0A0A0]">total</span>
                </div>
                <div className="mt-2 h-1 bg-[#1F1F1F] rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-[#A0A0A0]" />
                </div>
              </div>

              {/* Low Stock Items */}
              <div className="p-4 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] text-[#666666]">Low Stock Items</span>
                  {Object.values(inventory).filter(item => item.qty <= item.reorderLevel).length > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#FFB547]/10 text-[#FFB547]">Alert</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-semibold text-[#EDEDED] tabular-nums">
                    {Object.values(inventory).filter(item => item.qty <= item.reorderLevel).length}
                  </span>
                  <span className="text-[13px] text-[#A0A0A0]">/ {Object.keys(inventory).length} items</span>
                </div>
                <div className="mt-2 h-1 bg-[#1F1F1F] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#FFB547]" 
                    style={{ 
                      width: `${Object.keys(inventory).length > 0 ? (Object.values(inventory).filter(item => item.qty <= item.reorderLevel).length / Object.keys(inventory).length * 100) : 0}%` 
                    }}
                  />
                </div>
              </div>

              {/* Upcoming Renewals */}
              <div className="p-4 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] text-[#666666]">Renewals (30d)</span>
                  {(() => {
                    const upcoming = [
                      station.utilities?.insurance?.renewalDate,
                    ].filter(date => date && getDaysUntilRenewal(date)! <= 30 && getDaysUntilRenewal(date)! >= 0);
                    return upcoming.length > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#3B82F6]/10 text-[#3B82F6]">Due</span>
                    );
                  })()}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-semibold text-[#EDEDED] tabular-nums">
                    {(() => {
                      const upcoming = [
                        station.utilities?.insurance?.renewalDate,
                      ].filter(date => date && getDaysUntilRenewal(date)! <= 30 && getDaysUntilRenewal(date)! >= 0);
                      return upcoming.length;
                    })()}
                  </span>
                  <span className="text-[13px] text-[#A0A0A0]">utilities</span>
                </div>
                <div className="mt-2 h-1 bg-[#1F1F1F] rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-[#3B82F6]" />
                </div>
              </div>

              {/* Station Details */}
              <div className="mt-6 p-4 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
                <h4 className="text-[13px] font-semibold text-[#EDEDED] mb-3">Station Details</h4>
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-[#666666]">Location</span>
                    <span className="text-[#EDEDED] text-right">{station.address.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666666]">Nayax Terminal</span>
                    <span className="text-[#EDEDED]">{station.nayax?.terminalId || '—'}</span>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={copyAddress}
                    className="flex-1 h-9 rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] text-[#EDEDED] text-[13px] font-medium hover:bg-[#252525] transition-colors duration-100"
                    data-testid="button-copy-address"
                  >
                    <Copy className="w-3.5 h-3.5 inline mr-1" />
                    Copy Address
                  </button>
                  <button
                    onClick={() => setShowQR(true)}
                    className="flex-1 h-9 rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] text-[#EDEDED] text-[13px] font-medium hover:bg-[#252525] transition-colors duration-100"
                    data-testid="button-share-qr"
                  >
                    <QrCode className="w-3.5 h-3.5 inline mr-1" />
                    QR Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Inventory Tab - Enterprise Design */}
        <TabsContent value="inventory" className="px-0 py-0 mt-0">
          <div className="min-h-screen bg-[#0B0B0B]">
            {/* Header */}
            <div className="border-b border-[#2A2A2A] px-4 py-3 flex items-center justify-between sticky top-0 bg-[#0B0B0B] z-10">
              <h3 className="text-[15px] font-medium text-[#EDEDED]">Consumables Inventory</h3>
              <span className="text-[13px] text-[#A0A0A0]">Last updated: Now</span>
            </div>

            {Object.keys(inventory).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <Package className="w-12 h-12 text-[#404040] mb-3" />
                <p className="text-[14px] text-[#A0A0A0]">No inventory data</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2A2A2A]">
                {Object.entries(inventory).map(([sku, item]) => {
                  const isLowStock = item.qty <= item.reorderLevel;
                  const percentage = Math.min(100, (item.qty / Math.max(item.reorderLevel, 1)) * 100);
                  
                  return (
                    <div key={sku} className="hover:bg-[#151515] transition-colors duration-100">
                      {/* Horizontal Row Layout */}
                      <div className="p-4">
                        {/* Top Row: Icon, Name, Status */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-[#A0A0A0]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[15px] font-medium text-[#EDEDED] truncate">{item.name}</h4>
                            <p className="text-[13px] text-[#666666]">Reorder at {item.reorderLevel} {item.unit}</p>
                          </div>
                          {isLowStock && (
                            <div 
                              className="px-2 py-1 rounded bg-[#FFB547]/10 border border-[#FFB547]/20 flex items-center gap-1"
                              aria-label="Low stock warning"
                              role="status"
                            >
                              <AlertTriangle className="w-3 h-3 text-[#FFB547]" />
                              <span className="text-[12px] font-medium text-[#FFB547]">LOW</span>
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-[20px] font-semibold text-[#EDEDED] tabular-nums">{item.qty}</span>
                            <span className="text-[13px] text-[#A0A0A0]">/ {item.reorderLevel} {item.unit}</span>
                          </div>
                          <div className="h-2 bg-[#1F1F1F] rounded-sm overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                percentage <= 50 ? 'bg-[#EF4444]' : percentage <= 75 ? 'bg-[#FFB547]' : 'bg-[#00F57A]'
                              }`}
                              style={{ width: `${percentage}%` }}
                              aria-valuenow={item.qty}
                              aria-valuemin={0}
                              aria-valuemax={item.reorderLevel}
                              role="progressbar"
                              aria-label={`Stock level: ${item.qty} of ${item.reorderLevel} ${item.unit}`}
                            />
                          </div>
                        </div>

                        {/* Control Buttons */}
                        <div className="flex gap-2 mb-2">
                          <button
                            onClick={() => handleQuickAdjust(sku, -5)}
                            disabled={adjustInventoryMutation.isPending}
                            className="flex-1 h-11 rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] text-[#EDEDED] text-[14px] font-medium hover:bg-[#252525] hover:border-[#3A3A3A] focus:outline-none focus:ring-2 focus:ring-[#00F57A] focus:ring-opacity-50 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            data-testid={`button-${sku}-minus5`}
                          >
                            −5
                          </button>
                          <button
                            onClick={() => handleQuickAdjust(sku, -1)}
                            disabled={adjustInventoryMutation.isPending}
                            className="flex-1 h-11 rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] text-[#EDEDED] text-[14px] font-medium hover:bg-[#252525] hover:border-[#3A3A3A] focus:outline-none focus:ring-2 focus:ring-[#00F57A] focus:ring-opacity-50 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            data-testid={`button-${sku}-minus1`}
                          >
                            −1
                          </button>
                          <button
                            onClick={() => handleQuickAdjust(sku, 1)}
                            disabled={adjustInventoryMutation.isPending}
                            className="flex-1 h-11 rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] text-[#EDEDED] text-[14px] font-medium hover:bg-[#252525] hover:border-[#3A3A3A] focus:outline-none focus:ring-2 focus:ring-[#00F57A] focus:ring-opacity-50 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            data-testid={`button-${sku}-plus1`}
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleQuickAdjust(sku, 5)}
                            disabled={adjustInventoryMutation.isPending}
                            className="flex-1 h-11 rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] text-[#EDEDED] text-[14px] font-medium hover:bg-[#252525] hover:border-[#3A3A3A] focus:outline-none focus:ring-2 focus:ring-[#00F57A] focus:ring-opacity-50 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            data-testid={`button-${sku}-plus5`}
                          >
                            +5
                          </button>
                        </div>

                        {/* Set Button */}
                        <button
                          onClick={() => openSetDialog(sku, item)}
                          disabled={setInventoryMutation.isPending}
                          className="w-full h-11 rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] text-[#EDEDED] text-[14px] font-medium hover:bg-[#252525] hover:border-[#00F57A]/50 focus:outline-none focus:ring-2 focus:ring-[#00F57A] focus:ring-opacity-50 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          data-testid={`button-${sku}-set`}
                        >
                          Set Exact Values
                        </button>

                        {/* Meta Info */}
                        <div className="mt-3 flex items-center gap-4 text-[12px] text-[#666666]">
                          {item.lastRefillAt && (
                            <span>Last refill: {formatDate(item.lastRefillAt)}</span>
                          )}
                        </div>

                        {/* Notes */}
                        {item.notes && (
                          <div className="mt-3 p-2 rounded bg-[#1A1A1A] border border-[#2A2A2A]">
                            <p className="text-[13px] text-[#A0A0A0]">{item.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Utilities + Council Tab - Enterprise Design */}
        <TabsContent value="utilities" className="px-0 py-0 mt-0">
          <div className="min-h-screen bg-[#0B0B0B]">
            {/* Header with Copy Button */}
            <div className="border-b border-[#2A2A2A] px-4 py-3 flex items-center justify-between sticky top-0 bg-[#0B0B0B] z-10">
              <h3 className="text-[15px] font-medium text-[#EDEDED]">Utilities & Council</h3>
              <button
                onClick={() => {
                  const summary = `Station: ${station.name}\nAddress: ${station.address.line1}, ${station.address.city}\nSerial: ${station.serialNumber}\nNayax Terminal: ${station.nayax?.terminalId || 'N/A'}`;
                  navigator.clipboard.writeText(summary);
                  toast({ title: 'Copied to clipboard' });
                }}
                className="px-3 py-1.5 rounded text-[13px] font-medium bg-[#1F1F1F] border border-[#2A2A2A] text-[#EDEDED] hover:bg-[#252525] transition-colors duration-100"
              >
                <Copy className="w-3.5 h-3.5 inline mr-1" />
                Copy for Contractor
              </button>
            </div>

            {/* Two-Column Layout (stacks on mobile) */}
            <div className="grid md:grid-cols-2 gap-px bg-[#2A2A2A]">
              {/* Left Column: Utilities */}
              <div className="bg-[#0B0B0B] p-4 space-y-4">
                <h4 className="text-[14px] font-semibold text-[#EDEDED] mb-4">Utilities</h4>
                
                {/* Insurance */}
                {station.utilities?.insurance ? (
                  <div className="p-3 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
                    <h5 className="text-[13px] font-medium text-[#EDEDED] mb-2">Insurance</h5>
                    <div className="space-y-1.5 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-[#666666]">Provider</span>
                        <span className="text-[#EDEDED]">{station.utilities.insurance.provider}</span>
                      </div>
                      {station.utilities.insurance.policyNumber && (
                        <div className="flex justify-between">
                          <span className="text-[#666666]">Policy #</span>
                          <span className="text-[#EDEDED]">{station.utilities.insurance.policyNumber}</span>
                        </div>
                      )}
                      {station.utilities.insurance.renewalDate && (
                        <div className="flex justify-between items-center">
                          <span className="text-[#666666]">Renewal</span>
                          <span className="text-[#EDEDED]">
                            {formatDate(station.utilities.insurance.renewalDate)}
                            {getDaysUntilRenewal(station.utilities.insurance.renewalDate)! < 30 && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[11px] bg-[#FFB547]/10 text-[#FFB547]">
                                {getDaysUntilRenewal(station.utilities.insurance.renewalDate)}d
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[#1A1A1A]/50 border border-[#2A2A2A]/50">
                    <p className="text-[13px] text-[#666666]">No insurance data</p>
                  </div>
                )}

                {/* Electricity */}
                {station.utilities?.electricity ? (
                  <div className="p-3 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
                    <h5 className="text-[13px] font-medium text-[#EDEDED] mb-2">Electricity</h5>
                    <div className="space-y-1.5 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-[#666666]">Provider</span>
                        <span className="text-[#EDEDED]">{station.utilities.electricity.provider}</span>
                      </div>
                      {station.utilities.electricity.meterId && (
                        <div className="flex justify-between">
                          <span className="text-[#666666]">Meter #</span>
                          <span className="text-[#EDEDED]">{station.utilities.electricity.meterId}</span>
                        </div>
                      )}
                      {station.utilities.electricity.accountNumber && (
                        <div className="flex justify-between">
                          <span className="text-[#666666]">Account #</span>
                          <span className="text-[#EDEDED]">{station.utilities.electricity.accountNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[#1A1A1A]/50 border border-[#2A2A2A]/50">
                    <p className="text-[13px] text-[#666666]">No electricity data</p>
                  </div>
                )}

                {/* Water */}
                {station.utilities?.water ? (
                  <div className="p-3 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
                    <h5 className="text-[13px] font-medium text-[#EDEDED] mb-2">Water</h5>
                    <div className="space-y-1.5 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-[#666666]">Provider</span>
                        <span className="text-[#EDEDED]">{station.utilities.water.provider}</span>
                      </div>
                      {station.utilities.water.accountNumber && (
                        <div className="flex justify-between">
                          <span className="text-[#666666]">Account #</span>
                          <span className="text-[#EDEDED]">{station.utilities.water.accountNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[#1A1A1A]/50 border border-[#2A2A2A]/50">
                    <p className="text-[13px] text-[#666666]">No water data</p>
                  </div>
                )}
              </div>

              {/* Right Column: Council Contact */}
              <div className="bg-[#0B0B0B] p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[14px] font-semibold text-[#EDEDED]">Council Contact</h4>
                  {hasMissingCouncilInfo && (
                    <div className="px-2 py-1 rounded bg-[#FFB547]/10 border border-[#FFB547]/20">
                      <span className="text-[12px] font-medium text-[#FFB547]">Missing Info</span>
                    </div>
                  )}
                </div>
                
                {councilContact && (councilContact.name || councilContact.contactPerson) ? (
                  <div className="p-3 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] space-y-3">
                    {councilContact.name && (
                      <div>
                        <p className="text-[12px] text-[#666666] mb-1">Council Name</p>
                        <p className="text-[13px] text-[#EDEDED] font-medium">{councilContact.name}</p>
                      </div>
                    )}
                    {councilContact.contactPerson && (
                      <div>
                        <p className="text-[12px] text-[#666666] mb-1">Contact Person</p>
                        <p className="text-[13px] text-[#EDEDED] font-medium">{councilContact.contactPerson}</p>
                      </div>
                    )}
                    {councilContact.role && (
                      <div>
                        <p className="text-[12px] text-[#666666] mb-1">Department</p>
                        <p className="text-[13px] text-[#EDEDED]">{councilContact.role}</p>
                      </div>
                    )}
                    {councilContact.phone && (
                      <div>
                        <p className="text-[12px] text-[#666666] mb-1">Phone</p>
                        <a
                          href={`tel:${councilContact.phone}`}
                          className="text-[13px] text-[#00F57A] hover:text-[#00D86A] flex items-center gap-1.5 transition-colors duration-100"
                          data-testid="link-council-phone"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {councilContact.phone}
                        </a>
                      </div>
                    )}
                    {councilContact.email && (
                      <div>
                        <p className="text-[12px] text-[#666666] mb-1">Email</p>
                        <a
                          href={`mailto:${councilContact.email}`}
                          className="text-[13px] text-[#00F57A] hover:text-[#00D86A] flex items-center gap-1.5 break-all transition-colors duration-100"
                          data-testid="link-council-email"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          {councilContact.email}
                        </a>
                      </div>
                    )}
                    {councilContact.notes && (
                      <div>
                        <p className="text-[12px] text-[#666666] mb-1">Notes</p>
                        <p className="text-[13px] text-[#A0A0A0] bg-[#151515] p-2 rounded">{councilContact.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[#1A1A1A]/50 border border-[#2A2A2A]/50">
                    <p className="text-[13px] text-[#666666]">No council contact information</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription className="sr-only">Add a note to the station</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter your note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            data-testid="textarea-note"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addNoteMutation.mutate(noteText)}
              disabled={!noteText.trim() || addNoteMutation.isPending}
              data-testid="button-save-note"
            >
              {addNoteMutation.isPending ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Inventory Dialog */}
      <Dialog open={showSetDialog} onOpenChange={setShowSetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Exact Values</DialogTitle>
            <DialogDescription className="sr-only">Set exact inventory values for the station</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Quantity</label>
              <Input
                type="number"
                min="0"
                value={setQty}
                onChange={(e) => setSetQty(e.target.value)}
                placeholder="Enter quantity"
                data-testid="input-set-qty"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Reorder Level</label>
              <Input
                type="number"
                min="0"
                value={setReorderLevel}
                onChange={(e) => setSetReorderLevel(e.target.value)}
                placeholder="Enter reorder level"
                data-testid="input-set-reorder"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
              <Textarea
                value={setNotes}
                onChange={(e) => setSetNotes(e.target.value)}
                placeholder="Add notes about this item..."
                rows={3}
                data-testid="textarea-set-notes"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowSetDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSet}
              disabled={setInventoryMutation.isPending}
              data-testid="button-save-set"
            >
              {setInventoryMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Station</DialogTitle>
            <DialogDescription className="sr-only">Share station via QR code or link</DialogDescription>
          </DialogHeader>
          <div className="text-center py-4">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4">
              <QRCodeSVG
                value={`https://petwash.co.il/s/${stationId}`}
                size={192}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="text-sm text-gray-600 mb-2 break-all px-2">
              {`https://petwash.co.il/s/${stationId}`}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(`https://petwash.co.il/s/${stationId}`);
                toast({ title: 'Link copied!' });
              }}
              data-testid="button-copy-link"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
