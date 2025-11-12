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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users, DollarSign, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function HRDashboard() {
  const [view, setView] = useState<"employees" | "payroll" | "timetracking">("employees");
  const [showCreateEmployeeDialog, setShowCreateEmployeeDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [department, setDepartment] = useState<string>("HR");
  const [employmentType, setEmploymentType] = useState<string>("full_time");
  const { toast } = useToast();

  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ["/api/enterprise/hr/employees"],
    queryFn: async () => {
      const response = await fetch("/api/enterprise/hr/employees?filter=active", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch employees");
      return response.json();
    },
  });

  const { data: payroll, isLoading: loadingPayroll } = useQuery({
    queryKey: ["/api/enterprise/hr/payroll"],
    queryFn: async () => {
      const response = await fetch("/api/enterprise/hr/payroll", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch payroll");
      return response.json();
    },
  });

  const { data: timeTracking, isLoading: loadingTime } = useQuery({
    queryKey: ["/api/enterprise/hr/employees", selectedEmployee?.id, "time-tracking"],
    queryFn: async () => {
      if (!selectedEmployee) return null;
      const response = await fetch(`/api/enterprise/hr/employees/${selectedEmployee.id}/time-tracking`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch time tracking");
      return response.json();
    },
    enabled: !!selectedEmployee,
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/enterprise/hr/employees`, { method: "POST", body: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/hr/employees"] });
      setShowCreateEmployeeDialog(false);
      toast({ title: "Success", description: "Employee created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create employee", variant: "destructive" });
    },
  });

  const handleCreateEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      employeeId: formData.get("employeeId"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      department: department,
      position: formData.get("position"),
      employmentType: employmentType,
      startDate: formData.get("startDate"),
      salary: formData.get("salary"),
      salaryCurrency: "ILS",
      isActive: true,
    };
    createEmployeeMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      paid: { variant: "default", icon: <CheckCircle className="w-3 h-3" /> },
      pending: { variant: "secondary", icon: <AlertCircle className="w-3 h-3" /> },
      failed: { variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
    };
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">HR Department</h1>
          <p className="text-muted-foreground">Employee Records, Payroll & Time Tracking</p>
        </div>
        <Button onClick={() => setShowCreateEmployeeDialog(true)} data-testid="button-create-employee">
          <Plus className="w-4 h-4 mr-2" />
          Add Employee
        </Button>
      </div>

      <Tabs defaultValue="employees" className="w-full" onValueChange={(v) => setView(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="employees" data-testid="tab-employees">
            <Users className="w-4 h-4 mr-2" />
            Employees ({employees?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="payroll" data-testid="tab-payroll">
            <DollarSign className="w-4 h-4 mr-2" />
            Payroll ({payroll?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="timetracking" data-testid="tab-timetracking">
            <Clock className="w-4 h-4 mr-2" />
            Time Tracking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-4">
          {loadingEmployees ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : employees?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No employees registered</h3>
                  <p className="text-muted-foreground mb-4">Add your first employee to get started</p>
                  <Button onClick={() => setShowCreateEmployeeDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Employee
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {employees?.map((employee: any) => (
                <Card 
                  key={employee.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedEmployee(employee)}
                  data-testid={`employee-card-${employee.id}`}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{employee.firstName} {employee.lastName}</CardTitle>
                        <p className="text-sm text-muted-foreground">{employee.position}</p>
                        <p className="text-xs font-mono text-primary">{employee.employeeId}</p>
                      </div>
                      <Badge>{employee.department}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <div><span className="text-muted-foreground">Email:</span> {employee.email}</div>
                      <div><span className="text-muted-foreground">Type:</span> {employee.employmentType?.replace('_', ' ')}</div>
                      <div><span className="text-muted-foreground">Start Date:</span> {new Date(employee.startDate).toLocaleDateString()}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payroll" className="mt-4">
          {loadingPayroll ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : payroll?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No payroll records</h3>
                  <p className="text-muted-foreground">Payroll records will appear here once processed</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {payroll?.map((record: any) => (
                <Card key={record.id} data-testid={`payroll-${record.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="font-semibold">
                          {new Date(record.payPeriodStart).toLocaleDateString()} - {new Date(record.payPeriodEnd).toLocaleDateString()}
                        </h4>
                        <p className="text-sm text-muted-foreground">Employee ID: {record.employeeId}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          <div><span className="text-muted-foreground">Gross:</span> {record.currency} {parseFloat(record.grossSalary).toLocaleString()}</div>
                          <div><span className="text-muted-foreground">Net:</span> {record.currency} {parseFloat(record.netSalary).toLocaleString()}</div>
                        </div>
                      </div>
                      {getStatusBadge(record.paymentStatus)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="timetracking" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select an employee</h3>
                <p className="text-muted-foreground">Choose an employee from the Employees tab to view their time tracking</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateEmployeeDialog} onOpenChange={setShowCreateEmployeeDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-employee">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>Register a new employee in the HR system</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employeeId">Employee ID *</Label>
                <Input id="employeeId" name="employeeId" placeholder="EMP-2025-0001" required data-testid="input-employee-id" />
              </div>
              <div>
                <Label htmlFor="startDate">Start Date *</Label>
                <Input id="startDate" name="startDate" type="date" required data-testid="input-start-date" />
              </div>
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" name="firstName" required data-testid="input-first-name" />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" name="lastName" required data-testid="input-last-name" />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" required data-testid="input-email" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" data-testid="input-phone" />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger data-testid="select-department">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Logistics">Logistics</SelectItem>
                    <SelectItem value="Accounts">Accounts</SelectItem>
                    <SelectItem value="IT">IT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="position">Position *</Label>
                <Input id="position" name="position" required data-testid="input-position" />
              </div>
              <div>
                <Label htmlFor="employmentType">Employment Type</Label>
                <Select value={employmentType} onValueChange={setEmploymentType}>
                  <SelectTrigger data-testid="select-employment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="salary">Monthly Salary (ILS)</Label>
                <Input id="salary" name="salary" type="number" step="0.01" data-testid="input-salary" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateEmployeeDialog(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createEmployeeMutation.isPending} data-testid="button-submit-employee">
                {createEmployeeMutation.isPending ? "Creating..." : "Create Employee"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEmployee} onOpenChange={() => setSelectedEmployee(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-employee-details">
          <DialogHeader>
            <DialogTitle>
              {selectedEmployee?.firstName} {selectedEmployee?.lastName}
            </DialogTitle>
            <DialogDescription>{selectedEmployee?.employeeId}</DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Position</Label>
                  <p className="mt-1">{selectedEmployee.position}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Department</Label>
                  <p className="mt-1">{selectedEmployee.department}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Employment Type</Label>
                  <p className="mt-1 capitalize">{selectedEmployee.employmentType?.replace('_', ' ')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Start Date</Label>
                  <p className="mt-1">{new Date(selectedEmployee.startDate).toLocaleDateString()}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="mt-1">{selectedEmployee.email}</p>
                </div>
                {selectedEmployee.phone && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="mt-1">{selectedEmployee.phone}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
