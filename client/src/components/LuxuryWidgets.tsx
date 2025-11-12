// Luxury Reusable Widget Components - Based on User's Dashboard Template
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, ArrowLeft } from 'lucide-react';
import { ReactNode } from 'react';

// Circular Progress Ring Component (like React Native ProgressCircle)
export const ProgressCircle = ({ 
  progress, 
  size = 120, 
  strokeWidth = 12,
  color = '#0EA5E9',
  children
}: { 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
  color?: string;
  children?: ReactNode;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
};

// Sparkline Chart Component (like React Native LineChart)
export const SparklineChart = ({ 
  data, 
  color = '#0EA5E9',
  height = 50 
}: { 
  data: number[];
  color?: string;
  height?: number;
}) => {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,100 ${points} 100,100`}
        fill={`url(#gradient-${color})`}
      />
    </svg>
  );
};

// Dashboard Widget Card (like React Native Card with Material Design)
export const DashboardWidget = ({ 
  title, 
  children, 
  actionIcon, 
  onActionPress,
  className = ""
}: {
  title: string;
  children: ReactNode;
  actionIcon?: ReactNode;
  onActionPress?: () => void;
  className?: string;
}) => {
  return (
    <Card className={`shadow-lg hover:shadow-xl transition-shadow duration-300 ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          {actionIcon && onActionPress && (
            <button 
              onClick={onActionPress}
              className="text-blue-600 hover:text-blue-700 transition-colors"
            >
              {actionIcon}
            </button>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
};

// Metric Display Widget
export const MetricWidget = ({
  value,
  label,
  icon,
  color = "blue",
  trend
}: {
  value: string | number;
  label: string;
  icon: ReactNode;
  color?: string;
  trend?: number;
}) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    green: 'from-green-500 to-green-600',
    orange: 'from-orange-500 to-orange-600',
    pink: 'from-pink-500 to-pink-600',
  }[color] || 'from-blue-500 to-blue-600';

  return (
    <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow">
      <div className={`w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br ${colorClasses} flex items-center justify-center text-white`}>
        {icon}
      </div>
      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{value}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
      {trend !== undefined && (
        <div className={`text-xs mt-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
};

// Status Badge Component
export const StatusBadge = ({
  status,
  className = ""
}: {
  status: string;
  className?: string;
}) => {
  const variants = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
    verified: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  };

  return (
    <Badge className={`${variants[status.toLowerCase() as keyof typeof variants] || variants.active} ${className}`}>
      {status}
    </Badge>
  );
};

// Back/Close Button Component
export const NavigationButton = ({
  type = 'back',
  onClick,
  className = ""
}: {
  type?: 'back' | 'close';
  onClick?: () => void;
  className?: string;
}) => {
  const Icon = type === 'back' ? ArrowLeft : X;
  
  return (
    <button
      onClick={onClick}
      className={`fixed top-20 left-4 z-50 p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 ${className}`}
      data-testid={`button-${type}`}
    >
      <Icon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
    </button>
  );
};

// Glassmorphism Card
export const GlassCard = ({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div className={`backdrop-blur-xl bg-white/70 dark:bg-gray-800/70 rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/20 ${className}`}>
      {children}
    </div>
  );
};
