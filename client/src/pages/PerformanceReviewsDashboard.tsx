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
import { Plus, Star, CheckCircle, Clock, Archive } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function PerformanceReviewsDashboard() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [reviewerId, setReviewerId] = useState<string>("");
  const [reviewPeriod, setReviewPeriod] = useState<string>("Q1 2025");
  const [overallRating, setOverallRating] = useState<string>("3.0");
  const { toast } = useToast();

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["/api/enterprise/hr/performance-reviews"],
    queryFn: async () => {
      const response = await fetch("/api/enterprise/hr/performance-reviews", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch reviews");
      return response.json();
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["/api/enterprise/hr/employees"],
    queryFn: async () => {
      const response = await fetch("/api/enterprise/hr/employees", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch employees");
      return response.json();
    },
  });

  const createReviewMutation = useMutation({
    mutationFn: async (data: any) => apiRequest(`/api/enterprise/hr/performance-reviews`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/hr/performance-reviews"] });
      setShowCreateDialog(false);
      toast({ title: "Success", description: "Performance review created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create review", variant: "destructive" });
    },
  });

  const handleCreateReview = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      employeeId: parseInt(employeeId),
      reviewerId: parseInt(reviewerId),
      reviewPeriod: reviewPeriod,
      reviewDate: formData.get("reviewDate"),
      overallRating: overallRating,
      strengths: formData.get("strengths"),
      areasForImprovement: formData.get("areasForImprovement"),
      developmentPlan: formData.get("developmentPlan"),
      status: "completed",
    };
    createReviewMutation.mutate(data);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "draft": return <Clock className="w-4 h-4 text-yellow-600" />;
      case "acknowledged": return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case "archived": return <Archive className="w-4 h-4 text-gray-600" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getRatingStars = (rating: string) => {
    const numRating = parseFloat(rating);
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-4 h-4 ${i < numRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
    ));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Performance Reviews</h1>
          <p className="text-muted-foreground">Employee Performance & Career Development</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-review">
          <Plus className="w-4 h-4 mr-2" />
          New Review
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse h-48 bg-muted" />
          ))}
        </div>
      ) : reviews?.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Star className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No performance reviews yet</h3>
              <p className="text-muted-foreground mb-4">Create your first performance review</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Review
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reviews?.map((review: any) => (
            <Card key={review.id} data-testid={`review-card-${review.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{review.reviewPeriod}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Employee ID: {review.employeeId}
                    </p>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1">
                    {getStatusIcon(review.status)}
                    {review.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Overall Rating</Label>
                    <div className="flex gap-1 mt-1" data-testid={`rating-${review.id}`}>
                      {getRatingStars(review.overallRating)}
                      <span className="text-sm ml-2">{review.overallRating}/5.0</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Review Date</Label>
                    <p className="text-sm">{new Date(review.reviewDate).toLocaleDateString()}</p>
                  </div>
                  {review.strengths && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Strengths</Label>
                      <p className="text-sm line-clamp-2">{review.strengths}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-review">
          <DialogHeader>
            <DialogTitle>Create Performance Review</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateReview} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employeeId">Employee *</Label>
                <Select value={employeeId} onValueChange={setEmployeeId} required>
                  <SelectTrigger data-testid="select-employee">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.firstName} {emp.lastName} ({emp.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reviewerId">Reviewer *</Label>
                <Select value={reviewerId} onValueChange={setReviewerId} required>
                  <SelectTrigger data-testid="select-reviewer">
                    <SelectValue placeholder="Select reviewer" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reviewPeriod">Review Period</Label>
                <Select value={reviewPeriod} onValueChange={setReviewPeriod}>
                  <SelectTrigger data-testid="select-review-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1 2025">Q1 2025</SelectItem>
                    <SelectItem value="Q2 2025">Q2 2025</SelectItem>
                    <SelectItem value="Q3 2025">Q3 2025</SelectItem>
                    <SelectItem value="Q4 2025">Q4 2025</SelectItem>
                    <SelectItem value="Annual 2025">Annual 2025</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reviewDate">Review Date *</Label>
                <Input id="reviewDate" name="reviewDate" type="date" required data-testid="input-review-date" />
              </div>
              <div>
                <Label htmlFor="overallRating">Overall Rating (1-5)</Label>
                <Select value={overallRating} onValueChange={setOverallRating}>
                  <SelectTrigger data-testid="select-rating">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1.0">1.0 - Needs Improvement</SelectItem>
                    <SelectItem value="2.0">2.0 - Below Expectations</SelectItem>
                    <SelectItem value="3.0">3.0 - Meets Expectations</SelectItem>
                    <SelectItem value="4.0">4.0 - Exceeds Expectations</SelectItem>
                    <SelectItem value="5.0">5.0 - Outstanding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="strengths">Strengths</Label>
              <Textarea id="strengths" name="strengths" rows={3} data-testid="textarea-strengths" />
            </div>
            <div>
              <Label htmlFor="areasForImprovement">Areas for Improvement</Label>
              <Textarea id="areasForImprovement" name="areasForImprovement" rows={3} data-testid="textarea-improvements" />
            </div>
            <div>
              <Label htmlFor="developmentPlan">Development Plan</Label>
              <Textarea id="developmentPlan" name="developmentPlan" rows={3} data-testid="textarea-development-plan" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createReviewMutation.isPending} data-testid="button-submit-review">
                {createReviewMutation.isPending ? "Creating..." : "Create Review"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
