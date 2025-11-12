import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { auth } from '../config/firebase';
import { NayaxQRCode } from '../components/NayaxQRCode';
import { nayaxService } from '../services/nayaxService';
import AddressLookup from '../components/AddressLookup';

interface AddressDetails {
  fullAddress: string;
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  placeId?: string;
}

export default function DashboardScreen() {
  const [loading, setLoading] = useState(false);
  const [redemptionCode, setRedemptionCode] = useState<string | null>(null);
  const [userPackages, setUserPackages] = useState<any[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState<AddressDetails | null>(null);
  const user = auth.currentUser;

  useEffect(() => {
    loadUserPackages();
  }, []);

  const loadUserPackages = async () => {
    try {
      setLoading(true);
      const packages = await nayaxService.getUserPackages(user?.uid || '');
      setUserPackages(packages);
    } catch (error: any) {
      console.error('Failed to load packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRedemptionCode = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to generate redemption code');
      return;
    }

    try {
      setLoading(true);
      const code = await nayaxService.generateRedemptionCode(user.uid);
      setRedemptionCode(code);
      Alert.alert(
        'QR Code Generated!',
        'Scan this QR code at any PetWash™ K9000 station to redeem your wash credit.'
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate redemption code');
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSelected = (address: AddressDetails) => {
    setDeliveryAddress(address);
    console.log('🏠 Delivery address set:', address);
    Alert.alert(
      'Address Saved',
      `Your delivery address has been set to:\n${address.fullAddress}`
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeEmoji}>👋</Text>
        <Text style={styles.welcomeText}>
          Welcome{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Wash Packages Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📦 Your Wash Packages</Text>
        {loading && userPackages.length === 0 ? (
          <ActivityIndicator color="#007AFF" style={{ marginTop: 20 }} />
        ) : userPackages.length > 0 ? (
          userPackages.map((pkg, index) => (
            <View key={index} style={styles.packageCard}>
              <Text style={styles.packageName}>{pkg.name}</Text>
              <Text style={styles.packageCredit}>
                {pkg.remainingWashes} washes remaining
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyText}>No active packages</Text>
            <TouchableOpacity style={styles.buyButton}>
              <Text style={styles.buyButtonText}>Buy Wash Package</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Address Lookup Section */}
      <View style={styles.section}>
        <AddressLookup
          onAddressSelected={handleAddressSelected}
          placeholder="Search for your delivery address..."
        />
        {deliveryAddress && (
          <View style={styles.addressSummary}>
            <Text style={styles.addressSummaryTitle}>📍 Saved Address:</Text>
            <Text style={styles.addressSummaryText}>
              {deliveryAddress.fullAddress}
            </Text>
            <Text style={styles.addressSummaryCoords}>
              Coordinates: {deliveryAddress.latitude.toFixed(6)}, {deliveryAddress.longitude.toFixed(6)}
            </Text>
          </View>
        )}
      </View>

      {/* QR Code Redemption Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎫 Nayax Station Redemption</Text>
        <Text style={styles.sectionDescription}>
          Generate a QR code to redeem your wash credit at any K9000 station
        </Text>

        {redemptionCode ? (
          <View style={styles.qrContainer}>
            <NayaxQRCode value={redemptionCode} />
            <Text style={styles.qrInstructions}>
              Scan this QR code at the K9000 wash station to start your wash
            </Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => setRedemptionCode(null)}
            >
              <Text style={styles.refreshButtonText}>Generate New Code</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerateRedemptionCode}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.generateButtonEmoji}>🔲</Text>
                <Text style={styles.generateButtonText}>
                  Generate QR Code
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Quick Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🐕</Text>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Total Washes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>💰</Text>
            <Text style={styles.statValue}>$0</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
        </View>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerEmoji}>ℹ️</Text>
        <Text style={styles.infoBannerText}>
          Each QR code is valid for 5 minutes and can only be used once for security.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 24,
    paddingTop: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  welcomeEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#E0E0E0',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  packageCard: {
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  packageCredit: {
    fontSize: 14,
    color: '#007AFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 16,
  },
  buyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  qrInstructions: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  refreshButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  refreshButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  generateButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  generateButtonEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  generateButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  statEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF9E6',
    marginHorizontal: 16,
    marginVertical: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFB800',
  },
  infoBannerEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#000',
  },
  addressSummary: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  addressSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  addressSummaryText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 6,
  },
  addressSummaryCoords: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: 'monospace',
  },
});
