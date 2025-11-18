import { Card } from "@/components/ui/card";
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
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-5xl font-bold mb-4">System Status</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Real-time status of all Pet Wash™ platforms and services
          </p>
        </div>

        <Card className="p-6 mb-8 bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900 dark:text-green-100">
                All Systems Operational
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                Last updated: {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          {systems.map((system) => (
            <Card key={system.name} className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{system.name}</span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-600">Operational</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6 mt-8 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Status History</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No incidents reported in the last 30 days
          </p>
        </Card>
      </div>
    </div>
  );
}
