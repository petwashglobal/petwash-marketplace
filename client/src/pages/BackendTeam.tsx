import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Code2, Rocket, Users, Zap } from "lucide-react";
import { useLocation } from "wouter";

export default function BackendTeam() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-blue-50">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-block mb-6">
            <div className="text-6xl mb-4">🚀</div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mb-4">
            Welcome to the Backend Team!
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Join the engineering team building the future of premium pet care technology
          </p>
        </div>

        {/* Success Message */}
        <Card className="max-w-4xl mx-auto mb-12 border-green-200 bg-green-50/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div>
                <CardTitle className="text-2xl text-green-900">Invitation Received!</CardTitle>
                <CardDescription className="text-green-700">
                  You've successfully accessed your backend team invitation
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-green-800 leading-relaxed">
              Thank you for considering joining the Pet Wash™ backend engineering team. 
              We're excited to have you explore this opportunity. Please review the details below 
              and reach out to Nir Hadad at <strong>Nir.H@PetWash.co.il</strong> to proceed.
            </p>
          </CardContent>
        </Card>

        {/* Tech Stack */}
        <Card className="max-w-4xl mx-auto mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="w-6 h-6 text-violet-600" />
              Our Technology Stack
            </CardTitle>
            <CardDescription>
              Cutting-edge technologies you'll work with
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                "TypeScript", "React 18", "Node.js", "Express",
                "Firebase", "PostgreSQL", "Drizzle ORM", "TanStack Query",
                "Vite", "Tailwind CSS", "WebSockets", "AI/ML"
              ].map((tech) => (
                <div key={tech} className="flex items-center gap-2 p-3 bg-violet-50 rounded-lg">
                  <Zap className="w-4 h-4 text-violet-600" />
                  <span className="font-medium text-sm">{tech}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* What You'll Build */}
        <Card className="max-w-4xl mx-auto mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="w-6 h-6 text-blue-600" />
              What You'll Build
            </CardTitle>
            <CardDescription>
              Real impact on pet care worldwide
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                "AI-powered personalization engine for millions of pet owners",
                "IoT integration for smart washing stations across Israel",
                "Real-time analytics and monitoring dashboards",
                "Banking-level security and payment systems",
                "Global franchise management platform",
                "Mobile PWA for field technicians",
                "Automated compliance and reporting systems"
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Team Culture */}
        <Card className="max-w-4xl mx-auto mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-600" />
              Our Culture
            </CardTitle>
            <CardDescription>
              What makes Pet Wash™ special
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-lg mb-2 text-purple-900">Innovation First</h3>
                <p className="text-gray-600">
                  We embrace new technologies and encourage creative problem-solving. 
                  Your ideas shape our platform.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-purple-900">Fast Growth</h3>
                <p className="text-gray-600">
                  Expanding to international markets in 2026. Be part of global scaling 
                  from day one.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-purple-900">Mission-Driven</h3>
                <p className="text-gray-600">
                  Every line of code improves the lives of pets and their owners. 
                  Real impact, real purpose.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-purple-900">Collaborative</h3>
                <p className="text-gray-600">
                  Small, tight-knit team where everyone's voice matters. Direct impact 
                  on product direction.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center">
          <div className="inline-block p-8 bg-white rounded-2xl shadow-xl border border-purple-100">
            <h2 className="text-2xl font-bold mb-4">Ready to Join?</h2>
            <p className="text-gray-600 mb-6 max-w-md">
              Reach out to discuss next steps, ask questions, or schedule a call
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                onClick={() => window.location.href = 'mailto:Nir.H@PetWash.co.il?subject=Backend Team - Ready to Join'}
              >
                📧 Email Nir Hadad
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => setLocation('/')}
              >
                🏠 Go to Homepage
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
