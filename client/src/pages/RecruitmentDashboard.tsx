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
import { Plus, Briefcase, Users, Calendar, DollarSign } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function RecruitmentDashboard() {
  const [showCreateJobDialog, setShowCreateJobDialog] = useState(false);
  const [employmentType, setEmploymentType] = useState("full_time");
  const [jobStatus, setJobStatus] = useState("open");
  const { toast } = useToast();

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/enterprise/hr/job-openings"],
  });

  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ["/api/enterprise/hr/applications"],
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: any) => apiRequest(`/api/enterprise/hr/job-openings`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/hr/job-openings"] });
      setShowCreateJobDialog(false);
      toast({ title: "Success", description: "Job opening created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create job opening", variant: "destructive" });
    },
  });

  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/enterprise/hr/applications/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/hr/applications"] });
      toast({ title: "Success", description: "Application status updated" });
    },
  });

  const handleCreateJob = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      jobTitle: formData.get("jobTitle"),
      department: formData.get("department"),
      employmentType,
      location: formData.get("location"),
      salaryRange: formData.get("salaryRange"),
      jobDescription: formData.get("jobDescription"),
      requirements: formData.get("requirements"),
      responsibilities: formData.get("responsibilities"),
      benefits: formData.get("benefits"),
      numberOfPositions: parseInt(formData.get("numberOfPositions") as string) || 1,
      status: jobStatus,
      postedDate: formData.get("postedDate"),
    };
    createJobMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-green-500",
      closed: "bg-gray-500",
      on_hold: "bg-yellow-500",
      filled: "bg-blue-500",
      submitted: "bg-blue-500",
      screening: "bg-yellow-500",
      interview: "bg-purple-500",
      offer: "bg-green-500",
      hired: "bg-emerald-500",
      rejected: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Recruitment & Onboarding</h1>
          <p className="text-muted-foreground">Manage job openings and applications</p>
        </div>
        <Button onClick={() => setShowCreateJobDialog(true)} data-testid="button-create-job">
          <Plus className="w-4 h-4 mr-2" />
          Post Job
        </Button>
      </div>

      <Tabs defaultValue="jobs" className="w-full">
        <TabsList>
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            <Briefcase className="w-4 h-4 mr-2" />
            Job Openings ({jobs?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="applications" data-testid="tab-applications">
            <Users className="w-4 h-4 mr-2" />
            Applications ({applications?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          {jobsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-48 bg-muted" />
              ))}
            </div>
          ) : jobs?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No job openings yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first job posting</p>
                  <Button onClick={() => setShowCreateJobDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Post Job
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {jobs?.map((job: any) => (
                <Card key={job.id} data-testid={`job-card-${job.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{job.jobTitle}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{job.department}</p>
                      </div>
                      <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>Posted: {new Date(job.postedDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span>{job.salaryRange || "Not specified"}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-muted rounded p-2">
                        <div className="font-bold">{job.applicationCount || 0}</div>
                        <div className="text-muted-foreground">Applications</div>
                      </div>
                      <div className="bg-muted rounded p-2">
                        <div className="font-bold">{job.interviewCount || 0}</div>
                        <div className="text-muted-foreground">Interviews</div>
                      </div>
                      <div className="bg-muted rounded p-2">
                        <div className="font-bold">{job.offersMade || 0}</div>
                        <div className="text-muted-foreground">Offers</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          {appsLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-32 bg-muted" />
              ))}
            </div>
          ) : applications?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No applications yet</h3>
                  <p className="text-muted-foreground">Applications will appear here when candidates apply</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {applications?.map((app: any) => (
                <Card key={app.id} data-testid={`application-card-${app.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{app.applicantName}</CardTitle>
                        <p className="text-sm text-muted-foreground">{app.applicantEmail}</p>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Select
                          value={app.applicationStatus}
                          onValueChange={(status) => updateApplicationMutation.mutate({ id: app.id, status })}
                        >
                          <SelectTrigger className="w-40" data-testid={`select-status-${app.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="screening">Screening</SelectItem>
                            <SelectItem value="interview">Interview</SelectItem>
                            <SelectItem value="offer">Offer</SelectItem>
                            <SelectItem value="hired">Hired</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {app.yearsOfExperience && (
                        <div>
                          <div className="text-muted-foreground">Experience</div>
                          <div className="font-medium">{app.yearsOfExperience} years</div>
                        </div>
                      )}
                      {app.expectedSalary && (
                        <div>
                          <div className="text-muted-foreground">Expected Salary</div>
                          <div className="font-medium">${app.expectedSalary}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-muted-foreground">Applied</div>
                        <div className="font-medium">{new Date(app.appliedAt).toLocaleDateString()}</div>
                      </div>
                      {app.resumeUrl && (
                        <div>
                          <a href={app.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            View Resume
                          </a>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateJobDialog} onOpenChange={setShowCreateJobDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-job">
          <DialogHeader>
            <DialogTitle>Create Job Opening</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateJob} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="jobTitle">Job Title *</Label>
                <Input id="jobTitle" name="jobTitle" required data-testid="input-job-title" />
              </div>
              <div>
                <Label htmlFor="department">Department *</Label>
                <Input id="department" name="department" required data-testid="input-department" />
              </div>
              <div>
                <Label>Employment Type</Label>
                <Select value={employmentType} onValueChange={setEmploymentType}>
                  <SelectTrigger data-testid="select-employment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="location">Location *</Label>
                <Input id="location" name="location" required data-testid="input-location" />
              </div>
              <div>
                <Label htmlFor="salaryRange">Salary Range</Label>
                <Input id="salaryRange" name="salaryRange" placeholder="e.g., $50k-70k" data-testid="input-salary-range" />
              </div>
              <div>
                <Label htmlFor="numberOfPositions">Number of Positions</Label>
                <Input id="numberOfPositions" name="numberOfPositions" type="number" defaultValue="1" data-testid="input-positions" />
              </div>
              <div>
                <Label htmlFor="postedDate">Posted Date *</Label>
                <Input id="postedDate" name="postedDate" type="date" required data-testid="input-posted-date" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={jobStatus} onValueChange={setJobStatus}>
                  <SelectTrigger data-testid="select-job-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="jobDescription">Job Description *</Label>
              <Textarea id="jobDescription" name="jobDescription" rows={3} required data-testid="textarea-description" />
            </div>
            <div>
              <Label htmlFor="requirements">Requirements *</Label>
              <Textarea id="requirements" name="requirements" rows={3} required data-testid="textarea-requirements" />
            </div>
            <div>
              <Label htmlFor="responsibilities">Responsibilities *</Label>
              <Textarea id="responsibilities" name="responsibilities" rows={3} required data-testid="textarea-responsibilities" />
            </div>
            <div>
              <Label htmlFor="benefits">Benefits</Label>
              <Textarea id="benefits" name="benefits" rows={2} data-testid="textarea-benefits" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateJobDialog(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createJobMutation.isPending} data-testid="button-submit-job">
                {createJobMutation.isPending ? "Creating..." : "Create Job"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
