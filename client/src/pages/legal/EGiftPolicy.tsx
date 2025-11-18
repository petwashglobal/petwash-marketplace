import { Card } from "@/components/ui/card";
import { Gift } from "lucide-react";

export default function EGiftPolicy() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <Gift className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-4">eGift and Refund Policy</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <Card className="p-8">
          <div className="prose dark:prose-invert max-w-none">
            <h2>1. eGift Cards</h2>
            <p>
              Pet Wash™ eGift cards are digital vouchers that can be redeemed for services across all platforms.
            </p>

            <h2>2. Purchase and Delivery</h2>
            <ul>
              <li>eGift cards are delivered instantly via email</li>
              <li>Available in denominations from ₪50 to ₪1,000</li>
              <li>Valid for 12 months from purchase date</li>
              <li>Can be used across all Pet Wash platforms</li>
            </ul>

            <h2>3. Redemption</h2>
            <p>
              eGift cards can be redeemed at checkout by entering the unique code. Balances
              can be checked in your Pet Wash Hub account.
            </p>

            <h2>4. Refund Policy - eGift Cards</h2>
            <p>
              eGift cards are <strong>non-refundable</strong> after purchase. However, unused
              balances can be transferred to another user upon request.
            </p>

            <h2>5. Service Refunds</h2>
            <p>
              Service refunds depend on the platform:
            </p>
            <ul>
              <li><strong>K9000 Stations</strong>: Full refund if station malfunctions</li>
              <li><strong>Bookings</strong>: Refund per cancellation policy (varies by service)</li>
              <li><strong>Loyalty Rewards</strong>: Points refunded if service not rendered</li>
            </ul>

            <h2>6. Cancellation Timeframes</h2>
            <ul>
              <li>Pet Sitter: 48 hours notice for full refund</li>
              <li>Dog Walker: 24 hours notice for full refund</li>
              <li>Pet Transport: 24 hours notice for full refund</li>
              <li>Training: 48 hours notice for full refund</li>
            </ul>

            <h2>7. Disputes</h2>
            <p>
              For refund disputes, contact support@petwash.co.il within 14 days of service.
            </p>

            <h2>8. Lost or Stolen eGift Cards</h2>
            <p>
              We cannot replace lost or stolen eGift cards. Treat them like cash.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
