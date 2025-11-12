import { useState } from 'react';
import { Link } from 'wouter';
import { Sparkles, Heart, Shield, MapPin, Zap, Clock, Award, Globe } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { t } from '@/lib/i18n';

interface PetWashDivisionsProps {
  language: Language;
}

export function PetWashDivisions({ language }: PetWashDivisionsProps) {
  const [hoveredDivision, setHoveredDivision] = useState<number | null>(null);

  const divisions = [
    {
      id: 1,
      name: 'Pet Wash Smart Hub',
      nameHe: 'פט ווש סמארט האב',
      tagline: t('divisions.smartHub.tagline', language),
      description: t('divisions.smartHub.description', language),
      icon: Sparkles,
      color: 'from-blue-500 to-cyan-500',
      link: '/our-service',
      features: [
        t('divisions.smartHub.feature1', language),
        t('divisions.smartHub.feature2', language),
        t('divisions.smartHub.feature3', language),
        t('divisions.smartHub.feature4', language),
      ],
    },
    {
      id: 2,
      name: 'The Sitter Suite™',
      nameHe: 'סוויטת השמרטפים',
      tagline: t('divisions.sitterSuite.tagline', language),
      description: t('divisions.sitterSuite.description', language),
      icon: Heart,
      color: 'from-purple-500 to-pink-500',
      link: '/sitter-suite',
      features: [
        t('divisions.sitterSuite.feature1', language),
        t('divisions.sitterSuite.feature2', language),
        t('divisions.sitterSuite.feature3', language),
        t('divisions.sitterSuite.feature4', language),
      ],
    },
    {
      id: 3,
      name: 'Walk My Pet™',
      nameHe: 'טיילו את חיית המחמד שלי',
      tagline: t('divisions.walkMyPet.tagline', language),
      description: t('divisions.walkMyPet.description', language),
      icon: MapPin,
      color: 'from-green-500 to-emerald-500',
      link: '/walk-my-pet',
      features: [
        t('divisions.walkMyPet.feature1', language),
        t('divisions.walkMyPet.feature2', language),
        t('divisions.walkMyPet.feature3', language),
        t('divisions.walkMyPet.feature4', language),
      ],
    },
    {
      id: 4,
      name: 'PetTrek™',
      nameHe: 'פטטרק',
      tagline: t('divisions.petTrek.tagline', language),
      description: t('divisions.petTrek.description', language),
      icon: Zap,
      color: 'from-orange-500 to-red-500',
      link: '/pettrek/book',
      features: [
        t('divisions.petTrek.feature1', language),
        t('divisions.petTrek.feature2', language),
        t('divisions.petTrek.feature3', language),
        t('divisions.petTrek.feature4', language),
      ],
    },
  ];

  return (
    <section className="py-16 px-4 sm:py-20 sm:px-6 lg:py-24 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-blue-100 rounded-full">
            <Globe className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900">
              {t('divisions.groupName', language)}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            {t('divisions.title', language)}
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            {t('divisions.subtitle', language)}
          </p>
        </div>

        {/* Divisions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {divisions.map((division) => {
            const Icon = division.icon;
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
                    relative h-full p-6 sm:p-8 rounded-2xl shadow-lg 
                    transition-all duration-500 overflow-hidden
                    ${hoveredDivision === division.id ? 'shadow-2xl scale-[1.02]' : 'shadow-lg'}
                  `}
                  style={{
                    background: hoveredDivision === division.id 
                      ? `linear-gradient(135deg, ${division.color.includes('blue') ? '#3b82f6 0%, #06b6d4 100%' : 
                          division.color.includes('purple') ? '#a855f7 0%, #ec4899 100%' :
                          division.color.includes('green') ? '#10b981 0%, #059669 100%' :
                          '#f97316 0%, #ef4444 100%'})`
                      : 'white'
                  }}
                >
                  {/* Animated Background Pattern */}
                  <div className={`absolute inset-0 opacity-5 transition-opacity duration-500 ${hoveredDivision === division.id ? 'opacity-10' : ''}`}>
                    <div className="absolute inset-0" style={{
                      backgroundImage: 'radial-gradient(circle at 20px 20px, currentColor 1px, transparent 0)',
                      backgroundSize: '40px 40px'
                    }} />
                  </div>

                  {/* Content */}
                  <div className="relative z-10">
                    {/* Icon & Title */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`
                        p-3 rounded-xl transition-all duration-500
                        ${hoveredDivision === division.id ? 'bg-white/20 scale-110' : 'bg-gray-100'}
                      `}>
                        <Icon className={`w-8 h-8 ${hoveredDivision === division.id ? 'text-white' : 'text-gray-700'}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-xl sm:text-2xl font-bold mb-1 transition-colors duration-500 ${hoveredDivision === division.id ? 'text-white' : 'text-gray-900'}`}>
                          {language === 'he' ? division.nameHe : division.name}
                        </h3>
                        <p className={`text-sm font-medium transition-colors duration-500 ${hoveredDivision === division.id ? 'text-white/90' : 'text-gray-600'}`}>
                          {division.tagline}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className={`text-base mb-6 leading-relaxed transition-colors duration-500 ${hoveredDivision === division.id ? 'text-white/95' : 'text-gray-700'}`}>
                      {division.description}
                    </p>

                    {/* Features */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {division.features.map((feature, idx) => (
                        <span
                          key={idx}
                          className={`
                            px-3 py-1.5 rounded-lg text-sm font-medium
                            transition-all duration-500
                            ${hoveredDivision === division.id 
                              ? 'bg-white/20 text-white border border-white/30' 
                              : 'bg-gray-100 text-gray-700 border border-gray-200'}
                          `}
                        >
                          {feature}
                        </span>
                      ))}
                    </div>

                    {/* CTA */}
                    <div className="flex items-center gap-2 mt-6">
                      <span className={`font-semibold transition-colors duration-500 ${hoveredDivision === division.id ? 'text-white' : 'text-blue-600'}`}>
                        {t('divisions.learnMore', language)}
                      </span>
                      <svg 
                        className={`w-5 h-5 transition-all duration-500 ${hoveredDivision === division.id ? 'text-white translate-x-1' : 'text-blue-600'}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={language === 'he' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
                      </svg>
                    </div>
                  </div>

                  {/* Hover Glow Effect */}
                  {hoveredDivision === division.id && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/10 animate-shimmer" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Trust Badges */}
        <div className="mt-12 pt-12 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <Shield className="w-10 h-10 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">100%</div>
              <div className="text-sm text-gray-600">
                {t('divisions.kycVerified', language)}
              </div>
            </div>
            <div>
              <Clock className="w-10 h-10 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">24/7</div>
              <div className="text-sm text-gray-600">
                {t('divisions.support', language)}
              </div>
            </div>
            <div>
              <Award className="w-10 h-10 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">
                {t('divisions.premium', language)}
              </div>
              <div className="text-sm text-gray-600">
                {t('divisions.quality', language)}
              </div>
            </div>
            <div>
              <Heart className="w-10 h-10 text-pink-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">
                {t('divisions.passion', language)}
              </div>
              <div className="text-sm text-gray-600">
                {t('divisions.forPets', language)}
              </div>
            </div>
          </div>
        </div>

        {/* Company Mission */}
        <div className="mt-12 text-center max-w-4xl mx-auto">
          <p className="text-lg text-gray-700 leading-relaxed">
            {t('divisions.missionStatement', language)}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </section>
  );
}
