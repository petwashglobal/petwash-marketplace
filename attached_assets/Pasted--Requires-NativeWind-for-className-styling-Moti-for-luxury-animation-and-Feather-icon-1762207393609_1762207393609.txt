// Requires: NativeWind (for 'className' styling), Moti (for luxury animation), 
// and Feather icons (for the checkmark).

import React, { useState } from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { MotiView, useAnimationState } from 'moti';
import { Feather } from '@expo/vector-icons'; // Assuming Expo environment

// --- Design Constants for 7-Star Look ---
const SUCCESS_COLOR = 'rgb(52, 211, 153)'; // Tailwind green-400 equivalent for success
const BUTTON_COLOR = 'rgb(239, 68, 68)'; // Tailwind red-500 equivalent for "Resolve"
const LUX_BLUE = 'rgb(50, 60, 100)';     // Dark background (from previous code)

// --- The Luxury Paw-Finder Resolve Component ---
const PawFinderResolveButton = ({ postId, onResolveConfirmed }) => {
    // State to handle the UI flow: Default -> Confirming -> Resolved
    const [status, setStatus] = useState('default');
    const [isResolving, setIsResolving] = useState(false);

    // Moti State for smooth transitions and button shrinkage
    const buttonState = useAnimationState({
        default: { scale: 1, backgroundColor: BUTTON_COLOR, width: '100%', borderRadius: 12 },
        confirming: { scale: 1.05, backgroundColor: 'rgb(251, 191, 36)', width: '100%', borderRadius: 16 }, // Amber for warning/confirm
        resolved: { scale: 1, backgroundColor: SUCCESS_COLOR, width: 60, borderRadius: 30 },
        loading: { scale: 0.95, width: 60, borderRadius: 30 },
    });
    
    // Moti State for the text/icon visibility
    const textState = useAnimationState({
        show: { opacity: 1, translateX: 0, width: 'auto' },
        hide: { opacity: 0, translateX: -20, width: 0 },
    });

    // --- Core Logic Handler ---
    const handlePress = async () => {
        if (status === 'resolved') return; // Do nothing if already resolved

        if (status === 'default') {
            // First press: Ask for confirmation
            setStatus('confirming');
            buttonState.transitionTo('confirming');
        } else if (status === 'confirming') {
            // Second press: Execute the resolution process
            setIsResolving(true);
            buttonState.transitionTo('loading');
            textState.transitionTo('hide');
            
            // Simulate API call delay (Replace with actual backend call)
            await new Promise(resolve => setTimeout(resolve, 1500)); 
            
            // Success!
            setIsResolving(false);
            setStatus('resolved');
            buttonState.transitionTo('resolved');
            // Notify the parent component/app logic
            onResolveConfirmed(postId); 
        }
    };

    // --- Render Content based on Status ---
    const renderButtonContent = () => {
        if (isResolving) {
            // Placeholder for a luxurious spinner (if you install a spinner library)
            return <MotiView from={{ rotate: '0deg' }} animate={{ rotate: '360deg' }} transition={{ type: 'timing', duration: 800, loop: true }}><Feather name="loader" size={24} color="white" /></MotiView>;
        }
        
        if (status === 'resolved') {
            return <Feather name="check" size={28} color={LUX_BLUE} />;
        }
        
        return (
            <>
                <MotiView state={textState} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Feather name="zap" size={20} color="white" className="mr-2" />
                    <Text className="text-white font-extrabold text-lg text-center">
                        {status === 'default' ? "Pet Found! Resolve Post" : "Confirm Resolution?"}
                    </Text>
                </MotiView>
            </>
        );
    };

    return (
        <View className="p-4" style={{ backgroundColor: LUX_BLUE }}>
            <MotiView state={buttonState} style={{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center', height: 60, alignSelf: 'center' }}>
                <TouchableOpacity
                    onPress={handlePress}
                    disabled={status === 'resolved'}
                    activeOpacity={0.8}
                    className="w-full h-full items-center justify-center"
                >
                    {renderButtonContent()}
                </TouchableOpacity>
            </MotiView>
            
            {status === 'confirming' && (
                <MotiView 
                    from={{ opacity: 0, translateY: -10 }} 
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 300 }}
                    className="mt-3"
                >
                    <Text className="text-yellow-400 text-sm text-center">
                        Tap again to permanently archive this missing pet report.
                    </Text>
                </MotiView>
            )}
            
            {status === 'resolved' && (
                <MotiView 
                    from={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    transition={{ type: 'timing', duration: 500 }}
                    className="mt-3"
                >
                    <Text className="text-green-400 font-bold text-center">
                        🎉 Report Resolved! Pet Wash™ is happy to see your pet safe!
                    </Text>
                </MotiView>
            )}
        </View>
    );
};

export default PawFinderResolveButton;

// --- Example Usage (Conceptual) ---
/*
    // In your main PawFinderPostDetailScreen.js:
    <PawFinderResolveButton 
        postId={12345} 
        onResolveConfirmed={(id) => {
            console.log(`Successfully archived post ID: ${id}`);
            // Call your API to update the database status here.
        }} 
    />
*/
