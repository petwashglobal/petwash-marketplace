import { Shield, Home, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { SUPPORT_EMAIL, SUPPORT_MAILTO_URL } from "@/lib/support-contact";

export default function AdminAccessDenied() {
  return (
    <div className="min-h-screen luxury-bg-mesh flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Pet Wash Logo */}
        <img 
          src="/brand/petwash-logo-official.png" 
          alt="Pet Wash" 
          className="h-20 w-auto object-contain mx-auto"
        />

        {/* Access Denied Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center shadow-lg">
            <Shield className="w-12 h-12 text-red-500" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold luxury-text-gradient">
            Access Denied
          </h1>
          <p className="text-gray-600">
            You don't have permission to access the Pet Wash Admin Platform. 
            This area is restricted to authorized administrators only.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link href="/">
            <Button className="w-full luxury-btn-primary" data-testid="button-go-home">
              <Home className="w-4 h-4 mr-2" />
              Go to Homepage
            </Button>
          </Link>
          
          <Button 
            className="w-full luxury-btn-secondary"
            onClick={() => window.location.href = SUPPORT_MAILTO_URL}
            data-testid="button-contact-support"
          >
            <Mail className="w-4 h-4 mr-2" />
            Contact Support
          </Button>
        </div>

        <p className="text-sm text-gray-500">
          If you believe you should have access, please contact{" "}
          <a href={SUPPORT_MAILTO_URL} className="text-black underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
