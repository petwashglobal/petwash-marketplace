// Requires: NativeWind (for 'className' styling) and Moti (for luxury animation)
// npm install nativewind tailwindcss moti
// npx tailwindcss init
// Ensure your Babel config is set up for NativeWind (per documentation)

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { MotiView } from 'moti';
import { Feather } from '@expo/vector-icons'; // Assuming Expo environment

// --- Design Constants for the 'Luxury Influx' ---
const LUX_BLUE = 'rgb(50, 60, 100)';  // Dark, deep background color
const LUX_ACCENT = 'rgb(100, 200, 255)'; // Bright, polished accent color
const LUX_GRADIENT = ['#1a202c', '#2c3e50']; // Subtle gradient for depth

// --- Reusable Luxury Card Component ---
const LuxuryMenuItem = ({ icon, title, description, onPress }) => (
    <MotiView
        from={{ opacity: 0, translateY: 20, scale: 0.95 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{ type: 'timing', duration: 400 }}
        className="mb-4 rounded-xl overflow-hidden shadow-lg shadow-black/50"
    >
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className="flex-row items-center p-4 bg-gray-800 border border-blue-900/50"
        >
            <View className="p-3 rounded-full mr-4" style={{ backgroundColor: LUX_ACCENT }}>
                <Feather name={icon} size={24} color={LUX_BLUE} />
            </View>
            <View className="flex-1">
                <Text className="text-white text-lg font-bold">
                    {title}
                </Text>
                <Text className="text-gray-400 text-sm mt-0.5">
                    {description}
                </Text>
            </View>
            <Feather name="chevron-right" size={24} color="gray" />
        </TouchableOpacity>
    </MotiView>
);

// --- Main 7-Star Luxury Menu Screen ---
export default function PawConnectScreen() {
    // Action functions (will navigate in a real app)
    const handleNavigation = (feature) => {
        console.log(`Navigating to: ${feature}`);
        // In your Replit app, this would use React Navigation's `navigation.navigate(...)`
    };

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: LUX_BLUE }}>
            <ScrollView className="p-4 pt-8">
                
                {/* --- 7-Star Title Header --- */}
                <Text className="text-3xl font-extrabold text-white mb-2">
                    <Text style={{ color: LUX_ACCENT }}>Paw-Connect</Text>
                </Text>
                <Text className="text-gray-400 text-base mb-6">
                    Your 7-Star Community and Support Hub
                </Text>

                {/* --- Main Feature Sections (The "Feathers") --- */}
                
                <Text className="text-xl font-semibold text-gray-300 mt-4 mb-3">
                    Exclusive Services
                </Text>

                <LuxuryMenuItem
                    icon="message-square"
                    title="7-Star Luxury Inbox"
                    description="Private chats with approved members and your history."
                    onPress={() => handleNavigation('Inbox')}
                />
                
                <LuxuryMenuItem
                    icon="phone"
                    title="Direct Support Chat"
                    description="Live connection to the Pet Wash™ Support Team."
                    onPress={() => handleNavigation('SupportChat')}
                />

                <Text className="text-xl font-semibold text-gray-300 mt-6 mb-3">
                    Community Boards
                </Text>

                <LuxuryMenuItem
                    icon="users"
                    title="Community Feed"
                    description="Share photos, events, and updates with fellow members."
                    onPress={() => handleNavigation('CommunityFeed')}
                />
                
                <LuxuryMenuItem
                    icon="alert-triangle"
                    title="Missing Pet Assistance"
                    description="High-priority board for lost and found pets."
                    onPress={() => handleNavigation('MissingPetBoard')}
                />

                {/* --- Footer Note for Luxury Branding --- */}
                <View className="mt-12 mb-6 items-center">
                    <Text className="text-xs text-gray-600">
                        Powered by 2025 Cross-Platform Lux Code
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
