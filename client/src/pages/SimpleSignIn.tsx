import { useState } from 'react';
import { useSimpleAuth } from '@/hooks/useSimpleAuth';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { type Language, t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, Phone } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Checkbox } from '@/components/ui/checkbox';

interface SimpleSignInProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

export default function SimpleSignIn({ language, onLanguageChange }: SimpleSignInProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { login, signup } = useSimpleAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    termsAccepted: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signin') {
        await login(formData.email, formData.password);
        toast({
          title: t('simpleSignIn.signedInSuccess', language),
          description: t('simpleSignIn.welcomeBack', language),
        });
        navigate('/dashboard');
      } else {
        if (!formData.termsAccepted) {
          toast({
            variant: 'destructive',
            title: t('simpleSignIn.mustAcceptTerms', language),
          });
          return;
        }
        await signup(formData);
        toast({
          title: t('simpleSignIn.accountCreated', language),
          description: t('simpleSignIn.welcomeToPetWash', language),
        });
        navigate('/dashboard');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('simpleSignIn.error', language),
        description: error instanceof Error ? error.message : 'Something went wrong',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header language={language} onLanguageChange={onLanguageChange} />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
            {/* Logo */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {mode === 'signin' 
                  ? t('simpleSignIn.signIn', language)
                  : t('simpleSignIn.signUp', language)
                }
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {mode === 'signin'
                  ? t('simpleSignIn.welcomeBackToPetWash', language)
                  : t('simpleSignIn.createAccount', language)
                }
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {mode === 'signup' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium">
                        {t('simpleSignIn.firstName', language)}
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="firstName"
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          className="pl-10"
                          required
                          data-testid="input-firstName"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium">
                        {t('simpleSignIn.lastName', language)}
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="lastName"
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="pl-10"
                          required
                          data-testid="input-lastName"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">
                      {t('simpleSignIn.phoneOptional', language)}
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="pl-10"
                        data-testid="input-phone"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  {t('simpleSignIn.email', language)}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10"
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  {t('simpleSignIn.password', language)}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10"
                    required
                    minLength={8}
                    data-testid="input-password"
                  />
                </div>
                {mode === 'signup' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('simpleSignIn.atLeast8Chars', language)}
                  </p>
                )}
              </div>

              {mode === 'signup' && (
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <Checkbox
                    id="terms"
                    checked={formData.termsAccepted}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, termsAccepted: checked as boolean })
                    }
                    data-testid="checkbox-terms"
                  />
                  <label
                    htmlFor="terms"
                    className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
                  >
                    {t('simpleSignIn.iAcceptThe', language)}{' '}
                    <Link href="/terms" className="text-purple-600 hover:underline">
                      {t('simpleSignIn.termsAndConditions', language)}
                    </Link>
                  </label>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="button-submit"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'signin'
                  ? t('simpleSignIn.signInButton', language)
                  : t('simpleSignIn.signUpButton', language)
                }
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-sm text-purple-600 hover:underline"
                data-testid="button-toggle-mode"
              >
                {mode === 'signin'
                  ? t('simpleSignIn.noAccountSignUp', language)
                  : t('simpleSignIn.haveAccountSignIn', language)
                }
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer language={language} />
    </div>
  );
}
