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
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link href="/">
            <Button variant="ghost" className="mb-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100" data-testid="btn-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isHebrew ? 'חזרה לדף הבית' : 'Back to Home'}
            </Button>
          </Link>

          {/* Header Card - Pure White Minimalist */}
          <Card className="mb-8 border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-black">
            <CardHeader className="text-center space-y-4 pb-8">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-white dark:bg-black border-2 border-gray-200 dark:border-gray-800 flex items-center justify-center">
                  <div className="text-gray-900 dark:text-gray-100 scale-125">{icon}</div>
                </div>
              </div>
              <CardTitle className="text-4xl font-light text-gray-900 dark:text-gray-100 tracking-tight">
                {displayName}
              </CardTitle>
              <CardDescription className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto font-light">
                {displayDescription}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Features Grid - Minimal Design */}
          {displayFeatures.length > 0 && (
            <Card className="mb-8 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-light text-gray-900 dark:text-gray-100">
                  <Sparkles className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                  {isHebrew ? 'תכונות מתוכננות' : 'Planned Features'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3 md:grid-cols-2">
                  {displayFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-gray-400 dark:text-gray-600 mt-1 text-sm">✓</span>
                      <span className="text-gray-700 dark:text-gray-300 font-light text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Status Banner - Clean White Design */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-sm">
            <CardContent className="text-center py-12">
              <div className="text-5xl mb-6 opacity-30">🚧</div>
              <h3 className="text-2xl font-light mb-3 text-gray-900 dark:text-gray-100">
                {isHebrew ? 'בפיתוח' : 'Under Development'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto font-light text-sm leading-relaxed">
                {isHebrew
                  ? 'פלטפורמה זו נמצאת כעת בפיתוח פעיל. הצוות שלנו עובד על הבאת חוויה מדהימה לך ולחיית המחמד שלך.'
                  : 'This platform is currently under active development. Our team is working on bringing you an amazing experience for you and your pet.'}
              </p>
              <div className="mt-8">
                <Link href="/">
                  <Button 
                    size="lg" 
                    className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-light" 
                    data-testid="btn-explore-other"
                  >
                    {isHebrew ? 'גלה פלטפורמות אחרות' : 'Explore Other Platforms'}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* TODO Marker - Subtle Design */}
          <div className="mt-8 p-4 bg-white dark:bg-black border border-gray-300 dark:border-gray-700 rounded-sm">
            <p className="text-xs font-mono text-gray-500 dark:text-gray-500">
              <strong className="font-semibold">TODO:</strong> Implement full {platformName} platform with booking flow, provider
              dashboards, payment integration, and real-time features.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
