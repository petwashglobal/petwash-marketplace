import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSEO, pageSEO } from '@/lib/seo';
import { 
  Sparkles, Upload, Star, Trash2, Check, Loader2, Image as ImageIcon,
  Wand2, Volume2, Settings, Download, Palette
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AvatarCustomizer } from '@/components/AvatarCustomizer';
import { AVATAR_PRESETS } from '@/data/avatarPresets';
import type { Language } from '@/lib/i18n';
import { t } from '@/lib/i18n';

interface PetAvatar {
  id: number;
  userId: string;
  petName: string;
  photoUrl: string;
  thumbnailUrl: string | null;
  landmarkConfig: any;
  animationProfile: {
    style: 'playful' | 'calm' | 'energetic';
    intensity: 'low' | 'medium' | 'high';
    blinkRate: number;
  };
  ttsVoice: string;
  status: 'active' | 'processing' | 'inactive';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function PlushLab() {
  const { toast } = useToast();
  const { user: firebaseUser } = useFirebaseAuth();
  const queryClient = useQueryClient();
  const [language] = useState<Language>((localStorage.getItem('petwash_lang') as Language) || 'he');
  
  // Apply SEO metadata
  useSEO(pageSEO.plushLab);
  
  // Form state
  const [petName, setPetName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [animationStyle, setAnimationStyle] = useState<'playful' | 'calm' | 'energetic'>('playful');
  const [ttsVoice, setTtsVoice] = useState('en-US-Neural2-A');
  
  // PREMIUM CUSTOMIZATION STATE (NEW)
  const [characterType, setCharacterType] = useState<'pet' | 'person' | 'superhero' | 'custom'>('pet');
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | undefined>(undefined);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [customization, setCustomization] = useState<any>({ colors: {}, patterns: {}, layering: [] });
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [avatarToDelete, setAvatarToDelete] = useState<number | null>(null);
  
  // Fetch avatars (only for authenticated users)
  const { data: avatarsData, isLoading } = useQuery({
    queryKey: ['/api/avatars'],
    enabled: !!firebaseUser,
  });
  
  const avatars: PetAvatar[] = avatarsData?.avatars || [];
  
  // Track if user is a guest (not signed in)
  const isGuest = !firebaseUser;
  
  // Create avatar mutation
  const createMutation = useMutation({
    mutationFn: async (data: { 
      petName: string; 
      photo: File; 
      animationStyle: string; 
      ttsVoice: string;
      characterType: string;
      outfitId?: string;
      accessories: string[];
      customization: any;
    }) => {
      const formData = new FormData();
      formData.append('petName', data.petName);
      formData.append('photo', data.photo);
      formData.append('ttsVoice', data.ttsVoice);
      formData.append('animationProfile', JSON.stringify({
        style: data.animationStyle,
        intensity: 'medium',
        blinkRate: 3,
      }));
      // PREMIUM CUSTOMIZATION (NEW)
      formData.append('characterType', data.characterType);
      if (data.outfitId) {
        formData.append('outfitId', data.outfitId);
      }
      formData.append('accessories', JSON.stringify(data.accessories));
      formData.append('customization', JSON.stringify(data.customization));
      
      const response = await fetch('/api/avatars', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await firebaseUser?.getIdToken()}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create avatar');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/avatars'] });
      toast({
        title: t('plushlab.avatarCreated', language),
        description: t('plushlab.avatarProcessing', language),
      });
      
      // Reset form
      setPetName('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setAnimationStyle('playful');
      setTtsVoice('en-US-Neural2-A');
      // Reset customization
      setCharacterType('pet');
      setSelectedOutfitId(undefined);
      setSelectedAccessories([]);
      setCustomization({ colors: {}, patterns: {}, layering: [] });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: t('plushlab.error', language),
        description: error.message,
      });
    },
  });
  
  // Delete avatar mutation
  const deleteMutation = useMutation({
    mutationFn: async (avatarId: number) => {
      return apiRequest(`/api/avatars/${avatarId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/avatars'] });
      toast({
        title: t('plushlab.deletedSuccess', language),
        description: t('plushlab.avatarDeleted', language),
      });
    },
  });
  
  // Set default avatar mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (avatarId: number) => {
      return apiRequest(`/api/avatars/${avatarId}/set-default`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/avatars'] });
      toast({
        title: t('plushlab.defaultSet', language),
      });
    },
  });
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          variant: 'destructive',
          title: t('plushlab.error', language),
          description: t('plushlab.selectImage', language),
        });
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: t('plushlab.error', language),
          description: t('plushlab.fileSizeLimit', language),
        });
        return;
      }
      
      setSelectedFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!petName.trim()) {
      toast({
        variant: 'destructive',
        title: t('plushlab.error', language),
        description: t('plushlab.enterPetName', language),
      });
      return;
    }
    
    if (!selectedFile) {
      toast({
        variant: 'destructive',
        title: t('plushlab.error', language),
        description: t('plushlab.selectPhoto', language),
      });
      return;
    }
    
    // GUEST MODE: Create avatar preview without saving to database
    if (isGuest) {
      const formData = new FormData();
      formData.append('petName', petName.trim());
      formData.append('photo', selectedFile);
      
      try {
        const response = await fetch('/api/avatars/guest', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create avatar');
        }
        
        const data = await response.json();
        
        toast({
          title: t('plushlab.avatarCreatedShort', language),
          description: t('plushlab.avatarReady', language),
        });
        
        // Update preview with processed image
        if (data.avatar?.photoUrl) {
          setPreviewUrl(data.avatar.photoUrl);
        }
        
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: t('plushlab.error', language),
          description: error.message,
        });
      }
      
      return;
    }
    
    // AUTHENTICATED MODE: Save to database
    createMutation.mutate({
      petName: petName.trim(),
      photo: selectedFile,
      animationStyle,
      ttsVoice,
      characterType,
      outfitId: selectedOutfitId,
      accessories: selectedAccessories,
      customization,
    });
  };
  
  const handleDelete = (avatarId: number) => {
    setAvatarToDelete(avatarId);
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (avatarToDelete) {
      deleteMutation.mutate(avatarToDelete);
    }
    setDeleteDialogOpen(false);
    setAvatarToDelete(null);
  };
  
  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh py-8">
        <div className="luxury-container">
          {/* FREE PUBLIC FEATURE BANNER */}
          <div className="mb-8 luxury-animate-fade-in">
            <div className="luxury-glass-card luxury-shadow-xl bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white">
              <div className="flex items-center justify-center gap-3 flex-wrap p-6">
                <Sparkles className="w-6 h-6 animate-pulse" />
                <p className="text-xl font-bold">
                  {t('plushlab.freePublicFeature', language)}
                </p>
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <p className="text-center text-sm pb-6 opacity-90">
                {t('plushlab.tryForFree', language)}
              </p>
            </div>
          </div>

          {/* Header - BRAND NAME: "The Plush Lab" - NEVER TRANSLATED */}
          <div className="text-center luxury-section-compact luxury-animate-slide-up luxury-delay-1">
            <div className="flex items-center justify-center luxury-gap-md mb-6">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl luxury-shadow-xl">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h1 className="luxury-heading-xl">
                The Plush Lab™
              </h1>
              <div className="p-3 bg-gradient-to-br from-pink-500 to-purple-500 rounded-2xl luxury-shadow-xl">
                <Wand2 className="w-10 h-10 text-white" />
              </div>
            </div>
            <p className="luxury-text-body max-w-3xl mx-auto">
              {t('plushlab.headerDescription', language)}
            </p>
          </div>
          
          {/* Create New Avatar */}
          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-xl mb-8 luxury-animate-scale-in luxury-delay-2">
            <div className="p-8 luxury-bg-soft rounded-t-3xl">
              <h2 className="luxury-heading-md flex items-center luxury-gap-sm">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                {t('plushlab.createNew', language)}
              </h2>
              <p className="luxury-text-small mt-2">
                {t('plushlab.uploadOrChoose', language)}
              </p>
            </div>
            <div className="p-8">
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8 luxury-glass-minimal p-2">
                  <TabsTrigger value="upload" className="flex items-center luxury-gap-xs">
                    <Upload className="w-4 h-4" />
                    {t('plushlab.uploadPhoto', language)}
                  </TabsTrigger>
                  <TabsTrigger value="ai-presets" className="flex items-center luxury-gap-xs">
                    <Palette className="w-4 h-4" />
                    {t('plushlab.aiArchetypes', language)}
                    <Badge variant="secondary" className="text-xs ml-2 luxury-badge">{t('plushlab.comingSoon', language)}</Badge>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="upload">
                  <form onSubmit={handleSubmit} className="luxury-gap-lg" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="grid md:grid-cols-2 luxury-gap-lg">
                  {/* Photo Upload */}
                  <div className="luxury-gap-md" style={{ display: 'flex', flexDirection: 'column' }}>
                    <Label htmlFor="photo" className="luxury-heading-sm">
                      {t('plushlab.petPhoto', language)}
                    </Label>
                    <div 
                      className="luxury-glass-card luxury-shadow-xl border-2 border-dashed border-purple-300 dark:border-purple-700 p-8 text-center cursor-pointer transition-all hover:border-purple-400 dark:hover:border-purple-600"
                      onClick={() => document.getElementById('photo')?.click()}
                    >
                      {previewUrl ? (
                        <div className="luxury-gap-md" style={{ display: 'flex', flexDirection: 'column' }}>
                          <div className="p-2 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl">
                            <img 
                              src={previewUrl} 
                              alt="Preview" 
                              className="max-h-48 mx-auto rounded-xl luxury-shadow-lg"
                            />
                          </div>
                          <p className="luxury-text-small">
                            {t('plushlab.clickToChange', language)}
                          </p>
                        </div>
                      ) : (
                        <div className="luxury-gap-sm" style={{ display: 'flex', flexDirection: 'column' }}>
                          <div className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl inline-block mx-auto">
                            <ImageIcon className="w-16 h-16 text-purple-500" />
                          </div>
                          <p className="luxury-text-body">
                            {t('plushlab.clickToUpload', language)}
                          </p>
                          <p className="luxury-text-small">
                            {t('plushlab.fileFormats', language)}
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      id="photo"
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                  
                  {/* Settings */}
                  <div className="luxury-gap-md" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div>
                      <Label htmlFor="petName" className="luxury-heading-sm">
                        {t('plushlab.petName', language)}
                      </Label>
                      <Input
                        id="petName"
                        value={petName}
                        onChange={(e) => setPetName(e.target.value)}
                        placeholder={t('plushlab.petNamePlaceholder', language)}
                        className="mt-2 luxury-glass-minimal"
                        data-testid="input-pet-name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="animationStyle" className="luxury-heading-sm">
                        {t('plushlab.animationStyle', language)}
                      </Label>
                      <Select value={animationStyle} onValueChange={(value: any) => setAnimationStyle(value)}>
                        <SelectTrigger className="mt-2 luxury-glass-minimal" data-testid="select-animation-style">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="playful">
                            {t('plushlab.playful', language)}
                          </SelectItem>
                          <SelectItem value="calm">
                            {t('plushlab.calm', language)}
                          </SelectItem>
                          <SelectItem value="energetic">
                            {t('plushlab.energetic', language)}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="ttsVoice" className="luxury-heading-sm flex items-center luxury-gap-xs">
                        <Volume2 className="w-4 h-4" />
                        {t('plushlab.voice', language)}
                      </Label>
                      <Select value={ttsVoice} onValueChange={setTtsVoice}>
                        <SelectTrigger className="mt-2 luxury-glass-minimal" data-testid="select-tts-voice">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en-US-Neural2-A">{t('plushlab.voiceEnUsFemale', language)}</SelectItem>
                          <SelectItem value="en-US-Neural2-D">{t('plushlab.voiceEnUsMale', language)}</SelectItem>
                          <SelectItem value="he-IL-Standard-A">{t('plushlab.voiceHeIlFemale', language)}</SelectItem>
                          <SelectItem value="he-IL-Standard-B">{t('plushlab.voiceHeIlMale', language)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                {/* PREMIUM CUSTOMIZATION - Avatar Customizer Component (NEW) */}
                <div className="luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6">
                  <div className="mb-6 text-center">
                    <h3 className="luxury-heading-md luxury-text-gradient flex items-center justify-center luxury-gap-sm">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                        <Wand2 className="w-6 h-6 text-white" />
                      </div>
                      {t('plushlab.premiumCustomization', language)}
                      <div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl">
                        <Star className="w-6 h-6 text-white" />
                      </div>
                    </h3>
                    <p className="luxury-text-small mt-2">
                      {t('plushlab.addOutfitsAccessories', language)}
                    </p>
                  </div>
                  
                  <AvatarCustomizer
                    language={language === 'he' ? 'he' : 'en'}
                    characterType={characterType}
                    selectedOutfitId={selectedOutfitId}
                    selectedAccessories={selectedAccessories}
                    customization={customization}
                    onCharacterTypeChange={setCharacterType}
                    onOutfitChange={setSelectedOutfitId}
                    onAccessoriesChange={setSelectedAccessories}
                    onCustomizationChange={setCustomization}
                  />
                </div>
                
                <div className="mt-8">
                  <button 
                    type="submit" 
                    className="luxury-btn-primary luxury-shadow-xl w-full py-6 text-lg"
                    disabled={createMutation.isPending}
                    data-testid="button-create-avatar"
                  >
                      {createMutation.isPending ? (
                        <span className="flex items-center justify-center luxury-gap-sm">
                          <div className="luxury-spinner w-5 h-5"></div>
                          {t('plushlab.creating', language)}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center luxury-gap-sm">
                          <Sparkles className="w-5 h-5" />
                          {t('plushlab.createAvatar', language)}
                        </span>
                      )}
                    </button>
                  </div>
              </form>
            </TabsContent>
            
            <TabsContent value="ai-presets">
              <div className="text-center py-12 luxury-gap-lg" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-4 mx-auto luxury-shadow-lg">
                  <Wand2 className="w-12 h-12 text-white" />
                </div>
                <div>
                  <h3 className="luxury-heading-md mb-2">
                    {t('plushlab.aiComingSoon', language)}
                  </h3>
                  <p className="luxury-text-body max-w-md mx-auto">
                    {t('plushlab.aiPresetsDescription', language)}
                  </p>
                </div>
                <div className="luxury-grid-4 max-w-2xl mx-auto mt-8">
                  {AVATAR_PRESETS.slice(0, 8).map((preset, index) => (
                    <div key={preset.id} className={`relative group cursor-not-allowed opacity-60 luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 5)}`}>
                      <div className="aspect-square bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-2xl flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="luxury-text-small mt-2 text-center">
                        {language === 'he' ? preset.label_he : preset.label_en}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
            </div>
          </div>
          
          {/* Existing Avatars */}
          <div className="luxury-section-compact luxury-animate-fade-in luxury-delay-3">
            <h2 className="luxury-heading-md mb-6 flex items-center luxury-gap-sm">
              <Settings className="w-6 h-6" />
              {t('plushlab.myAvatars', language)}
            </h2>
            
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="luxury-spinner"></div>
              </div>
            ) : avatars.length === 0 ? (
              <div className="luxury-glass-card luxury-shadow-md text-center py-12">
                <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="luxury-text-body">
                  {t('plushlab.noAvatarsYet', language)}
                </p>
              </div>
            ) : (
              <div className="luxury-grid-3">
                {avatars.map((avatar, index) => (
                  <div key={avatar.id} className={`luxury-glass-card luxury-hover-lift luxury-shadow-xl overflow-hidden luxury-animate-scale-in luxury-delay-${Math.min(index + 1, 5)}`} data-testid={`card-avatar-${avatar.id}`}>
                    <div className="relative aspect-square">
                      <div className="p-2 bg-gradient-to-br from-purple-500/10 to-pink-500/10">
                        <img 
                          src={avatar.thumbnailUrl || avatar.photoUrl} 
                          alt={avatar.petName}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      </div>
                      {avatar.isDefault && (
                        <div className="absolute top-4 right-4 luxury-badge-gold">
                          <Star className="w-3 h-3 mr-1" />
                          {t('plushlab.default', language)}
                        </div>
                      )}
                      {avatar.status === 'processing' && (
                        <div className="absolute top-4 left-4 luxury-badge">
                          <div className="luxury-spinner w-3 h-3 mr-1"></div>
                          {t('plushlab.processing', language)}
                        </div>
                      )}
                    </div>
                    <div className="p-6">
                      <h3 className="luxury-heading-sm mb-3">{avatar.petName}</h3>
                      <div className="flex luxury-gap-xs mb-4">
                        <span className="luxury-badge text-xs">
                          {avatar.animationProfile.style}
                        </span>
                        <span className="luxury-badge text-xs flex items-center luxury-gap-xs">
                          <Volume2 className="w-3 h-3" />
                          {avatar.ttsVoice.split('-')[0]}
                        </span>
                      </div>
                      
                      <div className="flex luxury-gap-sm">
                        {!avatar.isDefault && (
                          <button
                            onClick={() => setDefaultMutation.mutate(avatar.id)}
                            disabled={setDefaultMutation.isPending}
                            className="luxury-btn-secondary flex-1 py-2 text-sm"
                            data-testid={`button-set-default-${avatar.id}`}
                          >
                            <Check className="w-4 h-4 mr-1 inline" />
                            {t('plushlab.setDefault', language)}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = avatar.photoUrl;
                            link.download = `${avatar.petName}-avatar.png`;
                            link.click();
                          }}
                          className="luxury-btn-primary flex-1 py-2 text-sm"
                          data-testid={`button-download-${avatar.id}`}
                        >
                          <Download className="w-4 h-4 mr-1 inline" />
                          {t('plushlab.download', language)}
                        </button>
                        <button
                          onClick={() => handleDelete(avatar.id)}
                          disabled={deleteMutation.isPending}
                          className="luxury-btn-ghost text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-2"
                          data-testid={`button-delete-${avatar.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="luxury-glass-card luxury-shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="luxury-heading-sm">
              {t('plushlab.areYouSure', language)}
            </AlertDialogTitle>
            <AlertDialogDescription className="luxury-text-body">
              {t('plushlab.deleteConfirmation', language)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="luxury-gap-sm">
            <button onClick={() => setDeleteDialogOpen(false)} className="luxury-btn-ghost">
              {t('plushlab.cancel', language)}
            </button>
            <button onClick={confirmDelete} className="luxury-btn-primary bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800">
              {t('plushlab.delete', language)}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
