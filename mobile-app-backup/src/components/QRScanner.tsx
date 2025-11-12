// QR Code Scanner Component
// For station check-in and task verification

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { RNCamera } from 'react-native-camera';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

export const QRScanner: React.FC<Props> = ({ visible, onClose, onScan }) => {
  const [scanned, setScanned] = useState(false);

  const handleScan = (e: any) => {
    if (scanned) return;

    setScanned(true);
    const data = e.data || e.nativeEvent.data;

    // Validate QR code format
    if (data.startsWith('petwash://')) {
      onScan(data);
      setTimeout(() => {
        setScanned(false);
        onClose();
      }, 500);
    } else {
      Alert.alert(
        'Invalid QR Code',
        'This QR code is not a valid Pet Wash station code.',
        [
          {
            text: 'OK',
            onPress: () => setScanned(false),
          },
        ]
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <QRCodeScanner
          onRead={handleScan}
          flashMode={RNCamera.Constants.FlashMode.off}
          reactivate={!scanned}
          reactivateTimeout={2000}
          topContent={
            <View style={styles.topContent}>
              <Text style={styles.title}>Scan Station QR Code</Text>
              <Text style={styles.subtitle}>
                Point your camera at the station QR code
              </Text>
            </View>
          }
          bottomContent={
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          }
          cameraStyle={styles.camera}
          markerStyle={styles.marker}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topContent: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF80',
    textAlign: 'center',
  },
  camera: {
    height: '100%',
  },
  marker: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  cancelButton: {
    padding: 16,
    margin: 20,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default QRScanner;
