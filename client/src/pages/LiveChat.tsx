import { ArrowLeft, MessageCircle, Zap, Sparkles } from 'lucide-react';
import { Link } from 'wouter';

export default function LiveChat() {
  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container max-w-6xl mx-auto p-6">
        <Link href="/">
          <button className="luxury-btn-outline mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </button>
        </Link>

        <div className="luxury-glass-card luxury-shadow-xl p-12 mb-8 luxury-fade-in">
          <div className="text-center mb-10">
            <h1 className="luxury-heading-xl mb-6 flex items-center justify-center gap-4">
              <Sparkles className="w-12 h-12 luxury-gradient-icon" />
              AI Chat Assistant
            </h1>
            <p className="luxury-subtitle-lg">
              Powered by Google Dialogflow CX & Gemini 2.5 Flash AI - Hebrew & English Support
            </p>
          </div>

          <div className="luxury-glass-card luxury-shadow-lg p-10 mb-8 text-center luxury-bg-primary">
            <p className="text-xl text-white/95 mb-4 font-semibold">
              Click the purple chat bubble in the bottom-right corner to start chatting! 💬
            </p>
            <p className="text-white/80 text-lg">
              Our AI assistant is available on every page of ⁦Pet Wash™⁩
            </p>
          </div>

          <div className="luxury-grid-3 luxury-stagger-fade-in">
            <div className="luxury-glass-card luxury-hover-glow p-8" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center luxury-pulse-glow">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold luxury-gradient-text">Gemini AI Powered</h3>
              </div>
              <p className="luxury-text-body">
                Leveraging Google's latest Gemini 2.5 Flash AI for instant, intelligent responses
              </p>
            </div>

            <div className="luxury-glass-card luxury-hover-glow p-8" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center luxury-pulse-glow">
                  <MessageCircle className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold luxury-gradient-text">Bilingual Support</h3>
              </div>
              <p className="luxury-text-body">
                Seamlessly chat in Hebrew (עברית) or English with automatic language detection
              </p>
            </div>

            <div className="luxury-glass-card luxury-hover-glow p-8" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center luxury-pulse-glow">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold luxury-gradient-text">Always Available</h3>
              </div>
              <p className="luxury-text-body">
                24/7 AI assistance on every page - booking, pricing, pet care tips, and more
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
