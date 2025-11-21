import { Card } from "@/components/ui/card";
import { Accessibility } from "lucide-react";

export default function AccessibilityStatementPage() {
  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-block p-4 luxury-glass-minimal rounded-2xl mb-4">
            <Accessibility className="w-16 h-16 luxury-text-gradient" />
          </div>
          <h1 className="luxury-heading-xl luxury-text-gradient mb-4">Accessibility Statement</h1>
          <p className="text-gray-600">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <Card className="luxury-glass-card luxury-shadow-xl p-8">
          <div className="prose dark:prose-invert max-w-none">
            <h2>1. Our Commitment</h2>
            <p>
              Pet Wash™ is committed to ensuring digital accessibility for people with disabilities.
              We continually improve the user experience for everyone and apply relevant accessibility standards.
            </p>

            <h2>2. Conformance Status</h2>
            <p>
              Our website aims to conform with <strong>WCAG 2.1 Level AA</strong> standards.
            </p>

            <h2>3. Accessibility Features</h2>
            <ul>
              <li><strong>Keyboard Navigation</strong>: Full site navigation without mouse</li>
              <li><strong>Screen Reader Support</strong>: ARIA labels and semantic HTML</li>
              <li><strong>Color Contrast</strong>: WCAG AA compliant color ratios</li>
              <li><strong>Text Resizing</strong>: Content scales up to 200% without loss</li>
              <li><strong>Focus Indicators</strong>: Clear visual focus states</li>
              <li><strong>Alternative Text</strong>: Descriptive alt text for images</li>
              <li><strong>Captions & Transcripts</strong>: For video and audio content</li>
            </ul>

            <h2>4. Physical Accessibility - K9000 Stations</h2>
            <p>
              Our K9000 stations feature:
            </p>
            <ul>
              <li>Wheelchair-accessible design</li>
              <li>Adjustable height controls</li>
              <li>Large, tactile buttons</li>
              <li>Visual and audio feedback</li>
              <li>Emergency assistance buttons</li>
            </ul>

            <h2>5. Assistive Technologies Supported</h2>
            <ul>
              <li>JAWS (screen reader)</li>
              <li>NVDA (screen reader)</li>
              <li>VoiceOver (iOS/macOS)</li>
              <li>TalkBack (Android)</li>
              <li>Dragon NaturallySpeaking (voice control)</li>
            </ul>

            <h2>6. Known Limitations</h2>
            <p>
              We are aware of the following limitations and working on improvements:
            </p>
            <ul>
              <li>Some third-party embedded content may not be fully accessible</li>
              <li>Certain complex data visualizations may need enhancement</li>
              <li>Legacy PDF documents being converted to accessible formats</li>
            </ul>

            <h2>7. Accessibility Assistance</h2>
            <p>
              If you encounter accessibility barriers:
            </p>
            <ul>
              <li><strong>Email</strong>: accessibility@petwash.co.il</li>
              <li><strong>Phone</strong>: Available during business hours</li>
              <li><strong>WhatsApp</strong>: Text-based assistance</li>
            </ul>

            <h2>8. Feedback and Complaints</h2>
            <p>
              We welcome feedback on accessibility. Please report issues with specific details:
            </p>
            <ul>
              <li>Page URL</li>
              <li>Description of the issue</li>
              <li>Assistive technology used (if applicable)</li>
              <li>Browser and operating system</li>
            </ul>
            <p>
              We aim to respond within 3 business days.
            </p>

            <h2>9. Ongoing Efforts</h2>
            <p>
              Our accessibility initiatives include:
            </p>
            <ul>
              <li>Regular accessibility audits</li>
              <li>Employee training on accessibility</li>
              <li>User testing with people with disabilities</li>
              <li>Partnership with accessibility consultants</li>
            </ul>

            <h2>10. Legal Compliance</h2>
            <p>
              We comply with:
            </p>
            <ul>
              <li>Israeli Equal Rights for People with Disabilities Law 1998</li>
              <li>Web Accessibility Regulations 2013 (Israel)</li>
              <li>WCAG 2.1 Level AA international standards</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
