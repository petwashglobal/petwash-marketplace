/**
 * Customer Wash Purchase Screen
 * Allows customers to purchase wash cycles via Nayax payment integration
 * 
 * Features:
 * - Wash type selection (Premium, Deluxe, Basic, Express)
 * - QR code scanning for discounts/free washes
 * - Payment processing with Nayax Spark API
 * - Real-time wash status
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react';
import { petWashApi } from '../api/petWashApi';
import QRScanner from '../components/QRScanner';

interface WashType {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  productCode: string;
}

const WASH_TYPES: WashType[] = [
  {
    id: 'premium',
    name: 'Premium Wash',
    description: 'Complete spa treatment with organic shampoo & conditioning',
    price: 120,
    duration: '25 min',
    productCode: 'DOGWASH_PREMIUM',
  },
  {
    id: 'deluxe',
    name: 'Deluxe Wash',
    description: 'Deep clean with premium organic products',
    price: 90,
    duration: '20 min',
    productCode: 'DOGWASH_DELUXE',
  },
  {
    id: 'basic',
    name: 'Basic Wash',
    description: 'Essential clean for everyday care',
    price: 60,
    duration: '15 min',
    productCode: 'DOGWASH_BASIC',
  },
  {
    id: 'express',
    name: 'Express Wash',
    description: 'Quick rinse and dry',
    price: 40,
    duration: '10 min',
    productCode: 'DOGWASH_EXPRESS',
  },
];

export default function CustomerWashPurchaseScreen({ navigation, route }: any) {
  const [selectedWash, setSelectedWash] = useState<WashType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrDiscount, setQrDiscount] = useState<{
    amount?: number;
    percent?: number;
    isFreeWash?: boolean;
  } | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(null);

  const { stationId, customerUid } = route.params || {};

  useEffect(() => {
    // Load saved payment token from secure storage
    loadCustomerPaymentToken();
  }, []);

  const loadCustomerPaymentToken = async () => {
    // In production, retrieve from secure storage (Keychain/Keystore)
    // For now, use placeholder
    setCustomerToken('CUSTOMER_TOKEN_PLACEHOLDER');
  };

  const handleQRScan = async (qrCode: string) => {
    try {
      setIsProcessing(true);
      setShowQRScanner(false);

      const response = await petWashApi.post('/api/payments/nayax/redeem-qr', {
        qrCode,
        customerUid,
        stationId: stationId || 'MAIN_STATION',
      });

      if (response.data.success) {
        if (response.data.isFreeWash) {
          // Free wash already started!
          Alert.alert(
            'סיום הזמנה ✓',
            response.data.message,
            [
              {
                text: 'חזרה',
                onPress: () => navigation.goBack(),
              },
            ]
          );
        } else {
          // Discount applied
          setQrDiscount({
            amount: response.data.discountAmount,
            percent: response.data.discountPercent,
          });

          Alert.alert(
            'הנחה הופעלה! 🎉',
            response.data.message,
            [{ text: 'המשך', style: 'default' }]
          );
        }
      } else {
        Alert.alert('שגיאה', response.data.message);
      }
    } catch (error: any) {
      Alert.alert('שגיאה', 'שגיאה בסריקת QR. נסה שוב.');
      console.error('QR redemption error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateFinalPrice = (basePrice: number): number => {
    if (qrDiscount?.isFreeWash) return 0;

    let finalPrice = basePrice;

    if (qrDiscount?.amount) {
      finalPrice -= qrDiscount.amount;
    }

    if (qrDiscount?.percent) {
      finalPrice *= (1 - qrDiscount.percent / 100);
    }

    return Math.max(0, finalPrice);
  };

  const handlePurchaseWash = async () => {
    if (!selectedWash) {
      Alert.alert('שגיאה', 'אנא בחר סוג שטיפה');
      return;
    }

    if (!customerToken) {
      Alert.alert('שגיאה', 'אסימון תשלום חסר. אנא התחבר מחדש.');
      return;
    }

    const finalPrice = calculateFinalPrice(selectedWash.price);

    Alert.alert(
      'אישור רכישה',
      `${selectedWash.name}\nמחיר: ₪${finalPrice}\n${qrDiscount ? '(הנחה הופעלה)' : ''}\n\nאשר תשלום?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אשר',
          onPress: () => processPayment(finalPrice),
        },
      ]
    );
  };

  const processPayment = async (amount: number) => {
    try {
      setIsProcessing(true);

      const response = await petWashApi.post('/api/payments/nayax/initiate-wash', {
        amount,
        customerUid,
        customerToken,
        washType: selectedWash!.productCode,
        stationId: stationId || 'MAIN_STATION',
      });

      if (response.data.success) {
        Alert.alert(
          'הזמנה אושרה! ✓',
          'מכונת השטיפה מתחילה עכשיו. תהנה!',
          [
            {
              text: 'צפה בתקבול',
              onPress: () => {
                navigation.navigate('CustomerReceipts', {
                  transactionId: response.data.transactionId,
                });
              },
            },
          ]
        );
      } else {
        Alert.alert('תשלום נדחה', response.data.message);
      }
    } catch (error: any) {
      Alert.alert(
        'שגיאה',
        'שגיאה בעיבוד תשלום. נסה שוב או פנה לתמיכה.'
      );
      console.error('Payment error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (showQRScanner) {
    return (
      <QRScanner
        onScan={handleQRScan}
        onClose={() => setShowQRScanner(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>בחר שטיפה</Text>
        <Text style={styles.headerSubtitle}>
          שטיפה אורגנית premium למחמד שלך
        </Text>
      </View>

      <TouchableOpacity
        style={styles.qrButton}
        onPress={() => setShowQRScanner(true)}
      >
        <Text style={styles.qrButtonText}>
          📱 סרוק QR להנחה או שטיפה חינם
        </Text>
      </TouchableOpacity>

      {qrDiscount && (
        <View style={styles.discountBanner}>
          <Text style={styles.discountText}>
            🎉 הנחה הופעלה: {qrDiscount.percent ? `${qrDiscount.percent}%` : `₪${qrDiscount.amount}`}
          </Text>
        </View>
      )}

      <View style={styles.washTypes}>
        {WASH_TYPES.map((wash) => {
          const finalPrice = calculateFinalPrice(wash.price);
          const isSelected = selectedWash?.id === wash.id;

          return (
            <TouchableOpacity
              key={wash.id}
              style={[
                styles.washCard,
                isSelected && styles.washCardSelected,
              ]}
              onPress={() => setSelectedWash(wash)}
            >
              <View style={styles.washCardContent}>
                <Text style={styles.washName}>{wash.name}</Text>
                <Text style={styles.washDescription}>{wash.description}</Text>
                <Text style={styles.washDuration}>⏱️ {wash.duration}</Text>

                <View style={styles.priceContainer}>
                  {qrDiscount && finalPrice < wash.price ? (
                    <>
                      <Text style={styles.originalPrice}>₪{wash.price}</Text>
                      <Text style={styles.finalPrice}>₪{finalPrice}</Text>
                    </>
                  ) : (
                    <Text style={styles.washPrice}>₪{wash.price}</Text>
                  )}
                </View>
              </View>

              {isSelected && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          styles.purchaseButton,
          !selectedWash && styles.purchaseButtonDisabled,
        ]}
        onPress={handlePurchaseWash}
        disabled={!selectedWash || isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.purchaseButtonText}>
            {selectedWash
              ? `רכישה - ₪${calculateFinalPrice(selectedWash.price)}`
              : 'בחר שטיפה'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 24,
    backgroundColor: '#4F46E5',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E0E7FF',
    textAlign: 'center',
    marginTop: 8,
  },
  qrButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#10B981',
    borderRadius: 12,
    alignItems: 'center',
  },
  qrButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  discountBanner: {
    margin: 16,
    marginTop: 0,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  discountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
  },
  washTypes: {
    padding: 16,
  },
  washCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  washCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  washCardContent: {
    flex: 1,
  },
  washName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  washDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  washDuration: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  washPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  originalPrice: {
    fontSize: 18,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  finalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
  },
  selectedBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  purchaseButton: {
    margin: 16,
    padding: 18,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    alignItems: 'center',
  },
  purchaseButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});
