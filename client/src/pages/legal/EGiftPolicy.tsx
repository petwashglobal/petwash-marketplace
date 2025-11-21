import { 
  Gift, 
  CreditCard, 
  Mail, 
  Calendar, 
  RefreshCw, 
  Shield, 
  Clock, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Smartphone,
  HelpCircle
} from "lucide-react";

export default function EGiftPolicy() {
  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container max-w-4xl mx-auto py-12">
        {/* Header Section */}
        <div className="text-center mb-16 luxury-animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-6 luxury-shadow-lg">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h1 className="luxury-heading-xl mb-4">
            E-Gift Card Policy
          </h1>
          <div className="luxury-badge luxury-badge-gold">
            <Calendar className="w-4 h-4" />
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>

        {/* Gift Card Features Grid */}
        <div className="luxury-grid-3 mb-12 luxury-animate-slide-up luxury-delay-1">
          <div className="luxury-glass-minimal luxury-hover-lift p-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-4">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">Instant Delivery</h3>
            <p className="luxury-text-small">
              Delivered via email immediately after purchase
            </p>
          </div>

          <div className="luxury-glass-minimal luxury-hover-lift p-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-4">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">Flexible Amounts</h3>
            <p className="luxury-text-small">
              Choose from ₪50 to ₪1,000 denominations
            </p>
          </div>

          <div className="luxury-glass-minimal luxury-hover-lift p-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-4">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">All Platforms</h3>
            <p className="luxury-text-small">
              Use across all Pet Wash™ services and platforms
            </p>
          </div>
        </div>

        <div className="luxury-divider"></div>

        {/* Purchase and Delivery Section */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-2">
          <div className="flex items-center gap-4 mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-700">
              <CreditCard className="w-7 h-7 text-white" />
            </div>
            <h2 className="luxury-heading-md">Purchase and Delivery</h2>
          </div>
          
          <div className="luxury-text-body space-y-4">
            <p>
              Pet Wash™ eGift cards are digital vouchers that can be redeemed for services across all platforms.
            </p>
            
            <ul className="space-y-3 ml-6">
              <li className="flex items-start gap-3">
                <span className="inline-block w-2 h-2 rounded-full bg-purple-600 mt-2 flex-shrink-0"></span>
                <span>eGift cards are delivered instantly via email</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-block w-2 h-2 rounded-full bg-purple-600 mt-2 flex-shrink-0"></span>
                <span>Available in denominations from ₪50 to ₪1,000</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-block w-2 h-2 rounded-full bg-purple-600 mt-2 flex-shrink-0"></span>
                <span>Valid for 12 months from purchase date</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-block w-2 h-2 rounded-full bg-purple-600 mt-2 flex-shrink-0"></span>
                <span>Can be used across all Pet Wash platforms</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Redemption Process */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-3">
          <div className="flex items-center gap-4 mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-700">
              <CheckCircle className="w-7 h-7 text-white" />
            </div>
            <h2 className="luxury-heading-md">How to Redeem</h2>
          </div>
          
          <div className="luxury-text-body mb-6">
            eGift cards can be redeemed at checkout by entering the unique code. Balances can be checked in your Pet Wash Hub account.
          </div>

          <div className="grid gap-4 mt-6">
            <div className="luxury-glass-minimal p-4 flex items-start gap-4">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0">
                <span className="text-white font-bold">1</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Check your email</h4>
                <p className="luxury-text-small">Find your eGift card code in your inbox</p>
              </div>
            </div>

            <div className="luxury-glass-minimal p-4 flex items-start gap-4">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0">
                <span className="text-white font-bold">2</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Select your service</h4>
                <p className="luxury-text-small">Choose any Pet Wash™ service or product</p>
              </div>
            </div>

            <div className="luxury-glass-minimal p-4 flex items-start gap-4">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0">
                <span className="text-white font-bold">3</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Enter code at checkout</h4>
                <p className="luxury-text-small">Apply your unique code to redeem the value</p>
              </div>
            </div>

            <div className="luxury-glass-minimal p-4 flex items-start gap-4">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0">
                <span className="text-white font-bold">4</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Enjoy your service</h4>
                <p className="luxury-text-small">Remaining balance saved for future use</p>
              </div>
            </div>
          </div>
        </div>

        <div className="luxury-divider"></div>

        {/* Refund Policy - eGift Cards */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-700">
              <XCircle className="w-7 h-7 text-white" />
            </div>
            <h2 className="luxury-heading-md">eGift Card Refund Policy</h2>
          </div>
          
          <div className="luxury-text-body mb-6">
            eGift cards are <strong>non-refundable</strong> after purchase. However, unused balances can be transferred to another user upon request.
          </div>

          <div className="luxury-glass-panel p-4 border-l-4 border-amber-500">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="luxury-text-small text-amber-900 dark:text-amber-200">
                <strong>Important:</strong> Please double-check recipient email addresses before purchasing. We cannot modify or cancel orders once processed.
              </p>
            </div>
          </div>
        </div>

        {/* Service Refunds */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-5">
          <div className="flex items-center gap-4 mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-700">
              <RefreshCw className="w-7 h-7 text-white" />
            </div>
            <h2 className="luxury-heading-md">Service Refunds</h2>
          </div>
          
          <div className="luxury-text-body mb-4">
            Service refunds depend on the platform:
          </div>
          
          <ul className="space-y-3 ml-6">
            <li className="flex items-start gap-3">
              <span className="inline-block w-2 h-2 rounded-full bg-purple-600 mt-2 flex-shrink-0"></span>
              <span><strong>K9000 Stations</strong>: Full refund if station malfunctions</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="inline-block w-2 h-2 rounded-full bg-purple-600 mt-2 flex-shrink-0"></span>
              <span><strong>Bookings</strong>: Refund per cancellation policy (varies by service)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="inline-block w-2 h-2 rounded-full bg-purple-600 mt-2 flex-shrink-0"></span>
              <span><strong>Loyalty Rewards</strong>: Points refunded if service not rendered</span>
            </li>
          </ul>
        </div>

        {/* Cancellation Timeframes */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-700">
              <Clock className="w-7 h-7 text-white" />
            </div>
            <h2 className="luxury-heading-md">Cancellation Timeframes</h2>
          </div>
          
          <div className="grid gap-4">
            <div className="luxury-glass-panel p-4 border-l-4 border-green-500">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900 dark:text-gray-100">Pet Sitter</span>
                <span className="luxury-badge luxury-badge-success">48 hours notice</span>
              </div>
              <p className="luxury-text-small mt-2">Full refund with 48 hours advance notice</p>
            </div>

            <div className="luxury-glass-panel p-4 border-l-4 border-blue-500">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900 dark:text-gray-100">Dog Walker</span>
                <span className="luxury-badge luxury-badge-success">24 hours notice</span>
              </div>
              <p className="luxury-text-small mt-2">Full refund with 24 hours advance notice</p>
            </div>

            <div className="luxury-glass-panel p-4 border-l-4 border-purple-500">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900 dark:text-gray-100">Pet Transport</span>
                <span className="luxury-badge luxury-badge-success">24 hours notice</span>
              </div>
              <p className="luxury-text-small mt-2">Full refund with 24 hours advance notice</p>
            </div>

            <div className="luxury-glass-panel p-4 border-l-4 border-indigo-500">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900 dark:text-gray-100">Training</span>
                <span className="luxury-badge luxury-badge-success">48 hours notice</span>
              </div>
              <p className="luxury-text-small mt-2">Full refund with 48 hours advance notice</p>
            </div>
          </div>
        </div>

        <div className="luxury-divider"></div>

        {/* Disputes */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-7">
          <div className="flex items-center gap-4 mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-700">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h2 className="luxury-heading-md">Disputes & Resolution</h2>
          </div>
          
          <div className="luxury-text-body">
            For refund disputes, contact support@petwash.co.il within 14 days of service. Our team will review your case and respond within 2-3 business days.
          </div>
        </div>

        {/* Lost or Stolen Cards */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-red-700">
              <AlertCircle className="w-7 h-7 text-white" />
            </div>
            <h2 className="luxury-heading-md">Lost or Stolen eGift Cards</h2>
          </div>
          
          <div className="luxury-text-body mb-4">
            We cannot replace lost or stolen eGift cards. Treat them like cash.
          </div>

          <div className="luxury-glass-panel p-4 border-l-4 border-red-500">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="luxury-text-small text-red-900 dark:text-red-200">
                <strong>Security Tip:</strong> Keep your eGift card code secure and do not share it with anyone you don't trust. Once redeemed, we cannot recover the funds.
              </p>
            </div>
          </div>
        </div>

        <div className="luxury-divider"></div>

        {/* Contact & Support */}
        <div className="luxury-glass-card luxury-shadow-lg p-8 text-center luxury-animate-slide-up luxury-delay-9">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-6 mx-auto">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="luxury-heading-md mb-4">Need Help?</h2>
          
          <p className="luxury-text-body mb-6">
            Our customer support team is here to assist you with any questions about eGift cards, refunds, or redemptions.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a 
              href="mailto:support@petwash.co.il" 
              className="luxury-text-gradient text-lg font-semibold hover:opacity-80 transition-opacity"
            >
              support@petwash.co.il
            </a>
            <span className="hidden sm:inline text-gray-300">•</span>
            <span className="luxury-text-body">Available 24/7</span>
          </div>
        </div>
      </div>
    </div>
  );
}
