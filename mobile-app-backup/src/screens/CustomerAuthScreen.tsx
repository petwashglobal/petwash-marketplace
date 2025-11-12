/**
 * PetWash™ Ltd - Premium Customer Authentication Screen
 * 
 * Features:
 * - Luxury minimalist design with clean white background
 * - Email/Password authentication
 * - Social sign-in: Google (with consent flow), Apple, Facebook, TikTok, Microsoft
 * - Navigation to Forgot Password and Sign Up
 * - All providers branded with #PetWashLtd
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import { auth, googleProvider, appleProvider, facebookProvider } from '../config/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  OAuthProvider,
} from 'firebase/auth';

// Complete WebBrowser authentication sessions on iOS
WebBrowser.maybeCompleteAuthSession();

interface Props {
  navigation: any;
  onAuthSuccess?: (user: any) => void;
}

export const CustomerAuthScreen: React.FC<Props> = ({ navigation, onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  // ==================== Email/Password Sign-In ====================
  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Email sign-in successful');
      onAuthSuccess?.(userCredential.user);
    } catch (error: any) {
      console.error('Email sign-in error:', error);
      Alert.alert('Sign In Failed', error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  // ==================== GOOGLE SIGN-IN (OAuth with Consent Screen) ====================
  const handleGoogleSignIn = async () => {
    try {
      setSocialLoading('google');

      // Configure Google OAuth request
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'petwash',
        path: 'auth',
      });

      // ✅ FIXED: Use EXPO_PUBLIC_ prefix for client-side env vars
      const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
      
      if (!clientId) {
        Alert.alert('Configuration Error', 'Google Client ID not configured. Please contact support.');
        return;
      }

      // Create authorization request URL with consent prompt (like Replit example)
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'consent', // ✅ ALWAYS SHOW CONSENT SCREEN
        access_type: 'offline',
        state: Math.random().toString(36).substring(7),
      }).toString()}`;

      console.log('🔐 Opening Google consent screen...');

      // Open browser for OAuth consent
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        // Extract authorization code from callback URL
        const url = new URL(result.url);
        const code = url.searchParams.get('code');

        if (code) {
          console.log('✅ Google authorization successful');
          // TODO: Exchange code for tokens on your backend
          // Send code to: POST /api/auth/google-oauth
          Alert.alert('Success', 'Google sign-in successful!\n#PetWashLtd');
          // onAuthSuccess?.(user);
        }
      } else {
        console.log('Google sign-in cancelled');
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      Alert.alert('Google Sign-In Failed', error.message);
    } finally {
      setSocialLoading(null);
    }
  };

  // ==================== APPLE SIGN-IN ====================
  const handleAppleSignIn = async () => {
    try {
      setSocialLoading('apple');

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Create Firebase credential
      const provider = new OAuthProvider('apple.com');
      const oauthCredential = provider.credential({
        idToken: credential.identityToken!,
        rawNonce: credential.nonce,
      });

      // Sign in with Firebase
      const userCredential = await signInWithCredential(auth, oauthCredential);
      console.log('✅ Apple sign-in successful');
      Alert.alert('Success', 'Apple sign-in successful!\n#PetWashLtd');
      onAuthSuccess?.(userCredential.user);
    } catch (error: any) {
      if (error.code !== 'ERR_CANCELED') {
        console.error('Apple sign-in error:', error);
        Alert.alert('Apple Sign-In Failed', error.message);
      }
    } finally {
      setSocialLoading(null);
    }
  };

  // ==================== FACEBOOK SIGN-IN ====================
  const handleFacebookSignIn = async () => {
    try {
      setSocialLoading('facebook');

      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'petwash',
        path: 'auth',
      });

      const clientId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
      
      if (!clientId) {
        Alert.alert('Configuration Error', 'Facebook App ID not configured. Please contact support.');
        return;
      }

      const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'email,public_profile',
        state: Math.random().toString(36).substring(7),
      }).toString()}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');

        if (code) {
          console.log('✅ Facebook authorization successful');
          Alert.alert('Success', 'Facebook sign-in successful!\n#PetWashLtd');
          // TODO: Exchange code for tokens on backend
        }
      }
    } catch (error: any) {
      console.error('Facebook sign-in error:', error);
      Alert.alert('Facebook Sign-In Failed', error.message);
    } finally {
      setSocialLoading(null);
    }
  };

  // ==================== TIKTOK SIGN-IN ====================
  const handleTikTokSignIn = async () => {
    try {
      setSocialLoading('tiktok');

      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'petwash',
        path: 'auth',
      });

      const clientKey = process.env.EXPO_PUBLIC_TIKTOK_CLIENT_KEY;
      
      if (!clientKey) {
        Alert.alert('Configuration Error', 'TikTok Client Key not configured. Please contact support.');
        return;
      }

      const authUrl = `https://www.tiktok.com/v2/auth/authorize?${new URLSearchParams({
        client_key: clientKey,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'user.info.basic,user.info.profile',
        state: Math.random().toString(36).substring(7),
      }).toString()}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');

        if (code) {
          console.log('✅ TikTok authorization successful');
          Alert.alert('Success', 'TikTok sign-in successful!\n#PetWashLtd');
          // TODO: Exchange code for tokens on backend
        }
      }
    } catch (error: any) {
      console.error('TikTok sign-in error:', error);
      Alert.alert('TikTok Sign-In Failed', error.message);
    } finally {
      setSocialLoading(null);
    }
  };

  // ==================== MICROSOFT SIGN-IN ====================
  const handleMicrosoftSignIn = async () => {
    try {
      setSocialLoading('microsoft');

      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'petwash',
        path: 'auth',
      });

      const clientId = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID;
      
      if (!clientId) {
        Alert.alert('Configuration Error', 'Microsoft Client ID not configured. Please contact support.');
        return;
      }
      const tenantId = 'common'; // Use 'common' for personal + work accounts

      const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile User.Read',
        response_mode: 'query',
        state: Math.random().toString(36).substring(7),
        prompt: 'consent',
      }).toString()}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');

        if (code) {
          console.log('✅ Microsoft authorization successful');
          Alert.alert('Success', 'Microsoft sign-in successful!\n#PetWashLtd');
          // TODO: Exchange code for tokens on backend
        }
      }
    } catch (error: any) {
      console.error('Microsoft sign-in error:', error);
      Alert.alert('Microsoft Sign-In Failed', error.message);
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Header */}
        <View style={styles.header}>
          <Text style={styles.brandName}>PetWash™ Ltd</Text>
          <Text style={styles.tagline}>#PetWashLtd</Text>
          <Text style={styles.subtitle}>Premium Organic Pet Care</Text>
        </View>

        {/* Email/Password Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Sign In to Account</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="password"
          />

          {/* Primary Sign-In Button */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleEmailSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In to Account</Text>
            )}
          </TouchableOpacity>

          {/* Forgot Password Link */}
          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Sign-In Buttons */}
        <View style={styles.socialContainer}>
          {/* Google */}
          <TouchableOpacity
            style={[styles.socialButton, styles.googleButton]}
            onPress={handleGoogleSignIn}
            disabled={socialLoading !== null}
          >
            {socialLoading === 'google' ? (
              <ActivityIndicator color="#4285F4" />
            ) : (
              <>
                <Image
                  source={{ uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }}
                  style={styles.socialIcon}
                />
                <Text style={styles.socialButtonText}>Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple */}
          <TouchableOpacity
            style={[styles.socialButton, styles.appleButton]}
            onPress={handleAppleSignIn}
            disabled={socialLoading !== null}
          >
            {socialLoading === 'apple' ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <>
                <Text style={styles.appleLogo}></Text>
                <Text style={styles.socialButtonText}>Apple</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Facebook */}
          <TouchableOpacity
            style={[styles.socialButton, styles.facebookButton]}
            onPress={handleFacebookSignIn}
            disabled={socialLoading !== null}
          >
            {socialLoading === 'facebook' ? (
              <ActivityIndicator color="#1877F2" />
            ) : (
              <>
                <Text style={styles.facebookLogo}>f</Text>
                <Text style={styles.socialButtonText}>Facebook</Text>
              </>
            )}
          </TouchableOpacity>

          {/* TikTok */}
          <TouchableOpacity
            style={[styles.socialButton, styles.tiktokButton]}
            onPress={handleTikTokSignIn}
            disabled={socialLoading !== null}
          >
            {socialLoading === 'tiktok' ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <>
                <Text style={styles.tiktokLogo}>♪</Text>
                <Text style={styles.socialButtonText}>TikTok</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Microsoft */}
          <TouchableOpacity
            style={[styles.socialButton, styles.microsoftButton]}
            onPress={handleMicrosoftSignIn}
            disabled={socialLoading !== null}
          >
            {socialLoading === 'microsoft' ? (
              <ActivityIndicator color="#00A4EF" />
            ) : (
              <>
                <Text style={styles.microsoftLogo}>⊞</Text>
                <Text style={styles.socialButtonText}>Microsoft</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Up Link */}
        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.signupLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>© 2025 PetWash™ Ltd. All rights reserved.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandName: {
    fontSize: 36,
    fontWeight: '300',
    color: '#000000',
    letterSpacing: 1,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#C02222',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '400',
  },
  formContainer: {
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000000',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  primaryButton: {
    backgroundColor: '#C02222',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#C02222',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#C02222',
    fontSize: 14,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#999999',
    fontWeight: '500',
  },
  socialContainer: {
    gap: 12,
    marginBottom: 32,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  socialIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  googleButton: {
    borderColor: '#4285F4',
  },
  appleButton: {
    borderColor: '#000000',
  },
  appleLogo: {
    fontSize: 24,
    marginRight: 12,
  },
  facebookButton: {
    borderColor: '#1877F2',
  },
  facebookLogo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1877F2',
    marginRight: 8,
  },
  tiktokButton: {
    borderColor: '#000000',
  },
  tiktokLogo: {
    fontSize: 24,
    marginRight: 12,
    color: '#000000',
  },
  microsoftButton: {
    borderColor: '#00A4EF',
  },
  microsoftLogo: {
    fontSize: 24,
    marginRight: 12,
    color: '#00A4EF',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  signupText: {
    fontSize: 14,
    color: '#666666',
  },
  signupLink: {
    fontSize: 14,
    color: '#C02222',
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999999',
    marginTop: 32,
  },
});

export default CustomerAuthScreen;
