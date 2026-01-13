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
      accentColor: '#0a2540',
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
      accentColor: '#9f1239',
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
      accentColor: '#0a2540',
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
      accentColor: '#c6a664',
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
      className="relative py-6 sm:py-12 lg:py-14 bg-gradient-to-br from-white via-[#fdfbf7] to-white overflow-hidden"
    >
      {/* Luxury corner decorations */}
      <div className="absolute top-0 left-0 w-32 h-32 border-t border-l border-[#c6a664]/10" />
      <div className="absolute bottom-0 right-0 w-32 h-32 border-b border-r border-[#c6a664]/10" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Compact Luxury Header */}
        <div 
          className={`text-center mb-5 sm:mb-8 transition-all duration-1000 ${
            isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <span className="inline-block text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#c6a664] font-medium mb-2 gold-shimmer-text">
            {t('divisions.groupName', language)}
          </span>
          
          <h2 className="font-serif text-xl sm:text-2xl lg:text-3xl font-light text-[#111] mb-2 tracking-tight">
            {isHebrew ? 'עולם Pet Wash™' : 'The Pet Wash™ Universe'}
          </h2>
          
          <div className="w-12 h-px bg-gradient-to-r from-transparent via-[#c6a664] to-transparent mx-auto" />
        </div>

        {/* Compact 2x2 Divisions Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
                    relative p-3 sm:p-5 border bg-white rounded-lg
                    transition-all duration-500 ease-out h-full
                    ${isHovered ? 'border-[#c6a664] shadow-lg transform -translate-y-0.5' : 'border-[#e5e5e5] hover:border-[#d5d5d5]'}
                  `}
                >
                  {/* Compact Header with Icon */}
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <div 
                      className={`
                        p-1.5 sm:p-2 rounded-lg border transition-all duration-500
                        ${isHovered ? 'border-[#c6a664] bg-[#faf8f5]' : 'border-[#e5e5e5] bg-[#fafafa]'}
                      `}
                    >
                      <Icon 
                        className="w-4 h-4 sm:w-5 sm:h-5 text-[#111] transition-colors duration-500" 
                        strokeWidth={1.5}
                      />
                    </div>
                    
                    <h3 className="font-serif text-sm sm:text-base font-medium text-[#111] tracking-tight group-hover:text-[#c6a664] transition-colors duration-300 line-clamp-1">
                      {isHebrew ? division.nameHe : division.name}
                    </h3>
                  </div>

                  {/* Tagline */}
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.1em] text-[#c6a664] mb-2 line-clamp-1">
                    {division.tagline}
                  </p>

                  {/* Description - Hidden on mobile for compactness */}
                  <p className="text-xs text-[#666] leading-relaxed font-light line-clamp-2 hidden sm:block">
                    {division.description}
                  </p>

                  {/* Compact CTA Arrow */}
                  <div className="flex items-center gap-1 mt-2 sm:mt-3">
                    <span className={`text-[10px] sm:text-xs font-medium uppercase tracking-[0.1em] transition-colors duration-500 ${isHovered ? 'text-[#c6a664]' : 'text-[#888]'}`}>
                      {t('divisions.learnMore', language)}
                    </span>
                    <ArrowRight 
                      className={`w-3 h-3 sm:w-4 sm:h-4 transition-all duration-500 ${isHovered ? 'text-[#c6a664] translate-x-0.5' : 'text-[#888]'} ${isHebrew ? 'rotate-180' : ''}`}
                      strokeWidth={1.5}
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
