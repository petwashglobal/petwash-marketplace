/**
 * AdminCustomerDetail — supplemental admin customer profile page.
 *
 * Reachable at /admin/customers/:id (param = the user's id / Firebase UID).
 * Additive: the existing CustomerManagement list page is unchanged; this is the
 * deeper single-customer surface the audit asked for — member number prominent
 * (מספר חבר) plus tabs for overview, consents, notifications and payments.
 *
 * Hebrew-first, RTL, brand = pure white / black / metallic gold #D4AF37.
 * Read-only. Each tab fetches its own endpoint under /api/admin/customer-detail.
 */
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronRight,
  User,
  ShieldCheck,
  Bell,
  CreditCard,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Crown,
  RefreshCw,
} from "lucide-react";

const GOLD = "#D4AF37";

// ── Types (mirror the server response shapes) ──────────────────────────────
interface OverviewResponse {
  ok: boolean;
  profile: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    emailVerified: boolean;
    phone: string | null;
    phoneVerified: boolean;
    membershipNumber: string | null;
    preferredLanguage: string | null;
    country: string | null;
    accountStatus: string | null;
    loyaltyTier: string | null;
    createdAt: string | null;
    lastLoginAt: string | null;
  } | null;
  counts: {
    orders: number | null;
    payments: number | null;
    walletBalanceCents: number | null;
  };
  errors?: Record<string, string>;
}

interface ConsentRow {
  id: number;
  consentType: string;
  consentVersion: string;
  accepted: boolean;
  acceptedAt: string | null;
  method: string | null;
  source: string | null;
  locale: string | null;
}

interface NotificationRow {
  id: number;
  templateKey: string;
  channel: string;
  status: string | null;
  title: string | null;
  body: string | null;
  eventType: string | null;
  sentAt: string | null;
  createdAt: string | null;
  failureReason: string | null;
  isRead: boolean | null;
}

interface PaymentRow {
  id: number;
  paymentId: string;
  transactionType: string;
  vertical: string;
  status: string | null;
  grossCents: number;
  vatCents: number;
  paymentMethod: string | null;
  paymentProcessor: string | null;
  createdAt: string | null;
  settledAt: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const DASH = "—";

function fmtDate(s: string | null | undefined): string {
  if (!s) return DASH;
  const d = new Date(s);
  if (isNaN(d.getTime())) return DASH;
  return d.toLocaleDateString("he-IL") + " " + d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function fmtCents(c: number | null | undefined): string {
  if (c == null) return DASH;
  return "₪" + (c / 100).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Verified({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="inline w-4 h-4 text-green-600" aria-label="מאומת" />
  ) : (
    <XCircle className="inline w-4 h-4 text-orange-500" aria-label="לא מאומת" />
  );
}

// Small spinner / empty / error blocks reused across tabs.
function Loading() {
  return (
    <div className="text-center py-12 text-black/60">
      <div
        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
        style={{ borderColor: GOLD, borderTopColor: "transparent" }}
      />
      <p>טוען…</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="text-center py-12 text-black/50">{text}</div>;
}
function ErrorBox({ text }: { text: string }) {
  return (
    <div className="text-center py-12 text-red-600">
      {text}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-black/5 last:border-0">
      <span className="text-sm text-black/55">{label}</span>
      <span className="text-sm font-medium text-black text-left">{children}</span>
    </div>
  );
}

export default function AdminCustomerDetail() {
  const params = useParams();
  const userId = (params as any).id as string;
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();

  // ── Overview (always fetched) ──────────────────────────────────────────────
  const {
    data: overview,
    isLoading: ovLoading,
    isError: ovError,
    refetch: refetchOverview,
  } = useQuery<OverviewResponse>({
    queryKey: [`/api/admin/customer-detail/${userId}`],
    enabled: !!userId && isAuthenticated,
  });

  // ── Per-tab fetches ────────────────────────────────────────────────────────
  const { data: consentsData, isLoading: consentsLoading, isError: consentsError } = useQuery<{
    ok: boolean;
    consents: ConsentRow[];
  }>({
    queryKey: [`/api/admin/customer-detail/${userId}/consents`],
    enabled: !!userId && isAuthenticated,
  });

  const { data: notifData, isLoading: notifLoading, isError: notifError } = useQuery<{
    ok: boolean;
    notifications: NotificationRow[];
  }>({
    queryKey: [`/api/admin/customer-detail/${userId}/notifications`],
    enabled: !!userId && isAuthenticated,
  });

  const { data: payData, isLoading: payLoading, isError: payError } = useQuery<{
    ok: boolean;
    payments: PaymentRow[];
  }>({
    queryKey: [`/api/admin/customer-detail/${userId}/payments`],
    enabled: !!userId && isAuthenticated,
  });

  if (authLoading) return <Loading />;
  if (!isAuthenticated) {
    return (
      <div dir="rtl" className="min-h-screen bg-white flex items-center justify-center">
        <ErrorBox text="נדרשת הרשאת מנהל." />
      </div>
    );
  }

  const profile = overview?.profile ?? null;
  const fullName =
    profile && (profile.firstName || profile.lastName)
      ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
      : DASH;
  const consents = consentsData?.consents ?? [];
  const notifications = notifData?.notifications ?? [];
  const payments = payData?.payments ?? [];

  return (
    <div dir="rtl" className="min-h-screen bg-white text-black">
      {/* Header */}
      <header className="border-b" style={{ borderColor: GOLD + "55" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <nav className="flex items-center gap-1 text-sm text-black/50 mb-3">
            <Link href="/admin/customers" className="hover:text-black">
              לקוחות
            </Link>
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span className="text-black">פרטי לקוח</span>
          </nav>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-black flex items-center gap-2">
                <User className="w-6 h-6" style={{ color: GOLD }} />
                {ovLoading ? "טוען…" : fullName}
              </h1>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-black/55">מספר חבר:</span>
                <Badge
                  className="text-sm font-semibold border"
                  style={{ backgroundColor: GOLD + "1A", color: "#000", borderColor: GOLD }}
                  data-testid="customer-membership-number"
                >
                  <Crown className="w-3 h-3 ml-1" style={{ color: GOLD }} />
                  {profile?.membershipNumber || DASH}
                </Badge>
                {profile?.loyaltyTier && (
                  <Badge variant="outline" className="text-xs">
                    {profile.loyaltyTier}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchOverview()}
              style={{ borderColor: GOLD + "88" }}
              data-testid="refresh-customer-detail"
            >
              <RefreshCw className="w-4 h-4 ml-2" />
              רענון
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {ovError && <ErrorBox text="טעינת פרטי הלקוח נכשלה." />}

        <Tabs defaultValue="overview" dir="rtl">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <User className="w-4 h-4 ml-2" />
              סקירה
            </TabsTrigger>
            <TabsTrigger value="consents" data-testid="tab-consents">
              <ShieldCheck className="w-4 h-4 ml-2" />
              הסכמות
            </TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">
              <Bell className="w-4 h-4 ml-2" />
              התראות
            </TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-payments">
              <CreditCard className="w-4 h-4 ml-2" />
              תשלומים
            </TabsTrigger>
          </TabsList>

          {/* ── Overview ─────────────────────────────────────────────────── */}
          <TabsContent value="overview">
            {ovLoading ? (
              <Loading />
            ) : !profile ? (
              <Empty text="לא נמצאו פרטים." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border border-black/10">
                  <CardContent className="p-6">
                    <h2 className="font-semibold text-black mb-4">פרטים אישיים</h2>
                    <Row label="שם מלא">{fullName}</Row>
                    <Row label="דוא״ל">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-black/40" />
                        {profile.email || DASH} <Verified ok={profile.emailVerified} />
                      </span>
                    </Row>
                    <Row label="טלפון">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-black/40" />
                        {profile.phone || DASH} <Verified ok={profile.phoneVerified} />
                      </span>
                    </Row>
                    <Row label="מספר חבר">{profile.membershipNumber || DASH}</Row>
                    <Row label="שפה מועדפת">{profile.preferredLanguage || DASH}</Row>
                    <Row label="מדינה">{profile.country || DASH}</Row>
                    <Row label="סטטוס חשבון">{profile.accountStatus || DASH}</Row>
                    <Row label="נוצר בתאריך">{fmtDate(profile.createdAt)}</Row>
                    <Row label="כניסה אחרונה">{fmtDate(profile.lastLoginAt)}</Row>
                  </CardContent>
                </Card>

                <Card className="border border-black/10">
                  <CardContent className="p-6">
                    <h2 className="font-semibold text-black mb-4">סיכום פעילות</h2>
                    <Row label="הזמנות / שטיפות">
                      {overview?.counts.orders ?? DASH}
                    </Row>
                    <Row label="תשלומים">{overview?.counts.payments ?? DASH}</Row>
                    <Row label="יתרת ארנק">
                      {fmtCents(overview?.counts.walletBalanceCents)}
                    </Row>
                    <Row label="דרגת נאמנות">{profile.loyaltyTier || DASH}</Row>
                    {overview?.errors && Object.keys(overview.errors).length > 0 && (
                      <p className="mt-4 text-xs text-orange-600">
                        חלק מהנתונים לא נטענו: {Object.keys(overview.errors).join(", ")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ── Consents ─────────────────────────────────────────────────── */}
          <TabsContent value="consents">
            {consentsLoading ? (
              <Loading />
            ) : consentsError ? (
              <ErrorBox text="טעינת ההסכמות נכשלה." />
            ) : consents.length === 0 ? (
              <Empty text="לא נמצאו הסכמות." />
            ) : (
              <div className="space-y-3">
                {consents.map((c) => (
                  <Card key={c.id} className="border border-black/10">
                    <CardContent className="p-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-black flex items-center gap-2">
                          {c.consentType}
                          <Badge
                            className="text-xs"
                            variant={c.accepted ? "default" : "destructive"}
                          >
                            {c.accepted ? "אושר" : "נדחה"}
                          </Badge>
                        </div>
                        <div className="text-xs text-black/50 mt-1">
                          גרסה {c.consentVersion}
                          {c.source ? ` · ${c.source}` : ""}
                          {c.method ? ` · ${c.method}` : ""}
                        </div>
                      </div>
                      <div className="text-xs text-black/50 whitespace-nowrap">
                        {fmtDate(c.acceptedAt)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Notifications ────────────────────────────────────────────── */}
          <TabsContent value="notifications">
            {notifLoading ? (
              <Loading />
            ) : notifError ? (
              <ErrorBox text="טעינת ההתראות נכשלה." />
            ) : notifications.length === 0 ? (
              <Empty text="לא נמצאו התראות." />
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <Card key={n.id} className="border border-black/10">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-medium text-black truncate">
                            {n.title || n.templateKey}
                          </div>
                          {n.body && (
                            <p className="text-sm text-black/60 mt-1 line-clamp-2">{n.body}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {n.channel}
                            </Badge>
                            {n.status && (
                              <Badge
                                variant={n.status === "failed" || n.status === "permanently_failed" ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {n.status}
                              </Badge>
                            )}
                            {n.eventType && (
                              <span className="text-xs text-black/40">{n.eventType}</span>
                            )}
                          </div>
                          {n.failureReason && (
                            <p className="text-xs text-red-600 mt-1">{n.failureReason}</p>
                          )}
                        </div>
                        <div className="text-xs text-black/50 whitespace-nowrap">
                          {fmtDate(n.createdAt)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Payments ─────────────────────────────────────────────────── */}
          <TabsContent value="payments">
            {payLoading ? (
              <Loading />
            ) : payError ? (
              <ErrorBox text="טעינת התשלומים נכשלה." />
            ) : payments.length === 0 ? (
              <Empty text="לא נמצאו תשלומים." />
            ) : (
              <div className="space-y-3">
                {payments.map((p) => (
                  <Card key={p.id} className="border border-black/10">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-medium text-black flex items-center gap-2 flex-wrap">
                            {fmtCents(p.grossCents)}
                            <Badge variant="outline" className="text-xs">
                              {p.vertical}
                            </Badge>
                            {p.status && (
                              <Badge variant="secondary" className="text-xs">
                                {p.status}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-black/50 mt-1">
                            {p.transactionType}
                            {p.paymentMethod ? ` · ${p.paymentMethod}` : ""}
                            {p.paymentProcessor ? ` · ${p.paymentProcessor}` : ""}
                          </div>
                          <div className="text-xs text-black/40 mt-1 font-mono ltr:text-left" dir="ltr">
                            {p.paymentId} · מע״מ {fmtCents(p.vatCents)}
                          </div>
                        </div>
                        <div className="text-xs text-black/50 whitespace-nowrap">
                          {fmtDate(p.createdAt)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
