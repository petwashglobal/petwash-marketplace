import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/apiConfig";
import { auth } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Instagram,
  Facebook,
  Music2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Heart,
  Link2,
} from "lucide-react";

async function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  try {
    const user = auth?.currentUser;
    if (user) headers["Authorization"] = `Bearer ${await user.getIdToken()}`;
  } catch { /* no-op */ }
  return fetch(url, { ...init, headers });
}

type Platform = "instagram" | "tiktok" | "facebook";

interface PlatformOverview {
  platform: Platform;
  handle: string;
  connected: boolean;
  followers: number | null;
  followersDelta7d: number | null;
  engagement: number | null;
  lastSyncedAt: string | null;
}

interface Overview {
  platforms: PlatformOverview[];
  anyConnected: boolean;
}

const PLATFORM_META: Record<Platform, { name: string; Icon: any; url: string; envHint: string }> = {
  instagram: { name: "Instagram", Icon: Instagram, url: "https://www.instagram.com/petwashltd", envHint: "META_GRAPH_TOKEN + IG_BUSINESS_ACCOUNT_ID" },
  tiktok:    { name: "TikTok",    Icon: Music2,    url: "https://www.tiktok.com/@petwashltd",   envHint: "TIKTOK_ACCESS_TOKEN" },
  facebook:  { name: "Facebook",  Icon: Facebook,  url: "https://www.facebook.com/petwashltd",  envHint: "META_GRAPH_TOKEN + FB_PAGE_ID" },
};

function nfmt(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K";
  return String(n);
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-gray-400 text-sm inline-flex items-center gap-1"><Minus className="w-3.5 h-3.5" /> —</span>;
  if (delta > 0) return <span className="text-emerald-600 text-sm font-semibold inline-flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> +{nfmt(delta)}</span>;
  if (delta < 0) return <span className="text-rose-600 text-sm font-semibold inline-flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> {nfmt(delta)}</span>;
  return <span className="text-gray-500 text-sm inline-flex items-center gap-1"><Minus className="w-3.5 h-3.5" /> 0</span>;
}

export default function AdminSocialGrowth() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<Overview>({
    queryKey: ["admin-social-overview"],
    queryFn: async () => {
      const res = await adminFetch(getApiUrl("/api/admin/social/overview"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const refreshNow = async () => {
    setRefreshing(true);
    try {
      await adminFetch(getApiUrl("/api/admin/social/snapshot/all"), { method: "POST" });
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Social Growth · צמיחה ברשתות</h1>
            <p className="text-gray-500 mt-1">@petwashltd — Instagram · TikTok · Facebook</p>
          </div>
          <Button onClick={refreshNow} disabled={refreshing || !data?.anyConnected} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh now
          </Button>
        </div>

        {isLoading && <p className="text-gray-400 py-10">Loading…</p>}
        {error && <p className="text-rose-600 py-10">Could not load social overview.</p>}

        {data && !data.anyConnected && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-6 text-sm text-amber-900">
            No social account is connected yet, so metrics are empty. This dashboard is <b>live and ready</b> —
            it lights up the moment the platform API tokens are set in Cloud Run (see each card below). No data
            is invented until a real account is connected.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.platforms.map((p) => {
            const meta = PLATFORM_META[p.platform];
            const Icon = meta.Icon;
            return (
              <Card key={p.platform} className="border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <a href={meta.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:underline">
                      <Icon className="w-5 h-5" /> {meta.name}
                    </a>
                    {p.connected
                      ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Connected</Badge>
                      : <Badge variant="outline" className="text-amber-600 border-amber-300">Not connected</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-400 mb-3" dir="ltr">@{p.handle}</p>
                  {p.connected || p.followers != null ? (
                    <div className="space-y-3">
                      <div className="flex items-end justify-between">
                        <span className="text-3xl font-bold text-gray-900 inline-flex items-center gap-2">
                          <Users className="w-5 h-5 text-gray-400" /> {nfmt(p.followers)}
                        </span>
                        <DeltaBadge delta={p.followersDelta7d} />
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <Heart className="w-4 h-4" /> Engagement: {nfmt(p.engagement)}
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {p.lastSyncedAt ? `synced ${new Date(p.lastSyncedAt).toLocaleDateString()}` : "no snapshot yet"}
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 space-y-2">
                      <p>Connect to pull followers, reach &amp; engagement.</p>
                      <p className="text-[11px] text-gray-400 inline-flex items-center gap-1" dir="ltr">
                        <Link2 className="w-3.5 h-3.5" /> set {meta.envHint}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-8">
          Read-only. No PII, no posting. Playbook: <span dir="ltr">docs/marketing/petwash-social-growth-playbook-2026-07.md</span>
        </p>
      </div>
    </div>
  );
}
