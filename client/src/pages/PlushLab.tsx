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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900 py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* FREE PUBLIC FEATURE BANNER */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white px-6 py-4 rounded-xl shadow-2xl border-2 border-white/30">
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Sparkles className="w-6 h-6 animate-pulse" />
                <p className="text-xl font-bold">
                  {t('plushlab.freePublicFeature', language)}
                </p>
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <p className="text-center text-sm mt-2 opacity-90">
                {t('plushlab.tryForFree', language)}
              </p>
            </div>
          </div>

          {/* Header - BRAND NAME: "The Plush Lab" - NEVER TRANSLATED */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Sparkles className="w-10 h-10 text-purple-600 dark:text-purple-400" />
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                The Plush Lab™
              </h1>
              <Wand2 className="w-10 h-10 text-pink-600 dark:text-pink-400" />
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              {t('plushlab.headerDescription', language)}
            </p>
          </div>
          
          {/* Create New Avatar */}
          <Card className="mb-8 border-2 border-purple-200 dark:border-purple-800 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-purple-100 via-pink-100 to-blue-100 dark:from-purple-900/30 dark:via-pink-900/30 dark:to-blue-900/30">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Upload className="w-6 h-6" />
                {t('plushlab.createNew', language)}
              </CardTitle>
              <CardDescription>
                {t('plushlab.uploadOrChoose', language)}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="upload" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {t('plushlab.uploadPhoto', language)}
                  </TabsTrigger>
                  <TabsTrigger value="ai-presets" className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    {t('plushlab.aiArchetypes', language)}
                    <Badge variant="secondary" className="text-xs">{t('plushlab.comingSoon', language)}</Badge>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="upload">
                  <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Photo Upload */}
                  <div className="space-y-4">
                    <Label htmlFor="photo" className="text-base font-semibold">
                      {t('plushlab.petPhoto', language)}
                    </Label>
                    <div 
                      className="border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg p-8 text-center hover:border-purple-500 transition-colors cursor-pointer bg-white dark:bg-gray-800"
                      onClick={() => document.getElementById('photo')?.click()}
                    >
                      {previewUrl ? (
                        <div className="space-y-4">
                          <img 
                            src={previewUrl} 
                            alt="Preview" 
                            className="max-h-48 mx-auto rounded-lg shadow-lg"
                          />
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t('plushlab.clickToChange', language)}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <ImageIcon className="w-16 h-16 mx-auto text-purple-400" />
                          <p className="text-gray-600 dark:text-gray-400">
                            {t('plushlab.clickToUpload', language)}
                          </p>
                          <p className="text-xs text-gray-500">
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
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="petName" className="text-base font-semibold">
                        {t('plushlab.petName', language)}
                      </Label>
                      <Input
                        id="petName"
                        value={petName}
                        onChange={(e) => setPetName(e.target.value)}
                        placeholder={t('plushlab.petNamePlaceholder', language)}
                        className="mt-2"
                        data-testid="input-pet-name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="animationStyle" className="text-base font-semibold">
                        {t('plushlab.animationStyle', language)}
                      </Label>
                      <Select value={animationStyle} onValueChange={(value: any) => setAnimationStyle(value)}>
                        <SelectTrigger className="mt-2" data-testid="select-animation-style">
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
                      <Label htmlFor="ttsVoice" className="text-base font-semibold flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        {t('plushlab.voice', language)}
                      </Label>
                      <Select value={ttsVoice} onValueChange={setTtsVoice}>
                        <SelectTrigger className="mt-2" data-testid="select-tts-voice">
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
                <div className="mt-6">
                  <div className="mb-4 text-center">
                    <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center justify-center gap-2">
                      <Wand2 className="w-6 h-6 text-purple-600" />
                      {t('plushlab.premiumCustomization', language)}
                      <Star className="w-6 h-6 text-yellow-500" />
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
                
                <div className="mt-6">
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 text-lg"
                    disabled={createMutation.isPending}
                    data-testid="button-create-avatar"
                  >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          {t('plushlab.creating', language)}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          {t('plushlab.createAvatar', language)}
                        </>
                      )}
                    </Button>
                  </div>
              </form>
            </TabsContent>
            
            <TabsContent value="ai-presets">
              <div className="text-center py-12 space-y-6">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
                  <Wand2 className="w-12 h-12 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">
                    {t('plushlab.aiComingSoon', language)}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                    {t('plushlab.aiPresetsDescription', language)}
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mt-8">
                  {AVATAR_PRESETS.slice(0, 8).map((preset) => (
                    <div key={preset.id} className="relative group cursor-not-allowed opacity-60">
                      <div className="aspect-square bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-xs mt-2 text-center text-gray-600 dark:text-gray-400">
                        {language === 'he' ? preset.label_he : preset.label_en}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
            </CardContent>
          </Card>
          
          {/* Existing Avatars */}
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Settings className="w-6 h-6" />
              {t('plushlab.myAvatars', language)}
            </h2>
            
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : avatars.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {t('plushlab.noAvatarsYet', language)}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {avatars.map((avatar) => (
                  <Card key={avatar.id} className="overflow-hidden hover:shadow-xl transition-shadow" data-testid={`card-avatar-${avatar.id}`}>
                    <div className="relative aspect-square">
                      <img 
                        src={avatar.thumbnailUrl || avatar.photoUrl} 
                        alt={avatar.petName}
                        className="w-full h-full object-cover"
                      />
                      {avatar.isDefault && (
                        <Badge className="absolute top-2 right-2 bg-gradient-to-r from-yellow-500 to-orange-500">
                          <Star className="w-3 h-3 mr-1" />
                          {t('plushlab.default', language)}
                        </Badge>
                      )}
                      {avatar.status === 'processing' && (
                        <Badge className="absolute top-2 left-2 bg-blue-500">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          {t('plushlab.processing', language)}
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-lg mb-2">{avatar.petName}</h3>
                      <div className="flex gap-2 mb-3">
                        <Badge variant="outline">{avatar.animationProfile.style}</Badge>
                        <Badge variant="outline">{avatar.ttsVoice.includes('he-') ? '🇮🇱' : '🇺🇸'}</Badge>
                      </div>
                      <div className="flex gap-2">
                        {!avatar.isDefault && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => setDefaultMutation.mutate(avatar.id)}
                            disabled={setDefaultMutation.isPending}
                            data-testid={`button-set-default-${avatar.id}`}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            {t('plushlab.setDefault', language)}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(avatar.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${avatar.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('plushlab.areYouSure', language)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('plushlab.deleteConfirmation', language)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('plushlab.cancel', language)}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('plushlab.delete', language)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
