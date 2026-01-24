import { useState } from 'react';
import { Link } from 'wouter';
import { Sparkles, Heart, MapPin, Zap, ArrowRight } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { useScrollReveal } from '@/hooks/useScrollReveal';

interface PetWashDivisionsProps {
  language: Language;
}

export function PetWashDivisions({ language }: PetWashDivisionsProps) {
  const [hoveredDivision, setHoveredDivision] = useState<number | null>(null);
  const { ref: sectionRef, isRevealed } = useScrollReveal<HTMLElement>();
  const isHebrew = language === 'he';

  const divisions = [
    {
      id: 1,
      name: 'Pet Wash Smart Hub',
      nameHe: 'פט ווש סמארט האב',
      tagline: t('divisions.smartHub.tagline', language),
      description: t('divisions.smartHub.description', language),
      icon: Sparkles,
      gradientFrom: '#0ea5e9',
      gradientTo: '#06b6d4',
      glowColor: 'rgba(14, 165, 233, 0.4)',
      link: '/our-service',
      features: [
        t('divisions.smartHub.feature1', language),
        t('divisions.smartHub.feature2', language),
      ],
    },
    {
      id: 2,
      name: 'The Sitter Suite™',
      nameHe: 'סוויטת השמרטפים',
      tagline: t('divisions.sitterSuite.tagline', language),
      description: t('divisions.sitterSuite.description', language),
      icon: Heart,
      gradientFrom: '#ec4899',
      gradientTo: '#f43f5e',
      glowColor: 'rgba(236, 72, 153, 0.4)',
      link: '/sitter-suite',
      features: [
        t('divisions.sitterSuite.feature1', language),
        t('divisions.sitterSuite.feature2', language),
      ],
    },
    {
      id: 3,
      name: 'Walk My Pet™',
      nameHe: 'טיילו את חיית המחמד שלי',
      tagline: t('divisions.walkMyPet.tagline', language),
      description: t('divisions.walkMyPet.description', language),
      icon: MapPin,
      gradientFrom: '#10b981',
      gradientTo: '#14b8a6',
      glowColor: 'rgba(16, 185, 129, 0.4)',
      link: '/walk-my-pet',
      features: [
        t('divisions.walkMyPet.feature1', language),
        t('divisions.walkMyPet.feature2', language),
      ],
    },
    {
      id: 4,
      name: 'PetTrek™',
      nameHe: 'פטטרק',
      tagline: t('divisions.petTrek.tagline', language),
      description: t('divisions.petTrek.description', language),
      icon: Zap,
      gradientFrom: '#c6a664',
      gradientTo: '#d4af37',
      glowColor: 'rgba(198, 166, 100, 0.5)',
      link: '/pettrek/book',
      features: [
        t('divisions.petTrek.feature1', language),
        t('divisions.petTrek.feature2', language),
      ],
    },
  ];

  return (
    <section 
      ref={sectionRef}
      className="relative py-8 sm:py-14 lg:py-16 bg-gradient-to-br from-slate-50 via-white to-amber-50/30 overflow-hidden"
    >
      {/* Glamorous background decorations */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(198,166,100,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(236,72,153,0.05),transparent_50%)]" />
      <div className="absolute top-0 left-0 w-48 h-48 border-t-2 border-l-2 border-[#c6a664]/20 rounded-tl-3xl" />
      <div className="absolute bottom-0 right-0 w-48 h-48 border-b-2 border-r-2 border-[#c6a664]/20 rounded-br-3xl" />
      
      {/* Floating luxury orbs */}
      <div className="absolute top-20 right-20 w-32 h-32 bg-gradient-to-br from-amber-200/20 to-yellow-100/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 left-20 w-40 h-40 bg-gradient-to-br from-pink-200/15 to-rose-100/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Glamorous Luxury Header */}
        <div 
          className={`text-center mb-6 sm:mb-10 transition-all duration-1000 ${
            isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <span className="inline-block text-[10px] sm:text-xs uppercase tracking-[0.35em] bg-gradient-to-r from-[#c6a664] via-[#d4af37] to-[#c6a664] bg-clip-text text-transparent font-semibold mb-3 animate-shimmer">
            {t('divisions.groupName', language)}
          </span>
          
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-medium mb-3 tracking-tight">
            <span className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent">
              {isHebrew ? 'עולם ' : 'The '}
            </span>
            <span className="bg-gradient-to-r from-[#c6a664] via-[#d4af37] to-[#c6a664] bg-clip-text text-transparent font-bold">
              Pet Wash™
            </span>
            <span className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent">
              {isHebrew ? '' : ' Universe'}
            </span>
          </h2>
          
          <div className="w-20 h-0.5 bg-gradient-to-r from-transparent via-[#c6a664] to-transparent mx-auto rounded-full" />
        </div>

        {/* Glamorous 2x2 Divisions Grid */}
        <div className="grid grid-cols-2 gap-4 sm:gap-5">
          {divisions.map((division, index) => {
            const Icon = division.icon;
            const isHovered = hoveredDivision === division.id;
            
            return (
              <Link
                key={division.id}
                href={division.link}
                className={`block group transition-all duration-700 ${
                  isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                }`}
                style={{ transitionDelay: `${100 + index * 100}ms` }}
                onMouseEnter={() => setHoveredDivision(division.id)}
                onMouseLeave={() => setHoveredDivision(null)}
              >
                <div 
                  className={`
                    relative p-4 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl
                    transition-all duration-500 ease-out h-full overflow-hidden
                    border-2 shadow-sm
                    ${isHovered 
                      ? 'shadow-xl transform -translate-y-1 scale-[1.02]' 
                      : 'hover:shadow-md border-slate-100'
                    }
                  `}
                  style={{
                    borderColor: isHovered ? division.gradientFrom : undefined,
                    boxShadow: isHovered ? `0 20px 40px -12px ${division.glowColor}` : undefined,
                  }}
                >
                  {/* Gradient glow overlay on hover */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                    style={{
                      background: `linear-gradient(135deg, ${division.gradientFrom}08 0%, ${division.gradientTo}05 100%)`,
                    }}
                  />
                  
                  {/* Glamorous Header with Icon */}
                  <div className="relative flex items-start gap-2 sm:gap-3 mb-3">
                    <div 
                      className="p-2 sm:p-2.5 rounded-xl transition-all duration-500 shadow-sm flex-shrink-0"
                      style={{
                        background: isHovered 
                          ? `linear-gradient(135deg, ${division.gradientFrom} 0%, ${division.gradientTo} 100%)`
                          : `linear-gradient(135deg, ${division.gradientFrom}15 0%, ${division.gradientTo}10 100%)`,
                        boxShadow: isHovered ? `0 8px 20px -6px ${division.glowColor}` : undefined,
                      }}
                    >
                      <Icon 
                        className="w-4 h-4 sm:w-5 sm:h-5 transition-colors duration-500" 
                        style={{ color: isHovered ? '#ffffff' : division.gradientFrom }}
                        strokeWidth={2}
                      />
                    </div>
                    
                    <h3 
                      className="font-serif text-sm sm:text-base font-semibold tracking-tight leading-tight transition-all duration-300"
                      style={{
                        background: isHovered 
                          ? `linear-gradient(135deg, ${division.gradientFrom} 0%, ${division.gradientTo} 100%)`
                          : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      {isHebrew ? division.nameHe : division.name}
                    </h3>
                  </div>

                  {/* Tagline with gradient */}
                  <p 
                    className="relative text-[9px] sm:text-xs uppercase tracking-[0.1em] font-semibold mb-2 leading-tight"
                    style={{
                      background: `linear-gradient(90deg, ${division.gradientFrom} 0%, ${division.gradientTo} 100%)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {division.tagline}
                  </p>

                  {/* Description - Hidden on mobile for compactness */}
                  <p className="relative text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-2 hidden sm:block mb-3">
                    {division.description}
                  </p>

                  {/* Glamorous CTA with gradient */}
                  <div className="relative flex items-center gap-1.5 mt-2 sm:mt-4">
                    <span 
                      className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] transition-all duration-500"
                      style={{
                        background: isHovered 
                          ? `linear-gradient(90deg, ${division.gradientFrom} 0%, ${division.gradientTo} 100%)`
                          : 'linear-gradient(90deg, #94a3b8 0%, #64748b 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      {t('divisions.learnMore', language)}
                    </span>
                    <ArrowRight 
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-all duration-500 ${isHovered ? 'translate-x-1' : ''} ${isHebrew ? 'rotate-180' : ''}`}
                      style={{ color: isHovered ? division.gradientFrom : '#94a3b8' }}
                      strokeWidth={2.5}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
