import { Shield, Home, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function AdminAccessDenied() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Pet Wash Logo */}
        <img 
          src="/brand/petwash-logo-official.png" 
          alt="Pet Wash" 
          className="h-20 w-auto object-contain mx-auto"
        />

        {/* Access Denied Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
            <Shield className="w-12 h-12 text-gray-400" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-black">
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
            <Button className="w-full bg-black hover:bg-gray-800 text-white" data-testid="button-go-home">
              <Home className="w-4 h-4 mr-2" />
              Go to Homepage
            </Button>
          </Link>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => window.location.href = 'mailto:support@petwash.co.il'}
            data-testid="button-contact-support"
          >
            <Mail className="w-4 h-4 mr-2" />
            Contact Support
          </Button>
        </div>

        <p className="text-sm text-gray-500">
          If you believe you should have access, please contact{" "}
          <a href="mailto:support@petwash.co.il" className="text-black underline">
            support@petwash.co.il
          </a>
        </p>
      </div>
    </div>
  );
}
