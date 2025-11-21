import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { HelpCircle, MessageCircle, Phone, Mail, FileQuestion, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Support() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-services-hero">
        <div className="luxury-services-hero-content">
          <div className="luxury-services-badge luxury-animate-fade-in">
            <Sparkles className="h-4 w-4" />
            24/7 Premium Support
          </div>
          <h1 className="luxury-heading-xl luxury-animate-fade-in luxury-delay-1">
            Help Center & FAQ
          </h1>
          <p className="luxury-services-subtitle luxury-animate-fade-in luxury-delay-2">
            Get help with your Pet Wash™ account and services
          </p>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-12">
        {/* Search */}
        <div className="luxury-glass-card luxury-shadow-xl p-6 mb-12 luxury-animate-fade-in luxury-delay-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#667eea' }} />
            <Input
              className="pl-12 py-6 text-lg bg-transparent border-none focus-visible:ring-2 focus-visible:ring-purple-500"
              placeholder="Search for help articles, guides, and FAQs..."
              data-testid="input-search-help"
            />
          </div>
        </div>

        {/* Contact Options */}
        <div className="luxury-grid-4 mb-12">
          <div 
            className="luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center cursor-pointer luxury-animate-fade-in luxury-delay-4" 
            onClick={() => setLocation("/live-chat")}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">Live Chat</h3>
            <p className="luxury-text-small mb-4">
              Chat with our AI assistant Kenzo
            </p>
            <button className="luxury-btn-secondary w-full" data-testid="button-live-chat">
              Start Chat
            </button>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center luxury-animate-fade-in luxury-delay-5">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
              <Phone className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">WhatsApp</h3>
            <p className="luxury-text-small mb-4">
              Message us on WhatsApp
            </p>
            <button className="luxury-btn-secondary w-full" data-testid="button-whatsapp">
              Open WhatsApp
            </button>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center luxury-animate-fade-in luxury-delay-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">Email Support</h3>
            <p className="luxury-text-small mb-4">
              Send us a detailed message
            </p>
            <button className="luxury-btn-secondary w-full" data-testid="button-email" onClick={() => setLocation("/contact")}>
              Contact Us
            </button>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center luxury-animate-fade-in luxury-delay-7">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <FileQuestion className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2">FAQ</h3>
            <p className="luxury-text-small mb-4">
              Common questions answered
            </p>
            <button className="luxury-btn-secondary w-full" data-testid="button-faq">
              View FAQ
            </button>
          </div>
        </div>

        {/* Popular Topics */}
        <div className="luxury-glass-card luxury-shadow-xl p-8 luxury-animate-fade-in luxury-delay-8">
          <h2 className="luxury-heading-lg mb-6">Popular Topics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "How do I use a K9000 station?",
              "Loyalty program and rewards",
              "Booking and cancellations",
              "Account and billing",
              "Safety and insurance",
              "Technical issues",
            ].map((topic, index) => (
              <button
                key={topic}
                className={`luxury-glass-panel luxury-shadow-sm text-left p-4 rounded-lg transition-all hover:shadow-md luxury-animate-fade-in luxury-delay-${index + 9}`}
              >
                <p className="luxury-text-body">{topic}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
