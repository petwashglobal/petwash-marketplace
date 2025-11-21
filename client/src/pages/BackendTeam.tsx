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
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16 luxury-animate-fade-in">
          <div className="inline-block mb-6">
            <div className="text-6xl mb-4">🚀</div>
          </div>
          <h1 className="luxury-heading-xl mb-4">
            Welcome to the Backend Team!
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            Join the engineering team building the future of premium pet care technology
          </p>
        </div>

        {/* Success Message */}
        <Card className="max-w-4xl mx-auto mb-12 luxury-glass-card luxury-hover-lift border-green-200 bg-green-50/50 luxury-animate-slide-up luxury-delay-1">
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
        <Card className="max-w-4xl mx-auto mb-8 luxury-glass-card luxury-hover-lift luxury-animate-slide-up luxury-delay-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 luxury-heading-md">
              <Code2 className="w-6 h-6 text-violet-600" />
              Our Technology Stack
            </CardTitle>
            <CardDescription className="luxury-text-small">
              Cutting-edge technologies you'll work with
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="luxury-grid-4 luxury-gap-md">
              {[
                "TypeScript", "React 18", "Node.js", "Express",
                "Firebase", "PostgreSQL", "Drizzle ORM", "TanStack Query",
                "Vite", "Tailwind CSS", "WebSockets", "AI/ML"
              ].map((tech, idx) => (
                <div key={tech} className={`flex items-center gap-2 p-3 luxury-glass-minimal luxury-hover-lift luxury-animate-scale-in luxury-delay-${Math.min(idx % 10, 10)}`}>
                  <Zap className="w-4 h-4 text-violet-600" />
                  <span className="font-medium text-sm">{tech}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* What You'll Build */}
        <Card className="max-w-4xl mx-auto mb-8 luxury-glass-card luxury-hover-lift luxury-animate-slide-up luxury-delay-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 luxury-heading-md">
              <Rocket className="w-6 h-6 text-blue-600" />
              What You'll Build
            </CardTitle>
            <CardDescription className="luxury-text-small">
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
                <li key={index} className={`flex items-start gap-3 luxury-animate-fade-in luxury-delay-${Math.min(index % 10, 10)}`}>
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="luxury-text-body">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Team Culture */}
        <Card className="max-w-4xl mx-auto mb-12 luxury-glass-card luxury-hover-lift luxury-animate-slide-up luxury-delay-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 luxury-heading-md">
              <Users className="w-6 h-6 text-purple-600" />
              Our Culture
            </CardTitle>
            <CardDescription className="luxury-text-small">
              What makes Pet Wash™ special
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="luxury-grid-2 luxury-gap-lg">
              <div className="luxury-animate-fade-in luxury-delay-1">
                <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">Innovation First</h3>
                <p className="luxury-text-body">
                  We embrace new technologies and encourage creative problem-solving. 
                  Your ideas shape our platform.
                </p>
              </div>
              <div className="luxury-animate-fade-in luxury-delay-2">
                <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">Fast Growth</h3>
                <p className="luxury-text-body">
                  Expanding to international markets in 2026. Be part of global scaling 
                  from day one.
                </p>
              </div>
              <div className="luxury-animate-fade-in luxury-delay-3">
                <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">Mission-Driven</h3>
                <p className="luxury-text-body">
                  Every line of code improves the lives of pets and their owners. 
                  Real impact, real purpose.
                </p>
              </div>
              <div className="luxury-animate-fade-in luxury-delay-4">
                <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">Collaborative</h3>
                <p className="luxury-text-body">
                  Small, tight-knit team where everyone's voice matters. Direct impact 
                  on product direction.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center luxury-animate-fade-in luxury-delay-5">
          <div className="inline-block p-8 luxury-glass-card luxury-hover-lift luxury-shadow-xl">
            <h2 className="luxury-heading-lg mb-4">Ready to Join?</h2>
            <p className="luxury-text-body mb-6 max-w-md">
              Reach out to discuss next steps, ask questions, or schedule a call
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                className="luxury-btn-primary"
                onClick={() => window.location.href = 'mailto:Nir.H@PetWash.co.il?subject=Backend Team - Ready to Join'}
              >
                📧 Email Nir Hadad
              </Button>
              <Button 
                size="lg"
                className="luxury-btn-secondary"
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
