import { useEffect } from "react";

export default function AdminUsers() {
  useEffect(() => {
    // Redirect to new Enterprise HQ Dashboard
    window.location.href = "/enterprise/hq";
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Enterprise Dashboard...</p>
      </div>
    </div>
  );
}
