import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Package,
  Warehouse,
  Truck,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function LogisticsDashboard() {
  const [showWarehouseDialog, setShowWarehouseDialog] = useState(false);
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [showFulfillmentDialog, setShowFulfillmentDialog] = useState(false);
  const [fulfillmentOrderType, setFulfillmentOrderType] = useState("station_restock");
  const [fulfillmentPriority, setFulfillmentPriority] = useState("normal");
  const [inventoryCategory, setInventoryCategory] = useState("shampoo");
  const { toast } = useToast();

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["/api/enterprise/logistics/warehouses"],
  });

  const { data: warehouseUtilization } = useQuery({
    queryKey: ["/api/enterprise/logistics/warehouses/utilization"],
  });

  const { data: inventory, isLoading: inventoryLoading } = useQuery({
    queryKey: ["/api/enterprise/logistics/inventory"],
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ["/api/enterprise/logistics/inventory/low-stock"],
  });

  const { data: expiringItems } = useQuery({
    queryKey: ["/api/enterprise/logistics/inventory/expiring"],
  });

  const { data: fulfillmentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/enterprise/logistics/fulfillment-orders"],
  });

  const { data: pendingOrders } = useQuery({
    queryKey: ["/api/enterprise/logistics/fulfillment-orders/pending"],
  });

  const createWarehouseMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/logistics/warehouses`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/logistics/warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/logistics/warehouses/utilization"] });
      setShowWarehouseDialog(false);
      toast({ title: "Success", description: "Warehouse created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create warehouse", variant: "destructive" });
    },
  });

  const createInventoryMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/logistics/inventory`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/logistics/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/logistics/inventory/low-stock"] });
      setShowInventoryDialog(false);
      toast({ title: "Success", description: "Inventory item created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create inventory item", variant: "destructive" });
    },
  });

  const createFulfillmentMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/logistics/fulfillment-orders`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/logistics/fulfillment-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/logistics/fulfillment-orders/pending"] });
      setShowFulfillmentDialog(false);
      toast({ title: "Success", description: "Fulfillment order created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create fulfillment order", variant: "destructive" });
    },
  });

  const shipOrderMutation = useMutation({
    mutationFn: async ({ id, trackingNumber, carrier }: { id: number; trackingNumber: string; carrier: string }) =>
      apiRequest(`/api/enterprise/logistics/fulfillment-orders/${id}/ship`, { method: "POST", body: { trackingNumber, carrier } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/logistics/fulfillment-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/logistics/fulfillment-orders/pending"] });
      toast({ title: "Success", description: "Order marked as shipped" });
    },
  });

  const deliverOrderMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest(`/api/enterprise/logistics/fulfillment-orders/${id}/deliver`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/logistics/fulfillment-orders"] });
      toast({ title: "Success", description: "Order marked as delivered" });
    },
  });

  const handleCreateWarehouse = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      warehouseId: formData.get("warehouseId"),
      name: formData.get("name"),
      address: formData.get("address"),
      city: formData.get("city"),
      country: formData.get("country") || "IL",
      capacity: formData.get("capacity") ? parseInt(formData.get("capacity") as string) : undefined,
      currentUtilization: formData.get("currentUtilization") || "0",
      managerEmployeeId: formData.get("managerEmployeeId") ? parseInt(formData.get("managerEmployeeId") as string) : undefined,
    };
    createWarehouseMutation.mutate(data);
  };

  const handleCreateInventory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      sku: formData.get("sku"),
      productName: formData.get("productName"),
      productNameHe: formData.get("productNameHe"),
      category: inventoryCategory,
      warehouseId: formData.get("warehouseId") ? parseInt(formData.get("warehouseId") as string) : undefined,
      quantity: formData.get("quantity") ? parseInt(formData.get("quantity") as string) : 0,
      unit: formData.get("unit") || "units",
      reorderLevel: formData.get("reorderLevel") ? parseInt(formData.get("reorderLevel") as string) : 0,
      reorderQuantity: formData.get("reorderQuantity") ? parseInt(formData.get("reorderQuantity") as string) : 0,
      unitCost: formData.get("unitCost") || undefined,
      locationInWarehouse: formData.get("locationInWarehouse") || undefined,
    };
    createInventoryMutation.mutate(data);
  };

  const handleCreateFulfillment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const itemsRaw = formData.get("items") as string;
    const items = itemsRaw ? JSON.parse(itemsRaw) : [];
    const data = {
      orderId: formData.get("orderId"),
      orderType: fulfillmentOrderType,
      stationId: formData.get("stationId") || undefined,
      warehouseId: formData.get("warehouseId") ? parseInt(formData.get("warehouseId") as string) : undefined,
      items,
      priority: fulfillmentPriority,
      deliveryAddress: formData.get("deliveryAddress") || undefined,
      deliveryNotes: formData.get("deliveryNotes") || undefined,
      estimatedDelivery: formData.get("estimatedDelivery") || undefined,
    };
    createFulfillmentMutation.mutate(data);
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: "bg-blue-500",
      normal: "bg-green-500",
      high: "bg-orange-500",
      urgent: "bg-red-500",
    };
    return colors[priority] || "bg-gray-500";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      picking: "bg-blue-500",
      packing: "bg-indigo-500",
      shipped: "bg-purple-500",
      delivered: "bg-green-500",
      cancelled: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Logistics Management</h1>
          <p className="text-muted-foreground">Manage warehouses, inventory, and fulfillment orders</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Warehouses</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-total-warehouses">
              {warehouses?.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="metric-low-stock">{lowStockItems?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="metric-expiring">{expiringItems?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-pending-orders">{pendingOrders?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="warehouses" className="w-full">
        <TabsList>
          <TabsTrigger value="warehouses" data-testid="tab-warehouses">
            <Warehouse className="w-4 h-4 mr-2" />
            Warehouses ({warehouses?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="inventory" data-testid="tab-inventory">
            <Package className="w-4 h-4 mr-2" />
            Inventory ({inventory?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="fulfillment" data-testid="tab-fulfillment">
            <Truck className="w-4 h-4 mr-2" />
            Orders ({fulfillmentOrders?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="warehouses" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowWarehouseDialog(true)} data-testid="button-create-warehouse">
              <Plus className="w-4 h-4 mr-2" />
              New Warehouse
            </Button>
          </div>
          {warehousesLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-32 bg-muted" />
              ))}
            </div>
          ) : warehouses?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Warehouse className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No warehouses yet</h3>
                  <p className="text-muted-foreground mb-4">Create warehouses to manage inventory locations</p>
                  <Button onClick={() => setShowWarehouseDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Warehouse
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {warehouses?.map((wh: any) => (
                <Card key={wh.id} data-testid={`warehouse-card-${wh.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{wh.name}</h4>
                          <Badge variant={wh.isActive ? "default" : "destructive"}>
                            {wh.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{wh.address}, {wh.city}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>ID: {wh.warehouseId}</span>
                          <span>Capacity: {wh.capacity || 0}m³</span>
                          <span>Utilization: {wh.currentUtilization || 0}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowInventoryDialog(true)} data-testid="button-create-inventory">
              <Plus className="w-4 h-4 mr-2" />
              New Inventory Item
            </Button>
          </div>
          {inventoryLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-32 bg-muted" />
              ))}
            </div>
          ) : inventory?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No inventory yet</h3>
                  <p className="text-muted-foreground mb-4">Add inventory items to track stock</p>
                  <Button onClick={() => setShowInventoryDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Inventory
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {inventory?.map((item: any) => (
                <Card key={item.id} data-testid={`inventory-card-${item.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{item.productName}</h4>
                          <Badge className={item.quantity <= item.reorderLevel ? "bg-red-500" : "bg-green-500"}>
                            {item.quantity} {item.unit}
                          </Badge>
                          <Badge variant="outline">{item.category}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>SKU: {item.sku}</span>
                          {item.locationInWarehouse && <span>Location: {item.locationInWarehouse}</span>}
                          {item.reorderLevel && <span>Reorder Level: {item.reorderLevel}</span>}
                          {item.unitCost && <span>Unit Cost: ₪{item.unitCost}</span>}
                        </div>
                        {item.quantity <= item.reorderLevel && (
                          <p className="text-xs text-red-600 mt-2">⚠️ Low stock - reorder needed</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="fulfillment" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowFulfillmentDialog(true)} data-testid="button-create-fulfillment">
              <Plus className="w-4 h-4 mr-2" />
              New Order
            </Button>
          </div>
          {ordersLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-32 bg-muted" />
              ))}
            </div>
          ) : fulfillmentOrders?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No fulfillment orders yet</h3>
                  <p className="text-muted-foreground mb-4">Create orders to manage deliveries and shipments</p>
                  <Button onClick={() => setShowFulfillmentDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Order
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {fulfillmentOrders?.map((order: any) => (
                <Card key={order.id} data-testid={`fulfillment-card-${order.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{order.orderId}</h4>
                          <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                          <Badge className={getPriorityColor(order.priority)}>{order.priority}</Badge>
                          <Badge variant="outline">{order.orderType}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                          {order.stationId && <span>Station: {order.stationId}</span>}
                          <span>Items: {Array.isArray(order.items) ? order.items.length : 0}</span>
                          <span>Ordered: {new Date(order.orderDate).toLocaleDateString()}</span>
                          {order.trackingNumber && <span>Tracking: {order.trackingNumber}</span>}
                        </div>
                        {order.deliveryAddress && (
                          <p className="text-sm text-muted-foreground">Delivery: {order.deliveryAddress}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {order.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              const trackingNumber = prompt("Enter tracking number:");
                              const carrier = prompt("Enter carrier:");
                              if (trackingNumber && carrier) {
                                shipOrderMutation.mutate({ id: order.id, trackingNumber, carrier });
                              }
                            }}
                            data-testid={`button-ship-${order.id}`}
                          >
                            Ship
                          </Button>
                        )}
                        {order.status === "shipped" && (
                          <Button
                            size="sm"
                            onClick={() => deliverOrderMutation.mutate(order.id)}
                            data-testid={`button-deliver-${order.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Deliver
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Warehouse Dialog */}
      <Dialog open={showWarehouseDialog} onOpenChange={setShowWarehouseDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-warehouse">
          <DialogHeader>
            <DialogTitle>Create Warehouse</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateWarehouse} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="warehouseId">Warehouse ID *</Label>
                <Input id="warehouseId" name="warehouseId" required placeholder="WH-IL-001" data-testid="input-warehouse-id" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required data-testid="input-warehouse-name" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="address">Address *</Label>
                <Input id="address" name="address" required data-testid="input-warehouse-address" />
              </div>
              <div>
                <Label htmlFor="city">City *</Label>
                <Input id="city" name="city" required data-testid="input-warehouse-city" />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" name="country" defaultValue="IL" data-testid="input-warehouse-country" />
              </div>
              <div>
                <Label htmlFor="capacity">Capacity (m³)</Label>
                <Input id="capacity" name="capacity" type="number" data-testid="input-warehouse-capacity" />
              </div>
              <div>
                <Label htmlFor="currentUtilization">Current Utilization (%)</Label>
                <Input id="currentUtilization" name="currentUtilization" defaultValue="0" data-testid="input-warehouse-utilization" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowWarehouseDialog(false)}
                data-testid="button-cancel-warehouse"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createWarehouseMutation.isPending} data-testid="button-submit-warehouse">
                {createWarehouseMutation.isPending ? "Creating..." : "Create Warehouse"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Inventory Dialog */}
      <Dialog open={showInventoryDialog} onOpenChange={setShowInventoryDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-inventory">
          <DialogHeader>
            <DialogTitle>Create Inventory Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateInventory} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sku">SKU *</Label>
                <Input id="sku" name="sku" required placeholder="SHMP-ORG-001" data-testid="input-sku" />
              </div>
              <div>
                <Label htmlFor="productName">Product Name *</Label>
                <Input id="productName" name="productName" required data-testid="input-product-name" />
              </div>
              <div>
                <Label htmlFor="productNameHe">Product Name (Hebrew)</Label>
                <Input id="productNameHe" name="productNameHe" data-testid="input-product-name-he" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={inventoryCategory} onValueChange={setInventoryCategory}>
                  <SelectTrigger data-testid="select-inventory-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shampoo">Shampoo</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="supplies">Supplies</SelectItem>
                    <SelectItem value="parts">Parts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <Input id="quantity" name="quantity" type="number" required defaultValue="0" data-testid="input-quantity" />
              </div>
              <div>
                <Label htmlFor="unit">Unit</Label>
                <Input id="unit" name="unit" defaultValue="units" data-testid="input-unit" />
              </div>
              <div>
                <Label htmlFor="reorderLevel">Reorder Level</Label>
                <Input id="reorderLevel" name="reorderLevel" type="number" defaultValue="0" data-testid="input-reorder-level" />
              </div>
              <div>
                <Label htmlFor="reorderQuantity">Reorder Quantity</Label>
                <Input id="reorderQuantity" name="reorderQuantity" type="number" defaultValue="0" data-testid="input-reorder-quantity" />
              </div>
              <div>
                <Label htmlFor="unitCost">Unit Cost (₪)</Label>
                <Input id="unitCost" name="unitCost" data-testid="input-unit-cost" />
              </div>
              <div>
                <Label htmlFor="locationInWarehouse">Location</Label>
                <Input id="locationInWarehouse" name="locationInWarehouse" placeholder="A1-S3" data-testid="input-location" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInventoryDialog(false)}
                data-testid="button-cancel-inventory"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createInventoryMutation.isPending} data-testid="button-submit-inventory">
                {createInventoryMutation.isPending ? "Creating..." : "Create Item"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Fulfillment Order Dialog */}
      <Dialog open={showFulfillmentDialog} onOpenChange={setShowFulfillmentDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-fulfillment">
          <DialogHeader>
            <DialogTitle>Create Fulfillment Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateFulfillment} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="orderId">Order ID *</Label>
                <Input id="orderId" name="orderId" required placeholder="FO-2025-0001" data-testid="input-order-id" />
              </div>
              <div>
                <Label>Order Type</Label>
                <Select value={fulfillmentOrderType} onValueChange={setFulfillmentOrderType}>
                  <SelectTrigger data-testid="select-order-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="station_restock">Station Restock</SelectItem>
                    <SelectItem value="customer_delivery">Customer Delivery</SelectItem>
                    <SelectItem value="franchise_shipment">Franchise Shipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={fulfillmentPriority} onValueChange={setFulfillmentPriority}>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="stationId">Station ID</Label>
                <Input id="stationId" name="stationId" data-testid="input-station-id" />
              </div>
              <div>
                <Label htmlFor="warehouseId">Warehouse ID</Label>
                <Input id="warehouseId" name="warehouseId" type="number" data-testid="input-fulfillment-warehouse-id" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="items">Items (JSON) *</Label>
                <Textarea
                  id="items"
                  name="items"
                  rows={3}
                  required
                  placeholder='[{"sku": "SHMP-001", "quantity": 10}]'
                  data-testid="textarea-items"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="deliveryAddress">Delivery Address</Label>
                <Input id="deliveryAddress" name="deliveryAddress" data-testid="input-delivery-address" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="deliveryNotes">Delivery Notes</Label>
                <Textarea id="deliveryNotes" name="deliveryNotes" rows={2} data-testid="textarea-delivery-notes" />
              </div>
              <div>
                <Label htmlFor="estimatedDelivery">Estimated Delivery</Label>
                <Input id="estimatedDelivery" name="estimatedDelivery" type="date" data-testid="input-estimated-delivery" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFulfillmentDialog(false)}
                data-testid="button-cancel-fulfillment"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createFulfillmentMutation.isPending} data-testid="button-submit-fulfillment">
                {createFulfillmentMutation.isPending ? "Creating..." : "Create Order"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
