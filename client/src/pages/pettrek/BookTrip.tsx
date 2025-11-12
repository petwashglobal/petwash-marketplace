import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Navigation, DollarSign } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";
import { useState } from "react";

export default function BookTrip() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-6 w-6 text-purple-600" />
              {isHebrew ? 'הזמנת נסיעה' : 'Book Pet Transport'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setEstimatedFare(120); }}>
              <div>
                <Label htmlFor="pickup">
                  {isHebrew ? 'נקודת איסוף' : 'Pickup Location'}
                </Label>
                <Input
                  id="pickup"
                  placeholder={isHebrew ? 'הזן כתובת' : 'Enter address'}
                  data-testid="input-pickup"
                />
              </div>

              <div>
                <Label htmlFor="dropoff">
                  {isHebrew ? 'יעד' : 'Drop-off Location'}
                </Label>
                <Input
                  id="dropoff"
                  placeholder={isHebrew ? 'הזן כתובת' : 'Enter address'}
                  data-testid="input-dropoff"
                />
              </div>

              <div>
                <Label htmlFor="petType">
                  {isHebrew ? 'סוג חיית מחמד' : 'Pet Type'}
                </Label>
                <Input
                  id="petType"
                  placeholder={isHebrew ? 'כלב, חתול, וכו׳' : 'Dog, cat, etc.'}
                  data-testid="input-pet-type"
                />
              </div>

              {estimatedFare && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold">
                      {isHebrew ? 'מחיר משוער:' : 'Estimated Fare:'}
                    </span>
                    <span className="text-xl font-bold">₪{estimatedFare}</span>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" data-testid="button-book-trip">
                {isHebrew ? 'הזמן נסיעה' : 'Book Trip'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
