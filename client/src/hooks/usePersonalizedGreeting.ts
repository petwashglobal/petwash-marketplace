/**
 * Pet Wash™ - Personalized AI Greeting Hook
 * 
 * Fetches personalized greetings from the AI service on app launch
 * Shows greetings based on:
 * - User's birthday 🎉
 * - Israeli/Jewish holidays 🕎
 * - Time of day (morning ☀️, late night 🌙)
 * - User's preferred language (Hebrew/English)
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseAuth } from '@/auth/AuthProvider';

interface PersonalizedGreeting {
  greeting: string;
  userName: string;
  language: 'he' | 'en';
}

export function usePersonalizedGreeting() {
  const { user, loading: authLoading } = useFirebaseAuth();
  const { toast } = useToast();
  const [greetingShown, setGreetingShown] = useState(false);

  // Fetch personalized greeting
  const { data, isLoading, error } = useQuery<PersonalizedGreeting>({
    queryKey: ['/api/greeting/personalized', user?.uid],
    enabled: !!user && !authLoading && !greetingShown,
    staleTime: 5 * 60 * 1000, // 5 minutes (greetings change by time of day)
    retry: 1
  });

  // Show greeting toast when data arrives
  useEffect(() => {
    if (data && data.greeting && !greetingShown) {
      // Show personalized greeting in toast
      toast({
        title: data.greeting,
        description: data.language === 'he' 
          ? `שמחים לראות אותך! 🐾`
          : `Great to have you here! 🐾`,
        duration: 6000, // 6 seconds
      });

      setGreetingShown(true);
    }
  }, [data, greetingShown, toast]);

  return {
    greeting: data?.greeting,
    userName: data?.userName,
    language: data?.language,
    isLoading,
    error,
    greetingShown
  };
}
