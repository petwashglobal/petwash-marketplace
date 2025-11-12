import React from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface NayaxQRCodeProps {
  value: string;
  size?: number;
}

export function NayaxQRCode({ value, size = 200 }: NayaxQRCodeProps) {
  return (
    <View style={styles.container}>
      <QRCode
        value={value}
        size={size}
        color="#000"
        backgroundColor="#FFF"
        logo={require('../../assets/icon.png')}
        logoSize={40}
        logoBackgroundColor="#FFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
});
