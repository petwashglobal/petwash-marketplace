import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = __DEV__
  ? 'http://localhost:5000/api'
  : 'https://petwash.co.il/api';

class NayaxService {
  /**
   * Generate a redemption code for Nayax station
   * This code will be used to redeem wash credits at K9000 stations
   */
  async generateRedemptionCode(userId: string): Promise<string> {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      
      const response = await axios.post(
        `${API_BASE_URL}/nayax/redemption/generate`,
        { userId },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        return response.data.redemptionCode;
      } else {
        throw new Error(response.data.message || 'Failed to generate redemption code');
      }
    } catch (error: any) {
      console.error('Nayax redemption error:', error);
      throw new Error(
        error.response?.data?.message || 
        'Failed to generate redemption code. Please try again.'
      );
    }
  }

  /**
   * Get user's available wash packages and credits
   */
  async getUserPackages(userId: string): Promise<any[]> {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      
      const response = await axios.get(
        `${API_BASE_URL}/packages/user/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      return response.data.packages || [];
    } catch (error: any) {
      console.error('Get packages error:', error);
      return [];
    }
  }

  /**
   * Verify redemption code (called by station)
   */
  async verifyRedemptionCode(code: string, stationId: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/nayax/redemption/verify`,
        { code, stationId }
      );

      return response.data.success;
    } catch (error: any) {
      console.error('Verify redemption error:', error);
      return false;
    }
  }
}

export const nayaxService = new NayaxService();
