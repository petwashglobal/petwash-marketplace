import { useQuery } from "@tanstack/react-query";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Hook to fetch franchiseId from the authenticated user's Firestore profile
 */
export function useFranchiseId() {
  const { user } = useFirebaseAuth();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['franchiseId', user?.uid],
    queryFn: async () => {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }
      
      const userProfileRef = doc(db, 'userProfiles', user.uid);
      const userProfileSnap = await getDoc(userProfileRef);
      
      if (!userProfileSnap.exists()) {
        throw new Error('User profile not found');
      }
      
      const profileData = userProfileSnap.data();
      const franchiseId = profileData.franchiseId;
      
      if (!franchiseId) {
        throw new Error('No franchise assigned to this user');
      }
      
      return franchiseId as string;
    },
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
  
  return {
    franchiseId: data,
    isLoading,
    error: error as Error | null,
    hasFranchise: !!data,
  };
}
