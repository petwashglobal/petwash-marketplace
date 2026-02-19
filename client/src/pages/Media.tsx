import { useLocation } from "wouter";
import { Camera, Video, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Media() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-20 luxury-fade-in">
          <div className="inline-block p-4 rounded-full luxury-glass-minimal mb-6 luxury-scale-in">
            <Camera className="w-16 h-16 luxury-gradient-icon" />
          </div>
          <h1 className="luxury-heading-xl mb-6">Media, Photos and Videos</h1>
          <p className="luxury-subtitle-lg">
            Brand assets, press materials, and media resources
          </p>
        </div>

        <div className="luxury-grid-3 mb-16 luxury-stagger-fade-in">
          <div className="luxury-glass-minimal luxury-hover-lift p-8 cursor-pointer" onClick={() => setLocation("/gallery")} style={{ animationDelay: '0.1s' }}>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6 luxury-pulse-glow">
              <Camera className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 luxury-gradient-text">Photo Gallery</h3>
            <p className="luxury-text-body mb-6">
              High-resolution photos of our stations, services, and happy pets
            </p>
            <Button className="luxury-btn-outline w-full" data-testid="button-view-gallery">
              View Gallery
            </Button>
          </div>

          <div className="luxury-glass-minimal luxury-hover-lift p-8" style={{ animationDelay: '0.2s' }}>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-6 luxury-pulse-glow">
              <Video className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 luxury-gradient-text">Video Resources</h3>
            <p className="luxury-text-body mb-6">
              Promotional videos, tutorials, and brand stories
            </p>
            <Button className="luxury-btn-outline w-full" data-testid="button-videos">
              Coming Soon
            </Button>
          </div>

          <div className="luxury-glass-minimal luxury-hover-lift p-8" style={{ animationDelay: '0.3s' }}>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-6 luxury-pulse-glow">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 luxury-gradient-text">Press Kit</h3>
            <p className="luxury-text-body mb-6">
              Logos, brand guidelines, and press releases
            </p>
            <Button className="luxury-btn-outline w-full" data-testid="button-press-kit">
              <Download className="w-4 h-4 mr-2" />
              Download Kit
            </Button>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-xl p-12 text-center luxury-bg-primary luxury-slide-up">
          <h2 className="text-3xl font-bold mb-4 text-white">Media Inquiries</h2>
          <p className="text-white/90 text-lg mb-8">
            For press inquiries, interviews, or media partnerships
          </p>
          <Button className="luxury-btn-white luxury-shadow-xl" data-testid="button-media-contact">
            Contact Media Team
          </Button>
        </div>
      </div>
    </div>
  );
}
