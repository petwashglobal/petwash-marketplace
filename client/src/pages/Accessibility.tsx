import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Accessibility() {
  return (
    <Layout>
      <div className="min-h-screen bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Accessibility Declaration</CardTitle>
              <p className="text-gray-600">Pet Wash Ltd - Company Number: 517145033</p>
            </CardHeader>
            <CardContent className="prose max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Our Commitment to Accessibility</h2>
                <p className="mb-4">
                  Pet Wash™️ is committed to ensuring digital accessibility for people with disabilities. 
                  We are continually improving the user experience for everyone and applying the relevant 
                  accessibility standards to ensure we provide equal access to all of our users.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Conformance Status</h2>
                <p className="mb-4">
                  This website is designed to be compliant with the 2025 Israeli accessibility standards, 
                  which align with international Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Accessibility Features</h2>
                <p className="mb-4">Our website includes the following accessibility features:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Screen reader compatibility with proper ARIA labels</li>
                  <li>Full keyboard navigation support</li>
                  <li>High contrast text and color combinations</li>
                  <li>Adjustable font sizes without layout breakage</li>
                  <li>Alternative text for all meaningful images</li>
                  <li>Logical heading structure and content flow</li>
                  <li>Skip-to-content functionality</li>
                  <li>Large, easy-to-interact touch targets for mobile users</li>
                  <li>Bilingual support (Hebrew RTL and English LTR)</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Physical Location Accessibility</h2>
                <p className="mb-4">Our physical pet washing locations feature:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Wheelchair accessible entrances and facilities</li>
                  <li>Accessible parking spaces</li>
                  <li>Clear signage and wayfinding</li>
                  <li>Adjustable washing station heights</li>
                  <li>Easy-to-use interface controls</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Ongoing Efforts</h2>
                <p className="mb-4">
                  We continuously monitor and improve our accessibility through:
                </p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Regular accessibility audits and testing</li>
                  <li>User feedback incorporation</li>
                  <li>Staff training on accessibility best practices</li>
                  <li>Technology updates to support assistive devices</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Feedback and Contact</h2>
                <p className="mb-4">
                  We welcome your feedback on the accessibility of Pet Wash™️. 
                  Please let us know if you encounter accessibility barriers:
                </p>
                <ul className="list-none mb-4">
                  <li><strong>Email:</strong> accessibility@petwash.co.il</li>
                  <li><strong>Phone:</strong> Available through our WhatsApp support</li>
                  <li><strong>Mail:</strong> Pet Wash Ltd, Accessibility Department</li>
                </ul>
                <p className="mb-4">
                  We try to respond to accessibility feedback within 5 business days.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Technical Specifications</h2>
                <p className="mb-4">
                  Accessibility of Pet Wash™️ relies on the following technologies to work 
                  with the particular combination of web browser and any assistive technologies 
                  or plugins installed on your computer:
                </p>
                <ul className="list-disc pl-6 mb-4">
                  <li>HTML</li>
                  <li>WAI-ARIA</li>
                  <li>CSS</li>
                  <li>JavaScript</li>
                </ul>
                <p className="mb-4">
                  These technologies are relied upon for conformance with the accessibility 
                  standards used.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Limitations and Alternatives</h2>
                <p className="mb-4">
                  Despite our best efforts to ensure accessibility, there may be some limitations. 
                  If you encounter any issues, please contact us for assistance or alternative access methods.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Assessment Approach</h2>
                <p className="mb-4">
                  Pet Wash Ltd assessed the accessibility of this website through:
                </p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Self-evaluation using automated and manual testing tools</li>
                  <li>Expert accessibility consultation</li>
                  <li>User testing with assistive technologies</li>
                </ul>
              </section>

              <section className="mb-8">
                <p className="text-sm text-gray-600">
                  This accessibility declaration was last reviewed and updated in December 2024.
                </p>
              </section>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
