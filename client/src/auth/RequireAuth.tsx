import { Redirect, useLocation } from "wouter";
import { useFirebaseAuth } from "./AuthProvider";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useFirebaseAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0a0a0a] to-[#1a1a2e]">
        <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Preserve where the user was trying to go so after sign-in they land there,
    // not on the generic /home page. Only preserve non-auth paths.
    const skip = ['/', '/signin', '/signup', '/choose-role', '/complete-profile'];
    const returnParam = skip.includes(location) ? '' : `?from=${encodeURIComponent(location)}`;
    return <Redirect to={`/signin${returnParam}`} />;
  }

  return children;
}
