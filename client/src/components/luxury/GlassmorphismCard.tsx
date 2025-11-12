import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassmorphismCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: 'purple' | 'pink' | 'blue' | 'green' | 'gold';
  onClick?: () => void;
}

const gradients = {
  purple: 'from-purple-500/10 via-pink-500/10 to-purple-600/10',
  pink: 'from-pink-500/10 via-rose-500/10 to-red-500/10',
  blue: 'from-blue-500/10 via-cyan-500/10 to-blue-600/10',
  green: 'from-green-500/10 via-emerald-500/10 to-teal-600/10',
  gold: 'from-yellow-500/10 via-amber-500/10 to-orange-500/10',
};

export function GlassmorphismCard({
  children,
  className = '',
  hover = true,
  gradient = 'purple',
  onClick,
}: GlassmorphismCardProps) {
  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-gradient-to-br',
        gradients[gradient],
        'backdrop-blur-xl backdrop-saturate-150',
        'border border-white/20',
        'shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]',
        hover && 'transition-all duration-300 hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.25)] hover:scale-[1.02]',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      whileHover={hover ? { y: -4 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Glass reflection effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      
      {/* Subtle glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-purple-600/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}

export function LuxuryButton({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  disabled = false,
  testId,
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const variants = {
    primary: 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 text-white shadow-lg hover:shadow-xl hover:from-purple-700 hover:via-pink-700 hover:to-purple-800',
    secondary: 'bg-white/10 backdrop-blur-lg border border-white/20 text-gray-900 dark:text-white hover:bg-white/20',
    ghost: 'bg-transparent hover:bg-white/10',
  };

  return (
    <motion.button
      className={cn(
        'rounded-full font-semibold',
        'transition-all duration-300',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizes[size],
        variants[variant],
        className
      )}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      whileHover={!disabled ? { scale: 1.05 } : undefined}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {children}
    </motion.button>
  );
}
