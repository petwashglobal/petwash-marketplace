import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import PublicWeatherView from '@/components/weather/PublicWeatherView';
import ClientWeatherView from '@/components/weather/ClientWeatherView';
import EmployeeStationView from '@/components/weather/EmployeeStationView';
import EmployeeExecutiveView from '@/components/weather/EmployeeExecutiveView';

export default function RoleAwareWeatherPlanner() {
  const [location, setLocation] = useState('Tel Aviv');
  const [language, setLanguage] = useState('en');
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/weather/planner?location=${encodeURIComponent(location)}&lang=${language}`, user?.uid],
    enabled: !!location,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden">
        <div className="relative z-10 container mx-auto px-4 py-12">
          <div className="max-w-7xl mx-auto space-y-8">
            <Skeleton className="h-32 w-full bg-white/10" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(7)].map((_, i) => (
                <Skeleton key={i} className="h-96 bg-white/10" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Unable to load weather data</h2>
          <p className="text-gray-400">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden">
      {/* Luxury Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.03) 10px, rgba(255,255,255,0.03) 20px)`
        }} />
      </div>

      {/* Animated Gradient Orbs */}
      <motion.div
        className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-amber-500/20 via-yellow-400/10 to-transparent rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-blue-500/20 via-cyan-400/10 to-transparent rounded-full blur-3xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 6, repeat: Infinity }}
      />

      {/* Content */}
      <div className="relative z-10">
        {'forecast' in data && <PublicWeatherView data={data} location={location} onLocationChange={setLocation} />}
        {'bestDaysThisWeek' in data && <ClientWeatherView data={data} />}
        {'assignedStations' in data && <EmployeeStationView data={data} />}
        {'allFranchiseLocations' in data && <EmployeeExecutiveView data={data} />}
      </div>
    </div>
  );
}
