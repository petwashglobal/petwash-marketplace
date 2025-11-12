import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sparkles, Shirt, Crown, Glasses, Diamond, Wand2, Star, Lock, Palette, Layers
} from 'lucide-react';
import { 
  OUTFIT_LIBRARY, 
  ACCESSORY_LIBRARY,
  getOutfitsByCategory,
  getAccessoriesByCategory,
  getOutfitsForCharacterType,
  type OutfitItem,
  type AccessoryItem
} from '@shared/outfitLibrary';

interface AvatarCustomizerProps {
  language: 'he' | 'en';
  characterType: 'pet' | 'person' | 'superhero' | 'custom';
  selectedOutfitId?: string;
  selectedAccessories?: string[];
  customization?: {
    colors: Record<string, string>;
    patterns: Record<string, string>;
    layering: string[];
  };
  onCharacterTypeChange: (type: 'pet' | 'person' | 'superhero' | 'custom') => void;
  onOutfitChange: (outfitId: string | undefined) => void;
  onAccessoriesChange: (accessories: string[]) => void;
  onCustomizationChange: (customization: any) => void;
}

export function AvatarCustomizer({
  language = 'en',
  characterType = 'pet',
  selectedOutfitId,
  selectedAccessories = [],
  customization = { colors: {}, patterns: {}, layering: [] },
  onCharacterTypeChange,
  onOutfitChange,
  onAccessoriesChange,
  onCustomizationChange,
}: AvatarCustomizerProps) {
  const [activeTab, setActiveTab] = useState<'outfits' | 'accessories' | 'colors'>('outfits');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const isHebrew = language === 'he';
  
  // Get selected outfit details
  const selectedOutfit = selectedOutfitId 
    ? OUTFIT_LIBRARY.find(o => o.id === selectedOutfitId)
    : undefined;

  // Get outfits filtered by character type and category
  const availableOutfits = selectedCategory === 'all'
    ? getOutfitsForCharacterType(characterType)
    : getOutfitsForCharacterType(characterType).filter(
        o => o.category === selectedCategory
      );

  // Toggle accessory selection
  const toggleAccessory = (accessoryId: string) => {
    if (selectedAccessories.includes(accessoryId)) {
      onAccessoriesChange(selectedAccessories.filter(id => id !== accessoryId));
    } else {
      onAccessoriesChange([...selectedAccessories, accessoryId]);
    }
  };

  // Color presets
  const colorPresets: Record<string, string> = {
    red: '#EF4444',
    blue: '#3B82F6',
    green: '#10B981',
    purple: '#A855F7',
    pink: '#EC4899',
    yellow: '#FBBF24',
    orange: '#F97316',
    black: '#1F2937',
    white: '#F9FAFB',
    gold: '#F59E0B',
    silver: '#94A3B8',
    rainbow: 'linear-gradient(90deg, #FF0000, #FF7F00, #FFFF00, #00FF00, #0000FF, #4B0082, #9400D3)',
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'casual': return <Shirt className="w-4 h-4" />;
      case 'formal': return <Crown className="w-4 h-4" />;
      case 'sports': return '⚽';
      case 'premium': return <Sparkles className="w-4 h-4" />;
      case 'seasonal': return '🎄';
      case 'fantasy': return <Wand2 className="w-4 h-4" />;
      default: return <Layers className="w-4 h-4" />;
    }
  };

  const getAccessoryCategoryIcon = (category: string) => {
    switch (category) {
      case 'hats': return <Crown className="w-4 h-4" />;
      case 'glasses': return <Glasses className="w-4 h-4" />;
      case 'collars': return <Diamond className="w-4 h-4" />;
      case 'toys': return <Wand2 className="w-4 h-4" />;
      case 'seasonal': return <Sparkles className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Character Type Selection */}
      <Card className="border-2 border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            {isHebrew ? 'סוג דמות' : 'Character Type'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['pet', 'person', 'superhero', 'custom'] as const).map((type) => (
              <Button
                key={type}
                variant={characterType === type ? 'default' : 'outline'}
                className={characterType === type ? 'bg-gradient-to-r from-purple-600 to-pink-600' : ''}
                onClick={() => onCharacterTypeChange(type)}
                data-testid={`button-character-${type}`}
              >
                {type === 'pet' && '🐾'}
                {type === 'person' && '👤'}
                {type === 'superhero' && '🦸'}
                {type === 'custom' && '✨'}
                <span className="ml-2 capitalize">{type}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Customization Tabs */}
      <Card className="border-2 border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-2xl">
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
            <TabsTrigger value="outfits" data-testid="tab-outfits">
              <Shirt className="w-4 h-4 mr-2" />
              {isHebrew ? 'תלבושות' : 'Outfits'}
            </TabsTrigger>
            <TabsTrigger value="accessories" data-testid="tab-accessories">
              <Crown className="w-4 h-4 mr-2" />
              {isHebrew ? 'אביזרים' : 'Accessories'}
            </TabsTrigger>
            <TabsTrigger value="colors" data-testid="tab-colors">
              <Palette className="w-4 h-4 mr-2" />
              {isHebrew ? 'צבעים' : 'Colors'}
            </TabsTrigger>
          </TabsList>

          {/* OUTFITS TAB */}
          <TabsContent value="outfits" className="p-4">
            {/* Category Filter */}
            <div className="mb-4">
              <Label className="mb-2 block font-semibold">
                {isHebrew ? 'קטגוריה' : 'Category'}
              </Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-outfit-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isHebrew ? 'הכל' : 'All'}</SelectItem>
                  <SelectItem value="casual">{isHebrew ? 'יומיומי' : 'Casual'}</SelectItem>
                  <SelectItem value="formal">{isHebrew ? 'רשמי' : 'Formal'}</SelectItem>
                  <SelectItem value="sports">{isHebrew ? 'ספורט' : 'Sports'}</SelectItem>
                  <SelectItem value="seasonal">{isHebrew ? 'עונתי' : 'Seasonal'}</SelectItem>
                  <SelectItem value="fantasy">{isHebrew ? 'פנטזיה' : 'Fantasy'}</SelectItem>
                  <SelectItem value="premium">{isHebrew ? 'פרימיום' : 'Premium'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-96">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* None Option */}
                <Card
                  className={`cursor-pointer hover:shadow-lg transition-all ${!selectedOutfitId ? 'border-2 border-purple-500' : ''}`}
                  onClick={() => onOutfitChange(undefined)}
                  data-testid="outfit-none"
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-4xl mb-2">🚫</div>
                    <p className="text-sm font-semibold">{isHebrew ? 'ללא תלבושת' : 'No Outfit'}</p>
                  </CardContent>
                </Card>

                {/* Outfit Options */}
                {availableOutfits.map((outfit) => (
                  <Card
                    key={outfit.id}
                    className={`cursor-pointer hover:shadow-lg transition-all ${selectedOutfitId === outfit.id ? 'border-2 border-purple-500' : ''}`}
                    onClick={() => onOutfitChange(outfit.id)}
                    data-testid={`outfit-${outfit.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-4xl mb-2">{outfit.thumbnail}</div>
                        <p className="text-sm font-semibold truncate">
                          {isHebrew ? outfit.nameHe : outfit.name}
                        </p>
                        <div className="flex gap-1 justify-center mt-2">
                          {outfit.premium && (
                            <Badge variant="secondary" className="text-xs bg-gradient-to-r from-yellow-400 to-orange-400">
                              <Star className="w-3 h-3 mr-1" />
                              {isHebrew ? 'פרימיום' : 'Premium'}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {getCategoryIcon(outfit.category)}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ACCESSORIES TAB */}
          <TabsContent value="accessories" className="p-4">
            <ScrollArea className="h-96">
              <div className="space-y-6">
                {(['hats', 'glasses', 'collars', 'toys', 'seasonal'] as const).map((category) => {
                  const accessories = getAccessoriesByCategory(category);
                  if (accessories.length === 0) return null;

                  return (
                    <div key={category}>
                      <h3 className="font-semibold mb-3 flex items-center gap-2 capitalize">
                        {getAccessoryCategoryIcon(category)}
                        {category}
                      </h3>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                        {accessories.map((accessory) => {
                          const isSelected = selectedAccessories.includes(accessory.id);
                          return (
                            <Card
                              key={accessory.id}
                              className={`cursor-pointer hover:shadow-lg transition-all ${isSelected ? 'border-2 border-purple-500' : ''}`}
                              onClick={() => toggleAccessory(accessory.id)}
                              data-testid={`accessory-${accessory.id}`}
                            >
                              <CardContent className="p-3 text-center">
                                <div className="text-3xl mb-1">{accessory.thumbnail}</div>
                                <p className="text-xs font-semibold truncate">
                                  {isHebrew ? accessory.nameHe : accessory.name}
                                </p>
                                {accessory.premium && (
                                  <Lock className="w-3 h-3 mx-auto mt-1 text-yellow-500" />
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* COLORS TAB */}
          <TabsContent value="colors" className="p-4">
            <div className="space-y-4">
              {selectedOutfit && (
                <div>
                  <Label className="mb-3 block font-semibold">
                    {isHebrew ? 'צבע תלבושת' : 'Outfit Color'}
                  </Label>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                    {selectedOutfit.colors.map((color) => {
                      const colorHex = colorPresets[color] || color;
                      const isSelected = customization.colors.outfit === color;
                      
                      return (
                        <Button
                          key={color}
                          variant="outline"
                          className={`h-16 ${isSelected ? 'border-2 border-purple-500' : ''}`}
                          style={{ background: colorHex }}
                          onClick={() => onCustomizationChange({
                            ...customization,
                            colors: { ...customization.colors, outfit: color }
                          })}
                          data-testid={`color-${color}`}
                        >
                          <span className="text-xs capitalize text-white drop-shadow-lg">
                            {color.replace('_', ' ')}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedOutfit && selectedOutfit.patterns.length > 0 && (
                <div>
                  <Label className="mb-3 block font-semibold">
                    {isHebrew ? 'תבנית' : 'Pattern'}
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedOutfit.patterns.map((pattern) => {
                      const isSelected = customization.patterns.outfit === pattern;
                      
                      return (
                        <Button
                          key={pattern}
                          variant={isSelected ? 'default' : 'outline'}
                          className={isSelected ? 'bg-gradient-to-r from-purple-600 to-pink-600' : ''}
                          onClick={() => onCustomizationChange({
                            ...customization,
                            patterns: { ...customization.patterns, outfit: pattern }
                          })}
                          data-testid={`pattern-${pattern}`}
                        >
                          <span className="capitalize">{pattern.replace('_', ' ')}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!selectedOutfit && (
                <div className="text-center py-8 text-gray-500">
                  {isHebrew 
                    ? 'בחר תלבושת כדי לערוך צבעים ותבניות'
                    : 'Select an outfit to edit colors and patterns'}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Current Selection Summary */}
      {(selectedOutfit || selectedAccessories.length > 0) && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <CardHeader>
            <CardTitle className="text-sm">
              {isHebrew ? 'הבחירה הנוכחית שלך' : 'Your Current Selection'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedOutfit && (
                <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                  {selectedOutfit.thumbnail} {isHebrew ? selectedOutfit.nameHe : selectedOutfit.name}
                </Badge>
              )}
              {selectedAccessories.map(accId => {
                const acc = ACCESSORY_LIBRARY.find(a => a.id === accId);
                if (!acc) return null;
                return (
                  <Badge key={accId} variant="secondary">
                    {acc.thumbnail} {isHebrew ? acc.nameHe : acc.name}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
