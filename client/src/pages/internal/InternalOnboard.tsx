import { useState, useEffect } from "react";
import { PhoneInput } from "@/components/PhoneInput";
import { useLocation } from "wouter";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { getApiUrl } from "@/lib/apiConfig";
import { Layout } from "@/components/Layout";
import { type Language, t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Lock, Mail, User, Phone, Building2, AlertTriangle } from "lucide-react";

interface InvitationData {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  roleCode: string;
  department: string | null;
}

const roleTitles: Record<string, { en: string; he: string }> = {
  'STAFF': { en: 'Staff Member', he: 'חבר צוות' },
  'CONTRACTOR': { en: 'Service Provider', he: 'נותן שירות' },
  'FRANCHISEE': { en: 'Franchise Partner', he: 'שותף זיכיון' },
  'MANAGER': { en: 'Manager', he: 'מנהל' },
  'DRIVER': { en: 'Driver', he: 'נהג' },
  'SITTER': { en: 'Pet Sitter', he: 'פטסיטר' },
  'WALKER': { en: 'Dog Walker', he: 'מטייל כלבים' }
};

export default function InternalOnboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [language] = useState<Language>('he');
  
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    
    if (!tokenParam) {
      setError('קישור ההזמנה אינו תקין');
      setLoading(false);
      return;
    }
    
    setToken(tokenParam);
    verifyToken(tokenParam);
  }, []);
  
  const verifyToken = async (inviteToken: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/internal/invitations/verify/${inviteToken}`));
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        const errorMessages: Record<string, string> = {
          'Invitation not found': 'ההזמנה לא נמצאה',
          'Invitation already used': 'ההזמנה כבר נוצלה',
          'Invitation expired': 'ההזמנה פגה תוקף',
          'Invitation revoked': 'ההזמנה בוטלה'
        };
        setError(errorMessages[data.error] || data.error || 'שגיאה באימות ההזמנה');
        setLoading(false);
        return;
      }
      
      setInvitation(data.invitation);
      setFormData(prev => ({
        ...prev,
        firstName: data.invitation.firstName || '',
        lastName: data.invitation.lastName || '',
        phone: data.invitation.phone || ''
      }));
      setLoading(false);
    } catch (err) {
      console.error('Token verification error:', err);
      setError('שגיאה בטעינת ההזמנה');
      setLoading(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invitation || !token) return;
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "שגיאה",
        description: "הסיסמאות אינן תואמות"
      });
      return;
    }
    
    if (formData.password.length < 8) {
      toast({
        variant: "destructive",
        title: "שגיאה",
        description: "הסיסמה חייבת להכיל לפחות 8 תווים"
      });
      return;
    }
    
    setSubmitting(true);
    
    try {
      let user;
      
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          invitation.email,
          formData.password
        );
        user = userCredential.user;
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          const signInCredential = await signInWithEmailAndPassword(
            auth,
            invitation.email,
            formData.password
          );
          user = signInCredential.user;
        } else {
          throw authError;
        }
      }
      
      await updateProfile(user, {
        displayName: `${formData.firstName} ${formData.lastName}`.trim()
      });
      
      const idToken = await user.getIdToken();
      
      const acceptResponse = await fetch(getApiUrl('/api/internal/invitations/accept'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          token,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone
        })
      });
      
      const acceptData = await acceptResponse.json();
      
      if (!acceptResponse.ok || !acceptData.success) {
        throw new Error(acceptData.error || 'Failed to accept invitation');
      }
      
      toast({
        title: "ברוכים הבאים!",
        description: `הצטרפת בהצלחה לצוות ⁦Pet Wash™⁩ כ${roleTitles[invitation.roleCode]?.he || invitation.roleCode}`
      });
      
      await user.getIdToken(true);
      
      setLocation('/admin/dashboard');
      
    } catch (err: any) {
      console.error('Onboarding error:', err);
      
      const errorMessages: Record<string, string> = {
        'auth/weak-password': 'הסיסמה חלשה מדי',
        'auth/invalid-email': 'כתובת דוא"ל אינה תקינה',
        'auth/wrong-password': 'סיסמה שגויה'
      };
      
      toast({
        variant: "destructive",
        title: "שגיאה",
        description: errorMessages[err.code] || err.message || 'אירעה שגיאה'
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <Layout language={language} setLanguage={() => {}}>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-black dark:text-black" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">מאמת הזמנה...</p>
          </div>
        </div>
      </Layout>
    );
  }
  
  if (error) {
    return (
      <Layout language={language} setLanguage={() => {}}>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black px-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-white rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-xl">ההזמנה אינה זמינה</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-gray-500 mb-4">
                אם אתה מאמין שזו טעות, פנה למנהל שלך לקבלת הזמנה חדשה.
              </p>
              <Button variant="outline" onClick={() => setLocation('/')}>
                חזרה לדף הבית
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout language={language} setLanguage={() => {}}>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black py-12 px-4" dir="rtl">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Shield className="h-4 w-4" />
              הרשמה פנימית
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-black mb-2">
              ברוכים הבאים לצוות ⁦Pet Wash™⁩
            </h1>
            {invitation && (
              <p className="text-gray-600 dark:text-gray-400">
                הוזמנת להצטרף כ
                <span className="font-semibold text-black dark:text-black mx-1">
                  {roleTitles[invitation.roleCode]?.he || invitation.roleCode}
                </span>
                {invitation.department && (
                  <span>במחלקת {invitation.department}</span>
                )}
              </p>
            )}
          </div>
          
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                השלם את ההרשמה
              </CardTitle>
              <CardDescription>
                מלא את הפרטים שלך ליצירת חשבון
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="bg-white dark:bg-white/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Mail className="h-4 w-4" />
                    <span>כתובת דוא"ל:</span>
                    <span className="font-medium text-gray-900 dark:text-black">
                      {invitation?.email}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">שם פרטי</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      required
                      data-testid="input-firstName"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">שם משפחה</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      required
                      data-testid="input-lastName"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    מספר טלפון
                  </Label>
                  <PhoneInput value={formData.phone} onChange={(val) => setFormData(prev => ({ ...prev, phone: val || '' }))} defaultCountry="IL" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    סיסמה
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="לפחות 8 תווים"
                    required
                    minLength={8}
                    dir="ltr"
                    data-testid="input-password"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">אימות סיסמה</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="הזן שוב את הסיסמה"
                    required
                    minLength={8}
                    dir="ltr"
                    data-testid="input-confirmPassword"
                  />
                </div>
                
                <Button
                  type="submit"
                  className="w-full bg-black hover:bg-gray-800 text-white py-6 text-lg"
                  disabled={submitting}
                  data-testid="button-completeOnboarding"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin ml-2" />
                      יוצר חשבון...
                    </>
                  ) : (
                    <>
                      <User className="h-5 w-5 ml-2" />
                      השלם הרשמה
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-gray-500 text-center mt-4">
                  בהשלמת ההרשמה אתה מאשר את תנאי השימוש ומדיניות הפרטיות של ⁦Pet Wash™⁩
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
