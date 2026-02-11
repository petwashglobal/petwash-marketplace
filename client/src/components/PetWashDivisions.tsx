import { useState } from 'react';
import { Link } from 'wouter';
import { Sparkles, Heart, MapPin, Zap, GraduationCap, ArrowRight } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { useScrollReveal } from '@/hooks/useScrollReveal';

interface PetWashDivisionsProps {
  language: Language;
}

const platformStyles = [
  {
    gradient: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 30%, #3a3a3a 50%, #2d2d2d 70%, #1a1a1a 100%)',
    shimmer: 'linear-gradient(135deg, rgba(201,169,110,0.15) 0%, rgba(201,169,110,0.05) 50%, rgba(201,169,110,0.15) 100%)',
    iconBg: 'linear-gradient(135deg, #c9a96e, #e8d5a8)',
    iconColor: '#1a1a1a',
    textColor: '#FFFFFF',
    taglineColor: 'rgba(201,169,110,0.9)',
    descColor: 'rgba(255,255,255,0.65)',
    borderColor: 'rgba(201,169,110,0.3)',
    borderHover: 'rgba(201,169,110,0.6)',
    ctaColor: '#c9a96e',
    dividerColor: 'rgba(201,169,110,0.2)',
  },
  {
    gradient: 'linear-gradient(135deg, #8B1A4A 0%, #A0325E 30%, #B84874 50%, #A0325E 70%, #8B1A4A 100%)',
    shimmer: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.12) 100%)',
    iconBg: 'linear-gradient(135deg, #F5C6D0, #FCDFE5)',
    iconColor: '#8B1A4A',
    textColor: '#FFFFFF',
    taglineColor: 'rgba(245,198,208,0.95)',
    descColor: 'rgba(255,255,255,0.7)',
    borderColor: 'rgba(245,198,208,0.3)',
    borderHover: 'rgba(245,198,208,0.6)',
    ctaColor: '#F5C6D0',
    dividerColor: 'rgba(245,198,208,0.2)',
  },
  {
    gradient: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 30%, #388E3C 50%, #2E7D32 70%, #1B5E20 100%)',
    shimmer: 'linear-gradient(135deg, rgba(200,230,201,0.15) 0%, rgba(200,230,201,0.05) 50%, rgba(200,230,201,0.15) 100%)',
    iconBg: 'linear-gradient(135deg, #A5D6A7, #C8E6C9)',
    iconColor: '#1B5E20',
    textColor: '#FFFFFF',
    taglineColor: 'rgba(200,230,201,0.95)',
    descColor: 'rgba(255,255,255,0.7)',
    borderColor: 'rgba(165,214,167,0.3)',
    borderHover: 'rgba(165,214,167,0.6)',
    ctaColor: '#A5D6A7',
    dividerColor: 'rgba(165,214,167,0.2)',
  },
  {
    gradient: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 30%, #1976D2 50%, #1565C0 70%, #0D47A1 100%)',
    shimmer: 'linear-gradient(135deg, rgba(187,222,251,0.15) 0%, rgba(187,222,251,0.05) 50%, rgba(187,222,251,0.15) 100%)',
    iconBg: 'linear-gradient(135deg, #90CAF9, #BBDEFB)',
    iconColor: '#0D47A1',
    textColor: '#FFFFFF',
    taglineColor: 'rgba(187,222,251,0.95)',
    descColor: 'rgba(255,255,255,0.7)',
    borderColor: 'rgba(144,202,249,0.3)',
    borderHover: 'rgba(144,202,249,0.6)',
    ctaColor: '#90CAF9',
    dividerColor: 'rgba(144,202,249,0.2)',
  },
  {
    gradient: 'linear-gradient(135deg, #4A148C 0%, #6A1B9A 30%, #7B1FA2 50%, #6A1B9A 70%, #4A148C 100%)',
    shimmer: 'linear-gradient(135deg, rgba(206,147,216,0.15) 0%, rgba(206,147,216,0.05) 50%, rgba(206,147,216,0.15) 100%)',
    iconBg: 'linear-gradient(135deg, #CE93D8, #E1BEE7)',
    iconColor: '#4A148C',
    textColor: '#FFFFFF',
    taglineColor: 'rgba(225,190,231,0.95)',
    descColor: 'rgba(255,255,255,0.7)',
    borderColor: 'rgba(206,147,216,0.3)',
    borderHover: 'rgba(206,147,216,0.6)',
    ctaColor: '#CE93D8',
    dividerColor: 'rgba(206,147,216,0.2)',
  },
];

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
      link: '/our-service',
    },
    {
      id: 2,
      name: 'The Sitter Suite™',
      nameHe: 'סוויטת השמרטפים',
      tagline: t('divisions.sitterSuite.tagline', language),
      description: t('divisions.sitterSuite.description', language),
      icon: Heart,
      link: '/sitter-suite',
    },
    {
      id: 3,
      name: 'Walk My Pet™',
      nameHe: 'טיילו את חיית המחמד שלי',
      tagline: t('divisions.walkMyPet.tagline', language),
      description: t('divisions.walkMyPet.description', language),
      icon: MapPin,
      link: '/walk-my-pet',
    },
    {
      id: 4,
      name: 'PetTrek™',
      nameHe: 'פט-טרק',
      tagline: t('divisions.petTrek.tagline', language),
      description: t('divisions.petTrek.description', language),
      icon: Zap,
      link: '/pettrek/book',
    },
    {
      id: 5,
      name: 'Pet Wash Academy™',
      nameHe: 'אקדמיית פט ווש',
      tagline: t('divisions.academy.tagline', language),
      description: t('divisions.academy.description', language),
      icon: GraduationCap,
      link: '/academy',
    },
  ];

  return (
    <section 
      ref={sectionRef}
      className="relative py-16 sm:py-24 lg:py-28 overflow-hidden"
      style={{ background: '#FFFFFF' }}
    >
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div 
          className={`text-center mb-12 sm:mb-16 transition-all duration-1000 ${
            isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-[11px] sm:text-xs tracking-[0.3em] uppercase text-gray-400 font-medium mb-4">
            {t('divisions.groupName', language)}
          </p>
          
          <h2 
            className="text-3xl sm:text-4xl lg:text-5xl font-light text-black mb-4"
            style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', Georgia, serif", letterSpacing: '-0.02em' }}
          >
            <span>
              {isHebrew ? 'עולם ' : 'The '}
            </span>
            <span className="font-medium">
              Pet Wash™
            </span>
            <span>
              {isHebrew ? '' : ' Universe'}
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {divisions.map((division, index) => {
            const Icon = division.icon;
            const isHovered = hoveredDivision === division.id;
            const style = platformStyles[index];
            const isLastOdd = index === divisions.length - 1 && divisions.length % 3 === 2;
            
            return (
              <Link
                key={division.id}
                href={division.link}
                className={`block group transition-all duration-700 ${
                  isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                } ${isLastOdd ? 'sm:col-span-2 lg:col-span-1 sm:max-w-[calc(50%-0.75rem)] lg:max-w-none sm:mx-auto lg:mx-0' : ''}`}
                style={{ transitionDelay: `${100 + index * 120}ms` }}
                onMouseEnter={() => setHoveredDivision(division.id)}
                onMouseLeave={() => setHoveredDivision(null)}
              >
                <div 
                  className="relative overflow-hidden transition-all duration-500 h-full"
                  style={{
                    borderRadius: '2px',
                    border: `1.5px solid ${isHovered ? style.borderHover : style.borderColor}`,
                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                    boxShadow: isHovered 
                      ? '0 20px 40px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.1)' 
                      : '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                >
                  <div 
                    className="absolute inset-0"
                    style={{ background: style.gradient }}
                  />
                  <div 
                    className="absolute inset-0 transition-opacity duration-500"
                    style={{ 
                      background: style.shimmer,
                      opacity: isHovered ? 1 : 0.5,
                    }}
                  />

                  <div className="relative z-10 p-6 sm:p-7 flex flex-col h-full min-h-[240px] sm:min-h-[280px]">
                    <div className="mb-5 sm:mb-6">
                      <div 
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-transform duration-300"
                        style={{
                          background: style.iconBg,
                          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        }}
                      >
                        <Icon 
                          className="w-5 h-5 sm:w-6 sm:h-6" 
                          style={{ color: style.iconColor }}
                          strokeWidth={1.8}
                        />
                      </div>
                    </div>

                    <h3 
                      className="text-lg sm:text-xl font-semibold tracking-tight leading-tight mb-2 sm:mb-3"
                      style={{ 
                        color: style.textColor,
                        fontFamily: "'Playfair Display', 'Didot', Georgia, serif",
                      }}
                    >
                      {isHebrew ? division.nameHe : division.name}
                    </h3>

                    <p 
                      className="text-xs sm:text-sm mb-3 sm:mb-4 leading-relaxed font-medium"
                      style={{ color: style.taglineColor }}
                    >
                      {division.tagline}
                    </p>

                    <p 
                      className="text-xs sm:text-[13px] leading-relaxed line-clamp-3 mb-5"
                      style={{ color: style.descColor }}
                    >
                      {division.description}
                    </p>

                    <div 
                      className="mt-auto pt-4"
                      style={{ borderTop: `1px solid ${style.dividerColor}` }}
                    >
                      <span 
                        className="inline-flex items-center gap-2 text-xs sm:text-[13px] font-semibold uppercase tracking-[0.12em] transition-all duration-300"
                        style={{ color: style.ctaColor }}
                      >
                        {t('divisions.learnMore', language)}
                        <ArrowRight 
                          className={`w-4 h-4 transition-transform duration-300 ${isHovered ? (isHebrew ? '-translate-x-1.5' : 'translate-x-1.5') : ''} ${isHebrew ? 'rotate-180' : ''}`}
                          strokeWidth={2.5}
                        />
                      </span>
                    </div>
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
