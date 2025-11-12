import { useEffect } from "react";
import { useLocation } from "wouter";
import { useFirebaseAuth } from "./AuthProvider";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useFirebaseAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Only redirect if we're done loading and there's no user
    if (!loading && !user) {
      setLocation("/signin");
    }
  }, [loading, user, setLocation]);

  // Auth is already checked in Router, so we don't need double loading screen
  // Just redirect if needed
  if (!user) {
    return null;
  }

  return children;
}
