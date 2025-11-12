import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Package,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Zap,
  Droplet,
  FileText,
  Phone,
  Mail,
  Calendar,
} from "lucide-react";

interface StationSheetProps {
  stationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SaveState = "unsaved" | "saving" | "saved";

export function StationSheet({ stationId, open, onOpenChange }: StationSheetProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Save states for each tab
  const [overviewSaveState, setOverviewSaveState] = useState<SaveState>("saved");
  const [inventorySaveState, setInventorySaveState] = useState<SaveState>("saved");
  const [utilitiesSaveState, setUtilitiesSaveState] = useState<SaveState>("saved");
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Overview fields
  const [name, setName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [status, setStatus] = useState<"planned" | "installing" | "active" | "paused" | "decommissioned">("active");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [geoLat, setGeoLat] = useState("");
  const [geoLng, setGeoLng] = useState("");

  // Inventory fields
  const [shampooQty, setShampooQty] = useState(0);
  const [conditionerQty, setConditionerQty] = useState(0);
  const [disinfectantQty, setDisinfectantQty] = useState(0);

  // Utilities & Council fields
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicy, setInsurancePolicy] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [electricityProvider, setElectricityProvider] = useState("");
  const [electricityAccount, setElectricityAccount] = useState("");
  const [waterProvider, setWaterProvider] = useState("");
  const [waterAccount, setWaterAccount] = useState("");
  const [councilName, setCouncilName] = useState("");
  const [councilContact, setCouncilContact] = useState("");
  const [councilPhone, setCouncilPhone] = useState("");
  const [councilEmail, setCouncilEmail] = useState("");
  const [permitNumber, setPermitNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch station details
  const { data: stationData, isLoading } = useQuery<{
    station: any;
    inventory: Record<string, any>;
    events: any[];
  }>({
    queryKey: [`/api/admin/stations/${stationId}`],
    enabled: !!stationId && open,
  });

  // Load data into form fields when station loads
  useEffect(() => {
    if (stationData?.station) {
      const s = stationData.station;
      setName(s.name || "");
      setSerialNumber(s.serialNumber || "");
      setStatus(s.status || "active");
      setAddressLine1(s.address?.line1 || "");
      setAddressLine2(s.address?.line2 || "");
      setCity(s.address?.city || "");
      setPostcode(s.address?.postcode || "");
      setGeoLat(s.geo?.lat?.toString() || "");
      setGeoLng(s.geo?.lng?.toString() || "");

      // Utilities
      setInsuranceProvider(s.utilities?.insurance?.provider || "");
      setInsurancePolicy(s.utilities?.insurance?.policyNumber || "");
      setInsuranceExpiry(s.utilities?.insurance?.renewalDate || "");
      setElectricityProvider(s.utilities?.electricity?.provider || "");
      setElectricityAccount(s.utilities?.electricity?.accountNumber || "");
      setWaterProvider(s.utilities?.water?.provider || "");
      setWaterAccount(s.utilities?.water?.accountNumber || "");
      setCouncilName(s.utilities?.council?.name || "");
      setCouncilContact(s.utilities?.council?.contactName || "");
      setCouncilPhone(s.utilities?.council?.contactPhone || "");
      setCouncilEmail(s.utilities?.council?.contactEmail || "");
      setPermitNumber(s.utilities?.council?.permitNumber || "");
      setNotes(s.notes || "");

      // Reset save states
      setOverviewSaveState("saved");
      setInventorySaveState("saved");
      setUtilitiesSaveState("saved");
    }

    // Load inventory
    if (stationData?.inventory) {
      setShampooQty(stationData.inventory.shampoo?.qty || 0);
      setConditionerQty(stationData.inventory.conditioner?.qty || 0);
      setDisinfectantQty(stationData.inventory.disinfectant?.qty || 0);
    }
  }, [stationData]);

  // Update Overview mutation
  const updateOverviewMutation = useMutation({
    mutationFn: async () => {
      if (!stationId) throw new Error('No station ID');

      // Validation
      if (!name.trim()) {
        throw new Error('Station name is required');
      }
      if (!serialNumber.trim()) {
        throw new Error('Serial number is required');
      }
      if (!city.trim()) {
        throw new Error('City is required');
      }
      if (!postcode.trim()) {
        throw new Error('Postcode is required');
      }
      if (geoLat && geoLng) {
        const lat = parseFloat(geoLat);
        const lng = parseFloat(geoLng);
        if (isNaN(lat) || isNaN(lng)) {
          throw new Error('Invalid GPS coordinates');
        }
        if (lat < 29 || lat > 33.5 || lng < 34 || lng > 36) {
          throw new Error('GPS coordinates must be within Israel');
        }
      }

      const updates = {
        name,
        serialNumber,
        status,
        address: {
          line1: addressLine1,
          line2: addressLine2,
          city,
          postcode,
          country: "IL",
        },
        geo: geoLat && geoLng ? {
          lat: parseFloat(geoLat),
          lng: parseFloat(geoLng),
        } : undefined,
      };

      const res = await apiRequest('PUT', `/api/admin/stations/${stationId}`, updates);
      return await res.json();
    },
    onMutate: () => {
      setOverviewSaveState("saving");
    },
    onSuccess: (data) => {
      setOverviewSaveState(prev => prev === "saving" ? "saved" : prev);
      toast({
        title: "Success",
        description: data.message || "Station updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stations'] });
    },
    onError: (error: any) => {
      setOverviewSaveState("unsaved");
      toast({
        title: "Error",
        description: error.message || "Failed to update station",
        variant: "destructive",
      });
    },
  });

  // Update Inventory mutation
  const updateInventoryMutation = useMutation({
    mutationFn: async () => {
      if (!stationId) throw new Error('No station ID');

      // Validation
      if (shampooQty < 0 || conditionerQty < 0 || disinfectantQty < 0) {
        throw new Error('Quantities cannot be negative');
      }
      if (isNaN(shampooQty) || isNaN(conditionerQty) || isNaN(disinfectantQty)) {
        throw new Error('Quantities must be valid numbers');
      }

      // Update each inventory item
      const items = [
        { id: 'shampoo', qty: shampooQty },
        { id: 'conditioner', qty: conditionerQty },
        { id: 'disinfectant', qty: disinfectantQty },
      ];

      for (const item of items) {
        await apiRequest('PUT', `/api/admin/stations/${stationId}/inventory/${item.id}`, { qty: item.qty });
      }

      return { success: true };
    },
    onMutate: () => {
      setInventorySaveState("saving");
    },
    onSuccess: () => {
      setInventorySaveState(prev => prev === "saving" ? "saved" : prev);
      toast({
        title: "Success",
        description: "Inventory updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stations', stationId] });
    },
    onError: (error: any) => {
      setInventorySaveState("unsaved");
      toast({
        title: "Error",
        description: error.message || "Failed to update inventory",
        variant: "destructive",
      });
    },
  });

  // Update Utilities mutation
  const updateUtilitiesMutation = useMutation({
    mutationFn: async () => {
      if (!stationId) throw new Error('No station ID');

      // Validation
      if (councilEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(councilEmail)) {
        throw new Error('Invalid council email address');
      }
      if (councilPhone && !/^[\d\s\-\+\(\)]+$/.test(councilPhone)) {
        throw new Error('Invalid council phone number format');
      }

      const updates = {
        utilities: {
          insurance: {
            provider: insuranceProvider,
            policyNumber: insurancePolicy,
            renewalDate: insuranceExpiry,
          },
          electricity: {
            provider: electricityProvider,
            accountNumber: electricityAccount,
          },
          water: {
            provider: waterProvider,
            accountNumber: waterAccount,
          },
          council: {
            name: councilName,
            contactName: councilContact,
            contactPhone: councilPhone,
            contactEmail: councilEmail,
            permitNumber: permitNumber,
          },
        },
        notes,
      };

      const res = await apiRequest('PUT', `/api/admin/stations/${stationId}`, updates);
      return await res.json();
    },
    onMutate: () => {
      setUtilitiesSaveState("saving");
    },
    onSuccess: (data) => {
      setUtilitiesSaveState(prev => prev === "saving" ? "saved" : prev);
      toast({
        title: "Success",
        description: data.message || "Utilities updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stations'] });
    },
    onError: (error: any) => {
      setUtilitiesSaveState("unsaved");
      toast({
        title: "Error",
        description: error.message || "Failed to update utilities",
        variant: "destructive",
      });
    },
  });

  // Save button renderer
  const SaveButton = ({ saveState, onClick, disabled }: { saveState: SaveState; onClick: () => void; disabled?: boolean }) => {
    const config = {
      unsaved: {
        icon: AlertCircle,
        text: "Unsaved Changes",
        className: "bg-yellow-500 hover:bg-yellow-600 text-white",
      },
      saving: {
        icon: Loader2,
        text: "Saving...",
        className: "bg-blue-500 text-white cursor-not-allowed",
      },
      saved: {
        icon: CheckCircle2,
        text: "Saved ✓",
        className: "bg-green-500 hover:bg-green-600 text-white",
      },
    };

    const { icon: Icon, text, className } = config[saveState];

    return (
      <Button
        onClick={onClick}
        disabled={disabled || saveState === "saving"}
        className={className}
        size="sm"
        data-testid={`button-save-${activeTab}`}
      >
        <Icon className={`w-4 h-4 mr-2 ${saveState === "saving" ? "animate-spin" : ""}`} />
        {text}
      </Button>
    );
  };

  // Get current tab's save state
  const currentSaveState = activeTab === "overview" 
    ? overviewSaveState 
    : activeTab === "inventory" 
    ? inventorySaveState 
    : utilitiesSaveState;

  // Auto-dismiss success toast after 3 seconds
  useEffect(() => {
    if (currentSaveState === "saved" && stationData) {
      setShowSuccessToast(true);
      const timer = setTimeout(() => {
        setShowSuccessToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowSuccessToast(false);
    }
  }, [currentSaveState, stationData]);

  // Get current tab's mutation
  const currentMutation = activeTab === "overview"
    ? updateOverviewMutation
    : activeTab === "inventory"
    ? updateInventoryMutation
    : updateUtilitiesMutation;

  // Handle save for current tab
  const handleSave = () => {
    currentMutation.mutate();
    logger.info(`[StationSheet] Saving ${activeTab} for station ${stationId}`);
  };

  // Handle cancel - revert to original data
  const handleCancel = () => {
    if (stationData?.station) {
      const s = stationData.station;
      if (activeTab === "overview") {
        setName(s.name || "");
        setSerialNumber(s.serialNumber || "");
        setStatus(s.status || "active");
        setAddressLine1(s.address?.line1 || "");
        setAddressLine2(s.address?.line2 || "");
        setCity(s.address?.city || "");
        setPostcode(s.address?.postcode || "");
        setGeoLat(s.geo?.lat?.toString() || "");
        setGeoLng(s.geo?.lng?.toString() || "");
        setOverviewSaveState("saved");
      } else if (activeTab === "inventory" && stationData.inventory) {
        setShampooQty(stationData.inventory.shampoo?.qty || 0);
        setConditionerQty(stationData.inventory.conditioner?.qty || 0);
        setDisinfectantQty(stationData.inventory.disinfectant?.qty || 0);
        setInventorySaveState("saved");
      } else {
        setInsuranceProvider(s.utilities?.insurance?.provider || "");
        setInsurancePolicy(s.utilities?.insurance?.policyNumber || "");
        setInsuranceExpiry(s.utilities?.insurance?.renewalDate || "");
        setElectricityProvider(s.utilities?.electricity?.provider || "");
        setElectricityAccount(s.utilities?.electricity?.accountNumber || "");
        setWaterProvider(s.utilities?.water?.provider || "");
        setWaterAccount(s.utilities?.water?.accountNumber || "");
        setCouncilName(s.utilities?.council?.name || "");
        setCouncilContact(s.utilities?.council?.contactName || "");
        setCouncilPhone(s.utilities?.council?.contactPhone || "");
        setCouncilEmail(s.utilities?.council?.contactEmail || "");
        setPermitNumber(s.utilities?.council?.permitNumber || "");
        setNotes(s.notes || "");
        setUtilitiesSaveState("saved");
      }
    }
    toast({
      title: "Changes Discarded",
      description: "Form has been reset to saved values",
    });
  };

  if (!stationId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto pb-24">
        <SheetHeader className="space-y-3">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-xl font-bold">{stationData?.station?.name || "Station Details"}</div>
              <div className="text-sm font-normal text-slate-500 mt-1">
                Full Management System
              </div>
            </div>
          </SheetTitle>
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg">
              <Badge variant="outline" className="font-mono text-xs">ID</Badge>
              <span className="font-mono text-xs text-slate-700 font-semibold">{stationId}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                {stationData?.station?.serialNumber}
              </span>
              <span className="text-slate-600">•</span>
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {stationData?.station?.address?.city}
              </span>
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" data-testid="tab-overview">
                <MapPin className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="inventory" data-testid="tab-inventory">
                <Package className="w-4 h-4 mr-2" />
                Inventory
              </TabsTrigger>
              <TabsTrigger value="utilities" data-testid="tab-utilities">
                <Shield className="w-4 h-4 mr-2" />
                Utilities
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Station Information</CardTitle>
                  <CardDescription>Basic details and location</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Station Name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setOverviewSaveState("unsaved");
                        }}
                        placeholder="Pet Wash Station #1"
                        data-testid="input-station-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serialNumber">Serial Number</Label>
                      <Input
                        id="serialNumber"
                        value={serialNumber}
                        onChange={(e) => {
                          setSerialNumber(e.target.value);
                          setOverviewSaveState("unsaved");
                        }}
                        placeholder="PW-IL-00001"
                        data-testid="input-serial-number"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={status} onValueChange={(v: any) => {
                      setStatus(v);
                      setOverviewSaveState("unsaved");
                    }}>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="installing">Installing</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="decommissioned">Decommissioned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="addressLine1">Address Line 1</Label>
                    <Input
                      id="addressLine1"
                      value={addressLine1}
                      onChange={(e) => {
                        setAddressLine1(e.target.value);
                        setOverviewSaveState("unsaved");
                      }}
                      placeholder="123 Main Street"
                      data-testid="input-address-line1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
                    <Input
                      id="addressLine2"
                      value={addressLine2}
                      onChange={(e) => {
                        setAddressLine2(e.target.value);
                        setOverviewSaveState("unsaved");
                      }}
                      placeholder="Apartment, Suite, etc."
                      data-testid="input-address-line2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => {
                          setCity(e.target.value);
                          setOverviewSaveState("unsaved");
                        }}
                        placeholder="Tel Aviv"
                        data-testid="input-city"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postcode">Postcode</Label>
                      <Input
                        id="postcode"
                        value={postcode}
                        onChange={(e) => {
                          setPostcode(e.target.value);
                          setOverviewSaveState("unsaved");
                        }}
                        placeholder="6100001"
                        data-testid="input-postcode"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="geoLat">Latitude</Label>
                      <Input
                        id="geoLat"
                        value={geoLat}
                        onChange={(e) => {
                          setGeoLat(e.target.value);
                          setOverviewSaveState("unsaved");
                        }}
                        placeholder="32.0853"
                        type="number"
                        step="0.000001"
                        data-testid="input-geo-lat"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="geoLng">Longitude</Label>
                      <Input
                        id="geoLng"
                        value={geoLng}
                        onChange={(e) => {
                          setGeoLng(e.target.value);
                          setOverviewSaveState("unsaved");
                        }}
                        placeholder="34.7818"
                        type="number"
                        step="0.000001"
                        data-testid="input-geo-lng"
                      />
                    </div>
                  </div>

                </CardContent>
              </Card>
            </TabsContent>

            {/* Inventory Tab */}
            <TabsContent value="inventory" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Inventory Levels</CardTitle>
                  <CardDescription>Current stock quantities (in Liters)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="shampoo">Shampoo (L)</Label>
                    <Input
                      id="shampoo"
                      type="number"
                      value={shampooQty}
                      onChange={(e) => {
                        setShampooQty(parseFloat(e.target.value) || 0);
                        setInventorySaveState("unsaved");
                      }}
                      min="0"
                      step="0.1"
                      data-testid="input-shampoo-qty"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conditioner">Conditioner (L)</Label>
                    <Input
                      id="conditioner"
                      type="number"
                      value={conditionerQty}
                      onChange={(e) => {
                        setConditionerQty(parseFloat(e.target.value) || 0);
                        setInventorySaveState("unsaved");
                      }}
                      min="0"
                      step="0.1"
                      data-testid="input-conditioner-qty"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="disinfectant">Disinfectant (L)</Label>
                    <Input
                      id="disinfectant"
                      type="number"
                      value={disinfectantQty}
                      onChange={(e) => {
                        setDisinfectantQty(parseFloat(e.target.value) || 0);
                        setInventorySaveState("unsaved");
                      }}
                      min="0"
                      step="0.1"
                      data-testid="input-disinfectant-qty"
                    />
                  </div>

                </CardContent>
              </Card>
            </TabsContent>

            {/* Utilities & Council Tab */}
            <TabsContent value="utilities" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Insurance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="insuranceProvider">Provider</Label>
                      <Input
                        id="insuranceProvider"
                        value={insuranceProvider}
                        onChange={(e) => {
                          setInsuranceProvider(e.target.value);
                          setUtilitiesSaveState("unsaved");
                        }}
                        placeholder="AIG Israel"
                        data-testid="input-insurance-provider"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="insurancePolicy">Policy Number</Label>
                      <Input
                        id="insurancePolicy"
                        value={insurancePolicy}
                        onChange={(e) => {
                          setInsurancePolicy(e.target.value);
                          setUtilitiesSaveState("unsaved");
                        }}
                        placeholder="POL-123456"
                        data-testid="input-insurance-policy"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="insuranceExpiry">Expiry Date</Label>
                    <Input
                      id="insuranceExpiry"
                      type="date"
                      value={insuranceExpiry}
                      onChange={(e) => {
                        setInsuranceExpiry(e.target.value);
                        setUtilitiesSaveState("unsaved");
                      }}
                      data-testid="input-insurance-expiry"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Electricity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="electricityProvider">Provider</Label>
                      <Input
                        id="electricityProvider"
                        value={electricityProvider}
                        onChange={(e) => {
                          setElectricityProvider(e.target.value);
                          setUtilitiesSaveState("unsaved");
                        }}
                        placeholder="Israel Electric Corporation"
                        data-testid="input-electricity-provider"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="electricityAccount">Account Number</Label>
                      <Input
                        id="electricityAccount"
                        value={electricityAccount}
                        onChange={(e) => {
                          setElectricityAccount(e.target.value);
                          setUtilitiesSaveState("unsaved");
                        }}
                        placeholder="1234567890"
                        data-testid="input-electricity-account"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Droplet className="w-5 h-5" />
                    Water
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="waterProvider">Provider</Label>
                      <Input
                        id="waterProvider"
                        value={waterProvider}
                        onChange={(e) => {
                          setWaterProvider(e.target.value);
                          setUtilitiesSaveState("unsaved");
                        }}
                        placeholder="Mekorot"
                        data-testid="input-water-provider"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="waterAccount">Account Number</Label>
                      <Input
                        id="waterAccount"
                        value={waterAccount}
                        onChange={(e) => {
                          setWaterAccount(e.target.value);
                          setUtilitiesSaveState("unsaved");
                        }}
                        placeholder="9876543210"
                        data-testid="input-water-account"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-600" />
                    Municipal Council & Contacts
                  </CardTitle>
                  <CardDescription>Primary point of contact for station operations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="councilName" className="font-semibold">Council Name</Label>
                      <Input
                        id="councilName"
                        value={councilName}
                        onChange={(e) => {
                          setCouncilName(e.target.value);
                          setUtilitiesSaveState("unsaved");
                        }}
                        placeholder="Tel Aviv-Yafo Municipality"
                        className="font-medium"
                        data-testid="input-council-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="councilContact" className="font-semibold">Contact Name</Label>
                      <Input
                        id="councilContact"
                        value={councilContact}
                        onChange={(e) => {
                          setCouncilContact(e.target.value);
                          setUtilitiesSaveState("unsaved");
                        }}
                        placeholder="David Cohen"
                        className="font-medium"
                        data-testid="input-council-contact"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="councilPhone" className="font-semibold flex items-center gap-1">
                        <Phone className="w-3 h-3 text-green-500" />
                        Phone
                      </Label>
                      <Input
                        id="councilPhone"
                        value={councilPhone}
                        onChange={(e) => {
                          setCouncilPhone(e.target.value);
                          setUtilitiesSaveState("unsaved");
                        }}
                        placeholder="+972-3-5217777"
                        className="font-medium"
                        data-testid="input-council-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="councilEmail" className="font-semibold flex items-center gap-1">
                        <Mail className="w-3 h-3 text-blue-500" />
                        Email
                      </Label>
                      <Input
                        id="councilEmail"
                        type="email"
                        value={councilEmail}
                        onChange={(e) => {
                          setCouncilEmail(e.target.value);
                          setUtilitiesSaveState("unsaved");
                        }}
                        placeholder="permits@tel-aviv.gov.il"
                        data-testid="input-council-email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="permitNumber">Permit Number</Label>
                    <Input
                      id="permitNumber"
                      value={permitNumber}
                      onChange={(e) => {
                        setPermitNumber(e.target.value);
                        setUtilitiesSaveState("unsaved");
                      }}
                      placeholder="TLV-2025-PET-001"
                      data-testid="input-permit-number"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setUtilitiesSaveState("unsaved");
                    }}
                    placeholder="Additional notes about this station..."
                    rows={4}
                    data-testid="input-notes"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Sticky Bottom Save Bar */}
        {(currentSaveState === "unsaved" || currentSaveState === "saving") && (
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent dark:from-gray-900 dark:via-gray-900 p-4 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50">
            <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
              <div className="flex items-center gap-2 text-sm">
                {currentSaveState === "unsaved" ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="font-medium text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <span className="font-medium text-blue-700 dark:text-blue-400">Saving...</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={currentSaveState === "saving"}
                  data-testid="button-cancel-changes"
                  className="border-gray-300 dark:border-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={currentSaveState === "saving"}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                  data-testid="button-save-changes"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Success Indicator - Auto-dismisses after 3s */}
        {showSuccessToast && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Saved ✓</span>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
