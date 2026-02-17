import { Layout } from '@/components/Layout';
import { Eye, Shield, Users, Monitor, MapPin, TrendingUp, Mail, Phone, FileText, CheckCircle2, Accessibility as AccessibilityIcon } from 'lucide-react';

export default function Accessibility() {
  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh py-16">
        <div className="luxury-container max-w-5xl">
          {/* Header */}
          <div className="text-center mb-12 luxury-animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-6 luxury-shadow-lg">
              <AccessibilityIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="luxury-heading-xl mb-4">Accessibility Declaration</h1>
            <p className="luxury-text-body mb-4">⁦Pet Wash™⁩ Ltd - Company Number: 517145033</p>
            <span className="luxury-badge luxury-badge-gold">
              <CheckCircle2 className="w-4 h-4" />
              Last Updated: December 2024
            </span>
          </div>

          {/* Conformance Status - Highlighted */}
          <div className="luxury-glass-panel border-l-4 border-green-500 p-8 mb-8 luxury-animate-slide-up luxury-delay-1">
            <div className="flex items-start gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex-shrink-0">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="luxury-heading-md mb-3">Conformance Status</h2>
                <p className="luxury-text-body mb-4">
                  This website is designed to be compliant with the 2025 Israeli accessibility standards, 
                  which align with international Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.
                </p>
                <div className="flex gap-2">
                  <span className="luxury-badge luxury-badge-success">WCAG 2.1 Level AA</span>
                  <span className="luxury-badge luxury-badge-success">Israeli Standard 5568</span>
                </div>
              </div>
            </div>
          </div>

          <div className="luxury-divider"></div>

          {/* Our Commitment */}
          <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-2">
            <div className="flex items-start gap-4 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <h2 className="luxury-heading-md">Our Commitment to Accessibility</h2>
            </div>
            <p className="luxury-text-body">
              ⁦Pet Wash™⁩ is committed to ensuring digital accessibility for people with disabilities. 
              We are continually improving the user experience for everyone and applying the relevant 
              accessibility standards to ensure we provide equal access to all of our users.
            </p>
          </div>

          {/* Accessibility Features Grid */}
          <div className="mb-8 luxury-animate-slide-up luxury-delay-3">
            <h2 className="luxury-heading-md mb-6 text-center">Accessibility Features</h2>
            <p className="luxury-text-body text-center mb-8">Our website includes the following accessibility features:</p>
            
            <div className="luxury-grid-3">
              <div className="luxury-glass-minimal luxury-hover-lift p-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-4">
                  <Monitor className="w-5 h-5 text-white" />
                </div>
                <h3 className="luxury-heading-sm mb-2">Screen Reader Compatible</h3>
                <p className="luxury-text-small">Full compatibility with proper ARIA labels and semantic HTML</p>
              </div>

              <div className="luxury-glass-minimal luxury-hover-lift p-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-4">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <h3 className="luxury-heading-sm mb-2">Keyboard Navigation</h3>
                <p className="luxury-text-small">Full keyboard navigation support for all interactive elements</p>
              </div>

              <div className="luxury-glass-minimal luxury-hover-lift p-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-4">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <h3 className="luxury-heading-sm mb-2">High Contrast</h3>
                <p className="luxury-text-small">High contrast text and color combinations for better readability</p>
              </div>

              <div className="luxury-glass-minimal luxury-hover-lift p-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-4">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h3 className="luxury-heading-sm mb-2">Adjustable Text</h3>
                <p className="luxury-text-small">Font sizes adjust without layout breakage</p>
              </div>

              <div className="luxury-glass-minimal luxury-hover-lift p-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-4">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h3 className="luxury-heading-sm mb-2">Alt Text</h3>
                <p className="luxury-text-small">Alternative text for all meaningful images</p>
              </div>

              <div className="luxury-glass-minimal luxury-hover-lift p-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="luxury-heading-sm mb-2">Logical Structure</h3>
                <p className="luxury-text-small">Clear heading hierarchy and content flow</p>
              </div>

              <div className="luxury-glass-minimal luxury-hover-lift p-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-4">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h3 className="luxury-heading-sm mb-2">Skip Navigation</h3>
                <p className="luxury-text-small">Skip-to-content functionality for faster access</p>
              </div>

              <div className="luxury-glass-minimal luxury-hover-lift p-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-4">
                  <Monitor className="w-5 h-5 text-white" />
                </div>
                <h3 className="luxury-heading-sm mb-2">Touch Targets</h3>
                <p className="luxury-text-small">Large, easy-to-interact touch targets for mobile users</p>
              </div>

              <div className="luxury-glass-minimal luxury-hover-lift p-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-4">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h3 className="luxury-heading-sm mb-2">Multilingual</h3>
                <p className="luxury-text-small">Bilingual support with Hebrew RTL and English LTR</p>
              </div>
            </div>
          </div>

          <div className="luxury-divider"></div>

          {/* Physical Location Accessibility */}
          <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-4">
            <div className="flex items-start gap-4 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <h2 className="luxury-heading-md">Physical Location Accessibility</h2>
            </div>
            <p className="luxury-text-body mb-4">Our physical pet washing locations feature:</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mt-2 flex-shrink-0"></span>
                Wheelchair accessible entrances and facilities
              </li>
              <li className="flex items-start gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mt-2 flex-shrink-0"></span>
                Accessible parking spaces
              </li>
              <li className="flex items-start gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mt-2 flex-shrink-0"></span>
                Clear signage and wayfinding
              </li>
              <li className="flex items-start gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mt-2 flex-shrink-0"></span>
                Adjustable washing station heights
              </li>
              <li className="flex items-start gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mt-2 flex-shrink-0"></span>
                Easy-to-use interface controls
              </li>
            </ul>
          </div>

          {/* Ongoing Efforts */}
          <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-5">
            <div className="flex items-start gap-4 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h2 className="luxury-heading-md">Ongoing Efforts</h2>
            </div>
            <p className="luxury-text-body mb-4">
              We continuously monitor and improve our accessibility through:
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mt-2 flex-shrink-0"></span>
                Regular accessibility audits and testing
              </li>
              <li className="flex items-start gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mt-2 flex-shrink-0"></span>
                User feedback incorporation
              </li>
              <li className="flex items-start gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mt-2 flex-shrink-0"></span>
                Staff training on accessibility best practices
              </li>
              <li className="flex items-start gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mt-2 flex-shrink-0"></span>
                Technology updates to support assistive devices
              </li>
            </ul>
          </div>

          <div className="luxury-divider"></div>

          {/* Contact/Feedback */}
          <div className="luxury-glass-card luxury-shadow-lg p-8 mb-8 luxury-animate-slide-up">
            <div className="flex items-start gap-4 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <h2 className="luxury-heading-md">Feedback and Contact</h2>
            </div>
            <p className="luxury-text-body mb-6">
              We welcome your feedback on the accessibility of ⁦Pet Wash™⁩. 
              Please let us know if you encounter accessibility barriers:
            </p>
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-purple-600" />
                <span className="luxury-text-body">Email:</span>
                <a href="mailto:accessibility@petwash.co.il" className="luxury-text-gradient font-semibold hover:opacity-80 transition-opacity">
                  accessibility@petwash.co.il
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-purple-600" />
                <span className="luxury-text-body">Phone:</span>
                <span className="luxury-text-gradient font-semibold">
                  Available through our WhatsApp support
                </span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-purple-600" />
                <span className="luxury-text-body">Mail:</span>
                <span className="luxury-text-body font-semibold">
                  ⁦Pet Wash™⁩ Ltd, Accessibility Department
                </span>
              </div>
            </div>
            <p className="luxury-text-small">
              We try to respond to accessibility feedback within 5 business days.
            </p>
          </div>

          {/* Technical Specifications */}
          <div className="luxury-glass-card luxury-shadow-md p-8 mb-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0">
                <Monitor className="w-6 h-6 text-white" />
              </div>
              <h2 className="luxury-heading-md">Technical Specifications</h2>
            </div>
            <p className="luxury-text-body mb-4">
              Accessibility of ⁦Pet Wash™⁩ relies on the following technologies to work 
              with the particular combination of web browser and any assistive technologies 
              or plugins installed on your computer:
            </p>
            <ul className="space-y-2 mb-4">
              <li className="flex items-center gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0"></span>
                HTML
              </li>
              <li className="flex items-center gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0"></span>
                WAI-ARIA
              </li>
              <li className="flex items-center gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0"></span>
                CSS
              </li>
              <li className="flex items-center gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0"></span>
                JavaScript
              </li>
            </ul>
            <p className="luxury-text-body">
              These technologies are relied upon for conformance with the accessibility 
              standards used.
            </p>
          </div>

          {/* Limitations and Alternatives */}
          <div className="luxury-glass-card luxury-shadow-md p-8 mb-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h2 className="luxury-heading-md">Limitations and Alternatives</h2>
            </div>
            <p className="luxury-text-body">
              Despite our best efforts to ensure accessibility, there may be some limitations. 
              If you encounter any issues, please contact us for assistance or alternative access methods.
            </p>
          </div>

          {/* Assessment Approach */}
          <div className="luxury-glass-card luxury-shadow-md p-8 mb-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h2 className="luxury-heading-md">Assessment Approach</h2>
            </div>
            <p className="luxury-text-body mb-4">
              ⁦Pet Wash™⁩ Ltd assessed the accessibility of this website through:
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mt-2 flex-shrink-0"></span>
                Self-evaluation using automated and manual testing tools
              </li>
              <li className="flex items-start gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mt-2 flex-shrink-0"></span>
                Expert accessibility consultation
              </li>
              <li className="flex items-start gap-3 luxury-text-body">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mt-2 flex-shrink-0"></span>
                User testing with assistive technologies
              </li>
            </ul>
          </div>

          {/* Footer note */}
          <div className="text-center luxury-text-small opacity-70">
            This accessibility declaration was last reviewed and updated in December 2024.
          </div>
        </div>
      </div>
    </Layout>
  );
}
