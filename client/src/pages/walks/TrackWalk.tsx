import { useParams } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Footprints, Camera, CheckCircle } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";
import { useQuery } from "@tanstack/react-query";

export default function TrackWalk() {
  const { walkId } = useParams();
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const { data: walk, isLoading } = useQuery({
    queryKey: ['/api/walk', walkId],
    enabled: !!walkId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-6 w-6 text-blue-600" />
              {isHebrew ? 'מעקב אחר הליכה' : 'Track Walk'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Live GPS Map Placeholder */}
              <div className="bg-gray-200 rounded-lg h-96 flex items-center justify-center">
                <p className="text-gray-500">
                  {isHebrew ? 'מפת GPS בזמן אמת' : 'Live GPS Map'}
                </p>
              </div>

              {/* Walk Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <Clock className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                  <p className="text-sm text-gray-600">
                    {isHebrew ? 'זמן' : 'Duration'}
                  </p>
                  <p className="font-bold">--:--</p>
                </div>
                <div className="text-center">
                  <Footprints className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <p className="text-sm text-gray-600">
                    {isHebrew ? 'מרחק' : 'Distance'}
                  </p>
                  <p className="font-bold">-- km</p>
                </div>
                <div className="text-center">
                  <Camera className="h-8 w-8 mx-auto text-purple-600 mb-2" />
                  <p className="text-sm text-gray-600">
                    {isHebrew ? 'תמונות' : 'Photos'}
                  </p>
                  <p className="font-bold">--</p>
                </div>
              </div>

              <Button className="w-full" variant="outline" data-testid="button-refresh">
                <CheckCircle className="mr-2 h-4 w-4" />
                {isHebrew ? 'רענן מיקום' : 'Refresh Location'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
