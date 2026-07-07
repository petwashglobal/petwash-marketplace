import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, RefreshCw, Mail, Phone, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type MatchedOn = "email" | "phone";

interface CandidateGroup {
  matchedOn: MatchedOn;
  value: string;
  userIds: string[];
  count: number;
}

interface CandidatesResponse {
  mode: string;
  note: string;
  totalGroups: number;
  limit: number;
  groups: CandidateGroup[];
}

export default function AdminIdentityMerge() {
  const { data, isLoading, isFetching, refetch } = useQuery<CandidatesResponse>({
    queryKey: ["/api/admin/identity-merge-candidates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/identity-merge-candidates");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 120_000,
  });

  const groups = data?.groups ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6" dir="rtl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              איחוד זהויות (צל)
            </h1>
            <p className="text-xs text-gray-500">Identity Merge — shadow / read-only</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("ml-2 h-4 w-4", isFetching && "animate-spin")} />
          רענון
        </Button>
      </div>

      {/* SHADOW banner — make it unmissable that nothing is merged. */}
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">מצב צל — שום דבר לא מאוחד אוטומטית</p>
          <p className="mt-1 text-amber-800" dir="ltr">
            SHADOW MODE — nothing is merged automatically. This is a read-only
            preview of accounts that <strong>would</strong> be linked if unified
            identity were enabled. No login, session, or account is changed.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-500">
            לא נמצאו זהויות שהיו מאוחדות. ✅
            <div className="mt-1 text-xs text-gray-400" dir="ltr">
              No would-merge candidates detected.
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-xs text-gray-500">
            נמצאו {data?.totalGroups ?? groups.length} קבוצות מועמדות (תצוגה בלבד)
          </p>
          <div className="space-y-3">
            {groups.map((g, idx) => (
              <Card key={`${g.matchedOn}-${g.value}-${idx}`}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-3">
                    {g.matchedOn === "email" ? (
                      <Mail className="h-5 w-5 text-[#D4AF37]" />
                    ) : (
                      <Phone className="h-5 w-5 text-emerald-500" />
                    )}
                    <div>
                      <div className="font-mono text-sm text-gray-900" dir="ltr">
                        {g.value}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500" dir="ltr">
                        {g.userIds.length} accounts ·{" "}
                        {g.userIds.map((id) => id.slice(0, 8) + "…").join(", ")}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      className={cn(
                        "text-[10px] font-medium",
                        g.matchedOn === "email"
                          ? "bg-[#D4AF37] text-black"
                          : "bg-emerald-100 text-emerald-800",
                      )}
                    >
                      {g.matchedOn === "email" ? "אימייל מאומת" : "טלפון מאומת"}
                    </Badge>
                    <span className="text-[10px] text-gray-400">
                      would merge · shadow
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
