import { Kenzo3DRealistic } from '@/components/Kenzo3DRealistic';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function KenzoAI() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-100">
      <div className="container max-w-6xl mx-auto p-6">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent mb-3">
              🦁 Kenzo AI Mascot
            </h1>
            <p className="text-gray-600 text-lg">
              Meet Kenzo, your intelligent 3D pet care companion powered by Google Gemini 2.5 Flash
            </p>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 p-8 border-2 border-blue-200">
            <Kenzo3DRealistic />
          </div>

          <div className="mt-8 grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
              <h3 className="font-bold text-lg mb-2 text-purple-900">🎨 3D Realistic Avatar</h3>
              <p className="text-gray-700 text-sm">
                High-quality 3D lion mascot with realistic animations and expressions
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
              <h3 className="font-bold text-lg mb-2 text-green-900">🤖 AI-Powered Chat</h3>
              <p className="text-gray-700 text-sm">
                Intelligent conversations powered by Google Gemini 2.5 Flash AI
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border-2 border-orange-200">
              <h3 className="font-bold text-lg mb-2 text-orange-900">🌍 Multilingual</h3>
              <p className="text-gray-700 text-sm">
                Communicates in Hebrew, Arabic, English, French, Spanish, and Russian
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
