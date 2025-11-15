import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, Zap, Users, Sparkles } from 'lucide-react';
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
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3 flex items-center justify-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-600" />
              AI Chat Assistant
            </h1>
            <p className="text-gray-600 text-lg">
              Powered by Google Dialogflow CX & Gemini 2.5 Flash AI - Hebrew & English Support
            </p>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 p-8 border-2 border-purple-200 mb-8 text-center">
            <p className="text-lg text-gray-700 mb-4">
              Click the purple chat bubble in the bottom-right corner to start chatting! 💬
            </p>
            <p className="text-sm text-gray-600">
              Our AI assistant is available on every page of Pet Wash™
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-blue-900">Gemini AI Powered</h3>
              </div>
              <p className="text-gray-700 text-sm">
                Leveraging Google's latest Gemini 2.5 Flash AI for instant, intelligent responses
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-purple-900">Bilingual Support</h3>
              </div>
              <p className="text-gray-700 text-sm">
                Seamlessly chat in Hebrew (עברית) or English with automatic language detection
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border-2 border-orange-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-orange-900">Always Available</h3>
              </div>
              <p className="text-gray-700 text-sm">
                24/7 AI assistance on every page - booking, pricing, pet care tips, and more
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
