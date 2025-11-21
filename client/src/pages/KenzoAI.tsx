import { Kenzo3DRealistic } from '@/components/Kenzo3DRealistic';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function KenzoAI() {
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
            <h1 className="luxury-heading-xl mb-6">
              🦁 Kenzo AI Mascot
            </h1>
            <p className="luxury-subtitle-lg">
              Meet Kenzo, your intelligent 3D pet care companion powered by Google Gemini 2.5 Flash
            </p>
          </div>

          <div className="rounded-2xl luxury-glass-minimal p-10 mb-8 luxury-scale-in">
            <Kenzo3DRealistic />
          </div>

          <div className="luxury-grid-3 luxury-stagger-fade-in">
            <div className="luxury-glass-card luxury-hover-glow p-8" style={{ animationDelay: '0.1s' }}>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6 luxury-pulse-glow">
                <span className="text-3xl">🎨</span>
              </div>
              <h3 className="text-xl font-bold mb-3 luxury-gradient-text">3D Realistic Avatar</h3>
              <p className="luxury-text-body">
                High-quality 3D lion mascot with realistic animations and expressions
              </p>
            </div>

            <div className="luxury-glass-card luxury-hover-glow p-8" style={{ animationDelay: '0.2s' }}>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-6 luxury-pulse-glow">
                <span className="text-3xl">🤖</span>
              </div>
              <h3 className="text-xl font-bold mb-3 luxury-gradient-text">AI-Powered Chat</h3>
              <p className="luxury-text-body">
                Intelligent conversations powered by Google Gemini 2.5 Flash AI
              </p>
            </div>

            <div className="luxury-glass-card luxury-hover-glow p-8" style={{ animationDelay: '0.3s' }}>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-6 luxury-pulse-glow">
                <span className="text-3xl">🌍</span>
              </div>
              <h3 className="text-xl font-bold mb-3 luxury-gradient-text">Multilingual</h3>
              <p className="luxury-text-body">
                Communicates in Hebrew, Arabic, English, French, Spanish, and Russian
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
