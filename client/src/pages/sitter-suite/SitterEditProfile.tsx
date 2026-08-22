import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/languageStore";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { GooglePlacesAutocomplete } from "@/components/ui/google-places-autocomplete";
import { CityPicker, type CityPickerSelection } from "@/components/location/CityPicker";
import {
  ArrowLeft, Building2, Camera, Save, User, MapPin, Phone,
  DollarSign, Star, Shield, Loader2, Check
} from "lucide-react";

interface SitterProfile {
  id: number;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  bio: string;
  yearsOfExperience: number;
  pricePerDayCents: number;
  profilePictureUrl: string | null;
  rating: string;
  isActive: boolean;
  isVerified: boolean;
}

export default function SitterEditProfile() {
  const { language } = useLanguage();
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isHebrew = language === 'he';
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // queryKey drop fix: default queryFn used queryKey[0] verbatim (list
  // endpoint), returning ALL sitters instead of the caller's own profile —
  // the edit form then bound to whichever sitter came first. Explicit
  // queryFn hits the by-uid detail route.
  const { data: profile, isLoading } = useQuery<SitterProfile>({
    queryKey: ['/api/sitter-suite/sitters', user?.uid],
    enabled: !!user?.uid,
    queryFn: async () => {
      const res = await fetch(`/api/sitter-suite/sitters/${user!.uid}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load sitter profile: ${res.status}`);
      return res.json();
    },
  });

  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    bio: '',
    yearsOfExperience: 0,
    pricePerDayCents: 0,
    latitude: null as number | null,
    longitude: null as number | null,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        phone: profile.phone || '',
        city: profile.city || '',
        bio: profile.bio || '',
        yearsOfExperience: profile.yearsOfExperience || 0,
        pricePerDayCents: profile.pricePerDayCents || 0,
        latitude: profile.latitude ? parseFloat(String(profile.latitude)) : null,
        longitude: profile.longitude ? parseFloat(String(profile.longitude)) : null,
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<SitterProfile>) => {
      const response = await apiRequest('PATCH', `/api/sitter-suite/sitters/${profile?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sitter-suite/sitters'] });
      toast({
        title: isHebrew ? 'הפרופיל עודכן בהצלחה' : 'Profile Updated',
        description: isHebrew ? 'השינויים נשמרו' : 'Your changes have been saved',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew ? 'לא ניתן לעדכן את הפרופיל' : 'Failed to update profile',
      });
    }
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: isHebrew ? 'קובץ גדול מדי' : 'File Too Large',
          description: isHebrew ? 'גודל הקובץ המקסימלי הוא 5MB' : 'Maximum file size is 5MB',
        });
        return;
      }
      
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setProfilePhoto(base64);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const updateData: Record<string, any> = { ...formData };
    if (profilePhoto) {
      updateData.profilePictureUrl = profilePhoto;
    }
    updateMutation.mutate(updateData);
  };

  const t = {
    title: isHebrew ? 'עריכת פרופיל' : 'Edit Profile',
    back: isHebrew ? 'חזרה' : 'Back',
    profilePhoto: isHebrew ? 'תמונת פרופיל' : 'Profile Photo',
    changePhoto: isHebrew ? 'שנה תמונה' : 'Change Photo',
    uploadPhoto: isHebrew ? 'העלה תמונה' : 'Upload Photo',
    firstName: isHebrew ? 'שם פרטי' : 'First Name',
    lastName: isHebrew ? 'שם משפחה' : 'Last Name',
    phone: isHebrew ? 'טלפון' : 'Phone',
    city: isHebrew ? 'עיר' : 'City',
    bio: isHebrew ? 'קצת עליי' : 'About Me',
    bioPlaceholder: isHebrew ? 'ספרו על עצמכם ועל הניסיון שלכם עם חיות מחמד...' : 'Tell us about yourself and your experience with pets...',
    experience: isHebrew ? 'שנות ניסיון' : 'Years of Experience',
    pricePerDay: isHebrew ? 'מחיר ליום (בשקלים)' : 'Price per Day (ILS)',
    save: isHebrew ? 'שמור שינויים' : 'Save Changes',
    saving: isHebrew ? 'שומר...' : 'Saving...',
    photoTip: isHebrew ? 'תמונה איכותית מגדילה את הסיכוי לקבל הזמנות' : 'A quality photo increases your chances of getting bookings',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-12 w-12 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  const currentPhoto = profilePhoto || profile?.profilePictureUrl;

  return (
    <div className={`min-h-screen bg-white ${(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}`}>
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-white/80 backdrop-blur-xl border-b border-[#D4AF37]/20 dark:border-zinc-900/30">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => setLocation('/sitter-suite/sitter/dashboard')}
              className="p-2 hover:bg-[#D4AF37]/10 dark:hover:bg-zinc-900/30 rounded-xl transition-all"
            >
              <ArrowLeft className="h-6 w-6 text-[#D4AF37]" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#B8932F] bg-clip-text text-transparent">
              {t.title}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="relative bg-gradient-to-r from-[#D4AF37] via-[#C9A536] to-[#D4AF37] p-8">
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37] to-[#B8932F] rounded-full blur-lg opacity-75 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative h-32 w-32 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-white">
                  {currentPhoto ? (
                    <img 
                      src={currentPhoto} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#D4AF37]/10 to-[#D4AF37]/10">
                      <User className="h-16 w-16 text-[#D4AF37]" />
                    </div>
                  )}
                  
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  )}
                </div>
                
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-3 bg-white dark:bg-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 border-2 border-[#D4AF37]/20"
                  disabled={isUploading}
                >
                  <Camera className="h-5 w-5 text-[#D4AF37]" />
                </Button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
              
              <p className="mt-4 text-white/90 text-sm text-center max-w-xs">
                {t.photoTip}
              </p>
              
              {profile?.isVerified && (
                <div className="mt-3 flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                  <Shield className="h-4 w-4 text-white" />
                  <span className="text-white text-sm font-medium">
                    {isHebrew ? 'שמרטף מאומת' : 'Verified Sitter'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-gray-700 dark:text-black font-medium">
                  {t.firstName}
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName || profile?.firstName || ''}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="h-12 rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/40 focus:ring-[#D4AF37]"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-gray-700 dark:text-black font-medium">
                  {t.lastName}
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName || profile?.lastName || ''}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="h-12 rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/40 focus:ring-[#D4AF37]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-gray-700 dark:text-black font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {t.phone}
                </Label>
                <Input
                  id="phone"
                  value={formData.phone || profile?.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-12 rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/40 focus:ring-[#D4AF37]"
                  dir="ltr"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="city" className="text-gray-700 dark:text-black font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {t.city}
                </Label>
                <button
                  type="button"
                  onClick={() => setCityPickerOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50/60 text-sm text-amber-900 hover:bg-amber-50"
                  data-testid="sitter-city-picker-open"
                >
                  <Building2 className="w-4 h-4 shrink-0 text-amber-500" />
                  <span className={`flex-1 text-right truncate ${!(formData.city || profile?.city) ? 'text-amber-500' : ''}`}>
                    {(formData.city || profile?.city) || (isHebrew ? 'בחר עיר מהרשימה' : 'Choose a city from the list')}
                  </span>
                  <span className="text-xs text-amber-500">▾</span>
                </button>
                <GooglePlacesAutocomplete
                  value={formData.city || profile?.city || ''}
                  onChange={(value, details) => {
                    const cityName = details?.city || value;
                    const lat = details?.lat ?? null;
                    const lng = details?.lng ?? null;
                    setFormData(prev => ({
                      ...prev,
                      city: cityName,
                      latitude: lat,
                      longitude: lng,
                    }));
                  }}
                  placeholder={isHebrew ? 'או חפש עיר עם מפה...' : 'Or search with the map...'}
                  country={['il']}
                  inputClassName="h-12 rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/40"
                />
                <CityPicker
                  open={cityPickerOpen}
                  onOpenChange={setCityPickerOpen}
                  value={null}
                  language={isHebrew ? 'he' : 'en'}
                  onChange={(sel: CityPickerSelection) => {
                    const displayCity = isHebrew ? sel.hebrewName : (sel.englishName || sel.hebrewName);
                    setFormData(prev => ({ ...prev, city: displayCity }));
                    setCityPickerOpen(false);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-gray-700 dark:text-black font-medium">
                {t.bio}
              </Label>
              <Textarea
                id="bio"
                value={formData.bio || profile?.bio || ''}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder={t.bioPlaceholder}
                className="min-h-[120px] rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/40 focus:ring-[#D4AF37] resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="experience" className="text-gray-700 dark:text-black font-medium flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  {t.experience}
                </Label>
                <Input
                  id="experience"
                  type="number"
                  min="0"
                  max="50"
                  value={formData.yearsOfExperience || profile?.yearsOfExperience || 0}
                  onChange={(e) => setFormData({ ...formData, yearsOfExperience: parseInt(e.target.value) || 0 })}
                  className="h-12 rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/40 focus:ring-[#D4AF37]"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="price" className="text-gray-700 dark:text-black font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {t.pricePerDay}
                </Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  value={Math.round((formData.pricePerDayCents || profile?.pricePerDayCents || 0) / 100)}
                  onChange={(e) => setFormData({ ...formData, pricePerDayCents: (parseInt(e.target.value) || 0) * 100 })}
                  className="h-12 rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/40 focus:ring-[#D4AF37]"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-[#D4AF37]/20 dark:border-zinc-900/30">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-[#D4AF37] via-[#C9A536] to-[#D4AF37] hover:from-[#D4AF37] hover:via-[#C9A536] hover:to-[#B8932F] rounded-2xl shadow-lg hover:shadow-xl transition-all"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    {t.saving}
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    {t.save}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
