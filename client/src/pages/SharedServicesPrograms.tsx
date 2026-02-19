import { Award, Heart, Users, GraduationCap, ShoppingBasket, Shield, Home, Sparkles } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface SharedServicesProgramsProps {
  language?: string;
}

export default function SharedServicesPrograms({ language = 'en' }: SharedServicesProgramsProps) {
  const isHebrew = language === 'he';
  
  const programs = [
    {
      icon: Heart,
      title: 'Pet Adoption Programs',
      titleHe: 'תוכניות אימוץ חיות מחמד',
      description: 'Connecting loving families with pets in need of forever homes',
      descriptionHe: 'חיבור משפחות אוהבות עם חיות מחמד הזקוקות לבית תמידי'
    },
    {
      icon: Users,
      title: 'Low-Income Pet Care Assistance',
      titleHe: 'סיוע בטיפול בחיות מחמד לבעלי הכנסה נמוכה',
      description: 'Supporting families to keep their beloved pets healthy',
      descriptionHe: 'תמיכה במשפחות לשמור על חיות המחמד שלהן בריאות'
    },
    {
      icon: Heart,
      title: 'Senior Pet Care Support',
      titleHe: 'תמיכה בטיפול בחיות מחמד מבוגרות',
      description: 'Special care programs for aging pets and their families',
      descriptionHe: 'תוכניות טיפול מיוחדות לחיות מחמד מבוגרות ומשפחותיהן'
    },
    {
      icon: GraduationCap,
      title: 'Community Education Workshops',
      titleHe: 'סדנאות חינוך קהילתי',
      description: 'Educational programs about responsible pet ownership',
      descriptionHe: 'תוכניות חינוכיות על בעלות אחראית על חיות מחמד'
    },
    {
      icon: ShoppingBasket,
      title: 'Pet Food Banks',
      titleHe: 'בנקי מזון לחיות מחמד',
      description: 'Ensuring no pet goes hungry in our community',
      descriptionHe: 'הבטחה שאף חיית מחמד לא תרעב בקהילה שלנו'
    },
    {
      icon: Shield,
      title: 'Emergency Veterinary Fund',
      titleHe: 'קרן וטרינרית לשעת חירום',
      description: 'Emergency medical assistance for pets in crisis',
      descriptionHe: 'סיוע רפואי חירום לחיות מחמד במצוקה'
    },
    {
      icon: Home,
      title: 'Foster Care Network',
      titleHe: 'רשת אומנה',
      description: 'Temporary care for pets awaiting adoption',
      descriptionHe: 'טיפול זמני בחיות מחמד הממתינות לאימוץ'
    },
    {
      icon: Sparkles,
      title: 'Spay/Neuter Initiatives',
      titleHe: 'יוזמות סירוס',
      description: 'Promoting responsible pet population control',
      descriptionHe: 'קידום בקרת אוכלוסיית חיות מחמד אחראית'
    },
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh py-12">
      <div className="luxury-container">
        {/* Hero Section */}
        <div className="text-center mb-16 luxury-animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
              <Award className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="luxury-heading-xl">
              {isHebrew ? 'תוכניות קהילתיות' : 'Community Programs'}
            </h1>
          </div>
          <p className="luxury-text-body max-w-3xl mx-auto">
            {isHebrew 
              ? 'תוכניות רווחת חיות מחמד ויוזמות קהילתיות. יצירת השפעה חיובית לחיות מחמד ומשפחותיהן.'
              : 'Pet welfare programs and community initiatives. Making a positive impact for pets and their families.'}
          </p>
        </div>

        {/* Programs Grid */}
        <div className="luxury-grid-2 mb-16">
          {programs.map((program, index) => {
            const Icon = program.icon;
            return (
              <div 
                key={index}
                className="luxury-glass-card luxury-hover-lift luxury-shadow-xl p-8 luxury-animate-fade-in"
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-7 h-7 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="luxury-heading-md mb-2">
                      {isHebrew ? program.titleHe : program.title}
                    </h3>
                    <p className="luxury-text-body">
                      {isHebrew ? program.descriptionHe : program.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Call to Action */}
        <div className="luxury-glass-card luxury-shadow-xl p-12 text-center luxury-animate-scale-in luxury-delay-3">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
            <Heart className="w-10 h-10 text-purple-600 luxury-pulse" />
          </div>
          <h2 className="luxury-heading-lg mb-4">
            {isHebrew ? 'הצטרפו לקהילה שלנו' : 'Join Our Community'}
          </h2>
          <p className="luxury-text-body mb-8 max-w-2xl mx-auto">
            {isHebrew 
              ? 'יחד נוכל ליצור עתיד טוב יותר לחיות מחמד ולבעליהן'
              : 'Together we can create a better future for pets and their families'}
          </p>
          <Button className="luxury-btn-primary luxury-shadow-xl">
            <Heart className="w-5 h-5 mr-2" />
            {isHebrew ? 'למידע נוסף' : 'Learn More'}
          </Button>
        </div>
      </div>
    </div>
  );
}
