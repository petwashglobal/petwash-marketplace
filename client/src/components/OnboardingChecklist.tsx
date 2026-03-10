import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle2, Circle, X, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

interface Milestone {
  key: string;
  label: string;
  labelHe: string;
  completed: boolean;
  completedAt: string | null;
}

interface ChecklistData {
  checklist: Milestone[];
  totalCompleted: number;
  total: number;
  percentComplete: number;
  role: string;
}

export function OnboardingChecklist() {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading } = useQuery<ChecklistData>({
    queryKey: ["/api/onboarding/checklist"],
  });

  const completeMutation = useMutation({
    mutationFn: async (milestoneKey: string) => {
      const res = await apiRequest("POST", `/api/onboarding/milestone/${milestoneKey}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/checklist"] });
    },
  });

  if (isLoading || !data || dismissed) return null;
  if (data.percentComplete === 100) return null;

  const incomplete = data.checklist.filter(m => !m.completed);

  return (
    <div
      className="fixed bottom-24 right-4 z-40 w-72 bg-white rounded-2xl border border-gray-100"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.10)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div>
            <div className="text-[12px] font-semibold text-gray-900">Getting started</div>
            <div className="text-[10px] text-gray-400">{data.totalCompleted}/{data.total} complete</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1 text-gray-300 hover:text-gray-500 transition-colors"
          >
            {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-2.5">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${data.percentComplete}%`, background: "linear-gradient(90deg,#0B57D0,#4E8DF7)" }}
          />
        </div>
        <div className="text-[9px] text-gray-400 mt-0.5 text-right">{data.percentComplete}%</div>
      </div>

      {/* Milestone list */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-1 mt-1">
          {data.checklist.map(m => (
            <div key={m.key} className={`flex items-center gap-2.5 py-1.5 rounded-lg px-1 transition-colors ${m.completed ? "opacity-50" : "hover:bg-gray-50"}`}>
              {m.completed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <button
                  onClick={() => completeMutation.mutate(m.key)}
                  disabled={completeMutation.isPending}
                  className="shrink-0"
                >
                  <Circle className="w-4 h-4 text-gray-200 hover:text-blue-400 transition-colors" />
                </button>
              )}
              <span className={`text-[12px] ${m.completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                {m.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
