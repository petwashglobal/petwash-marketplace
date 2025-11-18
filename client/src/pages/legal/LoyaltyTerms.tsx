import { Card } from "@/components/ui/card";
import { Award } from "lucide-react";

export default function LoyaltyTerms() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <Award className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-4">Loyalty & VIP Club Terms</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <Card className="p-8">
          <div className="prose dark:prose-invert max-w-none">
            <h2>1. Program Overview</h2>
            <p>
              The Pet Wash™ Loyalty & VIP Club is a free rewards program offering exclusive
              benefits across all platforms.
            </p>

            <h2>2. Membership Tiers</h2>
            <p>
              The program features 7 luxury tiers:
            </p>
            <ul>
              <li><strong>Bronze</strong>: 0 points (entry level)</li>
              <li><strong>Silver</strong>: 1,000 points</li>
              <li><strong>Gold</strong>: 3,000 points</li>
              <li><strong>Platinum</strong>: 6,000 points</li>
              <li><strong>Diamond</strong>: 10,000 points</li>
              <li><strong>Emerald</strong>: 20,000 points</li>
              <li><strong>Royal</strong>: 35,000 points</li>
            </ul>

            <h2>3. Earning Points</h2>
            <p>
              Points are earned through:
            </p>
            <ul>
              <li>Service bookings (1 point per ₪1 spent)</li>
              <li>Station usage (bonus points for organic products)</li>
              <li>Referrals (500 points per successful referral)</li>
              <li>Birthday rewards (automatic tier-based bonus)</li>
              <li>Special promotions and challenges</li>
            </ul>

            <h2>4. Tier Benefits</h2>
            <p>
              Benefits increase with tiers:
            </p>
            <ul>
              <li>Discounted wash rates (5% to 25% off)</li>
              <li>Priority booking</li>
              <li>Exclusive VIP events</li>
              <li>Free birthday washes</li>
              <li>Early access to new services</li>
              <li>Premium customer support</li>
            </ul>

            <h2>5. Point Expiration</h2>
            <p>
              Points expire after 24 months of inactivity. Active members retain points indefinitely.
            </p>

            <h2>6. Tier Retention</h2>
            <p>
              Tiers are recalculated annually. Maintain point threshold to keep tier status.
            </p>

            <h2>7. Program Changes</h2>
            <p>
              Pet Wash™ reserves the right to modify benefits, point values, and tier requirements
              with 30 days notice.
            </p>

            <h2>8. Termination</h2>
            <p>
              Membership may be terminated for fraud, abuse, or violation of terms. Points forfeit
              upon termination.
            </p>

            <h2>9. Contact</h2>
            <p>
              Loyalty program questions: loyalty@petwash.co.il
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
