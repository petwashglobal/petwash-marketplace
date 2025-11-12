// Shared types between backend and mobile app
// These match your backend TypeScript types exactly

export interface Employee {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'admin' | 'ops' | 'station_manager' | 'technician';
  stations: string[];
  status: 'active' | 'suspended' | 'inactive';
  employeeId: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface Station {
  id: string;
  name: string;
  location: string;
  address: string;
  isOnline: boolean;
  status: 'operational' | 'maintenance' | 'offline';
  lastPing?: string;
  serialNumber: string;
  model: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface WashTask {
  id: string;
  petId: string;
  petName: string;
  petSpecies: string;
  customerName: string;
  customerPhone: string;
  stationId: string;
  assignedToUid: string;
  scheduledTime: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  startTime?: string;
  endTime?: string;
  notes?: string;
  beforePhoto?: string;
  afterPhoto?: string;
}

export interface AuthResponse {
  success: boolean;
  customToken: string;
  token?: string;
  user: {
    uid: string;
    email: string;
    name: string;
    photoURL?: string;
    loyaltyTier: string;
    role: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DailySchedule {
  date: string;
  tasks: WashTask[];
  totalTasks: number;
  completedTasks: number;
}
