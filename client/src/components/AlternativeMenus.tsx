import { Menu, MoreVertical, Grid3X3, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Alternative hamburger menu designs for Pet Wash™️

export const MenuDesign1 = ({ onClick, className = "" }: { onClick: () => void, className?: string }) => (
  <Button 
    variant="ghost" 
    size="icon" 
    className={`w-8 h-8 p-0 hover:bg-white/90 touch-target ${className}`}
    onClick={onClick}
  >
    <Menu className="w-6 h-6" />
  </Button>
);

export const MenuDesign2 = ({ onClick, className = "" }: { onClick: () => void, className?: string }) => (
  <Button 
    variant="ghost" 
    size="icon" 
    className={`w-8 h-8 p-0 hover:bg-white/90 touch-target ${className}`}
    onClick={onClick}
  >
    <MoreVertical className="w-6 h-6" />
  </Button>
);

export const MenuDesign3 = ({ onClick, className = "" }: { onClick: () => void, className?: string }) => (
  <Button 
    variant="ghost" 
    size="icon" 
    className={`w-8 h-8 p-0 hover:bg-white/90 touch-target ${className}`}
    onClick={onClick}
  >
    <Grid3X3 className="w-6 h-6" />
  </Button>
);

export const MenuDesign4 = ({ onClick, className = "" }: { onClick: () => void, className?: string }) => (
  <Button 
    variant="ghost" 
    size="icon" 
    className={`w-8 h-8 p-0 hover:bg-white/90 touch-target ${className}`}
    onClick={onClick}
  >
    <div className="flex flex-col space-y-1">
      <div className="w-4 h-0.5 bg-black"></div>
      <div className="w-4 h-0.5 bg-black"></div>
      <div className="w-4 h-0.5 bg-black"></div>
    </div>
  </Button>
);

export const MenuDesign5 = ({ onClick, className = "" }: { onClick: () => void, className?: string }) => (
  <Button 
    variant="ghost" 
    size="icon" 
    className={`w-8 h-8 p-0 hover:bg-white/90 touch-target ${className}`}
    onClick={onClick}
  >
    <div className="flex flex-col items-end space-y-1">
      <div className="w-4 h-0.5 bg-black"></div>
      <div className="w-3 h-0.5 bg-black"></div>
      <div className="w-4 h-0.5 bg-black"></div>
    </div>
  </Button>
);

export const MenuDesign6 = ({ onClick, className = "" }: { onClick: () => void, className?: string }) => (
  <Button 
    variant="ghost" 
    size="icon" 
    className={`w-8 h-8 p-0 hover:bg-white/90 rounded-full touch-target ${className}`}
    onClick={onClick}
  >
    <div className="w-1 h-1 bg-black rounded-full"></div>
    <div className="w-1 h-1 bg-black rounded-full mt-1"></div>
    <div className="w-1 h-1 bg-black rounded-full mt-1"></div>
  </Button>
);