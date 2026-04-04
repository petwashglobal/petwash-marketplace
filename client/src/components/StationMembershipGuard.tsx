/**
 * StationMembershipGuard
 *
 * Route-level wrapper that verifies the authenticated user is an active operator
 * (or franchise owner) of the requested station before rendering station-scoped
 * pages.  Uses the /api/station-operators/my-stations result so the check is
 * consistent with the station selector displayed inside the dashboard.
 *
 * Placed at route registration level in App.tsx so unauthorized users are
 * blocked before any station-scoped page is rendered.
 */

import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';

type MyStationsResponse = { stations: Array<{ id: number }> };

interface Props {
  children: React.ReactNode;
}

export default function StationMembershipGuard({ children }: Props) {
  const params = useParams<{ stationId: string }>();
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const stationId = parseInt(params.stationId ?? '0', 10);

  const { data, isLoading, isError } = useQuery<MyStationsResponse>({
    queryKey: ['/api/station-operators/my-stations'],
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 p-4" dir={isHebrew ? 'rtl' : 'ltr'}>
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  const hasAccess = !isError && !!data && isFinite(stationId) && data.stations.some((s) => s.id === stationId);

  if (isError || !data || !hasAccess) {
    return (
      <div
        className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center p-4"
        dir={isHebrew ? 'rtl' : 'ltr'}
      >
        <Card className="max-w-sm w-full">
          <CardContent className="pt-10 pb-10 text-center">
            <ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-black font-medium">
              {isHebrew
                ? 'אין לך הרשאה לצפות בעמדה זו.'
                : 'You do not have access to this station.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
