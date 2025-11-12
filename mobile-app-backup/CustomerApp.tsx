/**
 * PetWash™ Ltd - Customer Mobile App
 * Premium Organic Pet Care Platform
 * #PetWashLtd
 */

import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './src/config/firebase';

// Screens
import CustomerAuthScreen from './src/screens/CustomerAuthScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';

const Stack = createStackNavigator();

export default function CustomerApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#FFFFFF' },
        }}
      >
        {!user ? (
          <>
            {/* Auth Screens */}
            <Stack.Screen 
              name="Auth" 
              component={CustomerAuthScreen}
              options={{ title: 'Sign In' }}
            />
            <Stack.Screen 
              name="SignUp" 
              component={SignUpScreen}
              options={{ title: 'Create Account' }}
            />
            <Stack.Screen 
              name="ForgotPassword" 
              component={ForgotPasswordScreen}
              options={{ title: 'Reset Password' }}
            />
          </>
        ) : (
          <>
            {/* Main App Screens (to be implemented) */}
            {/* <Stack.Screen name="Home" component={HomeScreen} /> */}
            {/* <Stack.Screen name="Booking" component={BookingScreen} /> */}
            {/* <Stack.Screen name="Profile" component={ProfileScreen} /> */}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
