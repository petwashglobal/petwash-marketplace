// Login Screen with Google Sign-In
// Uses your existing /api/mobile-auth/google endpoint

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import ReactNativeBiometrics from 'react-native-biometrics';
import { petWashApi } from '../api/petWashApi';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // From Google Cloud Console
  iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  offlineAccess: true,
  scopes: ['email', 'profile'],
});

interface Props {
  onLoginSuccess: (employee: any) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      // 1. Google Sign-In (YOUR IOS/ANDROID CODE PATTERN!)
      await GoogleSignin.hasPlayServices();
      const { idToken, serverAuthCode } = await GoogleSignin.signIn();

      if (!idToken || !serverAuthCode) {
        throw new Error('Failed to get authentication tokens');
      }

      console.log('✅ Received ID Token and Auth Code');

      // 2. Send to YOUR BACKEND! (YOUR ENDPOINT: /api/mobile-auth/google)
      const response = await petWashApi.signInWithGoogle(idToken, serverAuthCode);

      if (!response.success) {
        throw new Error(response.message || 'Authentication failed');
      }

      console.log('✅ Backend authentication successful');

      // 3. Sign into Firebase with custom token
      await auth().signInWithCustomToken(response.customToken);

      console.log('✅ Firebase authentication successful');

      // 4. Prompt for biometric setup if first time
      await promptBiometricSetup();

      // 5. Success!
      onLoginSuccess(response.user);
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.code === 'SIGN_IN_CANCELLED') {
        // User cancelled the login flow
        return;
      }

      Alert.alert(
        'Login Failed',
        error.message || 'Unable to sign in. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const promptBiometricSetup = async () => {
    try {
      const rnBiometrics = new ReactNativeBiometrics();
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();

      if (available) {
        const biometricName = biometryType === 'FaceID' 
          ? 'Face ID' 
          : biometryType === 'TouchID' 
          ? 'Touch ID' 
          : 'Biometric';

        Alert.alert(
          `Enable ${biometricName}`,
          `Use ${biometricName} for quick and secure access next time?`,
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Enable',
              onPress: async () => {
                // Create biometric keys
                await rnBiometrics.createKeys();
                Alert.alert('Success', `${biometricName} enabled!`);
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Biometric setup error:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoEmoji}>🐾</Text>
        <Text style={styles.logoText}>Pet Wash™</Text>
        <Text style={styles.subtitle}>Employee Hub</Text>
      </View>

      {/* Welcome Message */}
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeTitle}>Welcome Back</Text>
        <Text style={styles.welcomeSubtitle}>
          Sign in with your Pet Wash employee account
        </Text>
      </View>

      {/* Google Sign-In Button */}
      <TouchableOpacity
        style={styles.googleButton}
        onPress={handleGoogleSignIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Image
              source={{ uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }}
              style={styles.googleIcon}
            />
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Features */}
      <View style={styles.featuresContainer}>
        <FeatureItem icon="📱" text="Real-time station control" />
        <FeatureItem icon="📋" text="Daily task management" />
        <FeatureItem icon="🔒" text="Biometric security" />
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        Pet Wash™ Employee App v1.0.0
      </Text>
    </View>
  );
};

const FeatureItem: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureIcon}>{icon}</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoEmoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#8E8E93',
    fontWeight: '500',
  },
  welcomeContainer: {
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 22,
  },
  googleButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  googleButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  featuresContainer: {
    marginTop: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#000',
  },
  footer: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 32,
  },
});

export default LoginScreen;
