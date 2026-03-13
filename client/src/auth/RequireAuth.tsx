import { Redirect } from "wouter";
import { useFirebaseAuth } from "./AuthProvider";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useFirebaseAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0a0a0a] to-[#1a1a2e]">
        <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/signin" />;
  }

  return children;
}
