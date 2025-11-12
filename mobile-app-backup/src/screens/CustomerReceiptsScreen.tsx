/**
 * Customer Receipts Screen
 * Displays transaction history and receipt details
 * 
 * Features:
 * - Transaction history with status
 * - Receipt details (wash type, amount, timestamp)
 * - Download/share receipt
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
} from 'react';
import { petWashApi } from '../api/petWashApi';

interface Transaction {
  id: string;
  externalTransactionId: string;
  status: string;
  amount: string;
  currency: string;
  washType: string;
  stationId: string;
  customerUid: string;
  createdAt: string;
  settledAt?: string;
  voidedAt?: string;
  failedAt?: string;
  nayaxTransactionId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  settled: '#10B981',
  authorized: '#3B82F6',
  vend_success: '#8B5CF6',
  voided: '#EF4444',
  failed: '#DC2626',
  pending: '#F59E0B',
};

const STATUS_LABELS: Record<string, string> = {
  settled: 'הושלם ✓',
  authorized: 'מאושר',
  vend_success: 'בתהליך',
  voided: 'בוטל',
  failed: 'נכשל',
  pending: 'ממתין',
};

const WASH_TYPE_NAMES: Record<string, string> = {
  DOGWASH_PREMIUM: 'שטיפה פרימיום',
  DOGWASH_DELUXE: 'שטיפה דלוקס',
  DOGWASH_BASIC: 'שטיפה בסיסית',
  DOGWASH_EXPRESS: 'שטיפה מהירה',
};

export default function CustomerReceiptsScreen({ route }: any) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const { customerUid, transactionId } = route.params || {};

  useEffect(() => {
    loadTransactions();

    // If specific transaction ID provided, load and select it
    if (transactionId) {
      loadSpecificTransaction(transactionId);
    }
  }, []);

  const loadTransactions = async () => {
    try {
      setIsLoading(true);

      const response = await petWashApi.get(
        `/api/payments/nayax/transactions/customer/${customerUid}?limit=50`
      );

      setTransactions(response.data);
    } catch (error: any) {
      console.error('Failed to load transactions:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת היסטוריית תשלומים');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSpecificTransaction = async (txId: string) => {
    try {
      const response = await petWashApi.get(`/api/payments/nayax/transactions/${txId}`);
      setSelectedTransaction(response.data);
    } catch (error: any) {
      console.error('Failed to load transaction:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTransactions();
    setIsRefreshing(false);
  };

  const handleTransactionPress = async (transaction: Transaction) => {
    setSelectedTransaction(transaction);
  };

  const handleShareReceipt = async (transaction: Transaction) => {
    const receiptText = `
🐾 Pet Wash™ - קבלה

סוג שטיפה: ${WASH_TYPE_NAMES[transaction.washType] || transaction.washType}
סכום: ₪${transaction.amount}
סטטוס: ${STATUS_LABELS[transaction.status]}
מספר עסקה: ${transaction.id}
תאריך: ${new Date(transaction.createdAt).toLocaleDateString('he-IL')}

תודה שבחרת ב-Pet Wash™!
    `.trim();

    try {
      await Share.share({
        message: receiptText,
        title: 'Pet Wash Receipt',
      });
    } catch (error: any) {
      console.error('Share error:', error);
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const statusColor = STATUS_COLORS[item.status] || '#6B7280';
    const statusLabel = STATUS_LABELS[item.status] || item.status;
    const washName = WASH_TYPE_NAMES[item.washType] || item.washType;

    return (
      <TouchableOpacity
        style={styles.transactionCard}
        onPress={() => handleTransactionPress(item)}
      >
        <View style={styles.transactionHeader}>
          <Text style={styles.washTypeName}>{washName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.transactionDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>סכום:</Text>
            <Text style={styles.detailValue}>₪{item.amount}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>תאריך:</Text>
            <Text style={styles.detailValue}>
              {new Date(item.createdAt).toLocaleDateString('he-IL', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>עסקה:</Text>
            <Text style={styles.detailValueSmall} numberOfLines={1}>
              {item.id}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => handleShareReceipt(item)}
        >
          <Text style={styles.shareButtonText}>📤 שתף קבלה</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>טוען היסטוריה...</Text>
      </View>
    );
  }

  if (transactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>אין עסקאות</Text>
        <Text style={styles.emptySubtitle}>
          היסטוריית השטיפות שלך תופיע כאן
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>קבלות שלי</Text>
        <Text style={styles.headerSubtitle}>
          {transactions.length} עסקאות
        </Text>
      </View>

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#4F46E5"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
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
    fontSize: 14,
    color: '#E0E7FF',
    textAlign: 'center',
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  washTypeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  transactionDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  detailValueSmall: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    flex: 1,
    textAlign: 'left',
    marginLeft: 8,
  },
  shareButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
});
