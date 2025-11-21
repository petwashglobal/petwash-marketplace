import { ArrowLeft, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PlatformPlaceholderProps {
  platformName: string;
  platformNameHe?: string;
  description: string;
  descriptionHe?: string;
  icon: React.ReactNode;
  features?: string[];
  featuresHe?: string[];
  language?: string;
}

export default function PlatformPlaceholder({
  platformName,
  platformNameHe,
  description,
  descriptionHe,
  icon,
  features = [],
  featuresHe = [],
  language = 'en',
}: PlatformPlaceholderProps) {
  const isHebrew = language === 'he';
  const displayName = isHebrew && platformNameHe ? platformNameHe : platformName;
  const displayDescription = isHebrew && descriptionHe ? descriptionHe : description;
  const displayFeatures = isHebrew && featuresHe.length > 0 ? featuresHe : features;

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link href="/">
            <button className="luxury-btn-secondary mb-8" data-testid="btn-back-home">
              <ArrowLeft className="w-4 h-4 mr-2 inline" />
              {isHebrew ? 'חזרה לדף הבית' : 'Back to Home'}
            </button>
          </Link>

          {/* Header Card - Luxury Glass */}
          <div className="luxury-glass-card luxury-shadow-xl mb-8 p-8 luxury-animate-fade-in">
            <div className="text-center space-y-4 pb-8">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center luxury-shadow-lg">
                  <div className="text-white scale-125">{icon}</div>
                </div>
              </div>
              <h1 className="luxury-heading-xl">
                {displayName}
              </h1>
              <p className="luxury-text-body max-w-2xl mx-auto">
                {displayDescription}
              </p>
            </div>
          </div>

          {/* Features Grid - Luxury Design */}
          {displayFeatures.length > 0 && (
            <div className="luxury-glass-card luxury-shadow-md mb-8 p-6 luxury-animate-fade-in luxury-delay-1">
              <h2 className="flex items-center gap-2 luxury-heading-sm mb-4">
                <Sparkles className="w-4 h-4 text-purple-600" />
                {isHebrew ? 'תכונות מתוכננות' : 'Planned Features'}
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {displayFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-green-600 mt-1 text-sm">✓</span>
                    <span className="luxury-text-small">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Status Banner - Luxury Glass Design */}
          <div className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-2">
            <div className="text-center py-12">
              <div className="text-5xl mb-6 opacity-30">🚧</div>
              <h3 className="luxury-heading-lg mb-3">
                {isHebrew ? 'בפיתוח' : 'Under Development'}
              </h3>
              <p className="luxury-text-body max-w-lg mx-auto mb-6">
                {isHebrew
                  ? 'פלטפורמה זו נמצאת כעת בפיתוח פעיל. הצוות שלנו עובד על הבאת חוויה מדהימה לך ולחיית המחמד שלך.'
                  : 'This platform is currently under active development. Our team is working on bringing you an amazing experience for you and your pet.'}
              </p>
              <div className="mt-8">
                <Link href="/">
                  <button className="luxury-btn-primary luxury-shadow-xl px-8 py-4" data-testid="btn-explore-other">
                    {isHebrew ? 'גלה פלטפורמות אחרות' : 'Explore Other Platforms'}
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* TODO Marker - Luxury Panel */}
          <div className="mt-8 luxury-glass-panel p-4">
            <p className="text-xs font-mono luxury-text-small">
              <strong className="font-semibold">TODO:</strong> Implement full {platformName} platform with booking flow, provider
              dashboards, payment integration, and real-time features.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
