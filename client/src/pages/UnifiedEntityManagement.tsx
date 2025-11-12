import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Users, 
  TrendingUp, 
  ClipboardList, 
  Warehouse, 
  DollarSign,
  Plus,
  Search,
  Filter,
  Download,
  Upload
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

export default function UnifiedEntityManagement() {
  const [selectedCategory, setSelectedCategory] = useState<string>("corporate");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Fetch all entity data
  const { data: boardMembers } = useQuery({ queryKey: ['/api/enterprise/corporate/board-members'] });
  const { data: jvPartners } = useQuery({ queryKey: ['/api/enterprise/corporate/jv-partners'] });
  const { data: suppliers } = useQuery({ queryKey: ['/api/enterprise/corporate/suppliers'] });
  const { data: stations } = useQuery({ queryKey: ['/api/enterprise/corporate/stations'] });
  const { data: employees } = useQuery({ queryKey: ['/api/enterprise/hr/employees'] });
  const { data: departments } = useQuery({ queryKey: ['/api/enterprise/hr/departments'] });
  const { data: opportunities } = useQuery({ queryKey: ['/api/enterprise/sales/opportunities'] });
  const { data: tasks } = useQuery({ queryKey: ['/api/enterprise/operations/tasks'] });
  const { data: incidents } = useQuery({ queryKey: ['/api/enterprise/operations/incidents'] });
  const { data: warehouses } = useQuery({ queryKey: ['/api/enterprise/logistics/warehouses'] });
  const { data: inventory } = useQuery({ queryKey: ['/api/enterprise/logistics/inventory'] });
  const { data: accountsPayable } = useQuery({ queryKey: ['/api/enterprise/finance/accounts-payable'] });
  const { data: accountsReceivable } = useQuery({ queryKey: ['/api/enterprise/finance/accounts-receivable'] });

  return (
    <div className="min-h-screen bg-white p-6" data-testid="unified-entity-management">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-metallic-gold via-metallic-rose to-metallic-platinum bg-clip-text text-transparent mb-2" data-testid="text-page-title">
              Unified Entity Management
            </h1>
            <p className="text-muted-foreground">Comprehensive CRUD interface for all enterprise entities</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-metallic-gold text-metallic-gold hover:bg-metallic-gold/10" data-testid="button-export">
              <Download className="w-4 h-4 mr-2" />
              Export All
            </Button>
            <Button variant="outline" className="border-metallic-rose text-metallic-rose hover:bg-metallic-rose/10" data-testid="button-import">
              <Upload className="w-4 h-4 mr-2" />
              Import Data
            </Button>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search across all entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 luxury-input"
            data-testid="input-global-search"
          />
        </div>
        <Button variant="outline" className="border-metallic-silver" data-testid="button-advanced-filter">
          <Filter className="w-4 h-4 mr-2" />
          Advanced Filters
        </Button>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="space-y-6">
        <TabsList className="bg-gradient-to-r from-gray-100 to-gray-50 p-1">
          <TabsTrigger value="corporate" className="data-[state=active]:bg-metallic-gold/20 data-[state=active]:text-metallic-gold" data-testid="tab-corporate">
            <Building2 className="w-4 h-4 mr-2" />
            Corporate
          </TabsTrigger>
          <TabsTrigger value="hr" className="data-[state=active]:bg-metallic-platinum/20 data-[state=active]:text-metallic-platinum" data-testid="tab-hr">
            <Users className="w-4 h-4 mr-2" />
            Human Resources
          </TabsTrigger>
          <TabsTrigger value="sales" className="data-[state=active]:bg-metallic-rose/20 data-[state=active]:text-metallic-rose" data-testid="tab-sales">
            <TrendingUp className="w-4 h-4 mr-2" />
            Sales
          </TabsTrigger>
          <TabsTrigger value="operations" className="data-[state=active]:bg-metallic-silver/20 data-[state=active]:text-metallic-silver" data-testid="tab-operations">
            <ClipboardList className="w-4 h-4 mr-2" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="logistics" className="data-[state=active]:bg-metallic-gold/20 data-[state=active]:text-metallic-gold" data-testid="tab-logistics">
            <Warehouse className="w-4 h-4 mr-2" />
            Logistics
          </TabsTrigger>
          <TabsTrigger value="finance" className="data-[state=active]:bg-metallic-rose/20 data-[state=active]:text-metallic-rose" data-testid="tab-finance">
            <DollarSign className="w-4 h-4 mr-2" />
            Finance
          </TabsTrigger>
        </TabsList>

        {/* Corporate Tab */}
        <TabsContent value="corporate" className="space-y-6" data-testid="content-corporate">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Board Members */}
            <Card className="diamond-card border-metallic-gold" data-testid="card-board-members">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-metallic-gold">Board Members</CardTitle>
                  <CardDescription>{Array.isArray(boardMembers) ? boardMembers.length : 0} total</CardDescription>
                </div>
                <Link href="/enterprise/hq">
                  <Button size="sm" className="bg-metallic-gold hover:bg-metallic-gold/90 text-white" data-testid="button-manage-board">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.isArray(boardMembers) && boardMembers.slice(0, 3).map((member: any) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors" data-testid={`item-board-member-${member.id}`}>
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.position}</p>
                      </div>
                      <Badge variant="outline">{member.status}</Badge>
                    </div>
                  ))}
                  {(!boardMembers || boardMembers.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No board members found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* JV Partners */}
            <Card className="diamond-card border-metallic-gold" data-testid="card-jv-partners">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-metallic-gold">Joint Venture Partners</CardTitle>
                  <CardDescription>{Array.isArray(jvPartners) ? jvPartners.length : 0} total</CardDescription>
                </div>
                <Link href="/admin/jv-partners">
                  <Button size="sm" className="bg-metallic-gold hover:bg-metallic-gold/90 text-white" data-testid="button-manage-jv">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.isArray(jvPartners) && jvPartners.slice(0, 3).map((partner: any) => (
                    <div key={partner.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors" data-testid={`item-jv-partner-${partner.id}`}>
                      <div>
                        <p className="font-medium text-sm">{partner.partnerName}</p>
                        <p className="text-xs text-muted-foreground">{partner.equityPercentage}% equity</p>
                      </div>
                      <Badge variant="outline">{partner.status}</Badge>
                    </div>
                  ))}
                  {(!jvPartners || jvPartners.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No JV partners found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Suppliers */}
            <Card className="diamond-card border-metallic-gold" data-testid="card-suppliers">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-metallic-gold">Suppliers</CardTitle>
                  <CardDescription>{Array.isArray(suppliers) ? suppliers.length : 0} total</CardDescription>
                </div>
                <Link href="/admin/suppliers">
                  <Button size="sm" className="bg-metallic-gold hover:bg-metallic-gold/90 text-white" data-testid="button-manage-suppliers">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.isArray(suppliers) && suppliers.slice(0, 3).map((supplier: any) => (
                    <div key={supplier.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors" data-testid={`item-supplier-${supplier.id}`}>
                      <div>
                        <p className="font-medium text-sm">{supplier.supplierName}</p>
                        <p className="text-xs text-muted-foreground">{supplier.category}</p>
                      </div>
                      <Badge variant="outline">{supplier.status}</Badge>
                    </div>
                  ))}
                  {(!suppliers || suppliers.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No suppliers found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stations */}
            <Card className="diamond-card border-metallic-gold" data-testid="card-stations">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-metallic-gold">K9000 Stations</CardTitle>
                  <CardDescription>{Array.isArray(stations) ? stations.length : 0} total</CardDescription>
                </div>
                <Link href="/admin/stations">
                  <Button size="sm" className="bg-metallic-gold hover:bg-metallic-gold/90 text-white" data-testid="button-manage-stations">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.isArray(stations) && stations.slice(0, 3).map((station: any) => (
                    <div key={station.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors" data-testid={`item-station-${station.id}`}>
                      <div>
                        <p className="font-medium text-sm">{station.stationId}</p>
                        <p className="text-xs text-muted-foreground">{station.locationName}</p>
                      </div>
                      <Badge variant="outline" className={station.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700'}>
                        {station.status}
                      </Badge>
                    </div>
                  ))}
                  {(!stations || stations.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No stations found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* HR Tab */}
        <TabsContent value="hr" className="space-y-6" data-testid="content-hr">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Employees */}
            <Card className="diamond-card border-metallic-platinum" data-testid="card-employees">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-metallic-platinum">Employees</CardTitle>
                  <CardDescription>{Array.isArray(employees) ? employees.length : 0} total</CardDescription>
                </div>
                <Link href="/admin/hr">
                  <Button size="sm" className="bg-metallic-platinum hover:bg-metallic-platinum/90 text-white" data-testid="button-manage-employees">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.isArray(employees) && employees.slice(0, 3).map((employee: any) => (
                    <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors" data-testid={`item-employee-${employee.id}`}>
                      <div>
                        <p className="font-medium text-sm">{employee.firstName} {employee.lastName}</p>
                        <p className="text-xs text-muted-foreground">{employee.jobTitle}</p>
                      </div>
                      <Badge variant="outline" className={employee.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700'}>
                        {employee.status}
                      </Badge>
                    </div>
                  ))}
                  {(!employees || employees.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No employees found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Departments */}
            <Card className="diamond-card border-metallic-platinum" data-testid="card-departments">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-metallic-platinum">Departments</CardTitle>
                  <CardDescription>{Array.isArray(departments) ? departments.length : 0} total</CardDescription>
                </div>
                <Link href="/admin/hr">
                  <Button size="sm" className="bg-metallic-platinum hover:bg-metallic-platinum/90 text-white" data-testid="button-manage-departments">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.isArray(departments) && departments.slice(0, 3).map((dept: any) => (
                    <div key={dept.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors" data-testid={`item-department-${dept.id}`}>
                      <div>
                        <p className="font-medium text-sm">{dept.departmentName}</p>
                        <p className="text-xs text-muted-foreground">{dept.managerName || 'No manager assigned'}</p>
                      </div>
                      <Badge variant="outline">Active</Badge>
                    </div>
                  ))}
                  {(!departments || departments.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No departments found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-6" data-testid="content-sales">
          <Card className="diamond-card border-metallic-rose" data-testid="card-opportunities">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-metallic-rose">Sales Opportunities</CardTitle>
                <CardDescription>{Array.isArray(opportunities) ? opportunities.length : 0} total</CardDescription>
              </div>
              <Link href="/admin/sales">
                <Button size="sm" className="bg-metallic-rose hover:bg-metallic-rose/90 text-white" data-testid="button-manage-opportunities">
                  <Plus className="w-4 h-4 mr-2" />
                  Manage
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.isArray(opportunities) && opportunities.slice(0, 5).map((opp: any) => (
                  <div key={opp.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors" data-testid={`item-opportunity-${opp.id}`}>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{opp.name}</p>
                      <p className="text-xs text-muted-foreground">{opp.accountName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-metallic-rose">₪{parseFloat(opp.amount || 0).toLocaleString()}</p>
                      <Badge variant="outline" className="mt-1">{opp.status}</Badge>
                    </div>
                  </div>
                ))}
                {(!opportunities || opportunities.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No opportunities found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Operations Tab */}
        <TabsContent value="operations" className="space-y-6" data-testid="content-operations">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tasks */}
            <Card className="diamond-card border-metallic-silver" data-testid="card-tasks">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-metallic-silver">Tasks</CardTitle>
                  <CardDescription>{Array.isArray(tasks) ? tasks.length : 0} total</CardDescription>
                </div>
                <Link href="/admin/operations">
                  <Button size="sm" className="bg-metallic-silver hover:bg-metallic-silver/90 text-white" data-testid="button-manage-tasks">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.isArray(tasks) && tasks.slice(0, 3).map((task: any) => (
                    <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors" data-testid={`item-task-${task.id}`}>
                      <div>
                        <p className="font-medium text-sm">{task.title}</p>
                        <p className="text-xs text-muted-foreground">{task.assignedTo || 'Unassigned'}</p>
                      </div>
                      <Badge variant="outline">{task.status}</Badge>
                    </div>
                  ))}
                  {(!tasks || tasks.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No tasks found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Incidents */}
            <Card className="diamond-card border-metallic-silver" data-testid="card-incidents">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-metallic-silver">Incidents</CardTitle>
                  <CardDescription>{Array.isArray(incidents) ? incidents.length : 0} total</CardDescription>
                </div>
                <Link href="/admin/operations">
                  <Button size="sm" className="bg-metallic-silver hover:bg-metallic-silver/90 text-white" data-testid="button-manage-incidents">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.isArray(incidents) && incidents.slice(0, 3).map((incident: any) => (
                    <div key={incident.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors" data-testid={`item-incident-${incident.id}`}>
                      <div>
                        <p className="font-medium text-sm">{incident.title}</p>
                        <p className="text-xs text-muted-foreground">Priority: {incident.priority}</p>
                      </div>
                      <Badge variant="outline" className={incident.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700'}>
                        {incident.status}
                      </Badge>
                    </div>
                  ))}
                  {(!incidents || incidents.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No incidents found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Logistics Tab */}
        <TabsContent value="logistics" className="space-y-6" data-testid="content-logistics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Warehouses */}
            <Card className="diamond-card border-metallic-gold" data-testid="card-warehouses">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-metallic-gold">Warehouses</CardTitle>
                  <CardDescription>{Array.isArray(warehouses) ? warehouses.length : 0} total</CardDescription>
                </div>
                <Link href="/admin/logistics">
                  <Button size="sm" className="bg-metallic-gold hover:bg-metallic-gold/90 text-white" data-testid="button-manage-warehouses">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.isArray(warehouses) && warehouses.slice(0, 3).map((warehouse: any) => (
                    <div key={warehouse.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors" data-testid={`item-warehouse-${warehouse.id}`}>
                      <div>
                        <p className="font-medium text-sm">{warehouse.name}</p>
                        <p className="text-xs text-muted-foreground">{warehouse.location}</p>
                      </div>
                      <Badge variant="outline" className={warehouse.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700'}>
                        {warehouse.status}
                      </Badge>
                    </div>
                  ))}
                  {(!warehouses || warehouses.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No warehouses found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card className="diamond-card border-metallic-gold" data-testid="card-inventory">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-metallic-gold">Inventory</CardTitle>
                  <CardDescription>{Array.isArray(inventory) ? inventory.length : 0} SKUs</CardDescription>
                </div>
                <Link href="/admin/logistics">
                  <Button size="sm" className="bg-metallic-gold hover:bg-metallic-gold/90 text-white" data-testid="button-manage-inventory">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.isArray(inventory) && inventory.slice(0, 3).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors" data-testid={`item-inventory-${item.id}`}>
                      <div>
                        <p className="font-medium text-sm">{item.itemName}</p>
                        <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                      </div>
                      <Badge variant="outline" className={parseInt(item.quantityOnHand || 0) < parseInt(item.reorderPoint || 0) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-green-50 text-green-700 border-green-200'}>
                        {item.quantityOnHand} units
                      </Badge>
                    </div>
                  ))}
                  {(!inventory || inventory.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No inventory items found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Finance Tab */}
        <TabsContent value="finance" className="space-y-6" data-testid="content-finance">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Accounts Payable */}
            <Card className="diamond-card border-metallic-rose" data-testid="card-accounts-payable">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-metallic-rose">Accounts Payable</CardTitle>
                  <CardDescription>{Array.isArray(accountsPayable) ? accountsPayable.length : 0} invoices</CardDescription>
                </div>
                <Link href="/admin/finance">
                  <Button size="sm" className="bg-metallic-rose hover:bg-metallic-rose/90 text-white" data-testid="button-manage-ap">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.isArray(accountsPayable) && accountsPayable.slice(0, 3).map((ap: any) => (
                    <div key={ap.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors" data-testid={`item-ap-${ap.id}`}>
                      <div>
                        <p className="font-medium text-sm">{ap.vendorName}</p>
                        <p className="text-xs text-muted-foreground">₪{parseFloat(ap.totalAmount || 0).toLocaleString()}</p>
                      </div>
                      <Badge variant="outline" className={ap.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}>
                        {ap.paymentStatus}
                      </Badge>
                    </div>
                  ))}
                  {(!accountsPayable || accountsPayable.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No payables found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Accounts Receivable */}
            <Card className="diamond-card border-metallic-rose" data-testid="card-accounts-receivable">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-metallic-rose">Accounts Receivable</CardTitle>
                  <CardDescription>{Array.isArray(accountsReceivable) ? accountsReceivable.length : 0} invoices</CardDescription>
                </div>
                <Link href="/admin/finance">
                  <Button size="sm" className="bg-metallic-rose hover:bg-metallic-rose/90 text-white" data-testid="button-manage-ar">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.isArray(accountsReceivable) && accountsReceivable.slice(0, 3).map((ar: any) => (
                    <div key={ar.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors" data-testid={`item-ar-${ar.id}`}>
                      <div>
                        <p className="font-medium text-sm">{ar.customerName}</p>
                        <p className="text-xs text-muted-foreground">₪{parseFloat(ar.totalAmount || 0).toLocaleString()}</p>
                      </div>
                      <Badge variant="outline" className={ar.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}>
                        {ar.paymentStatus}
                      </Badge>
                    </div>
                  ))}
                  {(!accountsReceivable || accountsReceivable.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No receivables found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Stats Summary */}
      <Card className="mt-8 glass-card border-metallic-gold" data-testid="card-quick-stats">
        <CardHeader>
          <CardTitle className="text-metallic-gold">Quick Stats Summary</CardTitle>
          <CardDescription>Enterprise-wide entity counts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-center">
            <div className="p-3 bg-gradient-to-br from-metallic-gold/10 to-transparent rounded-lg">
              <p className="text-2xl font-bold text-metallic-gold">{Array.isArray(boardMembers) ? boardMembers.length : 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Board Members</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-metallic-platinum/10 to-transparent rounded-lg">
              <p className="text-2xl font-bold text-metallic-platinum">{Array.isArray(employees) ? employees.length : 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Employees</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-metallic-rose/10 to-transparent rounded-lg">
              <p className="text-2xl font-bold text-metallic-rose">{Array.isArray(opportunities) ? opportunities.length : 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Opportunities</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-metallic-silver/10 to-transparent rounded-lg">
              <p className="text-2xl font-bold text-metallic-silver">{Array.isArray(tasks) ? tasks.length : 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Tasks</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-metallic-gold/10 to-transparent rounded-lg">
              <p className="text-2xl font-bold text-metallic-gold">{Array.isArray(warehouses) ? warehouses.length : 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Warehouses</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-metallic-rose/10 to-transparent rounded-lg">
              <p className="text-2xl font-bold text-metallic-rose">{Array.isArray(accountsPayable) ? accountsPayable.length : 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Invoices</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
