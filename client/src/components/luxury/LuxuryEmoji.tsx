/**
 * 🎯 7-STAR LUXURY EMOJI RENDERER
 * Crown Jewel Edition - CSS-Based 3D Metallic Rendering
 * 
 * Inspired by Crown Jewel 3D Engine but optimized for React 18
 * Uses existing Playfair Display font + Metallic CSS gradients
 * 
 * Materials Library:
 * - 24K Gold (Dubai Gold Mirror Finish)
 * - VVS Diamond (Crystal Refraction)
 * - Platinum (Chrome Shimmer)
 * - Rose Gold (Luxury Pink)
 */

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CSSProperties } from 'react';

type LuxuryMaterial = 'gold' | 'diamond' | 'platinum' | 'rose-gold' | 'champagne';
type LuxurySize = 'sm' | 'md' | 'lg' | 'xl' | 'hero';

interface LuxuryEmojiProps {
  emoji: string;
  material?: LuxuryMaterial;
  size?: LuxurySize;
  withSparkles?: boolean;
  withGlow?: boolean;
  animate?: boolean;
  className?: string;
}

// 👑 7-STAR MATERIALS LIBRARY (CSS Gradients)
const MATERIAL_STYLES: Record<LuxuryMaterial, CSSProperties> = {
  'gold': {
    background: 'linear-gradient(135deg, #1f2937, #374151, #4b5563, #374151, #1f2937)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4))',
  },
  'diamond': {
    background: 'var(--gradient-diamond)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    filter: 'drop-shadow(0 4px 12px rgba(255, 255, 255, 0.6))',
  },
  'platinum': {
    background: 'var(--gradient-platinum)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    filter: 'drop-shadow(0 4px 12px rgba(229, 228, 226, 0.5))',
  },
  'rose-gold': {
    background: 'var(--gradient-metallic-rose)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    filter: 'drop-shadow(0 4px 12px rgba(255, 105, 180, 0.4))',
  },
  'champagne': {
    background: 'var(--gradient-champagne)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    filter: 'drop-shadow(0 4px 12px rgba(247, 231, 206, 0.5))',
  },
};

const SIZE_CONFIG = {
  sm: { fontSize: '2rem', sparkleSize: 4 },
  md: { fontSize: '3rem', sparkleSize: 6 },
  lg: { fontSize: '5rem', sparkleSize: 8 },
  xl: { fontSize: '7rem', sparkleSize: 10 },
  hero: { fontSize: '10rem', sparkleSize: 12 },
};

// ✨ SPARKLE PARTICLE SYSTEM
function Sparkles({ size, material }: { size: number; material: LuxuryMaterial }) {
  const sparkleColor = {
    'gold': '#374151',
    'diamond': '#FFFFFF',
    'platinum': '#E5E4E2',
    'rose-gold': '#FF69B4',
    'champagne': '#F7E7CE',
  }[material];

  const sparkles = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    x: Math.random() * 100 - 50,
    y: Math.random() * 100 - 50,
    delay: Math.random() * 2,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none">
      {sparkles.map((sparkle) => (
        <motion.div
          key={sparkle.id}
          className="absolute"
          style={{
            left: `calc(50% + ${sparkle.x}px)`,
            top: `calc(50% + ${sparkle.y}px)`,
            width: size,
            height: size,
            backgroundColor: sparkleColor,
            borderRadius: '50%',
            boxShadow: `0 0 ${size * 2}px ${sparkleColor}`,
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: sparkle.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// 🌟 GLOW EFFECT
function GlowRing({ material }: { material: LuxuryMaterial }) {
  const glowColor = {
    'gold': 'rgba(55, 65, 81, 0.3)',
    'diamond': 'rgba(255, 255, 255, 0.4)',
    'platinum': 'rgba(229, 228, 226, 0.3)',
    'rose-gold': 'rgba(255, 105, 180, 0.3)',
    'champagne': 'rgba(247, 231, 206, 0.3)',
  }[material];

  return (
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{
        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
      }}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

/**
 * 💎 LUXURY EMOJI COMPONENT
 * Renders emoji with 7-star metallic materials and animations
 */
export default function LuxuryEmoji({
  emoji,
  material = 'gold',
  size = 'md',
  withSparkles = true,
  withGlow = true,
  animate = true,
  className = '',
}: LuxuryEmojiProps) {
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      {/* GLOW RING */}
      {withGlow && <GlowRing material={material} />}
      
      {/* SPARKLE PARTICLES */}
      {withSparkles && <Sparkles size={sizeConfig.sparkleSize} material={material} />}
      
      {/* THE EMOJI with Metallic Material */}
      <motion.div
        className="relative z-10"
        style={{
          fontSize: sizeConfig.fontSize,
          fontFamily: 'var(--font-display)', // Playfair Display
          fontWeight: 900,
          ...MATERIAL_STYLES[material],
        }}
        animate={animate ? {
          y: [0, -10, 0],
          rotateZ: [-2, 2, -2],
        } : undefined}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {emoji}
      </motion.div>
    </div>
  );
}

/**
 * 🎬 LUXURY EMOJI SHOWCASE
 * Pre-configured luxury emoji combinations for common use cases
 */
export function LuxuryEmojiShowcase() {
  const showcaseItems = [
    { emoji: '👑', material: 'gold' as LuxuryMaterial, label: 'Royal Gold' },
    { emoji: '💎', material: 'diamond' as LuxuryMaterial, label: 'VVS Diamond' },
    { emoji: '🥇', material: 'gold' as LuxuryMaterial, label: '24K Gold Medal' },
    { emoji: '💍', material: 'platinum' as LuxuryMaterial, label: 'Platinum Ring' },
    { emoji: '🌹', material: 'rose-gold' as LuxuryMaterial, label: 'Rose Gold Flower' },
  ];

  return (
    <div className="flex gap-8 items-center justify-center flex-wrap p-8">
      {showcaseItems.map((item) => (
        <div key={item.emoji} className="flex flex-col items-center gap-3">
          <LuxuryEmoji
            emoji={item.emoji}
            material={item.material}
            size="lg"
          />
          <p className="text-sm text-gray-600 font-medium">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * 🔒 LUXURY BIOMETRIC LOGO
 * Special variant for admin login screens
 */
export function LuxuryBiometricLogo() {
  return (
    <div className="flex flex-col items-center gap-4">
      <LuxuryEmoji
        emoji="🐙"
        material="gold"
        size="hero"
        withSparkles={true}
        withGlow={true}
      />
      <motion.h1
        className="text-5xl font-bold text-transparent bg-clip-text"
        style={{
          background: 'var(--gradient-metallic-gold)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontFamily: 'var(--font-display)',
        }}
        animate={{
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
        }}
      >
        OCTOPUS HQ
      </motion.h1>
    </div>
  );
}
