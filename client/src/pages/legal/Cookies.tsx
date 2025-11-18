import { Card } from "@/components/ui/card";
import { Cookie } from "lucide-react";

export default function CookiesPolicy() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <Cookie className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-4">Cookies & Tracking</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <Card className="p-8">
          <div className="prose dark:prose-invert max-w-none">
            <h2>1. What Are Cookies?</h2>
            <p>
              Cookies are small text files stored on your device when you visit our website.
              They help us provide a better experience and understand how you use our services.
            </p>

            <h2>2. Types of Cookies We Use</h2>
            
            <h3>Essential Cookies (Required)</h3>
            <p>
              These cookies are necessary for the website to function:
            </p>
            <ul>
              <li>Authentication and session management</li>
              <li>Security and fraud prevention</li>
              <li>Language and regional preferences</li>
              <li>Shopping cart and booking state</li>
            </ul>

            <h3>Analytics Cookies (Optional)</h3>
            <p>
              Help us understand usage patterns:
            </p>
            <ul>
              <li>Google Analytics 4 (GA4)</li>
              <li>Firebase Analytics</li>
              <li>Microsoft Clarity</li>
            </ul>

            <h3>Marketing Cookies (Optional)</h3>
            <p>
              Used for targeted advertising:
            </p>
            <ul>
              <li>Facebook Pixel</li>
              <li>TikTok Pixel</li>
              <li>Google Ads</li>
            </ul>

            <h2>3. Third-Party Services</h2>
            <p>
              We use the following third-party services that may set cookies:
            </p>
            <ul>
              <li><strong>Firebase</strong>: Authentication and analytics</li>
              <li><strong>Google Analytics</strong>: Usage analytics</li>
              <li><strong>Nayax</strong>: Payment processing</li>
              <li><strong>Google Maps</strong>: Location services</li>
              <li><strong>SendGrid</strong>: Email delivery</li>
            </ul>

            <h2>4. Managing Cookie Preferences</h2>
            <p>
              You can manage your cookie preferences:
            </p>
            <ul>
              <li>Use our consent manager (appears on first visit)</li>
              <li>Adjust browser settings to block cookies</li>
              <li>Opt-out of analytics tracking</li>
              <li>Disable marketing cookies individually</li>
            </ul>

            <h2>5. Local Storage and Session Storage</h2>
            <p>
              We also use browser storage for:
            </p>
            <ul>
              <li>User preferences (theme, language)</li>
              <li>Cached data for performance</li>
              <li>Temporary session data</li>
            </ul>

            <h2>6. Do Not Track</h2>
            <p>
              We respect browser "Do Not Track" signals for optional tracking only.
              Essential cookies remain active for functionality.
            </p>

            <h2>7. Cookie Duration</h2>
            <ul>
              <li><strong>Session cookies</strong>: Deleted when you close your browser</li>
              <li><strong>Persistent cookies</strong>: Stored for 1-24 months depending on type</li>
            </ul>

            <h2>8. Contact</h2>
            <p>
              Questions about cookies: privacy@petwash.co.il
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
