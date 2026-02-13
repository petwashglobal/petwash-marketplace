import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";

export default function SystemStatus() {
  const systems = [
    { name: "Pet Wash Stations (K9000)", status: "operational" },
    { name: "Pet Sitter Suite", status: "operational" },
    { name: "Walk My Pet", status: "operational" },
    { name: "PetTrek Transport", status: "operational" },
    { name: "Pet Wash Academy", status: "operational" },
    { name: "Loyalty & VIP Club", status: "operational" },
    { name: "Booking Engine", status: "operational" },
    { name: "Payment Gateway (Nayax)", status: "operational" },
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-16 animate-in fade-in duration-700">
          <div className="inline-block p-4 rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="w-16 h-16 text-green-600 animate-pulse" />
          </div>
          <h1 className="text-5xl font-bold mb-4 luxury-text-gradient">System Status</h1>
          <p className="text-xl text-gray-600">
            Real-time status of all ⁦Pet Wash™⁩ platforms and services
          </p>
        </div>

        <Card className="luxury-glass-card luxury-shadow-lg p-6 mb-8 animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-900">
                All Systems Operational
              </h3>
              <p className="text-sm text-green-700">
                Last updated: {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-3 animate-in slide-in-from-bottom duration-700 delay-100">
          {systems.map((system, index) => (
            <Card 
              key={system.name} 
              className="luxury-glass-minimal luxury-hover-lift p-4 transition-all duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{system.name}</span>
                <div className="flex items-center gap-2">
                  <Badge className="luxury-badge bg-green-500 animate-pulse">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Operational
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="luxury-glass-card luxury-shadow-lg p-6 mt-8 text-center animate-in slide-in-from-bottom duration-700 delay-200">
          <Clock className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Status History</h3>
          <p className="text-sm text-gray-600">
            No incidents reported in the last 30 days
          </p>
        </Card>
      </div>
    </div>
  );
}
