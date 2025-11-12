// Main App Entry Point
// Pet Wash™ Employee Mobile App

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import StationControlScreen from './src/screens/StationControlScreen';

// Types
import type { Employee } from './src/types';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Request notification permissions
const requestNotificationPermission = async () => {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('Notification permission granted');
    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    // TODO: Send token to backend
  }
};

// Profile Screen Placeholder
function ProfilePlaceholder() {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderEmoji}>👤</Text>
      <Text style={styles.placeholderText}>Profile Screen</Text>
      <Text style={styles.placeholderSubtext}>Coming soon</Text>
    </View>
  );
}

// Tasks Screen Placeholder
function TasksPlaceholder() {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderEmoji}>📋</Text>
      <Text style={styles.placeholderText}>Tasks Screen</Text>
      <Text style={styles.placeholderSubtext}>Coming soon</Text>
    </View>
  );
}

// QR Scanner Placeholder (will be replaced with actual scanner)
function QRScannerPlaceholder() {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderEmoji}>📷</Text>
      <Text style={styles.placeholderText}>QR Scanner</Text>
      <Text style={styles.placeholderSubtext}>Coming soon</Text>
    </View>
  );
}

// Schedule Placeholder
function SchedulePlaceholder() {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderEmoji}>📅</Text>
      <Text style={styles.placeholderText}>Schedule Screen</Text>
      <Text style={styles.placeholderSubtext}>Coming soon</Text>
    </View>
  );
}

function MainTabs({ employee }: { employee: Employee }) {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#E5E5EA',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Text style={{ fontSize: 24, color }}>
              {focused ? '🏠' : '🏡'}
            </Text>
          ),
        }}
      >
        {(props) => <DashboardScreen {...props} employee={employee} />}
      </Tab.Screen>

      <Tab.Screen
        name="StationControl"
        options={{
          title: 'Stations',
          tabBarIcon: ({ focused, color }) => (
            <Text style={{ fontSize: 24, color }}>
              {focused ? '🏪' : '🏬'}
            </Text>
          ),
        }}
      >
        {(props) => <StationControlScreen {...props} employeeUid={employee.uid} />}
      </Tab.Screen>

      <Tab.Screen
        name="Profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <Text style={{ fontSize: 24, color }}>
              {focused ? '👤' : '👥'}
            </Text>
          ),
        }}
        component={ProfilePlaceholder}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // Load employee data from AsyncStorage
        const employeeData = await AsyncStorage.getItem('employee');
        if (employeeData) {
          setEmployee(JSON.parse(employeeData));
        }
      } else {
        setEmployee(null);
      }
      setLoading(false);
    });

    // Request notification permissions
    requestNotificationPermission();

    return unsubscribe;
  }, []);

  const handleLoginSuccess = async (employeeData: any) => {
    await AsyncStorage.setItem('employee', JSON.stringify(employeeData));
    setEmployee(employeeData);
  };

  const handleLogout = async () => {
    await auth().signOut();
    await AsyncStorage.removeItem('employee');
    await AsyncStorage.removeItem('authToken');
    setEmployee(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingEmoji}>🐾</Text>
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 16 }} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {employee ? (
          <>
            <Stack.Screen name="Main">
              {() => <MainTabs employee={employee} />}
            </Stack.Screen>
            <Stack.Screen name="Tasks" component={TasksPlaceholder} />
            <Stack.Screen name="QRScanner" component={QRScannerPlaceholder} />
            <Stack.Screen name="Schedule" component={SchedulePlaceholder} />
          </>
        ) : (
          <Stack.Screen name="Login">
            {() => <LoginScreen onLoginSuccess={handleLoginSuccess} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingEmoji: {
    fontSize: 72,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#8E8E93',
    fontWeight: '500',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 20,
  },
  placeholderEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: '#8E8E93',
  },
});

