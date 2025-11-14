import { LiveChatWidget } from '@/components/LiveChatWidget';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, Zap, Users } from 'lucide-react';
import { Link } from 'wouter';

export default function LiveChat() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-100">
      <div className="container max-w-6xl mx-auto p-6">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-3">
              💬 Live Chat Support
            </h1>
            <p className="text-gray-600 text-lg">
              Real-time customer support powered by our expert team and AI assistance
            </p>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 p-8 border-2 border-green-200 mb-8">
            <LiveChatWidget />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-blue-900">Instant Response</h3>
              </div>
              <p className="text-gray-700 text-sm">
                Connect with our support team in real-time for immediate assistance
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-purple-900">AI + Human</h3>
              </div>
              <p className="text-gray-700 text-sm">
                Combined power of AI quick answers and expert human support
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border-2 border-orange-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-orange-900">24/7 Availability</h3>
              </div>
              <p className="text-gray-700 text-sm">
                Always here when you need us, day or night across all time zones
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
