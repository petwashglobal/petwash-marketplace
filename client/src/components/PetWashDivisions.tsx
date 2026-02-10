import { useState } from 'react';
import { Link } from 'wouter';
import { Sparkles, Heart, MapPin, Zap, GraduationCap, ArrowRight } from 'lucide-react';
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
      accentFrom: '#38BDF8',
      accentTo: '#06B6D4',
      accentMid: '#22D3EE',
      glowColor: 'rgba(56, 189, 248, 0.35)',
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
      accentFrom: '#F472B6',
      accentTo: '#FB7185',
      accentMid: '#F9A8D4',
      glowColor: 'rgba(244, 114, 182, 0.35)',
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
      accentFrom: '#34D399',
      accentTo: '#2DD4BF',
      accentMid: '#6EE7B7',
      glowColor: 'rgba(52, 211, 153, 0.35)',
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
      accentFrom: '#D4AF37',
      accentTo: '#F5D76E',
      accentMid: '#E8C964',
      glowColor: 'rgba(212, 175, 55, 0.4)',
      link: '/pettrek/book',
      features: [
        t('divisions.petTrek.feature1', language),
        t('divisions.petTrek.feature2', language),
      ],
    },
    {
      id: 5,
      name: 'Pet Wash Academy™',
      nameHe: 'אקדמיית פט ווש',
      tagline: t('divisions.academy.tagline', language),
      description: t('divisions.academy.description', language),
      icon: GraduationCap,
      accentFrom: '#2DD4BF',
      accentTo: '#14B8A6',
      accentMid: '#5EEAD4',
      glowColor: 'rgba(45, 212, 191, 0.35)',
      link: '/academy',
      features: [
        t('divisions.academy.feature1', language),
        t('divisions.academy.feature2', language),
      ],
    },
  ];

  return (
    <section 
      ref={sectionRef}
      className="relative py-10 sm:py-16 lg:py-20 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #08080D 0%, #0C0C14 30%, #0A0A12 70%, #08080D 100%)',
      }}
    >
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201,169,110,0.06) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(56,189,248,0.04) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 20% 100%, rgba(244,114,182,0.04) 0%, transparent 50%)',
      }} />

      <div className="absolute top-0 left-0 right-0 h-[1px]" style={{
        background: 'linear-gradient(90deg, transparent 5%, rgba(201,169,110,0.2) 30%, rgba(201,169,110,0.4) 50%, rgba(201,169,110,0.2) 70%, transparent 95%)',
      }} />
      <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{
        background: 'linear-gradient(90deg, transparent 5%, rgba(201,169,110,0.2) 30%, rgba(201,169,110,0.4) 50%, rgba(201,169,110,0.2) 70%, transparent 95%)',
      }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div 
          className={`text-center mb-8 sm:mb-12 transition-all duration-1000 ${
            isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <span className="inline-block text-[10px] sm:text-xs uppercase tracking-[0.4em] font-semibold mb-4" style={{
            background: 'linear-gradient(90deg, #C9A96E, #E8D5A8, #C9A96E)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            {t('divisions.groupName', language)}
          </span>
          
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-medium mb-4 tracking-tight">
            <span className="text-white/90">
              {isHebrew ? 'עולם ' : 'The '}
            </span>
            <span style={{
              background: 'linear-gradient(135deg, #C9A96E, #E8D5A8, #D4AF37)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }} className="font-bold">
              Pet Wash™
            </span>
            <span className="text-white/90">
              {isHebrew ? '' : ' Universe'}
            </span>
          </h2>
          
          <div className="w-24 h-[2px] mx-auto rounded-full" style={{
            background: 'linear-gradient(90deg, transparent, #C9A96E, transparent)',
          }} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          {divisions.map((division, index) => {
            const Icon = division.icon;
            const isHovered = hoveredDivision === division.id;
            
            return (
              <Link
                key={division.id}
                href={division.link}
                className={`block group transition-all duration-700 ${
                  isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                } ${index === divisions.length - 1 && divisions.length % 2 !== 0 ? 'col-span-2 max-w-[calc(50%-0.375rem)] sm:max-w-[calc(50%-0.625rem)] mx-auto' : ''}`}
                style={{ transitionDelay: `${100 + index * 120}ms` }}
                onMouseEnter={() => setHoveredDivision(division.id)}
                onMouseLeave={() => setHoveredDivision(null)}
              >
                <div 
                  className="relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl transition-all duration-500 ease-out h-full overflow-hidden"
                  style={{
                    background: isHovered 
                      ? `linear-gradient(165deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)`
                      : `linear-gradient(165deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)`,
                    border: `1px solid ${isHovered ? `${division.accentFrom}50` : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: isHovered 
                      ? `0 24px 48px -12px rgba(0,0,0,0.5), 0 0 0 1px ${division.accentFrom}30, 0 0 40px ${division.glowColor}`
                      : '0 4px 16px -4px rgba(0,0,0,0.3)',
                    transform: isHovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <div 
                    className="absolute inset-0 rounded-2xl sm:rounded-3xl transition-opacity duration-700"
                    style={{
                      opacity: isHovered ? 0.12 : 0,
                      background: `radial-gradient(ellipse at 30% 0%, ${division.accentFrom} 0%, transparent 70%)`,
                    }}
                  />

                  <div className="absolute top-0 left-0 right-0 h-[1px] rounded-t-2xl sm:rounded-t-3xl transition-opacity duration-500" style={{
                    opacity: isHovered ? 1 : 0.3,
                    background: `linear-gradient(90deg, transparent, ${isHovered ? division.accentFrom : 'rgba(255,255,255,0.15)'}, transparent)`,
                  }} />

                  <div className="relative flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <h3 
                        className="font-serif text-sm sm:text-lg font-bold tracking-tight leading-tight transition-all duration-500 flex-1"
                        style={{
                          color: isHovered ? division.accentFrom : 'rgba(255,255,255,0.92)',
                          textShadow: isHovered ? `0 0 30px ${division.glowColor}` : 'none',
                        }}
                      >
                        {isHebrew ? division.nameHe : division.name}
                      </h3>
                      
                      <div 
                        className="flex-shrink-0 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl transition-all duration-500"
                        style={{
                          background: isHovered 
                            ? `linear-gradient(135deg, ${division.accentFrom} 0%, ${division.accentTo} 100%)`
                            : `linear-gradient(135deg, ${division.accentFrom}20 0%, ${division.accentTo}15 100%)`,
                          boxShadow: isHovered ? `0 8px 24px -4px ${division.glowColor}, 0 0 0 1px ${division.accentFrom}40` : 'none',
                        }}
                      >
                        <Icon 
                          className="w-4 h-4 sm:w-5 sm:h-5 transition-all duration-500" 
                          style={{ color: isHovered ? '#ffffff' : division.accentFrom }}
                          strokeWidth={2}
                        />
                      </div>
                    </div>

                    <p 
                      className="relative text-[9px] sm:text-xs font-semibold mb-2 sm:mb-3 leading-relaxed transition-colors duration-500"
                      style={{ color: isHovered ? `${division.accentMid}` : 'rgba(255,255,255,0.45)' }}
                    >
                      {division.tagline}
                    </p>

                    <p className="relative text-[10px] sm:text-sm leading-relaxed line-clamp-2 hidden sm:block mb-4 transition-colors duration-500"
                      style={{ color: isHovered ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)' }}
                    >
                      {division.description}
                    </p>

                    <div className="relative flex items-center gap-1.5 mt-auto pt-2 sm:pt-3">
                      <div className="w-full h-[1px] absolute top-0 left-0 right-0" style={{
                        background: `linear-gradient(90deg, ${isHovered ? division.accentFrom + '40' : 'rgba(255,255,255,0.06)'}, transparent)`,
                      }} />
                      <span 
                        className="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-500"
                        style={{ color: isHovered ? division.accentFrom : 'rgba(255,255,255,0.3)' }}
                      >
                        {t('divisions.learnMore', language)}
                      </span>
                      <ArrowRight 
                        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-all duration-500 ${isHovered ? 'translate-x-1' : ''} ${isHebrew ? 'rotate-180' : ''}`}
                        style={{ color: isHovered ? division.accentFrom : 'rgba(255,255,255,0.3)' }}
                        strokeWidth={2.5}
                      />
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
