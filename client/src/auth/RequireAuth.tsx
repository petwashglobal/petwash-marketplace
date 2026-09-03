import { Redirect, useLocation } from "wouter";
import { useFirebaseAuth } from "./AuthProvider";
import { buildReturnToParam } from "./returnTo";

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
    // Phase 8.b migration (2026-09-01): canonical ?returnTo= via
    // buildReturnToParam. Also blocks open-redirect vectors (protocol-
    // relative //evil, absolute URLs, javascript:, CRLF) and returns ''
    // when the target is the default landing so no redundant query
    // string. Preserves the pre-migration skip-list behaviour via the
    // helper's own default-target rules.
    const skip = ['/', '/signin', '/signup', '/complete-profile'];
    const returnParam = skip.includes(location) ? '' : buildReturnToParam(location);
    return <Redirect to={`/signin${returnParam}`} />;
  }

  return children;
}
