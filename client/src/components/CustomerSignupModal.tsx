import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { t, type Language } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Shield, Mail, Phone, User, Calendar, Globe, Eye, EyeOff, Apple, Chrome, Facebook, Sparkles, Crown, Star } from 'lucide-react';

interface CustomerSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

interface SignupFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  country: string;
  gender?: string;
  profilePicture?: File;
  petType?: string;
  loyaltyProgram: boolean;
  reminders: boolean;
  marketing: boolean;
  termsAccepted: boolean;
}

export function CustomerSignupModal({ isOpen, onClose, language }: CustomerSignupModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<'method' | 'form' | 'verification'>('method');
  const [signupMethod, setSignupMethod] = useState<'email' | 'phone' | 'google' | 'apple' | 'facebook'>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState<SignupFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    country: 'Israel',
    gender: '',
    petType: '',
    loyaltyProgram: true, // Pre-checked (legally allowed)
    reminders: true, // Pre-checked (legally allowed)
    marketing: false, // Not pre-checked (privacy law compliant)
    termsAccepted: false // Not pre-checked (privacy law compliant)
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormData) => {
      const response = await apiRequest('POST', '/api/customer/register', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('customerSignup.registrationSuccessful', language),
        description: t('customerSignup.welcomeToPetWash', language),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: t('customerSignup.registrationFailed', language),
        description: error.message || t('customerSignup.errorOccurred', language),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.termsAccepted) {
      toast({
        title: t('customerSignup.pleaseAcceptTerms', language),
        description: t('customerSignup.mustAcceptTerms', language),
        variant: 'destructive',
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: t('customerSignup.passwordsDontMatch', language),
        description: t('customerSignup.passwordsMismatch', language),
        variant: 'destructive',
      });
      return;
    }

    signupMutation.mutate(formData);
  };

  const updateFormData = (field: keyof SignupFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const countries = [
    'Israel', 'United States', 'United Kingdom', 'Canada', 'Australia', 
    'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Sweden', 'Norway'
  ];

  if (step === 'method') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg mx-auto bg-gradient-to-br from-slate-50 via-white to-blue-50 rounded-3xl border-0 shadow-2xl backdrop-blur-sm overflow-hidden sm:max-w-md md:max-w-lg" style={{ zIndex: 1000 }}>
          {/* Luxury Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-purple-600/5" style={{ pointerEvents: 'none' }}></div>
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full blur-xl" style={{ pointerEvents: 'none' }}></div>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-400/20 to-transparent rounded-full blur-xl" style={{ pointerEvents: 'none' }}></div>
          
          <div className="relative z-10">
            <DialogHeader className="text-center pb-8 pt-6">
              {/* Premium Icon with Glow Effect */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 rounded-full flex items-center justify-center shadow-2xl">
                    <Crown className="h-10 w-10 text-white drop-shadow-lg" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                </div>
              </div>
              
              <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-blue-900 via-purple-900 to-blue-900 bg-clip-text text-transparent mb-2">
                {t('customerSignup.joinPetWash', language)}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {t('customerSignup.chooseSignupMethod', language)}
              </DialogDescription>
              <div className="flex items-center justify-center gap-2 mb-3">
                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                <span className="text-sm font-medium text-gray-700">
                  {t('customerSignup.premiumMembership', language)}
                </span>
                <Star className="h-4 w-4 text-yellow-500 fill-current" />
              </div>
              <p className="text-gray-600 text-base">
                {t('customerSignup.chooseSignupMethod', language)}
              </p>
            </DialogHeader>

            <div className="space-y-4 px-2">
              {/* Premium Email Signup */}
              <Button
                onClick={() => {
                  setSignupMethod('email');
                  setStep('form');
                }}
                className="w-full h-14 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 hover:from-blue-700 hover:via-blue-800 hover:to-blue-900 text-white rounded-2xl flex items-center justify-center gap-4 shadow-xl transform hover:scale-[1.02] transition-all duration-300 font-semibold text-lg"
              >
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Mail className="h-5 w-5" />
                </div>
                {t('customerSignup.continueWithEmail', language)}
              </Button>

              {/* Premium Phone Signup */}
              <Button
                onClick={() => {
                  setSignupMethod('phone');
                  setStep('form');
                }}
                className="w-full h-14 bg-gradient-to-r from-emerald-600 via-green-700 to-teal-700 hover:from-emerald-700 hover:via-green-800 hover:to-teal-800 text-white rounded-2xl flex items-center justify-center gap-4 shadow-xl transform hover:scale-[1.02] transition-all duration-300 font-semibold text-lg"
              >
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Phone className="h-5 w-5" />
                </div>
                {t('customerSignup.continueWithPhone', language)}
              </Button>

              {/* Luxury Divider */}
              <div className="flex items-center justify-center py-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                <span className="px-4 text-sm text-gray-500 font-medium">
                  {t('customerSignup.orDivider', language)}
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              </div>

              {/* Premium Social Login Options */}
              <div className="grid grid-cols-3 gap-4">
                <Button
                  onClick={() => {
                    setSignupMethod('google');
                    setStep('form');
                  }}
                  variant="outline"
                  className="h-14 rounded-2xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  <Chrome className="h-6 w-6 text-blue-600" />
                </Button>
                
                <Button
                  onClick={() => {
                    setSignupMethod('apple');
                    setStep('form');
                  }}
                  variant="outline"
                  className="h-14 rounded-2xl border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  <Apple className="h-6 w-6 text-gray-900" />
                </Button>
                
                <Button
                  onClick={() => {
                    setSignupMethod('facebook');
                    setStep('form');
                  }}
                  variant="outline"
                  className="h-14 rounded-2xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  <Facebook className="h-6 w-6 text-blue-600" />
                </Button>
              </div>
            </div>

            {/* Premium Footer */}
            <div className="text-center pt-6 pb-2" style={{ position: 'relative', zIndex: 1000 }}>
              <p className="text-sm text-gray-600">
                {language === 'he' 
                  ? 'כבר יש לך חשבון? ' 
                  : 'Already have an account? '}
                <button 
                  className="text-blue-700 font-semibold hover:text-blue-800 transition-colors duration-200 relative z-10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                    setTimeout(() => {
                      setLocation('/signin');
                    }, 100);
                  }}
                  data-testid="button-signin-from-modal"
                  style={{ pointerEvents: 'auto' }}
                >
                  {t('customerSignup.signInHere', language)}
                </button>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl mx-auto bg-gradient-to-br from-slate-50 via-white to-blue-50 rounded-3xl border-0 shadow-2xl max-h-[95vh] overflow-y-auto sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
        {/* Luxury Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/3 via-transparent to-purple-600/3 rounded-3xl"></div>
        <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-blue-400/10 to-transparent rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/10 to-transparent rounded-full blur-xl"></div>
        
        <div className="relative z-10">
          <DialogHeader className="text-center pb-8 pt-6">
            {/* Premium Header with Glow */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 rounded-full flex items-center justify-center shadow-2xl">
                  <User className="h-12 w-12 text-white drop-shadow-lg" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
                  <Crown className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
            
            <DialogTitle className="text-4xl font-bold bg-gradient-to-r from-blue-900 via-purple-900 to-blue-900 bg-clip-text text-transparent mb-3">
              {t('customerSignup.createPremiumAccount', language)}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {language === 'he' 
                ? 'הצטרף לקהילת הלקוחות המובחרים שלנו ותיהנה מהטבות בלעדיות' 
                : 'Join our exclusive community and enjoy premium benefits'}
            </DialogDescription>
            
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                ))}
              </div>
              <span className="text-lg font-semibold text-gray-700">
                {t('customerSignup.luxuryExperience', language)}
              </span>
            </div>
            
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              {language === 'he' 
                ? 'הצטרף לקהילת הלקוחות המובחרים שלנו ותיהנה מהטבות בלעדיות' 
                : 'Join our exclusive community and enjoy premium benefits'}
            </p>
          </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Premium Personal Information Card */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-2"></div>
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-900 to-purple-900 bg-clip-text text-transparent">
                  {t('customerSignup.personalInformation', language)}
                </h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="firstName">
                    {t('customerSignup.firstName', language)}
                  </Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => updateFormData('firstName', e.target.value)}
                    required
                    className="mt-2 h-12 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 bg-white/70 backdrop-blur-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">
                    {t('customerSignup.lastName', language)}
                  </Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => updateFormData('lastName', e.target.value)}
                    required
                    className="mt-2 h-12 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 bg-white/70 backdrop-blur-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 mb-4">
                <div>
                  <Label htmlFor="email">
                    {t('customerSignup.emailAddress', language)}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData('email', e.target.value)}
                    required
                    className="mt-2 h-12 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 bg-white/70 backdrop-blur-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">
                    {t('customerSignup.phoneNumberField', language)}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateFormData('phone', e.target.value)}
                    required
                    className="mt-2 h-12 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 bg-white/70 backdrop-blur-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="password">
                    {t('customerSignup.passwordField', language)}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => updateFormData('password', e.target.value)}
                      required
                      className="mt-2 h-12 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 bg-white/70 backdrop-blur-sm pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center hover:bg-gray-100 rounded-lg transition-colors duration-200"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirmPassword">
                    {t('customerSignup.confirmPassword', language)}
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                      required
                      className="mt-2 h-12 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 bg-white/70 backdrop-blur-sm pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center hover:bg-gray-100 rounded-lg transition-colors duration-200"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateOfBirth">
                    {t('customerSignup.dateOfBirth', language)}
                  </Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => updateFormData('dateOfBirth', e.target.value)}
                    className="mt-2 h-12 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 bg-white/70 backdrop-blur-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="country">
                    {t('customerSignup.country', language)}
                  </Label>
                  <Select value={formData.country} onValueChange={(value) => updateFormData('country', value)}>
                    <SelectTrigger className="mt-2 h-12 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 bg-white/70 backdrop-blur-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Premium Preferences Card */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 h-2"></div>
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-full flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-900 to-teal-900 bg-clip-text text-transparent">
                  {t('customerSignup.preferencesBenefits', language)}
                </h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="loyaltyProgram"
                    checked={formData.loyaltyProgram}
                    onCheckedChange={(checked) => updateFormData('loyaltyProgram', checked)}
                  />
                  <Label htmlFor="loyaltyProgram" className="text-sm">
                    {t('customerSignup.joinLoyaltyProgram', language)}
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="reminders"
                    checked={formData.reminders}
                    onCheckedChange={(checked) => updateFormData('reminders', checked)}
                  />
                  <Label htmlFor="reminders" className="text-sm">
                    {t('customerSignup.receiveWashReminders', language)}
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="marketing"
                    checked={formData.marketing}
                    onCheckedChange={(checked) => updateFormData('marketing', checked)}
                  />
                  <Label htmlFor="marketing" className="text-sm">
                    {t('customerSignup.receiveMarketingUpdates', language)}
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="termsAccepted"
                    checked={formData.termsAccepted}
                    onCheckedChange={(checked) => updateFormData('termsAccepted', checked)}
                  />
                  <Label htmlFor="termsAccepted" className="text-sm">
                    {t('customerSignup.agreeToTerms', language)}
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Premium Submit Button */}
          <div className="pt-4">
            <Button
              type="submit"
              disabled={signupMutation.isPending}
              className="w-full h-16 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white rounded-2xl text-xl font-bold shadow-2xl transform hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-3"
            >
              {signupMutation.isPending ? (
                <>
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {t('customerSignup.creatingPremiumAccount', language)}
                </>
              ) : (
                <>
                  <Crown className="h-6 w-6" />
                  {t('customerSignup.createAccountButton', language)}
                  <Sparkles className="h-5 w-5" />
                </>
              )}
            </Button>
            
            {/* Premium Benefits Footer */}
            <div className="mt-6 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <Shield className="h-4 w-4" />
                <span>
                  {t('customerSignup.secureMembership', language)}
                </span>
              </div>
            </div>
          </div>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}