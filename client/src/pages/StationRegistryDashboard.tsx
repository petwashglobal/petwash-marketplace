import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MapPin, Activity, AlertCircle, CheckCircle, XCircle, QrCode } from "lucide-react";
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";

export default function StationRegistryDashboard() {
  const [view, setView] = useState<"all" | "active">("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [stationType, setStationType] = useState<string>("k9000");
  const [ownershipType, setOwnershipType] = useState<string>("corporate");
  const [operatingStatus, setOperatingStatus] = useState<string>("active");
  const [stationAddress, setStationAddress] = useState("");
  const [stationCity, setStationCity] = useState("");
  const [stationCountry, setStationCountry] = useState("IL");
  const [stationPostalCode, setStationPostalCode] = useState("");
  const [stationLat, setStationLat] = useState("");
  const [stationLng, setStationLng] = useState("");
  const { toast } = useToast();

  const { data: stations, isLoading } = useQuery({
    queryKey: ["/api/enterprise/corporate/stations", view],
    queryFn: async () => {
      const endpoint = view === "active" 
        ? "/api/enterprise/corporate/stations?filter=active"
        : "/api/enterprise/corporate/stations";
      const response = await fetch(endpoint, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch stations");
      return response.json();
    },
  });

  const createStationMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/enterprise/corporate/stations`, { method: "POST", body: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/corporate/stations"] });
      setShowCreateDialog(false);
      toast({ title: "Success", description: "Station created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create station", variant: "destructive" });
    },
  });

  const handleCreateStation = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const coordinates = (stationLat && stationLng)
      ? { lat: parseFloat(stationLat), lng: parseFloat(stationLng) }
      : (formData.get("lat") && formData.get("lng"))
        ? { lat: parseFloat(formData.get("lat") as string), lng: parseFloat(formData.get("lng") as string) }
        : null;

    if (!stationAddress.trim()) {
      toast({ title: "Error", description: "Address is required", variant: "destructive" });
      return;
    }
    if (!stationCity.trim()) {
      toast({ title: "Error", description: "City is required", variant: "destructive" });
      return;
    }

    const data = {
      stationId: formData.get("stationId"),
      stationName: formData.get("stationName"),
      stationNameHe: formData.get("stationNameHe"),
      address: stationAddress,
      city: stationCity,
      region: formData.get("region"),
      country: stationCountry,
      postalCode: stationPostalCode,
      coordinates,
      stationType: stationType,
      ownershipType: ownershipType,
      operatingStatus: operatingStatus,
      installDate: formData.get("installDate") || null,
      nayaxTerminalId: formData.get("nayaxTerminalId"),
      equipmentSerial: formData.get("equipmentSerial"),
      isActive: true,
    };
    
    createStationMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; icon: any }> = {
      active: { className: "luxury-badge luxury-badge-success", icon: <CheckCircle className="w-3 h-3" /> },
      inactive: { className: "luxury-badge", icon: <XCircle className="w-3 h-3" /> },
      maintenance: { className: "luxury-badge luxury-badge-gold", icon: <AlertCircle className="w-3 h-3" /> },
      closed: { className: "luxury-badge", icon: <XCircle className="w-3 h-3" /> },
    };
    const config = variants[status] || variants.active;
    return (
      <span className={config.className}>
        {config.icon}
        {status}
      </span>
    );
  };

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title="Station Registry"
      subtitle="Pet ⁦Wash Hub™⁩ Canonical ID Management"
    >
      <div className="p-6 space-y-6">
      <div className="flex justify-end items-center luxury-animate-fade-in">
        <button onClick={() => setShowCreateDialog(true)} className="luxury-btn-primary" data-testid="button-create-station">
          <Plus className="w-4 h-4 mr-2" />
          Register New Station
        </button>
      </div>

      <div className="flex gap-2 luxury-animate-slide-up luxury-delay-1">
        <button
          className={view === "all" ? "luxury-btn-primary" : "luxury-btn-secondary"}
          onClick={() => setView("all")}
          data-testid="button-view-all"
        >
          All Stations ({stations?.length || 0})
        </button>
        <button
          className={view === "active" ? "luxury-btn-primary" : "luxury-btn-secondary"}
          onClick={() => setView("active")}
          data-testid="button-view-active"
        >
          Active Only
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : stations?.length === 0 ? (
        <div className="luxury-glass-card luxury-shadow-xl p-12 text-center luxury-animate-scale-in luxury-delay-2">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center">
            <MapPin className="w-10 h-10 text-purple-600" />
          </div>
          <h3 className="luxury-heading-md mb-3">No stations registered</h3>
          <p className="luxury-text-body mb-6">Get started by registering your first Pet ⁦Wash Hub™⁩</p>
          <button onClick={() => setShowCreateDialog(true)} className="luxury-btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Register Station
          </button>
        </div>
      ) : (
        <div className="luxury-grid-3">
          {stations?.map((station: any, index: number) => (
            <div 
              key={station.id} 
              className="luxury-glass-card luxury-hover-glow luxury-shadow-xl cursor-pointer luxury-animate-fade-in"
              style={{ animationDelay: `${0.1 * (index + 1)}s` }}
              onClick={() => setSelectedStation(station)}
              data-testid={`station-card-${station.id}`}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1 flex-1">
                    <h3 className="luxury-heading-sm">{station.stationName}</h3>
                    {station.stationNameHe && (
                      <p className="luxury-text-small opacity-75" dir="rtl">{station.stationNameHe}</p>
                    )}
                    <p className="text-xs font-mono text-purple-600">{station.stationId}</p>
                  </div>
                  {getStatusBadge(station.operatingStatus)}
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-purple-600 flex-shrink-0" />
                    <span className="luxury-text-small">{station.city}, {station.country}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-600" />
                    <span className="luxury-text-small">
                      {station.totalWashes || 0} washes • {station.ownershipType}
                    </span>
                  </div>
                  {station.nayaxTerminalId && (
                    <div className="luxury-glass-minimal p-2 rounded-lg">
                      <span className="text-xs font-mono">Terminal: {station.nayaxTerminalId}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setStationAddress("");
          setStationCity("");
          setStationCountry("IL");
          setStationPostalCode("");
          setStationLat("");
          setStationLng("");
          setStationType("k9000");
          setOwnershipType("corporate");
          setOperatingStatus("active");
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-station">
          <DialogHeader>
            <DialogTitle>Register New Station</DialogTitle>
            <DialogDescription>Add a new Pet ⁦Wash Hub™⁩ to the canonical registry</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateStation} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="stationId">Station ID (Canonical) *</Label>
                <Input 
                  id="stationId" 
                  name="stationId" 
                  placeholder="PWH-IL-TEL-001" 
                  required 
                  data-testid="input-station-id" 
                />
                <p className="text-xs text-muted-foreground mt-1">Format: PWH-[COUNTRY]-[CITY]-[NUMBER]</p>
              </div>
              <div>
                <Label htmlFor="stationName">Station Name (English) *</Label>
                <Input id="stationName" name="stationName" required data-testid="input-station-name" />
              </div>
              <div>
                <Label htmlFor="stationNameHe">Station Name (Hebrew)</Label>
                <Input id="stationNameHe" name="stationNameHe" dir="rtl" data-testid="input-station-name-he" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Address *</Label>
                <GooglePlacesAutocomplete
                  value={stationAddress}
                  onChange={(value, details) => {
                    setStationAddress(value);
                    if (details) {
                      if (details.city) setStationCity(details.city);
                      if (details.country) setStationCountry(details.country);
                      if (details.postalCode) setStationPostalCode(details.postalCode);
                      if (details.lat) setStationLat(details.lat.toString());
                      if (details.lng) setStationLng(details.lng.toString());
                    }
                  }}
                  placeholder="Start typing address..."
                  country={['il']}
                />
              </div>
              <div>
                <Label htmlFor="city">City *</Label>
                <Input id="city" name="city" value={stationCity} onChange={e => setStationCity(e.target.value)} required data-testid="input-city" />
              </div>
              <div>
                <Label htmlFor="region">Region/State</Label>
                <Input id="region" name="region" data-testid="input-region" />
              </div>
              <div>
                <Label htmlFor="country">Country *</Label>
                <Input id="country" name="country" value={stationCountry} onChange={e => setStationCountry(e.target.value)} required data-testid="input-country" />
              </div>
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input id="postalCode" name="postalCode" value={stationPostalCode} onChange={e => setStationPostalCode(e.target.value)} data-testid="input-postal-code" />
              </div>
              <div>
                <Label htmlFor="lat">Latitude</Label>
                <Input id="lat" name="lat" type="number" step="any" placeholder="32.0853" value={stationLat} onChange={e => setStationLat(e.target.value)} data-testid="input-latitude" />
              </div>
              <div>
                <Label htmlFor="lng">Longitude</Label>
                <Input id="lng" name="lng" type="number" step="any" placeholder="34.7818" value={stationLng} onChange={e => setStationLng(e.target.value)} data-testid="input-longitude" />
              </div>
              <div>
                <Label htmlFor="stationType">Station Type</Label>
                <Select value={stationType} onValueChange={setStationType}>
                  <SelectTrigger data-testid="select-station-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="k9000">K9000 Twin Bay</SelectItem>
                    <SelectItem value="mobile">Mobile Unit</SelectItem>
                    <SelectItem value="popup">Pop-up Station</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ownershipType">Ownership Type</Label>
                <Select value={ownershipType} onValueChange={setOwnershipType}>
                  <SelectTrigger data-testid="select-ownership-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corporate">Corporate-Owned</SelectItem>
                    <SelectItem value="franchise">Franchise</SelectItem>
                    <SelectItem value="partner">JV Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="operatingStatus">Operating Status</Label>
                <Select value={operatingStatus} onValueChange={setOperatingStatus}>
                  <SelectTrigger data-testid="select-operating-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="installDate">Install Date</Label>
                <Input id="installDate" name="installDate" type="date" data-testid="input-install-date" />
              </div>
              <div>
                <Label htmlFor="nayaxTerminalId">Nayax Terminal ID</Label>
                <Input id="nayaxTerminalId" name="nayaxTerminalId" data-testid="input-nayax-terminal" />
              </div>
              <div>
                <Label htmlFor="equipmentSerial">Equipment Serial #</Label>
                <Input id="equipmentSerial" name="equipmentSerial" placeholder="K9-2025-001" data-testid="input-equipment-serial" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createStationMutation.isPending} data-testid="button-submit-station">
                {createStationMutation.isPending ? "Registering..." : "Register Station"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedStation} onOpenChange={() => setSelectedStation(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-station-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {selectedStation?.stationName}
            </DialogTitle>
            <DialogDescription>{selectedStation?.stationId}</DialogDescription>
          </DialogHeader>
          {selectedStation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedStation.operatingStatus)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="mt-1 capitalize">{selectedStation.stationType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Ownership</Label>
                  <p className="mt-1 capitalize">{selectedStation.ownershipType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Washes</Label>
                  <p className="mt-1 font-semibold">{selectedStation.totalWashes || 0}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Address</Label>
                  <p className="mt-1">{selectedStation.address}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedStation.city}, {selectedStation.region && `${selectedStation.region}, `}{selectedStation.country} {selectedStation.postalCode}
                  </p>
                </div>
                {selectedStation.coordinates && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Coordinates</Label>
                    <p className="mt-1 font-mono text-sm">
                      {selectedStation.coordinates.lat}, {selectedStation.coordinates.lng}
                    </p>
                  </div>
                )}
                {selectedStation.nayaxTerminalId && (
                  <div>
                    <Label className="text-muted-foreground">Nayax Terminal</Label>
                    <p className="mt-1 font-mono text-sm">{selectedStation.nayaxTerminalId}</p>
                  </div>
                )}
                {selectedStation.equipmentSerial && (
                  <div>
                    <Label className="text-muted-foreground">Equipment Serial</Label>
                    <p className="mt-1 font-mono text-sm">{selectedStation.equipmentSerial}</p>
                  </div>
                )}
                {selectedStation.installDate && (
                  <div>
                    <Label className="text-muted-foreground">Install Date</Label>
                    <p className="mt-1">{new Date(selectedStation.installDate).toLocaleDateString()}</p>
                  </div>
                )}
                {selectedStation.lastMaintenanceDate && (
                  <div>
                    <Label className="text-muted-foreground">Last Maintenance</Label>
                    <p className="mt-1">{new Date(selectedStation.lastMaintenanceDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
              
              {selectedStation.qrCode && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <QrCode className="w-5 h-5" />
                    <Label>Station QR Code</Label>
                  </div>
                  <div className="flex justify-center">
                    <img src={selectedStation.qrCode} alt="Station QR Code" className="w-48 h-48" />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </LuxuryPageWrapper>
  );
}
