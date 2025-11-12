// Station Control Screen - Based on user's React Native code!
// Real-time K9000 station management

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Button,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { petWashApi } from '../api/petWashApi';
import type { Station } from '../types';

interface Props {
  employeeUid: string;
  navigation: any;
}

export const StationControlScreen: React.FC<Props> = ({ employeeUid, navigation }) => {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    loadStations();
    
    // Refresh every 30 seconds for real-time status
    const interval = setInterval(loadStations, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStations = async () => {
    try {
      const data = await petWashApi.getStations();
      setStations(data);
    } catch (error) {
      console.error('Failed to load stations:', error);
      Alert.alert('Error', 'Failed to load stations. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStations();
  };

  const toggleStationStatus = async (stationId: string, currentStatus: string) => {
    try {
      // Toggle between operational and maintenance
      const newStatus = currentStatus === 'operational' ? 'maintenance' : 'operational';
      
      // Update backend (YOUR BACKEND ENDPOINT!)
      await petWashApi.updateStationStatus(stationId, newStatus);
      
      // Update local state
      setStations(prev =>
        prev.map(s =>
          s.id === stationId
            ? { ...s, status: newStatus }
            : s
        )
      );
      
      // Log to audit trail (YOUR AUDIT ENDPOINT!)
      await petWashApi.logAuditEvent(
        'station_status_change',
        'station',
        stationId,
        {
          previousStatus: currentStatus,
          newStatus,
          changedBy: employeeUid,
        }
      );
      
      Alert.alert(
        'Success',
        `Station ${newStatus === 'operational' ? 'activated' : 'set to maintenance mode'}`
      );
    } catch (error) {
      console.error('Failed to update station:', error);
      Alert.alert('Error', 'Failed to update station status');
    }
  };

  const checkInToStation = async (stationId: string, stationName: string) => {
    Alert.alert(
      'Check In',
      `Check in to ${stationName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check In',
          onPress: async () => {
            try {
              await petWashApi.checkInToStation(stationId, employeeUid);
              Alert.alert('Success', `Checked in to ${stationName}`);
            } catch (error) {
              Alert.alert('Error', 'Failed to check in');
            }
          },
        },
      ]
    );
  };

  // Voice Command Handler (from user's React Native code!)
  const handleVoiceCommand = async (stationId: string) => {
    setSelectedStation(stationId);
    setVoiceModalVisible(true);
  };

  const processVoiceInput = async (voiceText: string) => {
    if (!selectedStation) return;

    try {
      setIsListening(true);

      // Call backend voice command API
      const result = await petWashApi.processVoiceCommand(
        voiceText,
        selectedStation
      );

      setIsListening(false);
      setVoiceModalVisible(false);

      if (result.success) {
        Alert.alert('Voice Command', result.message);
      } else {
        Alert.alert('Not Recognized', result.message);
      }
    } catch (error) {
      setIsListening(false);
      Alert.alert('Error', 'Voice command failed');
    }
  };

  const simulateVoiceCommand = (command: string) => {
    // Simulate voice input (in production, this would use actual voice recognition)
    processVoiceInput(command);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading stations...</Text>
      </View>
    );
  }

  const operationalCount = stations.filter(s => s.status === 'operational').length;
  const maintenanceCount = stations.filter(s => s.status === 'maintenance').length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header - YOUR CODE! ✅ */}
      <Text style={styles.header}>K9000 Station Hub</Text>
      
      {/* Status Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{stations.length}</Text>
            <Text style={styles.summaryLabel}>Total Stations</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: '#34C759' }]}>
              {operationalCount}
            </Text>
            <Text style={styles.summaryLabel}>Operational</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: '#FF9500' }]}>
              {maintenanceCount}
            </Text>
            <Text style={styles.summaryLabel}>Maintenance</Text>
          </View>
        </View>
      </View>

      {/* Station List */}
      {stations.map((station, index) => {
        const isOperational = station.status === 'operational';
        const isOnline = station.isOnline;
        
        return (
          <View key={station.id} style={styles.stationCard}>
            <View style={styles.stationHeader}>
              <View>
                <Text style={styles.stationName}>
                  Station {index + 1} - {station.name}
                </Text>
                <Text style={styles.stationLocation}>{station.location}</Text>
                <View style={styles.statusBadge}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isOnline ? '#34C759' : '#FF3B30' }
                    ]}
                  />
                  <Text style={styles.statusText}>
                    {isOnline ? 'Online' : 'Offline'}
                  </Text>
                </View>
              </View>
              
              {/* YOUR EXACT SWITCH CODE! ✅ */}
              <Switch
                onValueChange={() => toggleStationStatus(station.id, station.status)}
                value={isOperational}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={isOperational ? '#007AFF' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                disabled={!isOnline}
              />
            </View>

            {/* Status Label - YOUR CODE! ✅ */}
            <Text
              style={[
                styles.statusLabel,
                { color: isOperational ? '#34C759' : '#FF9500' }
              ]}
            >
              Status: {isOperational ? 'Operational' : 'Maintenance Mode'}
            </Text>

            {/* Voice Command Button (user's code!) */}
            {isOperational && isOnline && (
              <>
                <TouchableOpacity
                  style={styles.voiceButton}
                  onPress={() => handleVoiceCommand(station.id)}
                >
                  <Text style={styles.voiceButtonText}>🎤 Voice Command</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkInButton}
                  onPress={() => checkInToStation(station.id, station.name)}
                >
                  <Text style={styles.checkInButtonText}>📍 Check In</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );
      })}

      {/* Voice Command Modal (user's multimodal UI!) */}
      <Modal
        visible={voiceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVoiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Voice Commands</Text>
            <Text style={styles.modalSubtitle}>
              Choose a command or speak naturally
            </Text>

            {isListening && (
              <View style={styles.listeningIndicator}>
                <ActivityIndicator size="large" color="#34C859" />
                <Text style={styles.listeningText}>Processing...</Text>
              </View>
            )}

            <View style={styles.commandButtons}>
              <TouchableOpacity
                style={styles.commandButton}
                onPress={() => simulateVoiceCommand('dispense shampoo')}
                disabled={isListening}
              >
                <Text style={styles.commandButtonText}>Dispense Shampoo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.commandButton}
                onPress={() => simulateVoiceCommand('start wash')}
                disabled={isListening}
              >
                <Text style={styles.commandButtonText}>Start Wash</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.commandButton}
                onPress={() => simulateVoiceCommand('rinse')}
                disabled={isListening}
              >
                <Text style={styles.commandButtonText}>Rinse</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.commandButton}
                onPress={() => simulateVoiceCommand('dry')}
                disabled={isListening}
              >
                <Text style={styles.commandButtonText}>Dry</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.commandButton, styles.emergencyButton]}
                onPress={() => simulateVoiceCommand('emergency stop')}
                disabled={isListening}
              >
                <Text style={[styles.commandButtonText, styles.emergencyText]}>
                  Emergency Stop
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setVoiceModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* YOUR EXACT BUTTON CODE! ✅ */}
      <View style={styles.scheduleButton}>
        <Button
          title="View Today's Schedule"
          onPress={() => navigation.navigate('Schedule')}
          color="#007AFF"
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 16,
    marginHorizontal: 20,
    color: '#007AFF',
  },
  summaryCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  stationCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  stationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  stationLocation: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  voiceButton: {
    marginTop: 12,
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  voiceButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkInButton: {
    marginTop: 12,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleButton: {
    marginHorizontal: 16,
    marginVertical: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 20,
    textAlign: 'center',
  },
  listeningIndicator: {
    alignItems: 'center',
    marginBottom: 20,
  },
  listeningText: {
    marginTop: 8,
    fontSize: 16,
    color: '#34C759',
    fontWeight: '600',
  },
  commandButtons: {
    marginBottom: 20,
  },
  commandButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  commandButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emergencyButton: {
    backgroundColor: '#FF3B30',
  },
  emergencyText: {
    color: 'white',
  },
  closeButton: {
    backgroundColor: '#F2F2F7',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default StationControlScreen;
