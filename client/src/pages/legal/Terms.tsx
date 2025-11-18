import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <FileText className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-4">Terms and Conditions</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <Card className="p-8">
          <div className="prose dark:prose-invert max-w-none">
            <h2>1. Agreement to Terms</h2>
            <p>
              By accessing or using Pet Wash™ services, you agree to be bound by these Terms and Conditions.
            </p>

            <h2>2. Use of Services</h2>
            <p>
              Pet Wash™ provides access to 8 integrated platforms: Pet Wash Stations, Pet Sitter Suite,
              Walk My Pet, PetTrek Transport, Pet Wash Academy, Pet Wash Shop, Loyalty & VIP Club, and Avatar Studio.
            </p>

            <h2>3. User Accounts</h2>
            <p>
              Users must create a Pet Wash Hub™ account to access services. You are responsible for
              maintaining the security of your account credentials.
            </p>

            <h2>4. Bookings and Payments</h2>
            <p>
              All bookings are subject to availability. Payments are processed through our secure payment
              gateway (Nayax Israel) with 72-hour escrow protection.
            </p>

            <h2>5. Loyalty Program</h2>
            <p>
              The Loyalty & VIP Club program is subject to additional terms. Rewards and benefits may
              change at Pet Wash's discretion.
            </p>

            <h2>6. Cancellation Policy</h2>
            <p>
              Cancellation policies vary by service. Please review service-specific terms before booking.
            </p>

            <h2>7. Limitation of Liability</h2>
            <p>
              Pet Wash™ is not liable for indirect, incidental, or consequential damages arising from
              use of our services.
            </p>

            <h2>8. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use constitutes acceptance
              of updated terms.
            </p>

            <h2>9. Contact</h2>
            <p>
              For questions about these terms, contact us at legal@petwash.co.il
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
