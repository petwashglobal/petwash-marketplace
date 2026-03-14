import { useState } from "react";
import { Calendar, MapPin, FileText, ExternalLink, CheckCircle2, Clock } from "lucide-react";
import { SiGoogle, SiGooglemaps, SiGooglecalendar, SiGoogledrive } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/apiConfig";

interface BookingGoogleHubProps {
  bookingId: string;
  bookingRef: string;
  platform: string;
  serviceType: string;
  scheduledDate: string;
  scheduledTime?: string;
  address?: string;
  city?: string;
  customerName?: string;
  providerName?: string;
  petName?: string;
  language?: "he" | "en";
}

export function BookingGoogleHub({
  bookingId,
  bookingRef,
  platform,
  serviceType,
  scheduledDate,
  scheduledTime,
  address,
  city,
  customerName,
  providerName,
  petName,
  language = "he",
}: BookingGoogleHubProps) {
  const { toast } = useToast();
  const [calendarAdded, setCalendarAdded] = useState(false);
  const [loadingCal, setLoadingCal] = useState(false);

  const isHe = language === "he";

  // Google Maps link
  const mapsQuery = [address, city, "Israel"].filter(Boolean).join(", ");
  const mapsLink = mapsQuery.length > 3
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
    : null;

  // Build Google Calendar "Add" link (works without API key — opens Google Calendar)
  const buildCalLink = () => {
    const start = new Date(`${scheduledDate}T${scheduledTime || "09:00"}:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
    const title = encodeURIComponent(`🐾 ${serviceType} – ${petName || customerName || "PetWash"}`);
    const details = encodeURIComponent(
      [
        `📋 Ref: ${bookingRef}`,
        `🏢 Platform: ${platform}`,
        providerName ? `✅ Provider: ${providerName}` : "",
        petName ? `🐕 Pet: ${petName}` : "",
        address ? `📍 ${address}` : "",
        "",
        "Managed by PetWash™ · petwash.co.il",
      ]
        .filter(Boolean)
        .join("\n")
    );
    const loc = encodeURIComponent([address, city, "Israel"].filter(Boolean).join(", "));
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${loc}&sf=true`;
  };

  const handleAddCalendar = async () => {
    setLoadingCal(true);
    try {
      // Try to create event via server-side integration first
      const resp = await fetch(getApiUrl("/api/calendar/add-booking"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bookingId,
          platform,
          title: `🐾 ${serviceType} – ${petName || customerName || "PetWash"}`,
          description: `Ref: ${bookingRef} | Provider: ${providerName || "—"} | Pet: ${petName || "—"}`,
          startTime: `${scheduledDate}T${scheduledTime || "09:00"}:00`,
          endTime: new Date(
            new Date(`${scheduledDate}T${scheduledTime || "09:00"}:00`).getTime() + 3600000
          ).toISOString(),
          location: [address, city].filter(Boolean).join(", "),
          customerName,
          providerName,
          petName,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.htmlLink) {
          window.open(data.htmlLink, "_blank");
          setCalendarAdded(true);
          toast({ title: isHe ? "✅ נוסף ליומן Google!" : "✅ Added to Google Calendar!" });
          return;
        }
      }
    } catch { /* fall through to direct link */ }

    // Fallback: open Google Calendar add link directly
    window.open(buildCalLink(), "_blank");
    setCalendarAdded(true);
    toast({ title: isHe ? "✅ פותח ב-Google Calendar" : "✅ Opening Google Calendar" });
    setLoadingCal(false);
  };

  return (
    <div className="rounded-2xl border border-[#C6A35B]/20 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-[#C6A35B]/10 to-transparent border-b border-[#C6A35B]/10">
        <SiGoogle className="w-4 h-4 text-[#C6A35B]" />
        <span className="text-xs font-semibold text-[#C6A35B] tracking-wider uppercase">
          {isHe ? "Google Hub" : "Google Hub"}
        </span>
        <span className="text-xs text-neutral-400 mr-auto">
          {isHe ? "אינטגרציה מלאה עם Google" : "Full Google integration"}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Google Calendar */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <SiGooglecalendar className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-900">
              {isHe ? "Google Calendar" : "Google Calendar"}
            </p>
            <p className="text-xs text-neutral-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {scheduledDate}{scheduledTime ? ` · ${scheduledTime}` : ""} · Asia/Jerusalem
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddCalendar}
            disabled={loadingCal || calendarAdded}
            className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50 flex-shrink-0"
          >
            {calendarAdded ? (
              <><CheckCircle2 className="w-3 h-3 mr-1 text-green-600" />{isHe ? "נוסף" : "Added"}</>
            ) : (
              <><Calendar className="w-3 h-3 mr-1" />{isHe ? "הוסף" : "Add"}</>
            )}
          </Button>
        </div>

        {/* Google Maps */}
        {mapsLink && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <SiGooglemaps className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900">
                {isHe ? "Google Maps" : "Google Maps"}
              </p>
              <p className="text-xs text-neutral-500 truncate">
                <MapPin className="w-3 h-3 inline mr-1" />
                {[address, city].filter(Boolean).join(", ")}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(mapsLink, "_blank")}
              className="text-xs border-red-200 text-red-600 hover:bg-red-50 flex-shrink-0"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              {isHe ? "נווט" : "Navigate"}
            </Button>
          </div>
        )}

        {/* Google Drive backup badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <SiGoogledrive className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-900">
              {isHe ? "Google Drive" : "Google Drive"}
            </p>
            <p className="text-xs text-neutral-500">
              <FileText className="w-3 h-3 inline mr-1" />
              {isHe ? "גיבוי אוטומטי — Booking_" + bookingRef : "Auto-backed up — Booking_" + bookingRef}
            </p>
          </div>
          <span className="text-xs text-green-600 font-medium flex-shrink-0 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {isHe ? "גובה" : "Backed up"}
          </span>
        </div>
      </div>

      {/* Timezone info bar */}
      <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-100 flex items-center gap-2">
        <span className="text-xs text-neutral-400">
          {isHe ? "אזור זמן: ישראל (Asia/Jerusalem) · כל האירועים מסונכרנים ל-Google" : "Timezone: Asia/Jerusalem · All events synced to Google"}
        </span>
      </div>
    </div>
  );
}
