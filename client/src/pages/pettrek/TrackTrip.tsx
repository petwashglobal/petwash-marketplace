import { useParams } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Clock, Car, Phone } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";
import { Button } from "@/components/ui/button";

export default function TrackTrip() {
  const { tripId } = useParams();
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-6 w-6 text-purple-600" />
              {isHebrew ? 'מעקב אחר נסיעה' : 'Track Trip'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Live Map */}
              <div className="bg-gray-200 rounded-lg h-96 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 mx-auto text-purple-600 mb-2" />
                  <p className="text-gray-500">
                    {isHebrew ? 'מפה בזמן אמת' : 'Live GPS Tracking'}
                  </p>
                  <p className="text-sm text-gray-400">Trip ID: {tripId}</p>
                </div>
              </div>

              {/* Trip Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-600 mb-2" />
                  <p className="text-sm text-gray-600">
                    {isHebrew ? 'זמן משוער' : 'ETA'}
                  </p>
                  <p className="font-bold">-- min</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <MapPin className="h-5 w-5 text-green-600 mb-2" />
                  <p className="text-sm text-gray-600">
                    {isHebrew ? 'מרחק' : 'Distance'}
                  </p>
                  <p className="font-bold">-- km</p>
                </div>
              </div>

              <Button className="w-full" variant="outline" data-testid="button-contact-driver">
                <Phone className="mr-2 h-4 w-4" />
                {isHebrew ? 'צור קשר עם הנהג' : 'Contact Driver'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
