import { Heart, Lightbulb, Globe, Users } from "lucide-react";

export default function Story() {
  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-20 luxury-fade-in">
          <div className="inline-block p-4 rounded-full luxury-glass-minimal mb-6 luxury-scale-in">
            <Heart className="w-16 h-16 luxury-gradient-icon" />
          </div>
          <h1 className="luxury-heading-xl mb-6">Our Story & Mission</h1>
          <p className="luxury-subtitle-lg">
            Revolutionizing pet care through innovation, technology, and love
          </p>
        </div>

        <div className="space-y-8 luxury-stagger-fade-in">
          <div className="luxury-glass-card luxury-shadow-lg p-10 luxury-slide-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center luxury-pulse-glow">
                <Lightbulb className="w-6 h-6 text-white" />
              </div>
              <span className="luxury-gradient-text">The Vision</span>
            </h2>
            <p className="luxury-text-body leading-relaxed text-lg">
              ⁦Pet Wash™⁩ was born from a simple idea: every pet deserves access to premium care,
              and every pet owner deserves convenience. We've built the world's first integrated
              pet care ecosystem, connecting 8 different platforms under one unified experience.
            </p>
          </div>

          <div className="luxury-glass-card luxury-shadow-lg p-10 luxury-slide-up" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center luxury-pulse-glow">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <span className="luxury-gradient-text">Global Expansion</span>
            </h2>
            <p className="luxury-text-body leading-relaxed text-lg">
              From our roots in Israel and Australia, we're expanding to create a global network
              of premium pet care services. Our Octopus model connects stations, sitters, walkers,
              transport, training, and more - all accessible through one account.
            </p>
          </div>

          <div className="luxury-glass-card luxury-shadow-lg p-10 luxury-slide-up" style={{ animationDelay: '0.3s' }}>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center luxury-pulse-glow">
                <Users className="w-6 h-6 text-white" />
              </div>
              <span className="luxury-gradient-text">Our Community</span>
            </h2>
            <p className="luxury-text-body leading-relaxed text-lg">
              We're building more than a business - we're creating a community of pet lovers,
              dedicated professionals, and innovative partners. Our 7-star loyalty program and
              VIP Club ensure that every member feels valued and supported.
            </p>
          </div>

          <div className="luxury-glass-card luxury-shadow-xl p-12 text-center luxury-bg-primary luxury-slide-up" style={{ animationDelay: '0.4s' }}>
            <h2 className="text-3xl font-bold mb-4 text-white">Join Our Journey</h2>
            <p className="text-white/90 text-lg leading-relaxed">
              Be part of the pet care revolution. Together, we're making the world a better place for pets and their families.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
