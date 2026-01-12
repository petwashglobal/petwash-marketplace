import { useState } from 'react';
import { Link } from 'wouter';
import { Sparkles, Heart, Shield, MapPin, Zap, Clock, Award, Globe, ArrowRight, Star, Crown } from 'lucide-react';
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
      gradient: 'from-cyan-400 via-blue-500 to-indigo-600',
      glowColor: 'rgba(59, 130, 246, 0.4)',
      accentColor: '#3b82f6',
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
      gradient: 'from-rose-700 via-rose-600 to-rose-800',
      glowColor: 'rgba(159, 18, 57, 0.4)',
      accentColor: '#9f1239',
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
      gradient: 'from-emerald-400 via-green-500 to-teal-600',
      glowColor: 'rgba(16, 185, 129, 0.4)',
      accentColor: '#10b981',
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
      gradient: 'from-amber-400 via-orange-500 to-red-600',
      glowColor: 'rgba(245, 158, 11, 0.4)',
      accentColor: '#f59e0b',
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
    <section className="relative py-20 sm:py-28 lg:py-32 overflow-hidden">
      {/* Luxury Dark Background with Mesh Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-black" />
      
      {/* Animated Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-amber-500/20 to-orange-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-40 w-80 h-80 bg-gradient-to-br from-rose-700/15 to-rose-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-gradient-to-br from-blue-500/15 to-cyan-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
      
      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Luxury Section Header */}
        <div className="text-center mb-16 sm:mb-20">
          {/* Premium Badge */}
          <div className="inline-flex items-center gap-2 mb-6 px-5 py-2.5 rounded-full border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 backdrop-blur-sm">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium tracking-wide text-amber-300">
              {t('divisions.groupName', language)}
            </span>
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
          </div>
          
          {/* Main Title with Gradient */}
          <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 tracking-tight">
            <span className="text-white">{isHebrew ? 'עולם ' : 'The '}</span>
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-transparent">
              Pet Wash™
            </span>
            <span className="text-white">{isHebrew ? ' שלנו' : ' Universe'}</span>
          </h2>
          
          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed font-light">
            {t('divisions.subtitle', language)}
          </p>
          
          {/* Decorative Line */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            <div className="w-2 h-2 rounded-full bg-amber-500/60" />
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          </div>
        </div>

        {/* Luxury Divisions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {divisions.map((division, index) => {
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
                    relative h-full rounded-3xl overflow-hidden
                    transition-all duration-700 ease-out
                    ${isHovered ? 'scale-[1.02]' : 'scale-100'}
                  `}
                  style={{
                    boxShadow: isHovered 
                      ? `0 25px 60px -12px ${division.glowColor}, 0 0 0 1px rgba(255,255,255,0.1)` 
                      : '0 10px 40px -15px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'
                  }}
                >
                  {/* Glassmorphic Background */}
                  <div 
                    className="absolute inset-0 transition-all duration-700"
                    style={{
                      background: isHovered
                        ? `linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)`
                        : `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)`,
                      backdropFilter: 'blur(20px)',
                    }}
                  />
                  
                  {/* Gradient Border Glow on Hover */}
                  <div 
                    className={`absolute inset-0 rounded-3xl transition-opacity duration-700 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                    style={{
                      background: `linear-gradient(135deg, ${division.accentColor}20 0%, transparent 50%, ${division.accentColor}10 100%)`,
                    }}
                  />
                  
                  {/* Animated Shimmer Effect */}
                  <div 
                    className={`absolute inset-0 transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                    style={{
                      background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)',
                      backgroundSize: '200% 100%',
                      animation: isHovered ? 'shimmer 2s infinite' : 'none',
                    }}
                  />

                  {/* Content */}
                  <div className="relative z-10 p-8 sm:p-10">
                    {/* Header Row */}
                    <div className="flex items-start gap-5 mb-6">
                      {/* Luxury Icon Container */}
                      <div 
                        className={`
                          relative p-4 rounded-2xl transition-all duration-500
                          ${isHovered ? 'scale-110' : 'scale-100'}
                        `}
                        style={{
                          background: isHovered 
                            ? `linear-gradient(135deg, ${division.accentColor}40, ${division.accentColor}20)`
                            : 'rgba(255,255,255,0.05)',
                          boxShadow: isHovered 
                            ? `0 10px 30px -10px ${division.glowColor}` 
                            : 'none'
                        }}
                      >
                        <Icon 
                          className={`w-8 h-8 transition-all duration-500 ${isHovered ? 'text-white' : 'text-gray-300'}`} 
                        />
                        
                        {/* Icon Glow Ring */}
                        <div 
                          className={`absolute inset-0 rounded-2xl transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                          style={{
                            boxShadow: `inset 0 0 20px ${division.accentColor}30`
                          }}
                        />
                      </div>
                      
                      {/* Title & Tagline */}
                      <div className="flex-1">
                        <h3 
                          className={`
                            text-2xl sm:text-3xl font-bold mb-2 transition-all duration-500
                            ${isHovered ? 'text-white' : 'text-gray-100'}
                          `}
                          style={{
                            textShadow: isHovered ? `0 0 30px ${division.glowColor}` : 'none'
                          }}
                        >
                          {isHebrew ? division.nameHe : division.name}
                        </h3>
                        <p className={`text-sm font-medium tracking-wide uppercase transition-colors duration-500 ${isHovered ? 'text-amber-400' : 'text-gray-500'}`}>
                          {division.tagline}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className={`text-base leading-relaxed mb-8 transition-colors duration-500 ${isHovered ? 'text-gray-200' : 'text-gray-400'}`}>
                      {division.description}
                    </p>

                    {/* Luxury Feature Tags */}
                    <div className="flex flex-wrap gap-2 mb-8">
                      {division.features.slice(0, 3).map((feature, idx) => (
                        <span
                          key={idx}
                          className={`
                            px-4 py-2 rounded-full text-sm font-medium
                            transition-all duration-500 border
                            ${isHovered 
                              ? 'bg-white/10 text-white border-white/20 shadow-lg' 
                              : 'bg-white/5 text-gray-400 border-white/5'}
                          `}
                          style={{
                            boxShadow: isHovered ? `0 4px 15px -5px ${division.glowColor}` : 'none'
                          }}
                        >
                          {feature}
                        </span>
                      ))}
                    </div>

                    {/* Luxury CTA */}
                    <div className="flex items-center gap-3 group/cta">
                      <span 
                        className={`
                          text-lg font-semibold tracking-wide transition-all duration-500
                          ${isHovered ? 'text-white' : 'text-gray-300'}
                        `}
                      >
                        {t('divisions.learnMore', language)}
                      </span>
                      <div 
                        className={`
                          p-2 rounded-full transition-all duration-500
                          ${isHovered ? 'bg-white/20 translate-x-1' : 'bg-white/5'}
                        `}
                        style={{
                          transform: isHebrew ? (isHovered ? 'translateX(-4px)' : '') : (isHovered ? 'translateX(4px)' : ''),
                        }}
                      >
                        <ArrowRight 
                          className={`w-5 h-5 transition-colors duration-500 ${isHovered ? 'text-white' : 'text-gray-400'} ${isHebrew ? 'rotate-180' : ''}`} 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Corner Accent */}
                  <div 
                    className={`
                      absolute top-0 right-0 w-32 h-32 transition-opacity duration-700
                      ${isHovered ? 'opacity-100' : 'opacity-0'}
                    `}
                    style={{
                      background: `radial-gradient(circle at 100% 0%, ${division.accentColor}25 0%, transparent 70%)`
                    }}
                  />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Luxury Trust Badges */}
        <div className="mt-20 pt-16 border-t border-white/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
            {[
              { icon: Shield, value: '100%', label: t('divisions.kycVerified', language), color: 'text-blue-400' },
              { icon: Clock, value: '24/7', label: t('divisions.support', language), color: 'text-emerald-400' },
              { icon: Award, value: t('divisions.premium', language), label: t('divisions.quality', language), color: 'text-purple-400' },
              { icon: Heart, value: t('divisions.passion', language), label: t('divisions.forPets', language), color: 'text-pink-400' },
            ].map((badge, idx) => (
              <div key={idx} className="text-center group cursor-default">
                <div className="inline-flex p-4 rounded-2xl bg-white/5 border border-white/10 mb-4 transition-all duration-500 group-hover:bg-white/10 group-hover:border-white/20 group-hover:scale-110">
                  <badge.icon className={`w-8 h-8 ${badge.color} transition-transform duration-500 group-hover:scale-110`} />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{badge.value}</div>
                <div className="text-sm text-gray-500 font-medium">{badge.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mission Statement */}
        <div className="mt-16 text-center max-w-4xl mx-auto">
          <p className="text-lg text-gray-400 leading-relaxed italic">
            "{t('divisions.missionStatement', language)}"
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </section>
  );
}
