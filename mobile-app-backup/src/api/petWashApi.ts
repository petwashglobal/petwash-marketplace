// API Client for Pet Wash Backend
// Integrates with your existing backend endpoints

import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { 
  Employee, 
  Station, 
  WashTask, 
  AuthResponse, 
  ApiResponse,
  DailySchedule 
} from '../types';

const BASE_URL = __DEV__ 
  ? 'http://localhost:5000'  // Development
  : 'https://petwash.co.il';  // Production

class PetWashAPI {
  private client: AxiosInstance;
  private authToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        if (!this.authToken) {
          this.authToken = await AsyncStorage.getItem('authToken');
        }
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.handleAuthError();
        }
        return Promise.reject(error);
      }
    );
  }

  private async handleAuthError() {
    await AsyncStorage.removeItem('authToken');
    this.authToken = null;
    // Trigger logout flow in app
  }

  /**
   * Authentication
   * Uses your existing /api/mobile-auth/google endpoint
   */
  async signInWithGoogle(idToken: string, authCode: string): Promise<AuthResponse> {
    const { data } = await this.client.post<AuthResponse>(
      '/api/mobile-auth/google',
      { idToken, authCode }
    );
    
    if (data.customToken) {
      this.authToken = data.customToken;
      await AsyncStorage.setItem('authToken', data.customToken);
    }
    
    return data;
  }

  async signOut() {
    await AsyncStorage.removeItem('authToken');
    this.authToken = null;
  }

  /**
   * Employee Management
   * Uses your existing /api/employees endpoints
   */
  async getEmployee(uid: string): Promise<Employee> {
    const { data } = await this.client.get<ApiResponse<{ employee: Employee }>>(
      `/api/employees/${uid}`
    );
    return data.data!.employee;
  }

  async getEmployees(): Promise<Employee[]> {
    const { data } = await this.client.get<ApiResponse<{ employees: Employee[] }>>(
      '/api/employees'
    );
    return data.data!.employees;
  }

  /**
   * Station Management
   * Uses your existing /api/admin/stations endpoints
   */
  async getStations(): Promise<Station[]> {
    const { data } = await this.client.get<ApiResponse<{ stations: Station[] }>>(
      '/api/admin/stations'
    );
    return data.data!.stations || [];
  }

  async getStation(stationId: string): Promise<Station> {
    const { data } = await this.client.get<ApiResponse<{ station: Station }>>(
      `/api/admin/stations/${stationId}`
    );
    return data.data!.station;
  }

  async updateStationStatus(
    stationId: string, 
    status: 'operational' | 'maintenance' | 'offline'
  ): Promise<void> {
    await this.client.post(`/api/admin/stations/${stationId}/status`, {
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  async checkInToStation(stationId: string, employeeUid: string): Promise<void> {
    await this.client.post(`/api/admin/stations/${stationId}/check-in`, {
      employeeUid,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Task Management
   */
  async getTodaysTasks(employeeUid: string): Promise<WashTask[]> {
    const { data } = await this.client.get<ApiResponse<{ tasks: WashTask[] }>>(
      `/api/employees/${employeeUid}/tasks/today`
    );
    return data.data?.tasks || [];
  }

  async getTaskDetails(taskId: string): Promise<WashTask> {
    const { data } = await this.client.get<ApiResponse<{ task: WashTask }>>(
      `/api/tasks/${taskId}`
    );
    return data.data!.task;
  }

  async startTask(taskId: string): Promise<void> {
    await this.client.post(`/api/tasks/${taskId}/start`, {
      startTime: new Date().toISOString(),
      status: 'in_progress',
    });
  }

  async completeTask(
    taskId: string, 
    beforePhotoUrl?: string, 
    afterPhotoUrl?: string,
    notes?: string
  ): Promise<void> {
    await this.client.post(`/api/tasks/${taskId}/complete`, {
      endTime: new Date().toISOString(),
      status: 'completed',
      beforePhoto: beforePhotoUrl,
      afterPhoto: afterPhotoUrl,
      notes,
    });
  }

  /**
   * Photo Upload
   */
  async uploadPhoto(uri: string, taskId: string, type: 'before' | 'after'): Promise<string> {
    const formData = new FormData();
    formData.append('photo', {
      uri,
      type: 'image/jpeg',
      name: `${taskId}_${type}_${Date.now()}.jpg`,
    } as any);
    formData.append('taskId', taskId);
    formData.append('type', type);

    const { data } = await this.client.post<ApiResponse<{ url: string }>>(
      '/api/upload/task-photo',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    return data.data!.url;
  }

  /**
   * Audit Trail
   * Uses your existing /api/audit endpoint
   */
  async logAuditEvent(
    eventType: string,
    entityType: string,
    entityId: string,
    details: Record<string, any>
  ): Promise<void> {
    await this.client.post('/api/audit', {
      eventType,
      entityType,
      entityId,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Schedule
   */
  async getDailySchedule(date: string): Promise<DailySchedule> {
    const { data } = await this.client.get<ApiResponse<{ schedule: DailySchedule }>>(
      `/api/schedule/daily?date=${date}`
    );
    return data.data!.schedule;
  }

  /**
   * Voice Commands
   */
  async processVoiceCommand(rawText: string, stationId: string): Promise<any> {
    const { data } = await this.client.post('/api/voice/command', {
      rawText,
      stationId,
    });
    return data;
  }

  async getVoiceCommands(): Promise<any> {
    const { data } = await this.client.get('/api/voice/commands');
    return data;
  }

  /**
   * AI Feedback
   */
  async notifyTaskComplete(taskId: string): Promise<any> {
    const { data } = await this.client.post('/api/ai-feedback/task-complete', {
      taskId,
    });
    return data;
  }

  async getPerformanceInsights(): Promise<string[]> {
    const { data } = await this.client.get<ApiResponse<{ insights: string[] }>>(
      '/api/ai-feedback/insights'
    );
    return data.data?.insights || [];
  }

  /**
   * Nayax Loyalty Tokens
   * DISABLED: Awaiting Nayax API credentials from vendor
   */
  // async createLoyaltyToken(
  //   loyaltyTier: string,
  //   discountPercent: number
  // ): Promise<any> {
  //   const { data } = await this.client.post('/api/nayax/loyalty/create-token', {
  //     loyaltyTier,
  //     discountPercent,
  //   });
  //   return data;
  // }

  // async activateLoyaltyToken(tokenId: string, stationId: string): Promise<any> {
  //   const { data } = await this.client.post('/api/nayax/loyalty/activate', {
  //     tokenId,
  //     stationId,
  //   });
  //   return data;
  // }

  /**
   * Health Check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/api/health');
      return true;
    } catch {
      return false;
    }
  }
}

export const petWashApi = new PetWashAPI();
export default petWashApi;
