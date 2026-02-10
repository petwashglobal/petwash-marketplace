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
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div 
          className={`text-center mb-10 sm:mb-14 transition-all duration-1000 ${
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

        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          {divisions.map((division, index) => {
            const Icon = division.icon;
            const isHovered = hoveredDivision === division.id;
            
            return (
              <Link
                key={division.id}
                href={division.link}
                className={`block group transition-all duration-700 ${
                  isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                } ${index === divisions.length - 1 && divisions.length % 2 !== 0 ? 'col-span-2 max-w-[calc(50%-0.5rem)] sm:max-w-[calc(50%-0.75rem)] mx-auto' : ''}`}
                style={{ transitionDelay: `${100 + index * 120}ms` }}
                onMouseEnter={() => setHoveredDivision(division.id)}
                onMouseLeave={() => setHoveredDivision(null)}
              >
                <div 
                  className="relative p-5 sm:p-7 rounded-sm transition-all duration-300 h-full"
                  style={{
                    background: isHovered ? '#F6F4F1' : '#FAFAF8',
                    border: '1px solid',
                    borderColor: isHovered ? '#E5E0D8' : '#F0EDE8',
                  }}
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-4 sm:mb-5">
                      <div 
                        className="p-2 sm:p-2.5 rounded-full transition-all duration-300"
                        style={{
                          background: isHovered ? '#000000' : '#F0EDE8',
                        }}
                      >
                        <Icon 
                          className="w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300" 
                          style={{ color: isHovered ? '#FFFFFF' : '#1A1A1A' }}
                          strokeWidth={1.5}
                        />
                      </div>
                    </div>

                    <h3 
                      className="text-sm sm:text-base font-medium text-black tracking-tight leading-tight mb-2 sm:mb-3"
                    >
                      {isHebrew ? division.nameHe : division.name}
                    </h3>

                    <p 
                      className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 leading-relaxed"
                    >
                      {division.tagline}
                    </p>

                    <p className="text-[10px] sm:text-sm leading-relaxed text-gray-400 line-clamp-3 hidden sm:block mb-5">
                      {division.description}
                    </p>

                    <div className="mt-auto pt-3 sm:pt-4 border-t border-gray-100">
                      <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.15em] text-black group-hover:underline">
                        {t('divisions.learnMore', language)}
                        <ArrowRight 
                          className={`w-3 h-3 transition-transform duration-300 ${isHovered ? 'translate-x-1' : ''} ${isHebrew ? 'rotate-180' : ''}`}
                          strokeWidth={2}
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
