import { Cookie, Shield, Target, TrendingUp, Settings, Database, Clock, Mail } from "lucide-react";

export default function CookiesPolicy() {
  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container max-w-5xl py-16">
        {/* Header Section */}
        <div className="text-center mb-16 luxury-animate-fade-in">
          {/* Cookie Icon in Gradient Circle */}
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-6 luxury-shadow-lg">
            <Cookie className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="luxury-heading-xl mb-6">
            Cookie Policy
          </h1>
          
          {/* Last Updated Badge */}
          <div className="luxury-badge luxury-badge-gold">
            <Clock className="w-4 h-4" />
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>

        {/* What Are Cookies Section */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-1">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center luxury-shadow-md">
              <Cookie className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="luxury-heading-md mb-4">What Are Cookies?</h2>
              <p className="luxury-text-body">
                Cookies are small text files stored on your device when you visit our website.
                They help us provide a better experience and understand how you use our services.
              </p>
            </div>
          </div>
        </div>

        {/* Cookie Categories Grid */}
        <div className="mb-12 luxury-animate-slide-up luxury-delay-2">
          <h2 className="luxury-heading-md mb-8 text-center">Types of Cookies We Use</h2>
          
          <div className="luxury-grid-2 mb-8">
            {/* Essential Cookies */}
            <div className="luxury-glass-minimal luxury-hover-lift p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center luxury-shadow-sm">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="luxury-heading-sm mb-2">Essential Cookies</h3>
                  <p className="luxury-badge luxury-badge-success mb-3 inline-flex">Required</p>
                  <p className="luxury-text-small mb-3">
                    These cookies are necessary for the website to function properly:
                  </p>
                  <ul className="space-y-2">
                    <li className="luxury-text-small flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>Authentication and session management</span>
                    </li>
                    <li className="luxury-text-small flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>Security and fraud prevention</span>
                    </li>
                    <li className="luxury-text-small flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>Language and regional preferences</span>
                    </li>
                    <li className="luxury-text-small flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>Shopping cart and booking state</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Analytics Cookies */}
            <div className="luxury-glass-minimal luxury-hover-lift p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center luxury-shadow-sm">
                  <Target className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="luxury-heading-sm mb-2">Analytics Cookies</h3>
                  <p className="luxury-badge mb-3 inline-flex">Optional</p>
                  <p className="luxury-text-small mb-3">
                    Help us understand usage patterns:
                  </p>
                  <ul className="space-y-2">
                    <li className="luxury-text-small flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>Google Analytics 4 (GA4)</span>
                    </li>
                    <li className="luxury-text-small flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>Firebase Analytics</span>
                    </li>
                    <li className="luxury-text-small flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>Microsoft Clarity</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Marketing Cookies */}
            <div className="luxury-glass-minimal luxury-hover-lift p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-700 flex items-center justify-center luxury-shadow-sm">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="luxury-heading-sm mb-2">Marketing Cookies</h3>
                  <p className="luxury-badge mb-3 inline-flex">Optional</p>
                  <p className="luxury-text-small mb-3">
                    Used for targeted advertising:
                  </p>
                  <ul className="space-y-2">
                    <li className="luxury-text-small flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>Facebook Pixel</span>
                    </li>
                    <li className="luxury-text-small flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>TikTok Pixel</span>
                    </li>
                    <li className="luxury-text-small flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>Google Ads</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Storage Cookies */}
            <div className="luxury-glass-minimal luxury-hover-lift p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center luxury-shadow-sm">
                  <Database className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="luxury-heading-sm mb-2">Local & Session Storage</h3>
                  <p className="luxury-badge mb-3 inline-flex">Required</p>
                  <p className="luxury-text-small mb-3">
                    Browser storage for enhanced functionality:
                  </p>
                  <ul className="space-y-2">
                    <li className="luxury-text-small flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>User preferences (theme, language)</span>
                    </li>
                    <li className="luxury-text-small flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>Cached data for performance</span>
                    </li>
                    <li className="luxury-text-small flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>Temporary session data</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Divider */}
        <div className="luxury-divider"></div>

        {/* Third-Party Services Section */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-3">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center luxury-shadow-md">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="luxury-heading-md mb-4">Third-Party Services</h2>
              <p className="luxury-text-body mb-6">
                We use the following third-party services that may set cookies:
              </p>
              
              <div className="grid gap-4">
                {/* Firebase */}
                <div className="luxury-glass-minimal p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Firebase</h4>
                      <p className="luxury-text-small">Authentication and analytics</p>
                    </div>
                    <span className="luxury-badge luxury-badge-success">Active</span>
                  </div>
                </div>

                {/* Google Analytics */}
                <div className="luxury-glass-minimal p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Google Analytics</h4>
                      <p className="luxury-text-small">Usage analytics and insights</p>
                    </div>
                    <span className="luxury-badge">Optional</span>
                  </div>
                </div>

                {/* Nayax */}
                <div className="luxury-glass-minimal p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Nayax</h4>
                      <p className="luxury-text-small">Payment processing</p>
                    </div>
                    <span className="luxury-badge luxury-badge-success">Active</span>
                  </div>
                </div>

                {/* Google Maps */}
                <div className="luxury-glass-minimal p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Google Maps</h4>
                      <p className="luxury-text-small">Location services and mapping</p>
                    </div>
                    <span className="luxury-badge luxury-badge-success">Active</span>
                  </div>
                </div>

                {/* SendGrid */}
                <div className="luxury-glass-minimal p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">SendGrid</h4>
                      <p className="luxury-text-small">Email delivery service</p>
                    </div>
                    <span className="luxury-badge luxury-badge-success">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Divider */}
        <div className="luxury-divider"></div>

        {/* Cookie Management Panel */}
        <div className="luxury-glass-card luxury-shadow-lg p-8 mb-8 luxury-animate-slide-up luxury-delay-4">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center luxury-shadow-md">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="luxury-heading-md mb-4">Managing Cookie Preferences</h2>
              <p className="luxury-text-body mb-6">
                You have full control over your cookie preferences. Here's how you can manage them:
              </p>
              
              <ul className="space-y-3 mb-6">
                <li className="luxury-text-body flex items-start gap-3">
                  <span className="text-purple-600 mt-1.5">•</span>
                  <span>Use our consent manager (appears on first visit)</span>
                </li>
                <li className="luxury-text-body flex items-start gap-3">
                  <span className="text-purple-600 mt-1.5">•</span>
                  <span>Adjust browser settings to block cookies</span>
                </li>
                <li className="luxury-text-body flex items-start gap-3">
                  <span className="text-purple-600 mt-1.5">•</span>
                  <span>Opt-out of analytics tracking</span>
                </li>
                <li className="luxury-text-body flex items-start gap-3">
                  <span className="text-purple-600 mt-1.5">•</span>
                  <span>Disable marketing cookies individually</span>
                </li>
              </ul>

              <div className="flex flex-wrap gap-4">
                <button className="luxury-btn-primary">
                  Update Cookie Preferences
                </button>
                <button className="luxury-btn-secondary">
                  Block All Optional Cookies
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Divider */}
        <div className="luxury-divider"></div>

        {/* Additional Sections */}
        <div className="space-y-8">
          {/* Do Not Track */}
          <div className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center luxury-shadow-md">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="luxury-heading-md mb-4">Do Not Track</h2>
                <p className="luxury-text-body">
                  We respect browser "Do Not Track" signals for optional tracking only.
                  Essential cookies remain active for functionality.
                </p>
              </div>
            </div>
          </div>

          {/* Cookie Duration */}
          <div className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center luxury-shadow-md">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="luxury-heading-md mb-4">Cookie Duration</h2>
                <ul className="space-y-3">
                  <li className="luxury-text-body flex items-start gap-3">
                    <span className="text-purple-600 mt-1.5">•</span>
                    <span><strong>Session cookies:</strong> Deleted when you close your browser</span>
                  </li>
                  <li className="luxury-text-body flex items-start gap-3">
                    <span className="text-purple-600 mt-1.5">•</span>
                    <span><strong>Persistent cookies:</strong> Stored for 1-24 months depending on type</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-7">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center luxury-shadow-md">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="luxury-heading-md mb-4">Contact Us</h2>
                <p className="luxury-text-body">
                  Questions about cookies? Reach out to us at{" "}
                  <a 
                    href="mailto:privacy@petwash.co.il" 
                    className="text-purple-600 hover:text-purple-700 font-semibold underline decoration-2 decoration-purple-300 hover:decoration-purple-500 transition-colors"
                  >
                    privacy@petwash.co.il
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
