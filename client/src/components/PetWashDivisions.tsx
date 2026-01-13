import { useState } from 'react';
import { Link } from 'wouter';
import { Sparkles, Heart, MapPin, Zap, ArrowRight } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { t } from '@/lib/i18n';

interface PetWashDivisionsProps {
  language: Language;
}

export function PetWashDivisions({ language }: PetWashDivisionsProps) {
  const [hoveredDivision, setHoveredDivision] = useState<number | null>(null);
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
    <section className="relative py-8 sm:py-20 lg:py-24 bg-white overflow-hidden">
      {/* Subtle luxury gold accent line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-[#c6a664] to-transparent" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Luxury Section Header - Fashion House Style */}
        <div className="text-center mb-8 sm:mb-12">
          {/* Elegant uppercase label */}
          <span className="inline-block text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#c6a664] font-medium mb-4">
            {t('divisions.groupName', language)}
          </span>
          
          {/* Main Title - Serif, elegant */}
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-light text-[#111] mb-4 tracking-tight">
            {isHebrew ? 'עולם Pet Wash™' : 'The Pet Wash™ Universe'}
          </h2>
          
          {/* Decorative line */}
          <div className="w-12 h-px bg-[#c6a664] mx-auto mb-6" />
          
          {/* Subtitle */}
          <p className="text-sm sm:text-base text-[#666] font-light max-w-2xl mx-auto leading-relaxed">
            {t('divisions.subtitle', language)}
          </p>
        </div>

        {/* Luxury Divisions Grid - Clean, Minimal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {divisions.map((division) => {
            const Icon = division.icon;
            const isHovered = hoveredDivision === division.id;
            
            return (
              <Link
                key={division.id}
                href={division.link}
                className="block group"
                onMouseEnter={() => setHoveredDivision(division.id)}
                onMouseLeave={() => setHoveredDivision(null)}
              >
                <div 
                  className={`
                    relative p-6 sm:p-8 border border-[#e5e5e5] bg-white
                    transition-all duration-500 ease-out
                    ${isHovered ? 'border-[#c6a664] shadow-lg' : 'hover:border-[#ccc]'}
                  `}
                >
                  {/* Gold accent corner on hover */}
                  <div 
                    className={`
                      absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#c6a664]
                      transition-opacity duration-500
                      ${isHovered ? 'opacity-100' : 'opacity-0'}
                    `}
                  />
                  <div 
                    className={`
                      absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#c6a664]
                      transition-opacity duration-500
                      ${isHovered ? 'opacity-100' : 'opacity-0'}
                    `}
                  />
                  
                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4">
                    {/* Minimal icon */}
                    <div 
                      className={`
                        p-3 border transition-all duration-500
                        ${isHovered ? 'border-[#c6a664] bg-[#faf8f5]' : 'border-[#e5e5e5] bg-[#fafafa]'}
                      `}
                    >
                      <Icon 
                        className="w-5 h-5 sm:w-6 sm:h-6 text-[#111] transition-colors duration-500" 
                        strokeWidth={1.5}
                      />
                    </div>
                    
                    {/* Title & Tagline */}
                    <div className="flex-1">
                      <h3 className="font-serif text-lg sm:text-xl font-medium text-[#111] mb-1 tracking-tight">
                        {isHebrew ? division.nameHe : division.name}
                      </h3>
                      <p className="text-[10px] sm:text-xs uppercase tracking-[0.15em] text-[#999]">
                        {division.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-[#666] leading-relaxed mb-4 font-light">
                    {division.description}
                  </p>

                  {/* Minimal Feature Tags */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    {division.features.map((feature, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 text-[10px] sm:text-xs uppercase tracking-wide text-[#888] border border-[#e5e5e5] bg-[#fafafa]"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* Elegant CTA */}
                  <div className="flex items-center gap-2">
                    <span 
                      className={`
                        text-xs sm:text-sm font-medium uppercase tracking-[0.1em] transition-colors duration-500
                        ${isHovered ? 'text-[#c6a664]' : 'text-[#111]'}
                      `}
                    >
                      {t('divisions.learnMore', language)}
                    </span>
                    <ArrowRight 
                      className={`
                        w-4 h-4 transition-all duration-500
                        ${isHovered ? 'text-[#c6a664] translate-x-1' : 'text-[#111]'}
                        ${isHebrew ? 'rotate-180' : ''}
                      `}
                      strokeWidth={1.5}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom decorative element */}
        <div className="mt-12 sm:mt-16 flex items-center justify-center gap-4">
          <div className="w-16 h-px bg-[#e5e5e5]" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#999]">Pet Wash™ Ltd</span>
          <div className="w-16 h-px bg-[#e5e5e5]" />
        </div>
      </div>
    </section>
  );
}
