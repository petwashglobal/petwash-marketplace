import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, MessageCircle, Phone, Mail, FileQuestion, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Support() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <HelpCircle className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-5xl font-bold mb-4">Help Center & FAQ</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Get help with your Pet Wash™ account and services
          </p>
        </div>

        {/* Search */}
        <Card className="p-6 mb-12">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="Search for help articles, guides, and FAQs..."
              data-testid="input-search-help"
            />
          </div>
        </Card>

        {/* Contact Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = "/live-chat"}>
            <MessageCircle className="w-12 h-12 text-purple-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Live Chat</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Chat with our AI assistant Kenzo
            </p>
            <Button variant="outline" className="w-full" data-testid="button-live-chat">
              Start Chat
            </Button>
          </Card>

          <Card className="p-6 text-center">
            <Phone className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">WhatsApp</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Message us on WhatsApp
            </p>
            <Button variant="outline" className="w-full" data-testid="button-whatsapp">
              Open WhatsApp
            </Button>
          </Card>

          <Card className="p-6 text-center">
            <Mail className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Email Support</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Send us a detailed message
            </p>
            <Button variant="outline" className="w-full" data-testid="button-email" onClick={() => window.location.href = "/contact"}>
              Contact Us
            </Button>
          </Card>

          <Card className="p-6 text-center">
            <FileQuestion className="w-12 h-12 text-orange-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">FAQ</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Common questions answered
            </p>
            <Button variant="outline" className="w-full" data-testid="button-faq">
              View FAQ
            </Button>
          </Card>
        </div>

        {/* Popular Topics */}
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-6">Popular Topics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "How do I use a K9000 station?",
              "Loyalty program and rewards",
              "Booking and cancellations",
              "Account and billing",
              "Safety and insurance",
              "Technical issues",
            ].map((topic) => (
              <button
                key={topic}
                className="text-left p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <p className="text-gray-700 dark:text-gray-300">{topic}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
