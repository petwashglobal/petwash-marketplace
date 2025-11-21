import { useLocation } from "wouter";
import { Briefcase, Users, Heart, TrendingUp } from "lucide-react";

export default function Careers() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-20 luxury-fade-in">
          <div className="inline-block p-4 rounded-full luxury-glass-minimal mb-6 luxury-scale-in">
            <Briefcase className="w-16 h-16 luxury-gradient-icon" />
          </div>
          <h1 className="luxury-heading-xl mb-6">Careers at Pet Wash™</h1>
          <p className="luxury-subtitle-lg">
            Join a team that's revolutionizing pet care globally
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 luxury-stagger-fade-in">
          <div className="luxury-glass-card luxury-hover-glow p-8" style={{ animationDelay: '0.1s' }}>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center mb-6 luxury-pulse-glow">
              <Heart className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 luxury-gradient-text">Mission-Driven Work</h3>
            <p className="luxury-text-body text-lg">
              Make a real difference in the lives of pets and their families every single day
            </p>
          </div>

          <div className="luxury-glass-card luxury-hover-glow p-8" style={{ animationDelay: '0.2s' }}>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-6 luxury-pulse-glow">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 luxury-gradient-text">Growth Opportunities</h3>
            <p className="luxury-text-body text-lg">
              Expand your skills across 8 platforms in a rapidly growing global company
            </p>
          </div>

          <div className="luxury-glass-card luxury-hover-glow p-8" style={{ animationDelay: '0.3s' }}>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center mb-6 luxury-pulse-glow">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 luxury-gradient-text">Amazing Team</h3>
            <p className="luxury-text-body text-lg">
              Work with passionate, talented people who love pets as much as you do
            </p>
          </div>

          <div className="luxury-glass-card luxury-hover-glow p-8" style={{ animationDelay: '0.4s' }}>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center mb-6 luxury-pulse-glow">
              <Briefcase className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 luxury-gradient-text">Competitive Benefits</h3>
            <p className="luxury-text-body text-lg">
              Comprehensive benefits, competitive salary, and employee perks
            </p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-xl p-12 text-center luxury-bg-primary luxury-slide-up">
          <h2 className="text-3xl font-bold mb-4 text-white">Open Positions</h2>
          <p className="text-white/90 text-lg mb-8">
            Explore opportunities across technology, operations, franchise support, and more
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button className="luxury-btn-white luxury-shadow-xl" data-testid="button-view-jobs">
              View Open Positions
            </button>
            <button className="luxury-btn-white luxury-shadow-xl" data-testid="button-staff-application" onClick={() => setLocation("/staff/application")}>
              Staff Application
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
