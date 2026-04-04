/**
 * PetTrek Booking Flow — LEGALLY BLOCKED
 *
 * PetTrek is NOT licensed for commercial operation in Israel.
 * DO NOT restore any booking functionality without written legal clearance
 * from PetWash Ltd. legal counsel.
 *
 * Server-side enforcement: all /api/pettrek/* and /api/unified-booking/*
 * endpoints return 403 PETTREK_NOT_LICENSED for this service.
 */

import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function PetTrekBookingFlow() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <ShieldAlert className="w-16 h-16 text-amber-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900" dir="rtl">
            שירות זה אינו זמין
          </h1>
          <p className="text-lg text-gray-700">
            Service Not Available
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 text-sm text-gray-700 space-y-2" dir="rtl">
          <p>
            <strong>PetTrek</strong> אינו מורשה לפעול בישראל בשלב זה.
          </p>
          <p>
            השירות מושהה בהתאם לדרישות רגולטוריות.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg px-5 py-4 text-sm text-gray-700 space-y-1">
          <p className="font-medium">PetTrek is not licensed for operation in Israel at this time.</p>
          <p>The service is suspended pending regulatory requirements.</p>
        </div>

        <div className="text-sm text-gray-500">
          <p>לפרטים נוספים / For inquiries:</p>
          <a
            href="mailto:support@petwash.co.il"
            className="text-amber-600 hover:text-amber-700 font-medium"
          >
            support@petwash.co.il
          </a>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => setLocation("/")}
        >
          חזרה לדף הבית / Back to Home
        </Button>
      </div>
    </div>
  );
}
