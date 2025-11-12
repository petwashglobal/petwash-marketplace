import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

interface AddressDetails {
  fullAddress: string;
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  placeId?: string;
}

interface AddressLookupProps {
  onAddressSelected: (address: AddressDetails) => void;
  placeholder?: string;
  initialValue?: string;
}

export default function AddressLookup({
  onAddressSelected,
  placeholder = 'Search for your address...',
  initialValue = '',
}: AddressLookupProps) {
  const [selectedAddress, setSelectedAddress] = useState<AddressDetails | null>(null);

  const handlePlaceSelect = (data: any, details: any) => {
    if (details) {
      const addressDetails: AddressDetails = {
        fullAddress: details.formatted_address || data.description,
        latitude: details.geometry.location.lat,
        longitude: details.geometry.location.lng,
        formattedAddress: details.formatted_address,
        placeId: details.place_id,
      };

      setSelectedAddress(addressDetails);
      onAddressSelected(addressDetails);

      console.log('📍 Address selected:', {
        address: addressDetails.fullAddress,
        coordinates: `${addressDetails.latitude}, ${addressDetails.longitude}`,
      });
    }
  };

  const clearAddress = () => {
    setSelectedAddress(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>📍 Delivery Address</Text>
      
      {selectedAddress ? (
        <View style={styles.selectedAddressContainer}>
          <View style={styles.addressInfo}>
            <Text style={styles.selectedAddressText}>
              {selectedAddress.fullAddress}
            </Text>
            <Text style={styles.coordinatesText}>
              📌 {selectedAddress.latitude.toFixed(6)}, {selectedAddress.longitude.toFixed(6)}
            </Text>
          </View>
          <TouchableOpacity onPress={clearAddress} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <GooglePlacesAutocomplete
          placeholder={placeholder}
          fetchDetails={true}
          onPress={handlePlaceSelect}
          query={{
            key: process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '',
            language: 'en',
            components: 'country:il', // Restrict to Israel (adjust as needed)
          }}
          styles={{
            container: styles.autocompleteContainer,
            textInputContainer: styles.textInputContainer,
            textInput: styles.textInput,
            listView: styles.listView,
            row: styles.row,
            separator: styles.separator,
            description: styles.description,
            predefinedPlacesDescription: styles.predefinedPlacesDescription,
          }}
          enablePoweredByContainer={false}
          debounce={300}
          minLength={2}
          nearbyPlacesAPI="GooglePlacesSearch"
          textInputProps={{
            placeholderTextColor: '#8E8E93',
            returnKeyType: 'search',
            autoCorrect: false,
          }}
        />
      )}

      {selectedAddress && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerEmoji}>✅</Text>
          <Text style={styles.infoBannerText}>
            Address verified and ready for delivery
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  autocompleteContainer: {
    flex: 0,
    zIndex: 1,
  },
  textInputContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 12,
  },
  textInput: {
    height: 48,
    fontSize: 16,
    color: '#000',
    backgroundColor: 'transparent',
  },
  listView: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    maxHeight: 300,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'white',
  },
  separator: {
    height: 1,
    backgroundColor: '#F2F2F7',
  },
  description: {
    fontSize: 15,
    color: '#000',
  },
  predefinedPlacesDescription: {
    fontSize: 15,
    color: '#007AFF',
  },
  selectedAddressContainer: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
    alignItems: 'center',
  },
  addressInfo: {
    flex: 1,
  },
  selectedAddressText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 6,
  },
  coordinatesText: {
    fontSize: 12,
    color: '#4CAF50',
    fontFamily: 'monospace',
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  clearButtonText: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: 'bold',
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    alignItems: 'center',
  },
  infoBannerEmoji: {
    fontSize: 18,
    marginRight: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
  },
});
