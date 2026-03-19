/**
 * LoyaltyWinbackCard — conditional banner shown when a customer has a
 * pending win-back offer in the queue. Displayed on the Dashboard and
 * CustomerBookings page. Hides itself when winback.eligible === false.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Gift, X } from "lucide-react";
import { useState } from "react";
import { useFirebaseAuth } from "@/auth/AuthProvider";

interface SummaryData {
  winback: {
    eligible:    boolean;
    trigger?:    string;
    scheduledAt?: string;
  };
}

interface Props {
  data?: SummaryData;
}

const TRIGGER_LABEL: Record<string, string> = {
  "14d": "שבועיים",
  "30d": "חודש",
  "60d": "חודשיים",
};

export function LoyaltyWinbackCard({ data: propData }: Props) {
  const { user } = useFirebaseAuth();
  const [dismissed, setDismissed] = useState(false);

  const { data: fetchedData } = useQuery<SummaryData>({
    queryKey: ["/api/loyalty-credits/summary"],
    enabled:  !!user && !propData,
    staleTime: 60_000,
  });

  const data    = propData ?? fetchedData;
  const winback = data?.winback;

  if (!user || !winback?.eligible || dismissed) return null;

  const since = TRIGGER_LABEL[winback.trigger ?? ""] ?? "זמן מה";

  return (
    <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-violet-500 to-purple-600 text-white p-5 shadow-md shadow-purple-200">
      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 left-3 p-1 rounded-full bg-white/20 hover:bg-white/30"
        aria-label="סגור"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
          <Gift className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm mb-1">חזרת! הנה מתנה בשבילך 🎁</p>
          <p className="text-xs text-white/80 leading-relaxed">
            לא הזמנת כבר {since}. כדי לקבל בונוס קרדיטים — בצע הזמנה כלשהי עכשיו.
          </p>
          <Link href="/marketplace">
            <a className="inline-block mt-3 bg-white text-purple-600 font-bold text-xs px-4 py-2 rounded-xl hover:bg-purple-50 transition-colors">
              הזמן עכשיו
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoyaltyWinbackCard;
